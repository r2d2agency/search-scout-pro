const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const serpKeysRouter = require('./serp-keys');
const getNextAvailableKey = serpKeysRouter.getNextAvailableKey;

const router = express.Router();

// Helper: obter config da Evolution API
async function getEvolutionConfig() {
  const result = await db.query(
    "SELECT key, value FROM settings WHERE key IN ('evolution_api_url', 'evolution_api_key', 'evolution_instance')"
  );
  const config = {};
  result.rows.forEach(row => { config[row.key] = row.value; });
  return {
    url: config.evolution_api_url || null,
    apiKey: config.evolution_api_key || null,
    instance: config.evolution_instance || null,
  };
}

// Verificar WhatsApp via Evolution API
async function checkWhatsApp(phone, evolutionConfig) {
  if (!evolutionConfig.url || !evolutionConfig.apiKey || !evolutionConfig.instance) {
    return null; // não configurado
  }

  try {
    // Formatar número para formato internacional brasileiro
    let number = phone.replace(/\D/g, '');
    if (number.length === 10 || number.length === 11) {
      number = '55' + number;
    }
    if (!number.startsWith('55')) {
      number = '55' + number;
    }

    const url = `${evolutionConfig.url}/chat/whatsappNumbers/${evolutionConfig.instance}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.apiKey,
      },
      body: JSON.stringify({ numbers: [number] }),
    });

    if (!response.ok) {
      console.error('Evolution API error:', response.status);
      return null;
    }

    const data = await response.json();
    // A resposta geralmente é um array com { exists, jid, number }
    if (Array.isArray(data) && data.length > 0) {
      return data[0].exists === true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao verificar WhatsApp:', error.message);
    return null;
  }
}

// Buscar empresa por nome fantasia + endereço no Google Places (Serper.dev)
async function searchByAddress(lead, apiKey) {
  // Verificar se tem nome fantasia - se não tiver, pular
  const nomeFantasia = (lead.nome_fantasia || '').trim();
  if (!nomeFantasia) {
    return { found: false, reason: 'Sem nome fantasia', skipped: true };
  }

  // Montar query: nome fantasia + endereço
  const addressParts = [];
  if (lead.tipo_logradouro) addressParts.push(lead.tipo_logradouro);
  if (lead.logradouro) addressParts.push(lead.logradouro);
  if (lead.numero && lead.numero !== '0' && lead.numero.toUpperCase() !== 'SN') addressParts.push(lead.numero);
  if (lead.bairro) addressParts.push(lead.bairro);
  if (lead.municipio_nome || lead.municipio) addressParts.push(lead.municipio_nome || lead.municipio);
  if (lead.uf) addressParts.push(lead.uf);

  const addressStr = addressParts.join(', ');
  if (!addressStr || addressParts.length < 2) {
    return { found: false, reason: 'Endereço insuficiente' };
  }

  // Combinar nome fantasia + endereço para busca mais precisa
  const searchQuery = `${nomeFantasia} ${addressStr}`;

  try {
    const response = await fetch('https://google.serper.dev/places', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchQuery,
        gl: 'br',
        hl: 'pt-br',
        num: 5,
      }),
    });

    if (!response.ok) {
      console.error('Serper error:', response.status);
      return { found: false, reason: 'Erro na busca' };
    }

    const data = await response.json();
    const places = data.places || [];

    if (places.length === 0) {
      return { found: false, reason: 'Nenhum resultado' };
    }

    // Verificar match por endereço - pegar o primeiro resultado que tenha telefone
    // O Google Places retorna resultados próximos ao endereço buscado
    const bestMatch = places.find(p => p.phone || p.phoneNumber) || places[0];

    const rawPhone = bestMatch.phone || bestMatch.phoneNumber || null;
    const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : null;

    return {
      found: true,
      googleName: bestMatch.title || bestMatch.name || null,
      phone: cleanPhone,
      phoneFormatted: rawPhone,
      address: bestMatch.address || null,
      website: bestMatch.website || null,
      rating: bestMatch.rating || null,
      ratingCount: bestMatch.ratingCount || bestMatch.reviewCount || null,
      category: bestMatch.category || bestMatch.type || null,
      googleMapsUrl: bestMatch.googleMapsUrl || bestMatch.link || null,
      placeId: bestMatch.placeId || bestMatch.place_id || null,
    };
  } catch (error) {
    console.error('Erro na busca por endereço:', error.message);
    return { found: false, reason: error.message };
  }
}

// POST /enrich - Enriquecer leads com dados do Google + WhatsApp
router.post('/', authenticate, async (req, res) => {
  try {
    const { leads, checkWhatsapp = true } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: 'Lista de leads é obrigatória' });
    }

    if (leads.length > 50) {
      return res.status(400).json({ message: 'Máximo de 50 leads por requisição' });
    }

    // Obter chave SERP
    const apiKey = await getNextAvailableKey();
    if (!apiKey) {
      return res.status(503).json({ message: 'Nenhuma chave SERP disponível' });
    }

    // Obter config da Evolution API (se check WhatsApp habilitado)
    let evolutionConfig = { url: null, apiKey: null, instance: null };
    if (checkWhatsapp) {
      evolutionConfig = await getEvolutionConfig();
    }

    const results = [];

    for (const lead of leads) {
      // Buscar no Google por endereço
      const searchResult = await searchByAddress(lead, apiKey);

      let whatsappValid = null;
      const phone = searchResult.found ? searchResult.phone : null;

      // Se encontrou telefone e checkWhatsapp está habilitado, verificar
      if (phone && checkWhatsapp && evolutionConfig.url) {
        whatsappValid = await checkWhatsApp(phone, evolutionConfig);
        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      results.push({
        cnpj: `${lead.cnpj_basico || ''}${lead.cnpj_ordem || ''}${lead.cnpj_dv || ''}`,
        nomeFantasia: (lead.nome_fantasia || '').trim() || null,
        enriched: searchResult.found,
        skipped: searchResult.skipped || false,
        googleName: searchResult.googleName || null,
        phone: phone,
        phoneFormatted: searchResult.phoneFormatted || null,
        whatsappValid: whatsappValid,
        website: searchResult.website || null,
        googleAddress: searchResult.address || null,
        rating: searchResult.rating || null,
        ratingCount: searchResult.ratingCount || null,
        category: searchResult.category || null,
        googleMapsUrl: searchResult.googleMapsUrl || null,
        reason: searchResult.reason || null,
      });

      // Delay entre buscas para respeitar rate limit da Serper (só se não foi skipped)
      if (!searchResult.skipped) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const enrichedCount = results.filter(r => r.enriched).length;
    const withPhone = results.filter(r => r.phone).length;
    const withWhatsapp = results.filter(r => r.whatsappValid === true).length;

    res.json({
      results,
      summary: {
        total: leads.length,
        enriched: enrichedCount,
        withPhone,
        withWhatsapp,
      },
    });
  } catch (error) {
    console.error('Erro ao enriquecer leads:', error);
    res.status(500).json({ message: 'Erro ao enriquecer leads' });
  }
});

module.exports = router;
