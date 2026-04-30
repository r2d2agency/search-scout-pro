const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper para obter o token CNPJ do settings
async function getCnpjApiToken() {
  const result = await db.query(
    "SELECT value FROM settings WHERE key = 'cnpj_api_token'"
  );
  return result.rows.length > 0 ? result.rows[0].value : null;
}

// Consultar CNPJ específico
router.post('/lookup', authenticate, async (req, res) => {
  try {
    const { cnpj } = req.body;

    if (!cnpj) {
      return res.status(400).json({ message: 'CNPJ é obrigatório' });
    }

    // Limpar CNPJ (só números)
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      return res.status(400).json({ message: 'CNPJ deve ter 14 dígitos' });
    }

    const apiToken = await getCnpjApiToken();
    if (!apiToken) {
      return res.status(400).json({ message: 'Token da API CNPJ não configurado. Solicite ao administrador.' });
    }

    const response = await fetch(`https://cnpj.gleego.com.br/api/v1/cnpj/${cleanCnpj}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json; charset=utf-8'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro API CNPJ:', response.status, errorText);
      return res.status(response.status).json({ 
        message: response.status === 404 ? 'CNPJ não encontrado' : 'Erro ao consultar CNPJ',
        details: errorText
      });
    }

    // Handle potential encoding issues (Latin-1 -> UTF-8)
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('charset=iso-8859-1') || contentType.includes('charset=latin1')) {
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder('iso-8859-1').decode(buffer);
      data = JSON.parse(text);
    } else {
      // Try UTF-8 first, if we detect encoding issues, retry with Latin-1
      const buffer = await response.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buffer);
      // Check for common encoding artifacts (replacement character)
      if (text.includes('\ufffd') || text.includes('�')) {
        text = new TextDecoder('iso-8859-1').decode(buffer);
      }
      data = JSON.parse(text);
    }
    
    // Log structure for debugging
    console.log('CNPJ Lookup response keys:', Object.keys(data));
    if (data.estabelecimento) console.log('estabelecimento keys:', Object.keys(data.estabelecimento));
    if (data.empresa) console.log('empresa keys:', Object.keys(data.empresa));
    
    res.json(data);
  } catch (error) {
    console.error('Erro ao consultar CNPJ:', error);
    res.status(500).json({ message: 'Erro ao consultar CNPJ' });
  }
});

// Helper: formatar CNAE em diferentes formatos para tentar na API
function formatCnaeVariants(cnae) {
  if (!cnae) return [];
  const digits = cnae.replace(/\D/g, '');
  const variants = new Set();
  // Original como recebido
  variants.add(cnae);
  // Somente dígitos
  variants.add(digits);
  // Formato XX.XX-X-XX (7 dígitos -> 62.09-1-00)
  if (digits.length === 7) {
    variants.add(`${digits.slice(0,2)}.${digits.slice(2,4)}-${digits.slice(4,5)}-${digits.slice(5,7)}`);
    // Também sem o sufixo de 2 dígitos: XX.XX-X
    variants.add(`${digits.slice(0,2)}.${digits.slice(2,4)}-${digits.slice(4,5)}`);
    // Só a classe: XXXX (4 primeiros dígitos)
    variants.add(digits.slice(0, 4));
    // Classe + grupo: XXXXX (5 dígitos)
    variants.add(digits.slice(0, 5));
  }
  if (digits.length === 5) {
    variants.add(`${digits.slice(0,2)}.${digits.slice(2,4)}-${digits.slice(4,5)}`);
    variants.add(digits.slice(0, 4));
  }
  if (digits.length === 4) {
    variants.add(`${digits.slice(0,2)}.${digits.slice(2,4)}`);
  }
  return [...variants];
}

// Helper: fazer a chamada de search na Gleego com timeout
async function doGleegoSearch(apiToken, params) {
  const url = `https://cnpj.gleego.com.br/api/v1/search?${params.toString()}`;
  console.log('--- GLEECO SEARCH START ---');
  console.log('Target URL:', url);
  console.log('Query Params:', Object.fromEntries(params.entries()));
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json; charset=utf-8'
      },
      signal: controller.signal
    });
    
    const duration = Date.now() - startTime;
    console.log(`Gleego search completed in ${duration}ms | Status: ${response.status} ${response.statusText}`);
    
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('GLEECO SEARCH TIMEOUT (90s) - URL:', url);
    } else {
      console.error('GLEECO SEARCH FETCH ERROR:', err.message, '| URL:', url);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    console.log('--- GLEECO SEARCH END ---');
  }
}

