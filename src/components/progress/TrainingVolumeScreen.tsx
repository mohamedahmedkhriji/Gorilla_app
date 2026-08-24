import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, ChevronRight, CircleQuestionMark, Info, X } from 'lucide-react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';
import { getStoredUserId } from '../../shared/authStorage';
import { PostWorkoutSummary, type WorkoutDaySummaryData } from '../workout/PostWorkoutSummary';
import {
  aggregateTrainingVolume,
  formatTrainingVolume,
  getVolumeTrendStatus,
  getWorkoutDateKey,
  getWorkoutSetCount,
  getWorkoutTitle,
  getWorkoutVolumeKg,
  type VolumeRange,
  type VolumeWorkoutSummary,
} from '../../lib/training-volume';

type TrainingVolumeScreenProps = {
  onBack: () => void;
  onStartWorkout: () => void;
};

const RANGE_ITEMS: Array<{ key: VolumeRange; label: string }> = [
  { key: '4w', label: '4 weeks' },
  { key: '8w', label: '8 weeks' },
  { key: 'all', label: 'All time' },
];

const normalizeWorkoutSummary = (raw: any): WorkoutDaySummaryData | null => {
  if (!raw || typeof raw !== 'object') return null;
  const workoutName = getWorkoutTitle(raw);
  if (!workoutName) return null;

  const exercises = Array.isArray(raw.exercises) ? raw.exercises : [];
  return {
    id: Number(raw.id || 0) || undefined,
    summaryDate: raw.summaryDate || raw.summary_date || null,
    workoutName,
    durationSeconds: Math.max(0, Math.round(Number(raw.durationSeconds ?? raw.duration_seconds ?? 0))),
    estimatedCalories: Math.max(0, Math.round(Number(raw.estimatedCalories ?? raw.estimated_calories ?? 0))),
    totalVolume: Number(Number(raw.totalVolume ?? raw.total_volume ?? getWorkoutVolumeKg(raw)).toFixed(2)),
    recordsCount: Math.max(0, Math.round(Number(raw.recordsCount ?? raw.records_count ?? getWorkoutSetCount(raw)))),
    muscles: Array.isArray(raw.muscles) ? raw.muscles : [],
    exercises: exercises.map((exercise: any) => ({
      name: String(exercise?.name || 'Exercise'),
      sets: Array.isArray(exercise?.sets) ? exercise.sets.map((set: any, index: number) => ({
        set: Math.max(1, Math.round(Number(set?.set || index + 1))),
        reps: Math.max(0, Math.round(Number(set?.reps || 0))),
        weight: Number(Number(set?.weight || 0).toFixed(2)),
      })) : [],
      totalSets: Math.max(0, Math.round(Number(exercise?.totalSets || exercise?.sets?.length || 0))),
      totalReps: Math.max(0, Math.round(Number(exercise?.totalReps || 0))),
      topWeight: Number(Number(exercise?.topWeight || 0).toFixed(2)),
      volume: Number(Number(exercise?.volume || 0).toFixed(2)),
      targetMuscles: Array.isArray(exercise?.targetMuscles) ? exercise.targetMuscles : [],
    })),
    summaryText: String(raw.summaryText || raw.summary_text || '').trim(),
  };
};

