import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type ModernSelectOption = {
  value: string;
  label: string;
};

type ModernSelectProps = {
  value: string;
  options: ModernSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function ModernSelect({
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
}: ModernSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value],
  );

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-3.5 py-2.5 pr-11 text-left text-[0.95rem] font-medium text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.03))] focus:border-accent/80 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="block truncate">
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`absolute left-0 right-0 z-[70] mt-2 origin-top rounded-2xl border border-white/15 bg-card/95 p-1 shadow-[0_22px_40px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-200 ${isOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'}`}
      >
        <ul role="listbox" className="max-h-56 overflow-y-auto">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${isSelected ? 'bg-accent/20 text-text-primary' : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'}`}
                >
                  <span>{option.label}</span>
                  {isSelected ? <Check size={14} className="text-accent" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
