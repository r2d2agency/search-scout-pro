const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const apifyKeysRouter = require('./apify-keys');

const router = express.Router();

// Helper para obter chave Apify (usando rotação de chaves globais)
async function getApifyKey(userId) {
  return apifyKeysRouter.getNextAvailableKey(userId);
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

    // Usar o actor instagram-search-scraper para buscar múltiplos perfis por termo
    // Este actor retorna resultados de busca do Instagram (múltiplos perfis que contêm o termo)
    const actorId = 'apify~instagram-search-scraper';
    
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          search: cleanQuery,
          searchType: isHashtag ? 'hashtag' : 'user',
          resultsLimit: Math.min(limit, 50),
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

// Função principal para extrair todos os dados da bio
function extractAllFromBio(bio, externalUrl) {
  const result = {
    phone: null,
    whatsapp: null,
    whatsappFromLink: false,
    email: null,
    website: null,
    links: [],
    allPhones: [],
    allEmails: [],
  };

  if (!bio && !externalUrl) return result;

  const fullText = `${bio || ''} ${externalUrl || ''}`;

  // 1. Extrair números de WhatsApp de links (wa.me, api.whatsapp, etc.)
  const whatsappLinkRegex = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\?phone=|whats\.link\/|whatsa\.me\/|zap\.link\/)[\/?]?(\d{10,15})/gi;
  let waMatch;
  while ((waMatch = whatsappLinkRegex.exec(fullText)) !== null) {
    const number = waMatch[1]?.replace(/\D/g, '');
    if (number && number.length >= 10) {
      result.whatsapp = number;
      result.whatsappFromLink = true;
      if (!result.allPhones.some(p => p.number === number)) {
        result.allPhones.push({ number, source: 'whatsapp_link', isWhatsApp: true });
      }
    }
  }

  // 2. Extrair links wa.me completos
  const waLinkRegex = /https?:\/\/(?:wa\.me|api\.whatsapp\.com|whatsapp\.com|whats\.link|whatsa\.me|zap\.link)[^\s<>"')}\]]+/gi;
  const waLinks = fullText.match(waLinkRegex) || [];
  for (const link of waLinks) {
    result.links.push({ url: link, type: 'whatsapp' });
    
    // Extrair número do link se ainda não temos
    if (!result.whatsapp) {
      const numMatch = link.match(/(\d{10,15})/);
      if (numMatch) {
        result.whatsapp = numMatch[1];
        result.whatsappFromLink = true;
      }
    }
  }

  // 3. Extrair emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const emails = fullText.match(emailRegex) || [];
  result.allEmails = [...new Set(emails)];
  result.email = result.allEmails[0] || null;

  // 4. Extrair telefones (formato brasileiro e internacional)
  const phoneRegex = /(?:\+?55\s?)?(?:\(?0?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
  const intlPhoneRegex = /\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

  const foundPhones = new Set();
  
  const brMatches = fullText.match(phoneRegex) || [];
  for (const match of brMatches) {
    const cleaned = match.replace(/\D/g, '');
    if (cleaned.length >= 10 && cleaned.length <= 15) {
      foundPhones.add(cleaned);
    }
  }

  const intlMatches = fullText.match(intlPhoneRegex) || [];
  for (const match of intlMatches) {
    const cleaned = match.replace(/\D/g, '');
    if (cleaned.length >= 10 && cleaned.length <= 15) {
      foundPhones.add(cleaned);
    }
  }

  // Adicionar telefones encontrados (excluindo os que já são WhatsApp de link)
  for (const phone of foundPhones) {
    const isAlreadyAdded = result.allPhones.some(p => p.number === phone);
    if (!isAlreadyAdded) {
      // Assumir que telefones na bio podem ser WhatsApp
      result.allPhones.push({ number: phone, source: 'bio', isWhatsApp: true });
    }
    if (!result.phone) {
      result.phone = phone;
    }
    // Se não encontramos WhatsApp via link, usar o telefone encontrado
    if (!result.whatsapp) {
      result.whatsapp = phone;
    }
  }

  // Se encontramos WhatsApp mas não telefone, usar o WhatsApp como telefone também
  if (!result.phone && result.whatsapp) {
    result.phone = result.whatsapp;
  }

  // 5. Extrair outros links (não WhatsApp)
  const linkRegex = /https?:\/\/[^\s<>"')}\]]+/gi;
  const allLinks = fullText.match(linkRegex) || [];
  for (const link of allLinks) {
    // Ignorar links do Instagram
    if (link.includes('instagram.com')) continue;
    
    // Já adicionamos links de WhatsApp
    const isWaLink = waLinks.some(wa => link === wa);
    if (isWaLink) continue;

    // Classificar o link
    let type = 'website';
    if (link.includes('linktr.ee') || link.includes('linktree')) type = 'linktree';
    else if (link.includes('bio.link') || link.includes('beacons.ai')) type = 'bio_link';
    else if (link.includes('youtube.com') || link.includes('youtu.be')) type = 'youtube';
    else if (link.includes('tiktok.com')) type = 'tiktok';
    else if (link.includes('facebook.com') || link.includes('fb.com')) type = 'facebook';
    else if (link.includes('twitter.com') || link.includes('x.com')) type = 'twitter';
    else if (link.includes('linkedin.com')) type = 'linkedin';
    
    if (!result.links.some(l => l.url === link)) {
      result.links.push({ url: link, type });
    }
    
    // Primeiro link não-social como website
    if (!result.website && type === 'website') {
      result.website = link;
    }
  }

  return result;
}

// Extrair lead de resultado do Instagram
// Compatível com ambos actors: instagram-scraper e instagram-search-scraper
function extractLeadFromInstagram(item, searchTerm, position) {
  // O instagram-search-scraper pode retornar dados em estrutura diferente
  const bio = item.biography || item.bio || '';
  const externalUrl = item.externalUrl || item.external_url || item.website || '';
  const username = item.username || item.user?.username || '';
  const fullName = item.fullName || item.full_name || item.name || username;
  const followersCount = item.followersCount || item.followers_count || item.followers || 0;
  const followingCount = item.followsCount || item.following_count || item.following || 0;
  const postsCount = item.postsCount || item.posts_count || item.mediaCount || 0;
  const isVerified = item.verified || item.is_verified || false;
  const isBusinessAccount = item.isBusinessAccount || item.is_business_account || false;
  const businessCategory = item.businessCategoryName || item.business_category_name || item.category || null;
  const profilePicUrl = item.profilePicUrl || item.profile_pic_url || item.profilePicture || null;
  
  // Extrair todos os dados da bio
  const extractedData = extractAllFromBio(bio, externalUrl);
  
  return {
    id: `ig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company: fullName || 'Sem nome',
    website: extractedData.website || externalUrl || null,
    phone: extractedData.phone,
    whatsapp: extractedData.whatsapp,
    email: extractedData.email,
    whatsappValid: extractedData.whatsappFromLink ? true : null,
    source: 'Instagram',
    searchTerm,
    createdAt: new Date().toISOString(),
    address: null,
    rating: null,
    ratingCount: null,
    category: businessCategory,
    serpData: {
      type: 'instagram',
      position,
      username: username,
      fullName: fullName,
      biography: bio,
      followersCount: followersCount,
      followingCount: followingCount,
      postsCount: postsCount,
      isVerified: isVerified,
      isBusinessAccount: isBusinessAccount,
      businessCategory: businessCategory,
      profilePicUrl: profilePicUrl,
      externalUrl: externalUrl,
      profileUrl: username ? `https://instagram.com/${username}` : null,
      extractedLinks: extractedData.links,
      extractedPhones: extractedData.allPhones,
      extractedEmails: extractedData.allEmails,
      whatsappFromLink: extractedData.whatsappFromLink,
    }
  };
}

module.exports = router;
