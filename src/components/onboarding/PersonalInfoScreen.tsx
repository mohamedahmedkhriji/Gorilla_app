import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Cake, ChevronRight, Keyboard, Mars, Ruler, Scale, UserRound, Venus } from 'lucide-react';
import { getOnboardingLanguage } from './onboardingI18n';

type Gender = 'man' | 'woman' | '';
type UnitMode = 'metric' | 'imperial';

interface PersonalInfoScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

type CalibrationState = {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
};

type PersonalInfoCopy = {
  continue: string;
  set: string;
  cancel: string;
  bodyTitle: string;
  bodySubtitle: string;
  genderLabel: string;
  genderMan: string;
  genderWoman: string;
  ageLabel: string;
  ageUnit: string;
  heightLabel: string;
  weightLabel: string;
};

type RulerProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  majorEvery: number;
  mediumEvery?: number;
  pixelsPerUnit: number;
  labelPosition?: 'above' | 'below';
  decimals?: number;
  selectedColor?: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  onChange: (value: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundToStep = (value: number, step: number, decimals = 0) => {
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(decimals));
};

const normalizeGender = (value: unknown): Gender => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'female' || normalized === 'woman' || normalized === 'f' || normalized === 'girl' || normalized === 'girls' || normalized === 'femme') return 'woman';
  if (normalized === 'male' || normalized === 'man' || normalized === 'm') return 'man';
  return '';
};

const initialNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const COPY: Record<string, PersonalInfoCopy> = {
  en: {
    continue: 'Continue',
    set: 'Set',
    cancel: 'Cancel',
    bodyTitle: 'Tell us about your body',
    bodySubtitle: 'This helps us personalize your plan',
    genderLabel: 'Gender',
    genderMan: 'Man',
    genderWoman: 'Woman',
    ageLabel: 'Age',
    ageUnit: 'years old',
    heightLabel: 'Height',
    weightLabel: 'Weight',
  },
  ar: {
    continue: '\u0645\u062a\u0627\u0628\u0639\u0629',
    set: '\u062a\u0639\u064a\u064a\u0646',
    cancel: '\u0625\u0644\u063a\u0627\u0621',
    bodyTitle: '\u0623\u062e\u0628\u0631\u0646\u0627 \u0639\u0646 \u062c\u0633\u0645\u0643',
    bodySubtitle: '\u0647\u0630\u0627 \u064a\u0633\u0627\u0639\u062f\u0646\u0627 \u0639\u0644\u0649 \u062a\u062e\u0635\u064a\u0635 \u062e\u0637\u062a\u0643',
    genderLabel: '\u0627\u0644\u062c\u0646\u0633',
    genderMan: '\u0631\u062c\u0644',
    genderWoman: '\u0627\u0645\u0631\u0623\u0629',
    ageLabel: '\u0627\u0644\u0639\u0645\u0631',
    ageUnit: '\u0633\u0646\u0629',
    heightLabel: '\u0627\u0644\u0637\u0648\u0644',
    weightLabel: '\u0627\u0644\u0648\u0632\u0646',
  },
  it: {
    continue: 'Continua',
    set: 'Imposta',
    cancel: 'Annulla',
    bodyTitle: 'Parlaci del tuo corpo',
    bodySubtitle: 'Ci aiuta a personalizzare il tuo piano',
    genderLabel: 'Genere',
    genderMan: 'Uomo',
    genderWoman: 'Donna',
    ageLabel: 'Eta',
    ageUnit: 'anni',
    heightLabel: 'Altezza',
    weightLabel: 'Peso',
  },
  de: {
    continue: 'Weiter',
    set: 'Setzen',
    cancel: 'Abbrechen',
    bodyTitle: 'Erzaehl uns von deinem Koerper',
    bodySubtitle: 'Damit personalisieren wir deinen Plan',
    genderLabel: 'Geschlecht',
    genderMan: 'Mann',
    genderWoman: 'Frau',
    ageLabel: 'Alter',
    ageUnit: 'Jahre alt',
    heightLabel: 'Groesse',
    weightLabel: 'Gewicht',
  },
  fr: {
    continue: 'Continuer',
    set: 'Valider',
    cancel: 'Annuler',
    bodyTitle: 'Parle-nous de ton corps',
    bodySubtitle: 'Cela nous aide a personnaliser ton plan',
    genderLabel: 'Genre',
    genderMan: 'Homme',
    genderWoman: 'Femme',
    ageLabel: 'Age',
    ageUnit: 'ans',
    heightLabel: 'Taille',
    weightLabel: 'Poids',
  },
};

