/* eslint-env node */
import pool from '../database.js';
import { computeUserAnalysisScoring } from './insightScoring.js';

const ALLOWED_SOURCES = new Set(['onboarding', 'weekly_checkin', 'manual', 'device_sync']);
const ALLOWED_SCORE_TYPES = new Set(['onboarding', 'recovery', 'risk', 'readiness', 'confidence', 'adherence', 'performance']);

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clampScore = (value) => {
  const n = toNumberOrNull(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Number(n.toFixed(2))));
};

const toScoreBand = (scoreValue) => {
  const score = toNumberOrNull(scoreValue);
  if (!Number.isFinite(score)) return 'unknown';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

const normalizeSnapshotDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const normalizeSource = (value, fallback) => {
  const source = String(value || '').trim().toLowerCase();
  if (ALLOWED_SOURCES.has(source)) return source;
  return fallback;
};

const resolveWeightKg = (input = {}) =>
  toNumberOrNull(input.weightKg ?? input.weight_kg ?? input.weight);

const resolveBmi = (input = {}, insights = {}) => {
  const fromPayload = toNumberOrNull(input.bmi);
  if (Number.isFinite(fromPayload)) return fromPayload;
  return toNumberOrNull(insights?.metrics?.bmi);
};

const resolveRestingHeartRate = (input = {}, insights = {}) => {
  const fromPayload = toNumberOrNull(input.restingHeartRate ?? input.resting_heart_rate ?? input.restingBpm ?? input.resting_bpm);
  if (Number.isFinite(fromPayload)) return fromPayload;
  return toNumberOrNull(insights?.metrics?.restingBpm);
};

const computeOnboardingScore = (insights = {}) => {
  const components = [];
  const bmiCategory = String(insights?.interpretation?.bmiCategory || '').toLowerCase();
  const workoutFrequency = toNumberOrNull(insights?.metrics?.workoutFrequency);
  const restingPercentile = toNumberOrNull(insights?.baselinePosition?.restingBpmPercentile);

  if (bmiCategory === 'healthy') components.push(86);
  else if (bmiCategory === 'overweight') components.push(65);
  else if (bmiCategory === 'underweight') components.push(60);
  else if (bmiCategory === 'obesity') components.push(45);
  else components.push(55);

  if (Number.isFinite(workoutFrequency)) {
    if (workoutFrequency >= 5) components.push(90);
    else if (workoutFrequency >= 3) components.push(76);
    else if (workoutFrequency >= 1) components.push(62);
    else components.push(45);
  }

  if (Number.isFinite(restingPercentile)) {
    if (restingPercentile <= 30) components.push(88);
    else if (restingPercentile <= 60) components.push(74);
    else if (restingPercentile <= 80) components.push(60);
    else components.push(45);
  }

  const avg = components.length
    ? components.reduce((acc, value) => acc + value, 0) / components.length
    : 55;
  return clampScore(avg);
};

const computeOnboardingConfidence = (insights = {}) => {
  const metrics = insights?.metrics || {};
  const observed = [
    toNumberOrNull(metrics.age),
    toNumberOrNull(metrics.bmi),
    toNumberOrNull(metrics.workoutFrequency),
    toNumberOrNull(metrics.restingBpm),
  ];
  const complete = observed.filter((value) => Number.isFinite(value)).length;
  return clampScore((complete / observed.length) * 100);
};

const ensureUserExists = async (conn, userId) => {
  const [rows] = await conn.execute(
    `SELECT id
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
};

const upsertSnapshot = async (conn, snapshot) => {
  const [result] = await conn.execute(
    `INSERT INTO user_health_snapshots
       (user_id, snapshot_date, source, hours_sleep, stress_level, hydration_liters, daily_steps, resting_heart_rate,
        blood_pressure_systolic, blood_pressure_diastolic, weight_kg, bmi, notes, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       source = VALUES(source),
       hours_sleep = COALESCE(VALUES(hours_sleep), hours_sleep),
       stress_level = COALESCE(VALUES(stress_level), stress_level),
       hydration_liters = COALESCE(VALUES(hydration_liters), hydration_liters),
       daily_steps = COALESCE(VALUES(daily_steps), daily_steps),
       resting_heart_rate = COALESCE(VALUES(resting_heart_rate), resting_heart_rate),
       blood_pressure_systolic = COALESCE(VALUES(blood_pressure_systolic), blood_pressure_systolic),
       blood_pressure_diastolic = COALESCE(VALUES(blood_pressure_diastolic), blood_pressure_diastolic),
       weight_kg = COALESCE(VALUES(weight_kg), weight_kg),
       bmi = COALESCE(VALUES(bmi), bmi),
       notes = COALESCE(VALUES(notes), notes),
       raw_payload = VALUES(raw_payload),
       id = LAST_INSERT_ID(id),
       updated_at = CURRENT_TIMESTAMP`,
    [
      snapshot.userId,
      snapshot.snapshotDate,
      snapshot.source,
      snapshot.hoursSleep,
      snapshot.stressLevel,
      snapshot.hydrationLiters,
      snapshot.dailySteps,
      snapshot.restingHeartRate,
      snapshot.systolic,
      snapshot.diastolic,
      snapshot.weightKg,
      snapshot.bmi,
      snapshot.notes,
      JSON.stringify(snapshot.rawPayload || {}),
    ],
  );

  return Number(result.insertId || 0);
};

const upsertScore = async (conn, score) => {
  await conn.execute(
    `INSERT INTO user_insight_scores
       (user_id, snapshot_id, insight_date, score_type, score_value, score_band, model_version, synthetic_only, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       snapshot_id = VALUES(snapshot_id),
       score_value = VALUES(score_value),
       score_band = VALUES(score_band),
       model_version = VALUES(model_version),
       synthetic_only = VALUES(synthetic_only),
       explanation = VALUES(explanation),
       updated_at = CURRENT_TIMESTAMP`,
    [
      score.userId,
      score.snapshotId,
      score.insightDate,
      score.scoreType,
      score.scoreValue,
      score.scoreBand,
      score.modelVersion,
      score.syntheticOnly ? 1 : 0,
      JSON.stringify(score.explanation || {}),
    ],
  );
};

export const saveOnboardingInsightsForUser = async ({
  userId,
  input = {},
  insights = {},
  snapshotDate,
  source = 'onboarding',
  notes = null,
  modelVersion = 'fitness_insights_v1',
} = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('Invalid userId');
  }

  const normalizedDate = normalizeSnapshotDate(snapshotDate || input.snapshotDate);
  if (!normalizedDate) throw new Error('Invalid snapshotDate');

  const normalizedSource = normalizeSource(source || input.source, 'onboarding');
  const onboardingScore = clampScore(computeOnboardingScore(insights) ?? 55);
  const confidenceScore = clampScore(computeOnboardingConfidence(insights) ?? 25);
  const syntheticOnly = !!insights?.syntheticOnly;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const exists = await ensureUserExists(conn, normalizedUserId);
    if (!exists) throw new Error('User not found');

    const snapshotId = await upsertSnapshot(conn, {
      userId: normalizedUserId,
      snapshotDate: normalizedDate,
      source: normalizedSource,
      hoursSleep: null,
      stressLevel: null,
      hydrationLiters: null,
      dailySteps: null,
      restingHeartRate: resolveRestingHeartRate(input, insights),
      systolic: null,
      diastolic: null,
      weightKg: resolveWeightKg(input),
      bmi: resolveBmi(input, insights),
      notes: notes || input.notes || null,
      rawPayload: { input, insights },
    });

    const scores = [
      {
        scoreType: 'onboarding',
        scoreValue: onboardingScore,
      },
      {
        scoreType: 'confidence',
        scoreValue: confidenceScore,
      },
    ];

    for (const item of scores) {
      await upsertScore(conn, {
        userId: normalizedUserId,
        snapshotId,
        insightDate: normalizedDate,
        scoreType: item.scoreType,
        scoreValue: item.scoreValue,
        scoreBand: toScoreBand(item.scoreValue),
        modelVersion,
        syntheticOnly,
        explanation: {
          source: 'onboarding',
          metrics: insights?.metrics || null,
          baselinePosition: insights?.baselinePosition || null,
          interpretation: insights?.interpretation || null,
        },
      });
    }

    await conn.commit();
    return {
      userId: normalizedUserId,
      snapshotId,
      snapshotDate: normalizedDate,
      scores: scores.map((item) => ({
        type: item.scoreType,
        value: item.scoreValue,
        band: toScoreBand(item.scoreValue),
      })),
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

export const saveUserAnalysisInsightsForUser = async ({
  userId,
  input = {},
  insights = {},
  snapshotDate,
  source = 'weekly_checkin',
  notes = null,
  modelVersion = 'fitness_insights_v1',
} = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('Invalid userId');
  }

  const normalizedDate = normalizeSnapshotDate(snapshotDate || input.snapshotDate);
  if (!normalizedDate) throw new Error('Invalid snapshotDate');

  const normalizedSource = normalizeSource(source || input.source, 'weekly_checkin');
  const computedScoring = computeUserAnalysisScoring({
    input,
    classifications: insights?.classifications || {},
  });
  const scoring = insights?.scoring && Number.isFinite(Number(insights?.scoring?.recoveryScore))
    ? insights.scoring
    : computedScoring;
  const recoveryScore = clampScore(scoring?.recoveryScore ?? insights?.score ?? 50);
  const riskScore = clampScore(scoring?.riskScore ?? (100 - recoveryScore));
  const confidenceScore = clampScore(scoring?.confidenceScore ?? 20);
  const readinessScore = clampScore(scoring?.readinessScore ?? recoveryScore);
  const syntheticOnly = !!insights?.syntheticOnly;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const exists = await ensureUserExists(conn, normalizedUserId);
    if (!exists) throw new Error('User not found');

    const snapshotId = await upsertSnapshot(conn, {
      userId: normalizedUserId,
      snapshotDate: normalizedDate,
      source: normalizedSource,
      hoursSleep: toNumberOrNull(input.hoursSleep ?? input.hours_sleep),
      stressLevel: toNumberOrNull(input.stressLevel ?? input.stress_level),
      hydrationLiters: toNumberOrNull(input.hydrationLevel ?? input.hydration_level),
      dailySteps: toNumberOrNull(input.dailySteps ?? input.daily_steps),
      restingHeartRate: toNumberOrNull(input.restingHeartRate ?? input.resting_heart_rate),
      systolic: toNumberOrNull(input.systolic ?? input.blood_pressure_systolic),
      diastolic: toNumberOrNull(input.diastolic ?? input.blood_pressure_diastolic),
      weightKg: resolveWeightKg(input),
      bmi: resolveBmi(input, insights),
      notes: notes || input.notes || null,
      rawPayload: { input, insights },
    });

    const scores = [
      {
        scoreType: 'recovery',
        scoreValue: recoveryScore,
      },
      {
        scoreType: 'risk',
        scoreValue: riskScore,
      },
      {
        scoreType: 'readiness',
        scoreValue: readinessScore,
      },
      {
        scoreType: 'confidence',
        scoreValue: confidenceScore,
      },
    ];

    for (const item of scores) {
      await upsertScore(conn, {
        userId: normalizedUserId,
        snapshotId,
        insightDate: normalizedDate,
        scoreType: item.scoreType,
        scoreValue: item.scoreValue,
        scoreBand: toScoreBand(item.scoreValue),
        modelVersion,
        syntheticOnly,
        explanation: {
          source: 'user-analysis',
          classifications: insights?.classifications || null,
          recommendations: insights?.recommendations || [],
          safety: scoring?.safety || null,
          scoreVersion: scoring?.version || 'v1',
          components: scoring?.components || null,
        },
      });
    }

    await conn.commit();
    return {
      userId: normalizedUserId,
      snapshotId,
      snapshotDate: normalizedDate,
      scores: scores.map((item) => ({
        type: item.scoreType,
        value: item.scoreValue,
        band: toScoreBand(item.scoreValue),
      })),
      scoring,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const parseScoreTypes = (value) => {
  if (!value) return [];

  const values = Array.isArray(value)
    ? value
    : String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

  const normalized = [];
  for (const item of values) {
    const scoreType = String(item || '').trim().toLowerCase();
    if (ALLOWED_SCORE_TYPES.has(scoreType) && !normalized.includes(scoreType)) {
      normalized.push(scoreType);
    }
  }
  return normalized;
};

const parseJsonField = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
};

const emptyTrendRow = (date) => ({
  date,
  onboarding: null,
  recovery: null,
  risk: null,
  readiness: null,
  confidence: null,
  adherence: null,
  performance: null,
});

export const getUserInsightsHistory = async ({
  userId,
  days = 90,
  limit = 365,
  scoreTypes = [],
  includeExplanation = false,
  includeRawPayload = false,
} = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('Invalid userId');
  }

  const normalizedDays = Math.max(1, Math.min(3650, Number(days) || 90));
  const normalizedLimit = Math.max(1, Math.min(2000, Number(limit) || 365));
  const normalizedTypes = parseScoreTypes(scoreTypes);

  const [users] = await pool.execute(
    `SELECT id
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [normalizedUserId],
  );
  if (!users.length) {
    throw new Error('User not found');
  }

  const scoreWhereParts = [
    's.user_id = ?',
    's.insight_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)',
  ];
  const scoreParams = [normalizedUserId, normalizedDays];
  if (normalizedTypes.length) {
    const placeholders = normalizedTypes.map(() => '?').join(', ');
    scoreWhereParts.push(`s.score_type IN (${placeholders})`);
    scoreParams.push(...normalizedTypes);
  }

  const [scoreRows] = await pool.execute(
    `SELECT
       s.id,
       s.snapshot_id,
       s.insight_date,
       s.score_type,
       s.score_value,
       s.score_band,
       s.model_version,
       s.synthetic_only,
       s.explanation,
       s.created_at,
       s.updated_at
     FROM user_insight_scores s
     WHERE ${scoreWhereParts.join(' AND ')}
     ORDER BY s.insight_date DESC, s.created_at DESC
     LIMIT ?`,
    [...scoreParams, normalizedLimit],
  );

  const [snapshotRows] = await pool.execute(
    `SELECT
       hs.id,
       hs.snapshot_date,
       hs.source,
       hs.hours_sleep,
       hs.stress_level,
       hs.hydration_liters,
       hs.daily_steps,
       hs.resting_heart_rate,
       hs.blood_pressure_systolic,
       hs.blood_pressure_diastolic,
       hs.weight_kg,
       hs.bmi,
       hs.notes,
       hs.raw_payload,
       hs.created_at,
       hs.updated_at
     FROM user_health_snapshots hs
     WHERE hs.user_id = ?
       AND hs.snapshot_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY hs.snapshot_date DESC, hs.created_at DESC
     LIMIT ?`,
    [normalizedUserId, normalizedDays, normalizedLimit],
  );

  const trendMap = new Map();
  const latestScores = {};

  scoreRows.forEach((row) => {
    const date = String(row.insight_date || '').slice(0, 10);
    if (!trendMap.has(date)) trendMap.set(date, emptyTrendRow(date));

    const scoreType = String(row.score_type || '').trim();
    const scoreValue = toNumberOrNull(row.score_value);
    if (scoreType && Object.prototype.hasOwnProperty.call(trendMap.get(date), scoreType)) {
      trendMap.get(date)[scoreType] = scoreValue;
    }

    if (scoreType && !latestScores[scoreType]) {
      latestScores[scoreType] = {
        value: scoreValue,
        band: row.score_band || 'unknown',
        date,
      };
    }
  });

  const snapshots = snapshotRows.map((row) => ({
    id: Number(row.id),
    date: String(row.snapshot_date || '').slice(0, 10),
    source: row.source,
    hoursSleep: toNumberOrNull(row.hours_sleep),
    stressLevel: toNumberOrNull(row.stress_level),
    hydrationLiters: toNumberOrNull(row.hydration_liters),
    dailySteps: toNumberOrNull(row.daily_steps),
    restingHeartRate: toNumberOrNull(row.resting_heart_rate),
    bloodPressureSystolic: toNumberOrNull(row.blood_pressure_systolic),
    bloodPressureDiastolic: toNumberOrNull(row.blood_pressure_diastolic),
    weightKg: toNumberOrNull(row.weight_kg),
    bmi: toNumberOrNull(row.bmi),
    notes: row.notes || null,
    rawPayload: includeRawPayload ? parseJsonField(row.raw_payload) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const scores = scoreRows.map((row) => ({
    id: Number(row.id),
    snapshotId: row.snapshot_id != null ? Number(row.snapshot_id) : null,
    date: String(row.insight_date || '').slice(0, 10),
    type: row.score_type,
    value: toNumberOrNull(row.score_value),
    band: row.score_band || 'unknown',
    modelVersion: row.model_version,
    syntheticOnly: !!row.synthetic_only,
    explanation: includeExplanation ? parseJsonField(row.explanation) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const trend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    userId: normalizedUserId,
    range: {
      days: normalizedDays,
      fromDate: new Date(Date.now() - (normalizedDays * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
      toDate: new Date().toISOString().slice(0, 10),
    },
    filters: {
      scoreTypes: normalizedTypes,
      includeExplanation,
      includeRawPayload,
      limit: normalizedLimit,
    },
    counts: {
      snapshots: snapshots.length,
      scores: scores.length,
      trendDays: trend.length,
    },
    latestScores,
    trend,
    snapshots,
    scores,
  };
};
