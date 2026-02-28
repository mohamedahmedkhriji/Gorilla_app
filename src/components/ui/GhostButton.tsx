import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GhostButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function GhostButton({ children, onClick, className = '' }: GhostButtonProps) {
  return (
    <motion.button
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
        w-full py-3.5 px-5 rounded-xl
        text-accent font-medium text-sm
        border border-accent/25
        flex items-center justify-center
        transition-all duration-200
        hover:border-accent/40 hover:bg-accent/[0.08]
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
}
