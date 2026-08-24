import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Dumbbell,
  Layers3,
  ShieldCheck,
  UserRound,
  Weight,
} from 'lucide-react';
import { AppLanguage } from '../../services/language';
import { getOnboardingLanguage } from './onboardingI18n';

type AnalysisInput = {
  age?: number;
  firstName?: string;
  name?: string;
  gender?: string;
  weight?: number;
  experienceLevel?: string;
  primaryGoal?: string;
  fitnessGoal?: string;
  workoutDays?: number;
  workoutSplitPreference?: string;
  workoutSplitLabel?: string;
  sessionDuration?: number | string;
  preferredTime?: string;
  gymName?: string;
  [key: string]: unknown;
};

type CustomAdvice = {
  summary?: string;
  strengths?: string[];
  recommendations?: string[];
  metrics?: {
    trainingDays?: number;
    totalExercises?: number;
    avgExercisesPerDay?: number;
  };
};

type AssignedProgram = {
  daysPerWeek?: number;
  days_per_week?: number;
  goal?: string;
  programType?: string;
  program_type?: string;
};

interface BodyAnalysisResultsScreenProps {
  onNext: () => void;
  onboardingData?: AnalysisInput;
  userData?: AnalysisInput;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseStoredJson = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalize = (value: unknown) => String(value || '').trim();
const normalizeLower = (value: unknown) => normalize(value).toLowerCase();

const toTitleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1).toLowerCase()}`)
    .join(' ');

const BODY_RESULTS_COPY: Record<AppLanguage, {
  aboutYou: string;
  weight: string;
  age: string;
  gender: string;
  week: string;
  fitnessLevel: string;
  workoutSplit: string;
  sessionDuration: string;
  preferredTime: string;
  flexible: string;
  planReady: (firstName: string) => string;
  planReadyGeneric: string;
  planSubtitle: string;
  aiPersonalized: string;
  designedAround: string;
  adjustLater: string;
  trainingDays: string;
  day: string;
  days: string;
  startProgram: string;
}> = {
  en: {
    aboutYou: 'About you',
    weight: 'Weight',
    age: 'Age',
    gender: 'Gender',
    week: 'week',
    fitnessLevel: 'Fitness level',
    workoutSplit: 'Workout split',
    sessionDuration: 'Session duration',
    preferredTime: 'Preferred time',
    flexible: 'Flexible',
    planReady: (firstName) => `${firstName}, your plan is ready!`,
    planReadyGeneric: 'Your plan is ready!',
    planSubtitle: 'Built from your goals, schedule, and experience.',
    aiPersonalized: 'AI personalized',
    designedAround: 'Designed around your goals and availability.',
    adjustLater: 'You can adjust everything later.',
    trainingDays: 'Training days',
    day: 'day',
    days: 'days',
    startProgram: 'Start My Program',
  },
  ar: {
    aboutYou: 'نبذة عنك',
    weight: 'الوزن',
    age: 'العمر',
    gender: 'الجنس',
    week: 'أسبوع',
    fitnessLevel: 'مستوى اللياقة',
    workoutSplit: 'تقسيم التمرين',
    sessionDuration: 'مدة الجلسة',
    preferredTime: 'الوقت المفضل',
    flexible: 'مرن',
    planReady: (firstName) => `${firstName}، خطتك جاهزة!`,
    planReadyGeneric: 'خطتك جاهزة!',
    planSubtitle: 'تم بناؤها من أهدافك وجدولك وخبرتك.',
    aiPersonalized: 'مخصصة بالذكاء الاصطناعي',
    designedAround: 'مصممة حول أهدافك وتوافرك.',
    adjustLater: 'يمكنك تعديل كل شيء لاحقاً.',
    trainingDays: 'أيام التدريب',
    day: 'يوم',
    days: 'أيام',
    startProgram: 'ابدأ برنامجي',
  },
  it: {
    aboutYou: 'Su di te',
    weight: 'Peso',
    age: 'Eta',
    gender: 'Genere',
    week: 'settimana',
    fitnessLevel: 'Livello fitness',
    workoutSplit: 'Split allenamento',
    sessionDuration: 'Durata sessione',
    preferredTime: 'Orario preferito',
    flexible: 'Flessibile',
    planReady: (firstName) => `${firstName}, il tuo piano e pronto!`,
    planReadyGeneric: 'Il tuo piano e pronto!',
    planSubtitle: 'Creato dai tuoi obiettivi, orari ed esperienza.',
    aiPersonalized: 'Personalizzato AI',
    designedAround: 'Progettato intorno ai tuoi obiettivi e disponibilita.',
    adjustLater: 'Puoi modificare tutto piu tardi.',
    trainingDays: 'Giorni di training',
    day: 'giorno',
    days: 'giorni',
    startProgram: 'Inizia il mio programma',
  },
  de: {
    aboutYou: 'Uber dich',
    weight: 'Gewicht',
    age: 'Alter',
    gender: 'Geschlecht',
    week: 'Woche',
    fitnessLevel: 'Fitnesslevel',
    workoutSplit: 'Trainingssplit',
    sessionDuration: 'Einheitsdauer',
    preferredTime: 'Bevorzugte Zeit',
    flexible: 'Flexibel',
    planReady: (firstName) => `${firstName}, dein Plan ist bereit!`,
    planReadyGeneric: 'Dein Plan ist bereit!',
    planSubtitle: 'Erstellt aus deinen Zielen, deinem Zeitplan und deiner Erfahrung.',
    aiPersonalized: 'KI-personalisiert',
    designedAround: 'Entwickelt rund um deine Ziele und Verfugbarkeit.',
    adjustLater: 'Du kannst alles spater anpassen.',
    trainingDays: 'Trainingstage',
    day: 'Tag',
    days: 'Tage',
    startProgram: 'Mein Programm starten',
  },
  fr: {
    aboutYou: 'A propos de toi',
    weight: 'Poids',
    age: 'Age',
    gender: 'Genre',
    week: 'semaine',
    fitnessLevel: 'Niveau sportif',
    workoutSplit: 'Split entrainement',
    sessionDuration: 'Duree de seance',
    preferredTime: 'Horaire prefere',
    flexible: 'Flexible',
    planReady: (firstName) => `${firstName}, ton plan est pret !`,
    planReadyGeneric: 'Ton plan est pret !',
    planSubtitle: 'Construit avec tes objectifs, ton planning et ton experience.',
    aiPersonalized: 'Personnalise par IA',
    designedAround: 'Concu autour de tes objectifs et disponibilites.',
    adjustLater: 'Tu peux tout ajuster plus tard.',
    trainingDays: 'Jours d entrainement',
    day: 'jour',
    days: 'jours',
    startProgram: 'Commencer mon programme',
  },
};

const RESULT_LABELS = {
  gender: {
    en: { male: 'Man', female: 'Woman' },
    ar: { male: 'ذكر', female: 'أنثى' },
    it: { male: 'Uomo', female: 'Donna' },
    de: { male: 'Mann', female: 'Frau' },
    fr: { male: 'Homme', female: 'Femme' },
  },
  goal: {
    en: { default: 'General fitness', fat_loss: 'Fat loss', muscle_gain: 'Build muscle' },
    ar: { default: 'اللياقة العامة', fat_loss: 'خسارة الدهون', muscle_gain: 'بناء العضلات' },
    it: { default: 'Fitness generale', fat_loss: 'Perdita di grasso', muscle_gain: 'Aumento muscolare' },
    de: { default: 'Allgemeine Fitness', fat_loss: 'Fettabbau', muscle_gain: 'Muskelaufbau' },
    fr: { default: 'Fitness generale', fat_loss: 'Perte de graisse', muscle_gain: 'Prise de muscle' },
  },
  level: {
    en: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
    ar: { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' },
    it: { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzato' },
    de: { beginner: 'Anfaenger', intermediate: 'Fortgeschritten', advanced: 'Profi' },
    fr: { beginner: 'Debutant', intermediate: 'Intermediaire', advanced: 'Avance' },
  },
  time: {
    en: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
    ar: { morning: 'صباحا', afternoon: 'ظهرا', evening: 'مساء' },
    it: { morning: 'Mattina', afternoon: 'Pomeriggio', evening: 'Sera' },
    de: { morning: 'Morgens', afternoon: 'Nachmittags', evening: 'Abends' },
    fr: { morning: 'Matin', afternoon: 'Apres-midi', evening: 'Soir' },
  },
  split: {
    en: { auto: 'Coach Selected Split', full_body: 'Full Body Focus', upper_lower: 'Upper / Lower', push_pull_legs: 'Push / Pull / Legs', hybrid: 'Push / Pull / Legs + Upper / Lower', custom: 'Custom' },
    ar: { auto: 'تقسيمة يختارها المدرب', full_body: 'تركيز كامل للجسم', upper_lower: 'علوي / سفلي', push_pull_legs: 'دفع / سحب / أرجل', hybrid: 'دفع / سحب / أرجل + علوي / سفلي', custom: 'مخصص' },
    it: { auto: 'Split scelto dal coach', full_body: 'Focus full body', upper_lower: 'Upper / Lower', push_pull_legs: 'Push / Pull / Legs', hybrid: 'Push / Pull / Legs + Upper / Lower', custom: 'Personalizzato' },
    de: { auto: 'Vom Coach gewahlter Split', full_body: 'Ganzkorper-Fokus', upper_lower: 'Oberkorper / Unterkorper', push_pull_legs: 'Push / Pull / Beine', hybrid: 'Push / Pull / Beine + Oberkorper / Unterkorper', custom: 'Individuell' },
    fr: { auto: 'Split choisi par le coach', full_body: 'Focus full body', upper_lower: 'Haut / Bas du corps', push_pull_legs: 'Push / Pull / Legs', hybrid: 'Push / Pull / Legs + Haut / Bas', custom: 'Personnalise' },
  },
} as const;

const resultLabel = (
  group: keyof typeof RESULT_LABELS,
  value: unknown,
  language: AppLanguage,
  fallback = '',
) => {
  const normalized = normalizeLower(value);
  if (!normalized) return fallback;
  const labels = RESULT_LABELS[group][language] as Record<string, string>;
  return labels[normalized] || toTitleCase(normalized);
};

const formatResultGender = (value: unknown, language: AppLanguage) =>
  resultLabel('gender', value, language, '-');

const formatResultGoal = (value: unknown, language: AppLanguage) => {
  const normalized = normalizeLower(value);
  if (!normalized) return RESULT_LABELS.goal[language].default;
  return resultLabel('goal', normalized, language, RESULT_LABELS.goal[language].default);
};

const formatResultLevel = (value: unknown, language: AppLanguage) =>
  resultLabel('level', value || 'intermediate', language, RESULT_LABELS.level[language].intermediate);

const formatResultSessionDuration = (value: unknown, language: AppLanguage) => {
  const parsed = toNumber(value);
  if (parsed == null || parsed <= 0) return '-';
  return language === 'ar' ? `${Math.round(parsed)} دقيقة` : `${Math.round(parsed)} min`;
};

const formatResultPreferredTime = (value: unknown, language: AppLanguage) =>
  resultLabel('time', value, language, '-');

const formatResultSplit = (
  label: unknown,
  preference: unknown,
  fallbackProgramType: unknown,
  language: AppLanguage,
) => {
  const directLabel = normalize(label);
  if (directLabel) return directLabel;

  const normalizedPreference = normalizeLower(preference);
  if (normalizedPreference) return resultLabel('split', normalizedPreference, language, RESULT_LABELS.split[language].auto);

  return resultLabel('split', fallbackProgramType, language, RESULT_LABELS.split[language].auto);
};

type SummaryItemProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
};

function ProfileItem({ icon, label, value }: SummaryItemProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#0C1C43]/75 px-2 py-3 text-center">
      <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center text-accent">
        {icon}
      </div>
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#F3F8FF]">{value}</p>
    </div>
  );
}

function PlanItem({ icon, label, value }: SummaryItemProps) {
  return (
    <div className="flex min-h-[78px] min-w-0 items-start gap-3 p-3.5">
      <div className="mt-0.5 shrink-0 text-accent">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase leading-4 tracking-[0.09em] text-text-tertiary">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#F3F8FF]">
          {value}
        </p>
      </div>
    </div>
  );
}

const clampTrainingDays = (value: unknown) => {
  const parsed = toNumber(value);
  if (parsed == null || parsed <= 0) return null;
  return Math.min(7, Math.max(1, Math.round(parsed)));
};

const formatTrainingDaysLabel = (value: number, copy: typeof BODY_RESULTS_COPY.en) =>
  `${value} ${value === 1 ? copy.day : copy.days}/${copy.week}`;

export function BodyAnalysisResultsScreen({
  onNext,
  onboardingData,
  userData,
}: BodyAnalysisResultsScreenProps) {
  const [showCelebration, setShowCelebration] = useState(true);
  const language = getOnboardingLanguage();
  const isArabic = language === 'ar';
  const copy = BODY_RESULTS_COPY[language];
  const input = onboardingData || userData || {};

  const customAdvice = useMemo<CustomAdvice | null>(
    () => parseStoredJson('onboardingCustomAdvice') as CustomAdvice | null,
    [],
  );

  const assignedProgram = useMemo<AssignedProgram | null>(
    () => parseStoredJson('assignedProgramTemplate') as AssignedProgram | null,
    [],
  );

  const appUser = useMemo<Record<string, unknown>>(() => {
    const fromAppUser = parseStoredJson('appUser');
    if (fromAppUser && typeof fromAppUser === 'object') return fromAppUser as Record<string, unknown>;
    const fromUser = parseStoredJson('user');
    if (fromUser && typeof fromUser === 'object') return fromUser as Record<string, unknown>;
    return {};
  }, []);

  const firstName = useMemo(() => {
    const directName = normalize(input.firstName) || normalize(input.name);
    const fullName = directName || normalize(appUser?.firstName) || normalize(appUser?.name);
    if (!fullName) return '';
    return fullName.split(/\s+/)[0];
  }, [appUser, input.firstName, input.name]);

  const age = toNumber(input.age ?? appUser?.age);
  const weight = toNumber(input.weight ?? appUser?.weight_kg ?? appUser?.weight);
  const gender = formatResultGender(input.gender ?? appUser?.gender, language);

  const trainingDays = clampTrainingDays(
    assignedProgram?.daysPerWeek
    ?? assignedProgram?.days_per_week
    ?? customAdvice?.metrics?.trainingDays
    ?? input.workoutDays
    ?? appUser?.workout_days
    ?? appUser?.workoutDays,
  ) ?? 4;
  const level = formatResultLevel(input.experienceLevel, language);
  const split = formatResultSplit(
    input.workoutSplitLabel,
    input.workoutSplitPreference,
    assignedProgram?.programType ?? assignedProgram?.program_type,
    language,
  );
  const goal = formatResultGoal(input.fitnessGoal || input.primaryGoal || assignedProgram?.goal, language);
  const sessionDurationMinutes = toNumber(input.sessionDuration ?? appUser?.session_duration_minutes ?? appUser?.sessionDuration);
  const sessionDuration = formatResultSessionDuration(sessionDurationMinutes, language);
  const preferredTime = formatResultPreferredTime(input.preferredTime ?? appUser?.preferred_time ?? appUser?.preferredTime, language);

  const trainingDaysLabel = formatTrainingDaysLabel(trainingDays, copy);
  const title = firstName ? copy.planReady(firstName) : copy.planReadyGeneric;
  const preferredTimeLabel = preferredTime === '-' ? copy.flexible : preferredTime;

  useEffect(() => {
    const celebrationTimer = window.setTimeout(() => {
      setShowCelebration(false);
    }, 5000);

    return () => window.clearTimeout(celebrationTimer);
  }, []);

  return (
    <main
      className="relative -mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#090E17] px-5 text-[#F3F8FF] sm:-mx-10"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {showCelebration && (
        <div className="results-celebration-confetti" aria-hidden="true">
          {Array.from({ length: 19 }).map((_, index) => (
            <div key={index} className="results-celebration-piece" />
          ))}
        </div>
      )}

      <div className="mx-auto flex min-h-full w-full max-w-md flex-col py-1">
        <div className="flex-1 space-y-5">
          <header className="flex items-start gap-3 pt-1">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-black shadow-[0_0_28px_rgba(187,255,92,0.22)]">
              <Check aria-hidden="true" size={24} strokeWidth={3} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[1.75rem] font-bold leading-tight text-[#F3F8FF]">
                {title}
              </h1>
              <p className="mt-1 text-sm leading-5 text-[#AFC0D5]">
                {copy.planSubtitle}
              </p>
            </div>
          </header>

          <section
            aria-labelledby="profile-heading"
            className="rounded-[20px] border border-white/10 bg-[#101824]/90 p-4"
          >
            <h2 id="profile-heading" className="mb-3 text-sm font-semibold text-[#F3F8FF]">
              {copy.aboutYou}
            </h2>
            <div className="grid grid-cols-3 gap-2.5">
              <ProfileItem
                icon={<Weight aria-hidden="true" size={20} />}
                label={copy.weight}
                value={weight != null ? `${weight.toFixed(1)} ${language === 'ar' ? '\u0643\u062c\u0645' : 'kg'}` : '-'}
              />
              <ProfileItem
                icon={<UserRound aria-hidden="true" size={20} />}
                label={copy.age}
                value={age != null ? Math.round(age) : '-'}
              />
              <ProfileItem
                icon={<UserRound aria-hidden="true" size={20} />}
                label={copy.gender}
                value={gender}
              />
            </div>
          </section>

          <section
            aria-labelledby="plan-heading"
            className="relative overflow-hidden rounded-[22px] border border-accent/25 bg-[#101824] shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
            <div className="relative p-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black">
                <Dumbbell aria-hidden="true" size={13} />
                {copy.aiPersonalized}
              </span>

              <div className="mt-4">
                <h2 id="plan-heading" className="text-[1.7rem] font-bold leading-tight text-[#F3F8FF]">
                  {goal}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#AFC0D5]">
                  {copy.designedAround}
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
                  <PlanItem
                    icon={<CalendarDays aria-hidden="true" size={19} />}
                    label={copy.trainingDays}
                    value={trainingDaysLabel}
                  />
                  <PlanItem
                    icon={<Clock3 aria-hidden="true" size={19} />}
                    label={copy.sessionDuration}
                    value={sessionDuration}
                  />
                </div>

                <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
                  <PlanItem
                    icon={<Dumbbell aria-hidden="true" size={19} />}
                    label={copy.fitnessLevel}
                    value={level}
                  />
                  <PlanItem
                    icon={<Layers3 aria-hidden="true" size={19} />}
                    label={copy.workoutSplit}
                    value={split}
                  />
                </div>

                <PlanItem
                  icon={<Clock3 aria-hidden="true" size={19} />}
                  label={copy.preferredTime}
                  value={preferredTimeLabel}
                />
              </div>
            </div>
          </section>

          <p className="flex items-center justify-center gap-2 text-center text-sm text-[#AFC0D5]">
            <ShieldCheck aria-hidden="true" className="shrink-0 text-accent" size={19} />
            {copy.adjustLater}
          </p>
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 mt-5 bg-gradient-to-t from-[#090E17] via-[#090E17] to-transparent px-1 pb-1 pt-4">
          <button
            type="button"
            onClick={onNext}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3.5 text-sm font-extrabold uppercase tracking-[0.08em] text-black shadow-[0_8px_28px_rgba(187,255,92,0.2)] transition hover:bg-accent/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#090E17]"
          >
            {copy.startProgram}
            <ArrowRight aria-hidden="true" size={19} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </main>
  );
}
