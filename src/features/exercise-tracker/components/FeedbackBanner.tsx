import React, { memo } from 'react';
import type { FeedbackMessage } from '../types/tracking';

interface FeedbackBannerProps {
  feedback: FeedbackMessage;
}

const LEVEL_STYLES = {
  info: 'border-white/10 bg-white/[0.04] text-text-secondary',
  success: 'border-accent/25 bg-accent/10 text-text-primary',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-50',
  error: 'border-rose-400/30 bg-rose-500/10 text-rose-50',
} as const;

export const FeedbackBanner = memo(function FeedbackBanner({
  feedback,
}: FeedbackBannerProps) {
  return (
    <div className={`rounded-[24px] border px-4 py-4 text-center shadow-[0_18px_44px_rgba(0,0,0,0.18)] ${LEVEL_STYLES[feedback.level]}`}>
      <p className="text-sm font-medium leading-6 text-current">
        {feedback.message}
      </p>
    </div>
  );
});
