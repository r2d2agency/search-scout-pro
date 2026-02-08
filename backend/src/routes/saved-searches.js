const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Listar pesquisas salvas do usuário
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, query, results_count, created_at, updated_at
       FROM saved_searches 
       WHERE user_id = $1 
       ORDER BY updated_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar pesquisas salvas:', error);
    res.status(500).json({ message: 'Erro ao buscar pesquisas salvas' });
  }
});

// Obter uma pesquisa salva com leads
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM saved_searches WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pesquisa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar pesquisa:', error);
    res.status(500).json({ message: 'Erro ao buscar pesquisa' });
  }
});

// Salvar uma pesquisa
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, query, leads } = req.body;

    if (!name || !query) {
      return res.status(400).json({ message: 'Nome e termo de pesquisa são obrigatórios' });
    }

    const result = await db.query(
      `INSERT INTO saved_searches (user_id, name, query, results_count, leads)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, query, results_count, created_at`,
      [req.user.id, name, query, leads?.length || 0, JSON.stringify(leads || [])]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao salvar pesquisa:', error);
    res.status(500).json({ message: 'Erro ao salvar pesquisa' });
  }
});

// Atualizar pesquisa (adicionar mais leads)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, leads } = req.body;

    // Verificar se pertence ao usuário
    const existing = await db.query(
      'SELECT id FROM saved_searches WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Pesquisa não encontrada' });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (leads !== undefined) {
      updates.push(`leads = $${paramIndex++}`);
      params.push(JSON.stringify(leads));
      updates.push(`results_count = $${paramIndex++}`);
      params.push(leads.length);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE saved_searches SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.query(query, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar pesquisa:', error);
    res.status(500).json({ message: 'Erro ao atualizar pesquisa' });
  }
});

// Deletar pesquisa
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM saved_searches WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pesquisa não encontrada' });
    }

    res.json({ message: 'Pesquisa removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar pesquisa:', error);
    res.status(500).json({ message: 'Erro ao remover pesquisa' });
  }
});

module.exports = router;
