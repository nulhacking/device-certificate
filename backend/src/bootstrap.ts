import bcrypt from 'bcryptjs';
import { createUser, getUserByUsername, ensureWebAuthnUserId } from './db/index.js';

function seedIfEmpty() {
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const demoUsername = process.env.DEMO_USERNAME ?? 'user1';
  const demoPassword = process.env.DEMO_PASSWORD ?? 'user123';

  if (!getUserByUsername(adminUsername)) {
    createUser(adminUsername, bcrypt.hashSync(adminPassword, 10), false, 'admin');
    console.log(`Admin yaratildi: ${adminUsername}`);
  }

  const demo = getUserByUsername(demoUsername);
  if (!demo) {
    createUser(demoUsername, bcrypt.hashSync(demoPassword, 10), true, 'user');
    console.log(`Demo user yaratildi: ${demoUsername} (device_restricted=true)`);
  } else {
    ensureWebAuthnUserId(demo.id);
  }
}

export function bootstrap() {
  seedIfEmpty();
}
