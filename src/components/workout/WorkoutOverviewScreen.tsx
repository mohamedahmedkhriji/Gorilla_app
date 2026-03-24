import React, { useEffect, useMemo, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { Header } from '../ui/Header';
import { AgendaSection } from '../home/AgendaSection';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import type { WorkoutAssignmentHistoryEntry } from '../../services/todayWorkoutSelection';
import { formatWorkoutDayLabel } from '../../services/workoutDayLabel';
import rightArrowIcon from '../../../assets/emoji/right-arrow.png';

type WorkoutOverviewCard = {
  key: string;
  dayLabel: string;
  workoutName: string;
  exerciseCount: number;
  exerciseNames: string[];
  targetMuscles: string[];
  isToday: boolean;
  isRecommendedNext?: boolean;
  isPickedForToday?: boolean;
  isCompletedToday?: boolean;
};

interface WorkoutOverviewScreenProps {
  onBack: () => void;
  onSelectWorkout: (workoutKey: string) => void;
  onPickWorkoutForToday: (workoutKey: string) => void;
  onOpenNewPlanFlow?: () => void;
  currentDayLabel: string;
  workouts: WorkoutOverviewCard[];
  selectedTodayWorkoutName?: string;
  selectedTodayWorkoutDayLabel?: string;
  hasTodaySelection?: boolean;
  isTodaySelectionCompleted?: boolean;
  isTodayPlanLocked?: boolean;
  isPlanCompleted?: boolean;
  recommendedWorkout?: {
    workoutName: string;
    dayLabel: string;
  } | null;
  userProgram?: any;
  assignmentHistory?: WorkoutAssignmentHistoryEntry[];
  accountCreatedAt?: string | Date | null;
  loading?: boolean;
  error?: string | null;
}

const AR_DAY_LABELS: Record<string, string> = {
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
  sunday: 'الأحد',
};

const AR_MUSCLE_LABELS: Record<string, string> = {
  chest: 'الصدر',
  back: 'الظهر',
  shoulders: 'الأكتاف',
  'front shoulders': 'الأكتاف الأمامية',
  'side shoulders': 'الأكتاف الجانبية',
  'rear shoulders': 'الأكتاف الخلفية',
  triceps: 'الترايسبس',
  biceps: 'البايسبس',
  abs: 'البطن',
  quadriceps: 'الرباعية',
  hamstrings: 'الخلفية',
  calves: 'السمانة',
  forearms: 'الساعد',
  glutes: 'الألوية',
  adductors: 'المقربات',
  general: 'عام',
};

const IT_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Petto',
  back: 'Schiena',
  shoulders: 'Spalle',
  'front shoulders': 'Spalle anteriori',
  'side shoulders': 'Spalle laterali',
  'rear shoulders': 'Spalle posteriori',
  triceps: 'Tricipiti',
  biceps: 'Bicipiti',
  abs: 'Addome',
  quadriceps: 'Quadricipiti',
  hamstrings: 'Femorali',
  calves: 'Polpacci',
  forearms: 'Avambracci',
  glutes: 'Glutei',
  adductors: 'Adduttori',
  general: 'Generale',
};

const DE_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Brust',
  back: 'Ruecken',
  shoulders: 'Schultern',
  'front shoulders': 'Vordere Schultern',
  'side shoulders': 'Seitliche Schultern',
  'rear shoulders': 'Hintere Schultern',
  triceps: 'Trizeps',
  biceps: 'Bizeps',
  abs: 'Bauch',
  quadriceps: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  calves: 'Waden',
  forearms: 'Unterarme',
  glutes: 'Gesaess',
  adductors: 'Adduktoren',
  general: 'Allgemein',
};

