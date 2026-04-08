import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

dotenv.config();

const managedLocalDbEnabled = String(process.env.LOCAL_DB_MANAGED || '').trim() === '1';
const placeholderDbPasswords = new Set(['', 'your_password', 'your_mysql_password']);

if (managedLocalDbEnabled) {
  const ensureLocalDbScriptPath = fileURLToPath(new URL('../scripts/ensure-local-db.mjs', import.meta.url));
  const ensureResult = spawnSync(process.execPath, [ensureLocalDbScriptPath], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
    env: process.env,
    encoding: 'utf8',
  });

  if (ensureResult.status !== 0) {
    throw new Error('Managed local DB bootstrap failed. Check the local DB logs under .local/.');
  }
}

const dbPassword =
  process.env.DB_PASSWORD && !placeholderDbPasswords.has(process.env.DB_PASSWORD)
    ? process.env.DB_PASSWORD
    : '';
const dbHost = String(process.env.DB_HOST || '127.0.0.1').trim() === 'localhost'
  ? '127.0.0.1'
  : String(process.env.DB_HOST || '127.0.0.1').trim();
const connectTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS || 15000);

const pool = mysql.createPool({
  host: dbHost,
  user: process.env.DB_USER,
  password: dbPassword,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  connectTimeout: Number.isFinite(connectTimeoutMs) ? connectTimeoutMs : 15000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
