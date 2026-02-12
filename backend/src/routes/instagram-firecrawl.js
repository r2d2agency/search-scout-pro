const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const firecrawlKeysRouter = require('./firecrawl-keys');

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
    const { query, limit = 20, page = 1 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Termo de pesquisa é obrigatório' });
    }

    // Verificar limite do usuário
    const canSearch = await checkLimit(req.user.id, 'search', 1);
    if (!canSearch) {
      return res.status(403).json({ message: 'Limite de pesquisas atingido para este mês' });
    }

    // Obter chave via rotação (usuário > global > env)
    const { key: apiKey, source: keySource } = await firecrawlKeysRouter.getNextAvailableKey(req.user.id);
    
    if (!apiKey) {
      return res.status(503).json({ 
        message: 'Nenhuma chave Firecrawl disponível. Configure uma chave no painel de administração.' 
      });
    }

    console.log(`[Firecrawl] Usando chave de: ${keySource}`);

    const cleanQuery = query.replace('@', '').replace('#', '').trim();
    console.log('[Firecrawl] Iniciando busca Instagram:', { query: cleanQuery, limit });

    // ESTRATÉGIA 1: Buscar diretamente perfis do Instagram via Google
    // Usar query mais específica para perfis comerciais
    const searchQueries = [
      `"${cleanQuery}" site:instagram.com`,
      `${cleanQuery} instagram perfil`,
    ];

    let allResults = [];

    for (const searchQuery of searchQueries) {
      try {
        console.log(`[Firecrawl] Tentando query: ${searchQuery} (Página ${page})`);
        
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: Math.min(limit, 10),
            page: page
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log(`[Firecrawl] Resultados para "${searchQuery}":`, searchData.data?.length || 0);
          
          if (searchData.data && searchData.data.length > 0) {
            allResults = [...allResults, ...searchData.data];
          }
        } else {
          const errorText = await searchResponse.text();
          console.error(`[Firecrawl] Erro na busca:`, searchResponse.status, errorText);
        }
      } catch (err) {
        console.error(`[Firecrawl] Erro na query "${searchQuery}":`, err.message);
      }

      // Se já temos resultados suficientes, parar
      if (allResults.length >= limit) break;
    }

    console.log(`[Firecrawl] Total de resultados brutos: ${allResults.length}`);

    // Processar resultados para formato de leads
    const leads = [];
    const processedUsernames = new Set();

    for (const result of allResults) {
      // Tentar extrair username de URLs do Instagram
      const username = extractUsernameFromUrl(result.url);
      
      if (username && !processedUsernames.has(username)) {
        processedUsernames.add(username);
        
        // Criar lead básico a partir dos dados da busca
        const lead = createLeadFromSearchResult(result, username, cleanQuery, leads.length);
        leads.push(lead);
        
        console.log(`[Firecrawl] Lead encontrado: @${username}`);
      }

      if (leads.length >= limit) break;
    }

    // Se não encontramos nada via busca, tentar scrape direto do perfil
    if (leads.length === 0 && cleanQuery.length > 2) {
      console.log(`[Firecrawl] Tentando scrape direto do perfil: @${cleanQuery}`);
      
      const profileData = await scrapeInstagramProfile(apiKey, cleanQuery);
      if (profileData && profileData.username) {
        leads.push(createLeadFromProfile(profileData, query, 0));
      }
    }

    // Incrementar uso
    await incrementUsage(req.user.id, 'search', 1);

    console.log(`[Firecrawl] Leads finais: ${leads.length}`);

    res.json({
      leads,
      pagination: {
        currentPage: page,
        totalResults: leads.length,
        hasMore: leads.length > 0, // Se retornou leads, assumimos que pode ter mais na próxima página
      },
      searchMetadata: {
        source: 'Instagram via Firecrawl',
        query,
        totalResults: leads.length,
        keySource,
      }
    });

  } catch (error) {
    console.error('[Firecrawl] Erro na pesquisa:', error);
    res.status(500).json({ message: 'Erro ao realizar pesquisa no Instagram', details: error.message });
  }
});

