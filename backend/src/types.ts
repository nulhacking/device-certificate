export type DeviceApprovalStatus = 'pending' | 'approved' | 'rejected';

export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  device_restricted: number;
  role: UserRole;
  webauthn_user_id: string | null;
  created_at: string;
}

export interface DeviceCredential {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: Buffer;
  counter: number;
  device_name: string;
  device_type: string | null;
  registered_by: number | null;
  is_active: number;
  approval_status: DeviceApprovalStatus;
  transports: string | null;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  credential_id: string | null;
  ip_address: string | null;
  last_active: string;
  revoked: number;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: UserRole;
  credentialId: string | null;
}

export interface PendingLoginPayload {
  userId: number;
  username: string;
  role: UserRole;
  purpose: 'webauthn_login';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
