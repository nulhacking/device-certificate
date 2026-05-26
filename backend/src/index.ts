import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import webauthnRoutes from './routes/webauthn.js';
import { authMiddleware } from './middleware/auth.js';
import { deviceGuard } from './middleware/deviceGuard.js';
import { bootstrap } from './bootstrap.js';
import { getAppOrigin, getCorsOrigin, isProduction } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;
const publicDir = path.join(__dirname, '../public');

app.set('trust proxy', 1);

app.use(
  cors({
    origin: getCorsOrigin(),
    credentials: true
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    auth: 'webauthn',
    origin: getAppOrigin(),
    production: isProduction()
  });
});

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/webauthn', webauthnRoutes);

app.get('/dashboard', authMiddleware, deviceGuard, (_req, res) => {
  res.json({
    message: "Xush kelibsiz! Bu himoyalangan endpoint — WebAuthn qurilma tekshiruvidan o'tdi."
  });
});

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/auth') ||
      req.path.startsWith('/admin') ||
      req.path.startsWith('/webauthn') ||
      req.path === '/health' ||
      req.path === '/dashboard'
    ) {
      next();
      return;
    }

    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint topilmadi' });
});

bootstrap();
app.listen(PORT, () => {
  console.log(`Server ${isProduction() ? getAppOrigin() : `http://localhost:${PORT}`} da ishlamoqda`);
});
