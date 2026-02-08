const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Listar todos os usuários (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.plan_id, u.created_at,
              p.name as plan_name
       FROM users u
       LEFT JOIN plans p ON u.plan_id = p.id
       ORDER BY u.created_at DESC`
    );

    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      planId: row.plan_id,
      planName: row.plan_name,
      createdAt: row.created_at
    }));

    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ message: 'Erro ao buscar usuários' });
  }
});

// Atualizar usuário (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, planId, password } = req.body;

    let query = 'UPDATE users SET name = $1, email = $2, role = $3, plan_id = $4, updated_at = NOW()';
    let params = [name, email, role, planId];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = $5 WHERE id = $6 RETURNING id, email, name, role, plan_id, created_at';
      params.push(passwordHash, id);
    } else {
      query += ' WHERE id = $5 RETURNING id, email, name, role, plan_id, created_at';
      params.push(id);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      planId: user.plan_id,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ message: 'Erro ao atualizar usuário' });
  }
});

// Deletar usuário (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Não permitir auto-exclusão
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Você não pode excluir sua própria conta' });
    }

    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ message: 'Erro ao remover usuário' });
  }
});

// Obter uso do usuário
router.get('/:id/usage', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Usuário normal só pode ver seu próprio uso
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    const result = await db.query(
      `SELECT searches_used, leads_extracted, whatsapp_verified
       FROM user_usage
       WHERE user_id = $1 AND month = $2`,
      [id, month]
    );

    if (result.rows.length === 0) {
      return res.json({
        userId: id,
        month,
        searchesUsed: 0,
        leadsExtracted: 0,
        whatsappVerified: 0
      });
    }

    const usage = result.rows[0];
    res.json({
      userId: id,
      month,
      searchesUsed: usage.searches_used,
      leadsExtracted: usage.leads_extracted,
      whatsappVerified: usage.whatsapp_verified
    });
  } catch (error) {
    console.error('Erro ao buscar uso:', error);
    res.status(500).json({ message: 'Erro ao buscar uso' });
  }
});

module.exports = router;
