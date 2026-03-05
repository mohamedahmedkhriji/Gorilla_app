import React, { useState, useRef, useEffect } from 'react';
import { X, Bed, Check } from 'lucide-react';

export function AgendaSection({ userProgram }: { userProgram?: any }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const today = new Date();

  const programWorkouts = Array.isArray(userProgram?.workouts) ? userProgram.workouts : [];
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
    const key = String(w?.day_name || fallbackDayName).toLowerCase();
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
  
  // Generate 30 days: 10 past + today + 19 future
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + (i - 10)); // Start 10 days ago

    // Get workout by exact backend day_name mapping.
    let label = 'Rest';
    let exercises: string[] = [];

    const weekdayKey = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayWorkout = workoutByDayName.get(weekdayKey);
    if (dayWorkout) {
      label = getWorkoutLabel(dayWorkout.workout_name || dayWorkout.name || '');
      exercises = parseWorkoutExercises(dayWorkout.exercises);
    }
    
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.getDate(),
      fullDate: date,
      label,
      exercises,
      status: i < 10 ? 'done' : i === 10 ? 'active' : 'upcoming',
    };
  });

  // Calculate sessions left this week
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay());
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
  
  const sessionsLeftThisWeek = days.filter(d => {
    const isThisWeek = d.fullDate >= currentWeekStart && d.fullDate <= currentWeekEnd;
    const isWorkout = d.label !== 'Rest';
    const isUpcoming = d.status === 'active' || d.status === 'upcoming';
    return isThisWeek && isWorkout && isUpcoming;
  }).length;

  // Scroll to current day on mount
  useEffect(() => {
    if (scrollRef.current) {
      const currentDayElement = scrollRef.current.children[10] as HTMLElement;
      if (currentDayElement) {
        scrollRef.current.scrollLeft = currentDayElement.offsetLeft - (scrollRef.current.offsetWidth / 2) + (currentDayElement.offsetWidth / 2);
      }
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end px-1">
        <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.15em]">Weekly Agenda</h3>
        <span className="text-[11px] text-accent font-semibold uppercase tracking-[0.1em]">{sessionsLeftThisWeek} Sessions Left</span>
      </div>

      <div className="rounded-2xl surface-card border border-white/15 px-2 py-3">
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {days.map((d, i) => {
            const isActive = d.status === 'active';
            const isDone = d.status === 'done';

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
                  <span className="relative z-10 text-sm font-bold leading-none">{d.date}</span>
                </div>
                <div className={`text-[10px] font-medium leading-none ${isActive ? 'mt-1 text-text-primary' : 'text-text-tertiary'}`}>
                  {d.day}
                </div>
                {d.label !== 'Rest' && (
                  <span
                    className={`text-[8px] font-medium uppercase truncate w-full text-center ${isActive ? 'text-text-primary' : 'text-text-tertiary'}`}>
                    {d.label}
                  </span>
                )}
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
                <p className="text-xs uppercase tracking-[0.1em] text-text-secondary mt-2">{selectedDay.label} Day</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-text-secondary hover:text-white">
                <X size={20} />
              </button>
            </div>

            {selectedDay.label === 'Rest' ? (
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
