import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { createSession, getUserById, getUserByUsername } from '../db/index.js';
import { signToken, signPendingLogin, verifyPendingLogin, authMiddleware } from '../middleware/auth.js';
import { deviceGuard } from '../middleware/deviceGuard.js';
import {
  createAuthenticationOptions,
  createRegistrationOptions,
  hasApprovedCredentials,
  validateDeviceAccess,
  verifyAuthentication,
  verifyRegistration
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
    const pendingToken = signPendingLogin({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    const hasApproved = hasApprovedCredentials(user.id);

    res.json({
      requiresWebAuthn: hasApproved,
      requiresDeviceRegistration: !hasApproved,
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
    requiresDeviceRegistration: false,
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
    const message = err instanceof Error ? err.message : 'Token yaroqsiz';
    res.status(err instanceof Error && err.message === 'NO_APPROVED_CREDENTIALS' ? 403 : 401).json({
      error: 'INVALID_PENDING_TOKEN',
      message
    });
  }
});

router.post('/webauthn/register/options', loginLimiter, async (req, res) => {
  const { pendingToken, deviceName } = req.body as { pendingToken?: string; deviceName?: string };

  if (!pendingToken) {
    res.status(400).json({ error: 'VALIDATION', message: 'pendingToken talab qilinadi' });
    return;
  }

  try {
    const pending = verifyPendingLogin(pendingToken);
    const { options, challengeId } = await createRegistrationOptions(
      pending.userId,
      deviceName?.trim() || 'Laptop'
    );

    res.json({ options, challengeId, pendingToken });
  } catch (err) {
    res.status(400).json({
      error: 'WEBAUTHN_OPTIONS_FAILED',
      message: err instanceof Error ? err.message : 'Registration options yaratib bolmadi'
    });
  }
});

router.post('/webauthn/register/verify', loginLimiter, async (req, res) => {
  const { pendingToken, challengeId, credential, deviceName } = req.body as {
    pendingToken?: string;
    challengeId?: string;
    credential?: unknown;
    deviceName?: string;
  };

  if (!pendingToken || !challengeId || !credential) {
    res.status(400).json({
      error: 'VALIDATION',
      message: 'pendingToken, challengeId va credential talab qilinadi'
    });
    return;
  }

  try {
    const pending = verifyPendingLogin(pendingToken);
    const saved = await verifyRegistration(
      pending.userId,
      challengeId,
      credential,
      null,
      deviceName?.trim() || 'Laptop',
      'pending'
    );

    res.status(201).json({
      status: 'pending',
      message: "Qurilma ro'yxatdan o'tdi. Administrator tasdiqlashini kuting.",
      device: {
        id: saved.id,
        deviceName: saved.device_name,
        deviceType: saved.device_type,
        approvalStatus: saved.approval_status
      }
    });
  } catch (err) {
    res.status(400).json({
      error: 'WEBAUTHN_VERIFY_FAILED',
      message: err instanceof Error ? err.message : 'Qurilma ro\'yxatdan o\'tmadi'
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
      const messages: Record<string, string> = {
        DEVICE_NOT_ALLOWED: "Siz faqat ruxsat etilgan laptopdan kirishingiz mumkin.",
        DEVICE_PENDING_APPROVAL: "Bu qurilma admin tasdiqlashini kutmoqda."
      };

      res.status(access.code === 'DEVICE_PENDING_APPROVAL' ? 403 : 403).json({
        error: access.code,
        message: messages[access.code!] ?? 'Qurilma ruxsati rad etildi'
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
    const code = message === 'DEVICE_PENDING_APPROVAL' ? 'DEVICE_PENDING_APPROVAL' : 'WEBAUTHN_FAILED';
    res.status(403).json({
      error: code,
      message:
        code === 'DEVICE_PENDING_APPROVAL'
          ? 'Bu qurilma admin tasdiqlashini kutmoqda.'
          : message
    });
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