function UnitToggle({
  left,
  right,
  value,
  onChange,
}: {
  left: string;
  right: string;
  value: UnitMode;
  onChange: (value: UnitMode) => void;
}) {
  return (
    <div className="mx-auto inline-flex rounded-full bg-white/5 p-1">
      {[
        { key: 'metric' as const, label: left },
        { key: 'imperial' as const, label: right },
      ].map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`min-w-16 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
            value === option.key ? 'bg-accent text-black' : 'bg-transparent text-text-secondary'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RulerCanvas({
  value,
  min,
  max,
  step,
  majorEvery,
  mediumEvery,
  pixelsPerUnit,
  labelPosition = 'below',
  decimals = 0,
  selectedColor = 'rgba(34,197,94,0.9)',
  orientation = 'horizontal',
  className = 'h-[132px]',
  onChange,
}: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startValueRef = useRef(value);
  const draggingRef = useRef(false);

  const setValue = useCallback(
    (nextValue: number) => onChange(roundToStep(clamp(nextValue, min, max), step, decimals)),
    [decimals, max, min, onChange, step],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = window.devicePixelRatio || 1;
    widthRef.current = width;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.font = '12px sans-serif';

    const isGirlsTheme = Boolean(container.closest('.girls-onboarding-theme, .onboarding-layout--girls'));
    const tickColor = isGirlsTheme ? 'rgba(121,94,103,0.38)' : 'rgba(255,255,255,0.25)';
    const majorTickColor = isGirlsTheme ? 'rgba(74,74,74,0.5)' : 'rgba(255,255,255,0.34)';
    const labelColor = isGirlsTheme ? 'rgba(74,74,74,0.62)' : 'rgba(255,255,255,0.5)';
    const activeTickColor = isGirlsTheme ? 'rgba(249,178,215,0.98)' : selectedColor;

    const totalTicks = Math.round((max - min) / step);

    for (let index = 0; index <= totalTicks; index += 1) {
      const tickValue = roundToStep(min + (index * step), step, decimals);
      const position = orientation === 'vertical'
        ? (height / 2) - ((tickValue - value) * pixelsPerUnit)
        : (width / 2) + ((tickValue - value) * pixelsPerUnit);
      if (position < -40 || position > (orientation === 'vertical' ? height : width) + 40) continue;

      const major = Math.abs((tickValue / majorEvery) - Math.round(tickValue / majorEvery)) < 0.0001;
      const medium = mediumEvery
        ? Math.abs((tickValue / mediumEvery) - Math.round(tickValue / mediumEvery)) < 0.0001
        : false;
      const selected = Math.abs(tickValue - value) < (step / 2);
      const tickHeight = major ? 36 : medium ? 25 : 15;

      context.strokeStyle = selected ? activeTickColor : major || medium ? majorTickColor : tickColor;
      context.lineWidth = selected ? 2 : major ? 1.5 : 1;
      context.beginPath();
      if (orientation === 'vertical') {
        const x1 = width - 20;
        const x2 = x1 - tickHeight;
        context.moveTo(x1, position);
        context.lineTo(x2, position);
      } else {
        const tickStart = labelPosition === 'above' ? 48 : 18;
        const tickDirection = labelPosition === 'above' ? 1 : -1;
        const y1 = tickStart;
        const y2 = tickStart + (tickDirection * tickHeight);
        context.moveTo(position, y1);
        context.lineTo(position, y2);
      }
      context.stroke();

      if (major) {
        context.fillStyle = labelColor;
        if (orientation === 'vertical') {
          context.textAlign = 'right';
          context.textBaseline = 'middle';
          context.fillText(decimals > 0 ? tickValue.toFixed(decimals) : String(Math.round(tickValue)), width - 62, position);
        } else {
          const labelY = labelPosition === 'above' ? 23 : height - 30;
          context.textAlign = 'center';
          context.textBaseline = 'alphabetic';
          context.fillText(decimals > 0 ? tickValue.toFixed(decimals) : String(Math.round(tickValue)), position, labelY);
        }
      }
    }
  }, [decimals, labelPosition, majorEvery, max, mediumEvery, min, orientation, pixelsPerUnit, selectedColor, step, value]);

  useEffect(() => {
    draw();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    startValueRef.current = value;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const delta = orientation === 'vertical'
      ? (event.clientY - startYRef.current) / pixelsPerUnit
      : (event.clientX - startXRef.current) / pixelsPerUnit;
    setValue(startValueRef.current - delta);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setValue(value);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full touch-none overflow-hidden ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={(event) => {
        event.preventDefault();
        setValue(value + (event.deltaY > 0 ? step : -step));
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {orientation === 'vertical' ? (
        <div className="pointer-events-none absolute right-5 top-1/2 h-0.5 w-11 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_14px_rgb(var(--color-accent)/0.55)]" />
      ) : (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_14px_rgb(var(--color-accent)/0.55)]" />
      )}
    </div>
  );
}

function MeasurementDisplay({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex items-end justify-center gap-2 text-center">
      <span className="text-[56px] font-bold leading-none text-white sm:text-[64px]">{value}</span>
      <span className="pb-3 text-sm font-semibold uppercase tracking-widest text-text-tertiary">{unit}</span>
    </div>
  );
}

type EditorKey = 'age' | 'height' | 'weight' | null;

type ExactInputState = {
  open: boolean;
  value: string;
};

function BodyInfoRow({
  icon,
  label,
  value,
  active = false,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[58px] w-full items-center px-4 py-2 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className={`mr-3 flex w-6 shrink-0 justify-center ${active ? 'text-accent' : 'text-text-secondary'}`}>
          {icon}
        </span>
        <span className="flex-1 text-sm font-medium text-text-primary">{label}</span>
        <span className="mr-2 text-[15px] font-bold text-white">{value}</span>
        <ChevronRight
          size={15}
          className={`shrink-0 text-text-tertiary transition-transform duration-200 ${active ? 'rotate-90' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {active ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-2">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function GenderSegment({
  value,
  copy,
  onChange,
}: {
  value: Gender;
  copy: PersonalInfoCopy;
  onChange: (value: Exclude<Gender, ''>) => void;
}) {
  return (
    <div className="flex rounded-full bg-white/5 p-1">
      {[
        { key: 'man' as const, label: copy.genderMan, Icon: Mars },
        { key: 'woman' as const, label: copy.genderWoman, Icon: Venus },
      ].map((option) => {
        const selected = value === option.key;
        const Icon = option.Icon;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.key)}
            className={`flex min-w-[76px] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              selected ? 'bg-accent text-black' : 'text-text-secondary'
            }`}
          >
            <Icon size={14} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ExactNumberDialog({
  title,
  value,
  unit,
  min,
  max,
  step,
  decimals,
  copy,
  onChange,
  onClose,
}: {
  title: string;
  value: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  copy: PersonalInfoCopy;
  onChange: (value: number) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState(value);

  const commit = () => {
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return;
    onChange(roundToStep(clamp(parsed, min, max), step, decimals));
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="personal-info-modal-layer personal-info-exact-modal-layer fixed inset-0 z-[10000] flex items-center justify-center px-10"
    >
      <button
        type="button"
        aria-label={copy.cancel}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'rgb(2 8 16 / 0.58)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 12 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-[320px] rounded-[30px] p-7 shadow-[0_24px_80px_rgb(0_0_0/0.35)]"
        style={{
          background: 'rgb(var(--color-card))',
          color: 'rgb(var(--color-text-primary))',
        }}
      >
        <div className="mb-4 text-left text-xl font-extrabold uppercase">{title}</div>
        <label className="block rounded-[24px] px-6 py-5" style={{ background: 'rgb(var(--color-background) / 0.68)' }}>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') onClose();
            }}
            className="w-full bg-transparent text-center text-[52px] font-extrabold leading-none outline-none"
            style={{ color: 'rgb(var(--color-text-primary))' }}
          />
          <span className="mt-3 block text-center text-sm font-bold uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {unit}
          </span>
        </label>
        <div className="mt-6 flex items-center justify-end gap-7 text-base font-bold">
          <button type="button" onClick={onClose} style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {copy.cancel}
          </button>
          <button type="button" onClick={commit} className="text-accent">
            {copy.set}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MeasurementModal({
  editor,
  copy,
  title,
  value,
  displayValue,
  unit,
  min,
  max,
  step,
  majorEvery,
  mediumEvery,
  pixelsPerUnit,
  decimals,
  orientation = 'horizontal',
  unitToggle,
  onChange,
  onSet,
  onClose,
}: {
  editor: Exclude<EditorKey, null>;
  copy: PersonalInfoCopy;
  title: string;
  value: number;
  displayValue: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  majorEvery: number;
  mediumEvery?: number;
  pixelsPerUnit: number;
  decimals: number;
  orientation?: 'horizontal' | 'vertical';
  unitToggle?: React.ReactNode;
  onChange: (value: number) => void;
  onSet: () => void;
  onClose: () => void;
}) {
  const [exactInput, setExactInput] = useState<ExactInputState>({ open: false, value: displayValue });

  useEffect(() => {
    setExactInput((prev) => ({ ...prev, value: displayValue }));
  }, [displayValue]);

  const exactValue = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  const isHeight = editor === 'height';

  return (
    <motion.div
      className="personal-info-modal-layer fixed inset-0 z-[9999] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        aria-label={copy.cancel}
        className="absolute inset-0"
        style={{
          background: 'rgb(2 8 16 / 0.62)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative flex max-h-[min(72dvh,560px)] w-full max-w-[430px] flex-col rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-4 shadow-[0_-24px_70px_rgb(0_0_0/0.28)]"
        style={{
          background: 'rgb(var(--color-card))',
          color: 'rgb(var(--color-text-primary))',
        }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ background: 'rgb(var(--color-background) / 0.75)' }} />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.08em]" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {title}
          </h3>
          <button
            type="button"
            aria-label={`${copy.set} ${title}`}
            onClick={() => setExactInput({ open: true, value: exactValue })}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors"
            style={{
              borderColor: 'rgb(var(--color-border) / 0.35)',
              color: 'rgb(var(--color-text-secondary))',
            }}
          >
            <Keyboard size={17} />
          </button>
        </div>
        {unitToggle ? <div className="mb-5 flex justify-center">{unitToggle}</div> : null}

        <div className="min-h-0 flex-1">
        {isHeight ? (
          <div className="grid min-h-[220px] grid-cols-[1fr_116px] items-center gap-3">
            <MeasurementDisplay value={displayValue} unit={unit} />
            <RulerCanvas
              value={value}
              min={min}
              max={max}
              step={step}
              majorEvery={majorEvery}
              mediumEvery={mediumEvery}
              pixelsPerUnit={pixelsPerUnit}
              decimals={decimals}
              orientation="vertical"
              className="h-[220px]"
              onChange={onChange}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <MeasurementDisplay value={displayValue} unit={unit} />
            <RulerCanvas
              value={value}
              min={min}
              max={max}
              step={step}
              majorEvery={majorEvery}
              mediumEvery={mediumEvery}
              pixelsPerUnit={pixelsPerUnit}
              decimals={decimals}
              orientation={orientation}
              labelPosition="below"
              className="h-[84px]"
              onChange={onChange}
            />
          </div>
        )}
        </div>

        <button
          type="button"
          onClick={onSet}
          className="mt-7 w-full rounded-[22px] bg-accent py-4 text-base font-bold text-black transition hover:bg-accent/90"
        >
          {copy.set}
        </button>

        <AnimatePresence>
          {exactInput.open ? (
            <ExactNumberDialog
              title={title}
              value={exactInput.value}
              unit={unit}
              min={min}
              max={max}
              step={step}
              decimals={decimals}
              copy={copy}
              onChange={onChange}
              onClose={() => setExactInput((prev) => ({ ...prev, open: false }))}
            />
          ) : null}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export function PersonalInfoScreen({ onNext, onDataChange, onboardingData }: PersonalInfoScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const [heightUnit, setHeightUnit] = useState<UnitMode>('metric');
  const [weightUnit, setWeightUnit] = useState<UnitMode>('metric');
  const [activeEditor, setActiveEditor] = useState<EditorKey>(null);
  const [values, setValues] = useState<CalibrationState>(() => ({
    gender: normalizeGender(onboardingData?.gender),
    age: clamp(Math.round(initialNumber(onboardingData?.age) ?? 28), 15, 60),
    heightCm: clamp(initialNumber(onboardingData?.heightCm, onboardingData?.height, onboardingData?.height_cm) ?? 175, 100, 220),
    weightKg: clamp(initialNumber(onboardingData?.weightKg, onboardingData?.weight, onboardingData?.weight_kg) ?? 75, 30, 200),
  }));
  const [draftValues, setDraftValues] = useState<CalibrationState>(values);

  const heightValue = heightUnit === 'metric'
    ? values.heightCm
    : values.heightCm / 30.48;
  const weightValue = weightUnit === 'metric'
    ? values.weightKg
    : values.weightKg * 2.2046226218;
  const draftHeightValue = heightUnit === 'metric'
    ? draftValues.heightCm
    : draftValues.heightCm / 30.48;
  const draftWeightValue = weightUnit === 'metric'
    ? draftValues.weightKg
    : draftValues.weightKg * 2.2046226218;
  const canContinue = Boolean(values.gender);
  const girlsThemeActive = values.gender === 'woman';
  const ageLabel = `${values.age} ${copy.ageUnit}`;
  const heightLabel = heightUnit === 'metric'
    ? `${Math.round(values.heightCm)} cm`
    : `${heightValue.toFixed(1)} ft`;
  const weightLabel = weightUnit === 'metric'
    ? `${values.weightKg.toFixed(1)} kg`
    : `${weightValue.toFixed(0)} lbs`;

  const updateValues = (patch: Partial<CalibrationState>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const updateDraftValues = (patch: Partial<CalibrationState>) => {
    setDraftValues((prev) => ({ ...prev, ...patch }));
  };

  const openEditor = (editor: Exclude<EditorKey, null>) => {
    setDraftValues(values);
    setActiveEditor(editor);
  };

  const closeEditor = () => {
    setActiveEditor(null);
    setDraftValues(values);
  };

  const applyEditor = () => {
    setValues(draftValues);
    setActiveEditor(null);
  };

  const handleGenderSelect = (gender: Exclude<Gender, ''>) => {
    updateValues({ gender });
    onDataChange?.({
      gender,
      onboardingTheme: gender === 'woman' ? 'girls' : 'default',
    });
  };

  const handleContinue = () => {
    if (!values.gender) return;

    const payload = {
      gender: values.gender,
      onboardingTheme: values.gender === 'woman' ? 'girls' : 'default',
      age: values.age,
      heightCm: Number(values.heightCm.toFixed(1)),
      weightKg: Number(values.weightKg.toFixed(1)),
      height: Number(values.heightCm.toFixed(1)),
      weight: Number(values.weightKg.toFixed(1)),
    };
    onDataChange?.(payload);
    onNext();
  };

  useEffect(() => {
    if (!activeEditor || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeEditor]);

  const modalContent = (
    <AnimatePresence>
      {activeEditor === 'age' ? (
        <MeasurementModal
          editor="age"
          copy={copy}
          title={copy.ageLabel}
          value={draftValues.age}
          displayValue={String(draftValues.age)}
          unit={copy.ageUnit}
          min={15}
          max={60}
          step={1}
          majorEvery={5}
          mediumEvery={1}
          pixelsPerUnit={12}
          decimals={0}
          onChange={(age) => updateDraftValues({ age: Math.round(age) })}
          onSet={applyEditor}
          onClose={closeEditor}
        />
      ) : null}

      {activeEditor === 'height' ? (
        <MeasurementModal
          editor="height"
          copy={copy}
          title={copy.heightLabel}
          value={draftHeightValue}
          displayValue={heightUnit === 'metric' ? String(Math.round(draftValues.heightCm)) : draftHeightValue.toFixed(1)}
          unit={heightUnit === 'metric' ? 'cm' : 'ft'}
          min={heightUnit === 'metric' ? 100 : 3.3}
          max={heightUnit === 'metric' ? 220 : 7.2}
          step={heightUnit === 'metric' ? 1 : 0.1}
          majorEvery={heightUnit === 'metric' ? 10 : 1}
          mediumEvery={heightUnit === 'metric' ? 5 : 0.5}
          pixelsPerUnit={heightUnit === 'metric' ? 5 : 56}
          decimals={heightUnit === 'metric' ? 0 : 1}
          orientation="vertical"
          unitToggle={<UnitToggle left="cm" right="ft" value={heightUnit} onChange={setHeightUnit} />}
          onChange={(nextValue) => {
            updateDraftValues({
              heightCm: heightUnit === 'metric'
                ? nextValue
                : clamp(Number((nextValue * 30.48).toFixed(1)), 100, 220),
            });
          }}
          onSet={applyEditor}
          onClose={closeEditor}
        />
      ) : null}

      {activeEditor === 'weight' ? (
        <MeasurementModal
          editor="weight"
          copy={copy}
          title={copy.weightLabel}
          value={draftWeightValue}
          displayValue={weightUnit === 'metric' ? draftValues.weightKg.toFixed(1) : draftWeightValue.toFixed(0)}
          unit={weightUnit === 'metric' ? 'kg' : 'lbs'}
          min={weightUnit === 'metric' ? 30 : 66}
          max={weightUnit === 'metric' ? 200 : 440}
          step={weightUnit === 'metric' ? 0.1 : 1}
          majorEvery={weightUnit === 'metric' ? 5 : 10}
          mediumEvery={weightUnit === 'metric' ? 1 : 5}
          pixelsPerUnit={weightUnit === 'metric' ? 11 : 4.4}
          decimals={weightUnit === 'metric' ? 1 : 0}
          unitToggle={<UnitToggle left="kg" right="lbs" value={weightUnit} onChange={setWeightUnit} />}
          onChange={(nextValue) => {
            updateDraftValues({
              weightKg: weightUnit === 'metric'
                ? nextValue
                : clamp(Number((nextValue / 2.2046226218).toFixed(1)), 30, 200),
            });
          }}
          onSet={applyEditor}
          onClose={closeEditor}
        />
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${girlsThemeActive ? 'girls-onboarding-theme' : ''}`}>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex min-h-full flex-col justify-center space-y-6 py-4">
          <div className="space-y-2 text-center">
            <h2 className="text-[24px] font-bold leading-tight text-white">{copy.bodyTitle}</h2>
            <p className="text-sm text-text-secondary">{copy.bodySubtitle}</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-[20px] bg-card/70"
          >
            <div className="flex min-h-[62px] items-center px-4 py-2">
              <span className="mr-3 flex w-6 shrink-0 justify-center text-text-secondary">
                <UserRound size={19} />
              </span>
              <span className="flex-1 text-sm font-medium text-text-primary">{copy.genderLabel}</span>
              <GenderSegment value={values.gender} copy={copy} onChange={handleGenderSelect} />
            </div>

            <div className="mx-4 h-px bg-white/10" />

            <BodyInfoRow
              icon={<Cake size={19} />}
              label={copy.ageLabel}
              value={ageLabel}
              active={activeEditor === 'age'}
              onClick={() => openEditor('age')}
            />

            <div className="mx-4 h-px bg-white/10" />

            <BodyInfoRow
              icon={<Ruler size={19} />}
              label={copy.heightLabel}
              value={heightLabel}
              active={activeEditor === 'height'}
              onClick={() => openEditor('height')}
            />

            <div className="mx-4 h-px bg-white/10" />

            <BodyInfoRow
              icon={<Scale size={19} />}
              label={copy.weightLabel}
              value={weightLabel}
              active={activeEditor === 'weight'}
              onClick={() => openEditor('weight')}
            />
          </motion.div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={!canContinue}
        className={`w-full rounded-xl bg-accent py-3.5 px-6 font-marker text-base font-semibold tracking-[0.08em] text-black shadow-[0_4px_14px_rgb(var(--color-accent)/0.2)] transition-all duration-200 hover:bg-accent/90 ${
          canContinue ? '' : 'pointer-events-none opacity-40'
        }`}
      >
        {copy.continue}
      </button>

      {typeof document === 'undefined'
        ? modalContent
        : createPortal(
          <div className={girlsThemeActive ? 'girls-onboarding-theme' : undefined}>
            {modalContent}
          </div>,
          document.body,
        )}
    </div>
  );
}
