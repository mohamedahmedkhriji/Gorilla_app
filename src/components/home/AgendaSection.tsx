import React, { useEffect, useRef, useState } from 'react';
import { X, Check, CalendarX2 } from 'lucide-react';
import { formatWorkoutDayLabel, formatWorkoutDayShortLabel, normalizeWorkoutDayKey } from '../../services/workoutDayLabel';
import { emojiAgenda, emojiDoneDayBg, emojiMissedDayBg } from '../../services/emojiTheme';
import doneDayIcon from '../../../assets/emoji/done day.png';
import highWeightIcon from '../../../assets/emoji/high weight.png';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getLanguageLocale, getStoredLanguage } from '../../services/language';
import type { WorkoutAssignmentHistoryEntry } from '../../services/todayWorkoutSelection';
import { stripExercisePrefix } from '../../services/exerciseName';

type AgendaDay = {
  day: string;
  dayLabel: string;
  date: number;
  fullDate: Date;
  label: string;
  exercises: string[];
  workoutKey: string;
  status: 'missed' | 'done' | 'picked' | 'recovery' | 'active' | 'past' | 'upcoming';
  isAssignedDay: boolean;
  isPickedForToday: boolean;
  isRestDay: boolean;
};

const AGENDA_TITLE: LocalizedLanguageRecord<string> = {
  en: '30 Day Agenda',
  ar: 'أجندة 30 يوماً',
  it: 'Agenda di 30 Giorni',
  de: '30-Tage-Agenda',
  fr: 'Agenda 30 jours',
};

