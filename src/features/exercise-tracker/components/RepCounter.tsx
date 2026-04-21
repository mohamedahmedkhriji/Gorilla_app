import React, { memo } from 'react';

interface RepCounterProps {
  value: number;
  label?: string;
  hint?: string;
}

export const RepCounter = memo(function RepCounter({
  value,
  label = 'Reps',
  hint,
}: RepCounterProps) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-2 text-4xl font-electrolize leading-none text-text-primary">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-xs text-text-tertiary">
          {hint}
        </div>
      ) : null}
    </div>
  );
});
