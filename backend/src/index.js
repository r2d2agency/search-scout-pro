require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const plansRoutes = require('./routes/plans');
const leadsRoutes = require('./routes/leads');
const settingsRoutes = require('./routes/settings');
const serpKeysRoutes = require('./routes/serp-keys');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Easypanel/nginx)
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS - permitir origens específicas ou todas
const corsOptions = {
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite por IP
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/serp-keys', serpKeysRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Erro interno do servidor'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});
