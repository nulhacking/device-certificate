import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath =
  process.env.DB_PATH ??
  (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PUBLIC_DOMAIN
    ? '/data/app.db'
    : path.join(__dirname, '../../data/app.db'));
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaCandidates = [
  path.join(__dirname, 'schema.sql'),
  path.join(__dirname, '../../src/db/schema.sql')
];

const schemaPath = schemaCandidates.find(candidate => fs.existsSync(candidate));

if (!schemaPath) {
  throw new Error('schema.sql topilmadi');
}

const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

function migrateLegacySchema() {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'webauthn_user_id')) {
    db.exec('ALTER TABLE users ADD COLUMN webauthn_user_id TEXT');
  }

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='allowed_devices'")
    .get();

  if (tables) {
    db.exec('DROP TABLE IF EXISTS allowed_devices');
  }

  const sessionCols = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  if (sessionCols.some(c => c.name === 'device_fingerprint') && !sessionCols.some(c => c.name === 'credential_id')) {
    db.exec(`
      CREATE TABLE sessions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        credential_id TEXT,
        ip_address TEXT,
        last_active TEXT NOT NULL DEFAULT (datetime('now')),
        revoked INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      INSERT INTO sessions_new (id, user_id, credential_id, ip_address, last_active, revoked)
        SELECT id, user_id, device_fingerprint, ip_address, last_active, revoked FROM sessions;
      DROP TABLE sessions;
      ALTER TABLE sessions_new RENAME TO sessions;
    `);
  }
}

migrateLegacySchema();

export function generateWebAuthnUserId(): string {
  return crypto.randomUUID();
}

export function getUserByUsername(username: string) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | import('../types.js').User
    | undefined;
}

export function getUserById(id: number) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | import('../types.js').User
    | undefined;
}

export function getAllUsers() {
  return db
    .prepare('SELECT id, username, device_restricted, role, webauthn_user_id, created_at FROM users ORDER BY id')
    .all() as Array<Omit<import('../types.js').User, 'password_hash'>>;
}

export function createUser(
  username: string,
  passwordHash: string,
  deviceRestricted: boolean,
  role: 'user' | 'admin'
) {
  const webauthnUserId = deviceRestricted ? generateWebAuthnUserId() : null;

  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, device_restricted, role, webauthn_user_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(username, passwordHash, deviceRestricted ? 1 : 0, role, webauthnUserId);

  return getUserById(Number(result.lastInsertRowid));
}

export function ensureWebAuthnUserId(userId: number) {
  const user = getUserById(userId);
  if (!user) return null;

  if (user.webauthn_user_id) {
    return user.webauthn_user_id;
  }

  const webauthnUserId = generateWebAuthnUserId();
  db.prepare('UPDATE users SET webauthn_user_id = ? WHERE id = ?').run(webauthnUserId, userId);
  return webauthnUserId;
}

export function updateDeviceRestricted(userId: number, deviceRestricted: boolean) {
  if (deviceRestricted) {
    ensureWebAuthnUserId(userId);
  }

  db.prepare('UPDATE users SET device_restricted = ? WHERE id = ?').run(
    deviceRestricted ? 1 : 0,
    userId
  );
  return getUserById(userId);
}

export function getUserCredentials(userId: number) {
  return db
    .prepare(
      `SELECT id, user_id, credential_id, public_key, counter, device_name, device_type,
              registered_by, is_active, transports, created_at
       FROM device_credentials
       WHERE user_id = ? AND is_active = 1
       ORDER BY created_at DESC`
    )
    .all(userId) as import('../types.js').DeviceCredential[];
}

export function getCredentialById(credentialId: string) {
  return db
    .prepare('SELECT * FROM device_credentials WHERE credential_id = ? AND is_active = 1')
    .get(credentialId) as import('../types.js').DeviceCredential | undefined;
}

export function getCredentialDbId(id: number) {
  return db.prepare('SELECT * FROM device_credentials WHERE id = ?').get(id) as
    | import('../types.js').DeviceCredential
    | undefined;
}

export function hasActiveCredentials(userId: number) {
  const row = db
    .prepare('SELECT id FROM device_credentials WHERE user_id = ? AND is_active = 1 LIMIT 1')
    .get(userId);
  return !!row;
}

export function isCredentialAllowed(userId: number, credentialId: string) {
  const row = db
    .prepare(
      `SELECT id FROM device_credentials
       WHERE user_id = ? AND credential_id = ? AND is_active = 1`
    )
    .get(userId, credentialId);
  return !!row;
}

export function saveCredential(data: {
  userId: number;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  deviceName: string;
  deviceType: string | null;
  registeredBy: number | null;
  transports: string[];
}) {
  const result = db
    .prepare(
      `INSERT INTO device_credentials
       (user_id, credential_id, public_key, counter, device_name, device_type, registered_by, transports)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.userId,
      data.credentialId,
      data.publicKey,
      data.counter,
      data.deviceName,
      data.deviceType,
      data.registeredBy,
      JSON.stringify(data.transports)
    );

  return db
    .prepare('SELECT * FROM device_credentials WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as import('../types.js').DeviceCredential;
}

export function updateCredentialCounter(credentialId: string, counter: number) {
  db.prepare('UPDATE device_credentials SET counter = ? WHERE credential_id = ?').run(
    counter,
    credentialId
  );
}

export function deactivateCredential(id: number) {
  db.prepare('UPDATE device_credentials SET is_active = 0 WHERE id = ?').run(id);
}

export function saveChallenge(data: {
  id: string;
  userId: number;
  challenge: string;
  type: 'registration' | 'authentication';
  deviceName?: string;
  expiresInMs?: number;
}) {
  const expiresAt = new Date(Date.now() + (data.expiresInMs ?? 5 * 60 * 1000)).toISOString();

  db.prepare(
    `INSERT INTO webauthn_challenges (id, user_id, challenge, type, device_name, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(data.id, data.userId, data.challenge, data.type, data.deviceName ?? null, expiresAt);
}

export function getChallenge(id: string) {
  return db
    .prepare('SELECT * FROM webauthn_challenges WHERE id = ?')
    .get(id) as
    | {
        id: string;
        user_id: number;
        challenge: string;
        type: 'registration' | 'authentication';
        device_name: string | null;
        expires_at: string;
      }
    | undefined;
}

export function deleteChallenge(id: string) {
  db.prepare('DELETE FROM webauthn_challenges WHERE id = ?').run(id);
}

export function cleanupExpiredChallenges() {
  db.prepare("DELETE FROM webauthn_challenges WHERE expires_at < datetime('now')").run();
}

export function createSession(userId: number, credentialId: string | null, ipAddress: string | null) {
  const result = db
    .prepare('INSERT INTO sessions (user_id, credential_id, ip_address) VALUES (?, ?, ?)')
    .run(userId, credentialId, ipAddress);

  return Number(result.lastInsertRowid);
}

export function revokeUserSessions(userId: number) {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(userId);
}
