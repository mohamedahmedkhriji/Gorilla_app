import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  CalendarDays,
  Dumbbell,
  Share2,
  NotebookPen,
  CheckCircle2,
} from 'lucide-react';

export type WorkoutSummarySet = {
  set: number;
  reps: number;
  weight: number;
};

export type WorkoutSummaryExercise = {
  name: string;
  sets: WorkoutSummarySet[];
  totalSets: number;
  totalReps: number;
  topWeight: number;
  volume: number;
  targetMuscles: string[];
};

export type WorkoutSummaryMuscle = {
  name: string;
  score: number;
};

export type WorkoutDaySummaryData = {
  id?: number;
  summaryDate: string | null;
  workoutName: string;
  durationSeconds: number;
  estimatedCalories: number;
  totalVolume: number;
  recordsCount: number;
  muscles: WorkoutSummaryMuscle[];
  exercises: WorkoutSummaryExercise[];
  summaryText?: string;
};

interface PostWorkoutSummaryProps {
  onClose: () => void;
  summary: WorkoutDaySummaryData | null;
  loading?: boolean;
  error?: string | null;
  onShare?: (summary: WorkoutDaySummaryData) => Promise<void> | void;
  onPostToBlog?: (summary: WorkoutDaySummaryData) => Promise<void> | void;
  blogPosted?: boolean;
}

const formatDuration = (seconds: number) => {
  const normalized = Math.max(0, Math.round(Number(seconds || 0)));
  const h = Math.floor(normalized / 3600);
  const m = Math.floor((normalized % 3600) / 60);
  const s = normalized % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatSummaryDate = (isoDate: string | null) => {
  if (!isoDate) return 'Today';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'Today';
  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatWeight = (weight: number) => {
  const normalized = Number(weight || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return '-';
  return `${Number(normalized.toFixed(1)).toString().replace(/\.0$/, '')} kg`;
};

const getMuscleBadgeLabel = (muscle: WorkoutSummaryMuscle) => {
  const score = Math.max(0, Math.min(100, Math.round(Number(muscle.score || 0))));
  return `${muscle.name} ${score}%`;
};

export function PostWorkoutSummary({
  onClose,
  summary,
  loading = false,
  error = null,
  onShare,
  onPostToBlog,
  blogPosted = false,
}: PostWorkoutSummaryProps) {
  const [sharePending, setSharePending] = useState(false);
  const [blogPending, setBlogPending] = useState(false);
  const [confirmBlogPostOpen, setConfirmBlogPostOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const topMuscles = useMemo(() => {
    if (!summary?.muscles?.length) return [];
    return [...summary.muscles]
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
      .slice(0, 4);
  }, [summary?.muscles]);

  const handleShare = async () => {
    if (!summary || !onShare || sharePending) return;
    setSharePending(true);
    setFeedback(null);
    try {
      await onShare(summary);
      setFeedback('Workout summary shared.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not share this workout summary.';
      setFeedback(message);
    } finally {
      setSharePending(false);
    }
  };

  const handleConfirmPostToBlog = async () => {
    if (!summary || !onPostToBlog || blogPending) return;
    setBlogPending(true);
    setFeedback(null);
    try {
      await onPostToBlog(summary);
      setConfirmBlogPostOpen(false);
      setFeedback('Workout summary posted to your blog.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not post workout summary to blog.';
      setFeedback(message);
    } finally {
      setBlogPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="text-sm text-text-secondary">Loading workout summary...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex-1 flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-semibold text-white">Workout Summary</h1>
        <Card className="mt-4">
          <p className="text-sm text-text-secondary">
            {error || 'No summary saved yet for this workout day.'}
          </p>
        </Card>
        <div className="mt-6">
          <Button onClick={onClose}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-4">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-card/80 p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <CalendarDays size={15} />
            <span>{formatSummaryDate(summary.summaryDate)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white">{summary.workoutName}</h1>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">Duration</div>
              <div className="mt-1 text-2xl font-semibold text-white">{formatDuration(summary.durationSeconds)}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">Energy</div>
              <div className="mt-1 text-2xl font-semibold text-[#ff6070]">{summary.estimatedCalories.toLocaleString()} Kcal</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">Volume</div>
              <div className="mt-1 text-2xl font-semibold text-[#42b9ff]">{Math.round(summary.totalVolume).toLocaleString()} kg</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">Records</div>
              <div className="mt-1 text-2xl font-semibold text-[#b7ff3f]">{summary.recordsCount}</div>
            </div>
          </div>

          {!!topMuscles.length && (
            <div className="mt-3 rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">Muscles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {topMuscles.map((muscle) => (
                  <span
                    key={`${muscle.name}-${muscle.score}`}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white"
                  >
                    {getMuscleBadgeLabel(muscle)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-4 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Exercises</h2>
            <span className="text-sm text-text-secondary">{summary.exercises.length}</span>
          </div>

          <div className="space-y-3 pb-5">
            {summary.exercises.map((exercise) => (
              <Card key={exercise.name} className="!p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-white">{exercise.name}</h3>
                    <p className="mt-1 text-xs text-text-secondary">
                      {exercise.totalSets} sets - {exercise.totalReps} reps - Top {formatWeight(exercise.topWeight)}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                    <CheckCircle2 size={13} />
                    Done
                  </div>
                </div>

                {!!exercise.sets?.length && (
                  <div className="mt-3 space-y-1 text-sm text-text-secondary">
                    {exercise.sets.map((setRow) => (
                      <div key={`${exercise.name}-${setRow.set}`}>
                        {setRow.reps} x {formatWeight(setRow.weight)}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-6 pt-2">
        <div className="mx-auto w-full max-w-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { void handleShare(); }}
              disabled={sharePending || !onShare}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-card px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-accent/35 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 size={16} />
              {sharePending ? 'Sharing...' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setConfirmBlogPostOpen(true);
              }}
              disabled={blogPending || !onPostToBlog || blogPosted}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-card px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-accent/35 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <NotebookPen size={16} />
              {blogPending ? 'Posting...' : blogPosted ? 'Posted to Blog' : 'Post to Blog'}
            </button>
          </div>

          {feedback && (
            <div className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent">
              {feedback}
            </div>
          )}

          <Button onClick={onClose} className="gap-2">
            <Dumbbell size={16} />
            Done
          </Button>
        </div>
      </div>

      {confirmBlogPostOpen && summary && (
        <div
          className="fixed inset-0 z-50 bg-black/70 px-4 py-6 flex items-end sm:items-center justify-center"
          onClick={() => {
            if (!blogPending) setConfirmBlogPostOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-lg font-semibold text-white">Post workout recap to Blogs?</div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              This will create a new Training post in your Blogs feed for{' '}
              <span className="font-semibold text-white">{summary.workoutName}</span>.
            </p>
            <div className="mt-4 rounded-xl border border-white/8 bg-background/60 p-3 text-sm text-text-secondary">
              <div>{formatSummaryDate(summary.summaryDate)}</div>
              <div className="mt-1">
                {formatDuration(summary.durationSeconds)} - {summary.exercises.length} exercises
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmBlogPostOpen(false)}
                disabled={blogPending}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmPostToBlog(); }}
                disabled={blogPending}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {blogPending ? 'Posting...' : 'Confirm Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
