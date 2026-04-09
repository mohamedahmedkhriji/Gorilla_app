import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '../ui/Header';
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { api } from '../../services/api';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { AppLanguage, getActiveLanguage, getStoredLanguage, normalizeLocalizedValue } from '../../services/language';

interface MuscleRecoveryScreenProps {
  onBack: () => void;
}

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
  { muscle: 'calves', name: 'Calves', score: 100, lastWorkout: null },
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
  calves: 'السمانة',
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
  calves: 'Polpacci',
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
  calves: 'Waden',
  abs: 'Bauch',
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

const mergeRecoveryWithDefaults = (incoming: MuscleRecoveryItem[] = []): MuscleRecoveryItem[] => {
  const safeNumber = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const byName = new Map(
    incoming.map((m) => [String(m.name || m.muscle).toLowerCase(), m]),
  );

  return DEFAULT_MUSCLES.map((muscle) => {
    const found = byName.get(muscle.name.toLowerCase()) || byName.get(muscle.muscle.toLowerCase());
    if (!found) return muscle;
    return {
      ...muscle,
      ...found,
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

export function MuscleRecoveryScreen({ onBack }: MuscleRecoveryScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage(getStoredLanguage()));
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
  const [muscleRecoveries, setMuscleRecoveries] = useState<MuscleRecoveryItem[]>([]);
  const [showFactors, setShowFactors] = useState(false);
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
          : {},
  ), [language]);

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
        setMuscleRecoveries([]);
        return;
      }

      const data = await api.getRecoveryStatus(user.id);
      setMuscleRecoveries(mergeRecoveryWithDefaults(Array.isArray(data?.recovery) ? data.recovery : []));
      if (data.factors) setFactors((prev) => ({ ...prev, ...data.factors }));
      setError('');
    } catch (loadError) {
      console.error('Failed to load recovery status:', loadError);
      setMuscleRecoveries([]);
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

  const renderFactorChipRow = (
    title: string,
    value: number,
    options: Array<{ label: string; value: number }>,
    onChange: (next: number) => void,
  ) => (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{title}</div>
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
                  ? 'border-accent/35 bg-accent/15 text-accent'
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

  const getMuscleImage = (muscleGroup: string) => getBodyPartImage(muscleGroup);
  const toLocalizedMuscle = (value: string) => {
    const key = String(value || '').trim().toLowerCase();
    return localizedMuscleLabels[key] || value;
  };

  const visibleMuscles = muscleRecoveries.filter((m) => (
    !!m.lastWorkout
    || Number(m.hoursNeeded || 0) > 0
    || Number(m.hoursElapsed || 0) > 0
    || Number(m.plannedTodaySetUnits || 0) > 0
    || Number(m.completedTodaySetUnits || 0) > 0
    || Number(m.plannedWeekSetUnits || 0) > 0
    || Number(m.completedWeekSetUnits || 0) > 0
  ));
  const readyMuscles = visibleMuscles.filter((m) => m.score >= 90).sort((a, b) => a.score - b.score);
  const almostReadyMuscles = visibleMuscles
    .filter((m) => m.score >= 70 && m.score < 90)
    .sort((a, b) => a.score - b.score);
  const damagedMuscles = visibleMuscles.filter((m) => m.score < 70).sort((a, b) => a.score - b.score);
  const emptyStateMessage = language === 'ar'
    ? 'أكمل يوم تدريب لعرض العضلات التي تم تدريبها ونسبة التعافي الخاصة بها.'
    : language === 'it'
      ? 'Completa una giornata di allenamento per vedere i muscoli allenati e la loro percentuale di recupero.'
      : language === 'de'
        ? 'Schliesse einen Trainingstag ab, um die trainierten Muskeln und ihre Erholungswerte zu sehen.'
        : 'Complete a workout day to see the muscles you trained and their recovery percentages.';
  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={copy.title}
          onBack={onBack}
          rightElement={(
            <button onClick={() => setShowFactors(!showFactors)} className="text-accent text-sm font-medium">
              <SlidersHorizontal size={20} />
            </button>
          )}
        />
      </div>

      {showFactors && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <div className={`relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-card ${isArabic ? 'text-right' : 'text-left'}`}>
              <button
                onClick={() => setShowFactors(false)}
                className="absolute right-4 top-4 z-10 text-text-secondary transition-colors hover:text-white"
              >
                <X size={24} />
              </button>

              <div className="border-b border-white/10 px-5 py-5 pr-14">
                <h3 className="text-xl font-bold text-white">{copy.factorsTitle}</h3>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm text-text-secondary">{copy.sleepHours}</label>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      step="0.5"
                      value={factors.sleepHours}
                      onChange={(event) => setFactors({ ...factors, sleepHours: event.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-white focus:outline-none focus:border-accent/50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-text-secondary">{copy.protein}</label>
                    <div className="relative">
                      <select
                        value={factors.proteinIntake}
                        onChange={(event) => setFactors({ ...factors, proteinIntake: event.target.value })}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-background px-4 py-3 pr-10 text-white focus:outline-none focus:border-accent/50"
                      >
                        <option value="low">{copy.low}</option>
                        <option value="medium">{copy.medium}</option>
                        <option value="high">{copy.high}</option>
                      </select>
                      <ChevronDown size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-text-secondary">{copy.supplements}</label>
                    <div className="relative">
                      <select
                        value={factors.supplements}
                        onChange={(event) => setFactors({ ...factors, supplements: event.target.value })}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-background px-4 py-3 pr-10 text-white focus:outline-none focus:border-accent/50"
                      >
                        <option value="none">{copy.none}</option>
                        <option value="creatine">{copy.creatine}</option>
                        <option value="full">{copy.full}</option>
                      </select>
                      <ChevronDown size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    </div>
                  </div>

                  {renderFactorChipRow(copy.soreness, factors.soreness, standardSignalOptions, (next) => setFactors({ ...factors, soreness: next }))}
                  {renderFactorChipRow(copy.energy, factors.energy, standardSignalOptions, (next) => setFactors({ ...factors, energy: next }))}
                  {renderFactorChipRow(copy.fatigue, factors.fatigue, standardSignalOptions, (next) => setFactors({ ...factors, fatigue: next }))}
                  {renderFactorChipRow(copy.mood, factors.mood, standardSignalOptions, (next) => setFactors({ ...factors, mood: next }))}
                  {renderFactorChipRow(copy.jointPain, factors.jointPain, painSignalOptions, (next) => setFactors({ ...factors, jointPain: next }))}
                </div>
              </div>

              <div className="border-t border-white/10 px-5 py-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFactors(false)}
                    className="flex-1 rounded-xl bg-white/5 py-3 font-bold text-white transition-colors hover:bg-white/10"
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
        </div>
      )}

      <div className="px-4 sm:px-6 space-y-6 mt-4">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {!error && visibleMuscles.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-card/60 px-4 py-5 text-sm text-text-secondary">
            {emptyStateMessage}
          </div>
        )}

        {/* Damaged Muscles Section */}
        {damagedMuscles.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              {copy.damaged}
            </h3>
            <div className="space-y-2">
              {damagedMuscles.map((m) => (
                <div
                  key={m.muscle}
                  className="bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-transparent flex items-center justify-center overflow-hidden">
                      <img
                        src={getMuscleImage(m.name)}
                        alt={m.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{toLocalizedMuscle(m.name)}</h4>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {copy.lastTrained} {getLastTrained(m.lastWorkout)}
                      </p>
                      <p className="text-[11px] text-text-tertiary font-electrolize">
                        {formatRecoveryTime(m.hoursRemaining)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full font-electrolize ${getStatusColor(m.score)}`}>
                    {m.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {almostReadyMuscles.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              {copy.almost}
            </h3>
            <div className="space-y-2">
              {almostReadyMuscles.map((m) => (
                <div
                  key={m.muscle}
                  className="bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-transparent flex items-center justify-center overflow-hidden">
                      <img
                        src={getMuscleImage(m.name)}
                        alt={m.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{toLocalizedMuscle(m.name)}</h4>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {copy.lastTrained} {getLastTrained(m.lastWorkout)}
                      </p>
                      <p className="text-[11px] text-text-tertiary font-electrolize">
                        {formatRecoveryTime(m.hoursRemaining)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full font-electrolize ${getStatusColor(m.score)}`}>
                    {m.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ready Muscles Section */}
        {readyMuscles.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              {copy.ready}
            </h3>
            <div className="space-y-2">
              {readyMuscles.map((m) => (
                <div
                  key={m.muscle}
                  className="bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-transparent flex items-center justify-center overflow-hidden">
                      <img
                        src={getMuscleImage(m.name)}
                        alt={m.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{toLocalizedMuscle(m.name)}</h4>
                      <p className="text-[11px] text-text-tertiary font-electrolize">
                        {formatRecoveryTime(m.hoursRemaining)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full text-green-500 bg-green-500/10 font-electrolize">
                    {m.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>);

}


