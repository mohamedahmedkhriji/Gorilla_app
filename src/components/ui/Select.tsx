import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: {
    value: string;
    label: string;
  }[];
  error?: string;
  onValueChange?: (value: string) => void;
}

export function Select({
  label,
  options,
  error,
  className = '',
  id,
  name,
  value,
  defaultValue,
  placeholder,
  disabled,
  onChange,
  onValueChange,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listId = `${fieldId}-listbox`;

  const firstOptionValue = options[0]?.value ?? '';
  const [internalValue, setInternalValue] = useState(
    value !== undefined && value !== null ? String(value) : String(defaultValue ?? firstOptionValue),
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (value === undefined || value === null) return;
    setInternalValue(String(value ?? ''));
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const selectedValue = internalValue;

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === selectedValue) || null,
    [options, selectedValue],
  );

  const emitChange = (nextValue: string) => {
    setInternalValue(nextValue);
    onValueChange?.(nextValue);

    if (onChange) {
      const syntheticEvent = {
        target: { value: nextValue, name: name || '' },
        currentTarget: { value: nextValue, name: name || '' },
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  const selectOption = (nextValue: string) => {
    emitChange(nextValue);
    setIsOpen(false);
  };

  const labelText = selectedOption?.label || placeholder || 'Select option';
  const isPlaceholder = !selectedOption;

  return (
    <div className="w-full space-y-2">
      {label && (
        <label htmlFor={fieldId} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary ml-1">
          {label}
        </label>
      )}

      <div ref={wrapperRef} className="relative">
        <input type="hidden" name={name} value={selectedValue} />

        <button
          id={fieldId}
          type="button"
          role="combobox"
          aria-controls={listId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false);
            }
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
          className={`
            relative w-full rounded-2xl px-4 py-3.5 pr-14 text-left
            border border-white/15 bg-white/[0.03] backdrop-blur-xl
            text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.22)]
            hover:border-white/25 hover:bg-white/[0.05]
            focus:outline-none focus:border-accent/65 focus:ring-2 focus:ring-accent/20
            focus:shadow-[0_10px_28px_rgba(0,0,0,0.28)]
            disabled:opacity-60 disabled:cursor-not-allowed
            transition-all duration-200
            ${error ? 'border-red-400/55 focus:border-red-400 focus:ring-red-500/15' : ''}
            ${className}
          `}
          {...props}
        >
          <span className={`block truncate ${isPlaceholder ? 'text-text-tertiary' : 'text-text-primary'}`}>
            {labelText}
          </span>
        </button>

        <div
          className={`
            absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none
            text-text-secondary rounded-xl border border-white/15 bg-white/10
            w-8 h-8 flex items-center justify-center transition-transform duration-200
            ${isOpen ? 'rotate-180' : 'rotate-0'}
          `}
        >
          <ChevronDown size={16} />
        </div>

        {isOpen && (
          <div
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 mt-2 z-50 rounded-2xl border border-white/15 bg-[#0b0c10]/95 backdrop-blur-xl shadow-[0_18px_42px_rgba(0,0,0,0.45)] overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {options.map((opt) => {
                const isActive = String(opt.value) === selectedValue;
                const optionValue = String(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      selectOption(optionValue);
                    }}
                    onClick={(event) => {
                      // Keyboard selection triggers click without pointer events.
                      if (event.detail === 0) {
                        selectOption(optionValue);
                      }
                    }}
                    className={`
                      w-full text-left px-4 py-3 text-sm transition-colors duration-150
                      ${isActive
                        ? 'bg-accent/18 text-white'
                        : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'}
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-300 ml-1">{error}</p>}
    </div>
  );
}
