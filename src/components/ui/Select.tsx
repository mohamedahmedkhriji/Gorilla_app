import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: {
    value: string;
    label: string;
  }[];
  error?: string;
}

export function Select({ label, options, error, className = '', ...props }: SelectProps) {
  return (
    <div className="w-full space-y-2">
      {label && <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary ml-1">{label}</label>}
      <div className="relative">
        <select
          className={`
            w-full rounded-2xl px-4 py-3.5 pr-10
            surface-glass border border-white/15
            text-text-primary appearance-none
            focus:outline-none focus:border-accent/65 focus:ring-2 focus:ring-accent/20
            transition-all duration-200
            ${error ? 'border-red-400/55 focus:border-red-400 focus:ring-red-500/15' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary">
          <ChevronDown size={18} />
        </div>
      </div>
      {error && <p className="text-xs text-red-300 ml-1">{error}</p>}
    </div>
  );
}