// Buscar perfil específico do Instagram via Firecrawl
router.post('/profile', authenticate, async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username é obrigatório' });
    }

    // Obter chave via rotação
    const { key: apiKey, source: keySource } = await firecrawlKeysRouter.getNextAvailableKey();
    
    if (!apiKey) {
      return res.status(503).json({ message: 'Nenhuma chave Firecrawl disponível.' });
    }

    const cleanUsername = username.replace('@', '').trim();
    console.log('[Firecrawl] Buscando perfil:', cleanUsername);

    const profileData = await scrapeInstagramProfile(apiKey, cleanUsername);
    
    if (!profileData) {
      return res.status(404).json({ message: 'Perfil não encontrado' });
    }

    res.json(profileData);

  } catch (error) {
    console.error('[Firecrawl] Erro ao buscar perfil:', error);
    res.status(500).json({ message: 'Erro ao buscar perfil' });
  }
});

// Criar lead a partir do resultado da busca (sem scrape adicional)
function createLeadFromSearchResult(result, username, searchTerm, position) {
  const title = result.title || '';
  const description = result.description || '';
  const url = result.url || '';

  // Tentar extrair nome do título (formato: "Nome (@username)")
  let fullName = username;
  const titleMatch = title.match(/^(.+?)\s*[\(\|@-]/);
  if (titleMatch) {
    fullName = titleMatch[1].trim();
  }

  // Extrair dados de contato do description
  const contactData = extractAllFromText(`${title} ${description} ${url}`);

  return {
    id: `ig-fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company: fullName || username,
    website: contactData.website,
    phone: contactData.phone,
    whatsapp: contactData.whatsapp,
    email: contactData.email,
    whatsappValid: contactData.whatsappFromLink ? true : null,
    source: 'Instagram',
    searchTerm,
    createdAt: new Date().toISOString(),
    address: null,
    rating: null,
    ratingCount: null,
    category: null,
    serpData: {
      type: 'instagram',
      position,
      username: username,
      fullName: fullName,
      biography: description,
      followersCount: null,
      followingCount: null,
      postsCount: null,
      isVerified: false,
      isBusinessAccount: false,
      businessCategory: null,
      profilePicUrl: null,
      externalUrl: contactData.website,
      profileUrl: `https://instagram.com/${username}`,
      whatsappFromLink: contactData.whatsappFromLink,
      sourceUrl: url,
    }
  };
}

// Scrape de perfil individual do Instagram
async function scrapeInstagramProfile(apiKey, username) {
  try {
    const profileUrl = `https://www.instagram.com/${username}/`;
    
    console.log(`[Firecrawl] Scraping perfil: ${profileUrl}`);
    
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: profileUrl,
        formats: ['markdown', 'links'],
        waitFor: 2000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('[Firecrawl] Erro scrape:', scrapeResponse.status, errorText);
      return null;
    }

    const scrapeData = await scrapeResponse.json();
    const data = scrapeData.data || scrapeData;
    
    console.log('[Firecrawl] Scrape sucesso, processando dados...');
    
    const markdown = data.markdown || '';
    const links = data.links || [];
    const metadata = data.metadata || {};

    // Parse dos dados do perfil
    const profileInfo = parseInstagramProfile(markdown, metadata, links, username);
    
    return profileInfo;

  } catch (error) {
    console.error('[Firecrawl] Erro no scrape do perfil:', error.message);
    return null;
  }
}

