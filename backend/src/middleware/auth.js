const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware de autenticação
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Buscar usuário atualizado
      const result = await db.query(
        'SELECT id, email, name, role, plan_id FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Usuário não encontrado' });
      }

      req.user = result.rows[0];
      next();
    } catch (jwtError) {
      return res.status(401).json({ message: 'Token inválido' });
    }
  } catch (error) {
    console.error('Erro na autenticação:', error);
    res.status(500).json({ message: 'Erro interno' });
  }
};

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador.' });
  }
  next();
};

// Gerar token JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = { authenticate, requireAdmin, generateToken, JWT_SECRET };
