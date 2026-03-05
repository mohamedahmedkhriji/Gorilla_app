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

const WEEKLY_ADAPTATION_EXPERIMENT_KEY = 'weekly_adaptation_thresholds_v1';

const WEEKLY_ADJUSTMENT_THRESHOLDS = {
  criticalRiskMin: 80,
  criticalReadinessMax: 35,
  highRiskMin: 65,
  highReadinessMax: 50,
  highRecoveryMax: 55,
  progressionReadinessMin: 78,
  progressionRecoveryMin: 75,
  progressionRiskMax: 40,
  progressionConfidenceMin: 60,
  progressionGuardConfidenceMin: 45,
};

const DEFAULT_WEEKLY_THRESHOLD_VARIANTS = [
  {
    variantKey: 'control',
    allocationPct: 50,
    thresholds: { ...WEEKLY_ADJUSTMENT_THRESHOLDS },
  },
  {
    variantKey: 'conservative_guard',
    allocationPct: 25,
    thresholds: {
      criticalRiskMin: 78,
      criticalReadinessMax: 38,
      highRiskMin: 60,
      highReadinessMax: 55,
      highRecoveryMax: 58,
      progressionReadinessMin: 82,
      progressionRecoveryMin: 78,
      progressionRiskMax: 35,
      progressionConfidenceMin: 65,
      progressionGuardConfidenceMin: 50,
    },
  },
  {
    variantKey: 'progressive_load',
    allocationPct: 25,
    thresholds: {
      criticalRiskMin: 85,
      criticalReadinessMax: 30,
      highRiskMin: 70,
      highReadinessMax: 45,
      highRecoveryMax: 50,
      progressionReadinessMin: 74,
      progressionRecoveryMin: 70,
      progressionRiskMax: 45,
      progressionConfidenceMin: 55,
      progressionGuardConfidenceMin: 40,
    },
  },
];

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
  const clampedWeeks = Math.max(8, Math.min(16, Number(cycleWeeks) || 12));
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

const toFiniteNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const safeParseJson = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

