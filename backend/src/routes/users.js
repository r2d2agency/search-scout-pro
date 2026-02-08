const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Listar usuários (admin: vê todos, user: não tem acesso)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.email, u.name, u.role, u.plan_id, u.created_at, u.created_by,
             p.name as plan_name,
             c.name as created_by_name
       FROM users u
       LEFT JOIN plans p ON u.plan_id = p.id
       LEFT JOIN users c ON u.created_by = c.id
    `;
    
    // Superadmin vê todos, admin vê apenas usuários que criou
    if (req.user.role !== 'superadmin') {
      query += ` WHERE u.created_by = $1 OR u.id = $1`;
    }
    
    query += ` ORDER BY u.created_at DESC`;

    const params = req.user.role !== 'superadmin' ? [req.user.id] : [];
    const result = await db.query(query, params);

    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      planId: row.plan_id,
      planName: row.plan_name,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: row.created_by_name
    }));

    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ message: 'Erro ao buscar usuários' });
  }
});

// Criar novo usuário (admin pode criar usuários)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role = 'user', planId = 'free' } = req.body;

    // Validar dados
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, senha e nome são obrigatórios' });
    }

    // Verificar se email já existe
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Email já cadastrado' });
    }

    // Apenas superadmin pode criar admins
    let finalRole = role;
    if (role === 'admin' && req.user.role !== 'superadmin') {
      finalRole = 'user';
    }
    // Ninguém pode criar superadmin via API
    if (role === 'superadmin') {
      finalRole = 'admin';
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role, plan_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role, plan_id, created_at`,
      [email, passwordHash, name, finalRole, planId, req.user.id]
    );

    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      planId: user.plan_id,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro ao criar usuário' });
  }
});

// Atualizar usuário
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, planId, password } = req.body;

    // Verificar permissão (admin só pode editar usuários que criou)
    if (req.user.role !== 'superadmin') {
      const checkResult = await db.query(
        'SELECT id FROM users WHERE id = $1 AND (created_by = $2 OR id = $2)',
        [id, req.user.id]
      );
      if (checkResult.rows.length === 0) {
        return res.status(403).json({ message: 'Você não tem permissão para editar este usuário' });
      }
    }

    // Não permitir mudar role para superadmin
    let finalRole = role;
    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      finalRole = 'admin';
    }

    // Construir query dinamicamente apenas com campos fornecidos
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (finalRole !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(finalRole);
    }
    if (planId !== undefined) {
      updates.push(`plan_id = $${paramIndex++}`);
      params.push(planId);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, name, role, plan_id, created_at`;
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

// Deletar usuário
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Não permitir auto-exclusão
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Você não pode excluir sua própria conta' });
    }

    // Verificar permissão (admin só pode deletar usuários que criou)
    if (req.user.role !== 'superadmin') {
      const checkResult = await db.query(
        'SELECT id FROM users WHERE id = $1 AND created_by = $2',
        [id, req.user.id]
      );
      if (checkResult.rows.length === 0) {
        return res.status(403).json({ message: 'Você não tem permissão para excluir este usuário' });
      }
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
    // Admin pode ver uso de usuários que criou
    if (req.user.role === 'user' && req.user.id !== id) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (req.user.role === 'admin') {
      const checkResult = await db.query(
        'SELECT id FROM users WHERE id = $1 AND (created_by = $2 OR id = $2)',
        [id, req.user.id]
      );
      if (checkResult.rows.length === 0) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
    }

    const month = new Date().toISOString().slice(0, 7);

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