const formatDate = (dateKey: string) => {
  if (!dateKey) return '-';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export function TrainingVolumeScreen({ onBack, onStartWorkout }: TrainingVolumeScreenProps) {
  const [range, setRange] = useState<VolumeRange>('4w');
  const [summaries, setSummaries] = useState<VolumeWorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<WorkoutDaySummaryData | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const loadSummaries = useCallback(async () => {
    const userId = getStoredUserId();
    if (!userId) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await api.getWorkoutDaySummaries(userId, 365);
      setSummaries(Array.isArray(response?.summaries) ? response.summaries : []);
    } catch (loadError) {
      console.error('Failed to load training volume:', loadError);
      setError('Could not load training volume yet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const aggregation = useMemo(() => aggregateTrainingVolume(summaries, range), [range, summaries]);
  const maxBucketVolume = Math.max(...aggregation.buckets.map((bucket) => bucket.volumeKg), 1);
  const trendStatus = getVolumeTrendStatus(aggregation);
  const remainingForTrend = Math.max(0, 3 - aggregation.workoutCount);

  const trendTitle = aggregation.workoutCount <= 0
    ? 'No volume yet'
    : aggregation.workoutCount < 3
      ? 'Build your trend'
      : trendStatus;

  const trendText = aggregation.workoutCount <= 0
    ? 'Complete your first workout to start tracking volume.'
    : aggregation.workoutCount < 3
      ? `Complete ${remainingForTrend} more workout${remainingForTrend === 1 ? '' : 's'} to compare volume.`
      : 'Compared with the previous equivalent period.';

  return (
    <div className="min-h-[100dvh] bg-background px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-2">
      <Header
        title="Training Volume"
        onBack={onBack}
        rightElement={(
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-card/70 text-text-secondary transition-colors hover:border-accent/30 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="Training volume information"
            onClick={() => setShowInfo(true)}
          >
            <Info size={18} aria-hidden="true" />
          </button>
        )}
      />

      <div className="mx-auto max-w-3xl space-y-4">
        <div className="grid grid-cols-3 rounded-2xl border border-white/10 bg-[#101824] p-1">
          {RANGE_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={range === item.key}
              onClick={() => setRange(item.key)}
              className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                range === item.key ? 'bg-accent text-black' : 'text-text-secondary hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="rounded-[20px] border border-white/10 bg-[#101824] p-4" aria-labelledby="volume-summary-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Total Volume</p>
              <h2 id="volume-summary-title" className="mt-1 text-3xl font-bold text-[#F3F8FF]">
                {loading ? '--' : formatTrainingVolume(aggregation.totalVolumeKg)}
              </h2>
              <p className="mt-1 text-sm text-[#AFC0D5]">{loading ? 'Loading volume...' : trendStatus}</p>
            </div>
            <BarChart3 className="mt-1 text-accent" size={24} aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#AFC0D5]">
            Volume is weight x reps across all completed sets.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-2xl border border-white/10 bg-[#14202E] p-3">
              <p className="text-text-tertiary">Average</p>
              <p className="mt-1 font-semibold text-white">{formatTrainingVolume(aggregation.averagePerWorkoutKg)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#14202E] p-3">
              <p className="text-text-tertiary">Sets</p>
              <p className="mt-1 font-semibold text-white">{aggregation.totalSets}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#14202E] p-3">
              <p className="text-text-tertiary">Workouts</p>
              <p className="mt-1 font-semibold text-white">{aggregation.workoutCount}</p>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-[20px] border border-white/10 bg-[#101824] p-4" aria-labelledby="volume-trend-title">
          <div className="mb-4">
            <h2 id="volume-trend-title" className="text-lg font-semibold text-white">{trendTitle}</h2>
            <p className="mt-1 text-sm text-[#AFC0D5]">{trendText}</p>
          </div>
          {aggregation.workoutCount <= 0 && !loading ? (
            <button
              type="button"
              onClick={onStartWorkout}
              className="min-h-12 w-full rounded-2xl bg-accent px-4 text-sm font-bold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              START WORKOUT
            </button>
          ) : (
            <div className="flex h-48 items-end gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#151d28] p-3">
              {loading ? (
                <div className="h-full min-w-full animate-pulse rounded-xl bg-white/5" />
              ) : aggregation.buckets.map((bucket) => (
                <div
                  key={bucket.key}
                  className="flex min-w-[54px] flex-1 flex-col items-center justify-end gap-2"
                  title={`${bucket.label}: ${formatTrainingVolume(bucket.volumeKg)} - ${bucket.workoutCount} workout(s) - ${bucket.setCount} set(s)`}
                >
                  <div className="text-[10px] font-semibold text-text-secondary">{formatTrainingVolume(bucket.volumeKg)}</div>
                  <div
                    className="w-full rounded-t-xl bg-accent"
                    style={{ height: `${Math.max(10, (bucket.volumeKg / maxBucketVolume) * 120)}px` }}
                    aria-label={`${bucket.label}, ${formatTrainingVolume(bucket.volumeKg)}`}
                  />
                  <div className="text-[10px] text-text-tertiary">{bucket.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="volume-history-title">
          <div className="flex items-center justify-between">
            <h2 id="volume-history-title" className="text-lg font-semibold text-white">Workout history</h2>
            <button type="button" className="min-h-11 px-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
              VIEW ALL WORKOUTS
            </button>
          </div>
          {aggregation.workouts.length === 0 && !loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#101824] p-4 text-sm text-[#AFC0D5]">
              No completed workouts in this range.
            </div>
          ) : aggregation.workouts.slice(0, 12).map((summary) => {
            const normalized = normalizeWorkoutSummary(summary);
            return (
              <button
                key={`${getWorkoutDateKey(summary)}-${summary.id || getWorkoutTitle(summary)}`}
                type="button"
                onClick={() => normalized && setSelectedSummary(normalized)}
                className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#101824] px-4 py-3 text-left transition-colors hover:border-accent/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-tertiary">{formatDate(getWorkoutDateKey(summary))}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-white">{getWorkoutTitle(summary)}</p>
                  <p className="mt-0.5 text-xs text-[#AFC0D5]">{getWorkoutSetCount(summary)} sets</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{formatTrainingVolume(getWorkoutVolumeKg(summary))}</p>
                </div>
                <ChevronRight size={18} className="text-text-secondary" aria-hidden="true" />
              </button>
            );
          })}
        </section>

        <section className="rounded-[20px] border border-white/10 bg-[#101824] p-4" aria-labelledby="volume-next-title">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Next Step</p>
          <h2 id="volume-next-title" className="mt-2 text-lg font-semibold text-white">
            {aggregation.workoutCount >= 3 ? 'Keep volume progressing' : 'Keep logging your workouts'}
          </h2>
          <p className="mt-1 text-sm text-[#AFC0D5]">
            {aggregation.workoutCount >= 3
              ? 'Use this trend to decide when to add sets, reps, or load.'
              : 'Complete more workouts to unlock volume comparisons.'}
          </p>
          <button
            type="button"
            onClick={onStartWorkout}
            className="mt-4 min-h-12 w-full rounded-2xl bg-accent px-4 text-sm font-bold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            START WORKOUT
          </button>
        </section>

        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-[#101824] px-4 text-left text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="flex items-center gap-2"><CircleQuestionMark size={18} className="text-accent" aria-hidden="true" /> How volume is calculated</span>
          <ChevronRight size={18} className="text-text-secondary" aria-hidden="true" />
        </button>
      </div>

      {selectedSummary && (
        <PostWorkoutSummary
          summary={selectedSummary}
          onClose={() => setSelectedSummary(null)}
        />
      )}

      {showInfo && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[170] flex items-end justify-center bg-black/65 px-4 pb-4" role="presentation" onClick={() => setShowInfo(false)}>
          <div className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#101824] p-5" role="dialog" aria-modal="true" aria-label="How volume is calculated" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">How volume is calculated</h2>
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-text-secondary" onClick={() => setShowInfo(false)} aria-label="Close">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-[#AFC0D5]">
              <p>Set volume = recorded external load x completed repetitions.</p>
              <p>Workout volume = the sum of valid completed set volumes saved in the workout summary.</p>
              <p>Period volume = workout volume from completed summaries inside the selected date range.</p>
              <p>Skipped, failed, incomplete, and deleted sets are excluded when they are not saved into the completed workout summary.</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
