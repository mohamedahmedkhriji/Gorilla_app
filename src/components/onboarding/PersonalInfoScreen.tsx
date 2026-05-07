import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mars, Venus } from 'lucide-react';
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
  genderTitle: string;
  genderSubtitle: string;
  genderMan: string;
  genderWoman: string;
  ageTitle: string;
  ageSubtitle: string;
  ageUnit: string;
  heightTitle: string;
  heightSubtitle: string;
  weightTitle: string;
  weightSubtitle: string;
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
  onChange: (value: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundToStep = (value: number, step: number, decimals = 0) => {
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(decimals));
};

const normalizeGender = (value: unknown): Gender => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'female' || normalized === 'woman' || normalized === 'f') return 'woman';
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
    genderTitle: "What's your gender?",
    genderSubtitle: 'Help us personalise your experience',
    genderMan: 'Man',
    genderWoman: 'Woman',
    ageTitle: 'How old are you?',
    ageSubtitle: 'Metabolism can change with age',
    ageUnit: 'years old',
    heightTitle: "What's your height?",
    heightSubtitle: 'Your height helps shape your body proportions',
    weightTitle: "What's your weight?",
    weightSubtitle: 'This is where your journey begins',
  },
  ar: {
    continue: '\u0645\u062a\u0627\u0628\u0639\u0629',
    genderTitle: '\u0645\u0627 \u062c\u0646\u0633\u0643\u061f',
    genderSubtitle: '\u0633\u0627\u0639\u062f\u0646\u0627 \u0639\u0644\u0649 \u062a\u062e\u0635\u064a\u0635 \u062a\u062c\u0631\u0628\u062a\u0643',
    genderMan: '\u0631\u062c\u0644',
    genderWoman: '\u0627\u0645\u0631\u0623\u0629',
    ageTitle: '\u0643\u0645 \u0639\u0645\u0631\u0643\u061f',
    ageSubtitle: '\u0642\u062f \u064a\u062a\u063a\u064a\u0631 \u0627\u0644\u0623\u064a\u0636 \u0645\u0639 \u0627\u0644\u0639\u0645\u0631',
    ageUnit: '\u0633\u0646\u0629',
    heightTitle: '\u0645\u0627 \u0637\u0648\u0644\u0643\u061f',
    heightSubtitle: '\u064a\u0633\u0627\u0639\u062f\u0646\u0627 \u0637\u0648\u0644\u0643 \u0639\u0644\u0649 \u0641\u0647\u0645 \u0646\u0633\u0628 \u062c\u0633\u0645\u0643',
    weightTitle: '\u0645\u0627 \u0648\u0632\u0646\u0643\u061f',
    weightSubtitle: '\u0645\u0646 \u0647\u0646\u0627 \u062a\u0628\u062f\u0623 \u0631\u062d\u0644\u062a\u0643',
  },
  it: {
    continue: 'Continua',
    genderTitle: 'Qual e il tuo genere?',
    genderSubtitle: 'Aiutaci a personalizzare la tua esperienza',
    genderMan: 'Uomo',
    genderWoman: 'Donna',
    ageTitle: 'Quanti anni hai?',
    ageSubtitle: 'Il metabolismo puo cambiare con l eta',
    ageUnit: 'anni',
    heightTitle: 'Quanto sei alto?',
    heightSubtitle: 'La tua altezza aiuta a definire le proporzioni del corpo',
    weightTitle: 'Quanto pesi?',
    weightSubtitle: 'Da qui inizia il tuo percorso',
  },
  de: {
    continue: 'Weiter',
    genderTitle: 'Was ist dein Geschlecht?',
    genderSubtitle: 'Hilf uns, dein Erlebnis zu personalisieren',
    genderMan: 'Mann',
    genderWoman: 'Frau',
    ageTitle: 'Wie alt bist du?',
    ageSubtitle: 'Der Stoffwechsel kann sich mit dem Alter veraendern',
    ageUnit: 'Jahre alt',
    heightTitle: 'Wie gross bist du?',
    heightSubtitle: 'Deine Groesse hilft, deine Koerperproportionen zu formen',
    weightTitle: 'Wie viel wiegst du?',
    weightSubtitle: 'Hier beginnt deine Reise',
  },
  fr: {
    continue: 'Continuer',
    genderTitle: 'Quel est ton genre ?',
    genderSubtitle: 'Aide-nous a personnaliser ton experience',
    genderMan: 'Homme',
    genderWoman: 'Femme',
    ageTitle: 'Quel age as-tu ?',
    ageSubtitle: 'Le metabolisme peut changer avec l age',
    ageUnit: 'ans',
    heightTitle: 'Quelle est ta taille ?',
    heightSubtitle: 'Ta taille aide a definir les proportions de ton corps',
    weightTitle: 'Quel est ton poids ?',
    weightSubtitle: 'C est ici que ton parcours commence',
  },
};

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4].map((dot) => (
        <span
          key={dot}
          className={`h-1.5 transition-all duration-300 ${
            dot === step ? 'w-5 rounded-sm bg-accent' : 'w-1.5 rounded-full bg-white/15'
          }`}
        />
      ))}
    </div>
  );
}

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

