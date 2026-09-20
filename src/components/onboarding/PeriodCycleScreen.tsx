import React, { useMemo, useState } from 'react';
import { getOnboardingLanguage } from './onboardingI18n';

interface PeriodCycleScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

type Confidence = 'low' | 'medium' | 'high';

type CycleStats = {
  averageCycleLength: number;
  averagePeriodLength: number;
  cycleVariation: number;
  predictedNextStart: string;
  predictedNextEnd: string;
  windowStart: string;
  windowEnd: string;
  confidence: Confidence;
  cycleLengths: number[];
};

type PeriodCycleCopy = {
  title: string;
  subtitle: string;
  lastStart: string;
  usualCycle: string;
  usualDuration: string;
  days: string;
  dontKnow: string;
  estimateTitle: string;
  mostLikely: string;
  confidence: string;
  confidenceLabels: Record<Confidence, string>;
  continue: string;
  required: string;
  futureDate: string;
};

const COPY: Record<string, PeriodCycleCopy> = {
  en: {
    title: 'Track your cycle',
    subtitle: 'RepSet can adapt recovery, energy, and training suggestions around your period.',
    lastStart: 'Last period start',
    usualCycle: 'Usual cycle length',
    usualDuration: 'Period duration',
    days: 'days',
    dontKnow: "I don't know",
    estimateTitle: 'Estimated period',
    mostLikely: 'Most likely',
    confidence: 'confidence',
    confidenceLabels: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    },
    continue: 'Continue',
    required: 'Choose the start date of your last period.',
    futureDate: 'Choose today or an earlier date.',
  },
  ar: {
    title: 'تتبعي دورتك',
    subtitle: 'يمكن لـ RepSet تعديل التعافي والطاقة واقتراحات التدريب حسب فترة الدورة.',
    lastStart: 'بداية آخر دورة',
    usualCycle: 'طول الدورة المعتاد',
    usualDuration: 'مدة الدورة',
    days: 'أيام',
    dontKnow: 'لا أعرف',
    estimateTitle: 'تقدير الدورة',
    mostLikely: 'الأقرب',
    confidence: 'الثقة',
    confidenceLabels: {
      low: 'منخفضة',
      medium: 'متوسطة',
      high: 'عالية',
    },
    continue: 'متابعة',
    required: 'اختاري تاريخ بداية آخر دورة.',
    futureDate: 'اختاري تاريخ اليوم أو تاريخًا سابقًا.',
  },
  it: {
    title: 'Monitora il ciclo',
    subtitle: 'RepSet puo adattare recupero, energia e suggerimenti di allenamento al ciclo.',
    lastStart: 'Inizio ultimo ciclo',
    usualCycle: 'Durata abituale del ciclo',
    usualDuration: 'Durata mestruazioni',
    days: 'giorni',
    dontKnow: 'Non lo so',
    estimateTitle: 'Periodo stimato',
    mostLikely: 'Piu probabile',
    confidence: 'confidenza',
    confidenceLabels: {
      low: 'Bassa',
      medium: 'Media',
      high: 'Alta',
    },
    continue: 'Continua',
    required: 'Scegli la data di inizio del tuo ultimo ciclo.',
    futureDate: 'Scegli oggi o una data precedente.',
  },
  de: {
    title: 'Zyklus verfolgen',
    subtitle: 'RepSet kann Erholung, Energie und Trainingsempfehlungen an deinen Zyklus anpassen.',
    lastStart: 'Start der letzten Periode',
    usualCycle: 'Uebliche Zykluslaenge',
    usualDuration: 'Periodendauer',
    days: 'Tage',
    dontKnow: 'Ich weiss es nicht',
    estimateTitle: 'Geschaetzte Periode',
    mostLikely: 'Am wahrscheinlichsten',
    confidence: 'Sicherheit',
    confidenceLabels: {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch',
    },
    continue: 'Weiter',
    required: 'Waehle das Startdatum deiner letzten Periode.',
    futureDate: 'Waehle heute oder ein frueheres Datum.',
  },
  fr: {
    title: 'Suis ton cycle',
    subtitle: 'RepSet peut adapter recuperation, energie et conseils d entrainement autour de tes regles.',
    lastStart: 'Debut des dernieres regles',
    usualCycle: 'Duree habituelle du cycle',
    usualDuration: 'Duree des regles',
    days: 'jours',
    dontKnow: 'Je ne sais pas',
    estimateTitle: 'Regles estimees',
    mostLikely: 'Le plus probable',
    confidence: 'confiance',
    confidenceLabels: {
      low: 'Faible',
      medium: 'Moyenne',
      high: 'Elevee',
    },
    continue: 'Continuer',
    required: 'Choisis la date de debut de tes dernieres regles.',
    futureDate: 'Choisis aujourd hui ou une date precedente.',
  },
};

