const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();

// Registrar usuário
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    // Verificar se email já existe
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Este email já está cadastrado' });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Verificar se é o primeiro usuário (será admin)
    const countResult = await db.query('SELECT COUNT(*) FROM users');
    const isFirstUser = parseInt(countResult.rows[0].count) === 0;

    // Criar usuário
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role, plan_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, name, role, plan_id, created_at`,
      [email, passwordHash, name, isFirstUser ? 'admin' : 'user', 'free']
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        planId: user.plan_id,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ message: 'Erro ao criar conta' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const result = await db.query(
      'SELECT id, email, password_hash, name, role, plan_id, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email ou senha incorretos' });
    }

    const user = result.rows[0];

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Email ou senha incorretos' });
    }

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        planId: user.plan_id,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro ao fazer login' });
  }
});

// Obter usuário atual
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, role, plan_id, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

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
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ message: 'Erro interno' });
  }
});

module.exports = router;
