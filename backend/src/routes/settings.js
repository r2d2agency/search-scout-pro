const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Obter configurações (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM settings');
    
    const settings = {};
    result.rows.forEach(row => {
      // Converter snake_case para camelCase
      const key = row.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      settings[key] = row.value || '';
    });

    res.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ message: 'Erro ao buscar configurações' });
  }
});

// Salvar configurações (admin only)
router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { serpApiKey, evolutionApiUrl, evolutionApiKey, evolutionInstance } = req.body;

    const updates = [
      ['serp_api_key', serpApiKey],
      ['evolution_api_url', evolutionApiUrl],
      ['evolution_api_key', evolutionApiKey],
      ['evolution_instance', evolutionInstance]
    ];

    for (const [key, value] of updates) {
      await db.query(
        `INSERT INTO settings (key, value, updated_at) 
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value || '']
      );
    }

    res.json({ message: 'Configurações salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    res.status(500).json({ message: 'Erro ao salvar configurações' });
  }
});

// Obter brand settings
router.get('/brand', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT key, value FROM settings WHERE key IN ('brand_app_name', 'brand_app_subtitle', 'brand_logo_url')`
    );
    
    const brand = {
      appName: 'Lead Extractor',
      appSubtitle: 'Extração inteligente de leads',
      logoUrl: ''
    };

    result.rows.forEach(row => {
      if (row.key === 'brand_app_name') brand.appName = row.value || brand.appName;
      if (row.key === 'brand_app_subtitle') brand.appSubtitle = row.value || brand.appSubtitle;
      if (row.key === 'brand_logo_url') brand.logoUrl = row.value || '';
    });

    res.json(brand);
  } catch (error) {
    console.error('Erro ao buscar brand:', error);
    res.status(500).json({ message: 'Erro ao buscar configurações de marca' });
  }
});

// Salvar brand settings (admin only)
router.put('/brand', authenticate, requireAdmin, async (req, res) => {
  try {
    const { appName, appSubtitle, logoUrl } = req.body;

    const updates = [
      ['brand_app_name', appName],
      ['brand_app_subtitle', appSubtitle],
      ['brand_logo_url', logoUrl]
    ];

    for (const [key, value] of updates) {
      await db.query(
        `INSERT INTO settings (key, value, updated_at) 
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value || '']
      );
    }

    res.json({ message: 'Marca atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar brand:', error);
    res.status(500).json({ message: 'Erro ao salvar configurações de marca' });
  }
});

module.exports = router;