const DATE_LOCALE: Record<string, string> = {
  en: 'en',
  ar: 'ar',
  it: 'it',
  de: 'de',
  fr: 'fr',
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (dateInput: string, days: number) => {
  const date = toDate(dateInput);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

const daysBetween = (start: string, end: string) => {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return null;
  const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
  return days > 0 ? days : null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const average = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = average(values);
  const variance = average(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
};

const formatDate = (value: string, language: string) => {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(DATE_LOCALE[language] || DATE_LOCALE.en, {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const normalizeHistory = (lastStart: string, previousStarts: string[]) => (
  [...previousStarts, lastStart]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => (toDate(a)?.getTime() || 0) - (toDate(b)?.getTime() || 0))
);

const calculateCycleStats = ({
  lastStart,
  cycleLength,
  periodDuration,
  previousStarts,
}: {
  lastStart: string;
  cycleLength: number | null;
  periodDuration: number | null;
  previousStarts: string[];
}): CycleStats | null => {
  if (!lastStart) return null;

  const starts = normalizeHistory(lastStart, previousStarts);
  const cycleLengths = starts
    .slice(1)
    .map((start, index) => daysBetween(starts[index], start))
    .filter((value): value is number => Boolean(value && value >= 18 && value <= 45));
  const averageCycleLength = Math.round(
    cycleLengths.length ? average(cycleLengths) : cycleLength || 29,
  );
  const averagePeriodLength = periodDuration || 5;
  const cycleVariation = clamp(Math.round(standardDeviation(cycleLengths) || 2), 2, 7);
  const predictedNextStart = addDays(lastStart, averageCycleLength);
  const predictedNextEnd = addDays(predictedNextStart, averagePeriodLength - 1);
  const windowStart = addDays(predictedNextStart, -cycleVariation);
  const windowEnd = addDays(predictedNextStart, cycleVariation);
  const confidence: Confidence = cycleLengths.length >= 3
    ? 'high'
    : cycleLengths.length >= 1 || cycleLength
      ? 'medium'
      : 'low';

  return {
    averageCycleLength,
    averagePeriodLength,
    cycleVariation,
    predictedNextStart,
    predictedNextEnd,
    windowStart,
    windowEnd,
    confidence,
    cycleLengths,
  };
};

const NumberChoice = ({
  value,
  selected,
  suffix,
  onClick,
}: {
  value: number;
  selected: boolean;
  suffix: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-all ${
      selected
        ? 'border-accent bg-accent/20 text-text-primary'
        : 'border-white/15 bg-white/[0.04] text-text-secondary hover:border-accent/40'
    }`}
  >
    {value} {suffix}
  </button>
);

export function PeriodCycleScreen({ onNext, onDataChange, onboardingData }: PeriodCycleScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language as keyof typeof COPY] || COPY.en;
  const saved = onboardingData?.periodCycle || {};
  const todayInput = useMemo(() => toDateInput(new Date()), []);
  const [lastStart, setLastStart] = useState(String(saved.lastPeriodStart || ''));
  const [cycleLength, setCycleLength] = useState<number | null>(
    Number(saved.typicalCycleLength || 0) || null,
  );
  const [periodDuration, setPeriodDuration] = useState<number | null>(
    Number(saved.typicalPeriodDuration || 0) || 5,
  );
  const [showError, setShowError] = useState(false);

  const stats = useMemo(
    () => calculateCycleStats({ lastStart, cycleLength, periodDuration, previousStarts: [] }),
    [cycleLength, lastStart, periodDuration],
  );

  const persistAndContinue = () => {
    if (!lastStart || lastStart > todayInput) {
      setShowError(true);
      return;
    }

    onDataChange?.({
      periodCycle: {
        lastPeriodStart: lastStart,
        typicalCycleLength: cycleLength,
        typicalPeriodDuration: periodDuration,
        previousPeriodStarts: [],
        records: [{ startDate: lastStart }],
        stats,
      },
    });
    onNext();
  };

  return (
    <div className="girls-onboarding-theme flex flex-1 flex-col space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold leading-tight text-white">{copy.title}</h2>
        <p className="mx-auto max-w-sm text-sm leading-6 text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
            {copy.lastStart}
          </span>
          <input
            type="date"
            value={lastStart}
            max={todayInput}
            onChange={(event) => {
              const nextValue = event.target.value;
              setLastStart(nextValue && nextValue > todayInput ? todayInput : nextValue);
              setShowError(false);
            }}
            className="w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-sm text-text-primary outline-none transition focus:border-accent/65 focus:ring-2 focus:ring-accent/20"
          />
        </label>
        {showError ? (
          <p className="ml-1 text-xs font-semibold text-rose-500">
            {lastStart && lastStart > todayInput ? copy.futureDate : copy.required}
          </p>
        ) : null}

        <div className="space-y-2">
          <div className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
            {copy.usualCycle}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[26, 28, 29, 30, 31, 32, 35].map((value) => (
              <NumberChoice
                key={value}
                value={value}
                suffix={copy.days}
                selected={cycleLength === value}
                onClick={() => setCycleLength(value)}
              />
            ))}
            <button
              type="button"
              onClick={() => setCycleLength(null)}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-all ${
                cycleLength === null
                  ? 'border-accent bg-accent/20 text-text-primary'
                  : 'border-white/15 bg-white/[0.04] text-text-secondary hover:border-accent/40'
              }`}
            >
              {copy.dontKnow}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
            {copy.usualDuration}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[3, 4, 5, 6, 7].map((value) => (
              <NumberChoice
                key={value}
                value={value}
                suffix={copy.days}
                selected={periodDuration === value}
                onClick={() => setPeriodDuration(value)}
              />
            ))}
            <button
              type="button"
              onClick={() => setPeriodDuration(null)}
              className={`col-span-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all ${
                periodDuration === null
                  ? 'border-accent bg-accent/20 text-text-primary'
                  : 'border-white/15 bg-white/[0.04] text-text-secondary hover:border-accent/40'
              }`}
            >
              {copy.dontKnow}
            </button>
          </div>
        </div>

      </div>

      {stats ? (
        <div className="rounded-3xl border border-accent/30 bg-white/70 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{copy.estimateTitle}</p>
              <h3 className="mt-1 text-xl font-bold text-white">
                {formatDate(stats.predictedNextStart, language)}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {formatDate(stats.windowStart, language)} - {formatDate(stats.windowEnd, language)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/60 px-3 py-2 text-right">
              <div className="text-lg font-bold text-white">{stats.averageCycleLength}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{copy.days}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-[11px] font-semibold text-text-secondary">
            <span>{formatDate(stats.windowStart, language)}</span>
            <span className="rounded-full bg-accent px-3 py-1 text-text-primary">{copy.mostLikely}</span>
            <span>{formatDate(stats.windowEnd, language)}</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-[#E2B4BD]/30">
            <div className="mx-auto h-full w-2 rounded-full bg-[#F9B2D7]" />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            {copy.confidenceLabels[stats.confidence]} {copy.confidence}
          </p>
        </div>
      ) : null}

      <div className="flex-1" />

      <button
        type="button"
        onClick={persistAndContinue}
        className="w-full rounded-xl bg-accent px-6 py-3.5 font-marker text-base font-semibold tracking-[0.08em] text-black shadow-[0_4px_14px_rgb(var(--color-accent)/0.2)] transition-all duration-200 hover:bg-accent/90"
      >
        {copy.continue}
      </button>
    </div>
  );
}
