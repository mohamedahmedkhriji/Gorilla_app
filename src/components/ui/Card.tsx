import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
interface CardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  coachmarkTargetId?: string;
}
export function Card({ children, className = '', coachmarkTargetId, ...props }: CardProps) {
  return (
    <motion.div
      data-coachmark-target={coachmarkTargetId}
      className={`surface-card rounded-2xl p-5 ${className}`}
      {...props}>

      {children}
    </motion.div>);

}
