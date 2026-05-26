import { Router } from 'express';
import { getUserById } from '../db/index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import {
  createRegistrationOptions,
  verifyRegistration
} from '../services/webauthnService.js';

const router = Router();

router.post('/register/options', authMiddleware, adminMiddleware, async (req, res) => {
  const { userId, deviceName } = req.body as { userId?: number; deviceName?: string };

  if (!userId) {
    res.status(400).json({ error: 'VALIDATION', message: 'userId talab qilinadi' });
    return;
  }

  const user = getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Foydalanuvchi topilmadi' });
    return;
  }

  try {
    const { options, challengeId } = await createRegistrationOptions(
      userId,
      deviceName?.trim() || 'Laptop'
    );

    res.json({ options, challengeId, userId });
  } catch (err) {
    res.status(400).json({
      error: 'WEBAUTHN_OPTIONS_FAILED',
      message: err instanceof Error ? err.message : 'Registration options yaratib bolmadi'
    });
  }
});

router.post('/register/verify', authMiddleware, adminMiddleware, async (req, res) => {
  const { userId, challengeId, credential, deviceName } = req.body as {
    userId?: number;
    challengeId?: string;
    credential?: unknown;
    deviceName?: string;
  };

  if (!userId || !challengeId || !credential) {
    res.status(400).json({
      error: 'VALIDATION',
      message: 'userId, challengeId va credential talab qilinadi'
    });
    return;
  }

  try {
    const saved = await verifyRegistration(
      userId,
      challengeId,
      credential,
      req.user!.userId,
      deviceName?.trim() || 'Laptop',
      'approved'
    );

    res.status(201).json({
      id: saved.id,
      userId: saved.user_id,
      credentialId: saved.credential_id,
      deviceName: saved.device_name,
      deviceType: saved.device_type,
      createdAt: saved.created_at
    });
  } catch (err) {
    res.status(400).json({
      error: 'WEBAUTHN_VERIFY_FAILED',
      message: err instanceof Error ? err.message : 'Laptop boglanmadi'
    });
  }
});

export default router;
