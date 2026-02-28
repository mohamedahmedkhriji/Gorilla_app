/* eslint-env node */

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clampScore = (value, min = 0, max = 100) => {
  const n = toNumberOrNull(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Number(n.toFixed(2))));
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'oui'].includes(normalized);
};

const toComponentScore = ({ classification, reverse = false }) => {
  const normalized = String(classification || '').trim().toLowerCase();
  if (!normalized || normalized === 'unknown') return null;

  if (reverse) {
    if (normalized === 'high') return 35;
    if (normalized === 'average') return 70;
    if (normalized === 'low') return 85;
    return null;
  }

  if (normalized === 'high') return 85;
  if (normalized === 'average') return 70;
  if (normalized === 'low') return 35;
  return null;
};

const dedupe = (items = []) => Array.from(new Set(items.filter(Boolean)));

export const computeUserAnalysisScoring = ({ input = {}, classifications = {} } = {}) => {
  const componentConfig = [
    { key: 'sleep', label: 'Sleep', weight: 0.2, reverse: false },
    { key: 'stress', label: 'Stress', weight: 0.18, reverse: true },
    { key: 'steps', label: 'Daily Steps', weight: 0.15, reverse: false },
    { key: 'hydration', label: 'Hydration', weight: 0.12, reverse: false },
    { key: 'restingHeartRate', label: 'Resting HR', weight: 0.15, reverse: true },
    { key: 'systolic', label: 'Systolic BP', weight: 0.1, reverse: true },
    { key: 'diastolic', label: 'Diastolic BP', weight: 0.1, reverse: true },
  ];

  const components = componentConfig.map((cfg) => {
    const classification = classifications[cfg.key] || 'unknown';
    const score = toComponentScore({ classification, reverse: cfg.reverse });
    return {
      key: cfg.key,
      label: cfg.label,
      weight: cfg.weight,
      classification,
      score,
    };
  });

  const validComponents = components.filter((component) => Number.isFinite(component.score));
  const totalWeight = validComponents.reduce((acc, item) => acc + item.weight, 0);
  const weightedScore = totalWeight > 0
    ? validComponents.reduce((acc, item) => acc + (item.score * item.weight), 0) / totalWeight
    : 50;

  const hoursSleep = toNumberOrNull(input.hoursSleep ?? input.hours_sleep);
  const stressLevel = toNumberOrNull(input.stressLevel ?? input.stress_level);
  const dailySteps = toNumberOrNull(input.dailySteps ?? input.daily_steps);
  const hydrationLevel = toNumberOrNull(input.hydrationLevel ?? input.hydration_level);
  const restingHeartRate = toNumberOrNull(input.restingHeartRate ?? input.resting_heart_rate);
  const systolic = toNumberOrNull(input.systolic ?? input.blood_pressure_systolic);
  const diastolic = toNumberOrNull(input.diastolic ?? input.blood_pressure_diastolic);
  const smokingStatus = String(input.smokingStatus ?? input.smoking_status ?? '').trim().toLowerCase();
  const painLevel = toNumberOrNull(input.painLevel ?? input.pain_level ?? input.soreness_level);
  const injuryReported = toBoolean(input.injuryReported ?? input.injury_reported ?? input.hasInjury ?? input.has_injury);
  const chestPain = toBoolean(input.chestPain ?? input.chest_pain);
  const dizziness = toBoolean(input.dizziness);

  const observed = [hoursSleep, stressLevel, dailySteps, hydrationLevel, restingHeartRate, systolic, diastolic];
  const presentCount = observed.filter((value) => Number.isFinite(value)).length;
  const coverageScore = (presentCount / observed.length) * 100;

  let consistencyScore = 100;
  if (Number.isFinite(systolic) && Number.isFinite(diastolic) && systolic < diastolic) consistencyScore -= 30;
  if (Number.isFinite(systolic) && (systolic < 80 || systolic > 240)) consistencyScore -= 20;
  if (Number.isFinite(diastolic) && (diastolic < 40 || diastolic > 140)) consistencyScore -= 20;
  if (Number.isFinite(restingHeartRate) && (restingHeartRate < 30 || restingHeartRate > 220)) consistencyScore -= 15;
  consistencyScore = Math.max(0, consistencyScore);

  const confidenceScore = clampScore((coverageScore * 0.7) + (consistencyScore * 0.3)) ?? 0;

  const flags = [];
  const recommendations = [];

  const highBloodPressure = Number.isFinite(systolic) && Number.isFinite(diastolic) && (systolic >= 140 || diastolic >= 90);
  const elevatedBloodPressure = Number.isFinite(systolic) && Number.isFinite(diastolic) && !highBloodPressure && (systolic >= 130 || diastolic >= 85);
  const criticalBloodPressure = Number.isFinite(systolic) && Number.isFinite(diastolic) && (systolic >= 160 || diastolic >= 100);
  const overreaching = classifications.sleep === 'low' && classifications.stress === 'high' && classifications.restingHeartRate === 'high';
  const highPain = Number.isFinite(painLevel) && painLevel >= 7;
  const moderatePain = Number.isFinite(painLevel) && painLevel >= 4 && painLevel < 7;
  const needsCardiacCaution = chestPain || dizziness;

  if (criticalBloodPressure) {
    flags.push({
      code: 'critical_bp',
      severity: 'critical',
      message: 'Blood pressure is in a high-risk range for training stress.',
    });
    recommendations.push('Pause high-intensity training and seek professional medical assessment.');
  } else if (highBloodPressure) {
    flags.push({
      code: 'high_bp',
      severity: 'high',
      message: 'Blood pressure is above conservative training thresholds.',
    });
    recommendations.push('Reduce intensity and monitor blood pressure before progressing load.');
  } else if (elevatedBloodPressure) {
    flags.push({
      code: 'elevated_bp',
      severity: 'moderate',
      message: 'Blood pressure is elevated compared with target ranges.',
    });
    recommendations.push('Keep sessions moderate and prioritize recovery this week.');
  }

  if (injuryReported || highPain) {
    flags.push({
      code: 'injury_or_high_pain',
      severity: 'high',
      message: 'Injury signal or high pain level indicates reduced training capacity.',
    });
    recommendations.push('Shift to pain-free movements and reduce volume until symptoms improve.');
  } else if (moderatePain) {
    flags.push({
      code: 'moderate_pain',
      severity: 'moderate',
      message: 'Moderate pain suggests caution for heavy loading.',
    });
    recommendations.push('Use lighter loads and avoid max-effort sets until pain decreases.');
  }

  if (overreaching) {
    flags.push({
      code: 'overreaching_pattern',
      severity: 'high',
      message: 'Sleep/stress/resting-HR pattern suggests accumulated fatigue.',
    });
    recommendations.push('Schedule a deload week: reduce total volume and prioritize sleep.');
  }

  if (needsCardiacCaution) {
    flags.push({
      code: 'cardiac_symptom_flag',
      severity: 'critical',
      message: 'Reported chest pain or dizziness requires conservative handling.',
    });
    recommendations.push('Avoid intense training and seek prompt medical review for symptoms.');
  }

  if (!flags.length) {
    recommendations.push('Maintain progressive overload with small weekly increases.');
  }

  let trainingMode = 'normal';
  let intensityCap = 'high';
  let volumeAdjustmentPct = 0;
  let coachReviewRequired = false;
  let medicalReviewSuggested = false;

  if (flags.some((f) => f.severity === 'critical')) {
    trainingMode = 'hold_and_review';
    intensityCap = 'very_low';
    volumeAdjustmentPct = -60;
    coachReviewRequired = true;
    medicalReviewSuggested = true;
  } else if (flags.some((f) => f.severity === 'high')) {
    trainingMode = 'conservative';
    intensityCap = 'low';
    volumeAdjustmentPct = -35;
    coachReviewRequired = true;
  } else if (flags.some((f) => f.severity === 'moderate')) {
    trainingMode = 'reduced';
    intensityCap = 'moderate';
    volumeAdjustmentPct = -20;
  }

  let recoveryScore = clampScore(weightedScore) ?? 50;
  if (trainingMode === 'reduced') recoveryScore = clampScore(recoveryScore - 8) ?? recoveryScore;
  if (trainingMode === 'conservative') recoveryScore = clampScore(recoveryScore - 18) ?? recoveryScore;
  if (trainingMode === 'hold_and_review') recoveryScore = clampScore(Math.min(recoveryScore, 30)) ?? recoveryScore;

  let riskScore = clampScore(100 - recoveryScore) ?? 50;
  if (trainingMode === 'reduced') riskScore = clampScore(riskScore + 6) ?? riskScore;
  if (trainingMode === 'conservative') riskScore = clampScore(riskScore + 14) ?? riskScore;
  if (trainingMode === 'hold_and_review') riskScore = clampScore(Math.max(riskScore, 85)) ?? riskScore;
  if (smokingStatus === 'current') riskScore = clampScore(riskScore + 6) ?? riskScore;

  let readinessScore = clampScore((recoveryScore * 0.82) + (confidenceScore * 0.18)) ?? recoveryScore;
  if (trainingMode === 'reduced') readinessScore = clampScore(readinessScore - 10) ?? readinessScore;
  if (trainingMode === 'conservative') readinessScore = clampScore(readinessScore - 20) ?? readinessScore;
  if (trainingMode === 'hold_and_review') readinessScore = clampScore(Math.min(readinessScore, 20)) ?? readinessScore;

  return {
    version: 'v2_weighted_safety',
    components,
    recoveryScore,
    riskScore,
    confidenceScore,
    readinessScore,
    safety: {
      flags,
      trainingMode,
      intensityCap,
      volumeAdjustmentPct,
      coachReviewRequired,
      medicalReviewSuggested,
      recommendations: dedupe(recommendations),
    },
  };
};

