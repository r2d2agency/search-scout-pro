const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const serpKeysRouter = require('./serp-keys');

const router = express.Router();

// Helper para verificar limite (reutilizado lógica, idealmente estaria em um serviço compartilhado)
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

// Buscar perfis do LinkedIn via Serper (Google)
router.post('/search', authenticate, async (req, res) => {
  try {
    const { query, limit = 10, page = 1 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Termo de pesquisa é obrigatório' });
    }

    // Verificar limite do usuário
    const canSearch = await checkLimit(req.user.id, 'search', 1);
    if (!canSearch) {
      return res.status(403).json({ message: 'Limite de pesquisas atingido para este mês' });
    }

    // Obter chave SERP
    const serpKey = await serpKeysRouter.getNextAvailableKey();
    
    if (!serpKey) {
      return res.status(503).json({ 
        message: 'Nenhuma chave Serper disponível. Configure uma chave no painel de administração.' 
      });
    }

    const keySource = 'Serper (Google)';
    console.log(`[LinkedInSearch] Usando chave Serper para busca`);

    const cleanQuery = query.trim();
    console.log('[LinkedInSearch] Iniciando busca LinkedIn:', { query: cleanQuery, limit, page });

    // ESTRATÉGIA: Buscar perfis do LinkedIn via Google (Serper)
    // Queries variadas para tentar encontrar resultados
    const searchQueries = [
      `site:linkedin.com/in/ "${cleanQuery}"`,
      `site:linkedin.com/in/ ${cleanQuery} whatsapp`, // Tenta encontrar menções a whatsapp
      `site:linkedin.com/in/ ${cleanQuery} contact`,
    ];

    // Usar apenas a primeira query por padrão, ou iterar se não encontrar nada (simplificado para primeira)
    // Se o usuário pediu "whatsapp" explicitamente na query, já ajuda.
    // Vamos usar a query direta combinada com site:linkedin.com/in/
    const searchQuery = `site:linkedin.com/in/ ${cleanQuery}`;

    let allResults = [];
    const start = (page - 1) * limit;

    try {
        console.log(`[LinkedInSearch] Tentando query: ${searchQuery} (Start ${start})`);
        
        const searchResponse = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serpKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: searchQuery,
            gl: 'br',
            hl: 'pt-br',
            num: limit, // Serper permite até 100, mas vamos respeitar o limit do request
            start: start
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const organicResults = searchData.organic || [];
          console.log(`[LinkedInSearch] Resultados para "${searchQuery}":`, organicResults.length);
          
          if (organicResults.length > 0) {
            const mappedResults = organicResults.map(item => ({
              title: item.title,
              description: item.snippet,
              url: item.link
            }));
            allResults = [...allResults, ...mappedResults];
          }
        } else {
          const errorText = await searchResponse.text();
          console.error(`[LinkedInSearch] Erro na busca Serper:`, searchResponse.status, errorText);
        }
    } catch (err) {
        console.error(`[LinkedInSearch] Erro na query "${searchQuery}":`, err.message);
    }

    console.log(`[LinkedInSearch] Total de resultados brutos: ${allResults.length}`);

    // Processar resultados
    const leads = [];
    const processedUrls = new Set();

    for (const result of allResults) {
      // Extrair identificador do LinkedIn
      const linkedinId = extractLinkedInIdFromUrl(result.url);
      
      if (linkedinId && !processedUrls.has(linkedinId)) {
        processedUrls.add(linkedinId);
        
        const lead = createLeadFromSearchResult(result, linkedinId, cleanQuery, leads.length);
        leads.push(lead);
      }

      if (leads.length >= limit) break;
    }

    // Incrementar uso
    await incrementUsage(req.user.id, 'search', 1);

    console.log(`[LinkedInSearch] Leads finais: ${leads.length}`);

    res.json({
      leads,
      pagination: {
        currentPage: page,
        totalResults: leads.length, // Aproximado
        hasMore: leads.length >= limit, // Se retornou o limite, provavelmente tem mais
      },
      searchMetadata: {
        source: 'LinkedIn via Serper (Google)',
        query,
        totalResults: leads.length,
        keySource,
      }
    });

  } catch (error) {
    console.error('[LinkedInSearch] Erro na pesquisa:', error);
    res.status(500).json({ message: 'Erro ao realizar pesquisa no LinkedIn', details: error.message });
  }
});

// Helpers

function extractLinkedInIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9%-]+)/);
  return match ? match[1] : null;
}

function createLeadFromSearchResult(result, linkedinId, searchTerm, position) {
  const title = result.title || '';
  const description = result.description || '';
  const url = result.url || '';

  // Tentar extrair nome e cargo do título
  // Formato comum: "Nome Sobrenome - Cargo - Empresa | LinkedIn"
  let fullName = linkedinId;
  let jobTitle = null;
  
  const parts = title.split(' - ');
  if (parts.length > 0) {
    fullName = parts[0].replace(' | LinkedIn', '').trim();
    if (parts.length > 1) {
        jobTitle = parts[1].trim();
    }
  }

  // Extrair dados de contato do description
  const contactData = extractAllFromText(`${title} ${description}`);

  return {
    id: `li-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company: fullName, // No contexto de pessoa, company é o nome
    jobTitle: jobTitle,
    website: contactData.website || url,
    phone: contactData.phone,
    whatsapp: contactData.whatsapp,
    email: contactData.email,
    whatsappValid: contactData.whatsappFromLink ? true : null,
    source: 'LinkedIn',
    searchTerm,
    createdAt: new Date().toISOString(),
    address: null,
    rating: null,
    ratingCount: null,
    category: 'LinkedIn Profile',
    serpData: {
      type: 'linkedin',
      position,
      username: linkedinId,
      fullName: fullName,
      biography: description,
      profileUrl: url,
      whatsappFromLink: contactData.whatsappFromLink,
      sourceUrl: url,
    }
  };
}

function extractAllFromText(text) {
  const result = {
    phone: null,
    whatsapp: null,
    whatsappFromLink: false,
    email: null,
    website: null,
  };

  if (!text) return result;

  // Extrair WhatsApp de links (menos comum no snippet do LinkedIn, mas possível)
  const whatsappPatterns = [
    /wa\.me\/(\d{10,15})/gi,
    /api\.whatsapp\.com\/send\?phone=(\d{10,15})/gi,
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
    if (!result.whatsapp) {
      result.whatsapp = result.phone; // Assume como whats se encontrar telefone
    }
  }

  return result;
}

module.exports = router;
