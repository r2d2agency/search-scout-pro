const express = require('express');
const db = require('../config/database');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Listar todas as chaves SERP (superadmin only)
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, 
             CONCAT(SUBSTRING(api_key, 1, 8), '...', SUBSTRING(api_key, LENGTH(api_key) - 4)) as api_key_masked,
             is_active, usage_count, monthly_limit, last_used_at, created_at
      FROM serp_api_keys
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar chaves SERP:', error);
    res.status(500).json({ message: 'Erro ao buscar chaves SERP' });
  }
});

// Adicionar nova chave SERP (superadmin only)
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, apiKey, monthlyLimit = 100 } = req.body;

    if (!name || !apiKey) {
      return res.status(400).json({ message: 'Nome e API Key são obrigatórios' });
    }

    const result = await db.query(
      `INSERT INTO serp_api_keys (name, api_key, monthly_limit)
       VALUES ($1, $2, $3)
       RETURNING id, name, is_active, usage_count, monthly_limit, created_at`,
      [name, apiKey, monthlyLimit]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao adicionar chave SERP:', error);
    res.status(500).json({ message: 'Erro ao adicionar chave SERP' });
  }
});

// Atualizar chave SERP (superadmin only)
router.put('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, apiKey, isActive, monthlyLimit } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (apiKey !== undefined) {
      updates.push(`api_key = $${paramIndex++}`);
      params.push(apiKey);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }
    if (monthlyLimit !== undefined) {
      updates.push(`monthly_limit = $${paramIndex++}`);
      params.push(monthlyLimit);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar' });
    }

    params.push(id);
    const query = `UPDATE serp_api_keys SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, is_active, usage_count, monthly_limit, created_at`;
    
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Chave não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar chave SERP:', error);
    res.status(500).json({ message: 'Erro ao atualizar chave SERP' });
  }
});

// Deletar chave SERP (superadmin only)
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM serp_api_keys WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Chave não encontrada' });
    }

    res.json({ message: 'Chave removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar chave SERP:', error);
    res.status(500).json({ message: 'Erro ao remover chave SERP' });
  }
});

// Resetar contador de uso mensal (superadmin only)
router.post('/reset-usage', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await db.query('UPDATE serp_api_keys SET usage_count = 0');
    res.json({ message: 'Contadores resetados com sucesso' });
  } catch (error) {
    console.error('Erro ao resetar contadores:', error);
    res.status(500).json({ message: 'Erro ao resetar contadores' });
  }
});

// Função interna para obter próxima chave disponível (round-robin com menor uso)
async function getNextAvailableKey() {
  const result = await db.query(`
    SELECT id, api_key 
    FROM serp_api_keys 
    WHERE is_active = true AND usage_count < monthly_limit
    ORDER BY usage_count ASC, last_used_at ASC NULLS FIRST
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  const key = result.rows[0];

  // Incrementar uso
  await db.query(
    'UPDATE serp_api_keys SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id = $1',
    [key.id]
  );

  return key.api_key;
}

module.exports = router;
module.exports.getNextAvailableKey = getNextAvailableKey;
