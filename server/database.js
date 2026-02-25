import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbPassword =
  process.env.DB_PASSWORD && process.env.DB_PASSWORD !== 'your_password'
    ? process.env.DB_PASSWORD
    : '';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: dbPassword,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
