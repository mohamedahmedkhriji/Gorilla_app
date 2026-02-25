import express from 'express';
import pool from './database.js';

const router = express.Router();

let profileImageColumnCache;

const getProfileImageColumn = async () => {
  if (profileImageColumnCache !== undefined) return profileImageColumnCache;

  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('profile_picture', 'profile_photo')`
  );

  const columns = new Set(rows.map((r) => r.COLUMN_NAME || r.column_name));

  if (columns.has('profile_picture')) {
    profileImageColumnCache = 'profile_picture';
  } else if (columns.has('profile_photo')) {
    profileImageColumnCache = 'profile_photo';
  } else {
    profileImageColumnCache = null;
  }

  return profileImageColumnCache;
};

const getProfileImageColumnMaxLength = async (columnName) => {
  const [rows] = await pool.execute(
    `SELECT CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [columnName]
  );

  if (!rows.length) return null;
  return rows[0].CHARACTER_MAXIMUM_LENGTH ?? rows[0].character_maximum_length ?? null;
};

const normalizeUser = (user) => {
  if (!user) return null;
  const safeUser = { ...user };
  delete safeUser.password;
  return safeUser;
};

const toNumber = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const TRACKED_MUSCLES = [
  'Chest',
  'Back',
  'Quadriceps',
  'Hamstrings',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Calves',
  'Abs',
];

const BASE_RECOVERY_TIMES = {
  Chest: 48,
  Back: 48,
  Legs: 72,
  Quads: 72,
  Quadriceps: 72,
  Hamstrings: 72,
  Glutes: 72,
  Shoulders: 48,
  Lats: 48,
  Traps: 48,
  Biceps: 36,
  Triceps: 36,
  Forearms: 24,
  Calves: 36,
  Abs: 24,
  Core: 24,
};

const MUSCLE_WEIGHTS = {
  chest: 1.2,
  back: 1.2,
  quadriceps: 1.3,
  hamstrings: 1.2,
  shoulders: 1.0,
  biceps: 0.8,
  triceps: 0.8,
  forearms: 0.6,
  calves: 0.8,
  abs: 0.7,
};

const INTENSITY_FACTORS = {
  low: 0.7,
  moderate: 1.0,
  high: 1.3,
};

const VOLUME_FACTORS = {
  low: 0.8,
  moderate: 1.0,
  high: 1.2,
};

const ECCENTRIC_FACTOR = 1.15;

const NUTRITION_FACTORS = {
  optimal: 0.9,
  suboptimal: 1.1,
};

const STRESS_FACTORS = {
  low: 0.95,
  moderate: 1.0,
  high: 1.15,
};

const getAgeFactor = (age) => {
  if (age == null) return 1.0;
  if (age < 25) return 0.9;
  if (age < 35) return 1.0;
  if (age < 45) return 1.1;
  return 1.2;
};

const getSleepFactor = (hours) => {
  if (hours == null) return 1.0;
  if (hours >= 8) return 0.9;
  if (hours >= 7) return 1.0;
  if (hours >= 6) return 1.1;
  return 1.2;
};

const getProteinFactor = (proteinIntake) => {
  if (proteinIntake == null) return 1.0;
  if (proteinIntake >= 1.6) return 0.95;
  if (proteinIntake >= 1.0) return 1.0;
  return 1.08;
};

const normalizeMuscleName = (muscle = '') => {
  const key = String(muscle).trim().toLowerCase();
  if (!key) return null;

  const map = {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    shoulder: 'Shoulders',
    biceps: 'Biceps',
    bicep: 'Biceps',
    triceps: 'Triceps',
    tricep: 'Triceps',
    forearms: 'Forearms',
    forearm: 'Forearms',
    calves: 'Calves',
    calf: 'Calves',
    abs: 'Abs',
    core: 'Abs',
    quads: 'Quadriceps',
    quadriceps: 'Quadriceps',
    hamstrings: 'Hamstrings',
    hamstring: 'Hamstrings',
    legs: 'Quadriceps',
    lats: 'Back',
    traps: 'Back',
    glutes: 'Hamstrings',
  };

  return map[key] || (muscle.charAt(0).toUpperCase() + muscle.slice(1).toLowerCase());
};

const parseMuscleGroups = (rawValue) => {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) return rawValue;

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return [parsed];
    } catch {
      return [rawValue];
    }
  }

  return [];
};

const inferMusclesFromExerciseName = (exerciseName = '') => {
  const name = String(exerciseName).toLowerCase();

  const matches = [];
  if (/bench|chest|fly|push-up|push up/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|lat|pulldown|pullover/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|lunge|split squat|step up/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (/shoulder|overhead press|lateral raise|rear delt/.test(name)) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|dip/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up/.test(name)) matches.push('Abs');

  return [...new Set(matches.map(normalizeMuscleName).filter(Boolean))];
};

const calculateRecoveryHours = ({
  muscleGroup,
  intensity = 'moderate',
  volume = 'moderate',
  eccentricFocus = false,
  age = null,
  sleepHours = 7,
  nutritionQuality = 'optimal',
  stressLevel = 'moderate',
  proteinIntake = null,
}) => {
  const canonicalMuscle = normalizeMuscleName(muscleGroup) || 'Chest';
  const base = BASE_RECOVERY_TIMES[canonicalMuscle] || 48;

  let hours = base;
  hours *= INTENSITY_FACTORS[intensity] || 1.0;
  hours *= VOLUME_FACTORS[volume] || 1.0;
  if (eccentricFocus) hours *= ECCENTRIC_FACTOR;
  hours *= getAgeFactor(age);
  hours *= getSleepFactor(sleepHours);
  hours *= NUTRITION_FACTORS[nutritionQuality] || 1.0;
  hours *= STRESS_FACTORS[stressLevel] || 1.0;
  hours *= getProteinFactor(proteinIntake);

  return Number(Math.max(12, hours).toFixed(2));
};

