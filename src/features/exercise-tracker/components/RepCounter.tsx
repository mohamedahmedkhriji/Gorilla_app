import React, { memo } from 'react';
import { motion } from 'framer-motion';

interface RepCounterProps {
  value: number;
  label?: string;
  hint?: string;
  pulse?: boolean;
}

export const RepCounter = memo(function RepCounter({
  value,
  label = 'Reps',
  hint,
  pulse = false,
}: RepCounterProps) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
        {label}
      </div>
      <motion.div
        key={`${value}-${pulse ? 'pulse' : 'still'}`}
        animate={pulse ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="mt-2 inline-block text-4xl font-electrolize leading-none text-text-primary"
      >
        {value}
      </motion.div>
      {hint ? (
        <div className="mt-2 text-xs text-text-tertiary">
          {hint}
        </div>
      ) : null}
    </div>
  );
});
