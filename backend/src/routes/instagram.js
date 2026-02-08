const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper para obter chave Apify (usuário > global)
async function getApifyKey(userId) {
  // 1. Tentar chave do usuário
  const userKeyResult = await db.query(
    `SELECT api_key FROM user_api_keys 
     WHERE user_id = $1 AND key_type = 'apify' AND is_active = true`,
    [userId]
  );
  
  if (userKeyResult.rows.length > 0 && userKeyResult.rows[0].api_key) {
    return { key: userKeyResult.rows[0].api_key, source: 'user' };
  }

  // 2. Fallback para chave global (variável de ambiente)
  if (process.env.APIFY_API_KEY) {
    return { key: process.env.APIFY_API_KEY, source: 'global' };
  }

  return { key: null, source: null };
}

// Helper para verificar limite
async function checkLimit(userId, type, count = 1) {
  const month = new Date().toISOString().slice(0, 7);
  
  const userResult = await db.query('SELECT plan_id FROM users WHERE id = $1', [userId]);
  const planId = userResult.rows[0]?.plan_id || 'free';
  
  const planResult = await db.query(
    'SELECT monthly_searches FROM plans WHERE id = $1',
    [planId]
  );
  
  const plan = planResult.rows[0];
  if (!plan) return false;
  
  const usageResult = await db.query(
    `SELECT searches_used FROM user_usage WHERE user_id = $1 AND month = $2`,
    [userId, month]
  );
  
  const usage = usageResult.rows[0] || { searches_used: 0 };
  return (usage.searches_used + count) <= plan.monthly_searches;
}

// Helper para incrementar uso
async function incrementUsage(userId, type, count = 1) {
  const month = new Date().toISOString().slice(0, 7);
  
  await db.query(
    `INSERT INTO user_usage (user_id, month, searches_used, leads_extracted, whatsapp_verified)
     VALUES ($1, $2, 0, 0, 0)
     ON CONFLICT (user_id, month) DO NOTHING`,
    [userId, month]
  );

  await db.query(
    `UPDATE user_usage SET searches_used = searches_used + $1 WHERE user_id = $2 AND month = $3`,
    [count, userId, month]
  );
}

// Buscar sugestões de usernames (autocomplete)
router.post('/suggestions', authenticate, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const { key: apiKey } = await getApifyKey(req.user.id);
    if (!apiKey) {
      return res.json({ suggestions: [] });
    }

    const cleanQuery = query.replace('@', '').replace('#', '').trim();
    console.log('Buscando sugestões para:', cleanQuery);

    // Usar o actor Instagram Search para buscar perfis similares
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=30`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          search: cleanQuery,
          searchType: 'user',
          searchLimit: 10,
          resultsType: 'details',
          resultsLimit: 10,
        }),
      }
    );

    if (!runResponse.ok) {
      console.error('Erro ao buscar sugestões:', runResponse.status);
      return res.json({ suggestions: [] });
    }

    const results = await runResponse.json();
    
    // Mapear para sugestões simplificadas
    const suggestions = results.map(item => ({
      username: item.username,
      fullName: item.fullName || item.username,
      profilePicUrl: item.profilePicUrl,
      followersCount: item.followersCount,
      isVerified: item.verified || false,
      isBusinessAccount: item.isBusinessAccount || false,
    })).slice(0, 8);

    res.json({ suggestions });

  } catch (error) {
    console.error('Erro ao buscar sugestões:', error);
    res.json({ suggestions: [] });
  }
});

// Buscar perfis do Instagram via Apify
router.post('/search', authenticate, async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Termo de pesquisa é obrigatório' });
    }

    // Verificar limite do usuário
    const canSearch = await checkLimit(req.user.id, 'search', 1);
    if (!canSearch) {
      return res.status(403).json({ message: 'Limite de pesquisas atingido para este mês' });
    }

    const { key: apiKey, source } = await getApifyKey(req.user.id);
    if (!apiKey) {
      return res.status(503).json({ 
        message: 'Nenhuma chave Apify configurada. Configure sua chave em Configurações > API Keys ou contate o administrador.' 
      });
    }

    console.log(`Iniciando busca Instagram via Apify (chave: ${source}):`, { query, limit });

    const cleanQuery = query.replace('@', '').replace('#', '').trim();
    const isHashtag = query.startsWith('#');

    // Executar o actor de forma síncrona (aguarda resultado)
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(isHashtag ? {
          // Busca por hashtag
          directUrls: [`https://www.instagram.com/explore/tags/${cleanQuery}/`],
          resultsType: 'details',
          resultsLimit: limit,
        } : {
          // Busca por termo - retorna múltiplos perfis
          search: cleanQuery,
          searchType: 'user',
          searchLimit: limit,
          resultsType: 'details',
          resultsLimit: limit,
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Erro Apify:', runResponse.status, errorText);
      return res.status(502).json({ 
        message: 'Erro ao consultar Apify API',
        details: errorText,
        status: runResponse.status 
      });
    }

    const results = await runResponse.json();
    console.log('Resultados Apify:', results.length);

    // Incrementar uso
    await incrementUsage(req.user.id, 'search', 1);

    // Processar resultados para formato de leads
    const leads = results.map((item, index) => extractLeadFromInstagram(item, query, index));

    res.json({
      leads,
      pagination: {
        currentPage: 1,
        totalResults: leads.length,
        hasMore: false,
      },
      searchMetadata: {
        source: 'Instagram via Apify',
        query,
        totalResults: leads.length,
      }
    });

  } catch (error) {
    console.error('Erro na pesquisa Instagram:', error);
    res.status(500).json({ message: 'Erro ao realizar pesquisa no Instagram' });
  }
});