const COPY = {
  en: {
    title: 'My Plan',
    heroEyebrow: 'Current Day',
    heroBody: 'Pick one card below to save it as today plan.',
    heroSelectedEyebrow: 'Saved For Today',
    heroSelectedBody: 'This is the workout currently saved for today.',
    heroLockedBody: 'You already started today\'s workout, so today\'s plan is locked.',
    heroCompletedBody: 'Today workout is marked done. Use the next suggestion below when you are ready.',
    sectionTitle: 'Week Plan',
    recommendationTitle: 'Recommended Next',
    loading: 'Loading your week plan...',
    empty: 'No workout plan was found for this week yet.',
    error: 'Could not load your week plan.',
    recommendedNextBadge: 'Recommended Next Day',
    pickedBadge: 'Picked',
    completedBadge: 'Done',
    pickForToday: 'Pick for today',
    startMyWorkout: 'Start My Workout',
    planLocked: 'Plan Locked',
    pickedForToday: 'Picked for today',
    completedForToday: 'Completed today',
    planFinishedTitle: 'Plan completed',
    planFinishedBody: 'You finished all weeks in this plan. Create a new plan to keep training next weeks.',
    createNewPlan: 'Create New Plan',
    exercisesIncluded: 'Exercises in this workout',
    showExercises: 'Show exercises',
    hideExercises: 'Hide exercises',
    noExercises: 'No exercises added yet.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'exercise' : 'exercises'}`,
  },
  ar: {
    title: 'خطتي',
    heroEyebrow: 'يومك الحالي',
    heroBody: 'اختر بطاقة من الأسفل لحفظها كخطة تدريب اليوم.',
    heroSelectedEyebrow: 'محفوظ لليوم',
    heroSelectedBody: 'هذه هي الحصة المحفوظة لليوم حاليًا.',
    heroLockedBody: 'لقد بدأت تمرين اليوم بالفعل، لذلك أصبحت خطة اليوم مقفلة.',
    heroCompletedBody: 'تم تعليم حصة اليوم كمكتملة. اطلع على الاقتراح التالي عندما تكون جاهزًا.',
    sectionTitle: 'خطة الأسبوع',
    recommendationTitle: 'الاقتراح التالي',
    loading: 'جارٍ تحميل خطة الأسبوع...',
    empty: 'لا توجد خطة تمارين لهذا الأسبوع بعد.',
    error: 'تعذر تحميل خطة الأسبوع.',
    recommendedNextBadge: 'المقترح لليوم التالي',
    pickedBadge: 'محفوظ',
    completedBadge: 'تم',
    pickForToday: 'اختره لليوم',
    startMyWorkout: 'ابدأ تمريني',
    planLocked: 'الخطة مقفلة',
    pickedForToday: 'محفوظ لليوم',
    completedForToday: 'مكتمل اليوم',
    planFinishedTitle: 'اكتملت الخطة',
    planFinishedBody: 'أنهيت جميع أسابيع هذه الخطة. أنشئ خطة جديدة لتكمل التدريب في الأسابيع القادمة.',
    createNewPlan: 'أنشئ خطة جديدة',
    exercisesIncluded: 'التمارين داخل هذا التمرين',
    showExercises: 'أظهر التمارين',
    hideExercises: 'أخفِ التمارين',
    noExercises: 'لم يتم إضافة تمارين بعد.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'تمرين' : 'تمارين'}`,
  },
} as const;

