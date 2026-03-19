import React, { useEffect, useRef, useState } from 'react';
import { X, Check, CalendarX2 } from 'lucide-react';
import { formatWorkoutDayLabel, formatWorkoutDayShortLabel, normalizeWorkoutDayKey } from '../../services/workoutDayLabel';
import { emojiAgenda, emojiDoneDayBg, emojiMissedDayBg } from '../../services/emojiTheme';
import doneDayIcon from '../../../assets/emoji/done day.png';
import highWeightIcon from '../../../assets/emoji/high weight.png';
import { getActiveLanguage, getStoredLanguage } from '../../services/language';
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
  isPickedForToday: boolean;
  isRestDay: boolean;
};

export function AgendaSection({
  userProgram,
  accountCreatedAt,
  showGradientOverlay = true,
  selectedWorkoutKey = '',
  isSelectedWorkoutCompleted = false,
  onPickWorkoutForToday,
}: {
  userProgram?: any;
  programProgress?: any;
  accountCreatedAt?: string | Date | null;
  showGradientOverlay?: boolean;
  selectedWorkoutKey?: string;
  isSelectedWorkoutCompleted?: boolean;
  onPickWorkoutForToday?: (workoutKey: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<AgendaDay | null>(null);
  const isArabic = getActiveLanguage(getStoredLanguage()) === 'ar';
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
    completedForToday: isArabic ? 'مكتمل اليوم' : 'Completed Today',
    pendingRecoveryDay: isArabic ? 'يوم تعافٍ مؤقت' : 'Recovery Day',
    chooseForToday: isArabic ? 'اختره لليوم' : 'Pick For Today',
    chosenForToday: isArabic ? 'تم اختياره لليوم' : 'Chosen For Today',
    missedBody: isArabic
      ? 'تم اعتبار هذا التمرين مجدولًا كمفقود ولن يُحسب ضمن حصص هذا الأسبوع المتبقية.'
      : 'This scheduled workout was marked as missed and no longer counts toward this week\'s remaining sessions.',
    recoveryBody: isArabic ? 'استرح ودع عضلاتك تتعافى' : 'Rest and let your muscles recover',
  };
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

  const programWorkouts = Array.isArray(userProgram?.workouts) ? userProgram.workouts : [];
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

  const workoutByDayName = new Map<string, { workout: any; index: number }>();
  programWorkouts.forEach((workout: any, index: number) => {
    const order = Number(workout?.day_order || index + 1);
    const fallbackDayName = fallbackWeekdays[((order - 1) % fallbackWeekdays.length + fallbackWeekdays.length) % fallbackWeekdays.length];
    const key = normalizeWorkoutDayKey(workout?.day_name || fallbackDayName);
    if (!key || workoutByDayName.has(key)) return;
    workoutByDayName.set(key, { workout, index });
  });

  const todayKey = formatDateKey(today);
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(today.getDate() - 10);
  const defaultStartKey = formatDateKey(defaultStartDate);
  const createdDate = normalizeDate(accountCreatedAt);
  const createdKey = createdDate ? formatDateKey(createdDate) : null;
  const startDate = createdKey && createdKey > defaultStartKey
    ? (createdKey > todayKey ? today : createdDate!)
    : defaultStartDate;

  const days: AgendaDay[] = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const weekdayKey = normalizeWorkoutDayKey(date.toLocaleDateString('en-US', { weekday: 'long' }));
    const dayWorkoutEntry = weekdayKey ? workoutByDayName.get(weekdayKey) : null;
    const dayWorkout = dayWorkoutEntry?.workout || null;
    const workoutKey = dayWorkout
      ? getWorkoutKey(dayWorkout, weekdayKey || '', dayWorkoutEntry?.index ?? i)
      : '';
    const label = dayWorkout
      ? getWorkoutLabel(dayWorkout.workout_name || dayWorkout.name || '')
      : restLabel;
    const exercises = dayWorkout ? parseWorkoutExercises(dayWorkout.exercises) : [];
    const dateKey = formatDateKey(date);
    const isRestDay = !dayWorkout;
    const isMissed = missedDateKeys.has(dateKey);
    const isCompleted = completedDateKeys.has(dateKey);
    const isPast = dateKey < todayKey;
    const isPickedForToday = !!(workoutKey && selectedWorkoutKey && workoutKey === selectedWorkoutKey);

    const isCurrentRecoveryDay = dateKey === todayKey && isCompleted && !selectedWorkoutKey;

    const status: AgendaDay['status'] = isMissed
      ? 'missed'
      : isCurrentRecoveryDay
        ? 'recovery'
        : isCompleted
          ? 'done'
      : isPickedForToday
          ? (isSelectedWorkoutCompleted ? 'done' : 'picked')
          : dateKey === todayKey
            ? 'active'
            : isPast
              ? 'past'
              : 'upcoming';

    return {
      day: isArabic
        ? (arDayLabels[weekdayKey || '']?.short || date.toLocaleDateString('ar-EG', { weekday: 'short' }))
        : formatWorkoutDayShortLabel(weekdayKey, date.toLocaleDateString('en-US', { weekday: 'short' })),
      dayLabel: isArabic
        ? (arDayLabels[weekdayKey || '']?.long || date.toLocaleDateString('ar-EG', { weekday: 'long' }))
        : formatWorkoutDayLabel(weekdayKey, date.toLocaleDateString('en-US', { weekday: 'long' })),
      date: date.getDate(),
      fullDate: date,
      label,
      exercises,
      workoutKey,
      status,
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

  return (
    <div className="space-y-3">
      <div className="flex items-end px-1">
        <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.15em]">{copy.weeklyAgenda}</h3>
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
            const isRestPreview = day.isRestDay && !isMissed && !isDone && !isPicked;

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
                  ) : isRecovery || isRestPreview ? (
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
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="surface-glass rounded-2xl p-6 max-w-sm w-full border border-white/15"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-3xl leading-none text-white">
                  {selectedDay.fullDate.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { month: 'long', day: 'numeric' })}
                </h3>
                <p className="text-xs uppercase tracking-[0.1em] text-text-secondary mt-2">
                  {isArabic ? selectedDay.dayLabel : (selectedDay.dayLabel || '').toUpperCase()}
                </p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-text-secondary hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 text-sm text-text-secondary">
              {selectedDay.label === restLabel || selectedDay.status === 'recovery'
                ? copy.recoveryDay
                : selectedDay.label}
            </div>

            {selectedDay.status === 'missed' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/12 border border-rose-500/30 flex items-center justify-center mb-4">
                  <CalendarX2 size={30} className="text-rose-300" />
                </div>
                <h4 className="text-3xl leading-none text-white mb-2">{copy.missedDay}</h4>
                <p className="text-sm text-text-secondary">
                  {copy.missedBody}
                </p>
              </div>
            ) : selectedDay.isPickedForToday ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-2 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <img
                      src={doneDayIcon}
                      alt="Done day"
                      className="h-10 w-10 object-contain"
                    />
                  </div>
                  <h4 className="text-3xl leading-none text-white mb-2">
                    {isSelectedWorkoutCompleted ? copy.completedForToday : copy.selectedForToday}
                  </h4>
                  <p className="text-sm text-text-secondary">
                    {copy.selectedBody}
                  </p>
                </div>

                {selectedDay.exercises.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.12em] mb-3">{copy.exercises}</h4>
                    {selectedDay.exercises.map((exercise, index) => {
                      const isDone = selectedDay.status === 'done';
                      return (
                        <div key={index} className="bg-background rounded-xl p-3 border border-white/10 flex items-center justify-between">
                          <span className="text-white text-sm">{stripExercisePrefix(exercise)}</span>
                          {isDone && (
                            <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
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
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/12 border border-accent/35 flex items-center justify-center mb-4">
                  <img
                    src={highWeightIcon}
                    alt="Recovery day"
                    className="h-10 w-10 object-contain"
                  />
                </div>
                <h4 className="text-3xl leading-none text-white mb-2">
                  {selectedDay.status === 'recovery' ? copy.pendingRecoveryDay : copy.recoveryDay}
                </h4>
                <p className="text-sm text-text-secondary">{copy.recoveryBody}</p>
              </div>
            ) : selectedDay.status !== 'done' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <img
                    src={doneDayIcon}
                    alt="Done day"
                    className="h-10 w-10 object-contain opacity-85"
                  />
                </div>
                <h4 className="text-3xl leading-none text-white mb-2">{copy.chooseFirstTitle}</h4>
                <p className="text-sm text-text-secondary">
                  {copy.chooseFirstBody}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.12em] mb-3">{copy.exercises}</h4>
                {selectedDay.exercises.map((exercise, index) => (
                  <div key={index} className="bg-background rounded-xl p-3 border border-white/10 flex items-center justify-between">
                    <span className="text-white text-sm">{stripExercisePrefix(exercise)}</span>
                    <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <Check size={14} className="text-black" strokeWidth={3} />
                    </div>
                  </div>
                ))}
              </div>
            )}

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
