import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Header } from '../ui/Header';
import { SlidersHorizontal, ChevronDown, X, Zap } from 'lucide-react';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage, normalizeLocalizedValue } from '../../services/language';
import BodyMap from '../BodyMap';
import { MuscleSvgBadge } from '../workout/MuscleSvgBadge';
import {
  BodyMapLevels,
  BodyMapMuscle,
  recoveryMuscleToBodyMapSlugs,
  recoveryScoreToBodyMapLevel,
} from '../../lib/muscle-map';

interface MuscleRecoveryScreenProps {
  onBack: () => void;
}

const isGirlsStyleValue = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girls';
};

const readRecoveryStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const readRecoveryStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const readOnboardingProfile = (user: any) => {
  const rawProfile = user?.onboarding_profile || user?.onboardingProfile;
  if (!rawProfile) return {};
  if (typeof rawProfile === 'object') return rawProfile;
  try {
    return JSON.parse(String(rawProfile));
  } catch {
    return {};
  }
};

const shouldUseGirlsRecoveryTheme = (user: any, styleGender: string) => {
  if (styleGender) return isGirlsStyleValue(styleGender);
  const profile = readOnboardingProfile(user);
  return isGirlsStyleValue(user?.gender) || isGirlsStyleValue(profile?.gender) || profile?.onboardingTheme === 'girls';
};

type MuscleRecoveryItem = {
  muscle: string;
  name: string;
  score: number;
  lastWorkout: string | null;
  hoursNeeded?: number;
  hoursElapsed?: number;
  hoursRemaining?: number;
  overtrainingRisk?: boolean;
  plannedTodaySetUnits?: number;
  completedTodaySetUnits?: number;
  todayPlanCompletionPct?: number;
  plannedWeekSetUnits?: number;
  completedWeekSetUnits?: number;
  weekPlanCompletionPct?: number;
  completedTodayVolume?: number;
  completedWeekVolume?: number;
};

const DEFAULT_MUSCLES: MuscleRecoveryItem[] = [
  { muscle: 'chest', name: 'Chest', score: 100, lastWorkout: null },
  { muscle: 'back', name: 'Back', score: 100, lastWorkout: null },
  { muscle: 'quadriceps', name: 'Quadriceps', score: 100, lastWorkout: null },
  { muscle: 'hamstrings', name: 'Hamstrings', score: 100, lastWorkout: null },
  { muscle: 'glutes', name: 'Glutes', score: 100, lastWorkout: null },
  { muscle: 'shoulders', name: 'Shoulders', score: 100, lastWorkout: null },
  { muscle: 'biceps', name: 'Biceps', score: 100, lastWorkout: null },
  { muscle: 'triceps', name: 'Triceps', score: 100, lastWorkout: null },
  { muscle: 'forearms', name: 'Forearms', score: 100, lastWorkout: null },
  { muscle: 'adductors', name: 'Adductors', score: 100, lastWorkout: null },
  { muscle: 'calves', name: 'Calves', score: 100, lastWorkout: null },
  { muscle: 'tibialis', name: 'Tibialis', score: 100, lastWorkout: null },
  { muscle: 'abs', name: 'Abs', score: 100, lastWorkout: null },
];

const AR_MUSCLE_LABELS: Record<string, string> = {
  glutes: '\u0627\u0644\u0623\u0644\u064a\u0629',
  chest: 'الصدر',
  back: 'الظهر',
  quadriceps: 'الرباعية',
  hamstrings: 'الخلفية',
  shoulders: 'الأكتاف',
  biceps: 'البايسبس',
  triceps: 'الترايسبس',
  forearms: 'الساعد',
  adductors: 'المقربات',
  calves: 'السمانة',
  tibialis: 'الظنبوبية',
  abs: 'البطن',
};

const IT_MUSCLE_LABELS: Record<string, string> = {
  glutes: 'Glutei',
  chest: 'Petto',
  back: 'Schiena',
  quadriceps: 'Quadricipiti',
  hamstrings: 'Femorali',
  shoulders: 'Spalle',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Avambracci',
  adductors: 'Adduttori',
  calves: 'Polpacci',
  tibialis: 'Tibiale',
  abs: 'Addome',
};

const DE_MUSCLE_LABELS: Record<string, string> = {
  glutes: 'Gesaess',
  chest: 'Brust',
  back: 'Ruecken',
  quadriceps: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  shoulders: 'Schultern',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  adductors: 'Adduktoren',
  calves: 'Waden',
  tibialis: 'Schienbein',
  abs: 'Bauch',
};

const FR_MUSCLE_LABELS: Record<string, string> = {
  glutes: 'Fessiers',
  chest: 'Pectoraux',
  back: 'Dos',
  quadriceps: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  shoulders: 'Epaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  adductors: 'Adducteurs',
  calves: 'Mollets',
  tibialis: 'Tibial',
  abs: 'Abdos',
};

