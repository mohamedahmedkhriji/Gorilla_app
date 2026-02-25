import pool from './database.js';

async function createUser() {
  try {
    // Insert new user
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
      ['haythem', 'haythem@example.com', 25]
    );
    
    console.log('User created successfully!');
    console.log('User ID:', result.insertId);
    console.log('Name: haythem');
    console.log('Email: haythem@example.com');
    
    // Initialize recovery factors for the user
    await pool.execute(
      'INSERT INTO recovery_factors (user_id, sleep_hours, nutrition_quality, stress_level) VALUES (?, ?, ?, ?)',
      [result.insertId, 8.0, 'optimal', 'low']
    );
    
    console.log('Recovery factors initialized');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  }
}

createUser();