const LOCALIZED_COPY: Record<AppLanguage, typeof COPY.en> = {
  en: COPY.en,
  ar: {
    title: 'خطتي',
    heroEyebrow: 'يومك الحالي',
    heroBody: 'اختر بطاقة من الأسفل لحفظها كخطة تدريب اليوم.',
    heroSelectedEyebrow: 'محفوظ لليوم',
    heroSelectedBody: 'هذه هي الحصة المحفوظة لليوم حالياً.',
    heroLockedBody: 'لقد بدأت تمرين اليوم بالفعل، لذلك أصبحت خطة اليوم مقفلة.',
    heroCompletedBody: 'تم تعليم حصة اليوم كمكتملة. اطلع على الاقتراح التالي عندما تكون جاهزاً.',
    sectionTitle: 'خطة الأسبوع',
    recommendationTitle: 'الاقتراح التالي',
    loading: 'جارٍ تحميل خطة الأسبوع...',
    empty: 'لا توجد خطة تمارين لهذا الأسبوع بعد.',
    error: 'تعذر تحميل خطة الأسبوع.',
    recommendedNextBadge: 'المقترح لليوم التالي',
    pickedBadge: 'محفوظ',
    completedBadge: 'تم',
    pickForToday: 'اختره لليوم',
    startMyWorkout: 'ابدأ تمريني',
    planLocked: 'الخطة مقفلة',
    pickedForToday: 'محفوظ لليوم',
    completedForToday: 'مكتمل اليوم',
    planFinishedTitle: 'اكتملت الخطة',
    planFinishedBody: 'أنهيت جميع أسابيع هذه الخطة. أنشئ خطة جديدة لتكمل التدريب في الأسابيع القادمة.',
    createNewPlan: 'أنشئ خطة جديدة',
    exercisesIncluded: 'التمارين داخل هذا التمرين',
    showExercises: 'أظهر التمارين',
    hideExercises: 'أخفِ التمارين',
    noExercises: 'لم يتم إضافة تمارين بعد.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'تمرين' : 'تمارين'}`,
  },
  it: {
    title: 'Il Mio Piano',
    heroEyebrow: 'Giorno Attuale',
    heroBody: 'Scegli una scheda qui sotto per salvarla come piano di oggi.',
    heroSelectedEyebrow: 'Salvato Per Oggi',
    heroSelectedBody: 'Questo e il workout attualmente salvato per oggi.',
    heroLockedBody: 'Hai gia iniziato il workout di oggi, quindi il piano di oggi e bloccato.',
    heroCompletedBody: 'Il workout di oggi e segnato come completato. Usa il suggerimento seguente quando sei pronto.',
    sectionTitle: 'Piano Settimanale',
    recommendationTitle: 'Prossimo Consigliato',
    loading: 'Caricamento del tuo piano settimanale...',
    empty: 'Nessun piano di allenamento trovato per questa settimana.',
    error: 'Impossibile caricare il tuo piano settimanale.',
    recommendedNextBadge: 'Consigliato Per Il Prossimo Giorno',
    pickedBadge: 'Scelto',
    completedBadge: 'Fatto',
    pickForToday: 'Scegli per oggi',
    startMyWorkout: 'Inizia Il Mio Workout',
    planLocked: 'Piano Bloccato',
    pickedForToday: 'Scelto per oggi',
    completedForToday: 'Completato oggi',
    planFinishedTitle: 'Piano completato',
    planFinishedBody: 'Hai finito tutte le settimane di questo piano. Crea un nuovo piano per continuare ad allenarti nelle prossime settimane.',
    createNewPlan: 'Crea Un Nuovo Piano',
    exercisesIncluded: 'Esercizi in questo workout',
    showExercises: 'Mostra esercizi',
    hideExercises: 'Nascondi esercizi',
    noExercises: 'Nessun esercizio aggiunto ancora.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'esercizio' : 'esercizi'}`,
  },
  de: {
    title: 'Mein Plan',
    heroEyebrow: 'Aktueller Tag',
    heroBody: 'Waehle unten eine Karte aus, um sie als heutigen Plan zu speichern.',
    heroSelectedEyebrow: 'Fuer Heute Gespeichert',
    heroSelectedBody: 'Dies ist das Workout, das aktuell fuer heute gespeichert ist.',
    heroLockedBody: 'Du hast das heutige Workout bereits begonnen, deshalb ist der heutige Plan gesperrt.',
    heroCompletedBody: 'Das heutige Workout ist als erledigt markiert. Nutze den naechsten Vorschlag, wenn du bereit bist.',
    sectionTitle: 'Wochenplan',
    recommendationTitle: 'Naechste Empfehlung',
    loading: 'Dein Wochenplan wird geladen...',
    empty: 'Fuer diese Woche wurde noch kein Trainingsplan gefunden.',
    error: 'Dein Wochenplan konnte nicht geladen werden.',
    recommendedNextBadge: 'Empfohlen Fuer Den Naechsten Tag',
    pickedBadge: 'Gewaehlt',
    completedBadge: 'Erledigt',
    pickForToday: 'Fuer heute waehlen',
    startMyWorkout: 'Mein Workout Starten',
    planLocked: 'Plan Gesperrt',
    pickedForToday: 'Fuer heute gewaehlt',
    completedForToday: 'Heute erledigt',
    planFinishedTitle: 'Plan abgeschlossen',
    planFinishedBody: 'Du hast alle Wochen dieses Plans abgeschlossen. Erstelle einen neuen Plan, um in den kommenden Wochen weiterzutrainieren.',
    createNewPlan: 'Neuen Plan Erstellen',
    exercisesIncluded: 'Uebungen in diesem Workout',
    showExercises: 'Uebungen zeigen',
    hideExercises: 'Uebungen ausblenden',
    noExercises: 'Noch keine Uebungen hinzugefuegt.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'Uebung' : 'Uebungen'}`,
  },
};

