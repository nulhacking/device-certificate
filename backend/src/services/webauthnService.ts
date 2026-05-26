import crypto from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import type { DeviceApprovalStatus } from '../types.js';
import {
  cleanupExpiredChallenges,
  deactivateCredential,
  deleteChallenge,
  ensureWebAuthnUserId,
  getAllPendingDevices,
  getChallenge,
  getCredentialApprovalStatus,
  getCredentialById,
  getCredentialDbId,
  getUserById,
  getUserCredentials,
  hasApprovedCredentials,
  isCredentialAllowed,
  saveChallenge,
  saveCredential,
  updateCredentialApproval,
  updateCredentialCounter
} from '../db/index.js';

import { getWebAuthnConfig } from '../config.js';

function toUint8Array(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(value));
}

function parseTransports(raw: string | null): AuthenticatorTransportFuture[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AuthenticatorTransportFuture[];
  } catch {
    return [];
  }
}

export function validateDeviceAccess(userId: number, credentialId: string | null) {
  const user = getUserById(userId);

  if (!user) {
    return { allowed: false, code: 'USER_NOT_FOUND' as const };
  }

  if (!user.device_restricted) {
    return { allowed: true, user };
  }

  if (!credentialId) {
    return { allowed: false, code: 'CREDENTIAL_REQUIRED' as const, user };
  }

  const status = getCredentialApprovalStatus(credentialId);
  if (status === 'pending') {
    return { allowed: false, code: 'DEVICE_PENDING_APPROVAL' as const, user };
  }

  if (!isCredentialAllowed(userId, credentialId)) {
    return { allowed: false, code: 'DEVICE_NOT_ALLOWED' as const, user };
  }

  return { allowed: true, user };
}

export function listUserDevices(userId: number) {
  return getUserCredentials(userId, 'all');
}

export function listPendingDevices() {
  return getAllPendingDevices();
}

export function approveDevice(deviceDbId: number) {
  const device = getCredentialDbId(deviceDbId);
  if (!device) {
    throw new Error('DEVICE_NOT_FOUND');
  }
  return updateCredentialApproval(deviceDbId, 'approved');
}

export function rejectDevice(deviceDbId: number) {
  const device = getCredentialDbId(deviceDbId);
  if (!device) {
    throw new Error('DEVICE_NOT_FOUND');
  }
  deactivateCredential(deviceDbId);
  updateCredentialApproval(deviceDbId, 'rejected');
  return device;
}

export function removeDevice(deviceDbId: number) {
  const device = getCredentialDbId(deviceDbId);

  if (!device) {
    throw new Error('DEVICE_NOT_FOUND');
  }

  deactivateCredential(deviceDbId);
  return device;
}

async function buildRegistrationOptions(userId: number, deviceName: string) {
  cleanupExpiredChallenges();

  const user = getUserById(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const webauthnUserId = ensureWebAuthnUserId(userId);
  if (!webauthnUserId) {
    throw new Error('WEBAUTHN_USER_ID_FAILED');
  }

  const existing = getUserCredentials(userId, 'all');
  const { rpName, rpID } = getWebAuthnConfig();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userID: toUint8Array(webauthnUserId),
    attestationType: 'none',
    excludeCredentials: existing.map(c => ({
      id: c.credential_id,
      transports: parseTransports(c.transports)
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform'
    }
  });

  const challengeId = crypto.randomUUID();
  saveChallenge({
    id: challengeId,
    userId,
    challenge: options.challenge,
    type: 'registration',
    deviceName
  });

  return { options, challengeId };
}

export async function createRegistrationOptions(userId: number, deviceName: string) {
  return buildRegistrationOptions(userId, deviceName);
}

export async function verifyRegistration(
  userId: number,
  challengeId: string,
  response: unknown,
  registeredBy: number | null,
  deviceName: string,
  approvalStatus: DeviceApprovalStatus = 'pending'
) {
  const stored = getChallenge(challengeId);

  if (!stored || stored.type !== 'registration' || stored.user_id !== userId) {
    throw new Error('INVALID_CHALLENGE');
  }

  if (new Date(stored.expires_at) < new Date()) {
    deleteChallenge(challengeId);
    throw new Error('CHALLENGE_EXPIRED');
  }

  const { rpID, origin } = getWebAuthnConfig();

  const verification = await verifyRegistrationResponse({
    response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID
  });

  deleteChallenge(challengeId);

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('VERIFICATION_FAILED');
  }

  const { credential, credentialDeviceType } = verification.registrationInfo;

  return saveCredential({
    userId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    deviceName: deviceName || stored.device_name || 'Laptop',
    deviceType: credentialDeviceType,
    registeredBy,
    transports: credential.transports ?? [],
    approvalStatus
  });
}

export async function createAuthenticationOptions(userId: number) {
  cleanupExpiredChallenges();

  const user = getUserById(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const credentials = getUserCredentials(userId, 'approved');
  if (credentials.length === 0) {
    throw new Error('NO_APPROVED_CREDENTIALS');
  }

  const { rpID } = getWebAuthnConfig();

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map(c => ({
      id: c.credential_id,
      transports: parseTransports(c.transports)
    })),
    userVerification: 'required'
  });

  const challengeId = crypto.randomUUID();
  saveChallenge({
    id: challengeId,
    userId,
    challenge: options.challenge,
    type: 'authentication'
  });

  return { options, challengeId };
}

export async function verifyAuthentication(userId: number, challengeId: string, response: unknown) {
  const stored = getChallenge(challengeId);

  if (!stored || stored.type !== 'authentication' || stored.user_id !== userId) {
    throw new Error('INVALID_CHALLENGE');
  }

  if (new Date(stored.expires_at) < new Date()) {
    deleteChallenge(challengeId);
    throw new Error('CHALLENGE_EXPIRED');
  }

  const body = response as { id?: string };
  const credentialId = body.id;

  if (!credentialId) {
    throw new Error('CREDENTIAL_ID_MISSING');
  }

  const credential = getCredentialById(credentialId);

  if (!credential || credential.user_id !== userId) {
    throw new Error('CREDENTIAL_NOT_ALLOWED');
  }

  if (credential.approval_status === 'pending') {
    throw new Error('DEVICE_PENDING_APPROVAL');
  }

  if (credential.approval_status !== 'approved') {
    throw new Error('CREDENTIAL_NOT_ALLOWED');
  }

  const { rpID, origin } = getWebAuthnConfig();

  const verification = await verifyAuthenticationResponse({
    response: response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credential.credential_id,
      publicKey: new Uint8Array(credential.public_key),
      counter: credential.counter,
      transports: parseTransports(credential.transports)
    }
  });

  deleteChallenge(challengeId);

  if (!verification.verified) {
    throw new Error('VERIFICATION_FAILED');
  }

  updateCredentialCounter(credentialId, verification.authenticationInfo.newCounter);

  return credential;
}

export { hasApprovedCredentials };
