import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CalendarDays, Clock3, Dumbbell, Layers3, MapPin } from 'lucide-react';
import { AppLanguage } from '../../services/language';
import { getOnboardingLanguage } from './onboardingI18n';

type AnalysisInput = {
  age?: number;
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

type CoachPlan = {
  planName?: string;
  summary?: string;
  goalMatch?: string;
  usedImages?: number;
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
  goal?: string;
  programType?: string;
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

const formatGender = (value: unknown, language: AppLanguage) => {
  const normalized = normalizeLower(value);
  if (!normalized) return '-';
  if (language === 'ar') {
    if (normalized === 'male') return 'ذكر';
    if (normalized === 'female') return 'أنثى';
  }
  return toTitleCase(normalized);
};

const formatGoal = (value: unknown, language: AppLanguage) => {
  const normalized = normalizeLower(value);
  if (!normalized) return language === 'ar' ? 'اللياقة العامة' : 'General fitness';
  if (normalized === 'fat_loss') return language === 'ar' ? 'خسارة الدهون' : 'Fat loss';
  if (normalized === 'muscle_gain') return language === 'ar' ? 'بناء العضلات' : 'Build muscle';
  return toTitleCase(normalized);
};

const formatLevel = (value: unknown, language: AppLanguage) => {
  const normalized = normalizeLower(value);
  if (!normalized) return language === 'ar' ? 'متوسط' : 'Intermediate';
  if (language === 'ar') {
    if (normalized === 'beginner') return 'مبتدئ';
    if (normalized === 'intermediate') return 'متوسط';
    if (normalized === 'advanced') return 'متقدم';
  }
  return toTitleCase(normalized);
};

const formatSessionDuration = (value: unknown, language: AppLanguage) => {
  const parsed = toNumber(value);
  if (parsed == null || parsed <= 0) return '-';
  return language === 'ar'
    ? `${Math.round(parsed)} دقيقة`
    : `${Math.round(parsed)} min`;
};

const formatPreferredTime = (value: unknown, language: AppLanguage) => {
  const normalized = normalizeLower(value);
  if (!normalized) return '-';
  if (normalized === 'morning') return language === 'ar' ? 'صباحًا' : 'Morning';
  if (normalized === 'afternoon') return language === 'ar' ? 'ظهرًا' : 'Afternoon';
  if (normalized === 'evening') return language === 'ar' ? 'مساءً' : 'Evening';
  return toTitleCase(normalized);
};

const mapProgramTypeToSplit = (value: unknown, language: AppLanguage) => {
  const normalized = normalizeLower(value);
  if (!normalized) return '';
  if (normalized === 'full_body') return language === 'ar' ? 'تركيز كامل للجسم' : 'Full Body Focus';
  if (normalized === 'upper_lower') return language === 'ar' ? 'علوي / سفلي' : 'Upper / Lower';
  if (normalized === 'push_pull_legs') return language === 'ar' ? 'دفع / سحب / أرجل' : 'Push / Pull / Legs';
  if (normalized === 'hybrid') return language === 'ar' ? 'دفع / سحب / أرجل + علوي / سفلي' : 'Push / Pull / Legs + Upper / Lower';
  if (normalized === 'custom') return language === 'ar' ? 'مخصص' : 'Custom';
  return toTitleCase(normalized);
};

const formatSplit = (
  label: unknown,
  preference: unknown,
  fallbackProgramType: unknown,
  language: AppLanguage,
) => {
  const directLabel = normalize(label);
  if (directLabel) return directLabel;

  const normalizedPreference = normalizeLower(preference);
  if (normalizedPreference === 'auto') return language === 'ar' ? 'تقسيمة يختارها المدرب' : 'Coach Selected Split';
  if (normalizedPreference) return mapProgramTypeToSplit(normalizedPreference, language);

  return mapProgramTypeToSplit(fallbackProgramType, language)
    || (language === 'ar' ? 'تقسيمة يختارها المدرب' : 'Coach Selected Split');
};

const BODY_RESULTS_COPY: Record<AppLanguage, {
  athlete: string;
  aiSystem: string;
  readySuffix: string;
  aboutYou: string;
  weight: string;
  age: string;
  gender: string;
  builtForYou: string;
  aiAdvice: string;
  sessions: string;
  week: string;
  fitnessLevel: string;
  location: string;
  workoutSplit: string;
  sessionDuration: string;
  preferredTime: string;
  gym: string;
  notSelected: string;
  defaultSummary: (goal: string) => string;
  buildMuscleHeadline: string;
  startProgram: string;
}> = {
  en: {
    athlete: 'Athlete',
    aiSystem: 'AI training system',
    readySuffix: 'is ready.',
    aboutYou: 'About you',
    weight: 'Weight',
    age: 'Age',
    gender: 'Gender',
    builtForYou: 'Built for you',
    aiAdvice: 'AI Advice',
    sessions: 'Sessions',
    week: 'week',
    fitnessLevel: 'Fitness level',
    location: 'Location',
    workoutSplit: 'Workout split',
    sessionDuration: 'Session duration',
    preferredTime: 'Preferred time',
    gym: 'Gym',
    notSelected: 'Not selected',
    defaultSummary: (goal) => `A personalized ${goal.toLowerCase()} plan built from your answers and schedule.`,
    buildMuscleHeadline: 'Build and tone muscle',
    startProgram: 'Start My Program',
  },
  ar: {
    athlete: 'رياضي',
    aiSystem: 'نظام التدريب بالذكاء الاصطناعي',
    readySuffix: 'جاهز.',
    aboutYou: 'نبذة عنك',
    weight: 'الوزن',
    age: 'العمر',
    gender: 'الجنس',
    builtForYou: 'مصممة لك',
    aiAdvice: 'نصائح الذكاء الاصطناعي',
    sessions: 'الجلسات',
    week: 'أسبوع',
    fitnessLevel: 'مستوى اللياقة',
    location: 'الموقع',
    workoutSplit: 'تقسيم التمرين',
    sessionDuration: 'مدة الجلسة',
    preferredTime: 'الوقت المفضل',
    gym: 'نادي',
    notSelected: 'غير محدد',
    defaultSummary: (goal) => `خطة ${goal.toLowerCase()} مخصصة مبنية على إجاباتك وجدولك.`,
    buildMuscleHeadline: 'بناء وشد العضلات',
    startProgram: 'ابدأ برنامجي',
  },
  it: {
    athlete: 'Atleta',
    aiSystem: 'sistema di allenamento AI',
    readySuffix: 'e pronto.',
    aboutYou: 'Su di te',
    weight: 'Peso',
    age: 'Eta',
    gender: 'Genere',
    builtForYou: 'Creato per te',
    aiAdvice: 'Consigli AI',
    sessions: 'Sessioni',
    week: 'settimana',
    fitnessLevel: 'Livello fitness',
    location: 'Posizione',
    workoutSplit: 'Split allenamento',
    sessionDuration: 'Durata sessione',
    preferredTime: 'Orario preferito',
    gym: 'Palestra',
    notSelected: 'Non selezionato',
    defaultSummary: (goal) => `Un piano personalizzato per ${goal.toLowerCase()} costruito dalle tue risposte e dal tuo programma.`,
    buildMuscleHeadline: 'Costruisci e tonifica i muscoli',
    startProgram: 'Inizia il mio programma',
  },
  de: {
    athlete: 'Athlet',
    aiSystem: 'KI-Trainingssystem',
    readySuffix: 'ist bereit.',
    aboutYou: 'Uber dich',
    weight: 'Gewicht',
    age: 'Alter',
    gender: 'Geschlecht',
    builtForYou: 'Fur dich erstellt',
    aiAdvice: 'KI-Tipps',
    sessions: 'Einheiten',
    week: 'Woche',
    fitnessLevel: 'Fitnesslevel',
    location: 'Standort',
    workoutSplit: 'Trainingssplit',
    sessionDuration: 'Einheitsdauer',
    preferredTime: 'Bevorzugte Zeit',
    gym: 'Gym',
    notSelected: 'Nicht ausgewahlt',
    defaultSummary: (goal) => `Ein personalisierter Plan fur ${goal.toLowerCase()}, erstellt aus deinen Antworten und deinem Zeitplan.`,
    buildMuscleHeadline: 'Muskeln aufbauen und formen',
    startProgram: 'Mein Programm starten',
  },
  fr: {
    athlete: 'Athlete',
    aiSystem: 'systeme d entrainement IA',
    readySuffix: 'est pret.',
    aboutYou: 'A propos de toi',
    weight: 'Poids',
    age: 'Age',
    gender: 'Genre',
    builtForYou: 'Construit pour toi',
    aiAdvice: 'Conseils IA',
    sessions: 'Seances',
    week: 'semaine',
    fitnessLevel: 'Niveau sportif',
    location: 'Lieu',
    workoutSplit: 'Split entrainement',
    sessionDuration: 'Duree de seance',
    preferredTime: 'Horaire prefere',
    gym: 'Salle',
    notSelected: 'Non selectionne',
    defaultSummary: (goal) => `Un programme personnalise pour ${goal.toLowerCase()} construit a partir de tes reponses et de ton planning.`,
    buildMuscleHeadline: 'Construire et tonifier les muscles',
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

  const coachPlan = useMemo<CoachPlan | null>(
    () => parseStoredJson('onboardingCoachPlan') as CoachPlan | null,
    [],
  );

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
    const fullName = normalize(appUser?.name);
    if (!fullName) return copy.athlete;
    return fullName.split(' ')[0];
  }, [appUser, copy.athlete]);

  const age = toNumber(input.age);
  const weight = toNumber(input.weight);
  const gender = formatResultGender(input.gender, language);

  const preferredTrainingDays = toNumber(input.workoutDays) ?? toNumber(assignedProgram?.daysPerWeek) ?? 4;
  const trainingDays = Math.max(2, Math.min(6, Math.round(preferredTrainingDays)));
  const level = formatResultLevel(input.experienceLevel, language);
  const split = formatResultSplit(
    input.workoutSplitLabel,
    input.workoutSplitPreference,
    assignedProgram?.programType,
    language,
  );
  const goal = formatResultGoal(input.fitnessGoal || input.primaryGoal || assignedProgram?.goal, language);
  const sessionDuration = formatResultSessionDuration(
    input.sessionDuration ?? appUser?.session_duration_minutes,
    language,
  );
  const preferredTime = formatResultPreferredTime(input.preferredTime ?? appUser?.preferred_time, language);

  const gymId = toNumber(appUser?.gym_id);
  const gymLabel = normalize(input.gymName) || (gymId ? `${copy.gym} #${gymId}` : copy.notSelected);
  const summaryText =
    normalize(customAdvice?.summary)
    || normalize(coachPlan?.goalMatch)
    || normalize(coachPlan?.summary)
    || copy.defaultSummary(goal);
  const planLabel = normalize(coachPlan?.planName) || 'RepSet AI';
  const planHeadline = normalizeLower(input.fitnessGoal || input.primaryGoal || assignedProgram?.goal) === 'muscle_gain'
    ? copy.buildMuscleHeadline
    : goal;
  const headline = (
    <>
      {firstName}, <span className="text-accent">{copy.aiSystem}</span> {copy.readySuffix}
    </>
  );

  useEffect(() => {
    const celebrationTimer = window.setTimeout(() => {
      setShowCelebration(false);
    }, 5000);

    return () => window.clearTimeout(celebrationTimer);
  }, []);

  return (
    <div className="relative flex-1 flex flex-col space-y-6 overflow-hidden">
      {showCelebration && (
        <div className="results-celebration-confetti" aria-hidden="true">
          {Array.from({ length: 19 }).map((_, index) => (
            <div key={index} className="results-celebration-piece" />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-[1.9rem] leading-tight font-semibold text-white">{headline}</h2>
      </div>

      <Card className="rounded-2xl border border-white/10 bg-[#091533]/80 p-4">
        <p className="text-base font-semibold text-white mb-3">{copy.aboutYou}</p>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-white/10 bg-[#0c1c43]/85 p-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{copy.weight}</p>
            <p className="text-sm text-white mt-1">
              {weight != null ? `${weight.toFixed(1)} ${language === 'ar' ? '\u0643\u062c\u0645' : 'kg'}` : '-'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c1c43]/85 p-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{copy.age}</p>
            <p className="text-sm text-white mt-1">{age != null ? `${Math.round(age)}` : '-'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c1c43]/85 p-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{copy.gender}</p>
            <p className="text-sm text-white mt-1">{gender}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <p className="text-base font-semibold text-white">{copy.builtForYou}</p>
        <Card className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#0a1a3d] p-0">
          <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.02),rgba(255,255,255,0),rgba(191,255,0,0.09))]" />
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent/12 blur-3xl" />
          <div className="relative p-5 space-y-4">
            <p className="text-3xl font-extrabold uppercase tracking-[0.08em] text-white">{planLabel}</p>
            <div className="space-y-1">
              <h3 className="text-[1.55rem] leading-tight font-semibold text-white">{planHeadline}</h3>
              <p className="text-sm text-text-secondary">{summaryText}</p>
            </div>

            {Array.isArray(customAdvice?.recommendations) && customAdvice?.recommendations.length > 0 && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
                  {copy.aiAdvice}
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
                  {customAdvice.recommendations.slice(0, 3).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <CalendarDays size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">{copy.sessions}</span>
                </div>
                <p className="text-sm text-white mt-1">
                  {trainingDays}/{copy.week}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Dumbbell size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">{copy.fitnessLevel}</span>
                </div>
                <p className="text-sm text-white mt-1">{level}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <MapPin size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">{copy.location}</span>
                </div>
                <p className="text-sm text-white mt-1">{gymLabel}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Layers3 size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">{copy.workoutSplit}</span>
                </div>
                <p className="text-sm text-white mt-1">{split}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Clock3 size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">{copy.sessionDuration}</span>
                </div>
                <p className="text-sm text-white mt-1">{sessionDuration}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <CalendarDays size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">{copy.preferredTime}</span>
                </div>
                <p className="text-sm text-white mt-1">{preferredTime}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} className="uppercase tracking-[0.11em]">
        {copy.startProgram}
      </Button>
    </div>
  );
}
