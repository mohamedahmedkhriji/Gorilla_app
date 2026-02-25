import React from 'react';
import { motion } from 'framer-motion';
interface GhostButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}
export function GhostButton({
  children,
  onClick,
  className = ''
}: GhostButtonProps) {
  return (
    <motion.button
      whileTap={{
        scale: 0.98
      }}
      whileHover={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
      }}
      onClick={onClick}
      className={`
        w-full py-4 px-6 rounded-xl
        text-accent font-medium text-base
        border border-accent/30
        flex items-center justify-center
        transition-colors duration-200
        hover:border-accent
        ${className}
      `}>

      {children}
    </motion.button>);

}