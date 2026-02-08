const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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

// Buscar perfis do Instagram via Firecrawl
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

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ 
        message: 'Firecrawl API não configurada. Configure FIRECRAWL_API_KEY nas variáveis de ambiente.' 
      });
    }

    const cleanQuery = query.replace('@', '').replace('#', '').trim();
    console.log('Iniciando busca Instagram via Firecrawl:', { query: cleanQuery, limit });

    // Estratégia: buscar no Google por perfis do Instagram relacionados ao termo
    const searchQuery = `site:instagram.com "${cleanQuery}" -/p/ -/reel/`;
    
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: Math.min(limit, 20),
        scrapeOptions: {
          formats: ['markdown', 'html'],
        },
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Erro Firecrawl Search:', searchResponse.status, errorText);
      return res.status(502).json({ 
        message: 'Erro ao consultar Firecrawl API',
        details: errorText,
        status: searchResponse.status 
      });
    }

    const searchResults = await searchResponse.json();
    console.log('Resultados Firecrawl Search:', searchResults.data?.length || 0);

    // Processar resultados para formato de leads
    const leads = [];
    const processedUsernames = new Set();

    for (const result of (searchResults.data || [])) {
      const username = extractUsernameFromUrl(result.url);
      if (!username || processedUsernames.has(username)) continue;
      processedUsernames.add(username);

      // Scrape do perfil individual para mais detalhes
      const profileData = await scrapeInstagramProfile(apiKey, username);
      if (profileData) {
        leads.push(createLeadFromProfile(profileData, query, leads.length));
      }
    }

    // Incrementar uso
    await incrementUsage(req.user.id, 'search', 1);

    res.json({
      leads,
      pagination: {
        currentPage: 1,
        totalResults: leads.length,
        hasMore: false,
      },
      searchMetadata: {
        source: 'Instagram via Firecrawl',
        query,
        totalResults: leads.length,
      }
    });

  } catch (error) {
    console.error('Erro na pesquisa Instagram Firecrawl:', error);
    res.status(500).json({ message: 'Erro ao realizar pesquisa no Instagram' });
  }
});

// Buscar perfil específico do Instagram via Firecrawl
router.post('/profile', authenticate, async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username é obrigatório' });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ 
        message: 'Firecrawl API não configurada.' 
      });
    }

    const cleanUsername = username.replace('@', '').trim();
    console.log('Buscando perfil Instagram via Firecrawl:', cleanUsername);

    const profileData = await scrapeInstagramProfile(apiKey, cleanUsername);
    
    if (!profileData) {
      return res.status(404).json({ message: 'Perfil não encontrado' });
    }

    res.json(profileData);

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ message: 'Erro ao buscar perfil' });
  }
});

// Scrape de perfil individual do Instagram
async function scrapeInstagramProfile(apiKey, username) {
  try {
    const profileUrl = `https://www.instagram.com/${username}/`;
    
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: profileUrl,
        formats: ['markdown', 'html', 'links'],
        waitFor: 3000,
      }),
    });

    if (!scrapeResponse.ok) {
      console.error('Erro ao fazer scrape do perfil:', scrapeResponse.status);
      return null;
    }

    const scrapeData = await scrapeResponse.json();
    const data = scrapeData.data || scrapeData;
    
    // Extrair informações do HTML/Markdown
    const html = data.html || '';
    const markdown = data.markdown || '';
    const links = data.links || [];
    const metadata = data.metadata || {};

    // Parse dos dados do perfil
    const profileInfo = parseInstagramProfile(html, markdown, metadata, links, username);
    
    return profileInfo;

  } catch (error) {
    console.error('Erro no scrape do perfil:', error);
    return null;
  }
}

