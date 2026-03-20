import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';
import { formatWorkoutDayLabel } from '../../services/workoutDayLabel';
import { AppLanguage, getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';
import { translateExerciseName, translateProgramText, translateWorkoutType } from '../../services/programI18n';

interface CurrentWeekPlanScreenProps {
  onBack: () => void;
  onOpenWorkout: () => void;
  onCreateCustom: () => void;
}

interface WeekWorkout {
  id: number;
  workout_name: string;
  workout_type: string | null;
  day_order: number;
  day_name: string;
  notes?: string | null;
  exercises: Array<{
    exerciseName?: string;
    name?: string;
    sets?: number;
    reps?: string | number;
    rest?: number;
    notes?: string | null;
  }>;
}

interface RawWeekWorkout {
  id?: number;
  workout_name?: string;
  workout_type?: string | null;
  day_order?: number;
  day_name?: string;
  notes?: string | null;
  exercises?: unknown;
}

const parseExercises = (raw: unknown): WeekWorkout['exercises'] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function CurrentWeekPlanScreen({ onBack, onOpenWorkout, onCreateCustom }: CurrentWeekPlanScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programName, setProgramName] = useState('Current Program');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(0);
  const [workouts, setWorkouts] = useState<WeekWorkout[]>([]);
  const copy = pickLanguage(language, {
    en: {
      title: 'Current Week Plan',
      defaultProgram: 'Current Program',
      program: 'Program',
      loading: 'Loading current week workouts...',
      noSession: 'No active user session found.',
      loadFailed: 'Failed to load current week plan.',
      empty: 'No workouts found for this week.',
      exerciseFallback: 'Exercise',
      sets: (value: number) => `${value} sets`,
      rest: (value: number) => `${value}s rest`,
      moreExercises: (value: number) => `+${value} more exercises`,
      dayFallback: (value: number) => `Day ${value}`,
      weekLabel: (week: number, total: number) => `Week ${week}${total > 0 ? ` / ${total}` : ''}`,
      customizePlan: 'Customize Plan',
      openWorkout: 'Open Workout',
    },
    ar: {
      title: 'Ø®Ø·Ø© Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ Ø§Ù„Ø­Ø§Ù„ÙŠ',
      defaultProgram: 'Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬ Ø§Ù„Ø­Ø§Ù„ÙŠ',
      program: 'Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬',
      loading: 'Ø¬Ø§Ø±Ù ØªØ­Ù…ÙŠÙ„ ØªÙ…Ø§Ø±ÙŠÙ† Ù‡Ø°Ø§ Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹...',
      noSession: 'Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø¬Ù„Ø³Ø© Ù…Ø³ØªØ®Ø¯Ù… Ù†Ø´Ø·Ø©.',
      loadFailed: 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø®Ø·Ø© Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ Ø§Ù„Ø­Ø§Ù„ÙŠ.',
      empty: 'Ù„Ø§ ØªÙˆØ¬Ø¯ ØªÙ…Ø§Ø±ÙŠÙ† Ù„Ù‡Ø°Ø§ Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹.',
      exerciseFallback: 'ØªÙ…Ø±ÙŠÙ†',
      sets: (value: number) => `${value} Ù…Ø¬Ù…ÙˆØ¹Ø§Øª`,
      rest: (value: number) => `${value}Ø« Ø±Ø§Ø­Ø©`,
      moreExercises: (value: number) => `+${value} ØªÙ…Ø§Ø±ÙŠÙ† Ø¥Ø¶Ø§ÙÙŠØ©`,
      dayFallback: (value: number) => `Ø§Ù„ÙŠÙˆÙ… ${value}`,
      weekLabel: (week: number, total: number) => `Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ ${week}${total > 0 ? ` / ${total}` : ''}`,
      customizePlan: 'ØªØ®ØµÙŠØµ Ø§Ù„Ø®Ø·Ø©',
      openWorkout: 'Ø§ÙØªØ­ Ø§Ù„ØªÙ…Ø±ÙŠÙ†',
    },
    it: {
      title: 'Piano della settimana attuale',
      defaultProgram: 'Programma attuale',
      program: 'Programma',
      loading: 'Caricamento allenamenti della settimana in corso...',
      noSession: 'Nessuna sessione utente attiva trovata.',
      loadFailed: 'Impossibile caricare il piano della settimana attuale.',
      empty: 'Nessun allenamento trovato per questa settimana.',
      exerciseFallback: 'Esercizio',
      sets: (value: number) => `${value} serie`,
      rest: (value: number) => `${value}s recupero`,
      moreExercises: (value: number) => `+${value} altri esercizi`,
      dayFallback: (value: number) => `Giorno ${value}`,
      weekLabel: (week: number, total: number) => `Settimana ${week}${total > 0 ? ` / ${total}` : ''}`,
      customizePlan: 'Personalizza piano',
      openWorkout: 'Apri allenamento',
    },
    de: {
      title: 'Aktueller Wochenplan',
      defaultProgram: 'Aktuelles Programm',
      program: 'Programm',
      loading: 'Workouts der aktuellen Woche werden geladen...',
      noSession: 'Keine aktive Benutzersitzung gefunden.',
      loadFailed: 'Der aktuelle Wochenplan konnte nicht geladen werden.',
      empty: 'Keine Workouts fur diese Woche gefunden.',
      exerciseFallback: 'Ubung',
      sets: (value: number) => `${value} Satze`,
      rest: (value: number) => `${value}s Pause`,
      moreExercises: (value: number) => `+${value} weitere Ubungen`,
      dayFallback: (value: number) => `Tag ${value}`,
      weekLabel: (week: number, total: number) => `Woche ${week}${total > 0 ? ` / ${total}` : ''}`,
      customizePlan: 'Plan anpassen',
      openWorkout: 'Workout offnen',
    },
  });

  useEffect(() => {
    setLanguage(getActiveLanguage());

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

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
        const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
        if (!userId) {
          setError(copy.noSession);
          setWorkouts([]);
          return;
        }

        const data = await api.getUserProgram(userId);
        const weekWorkoutsRaw: RawWeekWorkout[] = Array.isArray(data?.currentWeekWorkouts)
          ? data.currentWeekWorkouts
          : [];
        const normalized = weekWorkoutsRaw
          .map((w) => ({
            id: Number(w.id || 0),
            workout_name: String(w.workout_name || 'Workout'),
            workout_type: w.workout_type || null,
            day_order: Number(w.day_order || 0),
            day_name: String(w.day_name || ''),
            notes: w.notes || null,
            exercises: parseExercises(w.exercises),
          }))
          .sort((a: WeekWorkout, b: WeekWorkout) => a.day_order - b.day_order);

        setProgramName(String(data?.name || 'Current Program'));
        setCurrentWeek(Number(data?.currentWeek || 1));
        setTotalWeeks(Number(data?.totalWeeks || 0));
        setWorkouts(normalized);
      } catch (e) {
        console.error('Failed to load current week plan:', e);
        setError(copy.loadFailed);
      } finally {
        setLoading(false);
      }
    };

    void fetchPlan();
  }, [copy.loadFailed, copy.noSession]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 pt-2 space-y-4">
        <div className="bg-card rounded-xl border border-white/10 p-4">
          <div className="text-sm text-text-secondary">{copy.program}</div>
          <div className="text-white font-semibold mt-1">
            {translateProgramText(programName || copy.defaultProgram, language)}
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            {copy.weekLabel(currentWeek, totalWeeks)}
          </div>
        </div>

        {loading && (
          <div className="text-text-secondary text-sm">{copy.loading}</div>
        )}

        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && workouts.length === 0 && (
          <div className="bg-card rounded-xl border border-white/10 p-4 text-sm text-text-secondary">
            {copy.empty}
          </div>
        )}

        {!loading && !error && workouts.length > 0 && (
          <div className="space-y-3">
            {workouts.map((workout) => (
              <div key={`${workout.id}-${workout.day_order}`} className="bg-card rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase text-text-secondary">
                      {formatWorkoutDayLabel(
                        workout.day_name,
                        copy.dayFallback(workout.day_order),
                        language,
                      ) || copy.dayFallback(workout.day_order)}
                    </div>
                    <div className="text-white font-semibold">
                      {translateProgramText(workout.workout_name, language)}
                    </div>
                  </div>
                  {workout.workout_type && (
                    <span className="text-[10px] uppercase text-accent bg-accent/10 border border-accent/20 px-2 py-1 rounded">
                      {translateWorkoutType(workout.workout_type, language)}
                    </span>
                  )}
                </div>

                {workout.exercises.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {workout.exercises.slice(0, 6).map((ex, idx) => (
                      <div key={`${workout.id}-ex-${idx}`} className="text-xs text-text-secondary">
                        <span className="text-white">
                          {translateExerciseName(ex.exerciseName || ex.name || copy.exerciseFallback, language)}
                        </span>
                        {' | '}
                        <span>{copy.sets(Number(ex.sets || 0))}</span>
                        {' | '}
                        <span>{String(ex.reps || '-')}</span>
                        {' | '}
                        <span>{copy.rest(Number(ex.rest || 0))}</span>
                      </div>
                    ))}
                    {workout.exercises.length > 6 && (
                      <div className="text-xs text-text-tertiary">
                        {copy.moreExercises(workout.exercises.length - 6)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCreateCustom}
            className="w-full bg-white/5 text-white border border-white/10 font-semibold rounded-xl p-3 hover:bg-white/10 transition-colors"
          >
            {copy.customizePlan}
          </button>
          <button
            type="button"
            onClick={onOpenWorkout}
            className="w-full bg-accent text-black font-semibold rounded-xl p-3 hover:bg-accent/90 transition-colors"
          >
            {copy.openWorkout}
          </button>
        </div>
      </div>
    </div>
  );
}