const RECOVERY_I18N = {
  en: {
    title: 'Muscle Recovery',
    damaged: 'Damaged muscles',
    almost: 'Almost ready',
    ready: 'Ready to train',
    lastTrained: 'Last trained',
    today: 'Today',
    yesterday: 'Yesterday',
    daysAgo: (days: number) => `${days} days ago`,
    notTrained: 'Not trained recently',
    todayLabel: 'Today',
    weekLabel: 'Week',
    setsLabel: 'sets',
    remaining: 'Remaining',
    volume: 'Volume',
    hourAbbr: 'h',
    factorsTitle: 'Recovery Factors',
    sleepHours: 'Sleep Hours',
    protein: 'Protein Intake',
    supplements: 'Supplements',
    soreness: 'Muscle soreness',
    energy: 'Energy',
    fatigue: 'Fatigue',
    mood: 'Mood',
    jointPain: 'Joint pain',
    signalLow: 'Low',
    signalBalanced: 'Balanced',
    signalHigh: 'High',
    nonePain: 'None',
    mildPain: 'Mild',
    sharpPain: 'High',
    cancel: 'Cancel',
    update: 'Update',
    low: 'Low (<0.8g/kg)',
    medium: 'Medium (0.8-1.2g/kg)',
    high: 'High (1.6-2.2g/kg)',
    none: 'None',
    creatine: 'Creatine',
    full: 'Full Stack',
    loadError: 'Failed to load recovery status',
    updateError: 'Failed to update recovery factors',
    updating: 'Updating...',
    fullRecoveryIn: 'Full recovery in',
    fullyRecovered: 'Fully recovered',
  },
  ar: {
    title: '\u062a\u0639\u0627\u0641\u064a \u0627\u0644\u0639\u0636\u0644\u0627\u062a',
    damaged: '\u0639\u0636\u0644\u0627\u062a \u0645\u0631\u0647\u0642\u0629',
    almost: '\u0639\u0644\u0649 \u0648\u0634\u0643 \u0627\u0644\u062a\u0639\u0627\u0641\u064a',
    ready: '\u062c\u0627\u0647\u0632 \u0644\u0644\u062a\u062f\u0631\u064a\u0628',
    lastTrained: '\u0622\u062e\u0631 \u062a\u062f\u0631\u064a\u0628',
    today: '\u0627\u0644\u064a\u0648\u0645',
    yesterday: '\u0623\u0645\u0633',
    daysAgo: (days: number) => `\u0642\u0628\u0644 ${days} \u0623\u064a\u0627\u0645`,
    notTrained: '\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0645\u0624\u062e\u0631\u064b\u0627',
    todayLabel: '\u0627\u0644\u064a\u0648\u0645',
    weekLabel: '\u0627\u0644\u0623\u0633\u0628\u0648\u0639',
    setsLabel: '\u0645\u062c\u0645\u0648\u0639\u0627\u062a',
    remaining: '\u0627\u0644\u0645\u062a\u0628\u0642\u064a',
    volume: '\u0627\u0644\u062d\u062c\u0645',
    hourAbbr: '\u0633',
    factorsTitle: '\u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u062a\u0639\u0627\u0641\u064a',
    sleepHours: '\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0646\u0648\u0645',
    protein: '\u062a\u0646\u0627\u0648\u0644 \u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646',
    supplements: '\u0627\u0644\u0645\u0643\u0645\u0644\u0627\u062a',
    soreness: '\u0627\u0644\u0623\u0644\u0645 \u0627\u0644\u0639\u0636\u0644\u064a',
    energy: '\u0627\u0644\u0637\u0627\u0642\u0629',
    fatigue: '\u0627\u0644\u0625\u062c\u0647\u0627\u062f',
    mood: '\u0627\u0644\u0645\u0632\u0627\u062c',
    jointPain: '\u0623\u0644\u0645 \u0627\u0644\u0645\u0641\u0627\u0635\u0644',
    signalLow: '\u0645\u0646\u062e\u0641\u0636',
    signalBalanced: '\u0645\u062a\u0648\u0627\u0632\u0646',
    signalHigh: '\u0645\u0631\u062a\u0641\u0639',
    nonePain: '\u0644\u0627 \u064a\u0648\u062c\u062f',
    mildPain: '\u062e\u0641\u064a\u0641',
    sharpPain: '\u0645\u0631\u062a\u0641\u0639',
    cancel: '\u0625\u0644\u063a\u0627\u0621',
    update: '\u062a\u062d\u062f\u064a\u062b',
    low: '\u0645\u0646\u062e\u0641\u0636 (\u0623\u0642\u0644 \u0645\u0646 0.8\u063a/\u0643\u063a)',
    medium: '\u0645\u062a\u0648\u0633\u0637 (0.8-1.2\u063a/\u0643\u063a)',
    high: '\u0645\u0631\u062a\u0641\u0639 (1.6-2.2\u063a/\u0643\u063a)',
    none: '\u0628\u062f\u0648\u0646',
    creatine: '\u0643\u0631\u064a\u0627\u062a\u064a\u0646',
    full: '\u0645\u062c\u0645\u0648\u0639\u0629 \u0643\u0627\u0645\u0644\u0629',
    loadError: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u0639\u0627\u0641\u064a',
    updateError: '\u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u062a\u0639\u0627\u0641\u064a',
    updating: '\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u062f\u064a\u062b...',
    fullRecoveryIn: '\u0627\u0644\u062a\u0639\u0627\u0641\u064a \u0627\u0644\u0643\u0627\u0645\u0644 \u062e\u0644\u0627\u0644',
    fullyRecovered: '\u062a\u0645 \u0627\u0644\u062a\u0639\u0627\u0641\u064a \u0643\u0627\u0645\u0644\u064b\u0627',
  },
  it: {
    title: 'Recupero Muscolare',
    damaged: 'Muscoli affaticati',
    almost: 'Quasi pronti',
    ready: 'Pronti ad allenarsi',
    lastTrained: 'Ultimo allenamento',
    today: 'Oggi',
    yesterday: 'Ieri',
    daysAgo: (days: number) => `${days} giorni fa`,
    notTrained: 'Non allenato di recente',
    todayLabel: 'Oggi',
    weekLabel: 'Settimana',
    setsLabel: 'serie',
    remaining: 'Rimanenti',
    volume: 'Volume',
    hourAbbr: 'h',
    factorsTitle: 'Fattori di Recupero',
    sleepHours: 'Ore di sonno',
    protein: 'Assunzione proteica',
    supplements: 'Integratori',
    soreness: 'Indolenzimento muscolare',
    energy: 'Energia',
    fatigue: 'Fatica',
    mood: 'Umore',
    jointPain: 'Dolore articolare',
    signalLow: 'Basso',
    signalBalanced: 'Bilanciato',
    signalHigh: 'Alto',
    nonePain: 'Nessuno',
    mildPain: 'Lieve',
    sharpPain: 'Alto',
    cancel: 'Annulla',
    update: 'Aggiorna',
    low: 'Basso (<0.8g/kg)',
    medium: 'Medio (0.8-1.2g/kg)',
    high: 'Alto (1.6-2.2g/kg)',
    none: 'Nessuno',
    creatine: 'Creatina',
    full: 'Stack completo',
    loadError: 'Impossibile caricare lo stato di recupero',
    updateError: 'Impossibile aggiornare i fattori di recupero',
    updating: 'Aggiornamento...',
    fullRecoveryIn: 'Recupero completo tra',
    fullyRecovered: 'Recupero completo',
  },
  de: {
    title: 'Muskelerholung',
    damaged: 'Erschoepfte Muskeln',
    almost: 'Fast bereit',
    ready: 'Bereit fuers Training',
    lastTrained: 'Zuletzt trainiert',
    today: 'Heute',
    yesterday: 'Gestern',
    daysAgo: (days: number) => `vor ${days} Tagen`,
    notTrained: 'Nicht kuerzlich trainiert',
    todayLabel: 'Heute',
    weekLabel: 'Woche',
    setsLabel: 'Saetze',
    remaining: 'Verbleibend',
    volume: 'Volumen',
    hourAbbr: 'h',
    factorsTitle: 'Erholungsfaktoren',
    sleepHours: 'Schlafstunden',
    protein: 'Proteinzufuhr',
    supplements: 'Supplemente',
    soreness: 'Muskelkater',
    energy: 'Energie',
    fatigue: 'Ermuedung',
    mood: 'Stimmung',
    jointPain: 'Gelenkschmerz',
    signalLow: 'Niedrig',
    signalBalanced: 'Stabil',
    signalHigh: 'Hoch',
    nonePain: 'Kein',
    mildPain: 'Leicht',
    sharpPain: 'Hoch',
    cancel: 'Abbrechen',
    update: 'Aktualisieren',
    low: 'Niedrig (<0.8g/kg)',
    medium: 'Mittel (0.8-1.2g/kg)',
    high: 'Hoch (1.6-2.2g/kg)',
    none: 'Keine',
    creatine: 'Kreatin',
    full: 'Kompletter Stack',
    loadError: 'Erholungsstatus konnte nicht geladen werden',
    updateError: 'Erholungsfaktoren konnten nicht aktualisiert werden',
    updating: 'Wird aktualisiert...',
    fullRecoveryIn: 'Vollstaendige Erholung in',
    fullyRecovered: 'Vollstaendig erholt',
  },
  fr: {
    title: 'Recuperation musculaire',
    damaged: 'Muscles fatigues',
    almost: 'Presque prets',
    ready: 'Prets a s entrainer',
    lastTrained: 'Dernier entrainement',
    today: 'Aujourd hui',
    yesterday: 'Hier',
    daysAgo: (days: number) => `Il y a ${days} jours`,
    notTrained: 'Pas entraine recemment',
    todayLabel: 'Aujourd hui',
    weekLabel: 'Semaine',
    setsLabel: 'series',
    remaining: 'Restant',
    volume: 'Volume',
    hourAbbr: 'h',
    factorsTitle: 'Facteurs de recuperation',
    sleepHours: 'Heures de sommeil',
    protein: 'Apport en proteines',
    supplements: 'Supplements',
    soreness: 'Courbatures',
    energy: 'Energie',
    fatigue: 'Fatigue',
    mood: 'Humeur',
    jointPain: 'Douleur articulaire',
    signalLow: 'Faible',
    signalBalanced: 'Equilibre',
    signalHigh: 'Eleve',
    nonePain: 'Aucune',
    mildPain: 'Legere',
    sharpPain: 'Elevee',
    cancel: 'Annuler',
    update: 'Mettre a jour',
    low: 'Faible (<0.8g/kg)',
    medium: 'Moyen (0.8-1.2g/kg)',
    high: 'Eleve (1.6-2.2g/kg)',
    none: 'Aucun',
    creatine: 'Creatine',
    full: 'Pack complet',
    loadError: 'Impossible de charger l etat de recuperation',
    updateError: 'Impossible de mettre a jour les facteurs de recuperation',
    updating: 'Mise a jour...',
    fullRecoveryIn: 'Recuperation complete dans',
    fullyRecovered: 'Recuperation complete',
  },
} as const;

type RecoveryFactorsState = {
  sleepHours: string;
  proteinIntake: string;
  supplements: string;
  soreness: number;
  energy: number;
  fatigue: number;
  mood: number;
  jointPain: number;
  nutrition_quality?: string;
  stress_level?: string;
};

