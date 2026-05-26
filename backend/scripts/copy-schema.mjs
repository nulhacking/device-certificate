import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(__dirname, '../src/db/schema.sql');
const targetDir = path.join(__dirname, '../dist/db');
const target = path.join(targetDir, 'schema.sql');

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log('schema.sql dist/db ga nusxalandi');
