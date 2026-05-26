import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload, PendingLoginPayload } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const PENDING_LOGIN_EXPIRY = '5m';
const ACCESS_TOKEN_EXPIRY = '8h';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signPendingLogin(payload: Omit<PendingLoginPayload, 'purpose'>): string {
  return jwt.sign({ ...payload, purpose: 'webauthn_login' }, JWT_SECRET, {
    expiresIn: PENDING_LOGIN_EXPIRY
  });
}

export function verifyPendingLogin(token: string): PendingLoginPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as PendingLoginPayload;
  if (decoded.purpose !== 'webauthn_login') {
    throw new Error('INVALID_PENDING_TOKEN');
  }
  return decoded;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token talab qilinadi' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Admin huquqi talab qilinadi' });
    return;
  }
  next();
}

export { JWT_SECRET };
