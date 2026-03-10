import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CircleHelp,
  Dumbbell,
  Flame,
  Target,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { getBodyPartImage } from '../../services/bodyPartTheme';

interface StrengthScoreScreenProps {
  onBack: () => void;
}

type RangeKey = 'month' | '6months' | 'year' | 'all';

type StrengthScoreHistoryPoint = {
  bucket: string;
  label: string;
  avgE1RM: number;
  score: number;
};

type StrengthScoreMuscleItem = {
  name: string;
  avgE1RM: number;
  bestE1RM: number;
  score: number;
  tier: string;
};

type StrengthScorePayload = {
  range: RangeKey;
  summary: {
    overallScore: number;
    overallAvgE1RM: number;
    level: string;
    minScale: number;
    maxScale: number;
    samples: number;
  };
  history: StrengthScoreHistoryPoint[];
  muscles: StrengthScoreMuscleItem[];
};

type RecoveryMuscleItem = {
  name: string;
  muscle?: string;
  score: number;
};

type StrengthSupportData = {
  workoutStreakDays: number;
  weeklyCompletionRate: number;
  workoutsCompletedThisWeek: number;
  workoutsPlannedThisWeek: number;
  volumeLoadLast30Days: number;
  setsLoggedLast30Days: number;
  totalPoints: number;
  rank: string;
  totalWorkouts: number;
  overallRecovery: number;
  readyMuscles: number;
  almostReadyMuscles: number;
  damagedMuscles: number;
  recovery: RecoveryMuscleItem[];
};

const getMuscleImage = (muscle: string) => getBodyPartImage(muscle);

const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: 'month', label: 'Month' },
  { key: '6months', label: '6 months' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
];

const defaultSupportData: StrengthSupportData = {
  workoutStreakDays: 0,
  weeklyCompletionRate: 0,
  workoutsCompletedThisWeek: 0,
  workoutsPlannedThisWeek: 0,
  volumeLoadLast30Days: 0,
  setsLoggedLast30Days: 0,
  totalPoints: 0,
  rank: '--',
  totalWorkouts: 0,
  overallRecovery: 100,
  readyMuscles: 0,
  almostReadyMuscles: 0,
  damagedMuscles: 0,
  recovery: [],
};

const getStoredUserId = () => {
  const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const parsedUserId = Number(user?.id || 0);
  return localUserId || parsedUserId;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatMetricNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
};

const formatWeight = (value: number) => `${formatMetricNumber(value)} kg`;

const formatTons = (value: number) => {
  const tons = Number(value || 0) / 1000;
  if (!Number.isFinite(tons) || tons <= 0) return '0t';
  return `${formatMetricNumber(Number(tons.toFixed(1)))}t`;
};

const formatSigned = (value: number, suffix = '') => {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) return `0${suffix}`;
  const sign = normalized > 0 ? '+' : normalized < 0 ? '-' : '';
  return `${sign}${formatMetricNumber(Math.abs(Number(normalized.toFixed(1))))}${suffix}`;
};

const getScoreFillPercent = (score: number) => clamp(((Number(score || 0) - 80) / 240) * 100, 0, 100);

const buildLinePath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');
};

const buildAreaPath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) return '';
  const line = buildLinePath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  return `${line} L ${lastPoint.x},92 L ${firstPoint.x},92 Z`;
};

const getTrendToneClass = (value: number) => {
  if (value > 0) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (value < 0) return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  return 'border-white/10 bg-white/5 text-text-secondary';
};

const getRecoveryToneClass = (value: number) => {
  if (value >= 90) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (value >= 75) return 'border-[#BFFF00]/30 bg-[#BFFF00]/10 text-[#E7FF9C]';
  if (value >= 60) return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
};

