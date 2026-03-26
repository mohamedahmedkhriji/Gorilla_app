import React, { useEffect, useMemo, useState } from 'react';
import { Moon, Scale, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { buildT2AdaptiveDecision, deriveT2EnergyLevel, getPreviousT2WorkoutCheckIn, getT2WorkoutCheckInForSummary, saveT2WorkoutCheckIn, type T2WorkoutCheckIn } from '../../services/t2CheckIn';
import { Card } from '../ui/Card';
import type { WorkoutDaySummaryData } from './PostWorkoutSummary';

interface T2PostWorkoutCheckInCardProps {
  summary: WorkoutDaySummaryData;
  userId?: number;
  onSaved?: (checkIn: T2WorkoutCheckIn) => void;
}

type ChipOption = {
  label: string;
  value: number;
};

const COPY = {
  en: {
    badge: 'T-2 Premium',
    title: 'Post-workout check-in',
    body: 'Log how this session felt so RepSet can steer the next cardio and recovery call.',
    pump: 'Pump quality',
    soreness: 'Muscle soreness',
    fatigue: 'Fatigue',
    mood: 'Mood',
    jointPain: 'Joint pain',
    sleep: 'Sleep hours',
    bodyweight: 'Bodyweight (kg)',
    low: 'Low',
    solid: 'Solid',
    high: 'High',
    none: 'None',
    mild: 'Mild',
    sharp: 'High',
    save: 'Save Premium Check-In',
    update: 'Update Premium Check-In',
    saving: 'Saving...',
    saved: 'Premium check-in saved. RepSet updated the next adjustment.',
    saveError: 'Could not save the premium check-in.',
    cardioShift: 'Cardio',
    loadAction: 'Load',
  },
  ar: {
    badge: 'T-2 Premium',
    title: 'تسجيل ما بعد التمرين',
    body: 'سجّل شعورك بعد هذه الحصة حتى يحدد RepSet قرار الكارديو والاستشفاء للحصة القادمة.',
    pump: 'جودة الضخ',
    soreness: 'الألم العضلي',
    fatigue: 'الإجهاد',
    mood: 'المزاج',
    jointPain: 'ألم المفاصل',
    sleep: 'ساعات النوم',
    bodyweight: 'الوزن (كجم)',
    low: 'منخفض',
    solid: 'جيد',
    high: 'عالٍ',
    none: 'لا يوجد',
    mild: 'خفيف',
    sharp: 'مرتفع',
    save: 'احفظ تسجيل Premium',
    update: 'حدّث تسجيل Premium',
    saving: 'جارٍ الحفظ...',
    saved: 'تم حفظ تسجيل Premium، وتم تحديث القرار التالي من RepSet.',
    saveError: 'تعذر حفظ تسجيل Premium.',
    cardioShift: 'الكارديو',
    loadAction: 'الحمل',
  },
  it: {
    badge: 'T-2 Premium',
    title: 'Check-in post-workout',
    body: 'Registra come hai sentito questa sessione cosi RepSet puo guidare il prossimo cardio e recupero.',
    pump: 'Qualita pump',
    soreness: 'Indolenzimento muscolare',
    fatigue: 'Fatica',
    mood: 'Umore',
    jointPain: 'Dolore articolare',
    sleep: 'Ore di sonno',
    bodyweight: 'Peso (kg)',
    low: 'Basso',
    solid: 'Buono',
    high: 'Alto',
    none: 'Nessuno',
    mild: 'Lieve',
    sharp: 'Alto',
    save: 'Salva Check-In Premium',
    update: 'Aggiorna Check-In Premium',
    saving: 'Salvataggio...',
    saved: 'Check-in premium salvato. RepSet ha aggiornato il prossimo aggiustamento.',
    saveError: 'Impossibile salvare il check-in premium.',
    cardioShift: 'Cardio',
    loadAction: 'Carico',
  },
  de: {
    badge: 'T-2 Premium',
    title: 'Post-Workout-Check-in',
    body: 'Erfasse, wie sich diese Einheit angefuehlt hat, damit RepSet Cardio und Erholung fuer die naechste Einheit steuern kann.',
    pump: 'Pump-Qualitaet',
    soreness: 'Muskelkater',
    fatigue: 'Ermuedung',
    mood: 'Stimmung',
    jointPain: 'Gelenkschmerz',
    sleep: 'Schlafstunden',
    bodyweight: 'Koerpergewicht (kg)',
    low: 'Niedrig',
    solid: 'Solide',
    high: 'Hoch',
    none: 'Kein',
    mild: 'Leicht',
    sharp: 'Hoch',
    save: 'Premium Check-in Speichern',
    update: 'Premium Check-in Aktualisieren',
    saving: 'Speichert...',
    saved: 'Premium-Check-in gespeichert. RepSet hat die naechste Anpassung aktualisiert.',
    saveError: 'Der Premium-Check-in konnte nicht gespeichert werden.',
    cardioShift: 'Cardio',
    loadAction: 'Last',
  },
} as const;

const useLanguage = () => {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());

  useEffect(() => {
    const handleLanguageChanged = () => setLanguage(getStoredLanguage());
    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  return language;
};

export function T2PostWorkoutCheckInCard({ summary, userId, onSaved }: T2PostWorkoutCheckInCardProps) {
  const language = useLanguage();
  const copy = COPY[language] || COPY.en;
  const isArabic = language === 'ar';
  const summaryDate = String(summary.summaryDate || new Date().toISOString().slice(0, 10)).trim();

  const [pumpScore, setPumpScore] = useState(7);
  const [sorenessScore, setSorenessScore] = useState(4);
  const [fatigueScore, setFatigueScore] = useState(6);
  const [moodScore, setMoodScore] = useState(7);
  const [jointPainScore, setJointPainScore] = useState(0);
  const [sleepHours, setSleepHours] = useState('7');
  const [bodyweightKg, setBodyweightKg] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savedCheckIn, setSavedCheckIn] = useState<T2WorkoutCheckIn | null>(null);

  useEffect(() => {
    const existing = getT2WorkoutCheckInForSummary(summaryDate, summary.workoutName, userId);
    setSavedCheckIn(existing);
    if (!existing) {
      setPumpScore(7);
      setSorenessScore(4);
      setFatigueScore(6);
      setMoodScore(7);
      setJointPainScore(0);
      setSleepHours('7');
      setBodyweightKg('');
      setFeedback(null);
      return;
    }

    setPumpScore(existing.pumpScore);
    setSorenessScore(existing.sorenessScore);
    setFatigueScore(existing.fatigueScore);
    setMoodScore(existing.moodScore);
    setJointPainScore(existing.jointPainScore);
    setSleepHours(String(existing.sleepHours || ''));
    setBodyweightKg(existing.bodyweightKg != null ? String(existing.bodyweightKg) : '');
    setFeedback(null);
  }, [summaryDate, summary.workoutName, userId]);

  const pumpOptions: ChipOption[] = useMemo(() => ([
    { label: copy.low, value: 5 },
    { label: copy.solid, value: 7 },
    { label: copy.high, value: 9 },
  ]), [copy.high, copy.low, copy.solid]);
  const sorenessOptions: ChipOption[] = useMemo(() => ([
    { label: copy.low, value: 3 },
    { label: copy.solid, value: 6 },
    { label: copy.high, value: 8 },
  ]), [copy.high, copy.low, copy.solid]);
  const fatigueOptions: ChipOption[] = useMemo(() => ([
    { label: copy.low, value: 3 },
    { label: copy.solid, value: 6 },
    { label: copy.high, value: 9 },
  ]), [copy.high, copy.low, copy.solid]);
  const moodOptions: ChipOption[] = useMemo(() => ([
    { label: copy.low, value: 4 },
    { label: copy.solid, value: 7 },
    { label: copy.high, value: 9 },
  ]), [copy.high, copy.low, copy.solid]);
  const painOptions: ChipOption[] = useMemo(() => ([
    { label: copy.none, value: 0 },
    { label: copy.mild, value: 4 },
    { label: copy.sharp, value: 8 },
  ]), [copy.mild, copy.none, copy.sharp]);

  const previewCheckIn = useMemo<T2WorkoutCheckIn | null>(() => ({
    summaryDate,
    workoutName: summary.workoutName,
    pumpScore,
    sorenessScore,
    fatigueScore,
    sleepHours: Number(sleepHours || 0) || 0,
    moodScore,
    jointPainScore,
    bodyweightKg: bodyweightKg === '' ? null : Number(bodyweightKg),
    createdAt: savedCheckIn?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [bodyweightKg, fatigueScore, jointPainScore, moodScore, pumpScore, savedCheckIn?.createdAt, sleepHours, sorenessScore, summary.workoutName, summaryDate]);

  const previousCheckIn = useMemo(
    () => getPreviousT2WorkoutCheckIn(savedCheckIn || previewCheckIn, userId),
    [previewCheckIn, savedCheckIn, userId],
  );
  const adaptiveDecision = useMemo(
    () => buildT2AdaptiveDecision({
      language,
      current: savedCheckIn || previewCheckIn,
      previous: previousCheckIn,
    }),
    [language, previousCheckIn, previewCheckIn, savedCheckIn],
  );

  const renderChipRow = (
    title: string,
    value: number,
    options: ChipOption[],
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
                  : 'border-white/10 bg-white/5 text-text-secondary hover:border-accent/20'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const normalizedSleepHours = Number(sleepHours || 0) || 0;
      const normalizedBodyweightKg = bodyweightKg === '' ? null : Number(bodyweightKg);
      const nextItem = saveT2WorkoutCheckIn({
        summaryDate,
        workoutName: summary.workoutName,
        pumpScore,
        sorenessScore,
        fatigueScore,
        sleepHours: normalizedSleepHours,
        moodScore,
        jointPainScore,
        bodyweightKg: normalizedBodyweightKg,
      }, userId);

      setSavedCheckIn(nextItem);
      setFeedback(copy.saved);
      onSaved?.(nextItem);

      if (userId) {
        const derivedEnergyLevel = deriveT2EnergyLevel(nextItem);

        try {
          await api.updateRecoveryFactors(userId, {
            sleepHours: normalizedSleepHours,
            sorenessLevel: sorenessScore,
            energyLevel: derivedEnergyLevel,
            fatigueLevel: fatigueScore,
            moodLevel: moodScore,
            jointPainLevel: jointPainScore,
            pumpScore,
            bodyweightKg: normalizedBodyweightKg,
            source: 't2_post_workout',
            summaryDate,
            workoutName: summary.workoutName,
          });
          localStorage.setItem('recoveryNeedsUpdate', 'true');
          window.dispatchEvent(new CustomEvent('recovery-updated'));
        } catch (recoverySyncError) {
          console.error('Failed to sync T-2 recovery factors:', recoverySyncError);
        }

        try {
          await api.saveUserAnalysisInsights(userId, {
            source: 't2_post_workout',
            workoutName: summary.workoutName,
            summaryDate,
            pumpScore,
            sorenessScore,
            fatigueScore,
            sleepHours: normalizedSleepHours,
            moodScore,
            jointPainScore,
            bodyweightKg: normalizedBodyweightKg,
            energyLevel: derivedEnergyLevel,
          }, {
            source: 't2_post_workout',
            autoAdaptPlan: true,
            snapshotDate: summaryDate,
            modelVersion: 't2_premium_v1',
          });
        } catch (apiError) {
          console.error('Failed to sync T-2 premium check-in:', apiError);
        }
      }
    } catch (error) {
      console.error('Failed to save T-2 premium check-in:', error);
      setFeedback(copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={`relative overflow-hidden border border-white/12 bg-[linear-gradient(160deg,rgba(22,26,35,0.96),rgba(12,16,26,0.98))] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.22)] ${isArabic ? 'text-right' : 'text-left'}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,255,0,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_40%)]" />
      <div className="relative">
        <div className={`flex items-start justify-between gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              {copy.badge}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white">{copy.title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{copy.body}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-accent">
            <Sparkles size={18} />
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {renderChipRow(copy.pump, pumpScore, pumpOptions, setPumpScore)}
          {renderChipRow(copy.soreness, sorenessScore, sorenessOptions, setSorenessScore)}
          {renderChipRow(copy.fatigue, fatigueScore, fatigueOptions, setFatigueScore)}
          {renderChipRow(copy.mood, moodScore, moodOptions, setMoodScore)}
          {renderChipRow(copy.jointPain, jointPainScore, painOptions, setJointPainScore)}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-text-secondary">
              <div className={`mb-2 flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <Moon size={15} className="text-text-tertiary" />
                <span>{copy.sleep}</span>
              </div>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={sleepHours}
                onChange={(event) => setSleepHours(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 text-white outline-none transition-colors focus:border-accent/25"
              />
            </label>
            <label className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-text-secondary">
              <div className={`mb-2 flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <Scale size={15} className="text-text-tertiary" />
                <span>{copy.bodyweight}</span>
              </div>
              <input
                type="number"
                min={0}
                max={300}
                step={0.1}
                value={bodyweightKg}
                onChange={(event) => setBodyweightKg(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 text-white outline-none transition-colors focus:border-accent/25"
              />
            </label>
          </div>
        </div>

        {adaptiveDecision && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
            <div className={`flex items-start justify-between gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
              <div>
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {adaptiveDecision.badge}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">{adaptiveDecision.title}</div>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{adaptiveDecision.body}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{copy.cardioShift}</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {adaptiveDecision.cardioAdjustmentMinutes > 0
                    ? `+${adaptiveDecision.cardioAdjustmentMinutes} min`
                    : adaptiveDecision.cardioAdjustmentMinutes < 0
                      ? `${adaptiveDecision.cardioAdjustmentMinutes} min`
                      : '0 min'}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{copy.loadAction}</div>
                <div className="mt-2 text-sm font-semibold text-white">{adaptiveDecision.loadAction}</div>
              </div>
            </div>
          </div>
        )}

        {feedback && (
          <div className="mt-4 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent">
            {feedback}
          </div>
        )}

        <div className={`mt-5 flex ${isArabic ? 'justify-start' : 'justify-end'}`}>
          <button
            type="button"
            disabled={saving}
            onClick={() => { void handleSave(); }}
            className="inline-flex min-w-[12rem] items-center justify-center rounded-full border border-accent/30 bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-black transition-colors hover:bg-[#aee600] disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? copy.saving : (savedCheckIn ? copy.update : copy.save)}
          </button>
        </div>
      </div>
    </Card>
  );
}