const MUSCLE_LABELS: Record<AppLanguage, Record<string, string>> = {
  en: {},
  ar: {
    chest: 'الصدر',
    back: 'الظهر',
    shoulders: 'الأكتاف',
    'front shoulders': 'الأكتاف الأمامية',
    'side shoulders': 'الأكتاف الجانبية',
    'rear shoulders': 'الأكتاف الخلفية',
    triceps: 'الترايسبس',
    biceps: 'البايسبس',
    abs: 'البطن',
    quadriceps: 'الرباعية',
    hamstrings: 'الخلفية',
    calves: 'السمانة',
    forearms: 'الساعد',
    glutes: 'الألوية',
    adductors: 'المقربات',
    general: 'عام',
  },
  it: {
    chest: 'Petto',
    back: 'Schiena',
    shoulders: 'Spalle',
    'front shoulders': 'Spalle anteriori',
    'side shoulders': 'Spalle laterali',
    'rear shoulders': 'Spalle posteriori',
    triceps: 'Tricipiti',
    biceps: 'Bicipiti',
    abs: 'Addome',
    quadriceps: 'Quadricipiti',
    hamstrings: 'Femorali',
    calves: 'Polpacci',
    forearms: 'Avambracci',
    glutes: 'Glutei',
    adductors: 'Adduttori',
    general: 'Generale',
  },
  de: {
    chest: 'Brust',
    back: 'Ruecken',
    shoulders: 'Schultern',
    'front shoulders': 'Vordere Schultern',
    'side shoulders': 'Seitliche Schultern',
    'rear shoulders': 'Hintere Schultern',
    triceps: 'Trizeps',
    biceps: 'Bizeps',
    abs: 'Bauch',
    quadriceps: 'Quadrizeps',
    hamstrings: 'Beinbeuger',
    calves: 'Waden',
    forearms: 'Unterarme',
    glutes: 'Gesaess',
    adductors: 'Adduktoren',
    general: 'Allgemein',
  },
};

