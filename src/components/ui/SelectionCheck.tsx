import React from 'react';

interface SelectionCheckProps {
  selected: boolean;
  className?: string;
  size?: number;
  rounded?: 'full' | 'md';
}

export function SelectionCheck({
  selected,
  className = '',
  size = 20,
  rounded = 'full',
}: SelectionCheckProps) {
  const radiusClass = rounded === 'md' ? 'neon-checkbox--soft' : '';
  return (
    <span
      className={`neon-checkbox ${selected ? 'neon-checkbox--checked' : ''} ${radiusClass} ${className}`}
      style={{ '--size': `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="neon-checkbox__frame">
        <span className="neon-checkbox__box">
          <span className="neon-checkbox__check-container">
            <svg viewBox="0 0 24 24" className="neon-checkbox__check">
              <path d="M3,12.5l7,7L21,5" />
            </svg>
          </span>
          <span className="neon-checkbox__glow" />
          <span className="neon-checkbox__borders">
            <span />
            <span />
            <span />
            <span />
          </span>
        </span>
        <span className="neon-checkbox__effects">
          <span className="neon-checkbox__particles">
            {Array.from({ length: 12 }).map((_, index) => (
              <span key={index} />
            ))}
          </span>
          <span className="neon-checkbox__rings">
            <span className="ring" />
            <span className="ring" />
            <span className="ring" />
          </span>
          <span className="neon-checkbox__sparks">
            <span />
            <span />
            <span />
            <span />
          </span>
        </span>
      </span>
    </span>
  );
}
