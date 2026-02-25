import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
interface CardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
}
export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <motion.div
      className={`bg-card rounded-2xl p-6 ${className}`}
      {...props}>

      {children}
    </motion.div>);

}