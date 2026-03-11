import React from 'react';
import { Check } from 'lucide-react';

interface SelectionCheckProps {
  selected: boolean;
  className?: string;
  size?: number;
  rounded?: 'full' | 'md';
}

export function SelectionCheck({
  selected,
  className = '',
  size = 20,
  rounded = 'full',
}: SelectionCheckProps) {
  const iconSize = Math.max(11, Math.round(size * 0.62));
  const radiusClass = rounded === 'md' ? 'rounded-md' : 'rounded-full';

  if (selected) {
    return (
      <span
        className={`inline-flex items-center justify-center border border-accent/65 bg-accent text-black shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_4px_12px_rgba(187,255,92,0.35)] ${radiusClass} ${className}`}
        style={{ width: size, height: size }}
      >
        <Check size={iconSize} strokeWidth={3.25} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex border border-white/25 bg-white/[0.03] ${radiusClass} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