const hasTable = async (conn, tableName) => {
  const [rows] = await conn.execute(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?
     LIMIT 1`,
    [String(tableName || '').trim()],
  );
  return rows.length > 0;
};

const toISODate = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const shiftISODate = (isoDate, deltaDays = 0) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(deltaDays || 0));
  return date.toISOString().slice(0, 10);
};

const stableHash = (input) => {
  const str = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const normalizeThresholds = (raw = {}) => {
  const normalized = { ...WEEKLY_ADJUSTMENT_THRESHOLDS };
  Object.keys(normalized).forEach((key) => {
    const next = Number(raw?.[key]);
    if (Number.isFinite(next)) normalized[key] = next;
  });
  return normalized;
};

const normalizeVariantConfig = (variant = {}) => {
  const variantKey = String(variant.variantKey || variant.variant_key || '').trim().toLowerCase() || 'control';
  const allocationRaw = Number(variant.allocationPct ?? variant.allocation_pct ?? variant.traffic_allocation_pct ?? 0);
  const allocationPct = Number.isFinite(allocationRaw) && allocationRaw >= 0 ? allocationRaw : 0;
  return {
    variantKey,
    allocationPct,
    thresholds: normalizeThresholds(variant.thresholds || variant.thresholds_json || {}),
  };
};

const getDefaultVariantConfigs = () =>
  DEFAULT_WEEKLY_THRESHOLD_VARIANTS.map((variant) => normalizeVariantConfig(variant));

const pickVariantFromBucket = (variants, bucket0to99) => {
  const normalized = variants.length ? variants : getDefaultVariantConfigs();
  const total = normalized.reduce((sum, item) => sum + Math.max(0, Number(item.allocationPct || 0)), 0);
  const safeTotal = total > 0 ? total : normalized.length;
  const scaledBucket = ((Number(bucket0to99 || 0) % 100) / 100) * safeTotal;

  let acc = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const weight = total > 0 ? Math.max(0, Number(normalized[i].allocationPct || 0)) : 1;
    acc += weight;
    if (scaledBucket < acc) return normalized[i];
  }
  return normalized[normalized.length - 1];
};

const getExperimentVariants = async (conn, experimentKey) => {
  const normalizedKey = String(experimentKey || '').trim();
  if (!normalizedKey) return getDefaultVariantConfigs();

  const hasExperimentTable = await hasTable(conn, 'scoring_threshold_experiments');
  if (!hasExperimentTable) return getDefaultVariantConfigs();

  try {
    const [rows] = await conn.execute(
      `SELECT variant_key, traffic_allocation_pct, thresholds_json
       FROM scoring_threshold_experiments
       WHERE experiment_key = ?
         AND is_active = 1
       ORDER BY id ASC`,
      [normalizedKey],
    );
    if (!rows.length) return getDefaultVariantConfigs();

    const variants = rows
      .map((row) => normalizeVariantConfig({
        variantKey: row.variant_key,
        allocationPct: row.traffic_allocation_pct,
        thresholds: safeParseJson(row.thresholds_json, {}),
      }))
      .filter((row) => row.variantKey);

    return variants.length ? variants : getDefaultVariantConfigs();
  } catch {
    return getDefaultVariantConfigs();
  }
};

const getWeeklyExperimentForUser = async (conn, userId) => {
  const experimentKey = WEEKLY_ADAPTATION_EXPERIMENT_KEY;
  const variants = await getExperimentVariants(conn, experimentKey);
  const variantByKey = new Map(variants.map((variant) => [variant.variantKey, variant]));
  const bucket = stableHash(`${experimentKey}:${userId}`) % 100;
  const bucketVariant = pickVariantFromBucket(variants, bucket);

  const hasAssignmentTable = await hasTable(conn, 'user_scoring_experiment_assignments');
  if (!hasAssignmentTable) {
    return {
      experimentKey,
      variantKey: bucketVariant.variantKey,
      thresholds: bucketVariant.thresholds,
      assignmentSource: 'hash',
    };
  }

  try {
    const [existingRows] = await conn.execute(
      `SELECT variant_key
       FROM user_scoring_experiment_assignments
       WHERE user_id = ?
         AND experiment_key = ?
       LIMIT 1`,
      [userId, experimentKey],
    );
    if (existingRows.length) {
      const existingKey = String(existingRows[0].variant_key || '').trim().toLowerCase();
      const existingVariant = variantByKey.get(existingKey) || bucketVariant;
      return {
        experimentKey,
        variantKey: existingVariant.variantKey,
        thresholds: existingVariant.thresholds,
        assignmentSource: 'persisted',
      };
    }

    await conn.execute(
      `INSERT INTO user_scoring_experiment_assignments
         (user_id, experiment_key, variant_key, metadata_json)
       VALUES (?, ?, ?, ?)`,
      [userId, experimentKey, bucketVariant.variantKey, JSON.stringify({ bucket })],
    );

    return {
      experimentKey,
      variantKey: bucketVariant.variantKey,
      thresholds: bucketVariant.thresholds,
      assignmentSource: 'persisted',
    };
  } catch {
    return {
      experimentKey,
      variantKey: bucketVariant.variantKey,
      thresholds: bucketVariant.thresholds,
      assignmentSource: 'hash',
    };
  }
};

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const toRounded = (value, digits = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
};

const percentChange = (currentValue, previousValue) => {
  const current = Number(currentValue);
  const previous = Number(previousValue);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return toRounded(((current - previous) / previous) * 100, 2);
};

const toOutcomeBand = ({ adherencePct, avgRiskScore, performanceDeltaPct }) => {
  const adherence = Number(adherencePct || 0);
  const risk = Number.isFinite(Number(avgRiskScore)) ? Number(avgRiskScore) : null;
  const progress = Number.isFinite(Number(performanceDeltaPct)) ? Number(performanceDeltaPct) : null;

  if (adherence < 55 || (risk != null && risk >= 75)) return 'poor';
  if (adherence >= 85 && (risk == null || risk <= 55) && (progress == null || progress >= 5)) return 'excellent';
  if (adherence >= 70 && (progress == null || progress >= 0) && (risk == null || risk <= 65)) return 'positive';
  return 'stable';
};

const getFuturePlanSummary = async (conn, programId, afterDayOrder) => {
  const [rows] = await conn.execute(
    `SELECT
       COUNT(we.id) AS exercise_count,
       COUNT(DISTINCT w.id) AS workout_count,
       AVG(COALESCE(we.target_sets, 0)) AS avg_sets,
       AVG(COALESCE(we.rpe_target, 0)) AS avg_rpe,
       AVG(COALESCE(we.rest_seconds, 0)) AS avg_rest_seconds,
       AVG(COALESCE(we.target_weight, 0)) AS avg_target_weight
     FROM workouts w
     LEFT JOIN workout_exercises we ON we.workout_id = w.id
     WHERE w.program_id = ?
       AND w.day_order > ?`,
    [programId, afterDayOrder],
  );

  const row = rows[0] || {};
  return {
    exerciseCount: Number(row.exercise_count || 0),
    workoutCount: Number(row.workout_count || 0),
    avgSets: toFiniteNumber(row.avg_sets, 0),
    avgRpe: toFiniteNumber(row.avg_rpe, 0),
    avgRestSeconds: toFiniteNumber(row.avg_rest_seconds, 0),
    avgTargetWeight: toFiniteNumber(row.avg_target_weight, 0),
  };
};

const getLatestInsightBundle = async (conn, userId) => {
  const [rows] = await conn.execute(
    `SELECT score_type, score_value, insight_date, created_at, explanation
     FROM user_insight_scores
     WHERE user_id = ?
       AND score_type IN ('recovery', 'risk', 'readiness', 'confidence')
     ORDER BY created_at DESC
     LIMIT 40`,
    [userId],
  );

  const latestByType = {};
  let safety = null;
  let latestDate = null;

  rows.forEach((row) => {
    const scoreType = String(row.score_type || '').trim();
    if (!scoreType) return;

    if (!latestByType[scoreType]) {
      latestByType[scoreType] = toFiniteNumber(row.score_value, null);
      if (!latestDate) latestDate = row.insight_date || row.created_at || null;
    }

    if (!safety) {
      const explanation = safeParseJson(row.explanation, null);
      if (explanation?.safety) safety = explanation.safety;
    }
  });

  return {
    scores: {
      recovery: toFiniteNumber(latestByType.recovery, null),
      risk: toFiniteNumber(latestByType.risk, null),
      readiness: toFiniteNumber(latestByType.readiness, null),
      confidence: toFiniteNumber(latestByType.confidence, null),
    },
    safety: safety || null,
    scoreDate: latestDate,
  };
};

const buildWeeklyAdjustment = ({ scores, safety, trigger, thresholds = null }) => {
  const recovery = toFiniteNumber(scores?.recovery, null);
  const risk = toFiniteNumber(scores?.risk, null);
  const readiness = toFiniteNumber(scores?.readiness, null);
  const confidence = toFiniteNumber(scores?.confidence, null);
  const thresholdConfig = normalizeThresholds(thresholds || {});

  const trainingMode = String(safety?.trainingMode || '').trim().toLowerCase();
  const criticalFlags = Array.isArray(safety?.flags)
    ? safety.flags.filter((flag) => String(flag?.severity || '').toLowerCase() === 'critical')
    : [];
  const highFlags = Array.isArray(safety?.flags)
    ? safety.flags.filter((flag) => String(flag?.severity || '').toLowerCase() === 'high')
    : [];

  const reasonCodes = [];
  let mode = 'maintain';
  let triggerSource = 'weekly_analysis';
  let setDelta = 0;
  let rpeDelta = 0;
  let restDelta = 0;
  let weightMultiplier = 1.0;
  let frequencyAdjustment = 0;

  const hasCriticalRisk = criticalFlags.length > 0
    || trainingMode === 'hold_and_review'
    || (risk != null && risk >= thresholdConfig.criticalRiskMin)
    || (readiness != null && readiness < thresholdConfig.criticalReadinessMax);
  const hasHighRisk = highFlags.length > 0
    || trainingMode === 'conservative'
    || (risk != null && risk >= thresholdConfig.highRiskMin)
    || (readiness != null && readiness < thresholdConfig.highReadinessMax)
    || (recovery != null && recovery < thresholdConfig.highRecoveryMax);
  const strongReadiness = trainingMode === 'normal'
    && (readiness != null && readiness >= thresholdConfig.progressionReadinessMin)
    && (recovery != null && recovery >= thresholdConfig.progressionRecoveryMin)
    && (risk != null && risk <= thresholdConfig.progressionRiskMax)
    && (confidence != null && confidence >= thresholdConfig.progressionConfidenceMin);

  if (hasCriticalRisk) {
    mode = 'deload';
    triggerSource = 'auto_deload';
    setDelta = -2;
    rpeDelta = -1.0;
    restDelta = 30;
    weightMultiplier = 0.92;
    frequencyAdjustment = -1;
    reasonCodes.push('critical_recovery_risk');
  } else if (hasHighRisk) {
    mode = 'conservative';
    triggerSource = 'weekly_analysis';
    setDelta = -1;
    rpeDelta = -0.5;
    restDelta = 20;
    weightMultiplier = 0.96;
    frequencyAdjustment = -1;
    reasonCodes.push('high_recovery_risk');
  } else if (strongReadiness) {
    mode = 'progression';
    triggerSource = 'progression';
    setDelta = 1;
    rpeDelta = 0.3;
    restDelta = -10;
    weightMultiplier = 1.02;
    frequencyAdjustment = 0;
    reasonCodes.push('progression_window');
  } else {
    reasonCodes.push('metrics_in_target_range');
  }

  if (confidence != null && confidence < thresholdConfig.progressionGuardConfidenceMin && mode === 'progression') {
    mode = 'maintain';
    triggerSource = 'weekly_analysis';
    setDelta = 0;
    rpeDelta = 0;
    restDelta = 0;
    weightMultiplier = 1.0;
    reasonCodes.push('confidence_too_low_for_progression');
  }

  if (trigger && String(trigger).trim()) {
    reasonCodes.push(`trigger:${String(trigger).trim().toLowerCase()}`);
  }

  return {
    mode,
    triggerSource,
    setDelta,
    rpeDelta,
    restDelta,
    weightMultiplier,
    frequencyAdjustment,
    reasonCodes: Array.from(new Set(reasonCodes)),
    inputs: { recovery, risk, readiness, confidence, trainingMode },
    thresholds: thresholdConfig,
  };
};

const getAssignmentForValidation = async (conn, { userId, assignmentId = null, programId = null }) => {
  if (assignmentId) {
    const [rows] = await conn.execute(
      `SELECT pa.id, pa.program_id, p.days_per_week
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.id = ?
         AND pa.user_id = ?
       LIMIT 1`,
      [assignmentId, userId],
    );
    if (rows.length) {
      return {
        assignmentId: Number(rows[0].id),
        programId: Number(rows[0].program_id),
        daysPerWeek: Number(rows[0].days_per_week || 4),
      };
    }
  }

  if (programId) {
    const [programRows] = await conn.execute(
      `SELECT id, days_per_week
       FROM programs
       WHERE id = ?
       LIMIT 1`,
      [programId],
    );
    if (programRows.length) {
      return {
        assignmentId: null,
        programId: Number(programRows[0].id),
        daysPerWeek: Number(programRows[0].days_per_week || 4),
      };
    }
  }

  const [activeRows] = await conn.execute(
    `SELECT pa.id, pa.program_id, p.days_per_week
     FROM program_assignments pa
     JOIN programs p ON p.id = pa.program_id
     WHERE pa.user_id = ?
       AND pa.status = 'active'
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [userId],
  );

  if (!activeRows.length) {
    return {
      assignmentId: null,
      programId: Number(programId || 0) || null,
      daysPerWeek: 4,
    };
  }

  return {
    assignmentId: Number(activeRows[0].id),
    programId: Number(activeRows[0].program_id),
    daysPerWeek: Number(activeRows[0].days_per_week || 4),
  };
};

