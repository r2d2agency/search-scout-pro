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
    const { serpApiKey, evolutionApiUrl, evolutionApiKey, evolutionInstance, cnpjApiToken } = req.body;

    const updates = [
      ['serp_api_key', serpApiKey],
      ['evolution_api_url', evolutionApiUrl],
      ['evolution_api_key', evolutionApiKey],
      ['evolution_instance', evolutionInstance],
      ['cnpj_api_token', cnpjApiToken]
    ];

    for (const [key, value] of updates) {
      if (value !== undefined) {
        await db.query(
          `INSERT INTO settings (key, value, updated_at) 
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, value || '']
        );
      }
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

// =====================================================
// Chaves de API do usuário
// =====================================================

// Obter chaves de API do usuário atual
router.get('/api-keys', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT key_type, 
              CASE WHEN api_key IS NOT NULL AND api_key != '' 
                   THEN CONCAT(LEFT(api_key, 8), '...', RIGHT(api_key, 4))
                   ELSE '' 
              END as api_key_masked,
              is_active,
              updated_at
       FROM user_api_keys 
       WHERE user_id = $1`,
      [req.user.id]
    );

    const keys = {};
    result.rows.forEach(row => {
      keys[row.key_type] = {
        hasKey: row.api_key_masked !== '',
        maskedKey: row.api_key_masked,
        isActive: row.is_active,
        updatedAt: row.updated_at
      };
    });

    res.json(keys);
  } catch (error) {
    console.error('Erro ao buscar chaves do usuário:', error);
    res.status(500).json({ message: 'Erro ao buscar chaves de API' });
  }
});

// Salvar/atualizar chave de API do usuário
router.put('/api-keys/:keyType', authenticate, async (req, res) => {
  try {
    const { keyType } = req.params;
    const { apiKey } = req.body;

    // Validar tipo de chave permitido
    const allowedTypes = ['apify', 'serp'];
    if (!allowedTypes.includes(keyType)) {
      return res.status(400).json({ message: 'Tipo de chave inválido' });
    }

    // Validar tamanho da chave
    if (apiKey && apiKey.length > 500) {
      return res.status(400).json({ message: 'Chave de API muito longa' });
    }

    if (apiKey && apiKey.trim()) {
      // Inserir ou atualizar
      await db.query(
        `INSERT INTO user_api_keys (user_id, key_type, api_key, is_active, updated_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (user_id, key_type) 
         DO UPDATE SET api_key = $3, is_active = true, updated_at = NOW()`,
        [req.user.id, keyType, apiKey.trim()]
      );
      res.json({ message: 'Chave de API salva com sucesso' });
    } else {
      // Remover chave
      await db.query(
        `DELETE FROM user_api_keys WHERE user_id = $1 AND key_type = $2`,
        [req.user.id, keyType]
      );
      res.json({ message: 'Chave de API removida' });
    }
  } catch (error) {
    console.error('Erro ao salvar chave do usuário:', error);
    res.status(500).json({ message: 'Erro ao salvar chave de API' });
  }
});

// Função helper para obter chave de API (prioriza usuário, depois global)
router.getApiKey = async function(userId, keyType) {
  // 1. Tentar chave do usuário
  const userKeyResult = await db.query(
    `SELECT api_key FROM user_api_keys 
     WHERE user_id = $1 AND key_type = $2 AND is_active = true`,
    [userId, keyType]
  );
  
  if (userKeyResult.rows.length > 0 && userKeyResult.rows[0].api_key) {
    return { key: userKeyResult.rows[0].api_key, source: 'user' };
  }

  // 2. Fallback para chave global (variável de ambiente)
  if (keyType === 'apify' && process.env.APIFY_API_KEY) {
    return { key: process.env.APIFY_API_KEY, source: 'global' };
  }

  return { key: null, source: null };
};

module.exports = router;
