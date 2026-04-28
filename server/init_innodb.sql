-- Create database
CREATE DATABASE IF NOT EXISTS gorella_fitness;
USE gorella_fitness;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('gym_owner', 'coach', 'user') DEFAULT 'user',
  age INT,
  coach_id INT,
  profile_photo VARCHAR(500),
  total_workouts INT DEFAULT 0,
  rank VARCHAR(50) DEFAULT 'Beginner',
  is_premium TINYINT(1) NOT NULL DEFAULT 1,
  subscription_status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  program_type VARCHAR(50),
  split_type VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Insert sample users
INSERT IGNORE INTO users (id, name, email, password, role, age) VALUES 
(1, 'Samurai', 'samurai@gym.com', 'samurai123', 'gym_owner', 35),
(2, 'Achref', 'achref@gym.com', 'achref123', 'coach', 28),
(3, 'Haythem', 'haythem@example.com', 'haythem123', 'user', 25);
