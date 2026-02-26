/* eslint-env node */

const GOAL_PRESETS = {
  hypertrophy: { repRange: [8, 12], restSeconds: 90, rpeBase: 7.5, setBase: 3 },
  strength: { repRange: [4, 7], restSeconds: 180, rpeBase: 8.0, setBase: 4 },
  fat_loss: { repRange: [10, 15], restSeconds: 60, rpeBase: 7.0, setBase: 3 },
  recomposition: { repRange: [6, 12], restSeconds: 90, rpeBase: 7.5, setBase: 3 },
  endurance: { repRange: [12, 18], restSeconds: 45, rpeBase: 6.5, setBase: 2 },
  general_fitness: { repRange: [8, 14], restSeconds: 75, rpeBase: 7.0, setBase: 3 },
};

const LEVEL_CONFIG = {
  beginner: { exercisesPerDay: 5, volumeFactor: 0.9 },
  intermediate: { exercisesPerDay: 6, volumeFactor: 1.0 },
  advanced: { exercisesPerDay: 7, volumeFactor: 1.1 },
};

const BLOCK_MULTIPLIERS = [1.0, 1.1, 1.2, 0.9, 1.15, 1.25];

const WEEKDAY_BY_DAYS_PER_WEEK = {
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
};

const normalizeMuscleGroup = (raw) => {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return 'Other';
  if (/(chest|pector)/.test(key)) return 'Chest';
  if (/(back|lat|trap|rhomboid|erector)/.test(key)) return 'Back';
  if (/(quad|hamstring|glute|calf|leg)/.test(key)) return 'Legs';
  if (/(shoulder|delt)/.test(key)) return 'Shoulders';
  if (/(bicep|tricep|forearm|arm)/.test(key)) return 'Arms';
  if (/(abs|abdom|core|oblique)/.test(key)) return 'Abs';
  return 'Other';
};

const normalizeEquipment = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const levelRank = (level) => {
  if (level === 'beginner') return 1;
  if (level === 'intermediate') return 2;
  if (level === 'advanced') return 3;
  return 2;
};

const toProgramType = (daysPerWeek) => {
  if (daysPerWeek <= 3) return 'full_body';
  if (daysPerWeek === 4) return 'upper_lower';
  if (daysPerWeek >= 6) return 'push_pull_legs';
  return 'custom';
};

