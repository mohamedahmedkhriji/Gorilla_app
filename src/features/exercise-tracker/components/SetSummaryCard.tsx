import React, { memo } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { TrackerSummaryView } from '../adapters/trackerUiMapper';

interface SetSummaryCardProps {
  summary: TrackerSummaryView;
  onStartNextSet?: () => void;
  onBackToExercises?: () => void;
}

const METRICS: Array<{ key: keyof Omit<TrackerSummaryView, 'setNumber' | 'reps' | 'validReps' | 'invalidReps' | 'overallScore' | 'dominantIssue' | 'fatigueTrend'>; label: string }> = [
  { key: 'averageRom', label: 'ROM' },
  { key: 'averageSymmetry', label: 'Symmetry' },
  { key: 'averageStability', label: 'Stability' },
  { key: 'averageControl', label: 'Control' },
];

export const SetSummaryCard = memo(function SetSummaryCard({
  summary,
  onStartNextSet,
  onBackToExercises,
}: SetSummaryCardProps) {
  const totalReps = Math.max(1, summary.reps);
  const validPercent = Math.max(0, Math.min(100, (summary.validReps / totalReps) * 100));
  const invalidPercent = Math.max(0, Math.min(100, (summary.invalidReps / totalReps) * 100));

  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
            Set {summary.setNumber}
          </div>
          <div className="mt-2 text-2xl font-electrolize text-text-primary">
            Local Summary
          </div>
          <div className="mt-2 text-sm text-text-secondary">
            {summary.validReps} valid reps • {summary.invalidReps} invalid reps
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
            Overall
          </div>
          <div className="mt-2 text-4xl font-electrolize text-accent">
            {summary.overallScore}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center"
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
              {metric.label}
            </div>
            <div className="mt-2 font-semibold text-text-primary">
              {summary[metric.key]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
            Reps
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-text-primary">
            <span>{summary.reps} total</span>
            <span className="text-xs text-emerald-200">{summary.validReps} valid</span>
            <span className="text-xs text-rose-200">{summary.invalidReps} invalid</span>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="bg-emerald-300"
              style={{ width: `${validPercent}%` }}
            />
            <div
              className="bg-rose-300"
              style={{ width: `${invalidPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
            Dominant issue
          </div>
          <div className="mt-2 text-text-primary">
            {summary.dominantIssue || 'None'}
          </div>
        </div>
      </div>

      {summary.fatigueTrend ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-50">
          {summary.fatigueTrend}
        </div>
      ) : null}

      {(onStartNextSet || onBackToExercises) ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {onStartNextSet ? (
            <Button type="button" onClick={onStartNextSet}>
              <Play size={16} />
              <span>Start Next Set</span>
            </Button>
          ) : null}
          {onBackToExercises ? (
            <Button type="button" variant="secondary" onClick={onBackToExercises}>
              <ArrowLeft size={16} />
              <span>Back to Exercises</span>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