// Parse das informações do perfil do Instagram
function parseInstagramProfile(markdown, metadata, links, username) {
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
    const titleMatch = metadata.title.match(/^(.+?)\s*[\(\|@]/);
    if (titleMatch) {
      profile.fullName = titleMatch[1].trim();
    }
  }

  // Extrair descrição da página como bio
  if (metadata.description) {
    profile.biography = metadata.description;
  }

  // Extrair números do markdown
  const followersMatch = markdown.match(/(\d+(?:[.,]\d+)?[KMkm]?)\s*(?:Followers|Seguidores|followers)/i);
  if (followersMatch) {
    profile.followersCount = parseCount(followersMatch[1]);
  }

  const followingMatch = markdown.match(/(\d+(?:[.,]\d+)?[KMkm]?)\s*(?:Following|Seguindo|following)/i);
  if (followingMatch) {
    profile.followingCount = parseCount(followingMatch[1]);
  }

  const postsMatch = markdown.match(/(\d+(?:[.,]\d+)?[KMkm]?)\s*(?:Posts|Publicações|posts)/i);
  if (postsMatch) {
    profile.postsCount = parseCount(postsMatch[1]);
  }

  // Verificar se é verificado
  profile.isVerified = markdown.includes('Verified') || markdown.includes('verificado') || markdown.includes('✓');

  // Extrair dados de contato da bio e links
  const linksText = links.join(' ');
  const allText = `${profile.biography || ''} ${linksText}`;
  const extractedData = extractAllFromText(allText);

  profile.email = extractedData.email;
  profile.phone = extractedData.phone;
  profile.whatsapp = extractedData.whatsapp;
  profile.whatsappFromLink = extractedData.whatsappFromLink;
  
  // Encontrar URL externa (não Instagram, não WhatsApp)
  for (const link of links) {
    if (!link.includes('instagram.com') && 
        !link.includes('wa.me') && 
        !link.includes('whatsapp.com') &&
        !link.includes('facebook.com') &&
        link.startsWith('http')) {
      profile.externalUrl = link;
      break;
    }
  }

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
  
  // Padrões de URL do Instagram
  const patterns = [
    /instagram\.com\/([a-zA-Z0-9._]+)\/?(?:\?|$|#)/,
    /instagram\.com\/([a-zA-Z0-9._]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const username = match[1].toLowerCase();
      // Filtrar páginas que não são perfis
      const excluded = ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'about', 'legal', 'privacy', 'terms', 'help'];
      if (!excluded.includes(username)) {
        return username;
      }
    }
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

  // Extrair WhatsApp de links (vários formatos)
  const whatsappPatterns = [
    /wa\.me\/(\d{10,15})/gi,
    /api\.whatsapp\.com\/send\?phone=(\d{10,15})/gi,
    /whatsapp\.com\/send\?phone=(\d{10,15})/gi,
    /whats\.link\/(\d{10,15})/gi,
    /whatsa\.me\/(\d{10,15})/gi,
    /zap\.link\/(\d{10,15})/gi,
    /wa\.link\/(\d{10,15})/gi,
  ];
  
  for (const pattern of whatsappPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const number = match[1]?.replace(/\D/g, '');
      if (number && number.length >= 10) {
        result.whatsapp = number;
        result.whatsappFromLink = true;
        break;
      }
    }
    if (result.whatsapp) break;
  }

  // Extrair emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const emails = text.match(emailRegex) || [];
  result.email = emails[0] || null;

  // Extrair telefones brasileiros
  const phoneRegex = /(?:\+?55\s?)?(?:\(?0?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
  const phones = text.match(phoneRegex) || [];
  if (phones.length > 0) {
    result.phone = phones[0].replace(/\D/g, '');
    
    // Se temos telefone mas não WhatsApp (via link), usar o telefone como WhatsApp
    if (!result.whatsapp) {
      result.whatsapp = result.phone;
    }
  }

  // Se encontramos WhatsApp mas não telefone, usar o WhatsApp
  if (!result.phone && result.whatsapp) {
    result.phone = result.whatsapp;
  }

  // Extrair website
  const urlRegex = /https?:\/\/[^\s<>"')}\],]+/gi;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    if (!url.includes('instagram.com') && 
        !url.includes('wa.me') && 
        !url.includes('whatsapp.com') &&
        !url.includes('facebook.com')) {
      result.website = url.replace(/[.,]+$/, ''); // Remove pontuação final
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
