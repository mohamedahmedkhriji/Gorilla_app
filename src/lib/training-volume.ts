export type VolumeRange = '4w' | '8w' | 'all';

export type VolumeSummarySet = {
  reps?: number | string | null;
  weight?: number | string | null;
};

export type VolumeSummaryExercise = {
  name?: string | null;
  sets?: VolumeSummarySet[] | null;
  totalSets?: number | string | null;
  volume?: number | string | null;
};

export type VolumeWorkoutSummary = {
  id?: number | string | null;
  summaryDate?: string | null;
  summary_date?: string | null;
  workoutName?: string | null;
  workout_name?: string | null;
  totalVolume?: number | string | null;
  total_volume?: number | string | null;
  recordsCount?: number | string | null;
  records_count?: number | string | null;
  exercises?: VolumeSummaryExercise[] | null;
};

export type VolumeBucket = {
  key: string;
  label: string;
  volumeKg: number;
  workoutCount: number;
  setCount: number;
};

export type VolumeAggregation = {
  workouts: VolumeWorkoutSummary[];
  totalVolumeKg: number;
  totalSets: number;
  workoutCount: number;
  averagePerWorkoutKg: number;
  buckets: VolumeBucket[];
  previousTotalVolumeKg: number;
  percentChange: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toFiniteNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const getWorkoutDateKey = (summary: VolumeWorkoutSummary) => {
  const raw = String(summary.summaryDate || summary.summary_date || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toISOString().slice(0, 10);
};

export const getWorkoutTitle = (summary: VolumeWorkoutSummary) =>
  String(summary.workoutName || summary.workout_name || 'Workout').trim() || 'Workout';

export const getSetVolumeKg = (set: VolumeSummarySet) => {
  const reps = Math.max(0, toFiniteNumber(set.reps));
  const weight = Math.max(0, toFiniteNumber(set.weight));
  return reps * weight;
};

export const getWorkoutSetCount = (summary: VolumeWorkoutSummary) => {
  const exerciseSets = (summary.exercises || []).reduce((total, exercise) => {
    if (Array.isArray(exercise?.sets) && exercise.sets.length > 0) {
      return total + exercise.sets.filter((set) => toFiniteNumber(set?.reps) > 0).length;
    }
    return total + Math.max(0, Math.round(toFiniteNumber(exercise?.totalSets)));
  }, 0);

  return exerciseSets || Math.max(0, Math.round(toFiniteNumber(summary.recordsCount ?? summary.records_count)));
};

export const getWorkoutVolumeKg = (summary: VolumeWorkoutSummary) => {
  const storedVolume = toFiniteNumber(summary.totalVolume ?? summary.total_volume);
  if (storedVolume > 0) return storedVolume;

  return (summary.exercises || []).reduce((total, exercise) => {
    const exerciseStoredVolume = toFiniteNumber(exercise?.volume);
    if (exerciseStoredVolume > 0) return total + exerciseStoredVolume;

    const setVolume = (exercise?.sets || []).reduce((setTotal, set) => setTotal + getSetVolumeKg(set), 0);
    return total + setVolume;
  }, 0);
};

export const formatTrainingVolume = (valueKg: number) => {
  const safeKg = Math.max(0, toFiniteNumber(valueKg));
  if (safeKg >= 1000) {
    const tons = safeKg / 1000;
    const formatted = tons >= 10 || Number.isInteger(tons)
      ? Math.round(tons).toLocaleString()
      : tons.toFixed(1);
    return `${formatted} t`;
  }
  return `${Math.round(safeKg).toLocaleString()} kg`;
};

export const getRangeStartDate = (range: VolumeRange, now = new Date()) => {
  if (range === 'all') return null;
  const days = range === '8w' ? 56 : 28;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
};

const getPreviousRangeStartDate = (range: VolumeRange, currentStart: Date | null) => {
  if (!currentStart || range === 'all') return null;
  const days = range === '8w' ? 56 : 28;
  const start = new Date(currentStart);
  start.setDate(start.getDate() - days);
  return start;
};

const isInRange = (summary: VolumeWorkoutSummary, start: Date | null, end: Date) => {
  const key = getWorkoutDateKey(summary);
  if (!key) return false;
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  if (date > end) return false;
  return !start || date >= start;
};

const formatBucketLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const aggregateTrainingVolume = (
  summaries: VolumeWorkoutSummary[],
  range: VolumeRange,
  now = new Date(),
): VolumeAggregation => {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = getRangeStartDate(range, end);
  const previousStart = getPreviousRangeStartDate(range, start);

  const sorted = summaries
    .filter((summary) => getWorkoutVolumeKg(summary) > 0 || getWorkoutSetCount(summary) > 0)
    .sort((a, b) => getWorkoutDateKey(a).localeCompare(getWorkoutDateKey(b)));

  const current = sorted.filter((summary) => isInRange(summary, start, end));
  const previous = previousStart && start
    ? sorted.filter((summary) => isInRange(summary, previousStart, new Date(start.getTime() - DAY_MS)))
    : [];

  const bucketMap = new Map<string, VolumeBucket>();

  current.forEach((summary) => {
    const key = getWorkoutDateKey(summary);
    const existing = bucketMap.get(key) || {
      key,
      label: formatBucketLabel(key),
      volumeKg: 0,
      workoutCount: 0,
      setCount: 0,
    };
    existing.volumeKg += getWorkoutVolumeKg(summary);
    existing.workoutCount += 1;
    existing.setCount += getWorkoutSetCount(summary);
    bucketMap.set(key, existing);
  });

  const totalVolumeKg = current.reduce((total, summary) => total + getWorkoutVolumeKg(summary), 0);
  const previousTotalVolumeKg = previous.reduce((total, summary) => total + getWorkoutVolumeKg(summary), 0);
  const totalSets = current.reduce((total, summary) => total + getWorkoutSetCount(summary), 0);
  const workoutCount = current.length;

  return {
    workouts: current.slice().reverse(),
    totalVolumeKg,
    totalSets,
    workoutCount,
    averagePerWorkoutKg: workoutCount > 0 ? totalVolumeKg / workoutCount : 0,
    buckets: Array.from(bucketMap.values()),
    previousTotalVolumeKg,
    percentChange: previousTotalVolumeKg > 0
      ? ((totalVolumeKg - previousTotalVolumeKg) / previousTotalVolumeKg) * 100
      : null,
  };
};

export const getVolumeTrendStatus = (aggregation: VolumeAggregation) => {
  if (aggregation.workoutCount <= 0) return 'No data yet';
  if (aggregation.workoutCount < 3 || aggregation.percentChange == null) return 'More data needed';
  const rounded = Math.round(aggregation.percentChange);
  if (rounded > 0) return `Up ${rounded}% vs previous period`;
  if (rounded < 0) return `Down ${Math.abs(rounded)}% vs previous period`;
  return 'Flat vs previous period';
};