const normalizeValidationSource = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['auto_weekly', 'manual', 'backfill'].includes(normalized)) return normalized;
  return 'manual';
};

export const captureWeeklyValidationSnapshot = async (
  conn,
  {
    userId,
    programId = null,
    assignmentId = null,
    adaptationId = null,
    source = 'auto_weekly',
    periodEnd = null,
    experiment = null,
  } = {},
) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('Invalid userId');
  }

  const hasOutcomesTable = await hasTable(conn, 'plan_recommendation_outcomes');
  const resolvedAssignment = await getAssignmentForValidation(conn, {
    userId: normalizedUserId,
    assignmentId: Number.isInteger(Number(assignmentId)) ? Number(assignmentId) : null,
    programId: Number.isInteger(Number(programId)) ? Number(programId) : null,
  });

  const periodEndDate = toISODate(periodEnd || new Date()) || toISODate(new Date());
  const periodStartDate = shiftISODate(periodEndDate, -6);
  const previousPeriodEnd = shiftISODate(periodStartDate, -1);
  const previousPeriodStart = shiftISODate(periodStartDate, -7);

  const plannedSessions = Math.max(0, Number(resolvedAssignment.daysPerWeek || 4));
  const [completedRows] = await conn.execute(
    `SELECT COUNT(DISTINCT DATE(created_at)) AS completed_sessions
     FROM workout_sets
     WHERE user_id = ?
       AND completed = 1
       AND DATE(created_at) BETWEEN ? AND ?`,
    [normalizedUserId, periodStartDate, periodEndDate],
  );
  const completedSessions = Number(completedRows[0]?.completed_sessions || 0);
  const adherencePct = plannedSessions > 0
    ? clampPercentage((completedSessions / plannedSessions) * 100)
    : 0;

  const [scoreRows] = await conn.execute(
    `SELECT
       AVG(CASE WHEN score_type = 'recovery' THEN score_value END) AS avg_recovery_score,
       AVG(CASE WHEN score_type = 'risk' THEN score_value END) AS avg_risk_score,
       AVG(CASE WHEN score_type = 'readiness' THEN score_value END) AS avg_readiness_score,
       AVG(CASE WHEN score_type = 'confidence' THEN score_value END) AS confidence_avg
     FROM user_insight_scores
     WHERE user_id = ?
       AND insight_date BETWEEN ? AND ?`,
    [normalizedUserId, periodStartDate, periodEndDate],
  );
  const scoreRow = scoreRows[0] || {};

  const effortQuery = `
    SELECT
      SUM(
        CASE
          WHEN completed = 0 THEN 0
          WHEN weight IS NOT NULL AND reps IS NOT NULL THEN weight * reps
          WHEN reps IS NOT NULL THEN reps
          ELSE 0
        END
      ) AS effort
    FROM workout_sets
    WHERE user_id = ?
      AND DATE(created_at) BETWEEN ? AND ?`;

  const [currentEffortRows] = await conn.execute(effortQuery, [normalizedUserId, periodStartDate, periodEndDate]);
  const [previousEffortRows] = await conn.execute(effortQuery, [normalizedUserId, previousPeriodStart, previousPeriodEnd]);
  const currentEffort = Number(currentEffortRows[0]?.effort || 0);
  const previousEffort = Number(previousEffortRows[0]?.effort || 0);
  const performanceDeltaPct = percentChange(currentEffort, previousEffort);

  const [weightRows] = await conn.execute(
    `SELECT snapshot_date, weight_kg
     FROM user_health_snapshots
     WHERE user_id = ?
       AND snapshot_date BETWEEN ? AND ?
       AND weight_kg IS NOT NULL
     ORDER BY snapshot_date ASC`,
    [normalizedUserId, periodStartDate, periodEndDate],
  );
  let bodyWeightDeltaKg = null;
  if (weightRows.length >= 2) {
    const first = Number(weightRows[0].weight_kg);
    const last = Number(weightRows[weightRows.length - 1].weight_kg);
    if (Number.isFinite(first) && Number.isFinite(last)) {
      bodyWeightDeltaKg = toRounded(last - first, 2);
    }
  }

  const avgRiskScore = toFiniteNumber(scoreRow.avg_risk_score, null);
  const outcomeBand = toOutcomeBand({
    adherencePct,
    avgRiskScore,
    performanceDeltaPct,
  });

  const resolvedExperiment = experiment && experiment.variantKey
    ? experiment
    : await getWeeklyExperimentForUser(conn, normalizedUserId);

  const snapshot = {
    userId: normalizedUserId,
    assignmentId: resolvedAssignment.assignmentId,
    programId: resolvedAssignment.programId,
    adaptationId: Number.isInteger(Number(adaptationId)) && Number(adaptationId) > 0 ? Number(adaptationId) : null,
    experimentKey: resolvedExperiment.experimentKey || WEEKLY_ADAPTATION_EXPERIMENT_KEY,
    variantKey: resolvedExperiment.variantKey || 'control',
    source: normalizeValidationSource(source),
    periodStart: periodStartDate,
    periodEnd: periodEndDate,
    plannedSessions,
    completedSessions,
    adherencePct: toRounded(adherencePct, 2) || 0,
    avgRecoveryScore: toFiniteNumber(scoreRow.avg_recovery_score, null),
    avgRiskScore,
    avgReadinessScore: toFiniteNumber(scoreRow.avg_readiness_score, null),
    confidenceAvg: toFiniteNumber(scoreRow.confidence_avg, null),
    performanceDeltaPct,
    bodyWeightDeltaKg,
    outcomeBand,
    metrics: {
      effort: {
        currentWindow: toRounded(currentEffort, 2) || 0,
        previousWindow: toRounded(previousEffort, 2) || 0,
      },
      period: {
        start: periodStartDate,
        end: periodEndDate,
        previousStart: previousPeriodStart,
        previousEnd: previousPeriodEnd,
      },
      assignmentSource: resolvedExperiment.assignmentSource || 'hash',
    },
  };

  if (!hasOutcomesTable) {
    return {
      available: false,
      persisted: false,
      snapshot,
    };
  }

  const [writeResult] = await conn.execute(
    `INSERT INTO plan_recommendation_outcomes
       (user_id, program_id, assignment_id, adaptation_id, experiment_key, variant_key, source, period_start, period_end,
        planned_sessions, completed_sessions, adherence_pct, avg_recovery_score, avg_risk_score, avg_readiness_score,
        confidence_avg, performance_delta_pct, body_weight_delta_kg, outcome_band, metrics_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       program_id = VALUES(program_id),
       assignment_id = VALUES(assignment_id),
       adaptation_id = VALUES(adaptation_id),
       experiment_key = VALUES(experiment_key),
       variant_key = VALUES(variant_key),
       planned_sessions = VALUES(planned_sessions),
       completed_sessions = VALUES(completed_sessions),
       adherence_pct = VALUES(adherence_pct),
       avg_recovery_score = VALUES(avg_recovery_score),
       avg_risk_score = VALUES(avg_risk_score),
       avg_readiness_score = VALUES(avg_readiness_score),
       confidence_avg = VALUES(confidence_avg),
       performance_delta_pct = VALUES(performance_delta_pct),
       body_weight_delta_kg = VALUES(body_weight_delta_kg),
       outcome_band = VALUES(outcome_band),
       metrics_json = VALUES(metrics_json),
       id = LAST_INSERT_ID(id),
       updated_at = CURRENT_TIMESTAMP`,
    [
      snapshot.userId,
      snapshot.programId,
      snapshot.assignmentId,
      snapshot.adaptationId,
      snapshot.experimentKey,
      snapshot.variantKey,
      snapshot.source,
      snapshot.periodStart,
      snapshot.periodEnd,
      snapshot.plannedSessions,
      snapshot.completedSessions,
      snapshot.adherencePct,
      snapshot.avgRecoveryScore,
      snapshot.avgRiskScore,
      snapshot.avgReadinessScore,
      snapshot.confidenceAvg,
      snapshot.performanceDeltaPct,
      snapshot.bodyWeightDeltaKg,
      snapshot.outcomeBand,
      JSON.stringify(snapshot.metrics),
    ],
  );

  return {
    available: true,
    persisted: true,
    snapshotId: Number(writeResult.insertId || 0),
    snapshot,
  };
};

