/* eslint-env node */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { computeUserAnalysisScoring } from './insightScoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATASET_DIR = path.join(ROOT_DIR, 'dataset');

const DATASET_FILES = {
  onboarding: path.join(DATASET_DIR, 'gym_members_exercise_tracking_synthetic_data.csv'),
  analysis: path.join(DATASET_DIR, 'health_fitness_dataset.csv'),
};

const cache = {
  onboarding: null,
  analysis: null,
  inFlight: null,
};

const toKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseNumber = (value) => {
  const num = Number(String(value ?? '').trim());
  return Number.isFinite(num) ? num : null;
};

const parseCsvRow = (line) => {
  const row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  return row.map((cell) => String(cell ?? '').trim());
};

const addToCount = (counter, key) => {
  const cleanKey = String(key ?? '').trim() || 'unknown';
  counter[cleanKey] = Number(counter[cleanKey] || 0) + 1;
};

const pushIfNumber = (arr, value) => {
  if (Number.isFinite(value)) arr.push(value);
};

const toAverage = (sum, count) => (count > 0 ? Number((sum / count).toFixed(2)) : null);

const percentile = (sortedValues, target) => {
  if (!sortedValues.length || !Number.isFinite(target)) return null;
  let left = 0;
  let right = sortedValues.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedValues[mid] <= target) left = mid + 1;
    else right = mid;
  }
  return Number(((left / sortedValues.length) * 100).toFixed(1));
};

const bmiCategory = (bmi) => {
  if (!Number.isFinite(bmi)) return 'unknown';
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy';
  if (bmi < 30) return 'overweight';
  return 'obesity';
};

const classifyWithBaseline = (value, baseline) => {
  if (!Number.isFinite(value) || !baseline || baseline.count < 2) return 'unknown';
  const variance = Math.max((baseline.sumSquares / baseline.count) - ((baseline.sum / baseline.count) ** 2), 0);
  const stdev = Math.sqrt(variance);
  const mean = baseline.sum / baseline.count;
  if (stdev < 1e-9) return 'average';
  if (value > mean + stdev) return 'high';
  if (value < mean - stdev) return 'low';
  return 'average';
};

const createStat = () => ({ count: 0, sum: 0, sumSquares: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY });

const pushStat = (stat, value) => {
  if (!Number.isFinite(value)) return;
  stat.count += 1;
  stat.sum += value;
  stat.sumSquares += value ** 2;
  stat.min = Math.min(stat.min, value);
  stat.max = Math.max(stat.max, value);
};

const finalizeStat = (stat) => {
  if (!stat || stat.count === 0) {
    return { count: 0, average: null, min: null, max: null, stdev: null };
  }
  const mean = stat.sum / stat.count;
  const variance = Math.max((stat.sumSquares / stat.count) - (mean ** 2), 0);
  return {
    count: stat.count,
    average: Number(mean.toFixed(2)),
    min: Number(stat.min.toFixed(2)),
    max: Number(stat.max.toFixed(2)),
    stdev: Number(Math.sqrt(variance).toFixed(2)),
  };
};

const summarizeOnboardingDataset = () => {
  const filePath = DATASET_FILES.onboarding;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing dataset file: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Onboarding dataset is empty.');
  }

  const header = parseCsvRow(lines[0]).map(toKey);
  const values = {
    age: [],
    bmi: [],
    restingBpm: [],
    caloriesBurned: [],
    workoutFrequency: [],
  };

  const distributions = {
    gender: {},
    workoutType: {},
    experienceLevel: {},
    workoutTypeByGender: {},
  };

  let caloriesSum = 0;
  let caloriesCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvRow(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j += 1) {
      row[header[j]] = cells[j] ?? '';
    }

    const age = parseNumber(row.age);
    const bmi = parseNumber(row.bmi);
    const restingBpm = parseNumber(row.resting_bpm);
    const caloriesBurned = parseNumber(row.calories_burned);
    const workoutFrequency = parseNumber(row.workout_frequency_days_week);
    const gender = String(row.gender || '').trim() || 'unknown';
    const workoutType = String(row.workout_type || '').trim() || 'unknown';
    const levelRaw = parseNumber(row.experience_level);
    const experienceLevel = levelRaw === 1 ? 'beginner' : levelRaw === 2 ? 'intermediate' : levelRaw === 3 ? 'advanced' : 'unknown';

    pushIfNumber(values.age, age);
    pushIfNumber(values.bmi, bmi);
    pushIfNumber(values.restingBpm, restingBpm);
    pushIfNumber(values.caloriesBurned, caloriesBurned);
    pushIfNumber(values.workoutFrequency, workoutFrequency);

    if (Number.isFinite(caloriesBurned)) {
      caloriesSum += caloriesBurned;
      caloriesCount += 1;
    }

    addToCount(distributions.gender, gender);
    addToCount(distributions.workoutType, workoutType);
    addToCount(distributions.experienceLevel, experienceLevel);

    if (!distributions.workoutTypeByGender[gender]) distributions.workoutTypeByGender[gender] = {};
    addToCount(distributions.workoutTypeByGender[gender], workoutType);
  }

  Object.values(values).forEach((arr) => arr.sort((a, b) => a - b));

  return {
    source: path.basename(filePath),
    loadedAt: new Date().toISOString(),
    rowCount: lines.length - 1,
    averages: {
      age: toAverage(values.age.reduce((acc, n) => acc + n, 0), values.age.length),
      bmi: toAverage(values.bmi.reduce((acc, n) => acc + n, 0), values.bmi.length),
      restingBpm: toAverage(values.restingBpm.reduce((acc, n) => acc + n, 0), values.restingBpm.length),
      caloriesBurned: toAverage(caloriesSum, caloriesCount),
      workoutFrequency: toAverage(values.workoutFrequency.reduce((acc, n) => acc + n, 0), values.workoutFrequency.length),
    },
    distributions,
    values,
  };
};