export function StrengthScoreScreen({ onBack }: StrengthScoreScreenProps) {
  const [activeRange, setActiveRange] = useState<RangeKey>('6months');
  const [loading, setLoading] = useState(true);
  const [supportLoading, setSupportLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StrengthScorePayload | null>(null);
  const [support, setSupport] = useState<StrengthSupportData>(defaultSupportData);
  const [showInfo, setShowInfo] = useState(false);

  const loadScore = useCallback(async (range: RangeKey) => {
    const userId = getStoredUserId();
    if (!userId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.getStrengthScore(userId, range);
      setData(response as StrengthScorePayload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load strength score.';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSupportingContext = useCallback(async () => {
    const userId = getStoredUserId();
    if (!userId) {
      setSupport(defaultSupportData);
      setSupportLoading(false);
      return;
    }

    setSupportLoading(true);
    const [progressResult, recoveryResult] = await Promise.allSettled([
      api.getProgramProgress(userId),
      api.getRecoveryStatus(userId),
    ]);

    setSupport((current) => {
      const next = { ...current };

      if (progressResult.status === 'fulfilled') {
        const summary = progressResult.value?.summary || {};
        next.workoutStreakDays = Number(summary?.workoutStreakDays || 0);
        next.weeklyCompletionRate = clamp(Number(summary?.weeklyCompletionRate || 0), 0, 100);
        next.workoutsCompletedThisWeek = Number(summary?.workoutsCompletedThisWeek || 0);
        next.workoutsPlannedThisWeek = Number(summary?.workoutsPlannedThisWeek || 0);
        next.volumeLoadLast30Days = Number(summary?.volumeLoadLast30Days || 0);
        next.setsLoggedLast30Days = Number(summary?.setsLoggedLast30Days || 0);
        next.totalPoints = Number(summary?.totalPoints || 0);
        next.rank = String(summary?.rank || '--');
        next.totalWorkouts = Number(summary?.totalWorkouts || summary?.completedWorkouts || 0);
      }

      if (recoveryResult.status === 'fulfilled') {
        const recoveryData = recoveryResult.value || {};
        const recoverySummary = recoveryData?.summary || {};
        next.overallRecovery = clamp(Number(recoveryData?.overallRecovery ?? 100), 0, 100);
        next.readyMuscles = Number(recoverySummary?.readyMuscles || 0);
        next.almostReadyMuscles = Number(recoverySummary?.almostReadyMuscles || 0);
        next.damagedMuscles = Number(recoverySummary?.damagedMuscles || 0);
        next.recovery = Array.isArray(recoveryData?.recovery)
          ? recoveryData.recovery.map((item: any) => ({
              name: String(item?.name || item?.muscle || ''),
              muscle: item?.muscle ? String(item.muscle) : undefined,
              score: clamp(Number(item?.score || 0), 0, 100),
            }))
          : [];
      }

      return next;
    });

    setSupportLoading(false);
  }, []);

  useEffect(() => {
    void loadScore(activeRange);
  }, [activeRange, loadScore]);

  useEffect(() => {
    void loadSupportingContext();
  }, [loadSupportingContext]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadScore(activeRange);
      void loadSupportingContext();
    };
    window.addEventListener('gamification-updated', handleRefresh);
    window.addEventListener('recovery-updated', handleRefresh);

    return () => {
      window.removeEventListener('gamification-updated', handleRefresh);
      window.removeEventListener('recovery-updated', handleRefresh);
    };
  }, [activeRange, loadScore, loadSupportingContext]);

  useEffect(() => {
    if (!showInfo) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowInfo(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showInfo]);

  const chart = useMemo(() => {
    const history = Array.isArray(data?.history) ? data.history : [];
    if (!history.length) {
      return {
        linePath: '',
        areaPath: '',
        points: [] as Array<{ x: number; y: number; label: string }>,
        minScore: 0,
        maxScore: 0,
        midScore: 0,
      };
    }

    const scores = history.map((entry) => Number(entry.score || 0));
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore || 1;

    const points = history.map((entry, index) => {
      const x = history.length === 1 ? 50 : 4 + ((index / (history.length - 1)) * 92);
      const y = 90 - (((Number(entry.score || 0) - minScore) / range) * 70);
      return { x, y, label: entry.label };
    });

    return {
      linePath: buildLinePath(points),
      areaPath: buildAreaPath(points),
      points,
      minScore,
      maxScore,
      midScore: Math.round((minScore + maxScore) / 2),
    };
  }, [data?.history]);

  const summary = data?.summary;
  const history = Array.isArray(data?.history) ? data.history : [];
  const muscles = Array.isArray(data?.muscles) ? data.muscles : [];
  const hasStrengthData = Boolean(Number(summary?.samples || 0) > 0 || history.length > 0 || muscles.length > 0);
  const overallScore = Number(summary?.overallScore || 0);
  const minScale = hasStrengthData ? Number(summary?.minScale || 80) : 80;
  const maxScale = hasStrengthData ? Number(summary?.maxScale || 320) : 320;
  const progressPercent = maxScale > minScale
    ? Math.max(0, Math.min(100, ((overallScore - minScale) / (maxScale - minScale)) * 100))
    : 0;
  const activeRangeLabel = rangeOptions.find((option) => option.key === activeRange)?.label || '6 months';
  const firstHistoryPoint = history[0] || null;
  const lastHistoryPoint = history.length ? history[history.length - 1] : null;
  const previousHistoryPoint = history.length > 1 ? history[history.length - 2] : null;
  const rangeDelta = firstHistoryPoint && lastHistoryPoint ? Number((lastHistoryPoint.score - firstHistoryPoint.score).toFixed(1)) : 0;
  const recentDelta = previousHistoryPoint && lastHistoryPoint ? Number((lastHistoryPoint.score - previousHistoryPoint.score).toFixed(1)) : 0;
  const rangeDeltaPct = firstHistoryPoint && firstHistoryPoint.score > 0 && lastHistoryPoint
    ? Number((((lastHistoryPoint.score - firstHistoryPoint.score) / firstHistoryPoint.score) * 100).toFixed(1))
    : 0;
  const sampleCount = Number(summary?.samples || 0);
  const averageMuscleScore = muscles.length
    ? Math.round(muscles.reduce((sum, muscle) => sum + Number(muscle.score || 0), 0) / muscles.length)
    : 0;
  const trainingDensity = history.length
    ? Number((sampleCount / history.length).toFixed(1))
    : 0;
  const strongestMuscle = muscles[0] || null;
  const weakestMuscle = muscles.length ? muscles[muscles.length - 1] : null;
  const displayLevel = hasStrengthData ? String(summary?.level || 'Beginner') : 'No score yet';
  const scoreRingPercent = hasStrengthData ? progressPercent : 0;
  const recoveryByName = useMemo(
    () => new Map(support.recovery.map((item) => [item.name.trim().toLowerCase(), item])),
    [support.recovery],
  );
  const strongestRecovery = strongestMuscle ? recoveryByName.get(strongestMuscle.name.trim().toLowerCase()) : null;
  const weakestRecovery = weakestMuscle ? recoveryByName.get(weakestMuscle.name.trim().toLowerCase()) : null;
  const momentumTitle = !hasStrengthData
    ? 'Waiting for your first weighted sessions'
    : rangeDelta > 6
      ? 'Strength is climbing'
      : rangeDelta > 0
        ? 'Small upward trend'
        : rangeDelta < -6
          ? 'You are off your recent peak'
          : rangeDelta < 0
            ? 'Slight dip in output'
            : 'Holding steady';
  const momentumDescription = !hasStrengthData
    ? 'Complete weighted sets and this screen will turn into a real strength dashboard.'
    : history.length > 1
      ? `${formatSigned(rangeDelta, ' pts')} across the current ${activeRangeLabel.toLowerCase()} window, with ${formatSigned(rangeDeltaPct, '%')} change from your baseline.`
      : 'One tracked point so far. Add more sessions to unlock trend direction.';

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title="Strength Score"
          onBack={onBack}
          rightElement={(
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-card/70 text-text-secondary transition-colors hover:border-accent/30 hover:text-text-primary"
              aria-label="Strength score info"
            >
              <CircleHelp size={16} />
            </button>
          )}
        />
        <div className="space-y-5">
          <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.24),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_38%)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_55%)]" />
            <div className="relative">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-primary">
                      {displayLevel}
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getTrendToneClass(rangeDelta)}`}>
                      {history.length > 1 ? `${formatSigned(rangeDelta, ' pts')} trend` : 'Trend pending'}
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRecoveryToneClass(support.overallRecovery)}`}>
                      Recovery {supportLoading ? '--' : `${Math.round(support.overallRecovery)}%`}
                    </div>
                  </div>

                  <div>
                    <div className="font-electrolize text-[42px] leading-none text-white sm:text-[54px]">
                      {loading ? '--' : hasStrengthData ? overallScore : '--'}
                    </div>
                    <div className="mt-3 max-w-xl text-sm text-text-secondary">
                      {hasStrengthData
                        ? `Avg E1RM ${formatWeight(Number(summary?.overallAvgE1RM || 0))} from ${sampleCount} weighted exercise-day samples in the selected range.`
                        : 'No strength score yet. Complete weighted sets and this page will start charting your score, muscle ranking, and trend.'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">Rank</div>
                      <div className="mt-2 text-lg font-semibold text-white">{supportLoading ? '--' : support.rank}</div>
                      <div className="text-xs text-text-secondary">{supportLoading ? '--' : `${support.totalPoints.toLocaleString()} pts`}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">This Week</div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {supportLoading ? '--' : `${support.workoutsCompletedThisWeek}/${support.workoutsPlannedThisWeek || 0}`}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {supportLoading ? '--' : `${support.weeklyCompletionRate}% completion`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">30D Load</div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {supportLoading ? '--' : formatTons(support.volumeLoadLast30Days)}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {supportLoading ? '--' : `${support.setsLoggedLast30Days} sets logged`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">Streak</div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {supportLoading ? '--' : support.workoutStreakDays}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {supportLoading ? '--' : support.workoutStreakDays === 1 ? 'workout day' : 'workout days'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mx-auto flex w-full max-w-[220px] shrink-0 flex-col items-center lg:mx-0">
                  <div
                    className="relative flex h-32 w-32 items-center justify-center rounded-full border border-white/10 shadow-[0_0_50px_rgba(244,63,94,0.12)] sm:h-40 sm:w-40"
                    style={{
                      background: `conic-gradient(#fb7185 0 ${scoreRingPercent}%, rgba(255,255,255,0.08) ${scoreRingPercent}% 100%)`,
                    }}
                  >
                    <div className="flex h-[106px] w-[106px] flex-col items-center justify-center rounded-full border border-white/10 bg-background/95 px-3 text-center sm:h-[134px] sm:w-[134px]">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">Score</div>
                      <div className="mt-1 font-electrolize text-3xl text-white sm:text-4xl">
                        {loading ? '--' : hasStrengthData ? overallScore : '--'}
                      </div>
                      <div className="mt-1 max-w-full break-words text-[11px] leading-4 text-text-secondary sm:text-xs">
                        {history.length > 1 ? `${formatSigned(recentDelta, ' pts')} recent` : activeRangeLabel}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 w-full max-w-[220px]">
                    <div className="mb-1 flex items-center justify-between text-xs text-text-tertiary">
                      <span className="truncate">Score range</span>
                      <span className="shrink-0">{minScale} - {maxScale}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-[#BFFF00]"
                        style={{ width: `${scoreRingPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Momentum</div>
                  <div className="mt-2 text-2xl font-electrolize text-white">
                    {history.length > 1 ? formatSigned(rangeDelta) : '--'}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {history.length > 1 ? `${activeRangeLabel} window` : 'Need more history'}
                  </div>
                </div>
                <TrendingUp size={18} className="text-emerald-300" />
              </div>
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Weighted Samples</div>
                  <div className="mt-2 text-2xl font-electrolize text-white">{loading ? '--' : sampleCount}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {loading || !history.length ? 'Range still building' : `${trainingDensity} samples per bucket`}
                  </div>
                </div>
                <BarChart3 size={18} className="text-sky-300" />
              </div>
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Muscle Average</div>
                  <div className="mt-2 text-2xl font-electrolize text-white">{loading ? '--' : averageMuscleScore || '--'}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {loading || !strongestMuscle ? 'Ranking pending' : `${muscles.length} muscles tracked`}
                  </div>
                </div>
                <Dumbbell size={18} className="text-violet-300" />
              </div>
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Readiness</div>
                  <div className="mt-2 text-2xl font-electrolize text-white">
                    {supportLoading ? '--' : `${Math.round(support.overallRecovery)}%`}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {supportLoading ? '--' : `${support.readyMuscles} ready | ${support.damagedMuscles} need rest`}
                  </div>
                </div>
                <Activity size={18} className="text-[#BFFF00]" />
              </div>
            </Card>
          </div>

          <Card className="border border-white/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">Strength History</div>
                <h3 className="mt-2 break-words text-2xl font-semibold text-white sm:text-3xl">{momentumTitle}</h3>
                <p className="mt-2 max-w-2xl text-sm text-text-secondary">{momentumDescription}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-3 lg:min-w-[260px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-text-tertiary">Start</div>
                  <div className="mt-1 font-electrolize text-lg text-white">
                    {firstHistoryPoint ? firstHistoryPoint.score : '--'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-text-tertiary">Current</div>
                  <div className="mt-1 font-electrolize text-lg text-white">
                    {lastHistoryPoint ? lastHistoryPoint.score : '--'}
                  </div>
                </div>
                <div className={`rounded-2xl border px-3 py-3 ${getTrendToneClass(rangeDelta)}`}>
                  <div className="text-current/70">Change</div>
                  <div className="mt-1 font-electrolize text-lg">
                    {history.length > 1 ? formatSigned(rangeDelta) : '--'}
                  </div>
                </div>
              </div>
            </div>

              <div className="mt-3 grid grid-cols-2 rounded-xl border border-white/10 bg-card/70 p-1 sm:grid-cols-4">
                {rangeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setActiveRange(option.key)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                      activeRange === option.key
                        ? 'bg-white/12 text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="relative mt-4 h-72 overflow-hidden rounded-3xl border border-white/10 bg-card/70 p-3">
                {loading ? (
                  <div className="h-full animate-pulse rounded-2xl bg-white/5" />
                ) : error ? (
                  <div className="flex h-full items-center justify-center text-sm text-rose-300">{error}</div>
                ) : !chart.points.length ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-text-secondary">
                    Not enough weighted sets yet. Log completed weighted sets to start building your trend.
                  </div>
                ) : (
                  <>
                    <div className="pointer-events-none absolute inset-y-3 right-3 flex flex-col justify-between text-[10px] text-text-tertiary">
                      <span>{chart.maxScore}</span>
                      <span>{chart.midScore}</span>
                      <span>{chart.minScore}</span>
                    </div>
                    <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="strength-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FB7185" />
                          <stop offset="55%" stopColor="#F59E0B" />
                          <stop offset="100%" stopColor="#BFFF00" />
                        </linearGradient>
                        <linearGradient id="strength-fill-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(251,113,133,0.32)" />
                          <stop offset="100%" stopColor="rgba(251,113,133,0.02)" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="15" x2="100" y2="15" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                      <line x1="0" y1="92" x2="100" y2="92" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                      <path d={chart.areaPath} fill="url(#strength-fill-gradient)" />
                      <path d={chart.linePath} fill="none" stroke="url(#strength-line-gradient)" strokeWidth="2.2" strokeLinecap="round" />
                      {chart.points.map((point, index) => (
                        <circle
                          key={`${point.x}-${point.y}`}
                          cx={point.x}
                          cy={point.y}
                          r={index === chart.points.length - 1 ? '1.8' : '1.25'}
                          fill={index === chart.points.length - 1 ? '#BFFF00' : '#F8FAFC'}
                        />
                      ))}
                    </svg>
                  </>
                )}
              </div>

              {!!chart.points.length && (
                <div className="mt-3 flex flex-col gap-1 text-xs text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
                  <span>{chart.points[0]?.label || '-'}</span>
                  <span className="text-center">
                    {history.length > 1 ? `${formatSigned(recentDelta, ' pts')} vs previous bucket` : 'First tracked bucket'}
                  </span>
                  <span className="text-right">{chart.points[chart.points.length - 1]?.label || '-'}</span>
                </div>
              )}
          </Card>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Peak Muscle</div>
                  <div className="mt-2 break-words text-2xl font-semibold text-white">{strongestMuscle?.name || '--'}</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {strongestMuscle ? `${strongestMuscle.tier} at ${strongestMuscle.score}` : 'Need more strength data'}
                  </div>
                  <div className="mt-3 break-words text-xs text-text-tertiary">
                    {strongestMuscle ? `Avg ${formatWeight(strongestMuscle.avgE1RM)} | Best ${formatWeight(strongestMuscle.bestE1RM)}` : 'Log more weighted sets to rank muscles.'}
                  </div>
                </div>
                <Trophy size={18} className="text-amber-300" />
              </div>
              {strongestRecovery && (
                <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRecoveryToneClass(strongestRecovery.score)}`}>
                  Recovery {Math.round(strongestRecovery.score)}%
                </div>
              )}
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Development Lane</div>
                  <div className="mt-2 break-words text-2xl font-semibold text-white">{weakestMuscle?.name || '--'}</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {weakestMuscle ? `${weakestMuscle.tier} at ${weakestMuscle.score}` : 'Need more strength data'}
                  </div>
                  <div className="mt-3 break-words text-xs text-text-tertiary">
                    {weakestMuscle ? `Best ${formatWeight(weakestMuscle.bestE1RM)} | Opportunity ${formatSigned(strongestMuscle ? strongestMuscle.score - weakestMuscle.score : 0, ' pts')}` : 'This card highlights the muscle furthest from your top score.'}
                  </div>
                </div>
                <Target size={18} className="text-sky-300" />
              </div>
              {weakestRecovery && (
                <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRecoveryToneClass(weakestRecovery.score)}`}>
                  Recovery {Math.round(weakestRecovery.score)}%
                </div>
              )}
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Training Status</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {supportLoading ? '--' : `${support.workoutsCompletedThisWeek}/${support.workoutsPlannedThisWeek || 0}`}
                  </div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {supportLoading ? '--' : `${support.weeklyCompletionRate}% plan completion this week`}
                  </div>
                  <div className="mt-3 break-words text-xs text-text-tertiary">
                    {supportLoading
                      ? '--'
                      : `${support.readyMuscles} muscles ready, ${support.almostReadyMuscles} almost ready, ${support.damagedMuscles} need more recovery.`}
                  </div>
                </div>
                <Flame size={18} className="text-rose-300" />
              </div>
            </Card>
          </div>

          <Card className="border border-white/10 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">Strength per Muscle</div>
                <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Muscle leaderboard</h3>
              </div>
              <div className="max-w-full text-sm text-text-secondary sm:max-w-[300px] sm:text-right">
                {muscles.length ? `${muscles.length} ranked muscles from tracked exercise output` : 'Ranking will appear once enough weighted sets are logged.'}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {muscles.map((muscle, index) => {
                const recovery = recoveryByName.get(muscle.name.trim().toLowerCase());
                const scoreFill = getScoreFillPercent(muscle.score);

                return (
                  <div
                    key={muscle.name}
                    className="rounded-3xl border border-white/10 bg-card/80 p-4"
                  >
                    <div className="flex gap-3 sm:gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                        <img src={getMuscleImage(muscle.name)} alt={muscle.name} className="h-full w-full object-cover" />
                        <div className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          #{index + 1}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="max-w-full break-words text-base font-semibold text-white">{muscle.name}</div>
                              <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                                {muscle.tier}
                              </div>
                            </div>
                            <div className="mt-1 break-words text-xs text-text-secondary">
                              Avg {formatWeight(muscle.avgE1RM)} | Best {formatWeight(muscle.bestE1RM)}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            {recovery && (
                              <div className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRecoveryToneClass(recovery.score)}`}>
                                Rec {Math.round(recovery.score)}%
                              </div>
                            )}
                            <div className="rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 text-sm font-electrolize text-white">
                              {muscle.score}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-[#BFFF00]"
                            style={{ width: `${scoreFill}%` }}
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-text-secondary sm:grid-cols-3">
                          <div className="rounded-2xl bg-white/5 px-3 py-2">
                            <div className="text-text-tertiary">Score Band</div>
                            <div className="mt-1 font-semibold text-white">{Math.round(scoreFill)}%</div>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-3 py-2">
                            <div className="text-text-tertiary">Output Gap</div>
                            <div className="mt-1 font-semibold text-white">
                              {strongestMuscle ? formatSigned(strongestMuscle.score - muscle.score, ' pts') : '--'}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-3 py-2">
                            <div className="text-text-tertiary">Readiness</div>
                            <div className="mt-1 font-semibold text-white">
                              {recovery ? `${Math.round(recovery.score)}%` : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!loading && !error && muscles.length === 0 && (
                <div className="rounded-3xl border border-white/10 bg-card/80 p-5 text-sm text-text-secondary">
                  Start logging weighted sets to unlock your muscle leaderboard, strength tiers, and recovery-linked breakdown.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="strength-score-info-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="strength-score-info-title" className="text-xl font-semibold text-white">
                  About Strength Score
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  This page combines your logged lifting output with training adherence and recovery data for the current {activeRangeLabel.toLowerCase()} range.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close strength score info"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto pr-1 text-sm leading-6 text-text-secondary">
              <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                <p className="text-white">
                  Your main score is a strength snapshot built from completed weighted sets.
                </p>
                <p className="mt-2">
                  For each exercise on each training day, the app takes your best estimated 1-rep max (E1RM), averages those values, and converts the result into a score from 80 to 320.
                </p>
              </div>

              <div>
                <p className="font-semibold text-white">What each section means</p>
                <p className="mt-2">
                  The hero card shows your current score, tier, score range, recent trend, weekly adherence, and 30-day load.
                </p>
                <p>
                  Strength History shows how that score changes over time. In `Month` view each point is a day, while `6 months`, `Year`, and `All time` group results by month.
                </p>
                <p>
                  Muscle leaderboard ranks the muscle groups you train most strongly and pairs them with recovery readiness when that data is available.
                </p>
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                <p className="font-semibold text-white">Current range coverage</p>
                <p className="mt-1">
                  {sampleCount
                    ? `This view is currently based on ${sampleCount} logged exercise-day samples. More completed weighted sets make the score and muscle rankings more stable.`
                    : 'No weighted training samples were found in this range yet. Log completed weighted sets to generate your score, history, and muscle ranking.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
