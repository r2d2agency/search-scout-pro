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

// Helper: fazer a chamada de search na Gleego
async function doGleegoSearch(apiToken, params) {
  const url = `https://cnpj.gleego.com.br/api/v1/search?${params.toString()}`;
  console.log('Gleego search URL:', url);
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json; charset=utf-8'
    }
  });
  return response;
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

function buildSearchParams({ razao_social, cnae, municipio, uf, situacao, data_abertura_gte, data_abertura_lte, limit, page }) {
  const params = new URLSearchParams();
  if (razao_social) params.append('razao_social', razao_social);
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
      razao_social, cnae, municipio, uf, situacao,
      data_abertura_gte, data_abertura_lte,
      limit = 20, page = 1 
    } = req.body;

    // Validação obrigatória: UF + (CNAE ou Razão Social). Município obrigatório apenas para CNAE.
    if (!uf) {
      return res.status(400).json({ message: 'UF é obrigatório' });
    }
    if (cnae && !municipio) {
      return res.status(400).json({ message: 'Município é obrigatório para pesquisa por CNAE' });
    }
    if (!cnae && !razao_social) {
      return res.status(400).json({ message: 'Informe pelo menos CNAE ou Razão Social' });
    }

    const apiToken = await getCnpjApiToken();
    if (!apiToken) {
      return res.status(400).json({ message: 'Token da API CNPJ não configurado. Solicite ao administrador.' });
    }

    // Normalizar filtros para melhorar compatibilidade com a API
    const cleanCnae = cnae ? cnae.replace(/\D/g, '') : null;
    const cleanMunicipio = municipio ? municipio.toUpperCase().trim() : null;
    const normalizedMunicipio = cleanMunicipio ? normalizeForSearch(cleanMunicipio) : null;
    const cleanRazao = razao_social ? razao_social.trim() : null;

    const cnaeVariants = cleanCnae ? [...new Set(formatCnaeVariants(cleanCnae))] : [null];
    const municipioVariants = cleanMunicipio
      ? [...new Set([cleanMunicipio, normalizedMunicipio].filter(Boolean))]
      : [null];
    const razaoVariants = cleanRazao
      ? [...new Set([cleanRazao, cleanRazao.toUpperCase(), normalizeForSearch(cleanRazao)].filter(Boolean))]
      : [null];

    let bestData = null;
    let bestCount = 0;
    const tried = new Set();

    for (const razaoVar of razaoVariants) {
      for (const cnaeVar of cnaeVariants) {
        for (const municipioVar of municipioVariants) {
          const params = buildSearchParams({
            razao_social: razaoVar,
            cnae: cnaeVar,
            municipio: municipioVar,
            uf,
            situacao,
            data_abertura_gte,
            data_abertura_lte,
            limit,
            page,
          });

          const key = params.toString();
          if (tried.has(key)) continue;
          tried.add(key);

          console.log('CNPJ Search params:', key);

          const response = await doGleegoSearch(apiToken, params);
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro API CNPJ Search (tentativa):', response.status, errorText);
            continue;
          }

          const data = await parseGleegoResponse(response);
          const count = getResultCount(data);

          if (count > bestCount) {
            bestData = data;
            bestCount = count;
          }

          if (count > 0) {
            console.log('CNPJ Search fallback encontrou resultados com params:', key);
            break;
          }
        }
        if (bestCount > 0) break;
      }
      if (bestCount > 0) break;
    }

    if (!bestData) {
      return res.status(502).json({ message: 'Erro na pesquisa de CNPJ' });
    }

    console.log('CNPJ Search final result - type:', typeof bestData, 'count:', getResultCount(bestData));

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
