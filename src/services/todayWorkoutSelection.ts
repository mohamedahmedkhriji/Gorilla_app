export const TODAY_WORKOUT_SELECTION_UPDATED_EVENT = 'today-workout-selection-updated';

export type TodayWorkoutSelection = {
  dateKey: string;
  workoutKey: string;
  workoutName?: string;
  dayLabel?: string;
  completed: boolean;
  completedAt?: string | null;
};

const getTodayDateKey = () => new Date().toDateString();

const getTodayWorkoutSelectionStorageKey = (scope: string) =>
  `todayWorkoutSelection:${String(scope || 'guest').trim() || 'guest'}`;

const emitTodayWorkoutSelectionUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TODAY_WORKOUT_SELECTION_UPDATED_EVENT));
};

export const readTodayWorkoutSelection = (scope: string): TodayWorkoutSelection | null => {
  const storageKey = getTodayWorkoutSelectionStorageKey(scope);

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(storageKey);
      return null;
    }

    const dateKey = String(parsed.dateKey || '').trim();
    const workoutKey = String(parsed.workoutKey || '').trim();
    if (!dateKey || !workoutKey || dateKey !== getTodayDateKey()) {
      localStorage.removeItem(storageKey);
      return null;
    }

    return {
      dateKey,
      workoutKey,
      workoutName: String(parsed.workoutName || '').trim() || undefined,
      dayLabel: String(parsed.dayLabel || '').trim() || undefined,
      completed: Boolean(parsed.completed),
      completedAt: parsed.completedAt ? String(parsed.completedAt) : null,
    };
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
};

export const saveTodayWorkoutSelection = (
  scope: string,
  selection: Omit<TodayWorkoutSelection, 'dateKey'>,
) => {
  const storageKey = getTodayWorkoutSelectionStorageKey(scope);
  const payload: TodayWorkoutSelection = {
    dateKey: getTodayDateKey(),
    workoutKey: String(selection.workoutKey || '').trim(),
    workoutName: String(selection.workoutName || '').trim() || undefined,
    dayLabel: String(selection.dayLabel || '').trim() || undefined,
    completed: Boolean(selection.completed),
    completedAt: selection.completedAt ? String(selection.completedAt) : null,
  };

  if (!payload.workoutKey) {
    localStorage.removeItem(storageKey);
    emitTodayWorkoutSelectionUpdated();
    return null;
  }

  localStorage.setItem(storageKey, JSON.stringify(payload));
  emitTodayWorkoutSelectionUpdated();
  return payload;
};

export const markTodayWorkoutSelectionCompleted = (scope: string, completed: boolean) => {
  const current = readTodayWorkoutSelection(scope);
  if (!current) return null;

  const next: TodayWorkoutSelection = {
    ...current,
    completed,
    completedAt: completed ? new Date().toISOString() : null,
  };

  localStorage.setItem(getTodayWorkoutSelectionStorageKey(scope), JSON.stringify(next));
  emitTodayWorkoutSelectionUpdated();
  return next;
};

export const clearTodayWorkoutSelection = (scope: string) => {
  localStorage.removeItem(getTodayWorkoutSelectionStorageKey(scope));
  emitTodayWorkoutSelectionUpdated();
};

