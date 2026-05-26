import type { Request, Response, NextFunction } from 'express';
import { validateDeviceAccess } from '../services/webauthnService.js';

export function deviceGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autentifikatsiya talab qilinadi' });
    return;
  }

  const result = validateDeviceAccess(req.user.userId, req.user.credentialId);

  if (!result.allowed) {
    const messages: Record<string, string> = {
      CREDENTIAL_REQUIRED: 'Qurilma sertifikati talab qilinadi',
      DEVICE_NOT_ALLOWED:
        'Siz faqat ruxsat etilgan laptopdan kirishingiz mumkin. Administrator bilan bog\'laning.',
      DEVICE_PENDING_APPROVAL:
        'Bu qurilma admin tasdiqlashini kutmoqda. Administrator bilan bog\'laning.',
      USER_NOT_FOUND: 'Foydalanuvchi topilmadi'
    };

    res.status(result.code === 'DEVICE_NOT_ALLOWED' ? 403 : 400).json({
      error: result.code ?? 'DEVICE_DENIED',
      message: (result.code && messages[result.code]) ?? 'Qurilma ruxsati rad etildi'
    });
    return;
  }

  next();
}
