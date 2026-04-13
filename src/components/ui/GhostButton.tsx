import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HOME_CARD_OVERLAY_CLASS } from '../home/homeCardStyles';

interface GhostButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  coachmarkTargetId?: string;
}

export function GhostButton({ children, onClick, className = '', coachmarkTargetId }: GhostButtonProps) {
  return (
    <motion.button
      data-coachmark-target={coachmarkTargetId}
      whileTap={{
        scale: 0.98,
      }}
      whileHover={{
        y: -1,
      }}
      onClick={onClick}
      className={`
        ghost-button
        surface-glass
        relative overflow-hidden
        w-full py-3.5 px-5 rounded-xl
        text-accent font-medium text-sm
        border border-accent/25
        flex items-center justify-center
        transition-all duration-200
        hover:border-accent/40 hover:bg-accent/[0.08]
        ${className}
      `}
    >
      <span className={HOME_CARD_OVERLAY_CLASS} aria-hidden="true" />
      <span className="relative z-10 flex w-full items-center justify-center">
        {children}
      </span>
    </motion.button>
  );
}
