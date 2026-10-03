export type T3OverloadStatus = 'BASELINE' | 'ADD_REP' | 'ADD_LOAD' | 'HOLD' | 'REDUCE_LOAD';

export type T3OverloadAdvice = {
  status: T3OverloadStatus;
  title: string;
  body: string;
  detail: string;
};

type SetLike = {
  reps?: number;
  weight?: number;
  dateKey?: string;
  timestamp?: number;
};

export const parseRepRange = (value: unknown) => {
  const text = String(value || '').trim().toLowerCase();
  const range = text.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    return {
      repMin: Number(range[1] || 0),
      repMax: Number(range[2] || range[1] || 0),
    };
  }

  const single = text.match(/(\d+)/);
  const reps = Number(single?.[1] || 0);
  return reps > 0 ? { repMin: reps, repMax: reps } : { repMin: 8, repMax: 12 };
};

const latestSessionSets = (rows: SetLike[]) => {
  const completed = rows
    .filter((row) => Number(row?.reps || 0) > 0)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

  if (!completed.length) return [];

  const latestDateKey = completed[0]?.dateKey;
  const latestRows = latestDateKey
    ? completed.filter((row) => row.dateKey === latestDateKey)
    : completed;

  return latestRows.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
};

export const buildT3OverloadAdvice = ({
  historyRows,
  plannedReps,
}: {
  historyRows: SetLike[];
  plannedReps?: string | number | null;
}): T3OverloadAdvice => {
  const { repMin, repMax } = parseRepRange(plannedReps);
  const latestSets = latestSessionSets(historyRows);

  if (!latestSets.length) {
    return {
      status: 'BASELINE',
      title: 'T-3 baseline day',
      body: 'Log your real working weight and reps for each set today.',
      detail: 'Next time RepSet will compare this exercise against your saved baseline and tell you whether to add reps, add load, hold, or reduce load.',
    };
  }

  const reps = latestSets.map((set) => Number(set.reps || 0));
  const weights = latestSets.map((set) => Number(set.weight || 0)).filter((weight) => weight > 0);
  const topWeight = weights.length ? Math.max(...weights) : 0;
  const allAtOrAboveMax = reps.every((value) => value >= repMax);
  const allBelowMin = reps.every((value) => value < repMin);
  const anyBelowMin = reps.some((value) => value < repMin);
  const allInsideRange = reps.every((value) => value >= repMin && value <= repMax);
  const repText = reps.join(' / ');
  const loadText = topWeight > 0 ? `${topWeight} kg` : 'your saved load';

  if (allBelowMin) {
    return {
      status: 'REDUCE_LOAD',
      title: 'T-3 next move: reduce load',
      body: `Last time you were below ${repMin} reps on every set (${repText}).`,
      detail: `Lower ${loadText} slightly next session and rebuild clean reps inside ${repMin}-${repMax}.`,
    };
  }

  if (allAtOrAboveMax) {
    return {
      status: 'ADD_LOAD',
      title: 'T-3 next move: add load',
      body: `Last time all sets reached the top of the range (${repText}).`,
      detail: `Use the smallest practical increase from ${loadText}, then restart near the lower end of ${repMin}-${repMax}.`,
    };
  }

  if (allInsideRange && !anyBelowMin) {
    return {
      status: 'ADD_REP',
      title: 'T-3 next move: add reps',
      body: `Last time you were inside the target range (${repText}).`,
      detail: `Keep ${loadText} and try to add reps before increasing weight.`,
    };
  }

  return {
    status: 'HOLD',
    title: 'T-3 next move: hold',
    body: `Last time was mixed against the ${repMin}-${repMax} target (${repText}).`,
    detail: `Repeat ${loadText}, clean up execution, and earn the rep range before adding weight.`,
  };
};