function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2 text-center">
      <h2 className="text-[22px] font-bold leading-tight text-white">{title}</h2>
      <p className="text-sm text-text-secondary">{subtitle}</p>
    </div>
  );
}

function AgePicker({
  value,
  unitLabel,
  onChange,
}: {
  value: number;
  unitLabel: string;
  onChange: (value: number) => void;
}) {
  const startYRef = useRef(0);
  const startValueRef = useRef(value);
  const draggingRef = useRef(false);
  const ages = useMemo(() => Array.from({ length: 46 }, (_, index) => index + 15), []);

  const setAge = useCallback(
    (nextAge: number) => onChange(clamp(Math.round(nextAge), 15, 60)),
    [onChange],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    startYRef.current = event.clientY;
    startValueRef.current = value;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setAge(startValueRef.current - ((event.clientY - startYRef.current) / 30));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setAge(value);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="text-center">
        <div className="text-[72px] font-bold leading-none tracking-[-3px] text-white">{value}</div>
        <div className="mt-2 text-xs uppercase tracking-widest text-text-tertiary">{unitLabel}</div>
      </div>

      <div
        className="relative h-44 w-full max-w-[220px] touch-none overflow-hidden"
        onWheel={(event) => {
          event.preventDefault();
          setAge(value + (event.deltaY > 0 ? 1 : -1));
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-11 w-28 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-accent/30" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {ages.map((age) => {
            const offset = age - value;
            const distance = Math.abs(offset);
            const hidden = distance > 2;
            return (
              <button
                key={age}
                type="button"
                onClick={() => setAge(age)}
                className={`absolute h-9 w-24 bg-transparent text-center transition-all duration-150 ${
                  distance === 0
                    ? 'text-[26px] font-bold text-white'
                    : distance === 1
                      ? 'text-lg font-medium text-white/45'
                      : 'text-lg font-medium text-white/22'
                }`}
                style={{
                  transform: `translateY(${offset * 36}px)`,
                  opacity: hidden ? 0 : 1,
                  pointerEvents: hidden ? 'none' : 'auto',
                }}
              >
                {age}
              </button>
            );
          })}
        </div>
      </div>
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
  onChange,
}: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(0);
  const startXRef = useRef(0);
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
    const height = 132;
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
    context.textAlign = 'center';
    context.font = '12px sans-serif';

    const centerX = width / 2;
    const tickStart = labelPosition === 'above' ? 48 : 18;
    const labelY = labelPosition === 'above' ? 23 : 102;
    const tickDirection = labelPosition === 'above' ? 1 : -1;
    const totalTicks = Math.round((max - min) / step);

    for (let index = 0; index <= totalTicks; index += 1) {
      const tickValue = roundToStep(min + (index * step), step, decimals);
      const x = centerX + ((tickValue - value) * pixelsPerUnit);
      if (x < -40 || x > width + 40) continue;

      const major = Math.abs((tickValue / majorEvery) - Math.round(tickValue / majorEvery)) < 0.0001;
      const medium = mediumEvery
        ? Math.abs((tickValue / mediumEvery) - Math.round(tickValue / mediumEvery)) < 0.0001
        : false;
      const selected = Math.abs(tickValue - value) < (step / 2);
      const tickHeight = major ? 36 : medium ? 25 : 15;
      const y1 = tickStart;
      const y2 = tickStart + (tickDirection * tickHeight);

      context.strokeStyle = selected ? selectedColor : 'rgba(255,255,255,0.25)';
      context.lineWidth = selected ? 2 : major ? 1.5 : 1;
      context.beginPath();
      context.moveTo(x, y1);
      context.lineTo(x, y2);
      context.stroke();

      if (major) {
        context.fillStyle = 'rgba(255,255,255,0.5)';
        context.fillText(decimals > 0 ? tickValue.toFixed(decimals) : String(Math.round(tickValue)), x, labelY);
      }
    }
  }, [decimals, labelPosition, majorEvery, max, mediumEvery, min, pixelsPerUnit, selectedColor, step, value]);

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
    startValueRef.current = value;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const delta = (event.clientX - startXRef.current) / pixelsPerUnit;
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
      className="relative h-[132px] w-full touch-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={(event) => {
        event.preventDefault();
        setValue(value + (event.deltaY > 0 ? step : -step));
      }}
    >
      <canvas ref={canvasRef} className="block h-[132px] w-full" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-black/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-black/80 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-3 h-[106px] w-px -translate-x-1/2 bg-accent" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-l-[7px] border-r-[7px] border-t-[10px] border-l-transparent border-r-transparent border-t-accent" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-b-[10px] border-l-[7px] border-r-[7px] border-b-accent border-l-transparent border-r-transparent" />
    </div>
  );
}

