import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

const dbPassword =
  process.env.DB_PASSWORD && process.env.DB_PASSWORD !== 'your_password'
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