const calculateDynamicRecovery = (lastWorked, hoursNeeded) => {
  if (!lastWorked || !hoursNeeded) {
    return { hoursElapsed: 0, score: 100 };
  }

  const elapsedHours = Math.max(0, (Date.now() - new Date(lastWorked).getTime()) / (1000 * 60 * 60));
  const score = Math.max(0, Math.min(100, (elapsedHours / Number(hoursNeeded || 1)) * 100));
  return { hoursElapsed: Number(elapsedHours.toFixed(2)), score: Math.round(score) };
};

const computeOverallRecovery = (muscles) => {
  if (!muscles.length) return 100;

  let weightedTotal = 0;
  let totalWeight = 0;

  muscles.forEach((m) => {
    const key = String(normalizeMuscleName(m.name || m.muscle || '') || '').toLowerCase();
    const weight = MUSCLE_WEIGHTS[key] || 1;
    weightedTotal += (Number(m.score) || 0) * weight;
    totalWeight += weight;
  });

  if (!totalWeight) return 100;
  return Math.round(weightedTotal / totalWeight);
};

const formatDateISO = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeGoalEnum = (goal) => {
  const key = String(goal || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

  const map = {
    hypertrophy: 'hypertrophy',
    'muscle gain': 'hypertrophy',
    'build muscle': 'hypertrophy',
    strength: 'strength',
    'fat loss': 'fat_loss',
    'weight loss': 'fat_loss',
    recomposition: 'recomposition',
    endurance: 'endurance',
    'general fitness': 'general_fitness',
  };

  return map[key] || 'general_fitness';
};

const normalizeExperienceEnum = (level) => {
  const key = String(level || '').toLowerCase().trim();
  if (key.startsWith('beg')) return 'beginner';
  if (key.startsWith('int')) return 'intermediate';
  if (key.startsWith('adv')) return 'advanced';
  return null;
};

const normalizeGenderEnum = (gender) => {
  const key = String(gender || '').toLowerCase().trim();
  if (key === 'male' || key === 'm') return 'male';
  if (key === 'female' || key === 'f') return 'female';
  if (key === 'other') return 'other';
  if (key === 'prefer_not_say' || key === 'prefer not say' || key === 'prefer not to say') return 'prefer_not_say';
  return null;
};

const clampWorkoutDays = (days, fallback = 4) => {
  const n = Number(days);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(2, Math.min(6, Math.round(n)));
};

const WEEKDAY_BY_DAYS_PER_WEEK = {
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  7: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
};

const normalizeProgramWorkouts = (workouts, daysPerWeek = 4) => {
  const list = Array.isArray(workouts) ? workouts : [];
  if (!list.length) return [];

  const normalizedDaysPerWeek = clampWorkoutDays(daysPerWeek, 4);
  const weekdays = WEEKDAY_BY_DAYS_PER_WEEK[normalizedDaysPerWeek] || WEEKDAY_BY_DAYS_PER_WEEK[4];

  return list.map((workout, index) => {
    const order = Number(workout.day_order || index + 1);
    const withinWeekIndex = ((order - 1) % weekdays.length + weekdays.length) % weekdays.length;
    const fallbackDayName = weekdays[withinWeekIndex];
    const rawDayName = String(workout.day_name || '').toLowerCase().trim();
    const dayName = rawDayName || fallbackDayName;

    return {
      ...workout,
      day_order: order,
      day_name: dayName,
    };
  });
};

const getPreferredProgramType = (workoutDays) => {
  if (workoutDays <= 3) return 'full_body';
  if (workoutDays === 4) return 'upper_lower';
  if (workoutDays >= 6) return 'push_pull_legs';
  return 'custom';
};

const pickBestTemplateProgram = async (conn, { workoutDays, goal, experienceLevel }) => {
  const [rows] = await conn.execute(
    `SELECT id, name, program_type, goal, experience_level, days_per_week, cycle_weeks
     FROM programs
     WHERE is_template = 1 AND is_active = 1`,
  );

  if (!rows.length) return null;

  const preferredType = getPreferredProgramType(workoutDays);
  const scored = rows
    .map((row) => {
      let score = 100 - Math.abs(Number(row.days_per_week || 4) - workoutDays) * 25;
      if (row.program_type === preferredType) score += 25;
      if (goal && row.goal === goal) score += 20;
      if (!row.experience_level || row.experience_level === experienceLevel) score += 10;
      if (workoutDays >= 5 && row.program_type === 'custom') score += 5;
      return { row, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.row || null;
};

const assignProgramToUser = async (conn, { userId, programId, reason = 'user_request', note = null }) => {
  const rotationWeeks = 8;
  const startDate = new Date();
  const nextRotationDate = new Date(startDate);
  nextRotationDate.setDate(nextRotationDate.getDate() + rotationWeeks * 7);

  const startDateStr = formatDateISO(startDate);
  const nextRotationDateStr = formatDateISO(nextRotationDate);

  const [activeRows] = await conn.execute(
    `SELECT id, program_id
     FROM program_assignments
     WHERE user_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );

  const active = activeRows[0];
  if (active && Number(active.program_id) === Number(programId)) {
    await conn.execute(
      `UPDATE program_assignments
       SET start_date = ?, next_rotation_date = ?, rotation_weeks = ?, auto_rotate_enabled = 1,
           coach_override_allowed = 1, status = 'active', end_date = NULL, notes = ?
       WHERE id = ?`,
      [startDateStr, nextRotationDateStr, rotationWeeks, note, active.id],
    );
    return { assignmentId: active.id, replacedProgramId: null };
  }

  if (active) {
    await conn.execute(
      `UPDATE program_assignments
       SET status = 'archived', end_date = CURDATE()
       WHERE id = ?`,
      [active.id],
    );
  }

  const [insertResult] = await conn.execute(
    `INSERT INTO program_assignments
      (user_id, program_id, assigned_by_user_id, assignment_source, rotation_weeks, auto_rotate_enabled, coach_override_allowed, start_date, next_rotation_date, status, notes)
     VALUES (?, ?, NULL, 'ai', ?, 1, 1, ?, ?, 'active', ?)`,
    [userId, programId, rotationWeeks, startDateStr, nextRotationDateStr, note],
  );

  if (active) {
    await conn.execute(
      `INSERT INTO program_change_log
        (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      [insertResult.insertId, userId, active.program_id, programId, reason, note],
    );
  }

  return {
    assignmentId: insertResult.insertId,
    replacedProgramId: active ? active.program_id : null,
  };
};

const getCurrentWeek = (startDate, cycleWeeks) => {
  const start = new Date(startDate);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const rawWeek = Math.max(1, Math.floor((now - start) / msPerWeek) + 1);
  const maxWeeks = Math.max(1, Number(cycleWeeks || 1));
  return Math.min(rawWeek, maxWeeks);
};

const computeWorkoutStreak = (dateRows) => {
  if (!dateRows.length) return 0;

  const dates = new Set(dateRows.map((r) => formatDateISO(r.workout_date)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cursor = new Date(today);
  if (!dates.has(formatDateISO(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(formatDateISO(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

// =========================
// AUTH
// =========================

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let query = 'SELECT * FROM users WHERE email = ? AND password = ? LIMIT 1';
    const params = [email, password];

    // Admin login accepts only coach / gym_owner.
    if (role === 'admin') {
      query = "SELECT * FROM users WHERE email = ? AND password = ? AND role IN ('coach','gym_owner') LIMIT 1";
    } else if (role === 'user') {
      // User login must never allow coach or gym_owner accounts.
      query = "SELECT * FROM users WHERE email = ? AND password = ? AND role = 'user' LIMIT 1";
    }

    const [rows] = await pool.execute(query, params);
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = normalizeUser(rows[0]);

    // Coach dashboard reads these keys from localStorage.
    if (user.role === 'coach') {
      return res.json({
        success: true,
        user,
        coach: {
          id: user.id,
          name: user.name,
          gym: user.gym_id ? [user.gym_id] : [],
        },
      });
    }

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, role = 'user', coach_id = null, gym_id = null } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const derivedName = name || email.split('@')[0] || 'User';

    const [result] = await pool.execute(
      `INSERT INTO users (email, password, name, role, coach_id, gym_id, onboarding_completed, first_login)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
      [email, password, derivedName, role, coach_id || null, gym_id || null]
    );

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return res.json({ success: true, user: normalizeUser(rows[0]) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// GYMS / COACHES / USERS
// =========================

router.get('/gyms', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, address, phone, subscription_plan, status, is_active, created_at FROM gyms ORDER BY name'
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/gyms', async (req, res) => {
  try {
    const { name, email, password, address = null, phone = null, subscription_plan = 'basic' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO gyms (name, email, password, address, phone, subscription_plan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, password, address, phone, subscription_plan]
    );

    const [rows] = await pool.execute('SELECT * FROM gyms WHERE id = ?', [result.insertId]);
    return res.json({ success: true, gym: rows[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Gym email already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.get('/coaches', async (_req, res) => {
  try {
    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email, gym_id, experience_level, fitness_goal, ${profileImageColumn} AS profile_picture
       FROM users
       WHERE role = 'coach' AND is_active = 1
       ORDER BY name`
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/coaches', async (req, res) => {
  try {
    const { name, email, password, gym_id = null } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, role, gym_id, onboarding_completed, first_login)
       VALUES (?, ?, ?, 'coach', ?, 1, 0)`,
      [name, email, password, gym_id || null]
    );

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return res.json({ success: true, coach: normalizeUser(rows[0]) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Coach email already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email, role, gym_id, coach_id, ${profileImageColumn} AS profile_picture, total_points, total_workouts, rank, onboarding_completed
       FROM users
       WHERE role = 'user' AND is_active = 1
       ORDER BY created_at DESC`
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// USER ONBOARDING / PROFILE
// =========================

router.post('/user/onboarding', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      userId,
      age,
      gender,
      height,
      weight,
      primaryGoal,
      fitnessGoal,
      workoutDays,
      experienceLevel,
      gymId,
      gym_id,
    } = req.body;

    const normalizedUserId = toNumber(userId);
    if (!normalizedUserId) {
      await conn.rollback();
      return res.status(400).json({ error: 'Valid userId is required' });
    }

    const [userRows] = await conn.execute(
      `SELECT id, gym_id
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [normalizedUserId],
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const normalizedAge = toNumber(age, null);
    const normalizedHeight = toNumber(height, null);
    const normalizedWeight = toNumber(weight, null);
    const normalizedGender = normalizeGenderEnum(gender);
    const normalizedExperience = normalizeExperienceEnum(experienceLevel || req.body.experience_level);
    const fitnessGoalText = String(fitnessGoal || req.body.fitness_goal || primaryGoal || '').trim();
    const primaryGoalText = String(primaryGoal || fitnessGoalText || '').trim();
    const normalizedGoal = normalizeGoalEnum(fitnessGoalText || primaryGoalText);
    const normalizedDays = clampWorkoutDays(workoutDays, 4);
    const normalizedGymId = toNumber(gym_id || gymId, userRows[0].gym_id || null);

    await conn.execute(
      `UPDATE users
       SET age = ?,
           gender = ?,
           height_cm = ?,
           weight_kg = ?,
           primary_goal = ?,
           fitness_goal = ?,
           experience_level = ?,
           gym_id = ?,
           onboarding_completed = 1,
           first_login = 0
       WHERE id = ?`,
      [
        normalizedAge,
        normalizedGender,
        normalizedHeight,
        normalizedWeight,
        primaryGoalText || null,
        fitnessGoalText || null,
        normalizedExperience,
        normalizedGymId,
        normalizedUserId,
      ],
    );

    const selectedTemplate = await pickBestTemplateProgram(conn, {
      workoutDays: normalizedDays,
      goal: normalizedGoal,
      experienceLevel: normalizedExperience,
    });

    let assignmentInfo = null;
    if (selectedTemplate) {
      assignmentInfo = await assignProgramToUser(conn, {
        userId: normalizedUserId,
        programId: selectedTemplate.id,
        reason: 'user_request',
        note: `Auto-assigned from onboarding: goal=${normalizedGoal}, days=${normalizedDays}, level=${normalizedExperience || 'unknown'}`,
      });
    }

    await conn.commit();

    return res.json({
      success: true,
      assignedProgram: selectedTemplate
        ? {
            id: selectedTemplate.id,
            name: selectedTemplate.name,
            programType: selectedTemplate.program_type,
            goal: selectedTemplate.goal,
            daysPerWeek: selectedTemplate.days_per_week,
            cycleWeeks: selectedTemplate.cycle_weeks,
          }
        : null,
      assignment: assignmentInfo,
    });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

router.get('/profile/:userId/picture', async (req, res) => {
  try {
    const { userId } = req.params;
    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const [rows] = await pool.execute(`SELECT ${profileImageColumn} AS profile_picture FROM users WHERE id = ?`, [userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({ profilePicture: rows[0].profile_picture || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/profile/:userId/picture', async (req, res) => {
  try {
    const { userId } = req.params;
    const { profilePicture } = req.body;
    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const imageValue = profilePicture || null;
    if (imageValue != null && typeof imageValue !== 'string') {
      return res.status(400).json({ error: 'profilePicture must be a base64 data URL string' });
    }

    if (typeof imageValue === 'string' && !imageValue.startsWith('data:image/')) {
      return res.status(400).json({ error: 'profilePicture must start with data:image/' });
    }

    const maxLength = await getProfileImageColumnMaxLength(profileImageColumn);
    if (typeof imageValue === 'string' && maxLength && imageValue.length > maxLength) {
      return res.status(413).json({
        error: `Profile image is too large for DB column '${profileImageColumn}' (length ${imageValue.length}, max ${maxLength}).`,
      });
    }

    const [result] = await pool.execute(`UPDATE users SET ${profileImageColumn} = ? WHERE id = ?`, [imageValue, userId]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify persisted content matches what was sent (detect silent DB truncation).
    if (typeof imageValue === 'string') {
      const [rows] = await pool.execute(
        `SELECT ${profileImageColumn} AS profile_picture FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      const savedValue = rows[0]?.profile_picture || '';
      if (savedValue !== imageValue) {
        return res.status(500).json({
          error: `Profile image was not saved correctly (likely truncated). Increase users.${profileImageColumn} to LONGTEXT.`,
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// FRIENDS / INVITATIONS
// =========================

router.get('/user/:userId/gym-members', async (req, res) => {
  try {
    const { userId } = req.params;
    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const [userRows] = await pool.execute('SELECT gym_id FROM users WHERE id = ?', [userId]);
    const user = userRows[0];
    if (!user || !user.gym_id) {
      return res.json({ members: [] });
    }

    const [members] = await pool.execute(
      `SELECT id, name, gym_id, ${profileImageColumn} AS profile_picture, total_points, total_workouts, rank
       FROM users
       WHERE gym_id = ? AND id <> ? AND role = 'user' AND is_active = 1
       ORDER BY total_points DESC`,
      [user.gym_id, userId]
    );

    return res.json({ members });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/invitations/send', async (req, res) => {
  try {
    const { fromUserId, toUserId, date, time } = req.body;

    if (!fromUserId || !toUserId || !date || !time) {
      return res.status(400).json({ error: 'fromUserId, toUserId, date and time are required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO invitations (from_user_id, to_user_id, invitation_type, workout_date, workout_time, status)
       VALUES (?, ?, 'workout', ?, ?, 'pending')`,
      [fromUserId, toUserId, date, time]
    );

    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'friend_request', 'Workout Invitation', ?, JSON_OBJECT('invitationId', ?, 'fromUserId', ?, 'date', ?, 'time', ?))`,
      [toUserId, 'You received a workout invitation', result.insertId, fromUserId, date, time]
    );

    return res.json({ success: true, invitationId: result.insertId });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// PROGRAMS
// =========================

router.get('/user/:userId/program', async (req, res) => {
  try {
    const { userId } = req.params;

    const [assignmentRows] = await pool.execute(
      `SELECT pa.id, pa.program_id, pa.start_date, pa.next_rotation_date, pa.rotation_weeks,
              p.name, p.program_type, p.goal, p.days_per_week, p.cycle_weeks
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [userId]
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.json({
        id: null,
        name: 'No Program Assigned',
        currentWeek: 1,
        totalWeeks: 0,
        todayWorkout: null,
        workouts: [],
      });
    }

    const [workoutRows] = await pool.execute(
      `SELECT id, workout_name, workout_type, day_order, day_name, notes
       FROM workouts
       WHERE program_id = ?
       ORDER BY day_order ASC`,
      [assignment.program_id]
    );

    const [exerciseRows] = await pool.execute(
      `SELECT we.workout_id, we.order_index, we.exercise_name_snapshot, we.target_sets, we.target_reps, we.rest_seconds, we.notes
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       WHERE w.program_id = ?
       ORDER BY we.workout_id, we.order_index`,
      [assignment.program_id]
    );

    const exercisesByWorkout = new Map();
    exerciseRows.forEach((row) => {
      if (!exercisesByWorkout.has(row.workout_id)) exercisesByWorkout.set(row.workout_id, []);
      exercisesByWorkout.get(row.workout_id).push({
        exerciseName: row.exercise_name_snapshot,
        sets: row.target_sets,
        reps: row.target_reps,
        rest: row.rest_seconds,
        notes: row.notes,
      });
    });

    const workouts = normalizeProgramWorkouts(workoutRows.map((w) => ({
      id: w.id,
      workout_name: w.workout_name,
      workout_type: w.workout_type,
      day_order: w.day_order,
      day_name: w.day_name,
      notes: w.notes,
      exercises: JSON.stringify(exercisesByWorkout.get(w.id) || []),
    })), assignment.days_per_week);

    const now = new Date();
    const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);

    const workoutsPerWeek = Math.max(1, Number(assignment.days_per_week || 1));
    const currentWeekStartDayOrder = ((currentWeek - 1) * workoutsPerWeek) + 1;
    const currentWeekEndDayOrder = currentWeekStartDayOrder + workoutsPerWeek - 1;

    const currentWeekWorkouts = workouts.filter((w) => {
      const dayOrder = Number(w.day_order || 0);
      return dayOrder >= currentWeekStartDayOrder && dayOrder <= currentWeekEndDayOrder;
    });

    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayWorkout = currentWeekWorkouts.find((w) => w.day_name === dayName)
      || null;

    return res.json({
      id: assignment.program_id,
      assignmentId: assignment.id,
      name: assignment.name,
      programType: assignment.program_type,
      goal: assignment.goal,
      daysPerWeek: Number(assignment.days_per_week || 0),
      currentWeek,
      totalWeeks: assignment.cycle_weeks,
      rotationWeeks: assignment.rotation_weeks,
      nextRotationDate: assignment.next_rotation_date,
      todayWorkout: todayWorkout
        ? {
            name: todayWorkout.workout_name,
            workoutType: todayWorkout.workout_type,
            dayName: todayWorkout.day_name,
            exercises: JSON.parse(todayWorkout.exercises || '[]'),
          }
        : null,
      workouts,
      currentWeekWorkouts,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/user/:userId/program-progress', async (req, res) => {
  try {
    const { userId } = req.params;

    const [assignmentRows] = await pool.execute(
      `SELECT pa.id, pa.program_id, pa.start_date, pa.next_rotation_date, pa.rotation_weeks, pa.status,
              p.name, p.program_type, p.goal, p.days_per_week, p.cycle_weeks
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [userId],
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.json({
        hasActiveProgram: false,
        summary: {
          currentWeek: 1,
          totalWeeks: 0,
          completedWorkouts: 0,
          plannedWorkouts: 0,
          completionRate: 0,
          workoutsCompletedThisWeek: 0,
          workoutsPlannedThisWeek: 0,
          weeklyCompletionRate: 0,
          workoutStreakDays: 0,
          totalPoints: 0,
          rank: 'Bronze',
          volumeLoadLast30Days: 0,
          setsLoggedLast30Days: 0,
        },
      });
    }

    const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
    const plannedWorkouts = Number(assignment.cycle_weeks || 0) * Number(assignment.days_per_week || 0);
    const workoutsPlannedThisWeek = Number(assignment.days_per_week || 0);

    const weekStart = new Date(assignment.start_date);
    weekStart.setDate(weekStart.getDate() + ((currentWeek - 1) * 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const [completedRows] = await pool.execute(
      `SELECT COUNT(*) AS completed_workouts
       FROM workout_sessions
       WHERE user_id = ? AND program_assignment_id = ? AND status = 'completed'`,
      [userId, assignment.id],
    );

    const [weekCompletedRows] = await pool.execute(
      `SELECT COUNT(*) AS completed_week
       FROM workout_sessions
       WHERE user_id = ? AND program_assignment_id = ? AND status = 'completed'
         AND DATE(completed_at) BETWEEN ? AND ?`,
      [userId, assignment.id, formatDateISO(weekStart), formatDateISO(weekEnd)],
    );

    const [setCompletedRows] = await pool.execute(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS completed_days
       FROM workout_sets
       WHERE user_id = ?
         AND DATE(created_at) BETWEEN ? AND ?`,
      [userId, formatDateISO(new Date(assignment.start_date)), formatDateISO(new Date())],
    );

    const [setWeekCompletedRows] = await pool.execute(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS completed_days_week
       FROM workout_sets
       WHERE user_id = ?
         AND DATE(created_at) BETWEEN ? AND ?`,
      [userId, formatDateISO(weekStart), formatDateISO(weekEnd)],
    );

    const [volumeRows] = await pool.execute(
      `SELECT
          COUNT(*) AS sets_logged,
          COALESCE(SUM(CASE
            WHEN weight IS NOT NULL AND reps IS NOT NULL THEN (weight * reps)
            ELSE 0
          END), 0) AS volume_load
       FROM workout_sets
       WHERE user_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [userId],
    );

    const [streakRows] = await pool.execute(
      `SELECT DISTINCT DATE(completed_at) AS workout_date
       FROM workout_sessions
       WHERE user_id = ? AND status = 'completed'
       ORDER BY workout_date DESC
       LIMIT 60`,
      [userId],
    );

    const [userRows] = await pool.execute(
      `SELECT total_points, total_workouts, rank
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    const completedFromSessions = Number(completedRows[0]?.completed_workouts || 0);
    const completedWeekFromSessions = Number(weekCompletedRows[0]?.completed_week || 0);
    const completedFromSets = Number(setCompletedRows[0]?.completed_days || 0);
    const completedWeekFromSets = Number(setWeekCompletedRows[0]?.completed_days_week || 0);

    const completedWorkouts = completedFromSessions > 0 ? completedFromSessions : completedFromSets;
    const completedThisWeek = completedWeekFromSessions > 0 ? completedWeekFromSessions : completedWeekFromSets;
    const completionRate = plannedWorkouts > 0
      ? Math.round((completedWorkouts / plannedWorkouts) * 100)
      : 0;
    const weeklyCompletionRate = workoutsPlannedThisWeek > 0
      ? Math.round((completedThisWeek / workoutsPlannedThisWeek) * 100)
      : 0;

    return res.json({
      hasActiveProgram: true,
      program: {
        id: assignment.program_id,
        assignmentId: assignment.id,
        name: assignment.name,
        programType: assignment.program_type,
        goal: assignment.goal,
        daysPerWeek: assignment.days_per_week,
        cycleWeeks: assignment.cycle_weeks,
        rotationWeeks: assignment.rotation_weeks,
        nextRotationDate: assignment.next_rotation_date,
      },
      summary: {
        currentWeek,
        totalWeeks: Number(assignment.cycle_weeks || 0),
        completedWorkouts,
        plannedWorkouts,
        completionRate,
        workoutsCompletedThisWeek: completedThisWeek,
        workoutsPlannedThisWeek,
        weeklyCompletionRate,
        workoutStreakDays: computeWorkoutStreak(streakRows),
        totalPoints: Number(userRows[0]?.total_points || 0),
        totalWorkouts: Number(userRows[0]?.total_workouts || 0),
        rank: userRows[0]?.rank || 'Bronze',
        volumeLoadLast30Days: Number(volumeRows[0]?.volume_load || 0),
        setsLoggedLast30Days: Number(volumeRows[0]?.sets_logged || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// RECOVERY
// =========================

router.get('/user/:userId/recovery', async (req, res) => {
  try {
    const { userId } = req.params;

    const [factorRows] = await pool.execute(
      `SELECT
          u.age,
          rf.sleep_hours,
          rf.nutrition_quality,
          rf.stress_level,
          rf.protein_intake,
          rf.supplements
       FROM users u
       LEFT JOIN recovery_factors rf ON rf.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );

    const dbFactors = factorRows[0] || {};

    const [statusRows] = await pool.execute(
      `SELECT
          id,
          muscle_group,
          recovery_percentage,
          hours_needed,
          hours_elapsed,
          last_worked,
          overtraining_risk
       FROM muscle_recovery_status
       WHERE user_id = ?`,
      [userId],
    );

    const latestByMuscle = new Map();
    statusRows.forEach((row) => {
      const muscleName = normalizeMuscleName(row.muscle_group);
      if (!muscleName) return;

      const existing = latestByMuscle.get(muscleName);
      if (!existing || new Date(row.last_worked).getTime() > new Date(existing.last_worked).getTime()) {
        latestByMuscle.set(muscleName, row);
      }
    });

    const computedByMuscle = new Map();
    const updates = [];

    latestByMuscle.forEach((row, muscleName) => {
      const dynamic = calculateDynamicRecovery(row.last_worked, row.hours_needed);
      const overtrainingRisk = dynamic.score < 30 ? 1 : 0;

      computedByMuscle.set(muscleName, {
        muscle: muscleName.toLowerCase(),
        name: muscleName,
        score: dynamic.score,
        lastWorkout: row.last_worked,
        hoursNeeded: Number(row.hours_needed || 0),
        hoursElapsed: dynamic.hoursElapsed,
        overtrainingRisk: !!overtrainingRisk,
      });

      const storedScore = Math.round(Number(row.recovery_percentage || 0));
      const storedHoursElapsed = Number(row.hours_elapsed || 0);
      if (
        storedScore !== dynamic.score ||
        Math.abs(storedHoursElapsed - dynamic.hoursElapsed) > 0.01 ||
        Number(row.overtraining_risk || 0) !== overtrainingRisk
      ) {
        updates.push(
          pool.execute(
            `UPDATE muscle_recovery_status
             SET recovery_percentage = ?, hours_elapsed = ?, overtraining_risk = ?
             WHERE id = ?`,
            [dynamic.score, dynamic.hoursElapsed, overtrainingRisk, row.id],
          ),
        );
      }
    });

    if (updates.length) {
      await Promise.all(updates);
    }

    const recovery = TRACKED_MUSCLES.map((muscleName) => {
      const existing = computedByMuscle.get(muscleName);
      if (existing) return existing;
      return {
        muscle: muscleName.toLowerCase(),
        name: muscleName,
        score: 100,
        lastWorkout: null,
        hoursNeeded: 0,
        hoursElapsed: 0,
        overtrainingRisk: false,
      };
    });

    const overallRecovery = computeOverallRecovery(recovery);

    return res.json({
      factors: {
        sleepHours: dbFactors.sleep_hours != null ? String(dbFactors.sleep_hours) : '7',
        proteinIntake: dbFactors.protein_intake != null
          ? (Number(dbFactors.protein_intake) >= 1.6 ? 'high' : Number(dbFactors.protein_intake) >= 1.0 ? 'medium' : 'low')
          : 'medium',
        supplements: dbFactors.supplements || 'none',
        soreness: 3,
        energy: 3,
        nutrition_quality: dbFactors.nutrition_quality || 'optimal',
        stress_level: dbFactors.stress_level || 'low',
      },
      recovery,
      overallRecovery,
      summary: {
        readyMuscles: recovery.filter((m) => m.score >= 90).length,
        almostReadyMuscles: recovery.filter((m) => m.score >= 70 && m.score < 90).length,
        damagedMuscles: recovery.filter((m) => m.score < 70).length,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/user/:userId/recovery', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sleepHours, nutritionQuality, stressLevel, proteinIntake, supplements } = req.body;

    let normalizedProteinIntake = proteinIntake;
    if (typeof proteinIntake === 'string') {
      if (proteinIntake === 'low') normalizedProteinIntake = 0.8;
      else if (proteinIntake === 'medium') normalizedProteinIntake = 1.2;
      else if (proteinIntake === 'high') normalizedProteinIntake = 1.8;
      else normalizedProteinIntake = null;
    }

    const normalizedNutrition =
      nutritionQuality && ['optimal', 'suboptimal'].includes(nutritionQuality)
        ? nutritionQuality
        : 'optimal';

    const normalizedStress =
      stressLevel && ['low', 'moderate', 'high'].includes(stressLevel)
        ? stressLevel
        : 'low';

    await pool.execute(
      `INSERT INTO recovery_factors (user_id, sleep_hours, nutrition_quality, stress_level, protein_intake, supplements)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       sleep_hours = VALUES(sleep_hours),
       nutrition_quality = VALUES(nutrition_quality),
       stress_level = VALUES(stress_level),
       protein_intake = VALUES(protein_intake),
       supplements = VALUES(supplements)`,
      [userId, sleepHours || 7, normalizedNutrition, normalizedStress, normalizedProteinIntake, supplements || null]
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/user/:userId/recovery/recalculate-today', async (req, res) => {
  try {
    const { userId } = req.params;

    const [setRows] = await pool.execute(
      `SELECT
          exercise_name,
          COUNT(*) AS set_count,
          AVG(COALESCE(rpe, 7)) AS avg_rpe,
          MAX(created_at) AS last_logged_at
       FROM workout_sets
       WHERE user_id = ? AND DATE(created_at) = CURDATE() AND completed = 1
       GROUP BY exercise_name`,
      [userId],
    );

    if (!setRows.length) {
      return res.json({ success: true, muscles: [] });
    }

    const [factorRows] = await pool.execute(
      `SELECT
          u.age,
          rf.sleep_hours,
          rf.nutrition_quality,
          rf.stress_level,
          rf.protein_intake
       FROM users u
       LEFT JOIN recovery_factors rf ON rf.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );

    const factors = factorRows[0] || {};
    const byMuscle = new Map();

    setRows.forEach((row) => {
      const muscles = inferMusclesFromExerciseName(row.exercise_name);
      if (!muscles.length) return;

      const rpeValue = Number(row.avg_rpe);
      const inferredIntensity = Number.isFinite(rpeValue)
        ? (rpeValue >= 8 ? 'high' : rpeValue <= 5 ? 'low' : 'moderate')
        : 'moderate';

      const setCount = Number(row.set_count || 0);
      const inferredVolume = setCount >= 5
        ? 'high'
        : setCount <= 2
          ? 'low'
          : 'moderate';

      muscles.forEach((muscle) => {
        const hoursNeeded = calculateRecoveryHours({
          muscleGroup: muscle,
          intensity: inferredIntensity,
          volume: inferredVolume,
          eccentricFocus: false,
          age: factors.age ?? null,
          sleepHours: Number(factors.sleep_hours ?? 7),
          nutritionQuality: factors.nutrition_quality || 'optimal',
          stressLevel: factors.stress_level || 'moderate',
          proteinIntake: factors.protein_intake ?? null,
        });

        const existing = byMuscle.get(muscle);
        if (!existing) {
          byMuscle.set(muscle, {
            hoursNeeded,
            lastWorked: row.last_logged_at,
          });
          return;
        }

        byMuscle.set(muscle, {
          hoursNeeded: Math.max(existing.hoursNeeded, hoursNeeded),
          lastWorked: new Date(row.last_logged_at).getTime() > new Date(existing.lastWorked).getTime()
            ? row.last_logged_at
            : existing.lastWorked,
        });
      });
    });

    const updates = [];
    byMuscle.forEach((value, muscle) => {
      updates.push(
        pool.execute(
          `INSERT INTO muscle_recovery_status
             (user_id, muscle_group, recovery_percentage, hours_needed, hours_elapsed, last_worked)
           VALUES (?, ?, 0, ?, 0, ?)
           ON DUPLICATE KEY UPDATE
             recovery_percentage = 0,
             hours_needed = GREATEST(hours_needed, VALUES(hours_needed)),
             hours_elapsed = 0,
             last_worked = VALUES(last_worked)`,
          [userId, muscle, value.hoursNeeded, value.lastWorked],
        ),
      );
    });

    await Promise.all(updates);

    return res.json({
      success: true,
      muscles: Array.from(byMuscle.entries()).map(([muscle, value]) => ({
        muscle,
        hoursNeeded: value.hoursNeeded,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/workouts/:workoutId/recovery', async (req, res) => {
  try {
    const { workoutId } = req.params;
    const { userId } = req.body;

    const [workoutRows] = await pool.execute(
      'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ? LIMIT 1',
      [workoutId, userId]
    );

    if (!workoutRows.length) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const session = workoutRows[0];

    const [factorRows] = await pool.execute(
      `SELECT
          u.age,
          rf.sleep_hours,
          rf.nutrition_quality,
          rf.stress_level,
          rf.protein_intake
       FROM users u
       LEFT JOIN recovery_factors rf ON rf.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );

    const factors = factorRows[0] || {};

    const sessionMuscles = [
      ...parseMuscleGroups(session.muscle_groups),
      session.muscle_group,
    ];

    const muscles = [...new Set(sessionMuscles.map(normalizeMuscleName).filter(Boolean))];
    const targetMuscles = muscles.length ? muscles : ['Chest'];

    const perMuscle = [];
    for (const muscle of targetMuscles) {
      const recoveryHours = calculateRecoveryHours({
        muscleGroup: muscle,
        intensity: session.intensity || 'moderate',
        volume: session.volume || 'moderate',
        eccentricFocus: !!session.eccentric_focus,
        age: factors.age ?? null,
        sleepHours: Number(factors.sleep_hours ?? 7),
        nutritionQuality: factors.nutrition_quality || 'optimal',
        stressLevel: factors.stress_level || 'moderate',
        proteinIntake: factors.protein_intake ?? null,
      });

      await pool.execute(
        `INSERT INTO muscle_recovery_status
           (user_id, muscle_group, recovery_percentage, hours_needed, hours_elapsed, last_worked)
         VALUES (?, ?, 0, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
           recovery_percentage = 0,
           hours_needed = GREATEST(hours_needed, VALUES(hours_needed)),
           hours_elapsed = 0,
           last_worked = VALUES(last_worked)`,
        [userId, muscle, recoveryHours, session.completed_at],
      );

      perMuscle.push({ muscle, recoveryHours });
    }

    return res.json({ success: true, muscles: perMuscle });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// MESSAGES
// =========================

router.get('/messages/:userId/:coachId', async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    const coachId = toNumber(req.params.coachId);

    const [rows] = await pool.execute(
      `SELECT id, sender_id, receiver_id, sender_type, receiver_type, message, is_read, created_at
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`,
      [userId, coachId, coachId, userId]
    );

    const messages = rows.map((m) => ({
      ...m,
      read: !!m.is_read,
    }));

    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/messages/read/:coachId/:userId', async (req, res) => {
  try {
    const coachId = toNumber(req.params.coachId);
    const userId = toNumber(req.params.userId);

    await pool.execute(
      `UPDATE messages
       SET is_read = 1, read_at = NOW()
       WHERE sender_id = ? AND receiver_id = ? AND sender_type = 'user' AND receiver_type = 'coach' AND is_read = 0`,
      [userId, coachId]
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/messages/read-user/:userId/:coachId', async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    const coachId = toNumber(req.params.coachId);

    await pool.execute(
      `UPDATE messages
       SET is_read = 1, read_at = NOW()
       WHERE sender_id = ? AND receiver_id = ? AND sender_type = 'coach' AND receiver_type = 'user' AND is_read = 0`,
      [coachId, userId]
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// NOTIFICATIONS
// =========================

router.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.execute(
      `SELECT id, user_id, type, title, message, data, is_read, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    const notifications = rows.map((n) => ({
      ...n,
      unread: !n.is_read,
    }));

    return res.json(notifications);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    await pool.execute('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?', [notificationId]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// MISSIONS
// =========================

router.get('/missions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.execute(
      `SELECT
          m.id,
          m.title,
          m.description,
          m.points_reward,
          COALESCE(um.current_progress, 0) AS progress,
          COALESCE(um.target_value, m.target_value) AS target,
          CASE WHEN COALESCE(um.status, 'active') = 'completed' THEN 1 ELSE 0 END AS completed,
          GREATEST(COALESCE(um.target_value, m.target_value) - COALESCE(um.current_progress, 0), 0) AS remaining,
          um.completed_at,
          um.status
       FROM missions m
       LEFT JOIN user_missions um
         ON um.mission_id = m.id AND um.user_id = ?
       WHERE m.is_active = 1
       ORDER BY m.id ASC`,
      [userId]
    );

    return res.json(rows.map((r) => ({ ...r, completed: !!r.completed })));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/missions/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.execute(
      `SELECT m.title, m.points_reward, um.completed_at,
              DATE_FORMAT(um.completed_at, '%M %Y') AS period
       FROM user_missions um
       JOIN missions m ON m.id = um.mission_id
       WHERE um.user_id = ? AND um.status = 'completed' AND um.completed_at IS NOT NULL
       ORDER BY um.completed_at DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// WORKOUT SETS / HISTORY
// =========================

router.post('/workout-sets', async (req, res) => {
  try {
    const {
      userId,
      sessionId = null,
      workoutExerciseId = null,
      exerciseName,
      setNumber,
      weight,
      reps,
      rpe = null,
      duration = null,
      restTime = null,
      completed = true,
      notes = null,
      applyRecovery = false,
    } = req.body;

    if (!userId || !exerciseName || !setNumber) {
      return res.status(400).json({ error: 'userId, exerciseName and setNumber are required' });
    }

    await pool.execute(
      `INSERT INTO workout_sets
         (user_id, session_id, workout_exercise_id, exercise_name, set_number, weight, reps, rpe, duration_seconds, rest_seconds, completed, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         weight = VALUES(weight),
         reps = VALUES(reps),
         rpe = VALUES(rpe),
         duration_seconds = VALUES(duration_seconds),
         rest_seconds = VALUES(rest_seconds),
         completed = VALUES(completed),
         notes = VALUES(notes)`,
      [userId, sessionId, workoutExerciseId, exerciseName, setNumber, weight || null, reps || null, rpe, duration, restTime, completed ? 1 : 0, notes]
    );

    // Optional recovery rebuild (used only when explicitly requested).
    if (completed && applyRecovery === true) {
      const muscles = inferMusclesFromExerciseName(exerciseName);
      if (muscles.length) {
        const [factorRows] = await pool.execute(
          `SELECT
              u.age,
              rf.sleep_hours,
              rf.nutrition_quality,
              rf.stress_level,
              rf.protein_intake
           FROM users u
           LEFT JOIN recovery_factors rf ON rf.user_id = u.id
           WHERE u.id = ?
           LIMIT 1`,
          [userId],
        );

        const factors = factorRows[0] || {};
        const rpeValue = Number(rpe);
        const inferredIntensity = Number.isFinite(rpeValue)
          ? (rpeValue >= 8 ? 'high' : rpeValue <= 5 ? 'low' : 'moderate')
          : 'moderate';
        const inferredVolume = Number(setNumber) >= 5
          ? 'high'
          : Number(setNumber) <= 2
            ? 'low'
            : 'moderate';

        await Promise.all(
          muscles.map(async (muscle) => {
            const hoursNeeded = calculateRecoveryHours({
              muscleGroup: muscle,
              intensity: inferredIntensity,
              volume: inferredVolume,
              eccentricFocus: false,
              age: factors.age ?? null,
              sleepHours: Number(factors.sleep_hours ?? 7),
              nutritionQuality: factors.nutrition_quality || 'optimal',
              stressLevel: factors.stress_level || 'moderate',
              proteinIntake: factors.protein_intake ?? null,
            });

            await pool.execute(
              `INSERT INTO muscle_recovery_status
                 (user_id, muscle_group, recovery_percentage, hours_needed, hours_elapsed, last_worked)
               VALUES (?, ?, 0, ?, 0, NOW())
               ON DUPLICATE KEY UPDATE
                 recovery_percentage = 0,
                 hours_needed = GREATEST(hours_needed, VALUES(hours_needed)),
                 hours_elapsed = 0,
                 last_worked = NOW()`,
              [userId, muscle, hoursNeeded],
            );
          }),
        );
      }
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/workout-sets/:userId/:exerciseName', async (req, res) => {
  try {
    const { userId, exerciseName } = req.params;

    const [rows] = await pool.execute(
      `SELECT id, user_id, session_id, exercise_name, set_number, weight, reps, rpe, duration_seconds, rest_seconds, completed, notes, created_at
       FROM workout_sets
       WHERE user_id = ? AND exercise_name = ?
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId, decodeURIComponent(exerciseName)]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/workout-sets/today/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.execute(
      `SELECT exercise_name, MAX(created_at) AS last_logged_at
       FROM workout_sets
       WHERE user_id = ? AND DATE(created_at) = CURDATE() AND completed = 1
       GROUP BY exercise_name`,
      [userId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
