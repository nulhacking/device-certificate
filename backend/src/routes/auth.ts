import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { createSession, getUserById, getUserByUsername } from '../db/index.js';
import { signToken, signPendingLogin, verifyPendingLogin, authMiddleware } from '../middleware/auth.js';
import { deviceGuard } from '../middleware/deviceGuard.js';
import {
  createAuthenticationOptions,
  hasActiveCredentials,
  validateDeviceAccess,
  verifyAuthentication
} from '../services/webauthnService.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'RATE_LIMIT', message: "Juda ko'p urinish. Keyinroq qayta urinib ko'ring." }
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password) {
    res.status(400).json({ error: 'VALIDATION', message: 'Login va parol talab qilinadi' });
    return;
  }

  const user = getUserByUsername(username.trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS', message: "Login yoki parol noto'g'ri" });
    return;
  }

  if (user.device_restricted) {
    if (!hasActiveCredentials(user.id)) {
      res.status(403).json({
        error: 'DEVICE_NOT_REGISTERED',
        message: "Laptop hali bog'lanmagan. Administrator bilan bog'laning."
      });
      return;
    }

    const pendingToken = signPendingLogin({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    res.json({
      requiresWebAuthn: true,
      pendingToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        deviceRestricted: true
      }
    });
    return;
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    credentialId: null
  });

  createSession(user.id, null, req.ip ?? null);

  res.json({
    requiresWebAuthn: false,
    accessToken: token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      deviceRestricted: false
    }
  });
});

router.post('/webauthn/options', loginLimiter, async (req, res) => {
  const { pendingToken } = req.body as { pendingToken?: string };

  if (!pendingToken) {
    res.status(400).json({ error: 'VALIDATION', message: 'pendingToken talab qilinadi' });
    return;
  }

  try {
    const pending = verifyPendingLogin(pendingToken);
    const { options, challengeId } = await createAuthenticationOptions(pending.userId);

    res.json({ options, challengeId, pendingToken });
  } catch (err) {
    res.status(401).json({
      error: 'INVALID_PENDING_TOKEN',
      message: err instanceof Error ? err.message : 'Token yaroqsiz'
    });
  }
});

router.post('/webauthn/verify', loginLimiter, async (req, res) => {
  const { pendingToken, challengeId, credential } = req.body as {
    pendingToken?: string;
    challengeId?: string;
    credential?: unknown;
  };

  if (!pendingToken || !challengeId || !credential) {
    res.status(400).json({ error: 'VALIDATION', message: 'pendingToken, challengeId va credential talab qilinadi' });
    return;
  }

  try {
    const pending = verifyPendingLogin(pendingToken);
    const verifiedCredential = await verifyAuthentication(pending.userId, challengeId, credential);

    const access = validateDeviceAccess(pending.userId, verifiedCredential.credential_id);
    if (!access.allowed) {
      res.status(403).json({
        error: 'DEVICE_NOT_ALLOWED',
        message: "Siz faqat ruxsat etilgan laptopdan kirishingiz mumkin."
      });
      return;
    }

    const token = signToken({
      userId: pending.userId,
      username: pending.username,
      role: pending.role,
      credentialId: verifiedCredential.credential_id
    });

    createSession(pending.userId, verifiedCredential.credential_id, req.ip ?? null);

    res.json({
      accessToken: token,
      user: {
        id: pending.userId,
        username: pending.username,
        role: pending.role,
        deviceRestricted: true
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'WebAuthn tekshiruvi muvaffaqiyatsiz';
    res.status(400).json({ error: 'WEBAUTHN_FAILED', message });
  }
});

router.get('/me', authMiddleware, deviceGuard, (req, res) => {
  const user = getUserById(req.user!.userId);

  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Foydalanuvchi topilmadi' });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    deviceRestricted: !!user.device_restricted
  });
});

export default router;
