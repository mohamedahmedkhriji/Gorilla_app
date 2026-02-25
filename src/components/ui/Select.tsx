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
export function Select({
  label,
  options,
  error,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className="w-full space-y-2">
      {label &&
      <label className="text-sm font-medium text-text-secondary ml-1">
          {label}
        </label>
      }
      <div className="relative">
        <select
          className={`
            w-full bg-card border border-white/10 rounded-xl px-4 py-4 pr-10
            text-text-primary appearance-none
            focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50
            transition-all duration-200
            ${error ? 'border-red-500/50 focus:border-red-500' : ''}
            ${className}
          `}
          {...props}>

          {options.map((opt) =>
          <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary">
          <ChevronDown size={20} />
        </div>
      </div>
      {error && <p className="text-xs text-red-400 ml-1">{error}</p>}
    </div>);

}