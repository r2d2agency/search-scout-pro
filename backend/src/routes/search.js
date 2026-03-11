const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const serpKeysRouter = require('./serp-keys');
const getNextAvailableKey = serpKeysRouter.getNextAvailableKey;

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

    // Fazer requisição ao endpoint Places da Serper.dev (Google Meu Negócio)
    const serpBody = {
      q: query,
      gl: 'br',
      hl: 'pt-br',
    };

    // Só adiciona paginação se não for a primeira página
    if (page > 1) {
      serpBody.page = page;
    }

    console.log('Serper Places Request:', serpBody);

    const serpResponse = await fetch('https://google.serper.dev/places', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serpBody)
    });

    // Tratar resposta
    const raw = await serpResponse.text();
    let serpData;
    try {
      serpData = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Serper API retornou resposta não-JSON', {
        status: serpResponse.status,
        raw: raw?.slice?.(0, 1000) || raw,
      });
      return res.status(502).json({
        message: 'Erro ao consultar Serper API',
        details: 'Resposta inválida da Serper API (não-JSON)',
        status: serpResponse.status,
      });
    }

    if (!serpResponse.ok) {
      const details = serpData?.message || serpData?.error || null;
      console.error('Erro Serper API:', {
        status: serpResponse.status,
        details,
        serpData,
      });
      return res.status(502).json({
        message: 'Erro ao consultar Serper API',
        details,
        status: serpResponse.status,
      });
    }

    // Incrementar uso do usuário
    await incrementUsage(req.user.id, 'search', 1);

    // Log detalhado da resposta
    console.log('Serper Places Response:', {
      totalPlaces: serpData.places?.length || 0,
      searchParameters: serpData.searchParameters,
      credits: serpData.credits,
    });

    let placesResults = serpData.places || [];

    // FALLBACK: Se Places não retornou nada, tenta busca orgânica
    if (placesResults.length === 0) {
      console.log('Places sem resultados, tentando busca orgânica...');
      
      const organicResponse = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          gl: 'br',
          hl: 'pt-br',
          num: 20,
          page: page,
        })
      });

      const organicRaw = await organicResponse.text();
      let organicData;
      try {
        organicData = organicRaw ? JSON.parse(organicRaw) : {};
      } catch (e) {
        organicData = {};
      }

      if (organicResponse.ok) {
        console.log('Serper Organic Response:', {
          organic: organicData.organic?.length || 0,
          places: organicData.places?.length || 0,
        });

        // A busca orgânica pode trazer places embutidos + resultados orgânicos
        placesResults = organicData.places || [];
        
        const organicResults = organicData.organic || [];
        const leads = [];

        // Primeiro adiciona places se houver
        for (const result of placesResults) {
          const lead = extractLeadFromPlaces(result, query);
          if (lead) leads.push(lead);
        }

        // Depois adiciona orgânicos
        for (const result of organicResults) {
          const lead = extractLeadFromResult(result, query, 'organic');
          if (lead) leads.push(lead);
        }

        const hasMore = organicResults.length >= 10 || placesResults.length >= 5;

        return res.json({
          leads,
          pagination: {
            currentPage: page,
            totalResults: leads.length,
            hasMore,
            nextPageToken: null
          },
          searchMetadata: {
            searchId: null,
            totalResults: leads.length,
            timeTaken: organicData.searchParameters?.timeTaken || null,
            source: 'google_organic_fallback'
          }
        });
      }
    }
    
    // Processar resultados Places normalmente
    const leads = [];
    for (const result of placesResults) {
      const lead = extractLeadFromPlaces(result, query);
      if (lead) leads.push(lead);
    }

    const hasMoreResults = placesResults.length >= 10;
    
    res.json({
      leads,
      pagination: {
        currentPage: page,
        totalResults: leads.length,
        hasMore: hasMoreResults,
        nextPageToken: null
      },
      searchMetadata: {
        searchId: null,
        totalResults: leads.length,
        timeTaken: serpData.searchParameters?.timeTaken || null,
        source: 'google_places'
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

// Extrair lead de resultado do Google Meu Negócio (Places)
function extractLeadFromPlaces(result, searchTerm) {
  // Limpar telefone para formato numérico
  const rawPhone = result.phone || result.phoneNumber || null;
  const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : null;
  
  // Tentar extrair email do snippet/descrição (Google não fornece direto)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const description = result.description || result.snippet || '';
  const emailMatch = description.match(emailRegex);
  
  return {
    id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company: result.title || result.name || 'Sem nome',
    website: result.website || result.link || null,
    phone: cleanPhone,
    whatsapp: cleanPhone,
    email: emailMatch ? emailMatch[0] : null,
    whatsappValid: null,
    source: 'Google Meu Negócio',
    searchTerm,
    createdAt: new Date().toISOString(),
    // Dados completos da ficha do Google Meu Negócio
    address: result.address || null,
    rating: result.rating || null,
    ratingCount: result.ratingCount || result.reviewCount || null,
    category: result.category || result.type || null,
    serpData: {
      type: 'places',
      position: result.position || null,
      // Dados de contato
      phoneFormatted: rawPhone,
      address: result.address || null,
      // Avaliações
      rating: result.rating || null,
      ratingCount: result.ratingCount || result.reviewCount || null,
      reviews: result.reviews || null,
      // Categoria e tipo
      category: result.category || null,
      type: result.type || null,
      types: result.types || null,
      // Identificadores Google
      cid: result.cid || null,
      placeId: result.placeId || result.place_id || null,
      fid: result.fid || null,
      // Localização
      latitude: result.latitude || result.gps_coordinates?.latitude || null,
      longitude: result.longitude || result.gps_coordinates?.longitude || null,
      // Horários
      openingHours: result.openingHours || result.hours || null,
      // Imagens
      thumbnailUrl: result.thumbnailUrl || result.thumbnail || null,
      imageUrl: result.imageUrl || null,
      // Serviços
      serviceOptions: result.serviceOptions || result.service_options || null,
      // Preço
      priceLevel: result.priceLevel || result.price || null,
      // Descrição
      description: result.description || result.snippet || null,
      // Link direto do Google Maps
      googleMapsUrl: result.googleMapsUrl || result.link || null
    }
  };
}

module.exports = router;