const summarizeAnalysisDataset = async () => {
  const filePath = DATASET_FILES.analysis;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing dataset file: ${filePath}`);
  }

  const stats = {
    age: createStat(),
    bmi: createStat(),
    dailySteps: createStat(),
    hoursSleep: createStat(),
    stressLevel: createStat(),
    hydrationLevel: createStat(),
    restingHeartRate: createStat(),
    systolic: createStat(),
    diastolic: createStat(),
    fitnessLevel: createStat(),
  };

  const distributions = {
    gender: {},
    activityType: {},
    intensity: {},
    smokingStatus: {},
    healthCondition: {},
  };

  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = [];
  let rowCount = 0;
  let isFirstLine = true;

  for await (const line of rl) {
    if (!line || !line.trim()) continue;
    const parsed = parseCsvRow(line);
    if (isFirstLine) {
      header = parsed.map(toKey);
      isFirstLine = false;
      continue;
    }

    rowCount += 1;
    const row = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]] = parsed[i] ?? '';
    }

    pushStat(stats.age, parseNumber(row.age));
    pushStat(stats.bmi, parseNumber(row.bmi));
    pushStat(stats.dailySteps, parseNumber(row.daily_steps));
    pushStat(stats.hoursSleep, parseNumber(row.hours_sleep));
    pushStat(stats.stressLevel, parseNumber(row.stress_level));
    pushStat(stats.hydrationLevel, parseNumber(row.hydration_level));
    pushStat(stats.restingHeartRate, parseNumber(row.resting_heart_rate));
    pushStat(stats.systolic, parseNumber(row.blood_pressure_systolic));
    pushStat(stats.diastolic, parseNumber(row.blood_pressure_diastolic));
    pushStat(stats.fitnessLevel, parseNumber(row.fitness_level));

    addToCount(distributions.gender, row.gender);
    addToCount(distributions.activityType, row.activity_type);
    addToCount(distributions.intensity, row.intensity);
    addToCount(distributions.smokingStatus, row.smoking_status);
    addToCount(distributions.healthCondition, row.health_condition);
  }

  return {
    source: path.basename(filePath),
    loadedAt: new Date().toISOString(),
    rowCount,
    stats,
    summary: {
      age: finalizeStat(stats.age),
      bmi: finalizeStat(stats.bmi),
      dailySteps: finalizeStat(stats.dailySteps),
      hoursSleep: finalizeStat(stats.hoursSleep),
      stressLevel: finalizeStat(stats.stressLevel),
      hydrationLevel: finalizeStat(stats.hydrationLevel),
      restingHeartRate: finalizeStat(stats.restingHeartRate),
      bloodPressureSystolic: finalizeStat(stats.systolic),
      bloodPressureDiastolic: finalizeStat(stats.diastolic),
      fitnessLevel: finalizeStat(stats.fitnessLevel),
    },
    distributions,
  };
};

const ensureLoaded = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && cache.onboarding && cache.analysis) {
    return cache;
  }

  if (!forceRefresh && cache.inFlight) return cache.inFlight;

  cache.inFlight = (async () => {
    cache.onboarding = summarizeOnboardingDataset();
    cache.analysis = await summarizeAnalysisDataset();
    return cache;
  })();

  try {
    await cache.inFlight;
  } finally {
    cache.inFlight = null;
  }
  return cache;
};

export const getDatasetOverview = async ({ forceRefresh = false } = {}) => {
  const loaded = await ensureLoaded({ forceRefresh });
  return {
    syntheticOnly: true,
    onboarding: {
      source: loaded.onboarding.source,
      loadedAt: loaded.onboarding.loadedAt,
      rowCount: loaded.onboarding.rowCount,
      averages: loaded.onboarding.averages,
      distributions: loaded.onboarding.distributions,
    },
    analysis: {
      source: loaded.analysis.source,
      loadedAt: loaded.analysis.loadedAt,
      rowCount: loaded.analysis.rowCount,
      summary: loaded.analysis.summary,
      distributions: loaded.analysis.distributions,
    },
  };
};

export const buildOnboardingInsights = async (payload = {}) => {
  const loaded = await ensureLoaded();
  const onboarding = loaded.onboarding;

  const age = parseNumber(payload.age);
  const gender = String(payload.gender || '').trim() || null;
  const weightKg = parseNumber(payload.weightKg ?? payload.weight_kg ?? payload.weight);
  const heightMRaw = parseNumber(payload.heightM ?? payload.height_m ?? payload.height);
  const heightCm = parseNumber(payload.heightCm ?? payload.height_cm);
  const workoutFrequency = parseNumber(payload.workoutFrequency ?? payload.workout_frequency);
  const restingBpm = parseNumber(payload.restingBpm ?? payload.resting_bpm);

  const heightM = Number.isFinite(heightMRaw) ? heightMRaw : (Number.isFinite(heightCm) ? heightCm / 100 : null);
  const bmi = Number.isFinite(weightKg) && Number.isFinite(heightM) && heightM > 0 ? Number((weightKg / (heightM ** 2)).toFixed(2)) : null;

  const bmiPercentile = percentile(onboarding.values.bmi, bmi);
  const agePercentile = percentile(onboarding.values.age, age);
  const restingPercentile = percentile(onboarding.values.restingBpm, restingBpm);

  const genderWorkouts = gender && onboarding.distributions.workoutTypeByGender[gender]
    ? onboarding.distributions.workoutTypeByGender[gender]
    : onboarding.distributions.workoutType;

  const suggestedWorkoutTypes = Object.entries(genderWorkouts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  let suggestedLevel = 'Beginner';
  if (Number.isFinite(workoutFrequency)) {
    if (workoutFrequency >= 5) suggestedLevel = 'Advanced';
    else if (workoutFrequency >= 3) suggestedLevel = 'Intermediate';
  }

  return {
    syntheticOnly: true,
    metrics: {
      age,
      gender,
      bmi,
      workoutFrequency,
      restingBpm,
    },
    baselinePosition: {
      agePercentile,
      bmiPercentile,
      restingBpmPercentile: restingPercentile,
    },
    interpretation: {
      bmiCategory: bmiCategory(bmi),
      suggestedExperienceLevel: suggestedLevel,
      suggestedWorkoutTypes,
      notes: [
        'Onboarding suggestions are benchmarked against synthetic data and are for coaching UX only.',
      ],
    },
  };
};

export const buildUserAnalysisInsights = async (payload = {}) => {
  const loaded = await ensureLoaded();
  const baseline = loaded.analysis.stats;

  const hoursSleep = parseNumber(payload.hoursSleep ?? payload.hours_sleep);
  const stressLevel = parseNumber(payload.stressLevel ?? payload.stress_level);
  const dailySteps = parseNumber(payload.dailySteps ?? payload.daily_steps);
  const hydrationLevel = parseNumber(payload.hydrationLevel ?? payload.hydration_level);
  const restingHeartRate = parseNumber(payload.restingHeartRate ?? payload.resting_heart_rate);
  const systolic = parseNumber(payload.systolic ?? payload.blood_pressure_systolic);
  const diastolic = parseNumber(payload.diastolic ?? payload.blood_pressure_diastolic);
  const smokingStatus = String(payload.smokingStatus ?? payload.smoking_status ?? '').trim() || null;

  const classifications = {
    sleep: classifyWithBaseline(hoursSleep, baseline.hoursSleep),
    stress: classifyWithBaseline(stressLevel, baseline.stressLevel),
    steps: classifyWithBaseline(dailySteps, baseline.dailySteps),
    hydration: classifyWithBaseline(hydrationLevel, baseline.hydrationLevel),
    restingHeartRate: classifyWithBaseline(restingHeartRate, baseline.restingHeartRate),
    systolic: classifyWithBaseline(systolic, baseline.systolic),
    diastolic: classifyWithBaseline(diastolic, baseline.diastolic),
  };

  const scoring = computeUserAnalysisScoring({
    input: payload,
    classifications,
  });

  const recommendations = [];
  if (classifications.sleep === 'low') recommendations.push('Increase sleep consistency toward baseline average.');
  if (classifications.stress === 'high') recommendations.push('Reduce stress load or lower workout intensity for recovery days.');
  if (classifications.steps === 'low') recommendations.push('Increase daily movement volume gradually (walking targets).');
  if (classifications.hydration === 'low') recommendations.push('Raise hydration level around sessions and during the day.');
  if (classifications.restingHeartRate === 'high') recommendations.push('Monitor recovery and reduce weekly training load temporarily.');
  if (classifications.systolic === 'high' || classifications.diastolic === 'high') {
    recommendations.push('Blood pressure appears above synthetic baseline; seek professional guidance if persistent.');
  }
  if (smokingStatus && /^current$/i.test(smokingStatus)) {
    recommendations.push('Smoking status is linked with lower fitness outcomes in baseline data.');
  }
  recommendations.push(...(scoring?.safety?.recommendations || []));

  return {
    syntheticOnly: true,
    score: scoring.recoveryScore,
    riskScore: scoring.riskScore,
    confidenceScore: scoring.confidenceScore,
    readinessScore: scoring.readinessScore,
    classifications,
    baselines: loaded.analysis.summary,
    recommendations: [...new Set(recommendations)],
    safety: scoring.safety,
    scoring,
  };
};
