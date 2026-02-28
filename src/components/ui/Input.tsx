import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full space-y-2">
      {label && <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary ml-1">{label}</label>}
      <input
        className={`
          w-full rounded-2xl px-4 py-3.5
          surface-glass border border-white/15
          text-text-primary placeholder:text-text-tertiary
          focus:outline-none focus:border-accent/65 focus:ring-2 focus:ring-accent/20
          transition-all duration-200
          ${error ? 'border-red-400/55 focus:border-red-400 focus:ring-red-500/15' : ''}
          ${className}
        `}
        {...props}
      />

      {error && <p className="text-xs text-red-300 ml-1">{error}</p>}
    </div>
  );
}
