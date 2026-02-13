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
        'Content-Type': 'application/json'
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

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao consultar CNPJ:', error);
    res.status(500).json({ message: 'Erro ao consultar CNPJ' });
  }
});

// Pesquisa avançada de empresas
router.post('/search', authenticate, async (req, res) => {
  try {
    const { 
      razao_social, cnae, municipio, uf, situacao,
      data_abertura_gte, data_abertura_lte,
      limit = 20, page = 1 
    } = req.body;

    const apiToken = await getCnpjApiToken();
    if (!apiToken) {
      return res.status(400).json({ message: 'Token da API CNPJ não configurado. Solicite ao administrador.' });
    }

    const params = new URLSearchParams();
    if (razao_social) params.append('razao_social', razao_social);
    if (cnae) params.append('cnae', cnae);
    if (municipio) params.append('municipio', municipio);
    if (uf) params.append('uf', uf);
    if (situacao) params.append('situacao', situacao);
    if (data_abertura_gte) params.append('data_abertura_gte', data_abertura_gte);
    if (data_abertura_lte) params.append('data_abertura_lte', data_abertura_lte);
    params.append('limit', Math.min(limit, 100).toString());
    params.append('page', page.toString());

    const response = await fetch(`https://cnpj.gleego.com.br/api/v1/search?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro API CNPJ Search:', response.status, errorText);
      return res.status(response.status).json({ 
        message: 'Erro na pesquisa de CNPJ',
        details: errorText
      });
    }

    const data = await response.json();
    res.json(data);
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