const normalizeRecoveryMuscleKey = (value: unknown) => {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  if (!key) return '';
  if (
    /(^|\s)(abs?|abdominal|abdominals|abdominis|core|oblique|obliques|stomach)(\s|$)/.test(key)
    || key.includes('six pack')
  ) return 'abs';
  if (key.includes('chest') || key.includes('pec')) return 'chest';
  if (key.includes('back') || key.includes('lat') || key.includes('trap')) return 'back';
  if (key.includes('quad')) return 'quadriceps';
  if (key.includes('hamstring')) return 'hamstrings';
  if (key.includes('glute')) return 'glutes';
  if (key.includes('shoulder') || key.includes('delt')) return 'shoulders';
  if (key.includes('bicep')) return 'biceps';
  if (key.includes('tricep')) return 'triceps';
  if (
    key.includes('forearm')
    || key.includes('fore arm')
    || key.includes('avant bra')
    || key.includes('avant bras')
    || key.includes('avant-bras')
    || key.includes('wrist')
    || key.includes('grip')
  ) return 'forearms';
  if (
    key.includes('adductor')
    || key.includes('adducteur')
    || key.includes('addicteur')
    || key.includes('inner thigh')
  ) return 'adductors';
  if (key.includes('calf') || key.includes('calves') || key.includes('claves') || key.includes('mollet') || key.includes('moulet')) return 'calves';
  if (key.includes('shin') || key.includes('tibia') || key.includes('tibialis') || key.includes('tibial')) return 'tibialis';
  return key;
};

const mergeRecoveryWithDefaults = (incoming: MuscleRecoveryItem[] = []): MuscleRecoveryItem[] => {
  const safeNumber = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const byName = new Map<string, MuscleRecoveryItem>();
  const mergeDuplicateMuscle = (
    current: MuscleRecoveryItem | undefined,
    next: MuscleRecoveryItem,
  ): MuscleRecoveryItem => {
    if (!current) return next;

    const currentScore = safeNumber(current.score, 100);
    const nextScore = safeNumber(next.score, 100);

    return {
      ...current,
      ...next,
      score: Math.min(currentScore, nextScore),
      lastWorkout: next.lastWorkout || current.lastWorkout || null,
      hoursNeeded: Math.max(safeNumber(current.hoursNeeded, 0), safeNumber(next.hoursNeeded, 0)),
      hoursElapsed: Math.max(safeNumber(current.hoursElapsed, 0), safeNumber(next.hoursElapsed, 0)),
      hoursRemaining: Math.max(safeNumber(current.hoursRemaining, 0), safeNumber(next.hoursRemaining, 0)),
      plannedTodaySetUnits: safeNumber(current.plannedTodaySetUnits, 0) + safeNumber(next.plannedTodaySetUnits, 0),
      completedTodaySetUnits: safeNumber(current.completedTodaySetUnits, 0) + safeNumber(next.completedTodaySetUnits, 0),
      plannedWeekSetUnits: safeNumber(current.plannedWeekSetUnits, 0) + safeNumber(next.plannedWeekSetUnits, 0),
      completedWeekSetUnits: safeNumber(current.completedWeekSetUnits, 0) + safeNumber(next.completedWeekSetUnits, 0),
      completedTodayVolume: safeNumber(current.completedTodayVolume, 0) + safeNumber(next.completedTodayVolume, 0),
      completedWeekVolume: safeNumber(current.completedWeekVolume, 0) + safeNumber(next.completedWeekVolume, 0),
    };
  };

  incoming.forEach((m) => {
    const keys = Array.from(new Set([
      normalizeRecoveryMuscleKey(m.muscle),
      normalizeRecoveryMuscleKey(m.name),
      String(m.muscle || '').trim().toLowerCase(),
      String(m.name || '').trim().toLowerCase(),
    ].filter(Boolean)));

    keys.forEach((key) => byName.set(key, mergeDuplicateMuscle(byName.get(key), m)));
  });

  return DEFAULT_MUSCLES.map((muscle) => {
    const found = byName.get(normalizeRecoveryMuscleKey(muscle.muscle))
      || byName.get(normalizeRecoveryMuscleKey(muscle.name))
      || byName.get(muscle.name.toLowerCase())
      || byName.get(muscle.muscle.toLowerCase());
    if (!found) return muscle;
    return {
      ...muscle,
      ...found,
      muscle: muscle.muscle,
      name: muscle.name,
      score: Number.isFinite(Number(found.score)) ? Math.max(0, Math.min(100, Math.round(Number(found.score)))) : 100,
      lastWorkout: found.lastWorkout ?? null,
      hoursNeeded: safeNumber(found.hoursNeeded, 0),
      hoursElapsed: safeNumber(found.hoursElapsed, 0),
      hoursRemaining: safeNumber(found.hoursRemaining, 0),
      plannedTodaySetUnits: safeNumber(found.plannedTodaySetUnits, 0),
      completedTodaySetUnits: safeNumber(found.completedTodaySetUnits, 0),
      todayPlanCompletionPct: Math.max(0, Math.min(100, Math.round(safeNumber(found.todayPlanCompletionPct, 0)))),
      plannedWeekSetUnits: safeNumber(found.plannedWeekSetUnits, 0),
      completedWeekSetUnits: safeNumber(found.completedWeekSetUnits, 0),
      weekPlanCompletionPct: Math.max(0, Math.min(100, Math.round(safeNumber(found.weekPlanCompletionPct, 0)))),
      completedTodayVolume: safeNumber(found.completedTodayVolume, 0),
      completedWeekVolume: safeNumber(found.completedWeekVolume, 0),
    };
  });
};

const toBodyMapLevels = (muscles: MuscleRecoveryItem[]): BodyMapLevels => {
  const levels: BodyMapLevels = {};

  muscles.forEach((muscle) => {
    const muscleKeys = [muscle.muscle, muscle.name]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const slugs = Array.from(new Set(muscleKeys.flatMap((value) => recoveryMuscleToBodyMapSlugs(value))));
    const level = recoveryScoreToBodyMapLevel(Number(muscle.score || 0));

    slugs.forEach((slug) => {
      levels[slug] = Math.max(levels[slug] || 0, level);
    });
  });

  return levels;
};