const AGENDA_COPY: LocalizedLanguageRecord<{
  exercises: string;
  recoveryDay: string;
  missedDay: string;
  chooseFirstTitle: string;
  chooseFirstBody: string;
  selectedForToday: string;
  selectedBody: string;
  selectedLockedBody: string;
  assignedBody: string;
  completedForToday: string;
  pendingRecoveryDay: string;
  chooseForToday: string;
  chosenForToday: string;
  planLockedTitle: string;
  planLockedBody: string;
  planLocked: string;
  missedBody: string;
  recoveryBody: string;
}> = {
  en: {
    exercises: 'Exercises',
    recoveryDay: 'Recovery Day',
    missedDay: 'Missed Day',
    chooseFirstTitle: 'Choose This First',
    chooseFirstBody: 'Pick this workout for today first before seeing the workout details.',
    selectedForToday: 'Selected For Today',
    selectedBody: 'This is the workout currently chosen for today. You can change it anytime.',
    selectedLockedBody: 'You already started today\'s workout, so today\'s plan is locked.',
    assignedBody: 'This workout was assigned to that day.',
    completedForToday: 'Completed Today',
    pendingRecoveryDay: 'Recovery Day',
    chooseForToday: 'Pick For Today',
    chosenForToday: 'Chosen For Today',
    planLockedTitle: 'Plan Locked',
    planLockedBody: 'Once you start any exercise today, you can no longer change today\'s plan.',
    planLocked: 'Plan Locked',
    missedBody: 'This scheduled workout was marked as missed and no longer counts toward this week\'s remaining sessions.',
    recoveryBody: 'Rest and let your muscles recover',
  },
  ar: {
    exercises: 'التمارين',
    recoveryDay: 'يوم التعافي',
    missedDay: 'يوم مفقود',
    chooseFirstTitle: 'اختر الحصة أولاً',
    chooseFirstBody: 'اختر هذه الحصة لليوم أولاً قبل رؤية تفاصيل التمرين.',
    selectedForToday: 'مختار لليوم',
    selectedBody: 'هذه هي الحصة المختارة للتدريب اليوم. يمكنك تغييرها في أي وقت.',
    selectedLockedBody: 'لقد بدأت تمرين اليوم بالفعل، لذلك أصبحت خطة اليوم مقفلة.',
    assignedBody: 'تم حفظ هذا التمرين لذلك اليوم.',
    completedForToday: 'مكتمل اليوم',
    pendingRecoveryDay: 'يوم تعافٍ مؤقت',
    chooseForToday: 'اختره لليوم',
    chosenForToday: 'تم اختياره لليوم',
    planLockedTitle: 'الخطة مقفلة',
    planLockedBody: 'بعد بدء أي تمرين اليوم، لا يمكنك تغيير خطة اليوم.',
    planLocked: 'الخطة مقفلة',
    missedBody: 'تم اعتبار هذا التمرين المجدول كمفقود ولن يُحسب ضمن حصص هذا الأسبوع المتبقية.',
    recoveryBody: 'استرح ودع عضلاتك تتعافى',
  },
  it: {
    exercises: 'Esercizi',
    recoveryDay: 'Giorno di Recupero',
    missedDay: 'Giorno Saltato',
    chooseFirstTitle: 'Scegli Prima Questo',
    chooseFirstBody: 'Scegli prima questo workout per oggi prima di vedere i dettagli dell\'allenamento.',
    selectedForToday: 'Selezionato Per Oggi',
    selectedBody: 'Questo e il workout attualmente scelto per oggi. Puoi cambiarlo in qualsiasi momento.',
    selectedLockedBody: 'Hai gia iniziato il workout di oggi, quindi il piano di oggi e bloccato.',
    assignedBody: 'Questo workout e stato assegnato a quel giorno.',
    completedForToday: 'Completato Oggi',
    pendingRecoveryDay: 'Giorno di Recupero',
    chooseForToday: 'Scegli per oggi',
    chosenForToday: 'Scelto Per Oggi',
    planLockedTitle: 'Piano Bloccato',
    planLockedBody: 'Una volta iniziato un esercizio oggi, non puoi piu cambiare il piano di oggi.',
    planLocked: 'Piano Bloccato',
    missedBody: 'Questo workout programmato e stato segnato come saltato e non conta piu per le sessioni rimanenti di questa settimana.',
    recoveryBody: 'Riposati e lascia recuperare i tuoi muscoli',
  },
  de: {
    exercises: 'Uebungen',
    recoveryDay: 'Erholungstag',
    missedDay: 'Verpasster Tag',
    chooseFirstTitle: 'Waehle Das Zuerst',
    chooseFirstBody: 'Waehle dieses Workout zuerst fuer heute aus, bevor du die Trainingsdetails ansiehst.',
    selectedForToday: 'Fuer Heute Ausgewaehlt',
    selectedBody: 'Dies ist das Workout, das aktuell fuer heute ausgewaehlt ist. Du kannst es jederzeit aendern.',
    selectedLockedBody: 'Du hast das heutige Workout bereits begonnen, deshalb ist der heutige Plan gesperrt.',
    assignedBody: 'Dieses Workout wurde diesem Tag zugewiesen.',
    completedForToday: 'Heute Erledigt',
    pendingRecoveryDay: 'Erholungstag',
    chooseForToday: 'Fuer heute waehlen',
    chosenForToday: 'Fuer Heute Gewaehlt',
    planLockedTitle: 'Plan Gesperrt',
    planLockedBody: 'Sobald du heute eine Uebung beginnst, kannst du den heutigen Plan nicht mehr aendern.',
    planLocked: 'Plan Gesperrt',
    missedBody: 'Dieses geplante Workout wurde als verpasst markiert und zaehlt nicht mehr zu den verbleibenden Einheiten dieser Woche.',
    recoveryBody: 'Ruhe dich aus und gib deinen Muskeln Zeit zur Erholung',
  },
  fr: {
    exercises: 'Exercices',
    recoveryDay: 'Jour de recuperation',
    missedDay: 'Jour manque',
    chooseFirstTitle: 'Choisis cette seance d abord',
    chooseFirstBody: 'Choisis d abord cet entrainement pour aujourd hui avant de voir les details de la seance.',
    selectedForToday: 'Selectionne pour aujourd hui',
    selectedBody: 'C est l entrainement actuellement choisi pour aujourd hui. Tu peux le changer a tout moment.',
    selectedLockedBody: 'Tu as deja commence l entrainement du jour, donc le plan d aujourd hui est verrouille.',
    assignedBody: 'Cet entrainement a ete assigne a ce jour.',
    completedForToday: 'Termine aujourd hui',
    pendingRecoveryDay: 'Jour de recuperation',
    chooseForToday: 'Choisir pour aujourd hui',
    chosenForToday: 'Choisi pour aujourd hui',
    planLockedTitle: 'Plan verrouille',
    planLockedBody: 'Des que tu commences un exercice aujourd hui, tu ne peux plus changer le plan du jour.',
    planLocked: 'Plan verrouille',
    missedBody: 'Cet entrainement prevu a ete marque comme manque et ne compte plus dans les seances restantes de cette semaine.',
    recoveryBody: 'Repose-toi et laisse tes muscles recuperer',
  },
};

