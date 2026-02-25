import React from 'react';
import { motion } from 'framer-motion';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
  isLoading?: boolean;
}
export function Button({
  children,
  variant = 'primary',
  fullWidth = true,
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
  'relative flex items-center justify-center py-4 px-6 rounded-xl font-medium text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:
    'bg-accent text-black shadow-glow hover:shadow-[0_0_25px_rgba(191,255,0,0.4)] font-bold',
    secondary: 'bg-card text-white border border-white/10 hover:bg-white/5',
    ghost: 'bg-transparent text-accent hover:bg-white/5'
  };
  return (
    <motion.button
      whileTap={{
        scale: 0.98
      }}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${fullWidth ? 'w-full' : 'w-auto'}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}>

      {isLoading ?
      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> :

      children
      }
    </motion.button>);

}