// Buscar perfil específico do Instagram
router.post('/profile', authenticate, async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username é obrigatório' });
    }

    const { key: apiKey, source } = await getApifyKey(req.user.id);
    if (!apiKey) {
      return res.status(503).json({ 
        message: 'Nenhuma chave Apify configurada. Configure sua chave em Configurações > API Keys.' 
      });
    }

    const cleanUsername = username.replace('@', '').trim();
    console.log(`Buscando perfil Instagram (chave: ${source}):`, cleanUsername);

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/${cleanUsername}/`],
          resultsType: 'details',
          resultsLimit: 1,
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Erro Apify profile:', runResponse.status, errorText);
      return res.status(502).json({ message: 'Erro ao buscar perfil' });
    }

    const results = await runResponse.json();
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Perfil não encontrado' });
    }

    const profile = results[0];
    res.json({
      username: profile.username,
      fullName: profile.fullName,
      biography: profile.biography,
      externalUrl: profile.externalUrl,
      followersCount: profile.followersCount,
      followingCount: profile.followsCount,
      postsCount: profile.postsCount,
      isVerified: profile.verified,
      isBusinessAccount: profile.isBusinessAccount,
      businessCategory: profile.businessCategoryName,
      profilePicUrl: profile.profilePicUrl,
      email: extractEmailFromBio(profile.biography),
      phone: extractPhoneFromBio(profile.biography),
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ message: 'Erro ao buscar perfil' });
  }
});

// Extrair lead de resultado do Instagram
function extractLeadFromInstagram(item, searchTerm, position) {
  const bio = item.biography || '';
  
  return {
    id: `ig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company: item.fullName || item.username || 'Sem nome',
    website: item.externalUrl || null,
    phone: extractPhoneFromBio(bio),
    whatsapp: extractPhoneFromBio(bio),
    email: extractEmailFromBio(bio),
    whatsappValid: null,
    source: 'Instagram',
    searchTerm,
    createdAt: new Date().toISOString(),
    // Dados específicos do Instagram
    address: null,
    rating: null,
    ratingCount: null,
    category: item.businessCategoryName || null,
    serpData: {
      type: 'instagram',
      position,
      username: item.username,
      fullName: item.fullName,
      biography: bio,
      followersCount: item.followersCount,
      followingCount: item.followsCount,
      postsCount: item.postsCount,
      isVerified: item.verified,
      isBusinessAccount: item.isBusinessAccount,
      businessCategory: item.businessCategoryName,
      profilePicUrl: item.profilePicUrl,
      externalUrl: item.externalUrl,
      profileUrl: `https://instagram.com/${item.username}`,
    }
  };
}

// Extrair email da bio
function extractEmailFromBio(bio) {
  if (!bio) return null;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const matches = bio.match(emailRegex);
  return matches ? matches[0] : null;
}

// Extrair telefone da bio
function extractPhoneFromBio(bio) {
  if (!bio) return null;
  const phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
  const matches = bio.match(phoneRegex);
  return matches ? matches[0].replace(/\D/g, '') : null;
}

module.exports = router;