// Parse das informações do perfil do Instagram
function parseInstagramProfile(html, markdown, metadata, links, username) {
  const profile = {
    username: username,
    fullName: null,
    biography: null,
    externalUrl: null,
    followersCount: null,
    followingCount: null,
    postsCount: null,
    isVerified: false,
    isBusinessAccount: false,
    businessCategory: null,
    profilePicUrl: null,
    email: null,
    phone: null,
    whatsapp: null,
    whatsappFromLink: false,
  };

  // Extrair do título da página
  if (metadata.title) {
    const titleMatch = metadata.title.match(/^(.+?)\s*\(@?(\w+)\)/);
    if (titleMatch) {
      profile.fullName = titleMatch[1].trim();
    }
  }

  // Extrair descrição da página como bio
  if (metadata.description) {
    profile.biography = metadata.description;
  }

  // Extrair números do markdown/html
  const followersMatch = markdown.match(/(\d+(?:[.,]\d+)?[KMkm]?)\s*(?:Followers|Seguidores)/i);
  if (followersMatch) {
    profile.followersCount = parseCount(followersMatch[1]);
  }

  const followingMatch = markdown.match(/(\d+(?:[.,]\d+)?[KMkm]?)\s*(?:Following|Seguindo)/i);
  if (followingMatch) {
    profile.followingCount = parseCount(followingMatch[1]);
  }

  const postsMatch = markdown.match(/(\d+(?:[.,]\d+)?[KMkm]?)\s*(?:Posts|Publicações)/i);
  if (postsMatch) {
    profile.postsCount = parseCount(postsMatch[1]);
  }

  // Verificar se é verificado
  profile.isVerified = html.includes('Verified') || html.includes('verificado') || markdown.includes('✓');

  // Extrair dados de contato da bio e links
  const allText = `${profile.biography || ''} ${links.join(' ')}`;
  const extractedData = extractAllFromText(allText);

  profile.email = extractedData.email;
  profile.phone = extractedData.phone;
  profile.whatsapp = extractedData.whatsapp;
  profile.whatsappFromLink = extractedData.whatsappFromLink;
  profile.externalUrl = extractedData.website || links.find(l => !l.includes('instagram.com'));

  return profile;
}

// Converter contagem com K/M para número
function parseCount(str) {
  if (!str) return null;
  str = str.replace(/,/g, '.').toUpperCase();
  
  if (str.includes('K')) {
    return Math.round(parseFloat(str.replace('K', '')) * 1000);
  }
  if (str.includes('M')) {
    return Math.round(parseFloat(str.replace('M', '')) * 1000000);
  }
  return parseInt(str.replace(/\D/g, ''), 10) || null;
}

// Extrair username da URL do Instagram
function extractUsernameFromUrl(url) {
  if (!url) return null;
  const match = url.match(/instagram\.com\/([^/?#]+)/);
  if (match && !['p', 'reel', 'reels', 'stories', 'explore', 'accounts'].includes(match[1])) {
    return match[1];
  }
  return null;
}

// Função para extrair dados de contato do texto
function extractAllFromText(text) {
  const result = {
    phone: null,
    whatsapp: null,
    whatsappFromLink: false,
    email: null,
    website: null,
  };

  if (!text) return result;

  // Extrair WhatsApp de links
  const whatsappLinkRegex = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\?phone=|whats\.link\/|whatsa\.me\/|zap\.link\/)[\/?]?(\d{10,15})/gi;
  let waMatch;
  while ((waMatch = whatsappLinkRegex.exec(text)) !== null) {
    const number = waMatch[1]?.replace(/\D/g, '');
    if (number && number.length >= 10) {
      result.whatsapp = number;
      result.whatsappFromLink = true;
    }
  }

  // Extrair emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const emails = text.match(emailRegex) || [];
  result.email = emails[0] || null;

  // Extrair telefones
  const phoneRegex = /(?:\+?55\s?)?(?:\(?0?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
  const phones = text.match(phoneRegex) || [];
  if (phones.length > 0) {
    result.phone = phones[0].replace(/\D/g, '');
  }

  // Se encontramos WhatsApp mas não telefone, usar o WhatsApp
  if (!result.phone && result.whatsapp) {
    result.phone = result.whatsapp;
  }

  // Extrair website
  const urlRegex = /https?:\/\/[^\s<>"')}\]]+/gi;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    if (!url.includes('instagram.com') && !url.includes('wa.me') && !url.includes('whatsapp.com')) {
      result.website = url;
      break;
    }
  }

  return result;
}

// Criar lead a partir do perfil
function createLeadFromProfile(profileData, searchTerm, position) {
  return {
    id: `ig-fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company: profileData.fullName || profileData.username || 'Sem nome',
    website: profileData.externalUrl || null,
    phone: profileData.phone,
    whatsapp: profileData.whatsapp,
    email: profileData.email,
    whatsappValid: profileData.whatsappFromLink ? true : null,
    source: 'Instagram',
    searchTerm,
    createdAt: new Date().toISOString(),
    address: null,
    rating: null,
    ratingCount: null,
    category: profileData.businessCategory,
    serpData: {
      type: 'instagram',
      position,
      username: profileData.username,
      fullName: profileData.fullName,
      biography: profileData.biography,
      followersCount: profileData.followersCount,
      followingCount: profileData.followingCount,
      postsCount: profileData.postsCount,
      isVerified: profileData.isVerified,
      isBusinessAccount: profileData.isBusinessAccount,
      businessCategory: profileData.businessCategory,
      profilePicUrl: profileData.profilePicUrl,
      externalUrl: profileData.externalUrl,
      profileUrl: `https://instagram.com/${profileData.username}`,
      whatsappFromLink: profileData.whatsappFromLink,
    }
  };
}

module.exports = router;