export function AgendaSection({
  userProgram,
  assignmentHistory = [],
  accountCreatedAt,
  showGradientOverlay = true,
  selectedWorkoutKey = '',
  isTodayPlanLocked = false,
  onPickWorkoutForToday,
}: {
  userProgram?: any;
  assignmentHistory?: WorkoutAssignmentHistoryEntry[];
  programProgress?: any;
  accountCreatedAt?: string | Date | null;
  showGradientOverlay?: boolean;
  selectedWorkoutKey?: string;
  isTodayPlanLocked?: boolean;
  onPickWorkoutForToday?: (workoutKey: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<AgendaDay | null>(null);
  const language = getActiveLanguage(getStoredLanguage()) as AppLanguage;
  const isArabic = language === 'ar';
  const agendaTitle = AGENDA_TITLE[language] || AGENDA_TITLE.en;
  const copy = {
    weeklyAgenda: isArabic ? 'أجندة الأسبوع' : 'Weekly Agenda',
    exercises: isArabic ? 'التمارين' : 'Exercises',
    recoveryDay: isArabic ? 'يوم التعافي' : 'Recovery Day',
    missedDay: isArabic ? 'يوم مفقود' : 'Missed Day',
    chooseFirstTitle: isArabic ? 'اختر الحصة أولاً' : 'Choose This First',
    chooseFirstBody: isArabic
      ? 'اختر هذه الحصة لليوم أولاً قبل رؤية تفاصيل التمرين.'
      : 'Pick this workout for today first before seeing the workout details.',
    selectedForToday: isArabic ? 'مختار لليوم' : 'Selected For Today',
    selectedBody: isArabic
      ? 'هذه هي الحصة المختارة للتدريب اليوم. يمكنك تغييرها في أي وقت.'
      : 'This is the workout currently chosen for today. You can change it anytime.',
    selectedLockedBody: isArabic
      ? 'لقد بدأت تمرين اليوم بالفعل، لذلك أصبحت خطة اليوم مقفلة.'
      : 'You already started today\'s workout, so today\'s plan is locked.',
    assignedBody: isArabic ? 'تم حفظ هذا التمرين لذلك اليوم.' : 'This workout was assigned to that day.',
    completedForToday: isArabic ? 'مكتمل اليوم' : 'Completed Today',
    pendingRecoveryDay: isArabic ? 'يوم تعافٍ مؤقت' : 'Recovery Day',
    chooseForToday: isArabic ? 'اختره لليوم' : 'Pick For Today',
    chosenForToday: isArabic ? 'تم اختياره لليوم' : 'Chosen For Today',
    planLockedTitle: isArabic ? 'الخطة مقفلة' : 'Plan Locked',
    planLockedBody: isArabic
      ? 'بعد بدء أي تمرين اليوم، لا يمكنك تغيير خطة اليوم.'
      : 'Once you start any exercise today, you can no longer change today\'s plan.',
    planLocked: isArabic ? 'الخطة مقفلة' : 'Plan Locked',
    missedBody: isArabic
      ? 'تم اعتبار هذا التمرين مجدولًا كمفقود ولن يُحسب ضمن حصص هذا الأسبوع المتبقية.'
      : 'This scheduled workout was marked as missed and no longer counts toward this week\'s remaining sessions.',
    recoveryBody: isArabic ? 'استرح ودع عضلاتك تتعافى' : 'Rest and let your muscles recover',
  };
  const localizedCopy = AGENDA_COPY[language] || copy;
  const arDayLabels: Record<string, { long: string; short: string }> = {
    monday: { long: 'الاثنين', short: 'اثن' },
    tuesday: { long: 'الثلاثاء', short: 'ثلا' },
    wednesday: { long: 'الأربعاء', short: 'أرب' },
    thursday: { long: 'الخميس', short: 'خمي' },
    friday: { long: 'الجمعة', short: 'جمع' },
    saturday: { long: 'السبت', short: 'سبت' },
    sunday: { long: 'الأحد', short: 'أحد' },
  };
  const restLabel = 'Rest';
  const today = new Date();

  const formatDateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizeDate = (value: unknown) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const startOfDay = (value: Date) => {
    const normalized = new Date(value);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const getWorkoutKey = (workout: any, fallbackDayName: string, index: number) => {
    const dayKey = normalizeWorkoutDayKey(workout?.day_name || fallbackDayName);
    return String(workout?.id || `${dayKey || 'day'}-${index}`);
  };

  const getWorkoutLabel = (workoutName: string) =>
    String(workoutName || '')
      .replace(/^Week\s+\d+\s*-\s*/i, '')
      .trim();

  const parseWorkoutExercises = (raw: any) => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((entry: any) => entry.exerciseName || entry.name).filter(Boolean);
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((entry: any) => entry.exerciseName || entry.name).filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    return [];
  };

  const programWorkouts = Array.isArray(userProgram?.currentWeekWorkouts) && userProgram.currentWeekWorkouts.length > 0
    ? userProgram.currentWeekWorkouts
    : Array.isArray(userProgram?.workouts)
      ? userProgram.workouts
      : [];
  const completedDateKeys = new Set(
    (Array.isArray(userProgram?.completedWorkoutDates)
      ? userProgram.completedWorkoutDates
      : Array.isArray(userProgram?.completed_workout_dates)
        ? userProgram.completed_workout_dates
        : Array.isArray(userProgram?.workoutCompletedDates)
          ? userProgram.workoutCompletedDates
          : [])
      .map((value: unknown) => String(value || '').slice(0, 10))
      .filter(Boolean),
  );
  const missedDateKeys = new Set(
    (Array.isArray(userProgram?.missedWorkoutDates) ? userProgram.missedWorkoutDates : [])
      .map((value: unknown) => String(value || '').slice(0, 10))
      .filter(Boolean),
  );

  const normalizeDaysPerWeek = (value: any) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 4;
    return Math.max(2, Math.min(6, Math.round(parsed)));
  };

  const weekdaysByDaysPerWeek: Record<number, string[]> = {
    2: ['monday', 'thursday'],
    3: ['monday', 'wednesday', 'friday'],
    4: ['monday', 'tuesday', 'thursday', 'friday'],
    5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  };

  const daysPerWeek = normalizeDaysPerWeek(
    userProgram?.daysPerWeek ?? userProgram?.days_per_week ?? (programWorkouts.length || 4),
  );
  const fallbackWeekdays = weekdaysByDaysPerWeek[daysPerWeek] || weekdaysByDaysPerWeek[4];

  const workoutByDayName = new Map<string, { workout: any; index: number; key: string }>();
  const workoutByKey = new Map<string, { workout: any; index: number; key: string }>();
  programWorkouts.forEach((workout: any, index: number) => {
    const order = Number(workout?.day_order || index + 1);
    const fallbackDayName = fallbackWeekdays[((order - 1) % fallbackWeekdays.length + fallbackWeekdays.length) % fallbackWeekdays.length];
    const dayKey = normalizeWorkoutDayKey(workout?.day_name || fallbackDayName);
    const workoutKey = getWorkoutKey(workout, fallbackDayName, index);
    const entry = { workout, index, key: workoutKey };
    if (workoutKey && !workoutByKey.has(workoutKey)) {
      workoutByKey.set(workoutKey, entry);
    }
    if (!dayKey || workoutByDayName.has(dayKey)) return;
    workoutByDayName.set(dayKey, entry);
  });

  const todayDate = startOfDay(today);
  const todayKey = formatDateKey(todayDate);
  const defaultStartDate = new Date(todayDate);
  defaultStartDate.setDate(todayDate.getDate() - 10);
  const createdDate = normalizeDate(accountCreatedAt);
  const createdDay = createdDate ? startOfDay(createdDate) : null;
  const startDate = createdDay && createdDay > defaultStartDate
    ? (createdDay > todayDate ? todayDate : createdDay)
    : defaultStartDate;
  const assignmentByDateKey = new Map(
    assignmentHistory
      .filter((entry) => !!entry?.dateKey && !!entry?.workoutKey)
      .map((entry) => [entry.dateKey, entry] as const),
  );
  const resolveAssignmentWorkoutEntry = (assignment: WorkoutAssignmentHistoryEntry | null) => {
    if (!assignment?.workoutKey) return null;

    if (assignment.workoutKey === 'today' && assignment.dateKey === todayKey && userProgram?.todayWorkout) {
      return {
        workout: {
          ...userProgram.todayWorkout,
          id: 'today',
          workout_name: userProgram.todayWorkout?.name,
          day_name: userProgram.todayWorkout?.dayName,
        },
        index: -1,
        key: 'today',
      };
    }

    const storedEntry = workoutByKey.get(assignment.workoutKey);
    if (storedEntry) return storedEntry;

    return {
      workout: {
        id: assignment.workoutKey,
        workout_name: assignment.workoutName || assignment.dayLabel || 'Workout',
        day_name: assignment.dayLabel,
        exercises: [],
      },
      index: -1,
      key: assignment.workoutKey,
    };
  };
  const selectedWorkoutEntry = selectedWorkoutKey === 'today' && userProgram?.todayWorkout
    ? {
        workout: {
          ...userProgram.todayWorkout,
          id: 'today',
          workout_name: userProgram.todayWorkout?.name,
          day_name: userProgram.todayWorkout?.dayName,
        },
        index: -1,
        key: 'today',
      }
    : (selectedWorkoutKey ? workoutByKey.get(selectedWorkoutKey) || null : null);

  const days: AgendaDay[] = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const dateKey = formatDateKey(date);
    const weekdayKey = normalizeWorkoutDayKey(date.toLocaleDateString('en-US', { weekday: 'long' }));
    const isToday = dateKey === todayKey;
    const assignedDayEntry = assignmentByDateKey.get(dateKey) || null;
    const assignedWorkoutEntry = resolveAssignmentWorkoutEntry(assignedDayEntry);
    const defaultDayWorkoutEntry = weekdayKey ? workoutByDayName.get(weekdayKey) || null : null;
    const dayWorkoutEntry = isToday && selectedWorkoutEntry
      ? selectedWorkoutEntry
      : assignedWorkoutEntry || defaultDayWorkoutEntry;
    const dayWorkout = dayWorkoutEntry?.workout || null;
    const workoutKey = dayWorkoutEntry?.key || '';
    const label = dayWorkout
      ? getWorkoutLabel(dayWorkout.workout_name || dayWorkout.name || '')
      : restLabel;
    const exercises = dayWorkout ? parseWorkoutExercises(dayWorkout.exercises) : [];
    const isRestDay = !dayWorkout;
    const isMissed = missedDateKeys.has(dateKey);
    const isCompleted = completedDateKeys.has(dateKey) || Boolean(assignedDayEntry?.completed);
    const isPast = dateKey < todayKey;
    const isPickedForToday = !!(
      isToday
      && workoutKey
      && selectedWorkoutKey
      && workoutKey === selectedWorkoutKey
    );
    const isAssignedDay = !!(assignedDayEntry?.workoutKey || isPickedForToday);

    const isCurrentRecoveryDay = dateKey === todayKey && isCompleted && !selectedWorkoutKey;
    const isPastRecoveryDay = isPast && !isMissed && !isCompleted && !isAssignedDay;

    const status: AgendaDay['status'] = isMissed
      ? 'missed'
      : (isCurrentRecoveryDay || isPastRecoveryDay)
        ? 'recovery'
        : isCompleted
          ? 'done'
      : isAssignedDay
          ? 'picked'
          : dateKey === todayKey
            ? 'active'
            : isPast
              ? 'past'
              : 'upcoming';

    return {
      day: formatWorkoutDayShortLabel(
        weekdayKey,
        isArabic
          ? (arDayLabels[weekdayKey || '']?.short || date.toLocaleDateString('ar-EG', { weekday: 'short' }))
          : date.toLocaleDateString(getLanguageLocale(language), { weekday: 'short' }),
        language,
      ),
      dayLabel: formatWorkoutDayLabel(
        weekdayKey,
        isArabic
          ? (arDayLabels[weekdayKey || '']?.long || date.toLocaleDateString('ar-EG', { weekday: 'long' }))
          : date.toLocaleDateString(getLanguageLocale(language), { weekday: 'long' }),
        language,
      ),
      date: date.getDate(),
      fullDate: date,
      label,
      exercises,
      workoutKey,
      status,
      isAssignedDay,
      isPickedForToday,
      isRestDay,
    };
  });

  useEffect(() => {
    if (!scrollRef.current) return;
    const todayIndex = days.findIndex((day) => formatDateKey(day.fullDate) === todayKey);
    const targetIndex = todayIndex >= 0 ? todayIndex : 0;
    const currentDayElement = scrollRef.current.children[targetIndex] as HTMLElement | undefined;
    if (!currentDayElement) return;

    scrollRef.current.scrollLeft =
      currentDayElement.offsetLeft
      - (scrollRef.current.offsetWidth / 2)
      + (currentDayElement.offsetWidth / 2);
  }, [days, todayKey]);

  useEffect(() => {
    if (!selectedDay) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDay(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDay]);

  return (
    <div className="space-y-3">
      <div className="flex items-end px-1">
        <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.15em]">{agendaTitle}</h3>
      </div>

      <div className="rounded-2xl surface-card border border-white/15 px-2 py-3 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url(${emojiAgenda})` }}
          aria-hidden="true"
        />
        {showGradientOverlay && (
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
            aria-hidden="true"
          />
        )}

        <div
          ref={scrollRef}
          className="relative z-10 flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {days.map((day, index) => {
            const isActive = day.status === 'active';
            const isDone = day.status === 'done';
            const isMissed = day.status === 'missed';
            const isPicked = day.status === 'picked';
            const isRecovery = day.status === 'recovery';

            return (
              <div
                key={index}
                className="flex flex-col items-center gap-1.5 min-w-[54px] cursor-pointer shrink-0"
                onClick={() => setSelectedDay(day)}
              >
                <div
                  className={`
                    relative overflow-hidden w-11 h-12 rounded-[14px] flex items-center justify-center border transition-transform duration-200
                    ${
                      isActive
                        ? 'text-black border-accent/60 bg-[linear-gradient(135deg,rgb(var(--color-accent)),rgb(var(--color-info)))]'
                        : isRecovery
                          ? 'bg-accent/12 text-accent border-accent/35'
                        : isMissed
                          ? 'bg-rose-500/15 text-rose-100 border-rose-500/30'
                          : isDone || isPicked
                            ? 'bg-white/[0.08] text-white border-white/10'
                            : 'bg-card text-text-secondary border-white/10'
                    }
                    hover:-translate-y-0.5
                  `}
                >
                  {(isDone || isMissed || isPicked) && (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-65"
                        style={{ backgroundImage: `url(${isMissed ? emojiMissedDayBg : emojiDoneDayBg})` }}
                        aria-hidden="true"
                      />
                      <div
                        className={`absolute inset-0 ${
                          isMissed
                            ? 'bg-gradient-to-r from-background/55 via-rose-950/45 to-rose-900/25'
                            : 'bg-gradient-to-r from-background/55 via-background/30 to-background/15'
                        }`}
                        aria-hidden="true"
                      />
                    </>
                  )}

                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 -bottom-1.5 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px] border-r border-b border-white/10"
                      style={{ background: 'rgb(var(--color-accent))' }}
                    />
                  )}

                  {isMissed ? (
                    <CalendarX2 size={16} className="relative z-10" />
                  ) : isRecovery ? (
                    <img
                      src={highWeightIcon}
                      alt="Recovery day"
                      className="relative z-10 h-6 w-6 object-contain"
                      loading="lazy"
                    />
                  ) : isDone || isPicked ? (
                    <img
                      src={doneDayIcon}
                      alt="Done day"
                      className="relative z-10 h-6 w-6 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="relative z-10 text-sm font-bold leading-none">{day.date}</span>
                  )}
                </div>

                <div className={`text-[10px] font-medium leading-none ${isActive ? 'mt-1 text-text-primary' : 'text-text-tertiary'}`}>
                  {day.day}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 py-5 sm:flex sm:items-center sm:justify-center sm:p-6"
          onClick={() => setSelectedDay(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="surface-glass relative mx-auto flex w-full max-w-[21.5rem] flex-col overflow-hidden rounded-2xl border border-white/15 p-4 shadow-2xl sm:max-w-sm sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-2xl leading-none text-white sm:text-3xl">
                  {selectedDay.fullDate.toLocaleDateString(getLanguageLocale(language), { month: 'long', day: 'numeric' })}
                </h3>
                <p className="text-xs uppercase tracking-[0.1em] text-text-secondary mt-2">
                  {isArabic ? selectedDay.dayLabel : (selectedDay.dayLabel || '').toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-secondary transition-colors hover:text-white"
                aria-label="Close day details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[min(78vh,34rem)] overflow-y-auto pr-1">
              <div className="mb-4 text-sm text-text-secondary">
                {selectedDay.label === restLabel || selectedDay.status === 'recovery'
                  ? localizedCopy.recoveryDay
                  : selectedDay.label}
              </div>

              {selectedDay.status === 'missed' ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/12">
                    <CalendarX2 size={28} className="text-rose-300" />
                  </div>
                  <h4 className="mb-2 text-2xl leading-none text-white sm:text-3xl">{localizedCopy.missedDay}</h4>
                  <p className="text-sm text-text-secondary">
                    {localizedCopy.missedBody}
                  </p>
                </div>
              ) : selectedDay.status === 'picked' ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center py-1 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <img
                        src={doneDayIcon}
                        alt="Done day"
                        className="h-9 w-9 object-contain"
                      />
                    </div>
                    <h4 className="mb-2 text-2xl leading-none text-white sm:text-3xl">
                      {selectedDay.isPickedForToday ? localizedCopy.selectedForToday : localizedCopy.chosenForToday}
                    </h4>
                    <p className="text-sm text-text-secondary">
                      {selectedDay.isPickedForToday
                        ? (isTodayPlanLocked ? localizedCopy.selectedLockedBody : localizedCopy.selectedBody)
                        : localizedCopy.assignedBody}
                    </p>
                  </div>

                  {selectedDay.exercises.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{localizedCopy.exercises}</h4>
                      {selectedDay.exercises.map((exercise, index) => {
                        const isDone = selectedDay.status === 'done';
                        return (
                          <div key={index} className="flex items-center justify-between rounded-xl border border-white/10 bg-background p-3">
                            <span className="pr-3 text-sm text-white">{stripExercisePrefix(exercise)}</span>
                            {isDone && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                                <Check size={14} className="text-black" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : selectedDay.label === restLabel || selectedDay.status === 'recovery' || selectedDay.isRestDay ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12">
                    <img
                      src={highWeightIcon}
                      alt="Recovery day"
                      className="h-9 w-9 object-contain"
                    />
                  </div>
                  <h4 className="mb-2 text-2xl leading-none text-white sm:text-3xl">
                    {selectedDay.status === 'recovery' ? localizedCopy.pendingRecoveryDay : localizedCopy.recoveryDay}
                  </h4>
                  <p className="text-sm text-text-secondary">{localizedCopy.recoveryBody}</p>
                </div>
              ) : selectedDay.status !== 'done' ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <img
                      src={doneDayIcon}
                      alt="Done day"
                      className="h-9 w-9 object-contain opacity-85"
                    />
                  </div>
                  <h4 className="mb-2 text-2xl leading-none text-white sm:text-3xl">
                    {isTodayPlanLocked ? localizedCopy.planLockedTitle : localizedCopy.chooseFirstTitle}
                  </h4>
                  <p className="text-sm text-text-secondary">
                    {isTodayPlanLocked ? localizedCopy.planLockedBody : localizedCopy.chooseFirstBody}
                  </p>
                  {!!(selectedDay.workoutKey && onPickWorkoutForToday) && (
                    <button
                      type="button"
                      disabled={isTodayPlanLocked}
                      className={`mt-5 rounded-full px-5 py-2 text-sm font-semibold transition-transform duration-200 ${
                        isTodayPlanLocked
                          ? 'cursor-not-allowed border border-white/10 bg-white/5 text-text-tertiary'
                          : 'bg-accent text-black hover:-translate-y-0.5'
                      }`}
                      onClick={() => {
                        if (isTodayPlanLocked) return;
                        onPickWorkoutForToday(selectedDay.workoutKey);
                        setSelectedDay(null);
                      }}
                    >
                      {isTodayPlanLocked ? localizedCopy.planLocked : localizedCopy.chooseForToday}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{localizedCopy.exercises}</h4>
                  {selectedDay.exercises.map((exercise, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl border border-white/10 bg-background p-3">
                      <span className="pr-3 text-sm text-white">{stripExercisePrefix(exercise)}</span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                        <Check size={14} className="text-black" strokeWidth={3} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
