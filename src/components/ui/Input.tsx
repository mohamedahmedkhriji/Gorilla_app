import React from 'react';
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full space-y-2">
      {label &&
      <label className="text-sm font-medium text-text-secondary ml-1">
          {label}
        </label>
      }
      <input
        className={`
          w-full bg-card border border-white/10 rounded-xl px-4 py-4
          text-text-primary placeholder:text-text-tertiary
          focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50
          transition-all duration-200
          ${error ? 'border-red-500/50 focus:border-red-500' : ''}
          ${className}
        `}
        {...props} />

      {error && <p className="text-xs text-red-400 ml-1">{error}</p>}
    </div>);

}