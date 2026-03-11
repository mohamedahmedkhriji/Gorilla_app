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
    'relative flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-marker font-semibold text-base tracking-[0.08em] transition-all duration-200 disabled:opacity-55 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-accent text-black shadow-[0_4px_14px_rgb(var(--color-accent)/0.2)] hover:bg-accent/90',
    secondary:
      'surface-glass text-white border border-white/12 hover:border-accent/25 hover:bg-white/5',
    ghost:
      'bg-transparent text-accent border border-accent/30 hover:bg-accent/10 hover:border-accent/45',
  };

  const spinnerColor = variant === 'primary' ? 'border-black/40 border-t-black' : 'border-white/35 border-t-white';

  return (
    <motion.button
      whileTap={{
        scale: 0.98,
      }}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${fullWidth ? 'w-full' : 'w-auto'}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <div className={`w-4 h-4 border-2 ${spinnerColor} rounded-full animate-spin`} /> : children}
    </motion.button>
  );
}