// Helper: parse response with encoding handling
async function parseGleegoResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const buffer = await response.arrayBuffer();
  let text;
  if (contentType.includes('charset=iso-8859-1') || contentType.includes('charset=latin1')) {
    text = new TextDecoder('iso-8859-1').decode(buffer);
  } else {
    text = new TextDecoder('utf-8').decode(buffer);
    if (text.includes('\ufffd') || text.includes('�')) {
      text = new TextDecoder('iso-8859-1').decode(buffer);
    }
  }
  return JSON.parse(text);
}

// Helper: extrair total de resultados da resposta
function getResultCount(data) {
  if (Array.isArray(data)) return data.length;
  return data?.total || data?.count || (data?.data?.length) || (data?.results?.length) || 0;
}

function normalizeForSearch(value) {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildSearchParams({ razao_social, nome_fantasia, cnae, municipio, uf, situacao, data_abertura_gte, data_abertura_lte, limit, page }) {
  const params = new URLSearchParams();
  if (razao_social) params.append('razao_social', razao_social);
  if (nome_fantasia) params.append('nome_fantasia', nome_fantasia);
  if (cnae) params.append('cnae', cnae);
  if (municipio) params.append('municipio', municipio);
  params.append('uf', uf.toUpperCase());
  if (situacao) params.append('situacao', situacao);
  if (data_abertura_gte) params.append('data_abertura_gte', data_abertura_gte);
  if (data_abertura_lte) params.append('data_abertura_lte', data_abertura_lte);
  params.append('limit', Math.min(limit, 100).toString());
  params.append('page', page.toString());
  return params;
}

// Pesquisa avançada de empresas
router.post('/search', authenticate, async (req, res) => {
  try {
    const { 
      razao_social, nome_fantasia, cnae, municipio, uf, situacao,
      data_abertura_gte, data_abertura_lte,
      limit = 20, page = 1 
    } = req.body;

    const razaoSocialTerm = razao_social ? normalizeForSearch(razao_social) : null;
    const nomeFantasiaTerm = nome_fantasia ? normalizeForSearch(nome_fantasia) : null;

    // Validação obrigatória: UF + (CNAE ou Razão Social ou Nome Fantasia). Município obrigatório apenas para CNAE.
    if (!uf) {
      return res.status(400).json({ message: 'UF é obrigatório' });
    }
    if (!cnae && !razaoSocialTerm && !nomeFantasiaTerm) {
      return res.status(400).json({ message: 'Informe pelo menos CNAE, Razão Social ou Nome Fantasia' });
    }

    const apiToken = await getCnpjApiToken();
    if (!apiToken) {
      return res.status(400).json({ message: 'Token da API CNPJ não configurado. Solicite ao administrador.' });
    }

    const baseParamsInput = {
      razao_social: razaoSocialTerm,
      nome_fantasia: nomeFantasiaTerm,
      cnae: cnae ? cnae.replace(/\D/g, '') : null,
      municipio: municipio ? normalizeForSearch(municipio) : null,
      uf, situacao, data_abertura_gte, data_abertura_lte, limit, page,
    };

    // Se ambos razao_social e nome_fantasia foram enviados com o mesmo valor, buscar em paralelo
    const nameTerm = razaoSocialTerm || nomeFantasiaTerm;
    const isBothNameSearch = !cnae && razaoSocialTerm && nomeFantasiaTerm && razaoSocialTerm === nomeFantasiaTerm;

    let bestData;
    let bestCount = 0;

    if (isBothNameSearch) {
      // Buscar por razao_social E nome_fantasia em paralelo, retornar o com mais resultados
      const razaoParams = buildSearchParams({ ...baseParamsInput, razao_social: nameTerm, nome_fantasia: null });
      const fantasiaParams = buildSearchParams({ ...baseParamsInput, razao_social: null, nome_fantasia: nameTerm });

      console.log('CNPJ Search parallel - razao_social:', razaoParams.toString());
      console.log('CNPJ Search parallel - nome_fantasia:', fantasiaParams.toString());

      let razaoData = null, fantasiaData = null;
      let razaoCount = 0, fantasiaCount = 0;

      try {
        const [razaoRes, fantasiaRes] = await Promise.allSettled([
          doGleegoSearch(apiToken, razaoParams),
          doGleegoSearch(apiToken, fantasiaParams),
        ]);

        if (razaoRes.status === 'fulfilled' && razaoRes.value.ok) {
          try { razaoData = await parseGleegoResponse(razaoRes.value); razaoCount = getResultCount(razaoData); } catch (e) {}
        }
        if (fantasiaRes.status === 'fulfilled' && fantasiaRes.value.ok) {
          try { fantasiaData = await parseGleegoResponse(fantasiaRes.value); fantasiaCount = getResultCount(fantasiaData); } catch (e) {}
        }
      } catch (err) {
        console.error('Gleego parallel search error:', err.message);
        return res.status(504).json({ message: 'Timeout na consulta. Tente com filtros mais específicos.' });
      }

      console.log('CNPJ Search parallel results - razao:', razaoCount, 'fantasia:', fantasiaCount);
      if (razaoRes.status === 'rejected') console.error('Razao search rejected:', razaoRes.reason);
      if (fantasiaRes.status === 'rejected') console.error('Fantasia search rejected:', fantasiaRes.reason);
      if (razaoRes.status === 'fulfilled' && !razaoRes.value.ok) console.error('Razao search HTTP error:', razaoRes.value.status);
      if (fantasiaRes.status === 'fulfilled' && !fantasiaRes.value.ok) console.error('Fantasia search HTTP error:', fantasiaRes.value.status);

      if (fantasiaCount > razaoCount) {
        bestData = fantasiaData;
        bestCount = fantasiaCount;
      } else if (razaoCount > 0) {
        bestData = razaoData;
        bestCount = razaoCount;
      } else {
        bestData = razaoData || fantasiaData || { results: [], total: 0 };
        bestCount = 0;
      }
    } else {
      // Busca direta (CNAE ou ambos os campos preenchidos)
      const params = buildSearchParams(baseParamsInput);
      console.log('CNPJ Search params:', params.toString());

      let response;
      try {
        response = await doGleegoSearch(apiToken, params);
      } catch (err) {
        console.error('Gleego search timeout/error:', err.message);
        return res.status(504).json({ message: 'Timeout na consulta. Tente com filtros mais específicos.' });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('--- GLEECO ERROR RESPONSE ---');
        console.error('Status:', response.status);
        console.error('Body:', errorText);
        console.error('--- END ERROR ---');
        return res.status(response.status).json({ 
          message: 'Erro na pesquisa de CNPJ via API Gleego', 
          details: errorText,
          status: response.status 
        });
      }

      try {
        bestData = await parseGleegoResponse(response);
      } catch (err) {
        console.error('Erro ao parsear resposta:', err);
        return res.status(502).json({ message: 'Resposta inválida da API' });
      }
      bestCount = getResultCount(bestData);
    }

    console.log('CNPJ Search final result - type:', typeof bestData, 'count:', bestCount);

    // Normalize: if the API returns a raw array, wrap it
    if (Array.isArray(bestData)) {
      res.json({ results: bestData, total: bestData.length });
    } else {
      res.json(bestData);
    }
  } catch (error) {
    console.error('Erro na pesquisa CNPJ:', error);
    res.status(500).json({ message: 'Erro na pesquisa de empresas' });
  }
});

// Consulta em lote
router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { cnpjs } = req.body;

    if (!cnpjs || !Array.isArray(cnpjs) || cnpjs.length === 0) {
      return res.status(400).json({ message: 'Lista de CNPJs é obrigatória' });
    }

    if (cnpjs.length > 100) {
      return res.status(400).json({ message: 'Máximo de 100 CNPJs por requisição' });
    }

    const apiToken = await getCnpjApiToken();
    if (!apiToken) {
      return res.status(400).json({ message: 'Token da API CNPJ não configurado' });
    }

    const response = await fetch('https://cnpj.gleego.com.br/api/v1/bulk-search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cnpjs: cnpjs.map(c => c.replace(/\D/g, '')) })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ message: 'Erro na consulta em lote', details: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro na consulta em lote:', error);
    res.status(500).json({ message: 'Erro na consulta em lote' });
  }
});

// Listar CNAEs disponíveis
router.get('/cnaes', authenticate, async (req, res) => {
  try {
    const apiToken = await getCnpjApiToken();
    if (!apiToken) {
      return res.status(400).json({ message: 'Token da API CNPJ não configurado' });
    }

    const response = await fetch('https://cnpj.gleego.com.br/api/v1/cnaes', {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ message: 'Erro ao listar CNAEs' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao listar CNAEs:', error);
    res.status(500).json({ message: 'Erro ao listar CNAEs' });
  }
});

module.exports = router;
