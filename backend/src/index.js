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
app.use('/api/apify-keys', apifyKeysRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/saved-searches', savedSearchesRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/instagram-firecrawl', instagramFirecrawlRoutes);
app.use('/api/linkedin', linkedinRoutes);
app.use('/api/firecrawl-keys', firecrawlKeysRoutes);
app.use('/api/cnpj', cnpjRoutes);
app.use('/api/enrich', enrichRoutes);

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
