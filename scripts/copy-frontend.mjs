import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(__dirname, '../frontend/dist');
const target = path.join(__dirname, '../backend/public');

if (!fs.existsSync(source)) {
  console.error('frontend/dist topilmadi. Avval frontend build qiling.');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log('Frontend backend/public ga nusxalandi');
