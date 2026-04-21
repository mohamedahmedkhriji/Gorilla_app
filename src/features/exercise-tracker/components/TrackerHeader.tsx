import React, { memo } from 'react';
import { ArrowLeft } from 'lucide-react';

interface TrackerHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

export const TrackerHeader = memo(function TrackerHeader({
  title,
  subtitle,
  onBack,
}: TrackerHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-text-primary transition-colors hover:border-white/20 hover:bg-white/[0.05]"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="min-w-0">
        <div className="truncate text-2xl font-electrolize text-text-primary">
          {title}
        </div>
        <div className="mt-1 text-sm text-text-secondary">
          {subtitle}
        </div>
      </div>
    </div>
  );
});

