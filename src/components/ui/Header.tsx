import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  compact?: boolean;
  titleClassName?: string;
  backButtonCoachmarkTargetId?: string;
  titleCoachmarkTargetId?: string;
}

export function Header({
  title,
  onBack,
  rightElement,
  compact = false,
  titleClassName = '',
  backButtonCoachmarkTargetId,
  titleCoachmarkTargetId,
}: HeaderProps) {
  return (
    <div className={`flex items-center justify-between ${compact ? 'py-2 mb-2' : 'py-4 mb-6'}`}>
      <div className={`flex items-center min-w-0 ${compact ? 'gap-3' : 'gap-4'}`}>
        {onBack && (
          <motion.button
            data-coachmark-target={backButtonCoachmarkTargetId}
            whileTap={{
              scale: 0.92,
            }}
            onClick={onBack}
            className="w-10 h-10 rounded-xl surface-glass flex items-center justify-center text-text-primary hover:border-accent/40 transition-colors"
          >
            <ArrowLeft size={18} />
          </motion.button>
        )}
        {title && (
          <h1
            data-coachmark-target={titleCoachmarkTargetId}
            className={`flex-1 text-xl leading-tight text-text-primary ${titleClassName}`}
          >
            {title}
          </h1>
        )}
      </div>
      {rightElement}
    </div>
  );
}
