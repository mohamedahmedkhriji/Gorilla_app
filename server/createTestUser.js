import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10
});

async function createTestUser() {
  try {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role, age, onboarding_completed) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      ['Test User', 'user@test.com', 'test123', 'user', 25, false]
    );
    
    console.log('✅ Test user created successfully!');
    console.log('📧 Email: user@test.com');
    console.log('🔑 Password: test123');
    console.log('👤 Role: user');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createTestUser();
