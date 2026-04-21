import React, { memo } from 'react';
import type { CoachStatus } from '../coach/types';

interface StatusIndicatorProps {
  status: CoachStatus;
  title: string;
  message?: string;
}

type IndicatorTone = 'idle' | 'warning' | 'good' | 'bad';

const TONE_STYLES: Record<IndicatorTone, string> = {
  idle: 'border-white/10 bg-white/[0.04] text-text-secondary',
  warning: 'border-amber-400/35 bg-amber-500/14 text-amber-50',
  good: 'border-emerald-400/35 bg-emerald-500/14 text-emerald-50',
  bad: 'border-rose-400/35 bg-rose-500/14 text-rose-50',
};

const DOT_STYLES: Record<IndicatorTone, string> = {
  idle: 'bg-white/45',
  warning: 'bg-amber-300 shadow-[0_0_36px_rgba(252,211,77,0.56)]',
  good: 'bg-emerald-300 shadow-[0_0_36px_rgba(110,231,183,0.58)]',
  bad: 'bg-rose-300 shadow-[0_0_36px_rgba(253,164,175,0.58)]',
};

export const StatusIndicator = memo(function StatusIndicator({
  status,
  title,
  message,
}: StatusIndicatorProps) {
  const tone = status as IndicatorTone;

  return (
    <div className={`rounded-[28px] border p-5 transition-colors duration-200 ${TONE_STYLES[tone]}`}>
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-current/20 bg-black/10">
          <div className={`h-6 w-6 rounded-full ${DOT_STYLES[tone]}`} />
        </div>

        <div className="min-w-0">
          <div className="text-lg font-semibold text-current">
            {title}
          </div>
          {message ? (
            <div className="mt-1 text-sm text-current/80">
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