function RecoveryBodyMap({
  muscles,
  labels,
  selected,
  onMuscleSelect,
  themeVariant = 'default',
}: {
  muscles: MuscleRecoveryItem[];
  labels: {
    damaged: string;
    almost: string;
    ready: string;
  };
  selected?: BodyMapMuscle | null;
  onMuscleSelect?: (muscle: BodyMapMuscle) => void;
  themeVariant?: 'default' | 'girls';
}) {
  const [isGlitching, setIsGlitching] = useState(true);
  const bodyMapLevels = toBodyMapLevels(muscles);
  const animationKey = muscles.map((muscle) => `${muscle.muscle}:${muscle.name}:${muscle.score}`).join('|');
  const isGirlsTheme = themeVariant === 'girls';

  useEffect(() => {
    setIsGlitching(true);
    const timer = window.setTimeout(() => {
      setIsGlitching(false);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [animationKey]);

  return (
    <div
      className={`target-muscle-body-map rounded-2xl border p-4 ${
        isGirlsTheme
          ? 'border-[#E2B4BD]/55 bg-white/[0.72] shadow-[0_18px_42px_rgba(226,180,189,0.18)]'
          : 'surface-card border-white/10'
      } ${isGlitching ? 'is-glitching' : ''}`}
    >
      <BodyMap
        className="recovery-bodymap"
        levels={bodyMapLevels}
        selected={selected}
        onMuscle={onMuscleSelect}
      />
      <div className={`mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-tertiary'}`}>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
          <span>0-39%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#f97316]" />
          <span>{labels.damaged}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#eab308]" />
          <span>{labels.almost}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
          <span>{labels.ready}</span>
        </div>
      </div>
    </div>
  );
}

const RECOVERY_DAY_MS = 24 * 60 * 60 * 1000;

const RECOVERY_DATE_LOCALE: Record<string, string> = {
  en: 'en-US',
  ar: 'ar',
  it: 'it-IT',
  de: 'de-DE',
  fr: 'fr-FR',
};

const toRecoveryDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
};

const toRecoveryDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addRecoveryDays = (dateInput: string, days: number) => {
  const date = toRecoveryDate(dateInput);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return toRecoveryDateInput(date);
};

const daysBetweenRecoveryDates = (start: string, end: string) => {
  const startDate = toRecoveryDate(start);
  const endDate = toRecoveryDate(end);
  if (!startDate || !endDate) return null;
  return Math.round((endDate.getTime() - startDate.getTime()) / RECOVERY_DAY_MS);
};

const formatRecoveryPeriodDate = (value: string, language: AppLanguage) => {
  const date = toRecoveryDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(RECOVERY_DATE_LOCALE[language] || RECOVERY_DATE_LOCALE.en, {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const readSavedPeriodCycle = () => {
  const user = readRecoveryStoredUser();
  const profile = readOnboardingProfile(user);
  const rawProfile = (() => {
    try {
      return JSON.parse(localStorage.getItem('onboardingData') || localStorage.getItem('onboardingProfile') || '{}');
    } catch {
      return {};
    }
  })();
  return profile?.periodCycle || profile?.period_cycle || rawProfile?.periodCycle || rawProfile?.period_cycle || null;
};

const getPeriodCarouselCopy = (language: AppLanguage) => {
  if (language === 'ar') {
    return {
      title: 'متابعة الدورة',
      noDataTitle: 'أضيفي بيانات الدورة',
      noDataBody: 'سنظهر توقعات الدورة هنا بعد تسجيل آخر بداية.',
      estimated: 'الدورة المتوقعة',
      window: 'النافذة',
      cycleDay: 'يوم الدورة',
      daysLeft: 'أيام',
      today: 'اليوم',
      activePeriod: 'أيام الدورة',
      likelyNow: 'قد تبدأ قريباً',
      training: 'اقتراح التدريب',
      softer: 'يمكنك التدريب بشكل طبيعي إذا كنت مرتاحة. خففي الشدة إذا كانت الأعراض أو الطاقة تجعل التدريب صعباً.',
      periodSoon: 'قد تبدأ الدورة قريباً. تدربي بشكل طبيعي مع مراقبة الطاقة والأعراض.',
      normal: 'يمكنك التدريب بشكل طبيعي مع مراقبة الطاقة.',
      around: 'حوالي',
      detailsTitle: 'تفاصيل الدورة',
      close: 'إغلاق',
      lastStart: 'آخر بداية',
      nextPeriod: 'الدورة القادمة',
      estimateWindow: 'نافذة التوقع',
      cycleAverage: 'متوسط الدورة',
      periodDuration: 'مدة الدورة',
      confidence: 'الثقة',
      cycleAverageBody: 'متوسط مدة الدورة',
      showCard: 'عرض بطاقة الدورة',
      jointPainNote: 'تجنبي التحميل الثقيل على المنطقة المؤلمة.',
    };
  }
  if (language === 'fr') {
    return {
      title: 'Cycle menstruel',
      noDataTitle: 'Ajoute ton cycle',
      noDataBody: 'Les estimations apparaitront ici apres la derniere date de debut.',
      estimated: 'Periode estimee',
      window: 'Fenetre',
      cycleDay: 'Jour du cycle',
      daysLeft: 'jours',
      today: 'Aujourd hui',
      activePeriod: 'Periode en cours',
      likelyNow: 'Peut commencer bientot',
      training: 'Conseil training',
      softer: 'Tu peux t entrainer normalement si tu te sens bien. Reduis l intensite si les symptomes ou l energie rendent la seance difficile.',
      periodSoon: 'Ta periode peut commencer bientot. Entraine-toi normalement en surveillant energie et symptomes.',
      normal: 'Tu peux t entrainer normalement en surveillant ton energie.',
      around: 'Autour du',
      detailsTitle: 'Details du cycle',
      close: 'Fermer',
      lastStart: 'Dernier debut',
      nextPeriod: 'Prochaine periode',
      estimateWindow: 'Fenetre estimee',
      cycleAverage: 'Cycle moyen',
      periodDuration: 'Duree',
      confidence: 'Confiance',
      cycleAverageBody: 'moyenne du cycle',
      showCard: 'Afficher la carte cycle',
      jointPainNote: 'Evite les charges lourdes sur la zone douloureuse.',
    };
  }
  if (language === 'it') {
    return {
      title: 'Controllo ciclo',
      noDataTitle: 'Aggiungi il ciclo',
      noDataBody: 'Mostreremo le stime qui dopo l ultima data di inizio.',
      estimated: 'Periodo stimato',
      window: 'Finestra',
      cycleDay: 'Giorno ciclo',
      daysLeft: 'giorni',
      today: 'Oggi',
      activePeriod: 'Periodo in corso',
      likelyNow: 'Potrebbe iniziare presto',
      training: 'Consiglio training',
      softer: 'Puoi allenarti normalmente se ti senti a tuo agio. Riduci l intensita se sintomi o energia rendono difficile allenarti.',
      periodSoon: 'Il ciclo potrebbe iniziare presto. Allenati normalmente monitorando energia e sintomi.',
      normal: 'Puoi allenarti normalmente monitorando energia e sintomi.',
      around: 'Intorno al',
      detailsTitle: 'Dettagli ciclo',
      close: 'Chiudi',
      lastStart: 'Ultimo inizio',
      nextPeriod: 'Prossimo periodo',
      estimateWindow: 'Finestra stimata',
      cycleAverage: 'Ciclo medio',
      periodDuration: 'Durata',
      confidence: 'Confidenza',
      cycleAverageBody: 'media del ciclo',
      showCard: 'Mostra scheda ciclo',
      jointPainNote: 'Evita carichi pesanti sulla zona dolorante.',
    };
  }
  if (language === 'de') {
    return {
      title: 'Zykluscheck',
      noDataTitle: 'Zyklus hinzufuegen',
      noDataBody: 'Schaetzungen erscheinen hier nach dem letzten Startdatum.',
      estimated: 'Geschaetzte Periode',
      window: 'Fenster',
      cycleDay: 'Zyklustag',
      daysLeft: 'Tage',
      today: 'Heute',
      activePeriod: 'Periode aktiv',
      likelyNow: 'Kann bald starten',
      training: 'Trainingstipp',
      softer: 'Du kannst normal trainieren, wenn du dich wohl fuehlst. Reduziere die Intensitaet, wenn Symptome oder Energie das Training erschweren.',
      periodSoon: 'Deine Periode kann bald beginnen. Trainiere normal und beobachte Energie und Symptome.',
      normal: 'Du kannst normal trainieren und deine Energie beobachten.',
      around: 'Um den',
      detailsTitle: 'Zyklusdetails',
      close: 'Schliessen',
      lastStart: 'Letzter Start',
      nextPeriod: 'Naechste Periode',
      estimateWindow: 'Geschaetztes Fenster',
      cycleAverage: 'Durchschnittlicher Zyklus',
      periodDuration: 'Dauer',
      confidence: 'Sicherheit',
      cycleAverageBody: 'Zyklusdurchschnitt',
      showCard: 'Zykluskarte anzeigen',
      jointPainNote: 'Vermeide schwere Belastung im schmerzenden Bereich.',
    };
  }
  return {
    title: 'Cycle check-in',
    noDataTitle: 'Add your cycle',
    noDataBody: 'Your period estimate will show here after your last start date is saved.',
    estimated: 'Estimated period',
    window: 'Window',
    cycleDay: 'Cycle day',
    daysLeft: 'days',
    today: 'Today',
    activePeriod: 'Period days',
    likelyNow: 'May start soon',
    training: 'Training note',
    softer: 'You can train normally if you feel comfortable. Reduce intensity if symptoms or energy make training difficult.',
    periodSoon: 'Your period may start soon. Train normally while monitoring energy and symptoms.',
    normal: 'Train normally while watching energy and symptoms.',
    around: 'Around',
    detailsTitle: 'Period details',
    close: 'Close',
    lastStart: 'Last start',
    nextPeriod: 'Next period',
    estimateWindow: 'Estimate window',
    cycleAverage: 'Cycle average',
    periodDuration: 'Period duration',
    confidence: 'Confidence',
    cycleAverageBody: 'cycle average',
    showCard: 'Show cycle card',
    jointPainNote: 'Avoid heavy loading on the painful area.',
  };
};

function GirlsPeriodCarousel({ language, jointPainLevel = 0 }: { language: AppLanguage; jointPainLevel?: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showPeriodDetails, setShowPeriodDetails] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchDidSwipeRef = useRef(false);
  const copy = getPeriodCarouselCopy(language);
  const periodCycle = readSavedPeriodCycle();
  const lastStart = String(periodCycle?.lastPeriodStart || periodCycle?.last_period_start || periodCycle?.records?.[0]?.startDate || '').slice(0, 10);
  const stats = periodCycle?.stats || {};
  const cycleLength = Math.round(Number(stats.averageCycleLength || periodCycle?.typicalCycleLength || periodCycle?.typical_cycle_length || 29));
  const periodLength = Math.round(Number(stats.averagePeriodLength || periodCycle?.typicalPeriodDuration || periodCycle?.typical_period_duration || 5));
  const cycleLengths = Array.isArray(stats.cycleLengths) ? stats.cycleLengths : [];
  const variation = Math.max(1, Math.min(10, Math.round(Number(
    stats.cycleVariation
    || (cycleLengths.length >= 1 ? 4 : 7),
  ))));
  const confidence = String(stats.confidence || (lastStart ? 'medium' : 'low'));
  const predictedStart = String(stats.predictedNextStart || (lastStart ? addRecoveryDays(lastStart, cycleLength) : '')).slice(0, 10);
  const predictedEnd = String(stats.predictedNextEnd || (predictedStart ? addRecoveryDays(predictedStart, periodLength - 1) : '')).slice(0, 10);
  const windowStart = String(stats.windowStart || (predictedStart ? addRecoveryDays(predictedStart, -variation) : '')).slice(0, 10);
  const windowEnd = String(stats.windowEnd || (predictedStart ? addRecoveryDays(predictedStart, variation) : '')).slice(0, 10);
  const today = toRecoveryDateInput(new Date());
  const daysUntil = predictedStart ? daysBetweenRecoveryDates(today, predictedStart) : null;
  const cycleDay = lastStart ? Math.max(1, (daysBetweenRecoveryDates(lastStart, today) || 0) + 1) : null;
  const currentPeriodEnd = lastStart ? addRecoveryDays(lastStart, periodLength - 1) : '';
  const inPeriod = lastStart && currentPeriodEnd && today >= lastStart && today <= currentPeriodEnd;
  const periodMayStartSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 2;
  const trainingNote = jointPainLevel >= 7
    ? copy.jointPainNote
    : inPeriod
      ? copy.softer
      : periodMayStartSoon
        ? copy.periodSoon
        : copy.normal;

  const cards = lastStart && predictedStart ? [
    {
      eyebrow: copy.estimated,
      title: `${copy.around} ${formatRecoveryPeriodDate(predictedStart, language)}`,
      body: `${copy.window}: ${formatRecoveryPeriodDate(windowStart, language)} - ${formatRecoveryPeriodDate(windowEnd, language)}`,
      stat: daysUntil === null ? '-' : daysUntil <= 0 ? copy.today : `${daysUntil}`,
      tint: 'from-[#FFF5F5] via-white to-[#F7D6D0]/60',
      ring: 'border-[#E2B4BD]/55',
    },
    {
      eyebrow: inPeriod ? copy.activePeriod : copy.cycleDay,
      title: inPeriod ? `${formatRecoveryPeriodDate(lastStart, language)} - ${formatRecoveryPeriodDate(currentPeriodEnd, language)}` : `${copy.cycleDay} ${cycleDay || '-'}`,
      body: daysUntil !== null && daysUntil < 0 ? copy.likelyNow : `${cycleLength} ${copy.daysLeft} ${copy.cycleAverageBody}`,
      stat: cycleDay ? `${cycleDay}` : '-',
      tint: 'from-[#F7D6D0]/70 via-white to-[#F9B2D7]/20',
      ring: 'border-[#F9B2D7]/45',
    },
    {
      eyebrow: copy.training,
      title: trainingNote,
      body: predictedEnd ? `${copy.estimated}: ${formatRecoveryPeriodDate(predictedStart, language)} - ${formatRecoveryPeriodDate(predictedEnd, language)}` : copy.normal,
      stat: jointPainLevel >= 7 || inPeriod || periodMayStartSoon ? '!' : 'OK',
      tint: 'from-[#CFECF3]/60 via-white to-[#FFF5F5]',
      ring: 'border-[#CFECF3]/80',
    },
  ] : [
    {
      eyebrow: copy.title,
      title: copy.noDataTitle,
      body: copy.noDataBody,
      stat: '-',
      tint: 'from-[#FFF5F5] via-white to-[#CFECF3]/35',
      ring: 'border-[#E2B4BD]/55',
    },
  ];

  const goTo = (nextIndex: number) => {
    const normalized = (nextIndex + cards.length) % cards.length;
    setActiveIndex(normalized);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchDidSwipeRef.current = false;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartXRef.current) - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(delta) < 36) return;
    goTo(activeIndex + (delta < 0 ? 1 : -1));
    touchDidSwipeRef.current = true;
  };

  const activeCard = cards[Math.min(activeIndex, cards.length - 1)];
  const periodDetailRows = [
    { label: copy.lastStart, value: lastStart ? formatRecoveryPeriodDate(lastStart, language) : '-' },
    { label: copy.nextPeriod, value: predictedStart ? `${formatRecoveryPeriodDate(predictedStart, language)} - ${formatRecoveryPeriodDate(predictedEnd, language)}` : '-' },
    { label: copy.estimateWindow, value: windowStart && windowEnd ? `${formatRecoveryPeriodDate(windowStart, language)} - ${formatRecoveryPeriodDate(windowEnd, language)}` : '-' },
    { label: copy.cycleDay, value: cycleDay ? String(cycleDay) : '-' },
    { label: copy.cycleAverage, value: `${cycleLength} ${copy.daysLeft}` },
    { label: copy.periodDuration, value: `${periodLength} ${copy.daysLeft}` },
    { label: copy.confidence, value: confidence },
  ];

  useEffect(() => {
    if (activeIndex >= cards.length) setActiveIndex(0);
  }, [activeIndex, cards.length]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E2B4BD]/50 bg-white/[0.74] p-4 shadow-[0_18px_42px_rgba(226,180,189,0.18)] ring-1 ring-white/45">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A87884]">{copy.title}</div>
          <div className="mt-1 text-sm font-semibold text-[#4A4A4A]">{activeIndex + 1} / {cards.length}</div>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        className={`cursor-pointer rounded-[1.35rem] border ${activeCard.ring} bg-gradient-to-br ${activeCard.tint} p-4 transition-colors active:scale-[0.99]`}
        onClick={() => {
          if (touchDidSwipeRef.current) {
            touchDidSwipeRef.current = false;
            return;
          }
          setShowPeriodDetails(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setShowPeriodDetails(true);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A87884]">{activeCard.eyebrow}</div>
            <h3 className="mt-2 truncate text-xl font-bold text-[#4A4A4A]">{activeCard.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#795E67]">{activeCard.body}</p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/75 text-xl font-black text-[#4A4A4A] shadow-[0_12px_26px_rgba(226,180,189,0.16)]">
            {activeCard.stat}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {cards.map((card, index) => (
          <button
            key={card.eyebrow}
            type="button"
            onClick={() => goTo(index)}
            className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-[#F9B2D7]' : 'w-1.5 bg-[#E2B4BD]/55'}`}
            aria-label={`${copy.showCard} ${index + 1}`}
          />
        ))}
      </div>
      {showPeriodDetails && typeof document !== 'undefined' ? createPortal(
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-[#4A4A4A]/35 p-4 backdrop-blur-sm"
          onClick={() => setShowPeriodDetails(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-[1.8rem] border border-[#E2B4BD]/55 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(255,245,245,0.90)_58%,rgba(207,236,243,0.28))] text-[#4A4A4A] shadow-[0_24px_70px_rgba(226,180,189,0.26)] ring-1 ring-white/55"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E2B4BD]/35 px-5 py-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A87884]">{copy.title}</div>
                <h3 className="mt-1 text-xl font-bold text-[#4A4A4A]">{copy.detailsTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPeriodDetails(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2B4BD]/45 bg-white/70 text-[#A87884] transition-colors hover:border-[#F9B2D7]/70 hover:text-[#4A4A4A]"
                aria-label={copy.close}
              >
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-5">
              <div className={`rounded-2xl border ${activeCard.ring} bg-gradient-to-br ${activeCard.tint} p-4`}>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A87884]">{activeCard.eyebrow}</div>
                <div className="mt-2 text-lg font-bold text-[#4A4A4A]">{activeCard.title}</div>
                <p className="mt-2 text-sm leading-6 text-[#795E67]">{activeCard.body}</p>
              </div>
              <div className="grid gap-2">
                {periodDetailRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2B4BD]/35 bg-white/65 px-3 py-2.5">
                    <span className="text-xs font-semibold text-[#A87884]">{row.label}</span>
                    <span className="text-right text-sm font-bold text-[#4A4A4A]">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="rounded-2xl border border-[#CFECF3]/70 bg-[#CFECF3]/35 px-3 py-3 text-sm leading-6 text-[#795E67]">
                {trainingNote}
              </p>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}

export function MuscleRecoveryScreen({ onBack }: MuscleRecoveryScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage(getStoredLanguage()));
  const [selectedBodyMapMuscle, setSelectedBodyMapMuscle] = useState<BodyMapMuscle | null>(null);
  const [selectedRecoveryMuscleKey, setSelectedRecoveryMuscleKey] = useState<string | null>(null);
  const [themeRefreshKey, setThemeRefreshKey] = useState(0);
  const isArabic = language === 'ar';
  const legacyCopy = {
    title: isArabic ? 'تعافي العضلات' : 'Muscle Recovery',
    damaged: isArabic ? 'عضلات مرهقة' : 'Damaged muscles',
    almost: isArabic ? 'على وشك التعافي' : 'Almost ready',
    ready: isArabic ? 'جاهز للتدريب' : 'Ready to train',
    lastTrained: isArabic ? 'آخر تدريب' : 'Last trained',
    today: isArabic ? 'اليوم' : 'Today',
    yesterday: isArabic ? 'أمس' : 'Yesterday',
    daysAgo: (days: number) => (isArabic ? `قبل ${days} أيام` : `${days} days ago`),
    notTrained: isArabic ? 'لم يتم التدريب مؤخرًا' : 'Not trained recently',
    todayLabel: isArabic ? 'اليوم' : 'Today',
    weekLabel: isArabic ? 'الأسبوع' : 'Week',
    setsLabel: isArabic ? 'مجموعات' : 'sets',
    remaining: isArabic ? 'المتبقي' : 'Remaining',
    volume: isArabic ? 'الحجم' : 'Volume',
    hourAbbr: isArabic ? 'س' : 'h',
    factorsTitle: isArabic ? 'عوامل التعافي' : 'Recovery Factors',
    sleepHours: isArabic ? 'ساعات النوم' : 'Sleep Hours',
    protein: isArabic ? 'تناول البروتين' : 'Protein Intake',
    supplements: isArabic ? 'المكملات' : 'Supplements',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    update: isArabic ? 'تحديث' : 'Update',
    low: isArabic ? 'منخفض (أقل من 0.8غ/كغ)' : 'Low (<0.8g/kg)',
    medium: isArabic ? 'متوسط (0.8-1.2غ/كغ)' : 'Medium (0.8-1.2g/kg)',
    high: isArabic ? 'مرتفع (1.6-2.2غ/كغ)' : 'High (1.6-2.2g/kg)',
    none: isArabic ? 'بدون' : 'None',
    creatine: isArabic ? 'كرياتين' : 'Creatine',
    full: isArabic ? 'مجموعة كاملة' : 'Full Stack',
    loadError: isArabic ? 'تعذر تحميل حالة التعافي' : 'Failed to load recovery status',
    updateError: isArabic ? 'تعذر تحديث عوامل التعافي' : 'Failed to update recovery factors',
  };
  void legacyCopy;
  const copy = RECOVERY_I18N[language as keyof typeof RECOVERY_I18N] || RECOVERY_I18N.en;
  const [muscleRecoveries, setMuscleRecoveries] = useState<MuscleRecoveryItem[]>(() => mergeRecoveryWithDefaults([]));
  const [showFactors, setShowFactors] = useState(false);
  const [openFactorsMenu, setOpenFactorsMenu] = useState<'protein' | 'supplements' | null>(null);
  const factorsMenuRef = useRef<HTMLDivElement | null>(null);
  const [factors, setFactors] = useState<RecoveryFactorsState>({
    sleepHours: '7',
    proteinIntake: 'medium',
    supplements: 'none',
    soreness: 3,
    energy: 6,
    fatigue: 4,
    mood: 6,
    jointPain: 0,
    nutrition_quality: 'optimal',
    stress_level: 'low',
  });
  const [error, setError] = useState('');
  const [isUpdatingFactors, setIsUpdatingFactors] = useState(false);
  const localizedMuscleLabels = useMemo(() => normalizeLocalizedValue(
    language === 'ar'
      ? AR_MUSCLE_LABELS
      : language === 'it'
        ? IT_MUSCLE_LABELS
        : language === 'de'
          ? DE_MUSCLE_LABELS
          : language === 'fr'
            ? FR_MUSCLE_LABELS
          : {},
  ), [language]);
  const isGirlsTheme = useMemo(
    () => shouldUseGirlsRecoveryTheme(readRecoveryStoredUser(), readRecoveryStyleGender()),
    [themeRefreshKey],
  );

  useEffect(() => {
    const refreshTheme = () => setThemeRefreshKey((current) => current + 1);
    window.addEventListener('repset:stored-user-changed', refreshTheme);
    window.addEventListener('repset:app-style-gender-changed', refreshTheme);
    window.addEventListener('storage', refreshTheme);
    return () => {
      window.removeEventListener('repset:stored-user-changed', refreshTheme);
      window.removeEventListener('repset:app-style-gender-changed', refreshTheme);
      window.removeEventListener('storage', refreshTheme);
    };
  }, []);

  useEffect(() => {
    if (!openFactorsMenu) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (factorsMenuRef.current && !factorsMenuRef.current.contains(event.target as Node)) {
        setOpenFactorsMenu(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [openFactorsMenu]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  const loadRecovery = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      if (!user.id) {
        setMuscleRecoveries(mergeRecoveryWithDefaults([]));
        return;
      }

      const data = await api.getRecoveryStatus(user.id);
      setMuscleRecoveries(mergeRecoveryWithDefaults(Array.isArray(data?.recovery) ? data.recovery : []));
      if (data.factors) setFactors((prev) => ({ ...prev, ...data.factors }));
      setError('');
    } catch (loadError) {
      console.error('Failed to load recovery status:', loadError);
      setMuscleRecoveries(mergeRecoveryWithDefaults([]));
      setError(loadError instanceof Error ? loadError.message : copy.loadError);
    }
  };

  useEffect(() => {
    void loadRecovery();

    const handleRecoveryUpdated = () => {
      void loadRecovery();
    };

    window.addEventListener('recovery-updated', handleRecoveryUpdated);

    const pendingRefreshInterval = window.setInterval(() => {
      if (localStorage.getItem('recoveryNeedsUpdate') !== 'true') return;
      localStorage.removeItem('recoveryNeedsUpdate');
      void loadRecovery();
    }, 2000);

    const periodicRefreshInterval = window.setInterval(() => {
      void loadRecovery();
    }, 30000);

    return () => {
      window.removeEventListener('recovery-updated', handleRecoveryUpdated);
      window.clearInterval(pendingRefreshInterval);
      window.clearInterval(periodicRefreshInterval);
    };
  }, []);

  const handleUpdateFactors = async () => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    if (!user.id) {
      setError(copy.updateError);
      return;
    }

    setIsUpdatingFactors(true);
    try {
      await api.updateRecoveryFactors(user.id, {
        sleepHours: factors.sleepHours,
        proteinIntake: factors.proteinIntake,
        supplements: factors.supplements,
        nutritionQuality: factors.nutrition_quality,
        stressLevel: factors.stress_level,
        sorenessLevel: factors.soreness,
        energyLevel: factors.energy,
        fatigueLevel: factors.fatigue,
        moodLevel: factors.mood,
        jointPainLevel: factors.jointPain,
      });
      await api.recalculateTodayRecovery(user.id);
      await loadRecovery();
      setError('');
      setShowFactors(false);
    } catch (updateError) {
      console.error('Failed to update recovery factors:', updateError);
      setError(updateError instanceof Error ? updateError.message : copy.updateError);
    } finally {
      setIsUpdatingFactors(false);
    }
  };

  const standardSignalOptions = useMemo(() => ([
    { label: copy.signalLow, value: 3 },
    { label: copy.signalBalanced, value: 6 },
    { label: copy.signalHigh, value: 8 },
  ]), [copy.signalBalanced, copy.signalHigh, copy.signalLow]);

  const painSignalOptions = useMemo(() => ([
    { label: copy.nonePain, value: 0 },
    { label: copy.mildPain, value: 4 },
    { label: copy.sharpPain, value: 8 },
  ]), [copy.mildPain, copy.nonePain, copy.sharpPain]);

  const proteinOptions = useMemo(() => ([
    { label: copy.low, value: 'low' },
    { label: copy.medium, value: 'medium' },
    { label: copy.high, value: 'high' },
  ]), [copy.high, copy.low, copy.medium]);

  const supplementOptions = useMemo(() => ([
    { label: copy.none, value: 'none' },
    { label: copy.creatine, value: 'creatine' },
    { label: copy.full, value: 'full' },
  ]), [copy.creatine, copy.full, copy.none]);

  const renderFactorsDropdown = (
    menuKey: 'protein' | 'supplements',
    value: string,
    options: Array<{ label: string; value: string }>,
    onChange: (next: string) => void,
  ) => {
    const selectedOption = options.find((option) => option.value === value) || options[0];
    const isOpen = openFactorsMenu === menuKey;

    return (
      <div ref={isOpen ? factorsMenuRef : undefined} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setOpenFactorsMenu((current) => (current === menuKey ? null : menuKey))}
          className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors focus:outline-none ${
            isGirlsTheme
              ? 'border-[#E2B4BD]/45 bg-white/70 text-[#4A4A4A] hover:border-[#F9B2D7]/70 focus:border-[#F9B2D7]/70'
              : 'border-white/10 bg-background text-white hover:border-accent/35 focus:border-accent/50'
          }`}
        >
          <span>{selectedOption.label}</span>
          <ChevronDown
            size={20}
            className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-secondary'}`}
            aria-hidden="true"
          />
        </button>
        {isOpen ? (
          <div
            role="listbox"
            className={`absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border p-1.5 shadow-2xl backdrop-blur-xl ${
              isGirlsTheme
                ? 'border-[#E2B4BD]/55 bg-[#FFF5F5]/96 text-[#4A4A4A] shadow-[0_18px_34px_rgba(226,180,189,0.22)]'
                : 'border-white/10 bg-[#101824]/96 text-text-primary shadow-[0_18px_34px_rgba(0,0,0,0.36)]'
            }`}
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpenFactorsMenu(null);
                  }}
                  className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                    active
                      ? isGirlsTheme
                        ? 'bg-[#F9B2D7]/20 text-[#4A4A4A]'
                        : 'bg-accent/15 text-text-primary'
                      : isGirlsTheme
                        ? 'text-[#795E67] hover:bg-white/75 hover:text-[#4A4A4A]'
                        : 'text-text-secondary hover:bg-white/8 hover:text-text-primary'
                  }`}
                >
                  <span>{option.label}</span>
                  {active ? <span className={`h-2 w-2 rounded-full ${isGirlsTheme ? 'bg-[#F9B2D7]' : 'bg-accent'}`} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderFactorChipRow = (
    title: string,
    value: number,
    options: Array<{ label: string; value: number }>,
    onChange: (next: number) => void,
  ) => (
    <div>
      <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary'}`}>{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={`${title}-${option.value}`}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                active
                  ? isGirlsTheme
                    ? 'border-[#F9B2D7]/70 bg-[#F9B2D7]/22 text-[#4A4A4A] shadow-[0_8px_18px_rgba(249,178,215,0.16)]'
                    : 'border-accent/35 bg-accent/15 text-accent'
                  : isGirlsTheme
                    ? 'border-[#E2B4BD]/45 bg-white/65 text-[#795E67] hover:border-[#F9B2D7]/70 hover:bg-white/85 hover:text-[#4A4A4A]'
                    : 'border-white/10 bg-white/5 text-text-secondary hover:border-accent/25'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const getLastTrained = (date: string | null) => {
    if (!date) return copy.notTrained;
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    const days = Math.floor(hours / 24);
    if (days === 0) return copy.today;
    if (days === 1) return copy.yesterday;
    return copy.daysAgo(days);
  };

  const getStatusColor = (val: number) => {
    if (val >= 90) return 'text-green-500 bg-green-500/10';
    if (val >= 70) return 'text-emerald-600 bg-[#10b981]/10';
    if (val >= 50) return 'text-yellow-500 bg-yellow-500/10';
    return 'text-red-500 bg-red-500/10';
  };

  const formatRecoveryTime = (hoursRemaining: number | undefined) => {
    const safeHours = Math.max(0, Number(hoursRemaining || 0));
    if (safeHours <= 0.01) return copy.fullyRecovered;

    const roundedHours = Math.ceil(safeHours);
    const days = Math.floor(roundedHours / 24);
    const hours = roundedHours % 24;

    if (days > 0 && hours > 0) {
      return `${copy.fullRecoveryIn} ${days}d ${hours}${copy.hourAbbr}`;
    }
    if (days > 0) {
      return `${copy.fullRecoveryIn} ${days}d`;
    }
    return `${copy.fullRecoveryIn} ${hours}${copy.hourAbbr}`;
  };

  const getRecoveryBatteryStyle = (score: number): React.CSSProperties => {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    const color = safeScore >= 90
      ? '#a3e635'
      : safeScore >= 70
        ? '#10b981'
        : safeScore >= 50
          ? '#eab308'
          : '#ef4444';

    return {
      '--recovery-battery-level': `${Math.max(2, safeScore * 0.5)}px`,
      '--recovery-battery-color': color,
    } as React.CSSProperties;
  };

  const toLocalizedMuscle = (value: string) => {
    const key = String(value || '').trim().toLowerCase();
    return localizedMuscleLabels[key] || value;
  };

  const isSelectedRecoveryMuscle = (muscle: MuscleRecoveryItem) => {
    if (!selectedRecoveryMuscleKey) return false;
    return normalizeRecoveryMuscleKey(muscle.muscle) === selectedRecoveryMuscleKey
      || normalizeRecoveryMuscleKey(muscle.name) === selectedRecoveryMuscleKey;
  };

  const sortRecoveryCards = (muscles: MuscleRecoveryItem[]) => [...muscles].sort((a, b) => {
    const aSelected = isSelectedRecoveryMuscle(a);
    const bSelected = isSelectedRecoveryMuscle(b);
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    return a.score - b.score;
  });

  const handleBodyMapMuscleSelect = (muscle: BodyMapMuscle) => {
    setSelectedBodyMapMuscle(muscle);

    const selectedRecoveryMuscle = recoveryPageMuscles.find((item) => {
      const slugs = new Set([
        ...recoveryMuscleToBodyMapSlugs(item.muscle),
        ...recoveryMuscleToBodyMapSlugs(item.name),
      ]);
      return slugs.has(muscle);
    });

    setSelectedRecoveryMuscleKey(
      selectedRecoveryMuscle
        ? normalizeRecoveryMuscleKey(selectedRecoveryMuscle.muscle || selectedRecoveryMuscle.name)
        : null,
    );
  };

  const renderRecoverySection = (
    title: string,
    muscles: MuscleRecoveryItem[],
    showLastTrained = true,
  ) => {
    if (muscles.length === 0) return null;

    return (
      <div>
        <h3 className={`mb-3 text-xs font-bold uppercase tracking-wider ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
          {title}
        </h3>
        <div className="space-y-2">
          {muscles.map((m) => (
            <div
              key={m.muscle}
              className={`flex items-center justify-between rounded-xl border p-4 ${
                isGirlsTheme
                  ? 'border-[#E2B4BD]/45 bg-white/[0.70] shadow-[0_12px_28px_rgba(226,180,189,0.12)]'
                  : 'border-white/5 bg-card'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="recovery-battery shrink-0"
                  style={getRecoveryBatteryStyle(m.score)}
                  title={formatRecoveryTime(m.hoursRemaining)}
                  aria-label={formatRecoveryTime(m.hoursRemaining)}
                >
                  {m.score < 70 && (
                    <Zap className="recovery-battery-flash" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className={`truncate font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{toLocalizedMuscle(m.name)}</h4>
                  {showLastTrained && (
                    <p className={`mt-0.5 text-xs ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary'}`}>
                      {copy.lastTrained} {getLastTrained(m.lastWorkout)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`shrink-0 rounded-full px-3 py-1.5 font-electrolize text-xs font-bold ${getStatusColor(m.score)}`}>
                  {m.score}%
                </span>
                <MuscleSvgBadge
                  muscle={{ label: toLocalizedMuscle(m.name), sourceName: m.muscle || m.name }}
                  align="right"
                  className="w-[58px]"
                  figureClassName="h-[46px]"
                  showLabel={false}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const recoveryPageMuscles = muscleRecoveries.length ? muscleRecoveries : mergeRecoveryWithDefaults([]);
  const readyMuscles = sortRecoveryCards(recoveryPageMuscles.filter((m) => m.score >= 90));
  const almostReadyMuscles = sortRecoveryCards(recoveryPageMuscles.filter((m) => m.score >= 70 && m.score < 90));
  const damagedMuscles = sortRecoveryCards(recoveryPageMuscles.filter((m) => m.score < 70));
  const recoverySections = [
    { title: copy.damaged, muscles: damagedMuscles, showLastTrained: true },
    { title: copy.almost, muscles: almostReadyMuscles, showLastTrained: true },
    { title: copy.ready, muscles: readyMuscles, showLastTrained: false },
  ].sort((a, b) => {
    const aHasSelected = a.muscles.some(isSelectedRecoveryMuscle);
    const bHasSelected = b.muscles.some(isSelectedRecoveryMuscle);
    if (aHasSelected !== bHasSelected) return aHasSelected ? -1 : 1;
    return 0;
  });
  const emptyStateMessage = language === 'ar'
    ? 'أكمل يوم تدريب لعرض العضلات التي تم تدريبها ونسبة التعافي الخاصة بها.'
    : language === 'it'
      ? 'Completa una giornata di allenamento per vedere i muscoli allenati e la loro percentuale di recupero.'
      : language === 'de'
        ? 'Schliesse einen Trainingstag ab, um die trainierten Muskeln und ihre Erholungswerte zu sehen.'
        : language === 'fr'
        ? 'Termine une seance pour voir les muscles entraines et leur niveau de recuperation.'
        : 'Complete a workout day to see the muscles you trained and their recovery percentages.';
  const screenClassName = isGirlsTheme
    ? 'flex-1 flex flex-col h-full pb-24 bg-[radial-gradient(circle_at_top_left,rgba(249,178,215,0.22),transparent_34%),radial-gradient(circle_at_85%_8%,rgba(207,236,243,0.34),transparent_32%),linear-gradient(180deg,#FFF5F5_0%,#F7D6D0_52%,#FFF5F5_100%)] text-[#4A4A4A] [&_.surface-glass]:border-[#E2B4BD]/45 [&_.surface-glass]:bg-white/60 [&_.surface-glass]:text-[#4A4A4A] [&_h1]:text-[#4A4A4A]'
    : 'flex-1 flex flex-col h-full bg-background pb-24';
  const factorsButtonClassName = isGirlsTheme
    ? 'text-[#A87884] text-sm font-medium'
    : 'text-accent text-sm font-medium';
  const emptyStateClassName = isGirlsTheme
    ? 'rounded-xl border border-[#E2B4BD]/45 bg-white/[0.70] px-4 py-5 text-sm text-[#795E67] shadow-[0_12px_28px_rgba(226,180,189,0.12)]'
    : 'rounded-xl border border-white/10 bg-card/60 px-4 py-5 text-sm text-text-secondary';
  const factorsPanelClassName = isGirlsTheme
    ? `relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#E2B4BD]/55 bg-[#FFF5F5] text-[#4A4A4A] shadow-[0_24px_72px_rgba(226,180,189,0.22)] ${isArabic ? 'text-right' : 'text-left'}`
    : `relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-card ${isArabic ? 'text-right' : 'text-left'}`;
  const factorsDividerClassName = isGirlsTheme ? 'border-[#E2B4BD]/45' : 'border-white/10';
  const factorsTitleClassName = isGirlsTheme ? 'text-xl font-bold text-[#4A4A4A]' : 'text-xl font-bold text-white';
  const factorsCloseClassName = isGirlsTheme
    ? 'absolute right-4 top-4 z-10 text-[#A87884] transition-colors hover:text-[#4A4A4A]'
    : 'absolute right-4 top-4 z-10 text-text-secondary transition-colors hover:text-white';
  const factorsLabelClassName = isGirlsTheme ? 'mb-2 block text-sm text-[#795E67]' : 'mb-2 block text-sm text-text-secondary';
  const factorsInputClassName = isGirlsTheme
    ? 'w-full rounded-xl border border-[#E2B4BD]/45 bg-white/70 px-4 py-3 text-[#4A4A4A] focus:outline-none focus:border-[#F9B2D7]/70'
    : 'w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-white focus:outline-none focus:border-accent/50';
  const secondaryActionClassName = isGirlsTheme
    ? 'flex-1 rounded-xl border border-[#E2B4BD]/45 bg-white/65 py-3 font-bold text-[#795E67] transition-colors hover:bg-white/80'
    : 'flex-1 rounded-xl bg-white/5 py-3 font-bold text-white transition-colors hover:bg-white/10';

  return (
    <div className={screenClassName}>
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={copy.title}
          onBack={onBack}
          rightElement={(
            <button onClick={() => setShowFactors(!showFactors)} className={factorsButtonClassName}>
              <SlidersHorizontal size={20} />
            </button>
          )}
        />
      </div>

      {showFactors && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[160] bg-black/80 p-4 sm:p-6"
          onClick={() => setShowFactors(false)}
        >
          <div className="flex min-h-full items-center justify-center">
            <div
              className={factorsPanelClassName}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => setShowFactors(false)}
                className={factorsCloseClassName}
              >
                <X size={24} />
              </button>

              <div className={`border-b px-5 py-5 pr-14 ${factorsDividerClassName}`}>
                <h3 className={factorsTitleClassName}>{copy.factorsTitle}</h3>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-5">
                  <div>
                    <label className={factorsLabelClassName}>{copy.sleepHours}</label>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      step="0.5"
                      value={factors.sleepHours}
                      onChange={(event) => setFactors({ ...factors, sleepHours: event.target.value })}
                      className={factorsInputClassName}
                    />
                  </div>

                  <div>
                    <label className={factorsLabelClassName}>{copy.protein}</label>
                    {renderFactorsDropdown('protein', factors.proteinIntake, proteinOptions, (next) => setFactors({ ...factors, proteinIntake: next }))}
                  </div>

                  <div>
                    <label className={factorsLabelClassName}>{copy.supplements}</label>
                    {renderFactorsDropdown('supplements', factors.supplements, supplementOptions, (next) => setFactors({ ...factors, supplements: next }))}
                  </div>

                  {renderFactorChipRow(copy.jointPain, factors.jointPain, painSignalOptions, (next) => setFactors({ ...factors, jointPain: next }))}
                </div>
              </div>

              <div className={`border-t px-5 py-4 ${factorsDividerClassName}`}>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFactors(false)}
                    className={secondaryActionClassName}
                  >
                    {copy.cancel}
                  </button>
                  <button
                    onClick={handleUpdateFactors}
                    disabled={isUpdatingFactors}
                    className="flex-1 rounded-xl bg-accent py-3 font-bold text-black transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdatingFactors ? copy.updating : copy.update}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <div className="px-4 sm:px-6 space-y-6 mt-4">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {!error && recoveryPageMuscles.length === 0 && (
          <div className={emptyStateClassName}>
            {emptyStateMessage}
          </div>
        )}

        {!error && recoveryPageMuscles.length > 0 && (
          <RecoveryBodyMap
            muscles={recoveryPageMuscles}
            labels={{
              damaged: copy.damaged,
              almost: copy.almost,
              ready: copy.ready,
            }}
            selected={selectedBodyMapMuscle}
            onMuscleSelect={handleBodyMapMuscleSelect}
            themeVariant={isGirlsTheme ? 'girls' : 'default'}
          />
        )}

        {!error && isGirlsTheme && recoveryPageMuscles.length > 0 && (
          <GirlsPeriodCarousel language={language} jointPainLevel={Number(factors.jointPain || 0)} />
        )}

        {recoverySections.map((section) => (
          <React.Fragment key={section.title}>
            {renderRecoverySection(section.title, section.muscles, section.showLastTrained)}
          </React.Fragment>
        ))}
      </div>
    </div>);

}


