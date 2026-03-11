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
const apifyKeysRoutes = require('./routes/apify-keys');
const searchRoutes = require('./routes/search');
const savedSearchesRoutes = require('./routes/saved-searches');
const instagramRoutes = require('./routes/instagram');
const instagramFirecrawlRoutes = require('./routes/instagram-firecrawl');
const linkedinRoutes = require('./routes/linkedin');
const firecrawlKeysRoutes = require('./routes/firecrawl-keys');
const cnpjRoutes = require('./routes/cnpj');
const enrichRoutes = require('./routes/enrich');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Easypanel/nginx)
app.set('trust proxy', 1);

// CORS - configurar ANTES do helmet
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['*'];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    // Se allowedOrigins contém '*', permite tudo
    if (allowedOrigins.includes('*')) return callback(null, true);
    
    // Verifica se a origin está na lista
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Temporariamente permite para debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // Cache preflight por 24h
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Aplicar CORS primeiro
app.use(cors(corsOptions));

// Handle preflight requests explicitamente
app.options('*', cors(corsOptions));

// Middleware de segurança
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

app.use(express.json({ limit: '10mb' }));

// ============ Rate Limiting com log detalhado ============

// Função para extrair identificação do usuário (IP + token se disponível)
const identifyUser = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const authHeader = req.headers.authorization;
  let userId = 'anon';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'your-secret-key');
      userId = decoded.userId || 'unknown';
    } catch (e) {
      userId = 'invalid-token';
    }
  }
  return { ip, userId };
};

// Handler quando alguém é bloqueado pelo rate limit
const rateLimitHandler = (routeName) => (req, res) => {
  const { ip, userId } = identifyUser(req);
  console.warn(`🚫 RATE LIMIT [${routeName}] | IP: ${ip} | User: ${userId} | Route: ${req.method} ${req.originalUrl} | Time: ${new Date().toISOString()}`);
  res.status(429).json({
    message: 'Muitas requisições. Aguarde um momento antes de tentar novamente.',
    retryAfter: 60
  });
};

// Rate limit GERAL - 300 req / 15 min por IP (permissivo)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('GERAL'),
  keyGenerator: (req) => req.ip,
});
app.use('/api/', generalLimiter);

// Rate limit para AUTH - 20 req / 15 min (previne brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('AUTH'),
  keyGenerator: (req) => req.ip,
});

// Rate limit para SEARCH - 60 req / 15 min (busca consome API externa)
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('SEARCH'),
  keyGenerator: (req) => req.ip,
});

// Rate limit para ENRICH - 30 req / 15 min (enriquecimento é pesado)
const enrichLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('ENRICH'),
  keyGenerator: (req) => req.ip,
});

// Log de requisições para monitoramento (resumido)
app.use('/api/', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Loga apenas requisições lentas (>2s) ou erros
    if (duration > 2000 || res.statusCode >= 400) {
      const { ip, userId } = identifyUser(req);
      console.log(`⚡ ${res.statusCode} | ${duration}ms | ${req.method} ${req.originalUrl} | IP: ${ip} | User: ${userId}`);
    }
  });
  next();
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/serp-keys', serpKeysRoutes);
app.use('/api/apify-keys', apifyKeysRoutes);
app.use('/api/search', searchLimiter, searchRoutes);
app.use('/api/saved-searches', savedSearchesRoutes);
app.use('/api/instagram', searchLimiter, instagramRoutes);
app.use('/api/instagram-firecrawl', searchLimiter, instagramFirecrawlRoutes);
app.use('/api/linkedin', searchLimiter, linkedinRoutes);
app.use('/api/firecrawl-keys', firecrawlKeysRoutes);
app.use('/api/cnpj', searchLimiter, cnpjRoutes);
app.use('/api/enrich', enrichLimiter, enrichRoutes);

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