function MeasurementDisplay({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex items-end justify-center gap-2 text-center">
      <span className="text-[72px] font-bold leading-none tracking-[-3px] text-white">{value}</span>
      <span className="pb-3 text-sm font-semibold uppercase tracking-widest text-text-tertiary">{unit}</span>
    </div>
  );
}

export function PersonalInfoScreen({ onNext, onDataChange, onboardingData }: PersonalInfoScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const [step, setStep] = useState(1);
  const [heightUnit, setHeightUnit] = useState<UnitMode>('metric');
  const [weightUnit, setWeightUnit] = useState<UnitMode>('metric');
  const [values, setValues] = useState<CalibrationState>(() => ({
    gender: normalizeGender(onboardingData?.gender),
    age: clamp(Math.round(initialNumber(onboardingData?.age) ?? 28), 15, 60),
    heightCm: clamp(initialNumber(onboardingData?.heightCm, onboardingData?.height, onboardingData?.height_cm) ?? 175, 100, 220),
    weightKg: clamp(initialNumber(onboardingData?.weightKg, onboardingData?.weight, onboardingData?.weight_kg) ?? 75, 30, 200),
  }));

  const heightValue = heightUnit === 'metric'
    ? values.heightCm
    : values.heightCm / 30.48;
  const weightValue = weightUnit === 'metric'
    ? values.weightKg
    : values.weightKg * 2.2046226218;
  const canContinue = step !== 1 || Boolean(values.gender);

  const updateValues = (patch: Partial<CalibrationState>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const handleContinue = () => {
    if (step === 1 && !values.gender) return;
    if (step < 4) {
      setStep((prev) => prev + 1);
      return;
    }

    const payload = {
      gender: values.gender,
      age: values.age,
      heightCm: Number(values.heightCm.toFixed(1)),
      weightKg: Number(values.weightKg.toFixed(1)),
      height: Number(values.heightCm.toFixed(1)),
      weight: Number(values.weightKg.toFixed(1)),
    };
    onDataChange?.(payload);
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <ProgressDots step={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.25 }}
          className="flex-1 flex flex-col space-y-7"
        >
          {step === 1 ? (
            <>
              <ScreenHeader title={copy.genderTitle} subtitle={copy.genderSubtitle} />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'man' as const, label: copy.genderMan, Icon: Mars },
                  { value: 'woman' as const, label: copy.genderWoman, Icon: Venus },
                ].map(({ value, label, Icon }) => {
                  const selected = values.gender === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updateValues({ gender: value })}
                      className={`flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-5 text-sm font-medium transition-all duration-200 ${
                        selected
                          ? 'border-accent bg-accent/15 text-white'
                          : 'border-white/15 bg-white/[0.03] text-text-secondary hover:border-white/25 hover:bg-white/[0.05]'
                      }`}
                    >
                      <Icon size={28} strokeWidth={2.1} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <ScreenHeader title={copy.ageTitle} subtitle={copy.ageSubtitle} />
              <AgePicker value={values.age} unitLabel={copy.ageUnit} onChange={(age) => updateValues({ age })} />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <ScreenHeader title={copy.heightTitle} subtitle={copy.heightSubtitle} />
              <UnitToggle left="cm" right="ft" value={heightUnit} onChange={setHeightUnit} />
              <MeasurementDisplay
                value={heightUnit === 'metric' ? String(Math.round(values.heightCm)) : heightValue.toFixed(1)}
                unit={heightUnit === 'metric' ? 'cm' : 'ft'}
              />
              <RulerCanvas
                value={heightValue}
                min={heightUnit === 'metric' ? 100 : 3.3}
                max={heightUnit === 'metric' ? 220 : 7.2}
                step={heightUnit === 'metric' ? 1 : 0.1}
                majorEvery={heightUnit === 'metric' ? 10 : 1}
                mediumEvery={heightUnit === 'metric' ? 5 : 0.5}
                pixelsPerUnit={heightUnit === 'metric' ? 9 : 70}
                decimals={heightUnit === 'metric' ? 0 : 1}
                onChange={(nextValue) => {
                  updateValues({
                    heightCm: heightUnit === 'metric'
                      ? nextValue
                      : clamp(Number((nextValue * 30.48).toFixed(1)), 100, 220),
                  });
                }}
              />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <ScreenHeader title={copy.weightTitle} subtitle={copy.weightSubtitle} />
              <UnitToggle left="kg" right="lbs" value={weightUnit} onChange={setWeightUnit} />
              <MeasurementDisplay
                value={weightUnit === 'metric' ? values.weightKg.toFixed(1) : weightValue.toFixed(0)}
                unit={weightUnit === 'metric' ? 'kg' : 'lbs'}
              />
              <RulerCanvas
                value={weightValue}
                min={weightUnit === 'metric' ? 30 : 66}
                max={weightUnit === 'metric' ? 200 : 440}
                step={weightUnit === 'metric' ? 0.1 : 1}
                majorEvery={weightUnit === 'metric' ? 1 : 10}
                mediumEvery={weightUnit === 'metric' ? 0.5 : 5}
                pixelsPerUnit={weightUnit === 'metric' ? 42 : 4.4}
                labelPosition="above"
                decimals={weightUnit === 'metric' ? 1 : 0}
                onChange={(nextValue) => {
                  updateValues({
                    weightKg: weightUnit === 'metric'
                      ? nextValue
                      : clamp(Number((nextValue / 2.2046226218).toFixed(1)), 30, 200),
                  });
                }}
              />

            </>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="flex-1" />

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
    </div>
  );
}
