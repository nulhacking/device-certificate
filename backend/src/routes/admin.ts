import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  createUser,
  getAllUsers,
  getUserById,
  getUserByUsername,
  updateDeviceRestricted
} from '../db/index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { listUserDevices, removeDevice } from '../services/webauthnService.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/users', (_req, res) => {
  const users = getAllUsers().map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    deviceRestricted: !!u.device_restricted,
    created_at: u.created_at
  }));

  res.json(users);
});

router.post('/users', (req, res) => {
  const { username, password, deviceRestricted, role } = req.body as {
    username?: string;
    password?: string;
    deviceRestricted?: boolean;
    role?: 'user' | 'admin';
  };

  if (!username?.trim() || !password || password.length < 4) {
    res.status(400).json({
      error: 'VALIDATION',
      message: 'Username va kamida 4 belgili parol talab qilinadi'
    });
    return;
  }

  if (getUserByUsername(username.trim())) {
    res.status(409).json({ error: 'CONFLICT', message: 'Bu username allaqachon mavjud' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = createUser(
    username.trim(),
    passwordHash,
    !!deviceRestricted,
    role === 'admin' ? 'admin' : 'user'
  );

  if (!user) {
    res.status(500).json({ error: 'SERVER_ERROR', message: "Foydalanuvchi yaratib bo'lmadi" });
    return;
  }

  res.status(201).json({
    id: user.id,
    username: user.username,
    role: user.role,
    deviceRestricted: !!user.device_restricted
  });
});

router.patch('/users/:id/device-restricted', (req, res) => {
  const userId = Number(req.params.id);
  const { deviceRestricted } = req.body as { deviceRestricted?: boolean };

  if (typeof deviceRestricted !== 'boolean') {
    res.status(400).json({ error: 'VALIDATION', message: "deviceRestricted boolean bo'lishi kerak" });
    return;
  }

  const user = getUserById(userId);

  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Foydalanuvchi topilmadi' });
    return;
  }

  const updated = updateDeviceRestricted(userId, deviceRestricted);

  res.json({
    id: updated!.id,
    username: updated!.username,
    role: updated!.role,
    deviceRestricted: !!updated!.device_restricted
  });
});

router.get('/users/:id/devices', (req, res) => {
  const userId = Number(req.params.id);
  const user = getUserById(userId);

  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Foydalanuvchi topilmadi' });
    return;
  }

  const devices = listUserDevices(userId).map(d => ({
    id: d.id,
    credentialId: d.credential_id,
    deviceName: d.device_name,
    deviceType: d.device_type,
    registeredBy: d.registered_by,
    createdAt: d.created_at
  }));

  res.json(devices);
});

router.delete('/devices/:id', (req, res) => {
  const deviceId = Number(req.params.id);

  try {
    removeDevice(deviceId);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'DEVICE_NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Qurilma topilmadi' });
      return;
    }
    throw err;
  }
});

export default router;
