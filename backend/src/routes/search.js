const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getNextAvailableKey } = require('./serp-keys');

const router = express.Router();

// Helper para incrementar uso
async function incrementUsage(userId, type, count = 1) {
  const month = new Date().toISOString().slice(0, 7);
  
  await db.query(
    `INSERT INTO user_usage (user_id, month, searches_used, leads_extracted, whatsapp_verified)
     VALUES ($1, $2, 0, 0, 0)
     ON CONFLICT (user_id, month) DO NOTHING`,
    [userId, month]
  );

  const column = type === 'search' ? 'searches_used' : 
                 type === 'leads' ? 'leads_extracted' : 'whatsapp_verified';
  
  await db.query(
    `UPDATE user_usage SET ${column} = ${column} + $1 WHERE user_id = $2 AND month = $3`,
    [count, userId, month]
  );
}

// Helper para verificar limite
async function checkLimit(userId, type, count = 1) {
  const month = new Date().toISOString().slice(0, 7);
  
  const userResult = await db.query('SELECT plan_id FROM users WHERE id = $1', [userId]);
  const planId = userResult.rows[0]?.plan_id || 'free';
  
  const planResult = await db.query(
    'SELECT monthly_searches, monthly_leads, whatsapp_verifications FROM plans WHERE id = $1',
    [planId]
  );
  
  const plan = planResult.rows[0];
  if (!plan) {
    return false;
  }
  
  const limit = type === 'search' ? plan.monthly_searches :
                type === 'leads' ? plan.monthly_leads : plan.whatsapp_verifications;
  
  const usageResult = await db.query(
    `SELECT searches_used, leads_extracted, whatsapp_verified FROM user_usage 
     WHERE user_id = $1 AND month = $2`,
    [userId, month]
  );
  
  const usage = usageResult.rows[0] || { searches_used: 0, leads_extracted: 0, whatsapp_verified: 0 };
  const used = type === 'search' ? usage.searches_used :
               type === 'leads' ? usage.leads_extracted : usage.whatsapp_verified;
  
  return (used + count) <= limit;
}

// Pesquisar usando chaves SERP globais
router.post('/', authenticate, async (req, res) => {
  try {
    const { query, page = 1 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Termo de pesquisa é obrigatório' });
    }

    // Verificar limite do usuário
    const canSearch = await checkLimit(req.user.id, 'search', 1);
    if (!canSearch) {
      return res.status(403).json({ message: 'Limite de pesquisas atingido para este mês' });
    }

    // Obter próxima chave SERP disponível (rotação automática)
    const apiKey = await getNextAvailableKey();
    if (!apiKey) {
      return res.status(503).json({ 
        message: 'Nenhuma chave SERP disponível. Contate o administrador.' 
      });
    }

    // Fazer requisição à SERP API
    const serpUrl = new URL('https://serpapi.com/search.json');
    serpUrl.searchParams.append('q', query);
    serpUrl.searchParams.append('location', 'Brazil');
    serpUrl.searchParams.append('google_domain', 'google.com.br');
    serpUrl.searchParams.append('gl', 'br');
    serpUrl.searchParams.append('hl', 'pt-br');
    serpUrl.searchParams.append('num', '20');
    serpUrl.searchParams.append('start', String((page - 1) * 20));
    serpUrl.searchParams.append('api_key', apiKey);

    const serpResponse = await fetch(serpUrl.toString());
    const serpData = await serpResponse.json();

    if (!serpResponse.ok) {
      console.error('Erro SERP API:', serpData);
      return res.status(500).json({ message: 'Erro ao consultar SERP API' });
    }

    // Incrementar uso do usuário
    await incrementUsage(req.user.id, 'search', 1);

    // Extrair leads dos resultados
    const organicResults = serpData.organic_results || [];
    const localResults = serpData.local_results || [];
    
    const leads = [];
    
    // Processar resultados orgânicos
    for (const result of organicResults) {
      const lead = extractLeadFromResult(result, query, 'organic');
      if (lead) leads.push(lead);
    }
    
    // Processar resultados locais (Google Maps)
    for (const result of localResults) {
      const lead = extractLeadFromLocalResult(result, query);
      if (lead) leads.push(lead);
    }

    // Informações de paginação
    const pagination = {
      currentPage: page,
      totalResults: serpData.search_information?.total_results || leads.length,
      hasMore: organicResults.length >= 20 || (serpData.serpapi_pagination?.next_link ? true : false),
      nextPageToken: serpData.serpapi_pagination?.next_link || null
    };

    res.json({
      leads,
      pagination,
      searchMetadata: {
        searchId: serpData.search_metadata?.id,
        totalResults: serpData.search_information?.total_results,
        timeTaken: serpData.search_information?.time_taken_displayed
      }
    });

  } catch (error) {
    console.error('Erro na pesquisa:', error);
    res.status(500).json({ message: 'Erro ao realizar pesquisa' });
  }
});

// Extrair lead de resultado orgânico
function extractLeadFromResult(result, searchTerm, type = 'organic') {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
  
  const fullText = `${result.title || ''} ${result.snippet || ''} ${result.rich_snippet?.top?.detected_extensions?.phone || ''}`;
  
  const emails = fullText.match(emailRegex) || [];
  const phones = fullText.match(phoneRegex) || [];
  
  // Extrair nome da empresa
  let company = result.title || '';
  company = company.split(' - ')[0].split(' | ')[0].split(' — ')[0].trim();
  
  return {
    id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company,
    website: result.link || null,
    phone: phones[0] ? phones[0].replace(/\D/g, '') : null,
    whatsapp: phones[0] ? phones[0].replace(/\D/g, '') : null,
    email: emails[0] || null,
    whatsappValid: null,
    source: 'Google',
    searchTerm,
    createdAt: new Date().toISOString(),
    // Dados extras da SERP
    serpData: {
      type,
      position: result.position,
      snippet: result.snippet || null,
      displayedLink: result.displayed_link || null,
      favicon: result.favicon || null,
      thumbnail: result.thumbnail || null,
      sitelinks: result.sitelinks || null,
      richSnippet: result.rich_snippet || null,
      aboutThisResult: result.about_this_result || null,
      cachedPageLink: result.cached_page_link || null,
      relatedPagesLink: result.related_pages_link || null
    }
  };
}

// Extrair lead de resultado local (Google Maps)
function extractLeadFromLocalResult(result, searchTerm) {
  return {
    id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company: result.title || 'Sem nome',
    website: result.website || result.link || null,
    phone: result.phone ? result.phone.replace(/\D/g, '') : null,
    whatsapp: result.phone ? result.phone.replace(/\D/g, '') : null,
    email: null,
    whatsappValid: null,
    source: 'Google Maps',
    searchTerm,
    createdAt: new Date().toISOString(),
    // Dados extras do Google Maps
    serpData: {
      type: 'local',
      position: result.position,
      placeId: result.place_id || null,
      dataId: result.data_id || null,
      dataCid: result.data_cid || null,
      address: result.address || null,
      rating: result.rating || null,
      reviews: result.reviews || null,
      reviewsOriginal: result.reviews_original || null,
      priceLevel: result.price || null,
      type: result.type || null,
      types: result.types || null,
      thumbnail: result.thumbnail || null,
      serviceOptions: result.service_options || null,
      hours: result.hours || null,
      operatingHours: result.operating_hours || null,
      gpsCoordinates: result.gps_coordinates || null,
      description: result.description || null
    }
  };
}

module.exports = router;
