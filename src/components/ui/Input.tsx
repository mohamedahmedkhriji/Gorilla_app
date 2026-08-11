import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: 'default' | 'nebula';
}

const nebulaParticles = [
  { x: 0.2, y: -0.4, delay: '0.1s' },
  { x: 0.5, y: -0.2, delay: '0.3s' },
  { x: 0.3, y: 0.3, delay: '0.5s' },
  { x: 0.7, y: 0.1, delay: '0.2s' },
  { x: 0.1, y: -0.7, delay: '0.4s' },
  { x: 0.6, y: 0.4, delay: '0.6s' },
];

export function Input({ label, error, className = '', variant = 'default', ...props }: InputProps) {
  if (variant === 'nebula') {
    return (
      <div className="w-full space-y-2">
        <div className={`nebula-input ${error ? 'nebula-input--error' : ''}`}>
          <input
            className={`nebula-input__field ${className}`}
            placeholder=" "
            {...props}
          />
          {label ? <label className="nebula-input__label">{label}</label> : null}
          {nebulaParticles.map((particle, index) => (
            <div
              key={`${particle.x}-${particle.y}-${index}`}
              className="nebula-input__particle"
              style={{
                '--x': particle.x,
                '--y': particle.y,
                '--delay': particle.delay,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {error && <p className="text-xs text-red-300 ml-1">{error}</p>}
      </div>
    );
  }

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
