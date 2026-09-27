import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './config/db';
import { errorHandler } from './middleware/audit';
import authRoutes from './routes/auth';
import setupRoutes from './routes/setup';
import accountingRoutes from './routes/accounting';
import inventoryRoutes from './routes/inventory';
import salesRoutes from './routes/sales';
import cashBanksRoutes from './routes/cashBanks';
import purchasingRoutes from './routes/purchasing';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

// ── Security Middleware ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS Configuration ───────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, serverless) or any matching domain
    if (!origin || process.env.NODE_ENV !== 'production' || process.env.FRONTEND_URL === '*' || origin.includes('vercel.app') || origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive CORS for deployed Vercel apps
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsers ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ──────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Path Normalization Middleware for Serverless ──────────────────
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/') && req.url !== '/api') {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// ── Health Check ─────────────────────────────────────────────────
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    message: 'ERP API Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
};
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// ── API Routes (Support both /api/ prefix and direct prefix) ─────
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/setup', setupRoutes);
app.use('/setup', setupRoutes);

app.use('/api/accounting', accountingRoutes);
app.use('/accounting', accountingRoutes);

app.use('/api/inventory', inventoryRoutes);
app.use('/inventory', inventoryRoutes);

app.use('/api/sales', salesRoutes);
app.use('/sales', salesRoutes);

app.use('/api/cash-banks', cashBanksRoutes);
app.use('/cash-banks', cashBanksRoutes);

app.use('/api/purchasing', purchasingRoutes);
app.use('/purchasing', purchasingRoutes);

// ── 404 Handler ──────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'المسار غير موجود' });
});

// ── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Start Server (Only in Standalone Mode, Not Vercel Serverless) ─
if (!process.env.VERCEL) {
  const startServer = async () => {
    try {
      await testConnection();
      app.listen(PORT, () => {
        console.log(`\n🚀 ERP API Server running on http://localhost:${PORT}`);
        console.log(`📚 API Base URL: http://localhost:${PORT}/api`);
        console.log(`🔑 Auth Endpoint: http://localhost:${PORT}/api/auth/login\n`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
}

export default app;