export const getUserPlanValidationHistory = async (conn, { userId, limit = 24 } = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('Invalid userId');
  }

  const hasOutcomesTable = await hasTable(conn, 'plan_recommendation_outcomes');
  if (!hasOutcomesTable) {
    return {
      available: false,
      userId: normalizedUserId,
      outcomes: [],
    };
  }

  const normalizedLimit = Math.max(1, Math.min(260, Number(limit) || 24));
  const [rows] = await conn.query(
    `SELECT
       id,
       program_id,
       assignment_id,
       adaptation_id,
       experiment_key,
       variant_key,
       source,
       period_start,
       period_end,
       planned_sessions,
       completed_sessions,
       adherence_pct,
       avg_recovery_score,
       avg_risk_score,
       avg_readiness_score,
       confidence_avg,
       performance_delta_pct,
       body_weight_delta_kg,
       outcome_band,
       metrics_json,
       created_at,
       updated_at
     FROM plan_recommendation_outcomes
     WHERE user_id = ?
     ORDER BY period_end DESC, id DESC
     LIMIT ?`,
    [normalizedUserId, normalizedLimit],
  );

  return {
    available: true,
    userId: normalizedUserId,
    outcomes: rows.map((row) => ({
      id: Number(row.id),
      programId: toFiniteNumber(row.program_id, null),
      assignmentId: toFiniteNumber(row.assignment_id, null),
      adaptationId: toFiniteNumber(row.adaptation_id, null),
      experimentKey: row.experiment_key || null,
      variantKey: row.variant_key || null,
      source: row.source || null,
      periodStart: toISODate(row.period_start),
      periodEnd: toISODate(row.period_end),
      plannedSessions: Number(row.planned_sessions || 0),
      completedSessions: Number(row.completed_sessions || 0),
      adherencePct: toFiniteNumber(row.adherence_pct, 0),
      avgRecoveryScore: toFiniteNumber(row.avg_recovery_score, null),
      avgRiskScore: toFiniteNumber(row.avg_risk_score, null),
      avgReadinessScore: toFiniteNumber(row.avg_readiness_score, null),
      confidenceAvg: toFiniteNumber(row.confidence_avg, null),
      performanceDeltaPct: toFiniteNumber(row.performance_delta_pct, null),
      bodyWeightDeltaKg: toFiniteNumber(row.body_weight_delta_kg, null),
      outcomeBand: row.outcome_band || 'stable',
      metrics: safeParseJson(row.metrics_json, null),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
};

export const getMonthlyValidationCalibration = async (conn, { months = 6 } = {}) => {
  const hasOutcomesTable = await hasTable(conn, 'plan_recommendation_outcomes');
  if (!hasOutcomesTable) {
    return {
      available: false,
      months: Math.max(1, Math.min(24, Number(months) || 6)),
      byMonth: [],
      byVariant: [],
      tuningHints: ['Run migration 2026-02-27_plan_validation_loop.sql to enable validation calibration reports.'],
    };
  }

  const normalizedMonths = Math.max(1, Math.min(24, Number(months) || 6));

  const [byMonthRows] = await conn.execute(
    `SELECT
       DATE_FORMAT(period_end, '%Y-%m') AS month_key,
       COALESCE(variant_key, 'unassigned') AS variant_key,
       COUNT(*) AS sample_size,
       AVG(adherence_pct) AS avg_adherence_pct,
       AVG(COALESCE(performance_delta_pct, 0)) AS avg_performance_delta_pct,
       AVG(COALESCE(avg_risk_score, 0)) AS avg_risk_score,
       AVG(COALESCE(confidence_avg, 0)) AS avg_confidence,
       AVG(CASE WHEN outcome_band IN ('positive', 'excellent') THEN 1 ELSE 0 END) AS success_rate
     FROM plan_recommendation_outcomes
     WHERE period_end >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY month_key, COALESCE(variant_key, 'unassigned')
     ORDER BY month_key DESC, variant_key ASC`,
    [normalizedMonths],
  );

  const [byVariantRows] = await conn.execute(
    `SELECT
       COALESCE(variant_key, 'unassigned') AS variant_key,
       COUNT(*) AS sample_size,
       AVG(adherence_pct) AS avg_adherence_pct,
       AVG(COALESCE(performance_delta_pct, 0)) AS avg_performance_delta_pct,
       AVG(COALESCE(avg_risk_score, 0)) AS avg_risk_score,
       AVG(COALESCE(confidence_avg, 0)) AS avg_confidence,
       AVG(CASE WHEN outcome_band IN ('positive', 'excellent') THEN 1 ELSE 0 END) AS success_rate
     FROM plan_recommendation_outcomes
     WHERE period_end >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY COALESCE(variant_key, 'unassigned')
     ORDER BY success_rate DESC, sample_size DESC`,
    [normalizedMonths],
  );

  const normalizedByVariant = byVariantRows.map((row) => ({
    variantKey: String(row.variant_key || 'unassigned'),
    sampleSize: Number(row.sample_size || 0),
    avgAdherencePct: toRounded(row.avg_adherence_pct, 2) || 0,
    avgPerformanceDeltaPct: toRounded(row.avg_performance_delta_pct, 2) || 0,
    avgRiskScore: toRounded(row.avg_risk_score, 2) || 0,
    avgConfidence: toRounded(row.avg_confidence, 2) || 0,
    successRate: toRounded(Number(row.success_rate || 0) * 100, 2) || 0,
  }));

  const tuningHints = [];
  const stableVariants = normalizedByVariant.filter((row) => row.sampleSize >= 8);

  if (stableVariants.length >= 2) {
    const best = stableVariants[0];
    const worst = stableVariants[stableVariants.length - 1];
    if (best.successRate - worst.successRate >= 8) {
      tuningHints.push(
        `Promote variant '${best.variantKey}' (success ${best.successRate}%) and down-weight '${worst.variantKey}' (success ${worst.successRate}%).`,
      );
    }
  }

  stableVariants.forEach((variant) => {
    if (variant.avgRiskScore >= 68) {
      tuningHints.push(`Variant '${variant.variantKey}' shows high fatigue risk (${variant.avgRiskScore}). Tighten progression thresholds.`);
    }
    if (variant.avgAdherencePct < 65) {
      tuningHints.push(`Variant '${variant.variantKey}' has low adherence (${variant.avgAdherencePct}%). Reduce load jumps or frequency.`);
    }
  });

  if (!tuningHints.length) {
    tuningHints.push('Current thresholds are stable. Keep collecting weekly outcomes and review again next month.');
  }

  return {
    available: true,
    months: normalizedMonths,
    generatedAt: new Date().toISOString(),
    byMonth: byMonthRows.map((row) => ({
      month: row.month_key,
      variantKey: String(row.variant_key || 'unassigned'),
      sampleSize: Number(row.sample_size || 0),
      avgAdherencePct: toRounded(row.avg_adherence_pct, 2) || 0,
      avgPerformanceDeltaPct: toRounded(row.avg_performance_delta_pct, 2) || 0,
      avgRiskScore: toRounded(row.avg_risk_score, 2) || 0,
      avgConfidence: toRounded(row.avg_confidence, 2) || 0,
      successRate: toRounded(Number(row.success_rate || 0) * 100, 2) || 0,
    })),
    byVariant: normalizedByVariant,
    tuningHints: Array.from(new Set(tuningHints)),
  };
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

export const adaptProgramWeeklyByInsights = async (conn, { userId, trigger = 'weekly_analysis', force = false }) => {
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
  const assignmentId = Number(assignment.id);
  const programId = Number(assignment.program_id);
  const daysPerWeek = Number(assignment.days_per_week || 4);
  const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
  const afterDayOrder = currentWeek * daysPerWeek;
  const experiment = await getWeeklyExperimentForUser(conn, userId);

  if (!force) {
    const [existingRows] = await conn.execute(
      `SELECT id, adaptation_date, trigger_source
       FROM plan_adaptations
       WHERE user_id = ?
         AND program_id = ?
         AND YEARWEEK(adaptation_date, 1) = YEARWEEK(CURDATE(), 1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, programId],
    );
    if (existingRows.length) {
      return {
        adapted: false,
        reason: 'Already adapted this week',
        weeklyBlock: currentWeek,
        adaptationId: Number(existingRows[0].id),
      };
    }
  }

  const insightBundle = await getLatestInsightBundle(conn, userId);
  const adjustment = buildWeeklyAdjustment({
    scores: insightBundle.scores,
    safety: insightBundle.safety,
    trigger,
    thresholds: experiment.thresholds,
  });

  const beforeSummary = await getFuturePlanSummary(conn, programId, afterDayOrder);
  if (!beforeSummary.exerciseCount) {
    const noFutureReasonCodes = ['no_future_workouts', `week:${currentWeek}`, `variant:${experiment.variantKey}`];
    const [adaptLog] = await conn.execute(
      `INSERT INTO plan_adaptations
         (user_id, program_id, adaptation_date, trigger_source, confidence_score, previous_plan_json, adapted_plan_json, change_summary_json, reason_codes_json, reviewed_by_coach)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, 0)`,
      [
        userId,
        programId,
        'weekly_analysis',
        adjustment.inputs.confidence,
        JSON.stringify({ week: currentWeek, afterDayOrder, summary: beforeSummary }),
        JSON.stringify({ week: currentWeek, afterDayOrder, summary: beforeSummary }),
        JSON.stringify({
          mode: 'maintain',
          adjusted: false,
          reason: 'No future workouts available for adaptation',
          experiment: {
            key: experiment.experimentKey,
            variant: experiment.variantKey,
            assignmentSource: experiment.assignmentSource,
          },
        }),
        JSON.stringify(noFutureReasonCodes),
      ],
    );

    let validationSnapshot = null;
    try {
      validationSnapshot = await captureWeeklyValidationSnapshot(conn, {
        userId,
        programId,
        assignmentId,
        adaptationId: Number(adaptLog.insertId || 0),
        source: 'auto_weekly',
        experiment,
      });
    } catch {
      validationSnapshot = null;
    }

    return {
      adapted: false,
      reason: 'No future workouts available for adaptation',
      weeklyBlock: currentWeek,
      adaptationId: Number(adaptLog.insertId || 0),
      scores: insightBundle.scores,
      experiment: {
        key: experiment.experimentKey,
        variant: experiment.variantKey,
        assignmentSource: experiment.assignmentSource,
      },
      validationSnapshot,
    };
  }

  let affectedExercises = 0;
  if (adjustment.mode !== 'maintain') {
    const [updateResult] = await conn.execute(
      `UPDATE workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       SET
         we.target_sets = LEAST(8, GREATEST(1, COALESCE(we.target_sets, 3) + ?)),
         we.rpe_target = LEAST(9.5, GREATEST(5.5, COALESCE(we.rpe_target, 7.5) + ?)),
         we.rest_seconds = LEAST(300, GREATEST(30, COALESCE(we.rest_seconds, 90) + ?)),
         we.target_weight = CASE
           WHEN we.target_weight IS NULL THEN NULL
           ELSE ROUND(GREATEST(0, we.target_weight * ?), 2)
         END
       WHERE w.program_id = ?
         AND w.day_order > ?`,
      [
        adjustment.setDelta,
        adjustment.rpeDelta,
        adjustment.restDelta,
        adjustment.weightMultiplier,
        programId,
        afterDayOrder,
      ],
    );

    affectedExercises = Number(updateResult.affectedRows || 0);
  }

  const afterSummary = await getFuturePlanSummary(conn, programId, afterDayOrder);
  const adjusted = adjustment.mode !== 'maintain' && affectedExercises > 0;
  const reasonCodes = [...adjustment.reasonCodes, `week:${currentWeek}`, `variant:${experiment.variantKey}`];

  const [adaptLog] = await conn.execute(
    `INSERT INTO plan_adaptations
       (user_id, program_id, adaptation_date, trigger_source, confidence_score, previous_plan_json, adapted_plan_json, change_summary_json, reason_codes_json, reviewed_by_coach)
     VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, 0)`,
    [
      userId,
      programId,
      adjustment.triggerSource,
      adjustment.inputs.confidence,
      JSON.stringify({ week: currentWeek, afterDayOrder, summary: beforeSummary }),
      JSON.stringify({ week: currentWeek, afterDayOrder, summary: afterSummary }),
      JSON.stringify({
        mode: adjustment.mode,
        adjusted,
        affectedExercises,
        deltas: {
          setDelta: adjustment.setDelta,
          rpeDelta: adjustment.rpeDelta,
          restDeltaSeconds: adjustment.restDelta,
          weightMultiplier: adjustment.weightMultiplier,
        },
        frequencyAdjustmentRecommendation: adjustment.frequencyAdjustment,
        scores: insightBundle.scores,
        safety: insightBundle.safety || null,
        experiment: {
          key: experiment.experimentKey,
          variant: experiment.variantKey,
          assignmentSource: experiment.assignmentSource,
          thresholds: adjustment.thresholds,
        },
      }),
      JSON.stringify(reasonCodes),
    ],
  );

  if (adjusted) {
    const changeReason = adjustment.mode === 'deload' ? 'injury_adjustment' : 'user_request';
    const notes = `weekly_auto:week=${currentWeek};mode=${adjustment.mode};setDelta=${adjustment.setDelta};rpeDelta=${adjustment.rpeDelta};restDelta=${adjustment.restDelta};trigger=${String(trigger || 'weekly_analysis').toLowerCase()}`;
    try {
      await conn.execute(
        `INSERT INTO program_change_log
          (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [assignmentId, userId, programId, programId, changeReason, notes],
      );
    } catch {
      // Non-fatal: workout_exercises + plan_adaptations already persisted.
    }
  }

  let validationSnapshot = null;
  try {
    validationSnapshot = await captureWeeklyValidationSnapshot(conn, {
      userId,
      programId,
      assignmentId,
      adaptationId: Number(adaptLog.insertId || 0),
      source: 'auto_weekly',
      experiment,
    });
  } catch {
    validationSnapshot = null;
  }

  return {
    adapted: adjusted,
    weeklyBlock: currentWeek,
    assignmentId,
    programId,
    adaptationId: Number(adaptLog.insertId || 0),
    mode: adjustment.mode,
    triggerSource: adjustment.triggerSource,
    affectedExercises,
    scores: insightBundle.scores,
    experiment: {
      key: experiment.experimentKey,
      variant: experiment.variantKey,
      assignmentSource: experiment.assignmentSource,
    },
    validationSnapshot,
    summary: {
      before: beforeSummary,
      after: afterSummary,
    },
    deltas: {
      setDelta: adjustment.setDelta,
      rpeDelta: adjustment.rpeDelta,
      restDeltaSeconds: adjustment.restDelta,
      weightMultiplier: adjustment.weightMultiplier,
      frequencyAdjustmentRecommendation: adjustment.frequencyAdjustment,
    },
    reasonCodes,
  };
};
