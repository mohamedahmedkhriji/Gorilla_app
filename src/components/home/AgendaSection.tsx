import React, { useState, useRef, useEffect } from 'react';
import { X, Bed, Check, CalendarX2 } from 'lucide-react';
import { formatWorkoutDayLabel, formatWorkoutDayShortLabel, normalizeWorkoutDayKey } from '../../services/workoutDayLabel';
import { emojiAgenda } from '../../services/emojiTheme';
import doneDayIcon from '../../../assets/emoji/done day.png';

export function AgendaSection({
  userProgram,
  accountCreatedAt,
}: {
  userProgram?: any;
  programProgress?: any;
  accountCreatedAt?: string | Date | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const today = new Date();
  const formatDateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const programWorkouts = Array.isArray(userProgram?.workouts) ? userProgram.workouts : [];
  const normalizeDate = (value: unknown) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };
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
    const n = Number(value);
    if (!Number.isFinite(n)) return 4;
    return Math.max(2, Math.min(6, Math.round(n)));
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
  const workoutByDayName = new Map<string, any>();
  programWorkouts.forEach((w: any, index: number) => {
    const order = Number(w?.day_order || index + 1);
    const fallbackDayName = fallbackWeekdays[((order - 1) % fallbackWeekdays.length + fallbackWeekdays.length) % fallbackWeekdays.length];
    const key = normalizeWorkoutDayKey(w?.day_name || fallbackDayName);
    if (!key) return;
    if (!workoutByDayName.has(key)) workoutByDayName.set(key, w);
  });

  const getWorkoutLabel = (workoutName: string) =>
    String(workoutName || '')
      .replace(/^Week\s+\d+\s*-\s*/i, '')
      .trim();

  const parseWorkoutExercises = (raw: any) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((e: any) => e.exerciseName || e.name).filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((e: any) => e.exerciseName || e.name).filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    return [];
  };
  
  // Generate 30 days starting from account creation (if recent), otherwise 10 days ago.
  const todayKey = formatDateKey(today);
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(today.getDate() - 10);
  const defaultStartKey = formatDateKey(defaultStartDate);
  const createdDate = normalizeDate(accountCreatedAt);
  const createdKey = createdDate ? formatDateKey(createdDate) : null;
  const startDate = createdKey && createdKey > defaultStartKey
    ? (createdKey > todayKey ? today : createdDate!)
    : defaultStartDate;

  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    // Get workout by exact backend day_name mapping.
    let label = 'Rest';
    let exercises: string[] = [];

    const weekdayKey = normalizeWorkoutDayKey(date.toLocaleDateString('en-US', { weekday: 'long' }));
    const dayWorkout = workoutByDayName.get(weekdayKey);
    if (dayWorkout) {
      label = getWorkoutLabel(dayWorkout.workout_name || dayWorkout.name || '');
      exercises = parseWorkoutExercises(dayWorkout.exercises);
    }
    
    const dateKey = formatDateKey(date);
    const isMissed = missedDateKeys.has(dateKey);
    const isCompleted = completedDateKeys.has(dateKey);
    const isPast = dateKey < todayKey;

    return {
      day: formatWorkoutDayShortLabel(weekdayKey, date.toLocaleDateString('en-US', { weekday: 'short' })),
      dayLabel: formatWorkoutDayLabel(weekdayKey, date.toLocaleDateString('en-US', { weekday: 'long' })),
      date: date.getDate(),
      fullDate: date,
      label,
      exercises,
      status: isMissed ? 'missed' : isCompleted ? 'done' : dateKey === todayKey ? 'active' : isPast ? 'past' : 'upcoming',
    };
  });

  // Scroll to current day on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayIndex = days.findIndex((d) => formatDateKey(d.fullDate) === todayKey);
      const targetIndex = todayIndex >= 0 ? todayIndex : 0;
      const currentDayElement = scrollRef.current.children[targetIndex] as HTMLElement;
      if (currentDayElement) {
        scrollRef.current.scrollLeft = currentDayElement.offsetLeft - (scrollRef.current.offsetWidth / 2) + (currentDayElement.offsetWidth / 2);
      }
    }
  }, [days, todayKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-end px-1">
        <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.15em]">Weekly Agenda</h3>
      </div>

      <div className="rounded-2xl surface-card border border-white/15 px-2 py-3 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url(${emojiAgenda})` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
          aria-hidden="true"
        />
        <div
          ref={scrollRef}
          className="relative z-10 flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {days.map((d, i) => {
            const isActive = d.status === 'active';
            const isDone = d.status === 'done';
            const isMissed = d.status === 'missed';

            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 min-w-[54px] cursor-pointer shrink-0"
                onClick={() => setSelectedDay(d)}>
                <div
                  className={`
                    relative w-11 h-12 rounded-[14px] flex items-center justify-center border transition-transform duration-200
                    ${
                      isActive
                        ? 'text-black border-accent/60 bg-[linear-gradient(135deg,rgb(var(--color-accent)),rgb(var(--color-info)))]'
                        : isMissed
                          ? 'bg-rose-500/15 text-rose-100 border-rose-500/30'
                        : isDone
                          ? 'bg-white/[0.08] text-white border-white/10'
                          : 'bg-card text-text-secondary border-white/10'
                    }
                    hover:-translate-y-0.5
                  `}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-1/2 -bottom-1.5 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px] border-r border-b border-white/10"
                      style={{ background: 'rgb(var(--color-accent))' }} />
                  )}
                  {isMissed ? (
                    <CalendarX2 size={16} className="relative z-10" />
                  ) : isDone ? (
                    <img
                      src={doneDayIcon}
                      alt="Done day"
                      className="relative z-10 h-6 w-6 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="relative z-10 text-sm font-bold leading-none">{d.date}</span>
                  )}
                </div>
                <div className={`text-[10px] font-medium leading-none ${isActive ? 'mt-1 text-text-primary' : 'text-text-tertiary'}`}>
                  {d.day}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={() => setSelectedDay(null)}>
          <div className="surface-glass rounded-2xl p-6 max-w-sm w-full border border-white/15" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-3xl leading-none text-white">
                  {selectedDay.fullDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </h3>
                <p className="text-xs uppercase tracking-[0.1em] text-text-secondary mt-2">
                  {(selectedDay.dayLabel || '').toUpperCase()}
                </p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-text-secondary hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 text-sm text-text-secondary">
              {selectedDay.label === 'Rest' ? 'Recovery Day' : selectedDay.label}
            </div>

            {selectedDay.status === 'missed' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/12 border border-rose-500/30 flex items-center justify-center mb-4">
                  <CalendarX2 size={30} className="text-rose-300" />
                </div>
                <h4 className="text-3xl leading-none text-white mb-2">Missed Day</h4>
                <p className="text-sm text-text-secondary">
                  This scheduled workout was marked as missed and no longer counts toward this week&apos;s remaining sessions.
                </p>
              </div>
            ) : selectedDay.label === 'Rest' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/12 border border-accent/35 flex items-center justify-center mb-4">
                  <Bed size={30} className="text-accent" />
                </div>
                <h4 className="text-3xl leading-none text-white mb-2">Recovery Day</h4>
                <p className="text-sm text-text-secondary">Rest and let your muscles recover</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.12em] mb-3">Exercises</h4>
                {selectedDay.exercises?.map((exercise: string, idx: number) => {
                  const isDone = selectedDay.status === 'done';
                  return (
                    <div key={idx} className="bg-background rounded-xl p-3 border border-white/10 flex items-center justify-between">
                      <span className="text-white text-sm">{exercise}</span>
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
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>);

}
