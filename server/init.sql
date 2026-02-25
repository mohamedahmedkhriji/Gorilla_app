-- Create database
CREATE DATABASE IF NOT EXISTS gorella_fitness;
USE gorella_fitness;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  age INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recovery factors table
CREATE TABLE IF NOT EXISTS recovery_factors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  sleep_hours DECIMAL(3,1) DEFAULT 8.0,
  nutrition_quality ENUM('optimal', 'suboptimal') DEFAULT 'optimal',
  stress_level ENUM('low', 'moderate', 'high') DEFAULT 'low',
  protein_intake DECIMAL(5,2),
  supplements TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_factors (user_id)
);

-- Workout sessions table
CREATE TABLE IF NOT EXISTS workout_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  muscle_group VARCHAR(50) NOT NULL,
  intensity ENUM('low', 'moderate', 'high') NOT NULL,
  volume ENUM('low', 'moderate', 'high') NOT NULL,
  eccentric_focus BOOLEAN DEFAULT FALSE,
  exercises JSON,
  duration_minutes INT,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Muscle recovery status table
CREATE TABLE IF NOT EXISTS muscle_recovery_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  muscle_group VARCHAR(50) NOT NULL,
  recovery_percentage DECIMAL(5,2) NOT NULL,
  hours_needed DECIMAL(5,2) NOT NULL,
  hours_elapsed DECIMAL(5,2) NOT NULL,
  last_worked TIMESTAMP NOT NULL,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_muscle (user_id, muscle_group)
);

-- Recovery history table
CREATE TABLE IF NOT EXISTS recovery_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  overall_recovery_score DECIMAL(5,2) NOT NULL,
  sleep_hours DECIMAL(3,1),
  nutrition_quality ENUM('optimal', 'suboptimal'),
  stress_level ENUM('low', 'moderate', 'high'),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Training readiness table
CREATE TABLE IF NOT EXISTS training_readiness (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  readiness_score DECIMAL(5,2) NOT NULL,
  recommended_intensity ENUM('light', 'moderate', 'high') NOT NULL,
  recommended_muscle_groups JSON,
  avoid_muscle_groups JSON,
  notes TEXT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample user
INSERT IGNORE INTO users (id, name, email, age) VALUES (1, 'Test User', 'test@example.com', 25);