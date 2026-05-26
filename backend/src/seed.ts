import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createUser, getUserByUsername, ensureWebAuthnUserId, db } from './db/index.js';

const adminUsername = 'admin';
const adminPassword = 'admin123';
const demoUsername = 'user1';
const demoPassword = 'user123';

db.exec('DELETE FROM device_credentials');
db.exec('DELETE FROM webauthn_challenges');
db.exec('DELETE FROM sessions');

if (!getUserByUsername(adminUsername)) {
  createUser(adminUsername, bcrypt.hashSync(adminPassword, 10), false, 'admin');
  console.log(`Admin yaratildi: ${adminUsername} / ${adminPassword}`);
}

const demo = getUserByUsername(demoUsername);
if (!demo) {
  createUser(demoUsername, bcrypt.hashSync(demoPassword, 10), true, 'user');
  console.log(`Demo user yaratildi: ${demoUsername} / ${demoPassword} (device_restricted=true)`);
} else {
  ensureWebAuthnUserId(demo.id);
}

console.log('Seed tugadi. Laptop boglash uchun /enroll sahifasidan WebAuthn enrollment qiling.');