const splitByDays = (daysPerWeek) => {
  if (daysPerWeek <= 2) {
    return [
      { name: 'Full Body A', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      { name: 'Full Body B', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Chest', 'Arms', 'Abs'] },
    ];
  }

  if (daysPerWeek === 3) {
    return [
      { name: 'Full Body A', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      { name: 'Full Body B', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Chest', 'Arms', 'Abs'] },
      { name: 'Full Body C', primary: ['Legs', 'Chest', 'Arms'], secondary: ['Back', 'Shoulders', 'Abs'] },
    ];
  }

  if (daysPerWeek === 4) {
    return [
      { name: 'Upper Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Lower A', primary: ['Legs'], secondary: ['Abs', 'Back'] },
      { name: 'Upper Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
      { name: 'Lower B', primary: ['Legs'], secondary: ['Abs', 'Chest'] },
    ];
  }

  if (daysPerWeek === 5) {
    return [
      { name: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Lower A', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
      { name: 'Lower B', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Upper Mix', primary: ['Chest', 'Back', 'Shoulders'], secondary: ['Arms', 'Abs'] },
    ];
  }

  return [
    { name: 'Push A', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
    { name: 'Pull A', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
    { name: 'Legs A', primary: ['Legs'], secondary: ['Abs'] },
    { name: 'Push B', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
    { name: 'Pull B', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
    { name: 'Legs B', primary: ['Legs'], secondary: ['Abs'] },
  ];
};

const parseEquipmentPreferences = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((e) => normalizeEquipment(e)).filter(Boolean);
  if (typeof input === 'string') {
    return input
      .split(/[,;/|]+/)
      .map((e) => normalizeEquipment(e))
      .filter(Boolean);
  }
  return [];
};

const pickUniqueExercises = ({ pool, fallbackPool, count, usedNames, lastDayPrimaryMuscles, dayPrimaryMuscles }) => {
  const selected = [];
  const used = new Set(usedNames);
  const preferred = pool.filter((ex) => !used.has(ex.normalizedName));
  const reserve = fallbackPool.filter((ex) => !used.has(ex.normalizedName));

  const candidates = [...preferred, ...reserve];
  for (const ex of candidates) {
    if (selected.length >= count) break;
    const primaryConflict = ex.primaryMuscle && lastDayPrimaryMuscles.has(ex.primaryMuscle) && dayPrimaryMuscles.has(ex.primaryMuscle);
    if (primaryConflict) continue;
    selected.push(ex);
    used.add(ex.normalizedName);
  }

  return selected;
};

const loadCatalogPool = async (conn, { userLevel, equipmentPrefs }) => {
  const [rows] = await conn.execute(
    `SELECT id, canonical_name, normalized_name, body_part, equipment, level, exercise_type, is_stretch
     FROM exercise_catalog
     WHERE is_active = 1`,
  );

  const allowedEquipment = new Set(equipmentPrefs);
  const hasEquipmentRestriction = allowedEquipment.size > 0;
  const userLevelRank = levelRank(userLevel);

  return rows
    .map((row) => ({
      id: Number(row.id),
      name: row.canonical_name,
      normalizedName: normalizeName(row.normalized_name || row.canonical_name),
      primaryMuscle: normalizeMuscleGroup(row.body_part),
      equipment: normalizeEquipment(row.equipment),
      level: String(row.level || '').toLowerCase(),
      isStretch: Number(row.is_stretch || 0) === 1 || /stretch/i.test(String(row.exercise_type || '')),
    }))
    .filter((ex) => !ex.isStretch)
    .filter((ex) => {
      if (!hasEquipmentRestriction) return true;
      if (!ex.equipment) return true;
      if (ex.equipment === 'body only') return true;
      return allowedEquipment.has(ex.equipment);
    })
    .filter((ex) => {
      if (!ex.level) return true;
      return levelRank(ex.level) <= Math.max(userLevelRank + 1, 2);
    });
};

const ensureLegacyExerciseId = async (conn, cache, exerciseName) => {
  const key = normalizeName(exerciseName);
  if (cache.has(key)) return cache.get(key);

  const [rows] = await conn.execute(
    `SELECT id
     FROM exercises
     WHERE LOWER(TRIM(name)) = ?
     LIMIT 1`,
    [key],
  );
  const id = rows[0]?.id ? Number(rows[0].id) : null;
  cache.set(key, id);
  return id;
};

const programProgressionForWeek = ({ week, goal, level, adjustment }) => {
  const preset = GOAL_PRESETS[goal] || GOAL_PRESETS.general_fitness;
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.intermediate;
  const blockIndex = Math.floor((week - 1) / 2);
  const blockMultiplier = BLOCK_MULTIPLIERS[Math.min(blockIndex, BLOCK_MULTIPLIERS.length - 1)] || 1.0;

  const baseSets = preset.setBase * cfg.volumeFactor;
  const sets = Math.max(2, Math.min(6, Math.round((baseSets * blockMultiplier) + (adjustment.setDelta || 0))));
  const rpe = Math.max(6.0, Math.min(9.5, Number((preset.rpeBase + (adjustment.rpeDelta || 0)).toFixed(1))));
  const reps = `${preset.repRange[0]}-${preset.repRange[1]}`;
  return { sets, rpe, reps, restSeconds: preset.restSeconds };
};

export const generatePersonalizedProgram = async (
  conn,
  {
    userId,
    gymId = null,
    goal = 'general_fitness',
    experienceLevel = 'intermediate',
    daysPerWeek = 4,
    cycleWeeks = 12,
    equipment = null,
    notes = null,
  },
) => {
  const clampedDays = Math.max(2, Math.min(6, Number(daysPerWeek) || 4));
  const clampedWeeks = Math.max(8, Math.min(24, Number(cycleWeeks) || 12));
  const normalizedGoal = String(goal || 'general_fitness');
  const normalizedLevel = String(experienceLevel || 'intermediate');
  const equipmentPrefs = parseEquipmentPreferences(equipment);

  const pool = await loadCatalogPool(conn, { userLevel: normalizedLevel, equipmentPrefs });
  if (pool.length < 30) {
    throw new Error(`Not enough exercises after equipment/level filtering (${pool.length} found).`);
  }

  const split = splitByDays(clampedDays);
  const weekdays = WEEKDAY_BY_DAYS_PER_WEEK[clampedDays] || WEEKDAY_BY_DAYS_PER_WEEK[4];
  const cfg = LEVEL_CONFIG[normalizedLevel] || LEVEL_CONFIG.intermediate;

  const [insertProgram] = await conn.execute(
    `INSERT INTO programs
      (gym_id, created_by_user_id, target_user_id, name, description, program_type, goal, experience_level, days_per_week, cycle_weeks, is_template, is_active)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    [
      gymId || null,
      userId,
      `${clampedWeeks}-Week Personalized Plan`,
      notes || `Generated from onboarding (goal=${normalizedGoal}, level=${normalizedLevel}, days=${clampedDays}).`,
      toProgramType(clampedDays),
      normalizedGoal,
      normalizedLevel,
      clampedDays,
      clampedWeeks,
    ],
  );

  const programId = Number(insertProgram.insertId);
  const legacyExerciseCache = new Map();
  let dayOrder = 0;
  const usedPerWeek = new Set();
  let lastDayPrimaryMuscles = new Set();

  for (let week = 1; week <= clampedWeeks; week += 1) {
    if ((week - 1) % 1 === 0) {
      usedPerWeek.clear();
    }

    for (let dayIdx = 0; dayIdx < split.length; dayIdx += 1) {
      const day = split[dayIdx];
      dayOrder += 1;
      const dayName = weekdays[dayIdx % weekdays.length];
      const dayPrimaryMuscles = new Set(day.primary);

      const dayPool = pool.filter((ex) => dayPrimaryMuscles.has(ex.primaryMuscle));
      const daySecondaryPool = pool.filter((ex) => day.secondary.includes(ex.primaryMuscle));

      const selection = pickUniqueExercises({
        pool: [...dayPool, ...daySecondaryPool],
        fallbackPool: pool,
        count: cfg.exercisesPerDay,
        usedNames: usedPerWeek,
        lastDayPrimaryMuscles,
        dayPrimaryMuscles,
      });

      if (selection.length < Math.max(4, cfg.exercisesPerDay - 1)) {
        throw new Error(`Could not satisfy exercise selection constraints for week ${week}, day ${day.name}.`);
      }

      const [workoutIns] = await conn.execute(
        `INSERT INTO workouts
          (program_id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          programId,
          `Week ${week} - ${day.name}`,
          day.primary[0] === 'Legs' ? 'Lower Body' : 'Upper Body',
          dayOrder,
          dayName,
          cfg.exercisesPerDay * 10 + 20,
          `Focus: ${day.primary.join(', ')}`,
        ],
      );
      const workoutId = Number(workoutIns.insertId);

      const progression = programProgressionForWeek({
        week,
        goal: normalizedGoal,
        level: normalizedLevel,
        adjustment: { setDelta: 0, rpeDelta: 0 },
      });

      for (let idx = 0; idx < selection.length; idx += 1) {
        const ex = selection[idx];
        usedPerWeek.add(ex.normalizedName);
        const legacyExerciseId = await ensureLegacyExerciseId(conn, legacyExerciseCache, ex.name);

        await conn.execute(
          `INSERT INTO workout_exercises
            (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, NULL)`,
          [
            workoutId,
            legacyExerciseId,
            idx + 1,
            ex.name,
            ex.primaryMuscle,
            progression.sets,
            progression.reps,
            progression.restSeconds,
            progression.rpe,
          ],
        );
      }

      lastDayPrimaryMuscles = dayPrimaryMuscles;
    }
  }

  return {
    programId,
    daysPerWeek: clampedDays,
    cycleWeeks: clampedWeeks,
    name: `${clampedWeeks}-Week Personalized Plan`,
    programType: toProgramType(clampedDays),
    goal: normalizedGoal,
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

export const adaptProgramBiWeekly = async (conn, { userId, trigger = 'manual' }) => {
  const [assignmentRows] = await conn.execute(
    `SELECT pa.id, pa.program_id, pa.start_date, pa.status, p.days_per_week, p.cycle_weeks
     FROM program_assignments pa
     JOIN programs p ON p.id = pa.program_id
     WHERE pa.user_id = ? AND pa.status = 'active'
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [userId],
  );

  if (!assignmentRows.length) {
    return { adapted: false, reason: 'No active assignment' };
  }

  const assignment = assignmentRows[0];
  const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
  const biWeeklyBlock = Math.max(1, Math.ceil(currentWeek / 2));

  const [existingLogRows] = await conn.execute(
    `SELECT id
     FROM program_change_log
     WHERE assignment_id = ?
       AND change_reason = 'user_request'
       AND notes = ?
     LIMIT 1`,
    [assignment.id, `biweekly_auto:block=${biWeeklyBlock}`],
  );
  if (existingLogRows.length) {
    return {
      adapted: false,
      reason: `Block ${biWeeklyBlock} already adapted`,
      block: biWeeklyBlock,
    };
  }
  const pastTwoWeeksStart = new Date();
  pastTwoWeeksStart.setDate(pastTwoWeeksStart.getDate() - 14);

  const [plannedRows] = await conn.execute(
    `SELECT COUNT(*) AS c
     FROM workouts
     WHERE program_id = ?
       AND day_order BETWEEN ? AND ?`,
    [assignment.program_id, Math.max(1, (currentWeek - 2) * Number(assignment.days_per_week || 4) + 1), currentWeek * Number(assignment.days_per_week || 4)],
  );
  const plannedSessions = Number(plannedRows[0]?.c || 0);

  const [completedRows] = await conn.execute(
    `SELECT COUNT(DISTINCT DATE(created_at)) AS c
     FROM workout_sets
     WHERE user_id = ?
       AND completed = 1
       AND created_at >= ?`,
    [userId, pastTwoWeeksStart],
  );
  const completedSessions = Number(completedRows[0]?.c || 0);
  const completionRate = plannedSessions > 0 ? completedSessions / plannedSessions : 0;

  const [rpeRows] = await conn.execute(
    `SELECT AVG(rpe) AS avg_rpe
     FROM workout_sets
     WHERE user_id = ?
       AND completed = 1
       AND rpe IS NOT NULL
       AND created_at >= ?`,
    [userId, pastTwoWeeksStart],
  );
  const avgRpe = Number(rpeRows[0]?.avg_rpe || 7.5);

  const [recoveryRows] = await conn.execute(
    `SELECT AVG(recovery_percentage) AS avg_recovery
     FROM muscle_recovery_status
     WHERE user_id = ?`,
    [userId],
  );
  const avgRecovery = Number(recoveryRows[0]?.avg_recovery || 75);

  let setDelta = 0;
  let rpeDelta = 0;
  if (completionRate < 0.6 || avgRecovery < 65 || avgRpe >= 8.8) {
    setDelta = -1;
    rpeDelta = -0.4;
  } else if (completionRate > 0.85 && avgRecovery > 80 && avgRpe <= 7.6) {
    setDelta = 1;
    rpeDelta = 0.3;
  }

  if (!setDelta && !rpeDelta) {
    try {
      await conn.execute(
        `INSERT INTO program_change_log
          (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
         VALUES (?, ?, ?, ?, NULL, 'user_request', ?)`,
        [assignment.id, userId, assignment.program_id, assignment.program_id, `biweekly_auto:block=${biWeeklyBlock}`],
      );
    } catch {
      // If change-log insert is unavailable, adaptation remains a no-op.
    }
    return {
      adapted: false,
      reason: 'Metrics in target range',
      block: biWeeklyBlock,
      metrics: { completionRate, avgRpe, avgRecovery },
    };
  }

  await conn.execute(
    `UPDATE workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     SET
       we.target_sets = LEAST(8, GREATEST(1, COALESCE(we.target_sets, 3) + ?)),
       we.rpe_target = LEAST(9.5, GREATEST(6.0, COALESCE(we.rpe_target, 7.5) + ?))
     WHERE w.program_id = ?
       AND w.day_order > ?`,
    [setDelta, rpeDelta, assignment.program_id, currentWeek * Number(assignment.days_per_week || 4)],
  );

  try {
    await conn.execute(
      `INSERT INTO program_change_log
        (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
       VALUES (?, ?, ?, ?, NULL, 'user_request', ?)`,
      [assignment.id, userId, assignment.program_id, assignment.program_id, `biweekly_auto:block=${biWeeklyBlock};trigger=${trigger};setDelta=${setDelta};rpeDelta=${rpeDelta}`],
    );
  } catch {
    // Non-fatal: adaptation already persisted in workout_exercises.
  }

  return {
    adapted: true,
    block: biWeeklyBlock,
    metrics: { completionRate, avgRpe, avgRecovery },
    adjustment: { setDelta, rpeDelta },
    assignmentId: Number(assignment.id),
    programId: Number(assignment.program_id),
  };
};
