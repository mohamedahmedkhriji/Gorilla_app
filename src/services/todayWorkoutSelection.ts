export const TODAY_WORKOUT_SELECTION_UPDATED_EVENT = 'today-workout-selection-updated';

export type TodayWorkoutSelection = {
  dateKey: string;
  workoutKey: string;
  workoutName?: string;
  dayLabel?: string;
  completed: boolean;
  completedAt?: string | null;
};

export type WorkoutAssignmentHistoryEntry = {
  dateKey: string;
  workoutKey: string;
  workoutName?: string;
  dayLabel?: string;
  completed: boolean;
  completedAt?: string | null;
};

const getTodayDateKey = () => new Date().toDateString();
const getTodayAgendaDateKey = () => {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayWorkoutSelectionStorageKey = (scope: string) =>
  `todayWorkoutSelection:${String(scope || 'guest').trim() || 'guest'}`;

const getWorkoutAssignmentHistoryStorageKey = (scope: string) =>
  `todayWorkoutSelectionHistory:${String(scope || 'guest').trim() || 'guest'}`;

const emitTodayWorkoutSelectionUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TODAY_WORKOUT_SELECTION_UPDATED_EVENT));
};

const normalizeWorkoutAssignmentHistoryEntry = (value: any): WorkoutAssignmentHistoryEntry | null => {
  if (!value || typeof value !== 'object') return null;

  const dateKey = String(value.dateKey || '').trim();
  const workoutKey = String(value.workoutKey || '').trim();
  if (!dateKey || !workoutKey) return null;

  return {
    dateKey,
    workoutKey,
    workoutName: String(value.workoutName || '').trim() || undefined,
    dayLabel: String(value.dayLabel || '').trim() || undefined,
    completed: Boolean(value.completed),
    completedAt: value.completedAt ? String(value.completedAt) : null,
  };
};

const writeWorkoutAssignmentHistory = (scope: string, entries: WorkoutAssignmentHistoryEntry[]) => {
  const storageKey = getWorkoutAssignmentHistoryStorageKey(scope);
  const normalized = [...entries]
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .slice(-90);
  localStorage.setItem(storageKey, JSON.stringify(normalized));
};

const upsertWorkoutAssignmentHistoryEntry = (scope: string, entry: WorkoutAssignmentHistoryEntry) => {
  const existingEntries = readWorkoutAssignmentHistory(scope);
  const nextEntries = [
    ...existingEntries.filter((item) => item.dateKey !== entry.dateKey),
    entry,
  ];
  writeWorkoutAssignmentHistory(scope, nextEntries);
  return entry;
};

export const readWorkoutAssignmentHistory = (scope: string): WorkoutAssignmentHistoryEntry[] => {
  const storageKey = getWorkoutAssignmentHistoryStorageKey(scope);

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(storageKey);
      return [];
    }

    const normalized = parsed
      .map(normalizeWorkoutAssignmentHistoryEntry)
      .filter(Boolean) as WorkoutAssignmentHistoryEntry[];

    if (normalized.length !== parsed.length) {
      writeWorkoutAssignmentHistory(scope, normalized);
    }

    return normalized;
  } catch {
    localStorage.removeItem(storageKey);
    return [];
  }
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
  upsertWorkoutAssignmentHistoryEntry(scope, {
    dateKey: getTodayAgendaDateKey(),
    workoutKey: payload.workoutKey,
    workoutName: payload.workoutName,
    dayLabel: payload.dayLabel,
    completed: payload.completed,
    completedAt: payload.completedAt,
  });
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
  upsertWorkoutAssignmentHistoryEntry(scope, {
    dateKey: getTodayAgendaDateKey(),
    workoutKey: next.workoutKey,
    workoutName: next.workoutName,
    dayLabel: next.dayLabel,
    completed: next.completed,
    completedAt: next.completedAt,
  });
  emitTodayWorkoutSelectionUpdated();
  return next;
};

export const clearTodayWorkoutSelection = (scope: string) => {
  localStorage.removeItem(getTodayWorkoutSelectionStorageKey(scope));
  emitTodayWorkoutSelectionUpdated();
};