const toTitleCase = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export function WorkoutOverviewScreen({
  onBack,
  onSelectWorkout,
  onPickWorkoutForToday,
  onOpenNewPlanFlow,
  currentDayLabel,
  workouts,
  selectedTodayWorkoutName,
  selectedTodayWorkoutDayLabel,
  hasTodaySelection = false,
  isTodaySelectionCompleted = false,
  isTodayPlanLocked = false,
  isPlanCompleted = false,
  recommendedWorkout = null,
  userProgram,
  assignmentHistory = [],
  accountCreatedAt,
  loading = false,
  error = null,
}: WorkoutOverviewScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [expandedWorkoutKey, setExpandedWorkoutKey] = useState<string | null>(null);

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

  const copy = LOCALIZED_COPY[language] || LOCALIZED_COPY.en;
  const isArabic = language === 'ar';

  const localizeDay = (value: string) => {
    return formatWorkoutDayLabel(value, value, language);
  };

  const localizeMuscle = (value: string) => {
    const normalized = String(value || '').trim().toLowerCase();
    return MUSCLE_LABELS[language]?.[normalized] || value;
  };

  const selectableWorkouts = useMemo(
    () => workouts.filter((workout) => Number(workout.exerciseCount || 0) > 0),
    [workouts],
  );

  useEffect(() => {
    setExpandedWorkoutKey((current) => {
      if (current && selectableWorkouts.some((workout) => workout.key === current)) {
        return current;
      }
      return selectableWorkouts.find((workout) => workout.isPickedForToday)?.key || null;
    });
  }, [selectableWorkouts]);

  const cards = useMemo(
    () => selectableWorkouts.map((workout) => ({
      ...workout,
      localizedMuscles: workout.targetMuscles.slice(0, 3).map((entry) => {
        const label = localizeMuscle(toTitleCase(entry));
        return {
          label,
          image: getBodyPartImage(entry),
        };
      }),
    })),
    [language, selectableWorkouts],
  );

  const heroEyebrow = hasTodaySelection ? copy.heroSelectedEyebrow : copy.heroEyebrow;
  const heroTitle = hasTodaySelection
    ? String(selectedTodayWorkoutName || '').trim() || localizeDay(selectedTodayWorkoutDayLabel || currentDayLabel)
    : localizeDay(currentDayLabel);
  const heroBody = hasTodaySelection
    ? (isTodaySelectionCompleted
        ? copy.heroCompletedBody
        : isTodayPlanLocked
          ? copy.heroLockedBody
          : copy.heroSelectedBody)
    : copy.heroBody;

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={copy.title}
          onBack={onBack}
          backButtonCoachmarkTargetId="my_plan_back_button"
          titleCoachmarkTargetId="my_plan_page_title"
        />
      </div>

      <div className="px-4 sm:px-6 space-y-5">
        <div
          data-coachmark-target="my_plan_current_day_card"
          className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/70 p-5"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,255,0,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_40%)]" aria-hidden="true" />
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
            data-coachmark-target="my_plan_current_day_gradient"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
            aria-hidden="true"
          />
          <div className={`relative z-10 ${isArabic ? 'text-right' : 'text-left'}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
              {heroEyebrow}
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              {heroTitle}
            </h2>
            <p className="mt-2 max-w-md text-sm text-text-secondary">
              {heroBody}
            </p>
          </div>
        </div>

        {recommendedWorkout && (
          <div className={`rounded-[1.4rem] border border-accent/20 bg-accent/8 px-4 py-4 ${isArabic ? 'text-right' : 'text-left'}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              {copy.recommendationTitle}
            </div>
            <div className="mt-2 text-base font-semibold text-white">
              {recommendedWorkout.workoutName}
            </div>
            <div className="mt-1 text-sm text-text-secondary">
              {localizeDay(recommendedWorkout.dayLabel)}
            </div>
          </div>
        )}

        <div data-coachmark-target="my_plan_agenda_card">
          <AgendaSection
            userProgram={userProgram}
            assignmentHistory={assignmentHistory}
            accountCreatedAt={accountCreatedAt}
            selectedWorkoutKey={selectableWorkouts.find((workout) => workout.isPickedForToday)?.key || ''}
            isTodayPlanLocked={isTodayPlanLocked}
            onPickWorkoutForToday={onPickWorkoutForToday}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {copy.sectionTitle}
            </div>
          </div>

          {loading && (
            <div className="rounded-2xl border border-white/10 bg-card/60 px-4 py-5 text-sm text-text-secondary">
              {copy.loading}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-5 text-sm text-rose-200">
              {error || copy.error}
            </div>
          )}

          {!loading && !error && !isPlanCompleted && cards.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-card/60 px-4 py-5 text-sm text-text-secondary">
              {copy.empty}
            </div>
          )}

          {!loading && !error && isPlanCompleted && (
            <div className={`rounded-[1.6rem] border border-accent/30 bg-accent/10 p-5 ${isArabic ? 'text-right' : 'text-left'}`}>
              <div className="text-base font-semibold text-white">{copy.planFinishedTitle}</div>
              <div className="mt-2 text-sm text-text-secondary">
                {copy.planFinishedBody}
              </div>
              <div className={`mt-4 flex ${isArabic ? 'justify-start' : 'justify-end'}`}>
                <button
                  type="button"
                  onClick={onOpenNewPlanFlow}
                  className="font-marker inline-flex min-w-[12rem] items-center justify-center rounded-full border border-accent/30 bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-black transition-colors hover:bg-[#aee600]"
                >
                  {copy.createNewPlan}
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !isPlanCompleted && cards.length > 0 && (
            <div className="space-y-3">
              {cards.map((workout, index) => {
                const isLockedForSelection = isTodayPlanLocked && hasTodaySelection && !workout.isPickedForToday;
                const isExpanded = expandedWorkoutKey === workout.key;

                return (
                <div
                  key={workout.key}
                  data-coachmark-target={index === 0 ? 'my_plan_first_week_card' : undefined}
                  className={`w-full rounded-[1.6rem] border p-4 transition-colors ${
                    workout.isPickedForToday
                      ? 'border-accent/35 bg-accent/8 shadow-[0_14px_32px_rgba(191,255,0,0.08)]'
                      : 'border-white/10 bg-card/60 hover:border-accent/20 hover:bg-card/75'
                  } ${isArabic ? 'text-right' : 'text-left'}`}
                  dir={isArabic ? 'rtl' : 'ltr'}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedWorkoutKey((current) => (current === workout.key ? null : workout.key));
                    }}
                    className="w-full text-inherit"
                    aria-expanded={isExpanded}
                  >
                    <div className={`flex items-start justify-between gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-start gap-3 min-w-0 ${isArabic ? 'flex-row-reverse' : ''}`}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-accent">
                          <Dumbbell size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-white">
                            {workout.workoutName}
                          </div>
                          <div className="mt-1 text-xs text-text-secondary">
                            {copy.exerciseCount(workout.exerciseCount)}
                          </div>
                        </div>
                      </div>

                      <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
                        {workout.isRecommendedNext && !workout.isPickedForToday && (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                            {copy.recommendedNextBadge}
                          </span>
                        )}
                        {workout.isPickedForToday && (
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            workout.isCompletedToday
                              ? 'bg-emerald-500/15 text-emerald-200'
                              : 'bg-accent/15 text-accent'
                          }`}>
                            {workout.isCompletedToday ? copy.completedBadge : copy.pickedBadge}
                          </span>
                        )}
                        <img
                          src={rightArrowIcon}
                          alt=""
                          aria-hidden="true"
                          className={`mb-1 h-[18px] w-[18px] shrink-0 object-contain opacity-70 transition-transform ${
                            isArabic
                              ? (isExpanded ? '-rotate-90' : 'rotate-180')
                              : (isExpanded ? 'rotate-90' : '')
                          }`}
                        />
                      </div>
                    </div>
                  </button>

                  {workout.localizedMuscles.length > 0 && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {workout.localizedMuscles.map((muscle) => (
                        <div
                          key={`${workout.key}-${muscle.label}`}
                          className="h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-white/5"
                          title={muscle.label}
                        >
                          <img
                            src={muscle.image}
                            alt={muscle.label}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                        {copy.exercisesIncluded}
                      </div>
                      {workout.exerciseNames.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {workout.exerciseNames.map((exerciseName, exerciseIndex) => (
                            <div
                              key={`${workout.key}-${exerciseName}-${exerciseIndex}`}
                              className={`flex items-center gap-2 text-sm text-text-secondary ${isArabic ? 'flex-row-reverse text-right' : ''}`}
                            >
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent/15 px-2 text-[11px] font-semibold text-accent">
                                {exerciseIndex + 1}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{exerciseName}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-text-secondary">
                          {copy.noExercises}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`mt-4 flex ${isArabic ? 'justify-start' : 'justify-end'}`}>
                    <button
                      type="button"
                      data-coachmark-target={index === 0 ? 'my_plan_first_action_button' : undefined}
                      onClick={() => {
                        if (workout.isCompletedToday || isLockedForSelection) {
                          return;
                        }

                        if (workout.isPickedForToday && !workout.isCompletedToday) {
                          onSelectWorkout(workout.key);
                          return;
                        }

                        onPickWorkoutForToday(workout.key);
                      }}
                      disabled={!!workout.isCompletedToday || isLockedForSelection}
                      className={`font-marker inline-flex min-w-[10.5rem] items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                        workout.isCompletedToday
                          ? 'cursor-default border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                          : isLockedForSelection
                            ? 'cursor-not-allowed border-white/10 bg-white/5 text-text-tertiary'
                          : workout.isPickedForToday
                            ? 'border-accent/30 bg-accent text-black hover:bg-[#aee600]'
                          : 'border-accent/30 bg-accent/20 text-text-primary hover:bg-accent/25'
                      }`}
                    >
                      {workout.isCompletedToday
                        ? copy.completedForToday
                        : workout.isPickedForToday
                          ? copy.startMyWorkout
                          : isLockedForSelection
                            ? copy.planLocked
                            : copy.pickForToday}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
