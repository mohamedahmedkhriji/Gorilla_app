export type GrowthRange = 'week' | 'month' | 'year';

export type AdminOverviewUserRecord = {
  joined_at?: string | null;
};

export type UserGrowthPoint = {
  label: string;
  users: number;
};

export type UserGrowthMetrics = {
  points: UserGrowthPoint[];
  growthThisPeriod: number;
  growthRate: number;
  avgDailySignups: number;
};

export type UserGrowthChartScale = {
  getY: (value: number, chartBottom: number, chartHeight: number) => number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const startOfMonth = (date: Date) => {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfMonth = (date: Date) => {
  const next = startOfMonth(addMonths(date, 1));
  next.setMilliseconds(-1);
  return next;
};

const getRangeStart = (range: GrowthRange, now: Date) => {
  const today = startOfDay(now);

  if (range === 'week') {
    return addDays(today, -6);
  }

  if (range === 'month') {
    return addDays(today, -29);
  }

  return startOfMonth(addMonths(today, -11));
};

const getRangeDayCount = (range: GrowthRange, rangeStart: Date, rangeEnd: Date) => {
  if (range === 'week') return 7;
  if (range === 'month') return 30;
  return Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS) + 1);
};

const getCheckpoints = (range: GrowthRange, now: Date) => {
  if (range === 'week') {
    const rangeStart = getRangeStart(range, now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = endOfDay(addDays(rangeStart, index));
      return {
        date,
        label: weekdayFormatter.format(date),
      };
    });
  }

  if (range === 'month') {
    const rangeStart = getRangeStart(range, now);
    const offsets = [0, 6, 12, 18, 24, 29];
    return offsets.map((offset) => {
      const date = endOfDay(addDays(rangeStart, offset));
      return {
        date,
        label: shortDateFormatter.format(date),
      };
    });
  }

  const currentMonth = startOfMonth(now);
  return Array.from({ length: 12 }, (_, index) => {
    const date = endOfMonth(addMonths(currentMonth, -11 + index));
    return {
      date,
      label: monthFormatter.format(date),
    };
  });
};

const toJoinedTimestamps = (users: AdminOverviewUserRecord[]) => {
  return users
    .map((user) => {
      const rawValue = typeof user?.joined_at === 'string' ? user.joined_at : null;
      if (!rawValue) return null;

      const timestamp = new Date(rawValue).getTime();
      if (Number.isNaN(timestamp)) return null;

      return timestamp;
    })
    .filter((timestamp): timestamp is number => typeof timestamp === 'number')
    .sort((left, right) => left - right);
};

export const buildUserGrowthMetrics = (
  users: AdminOverviewUserRecord[],
  range: GrowthRange,
): UserGrowthMetrics => {
  const now = new Date();
  const rangeStart = getRangeStart(range, now);
  const rangeEnd = endOfDay(now);
  const checkpoints = getCheckpoints(range, now);
  const joinedTimestamps = toJoinedTimestamps(users);

  let pointer = 0;
  const points = checkpoints.map(({ date, label }) => {
    const checkpointTime = date.getTime();
    while (pointer < joinedTimestamps.length && joinedTimestamps[pointer] <= checkpointTime) {
      pointer += 1;
    }

    return {
      label,
      users: pointer,
    };
  });

  const rangeStartTime = rangeStart.getTime();
  const rangeEndTime = rangeEnd.getTime();

  const growthThisPeriod = joinedTimestamps.filter(
    (timestamp) => timestamp >= rangeStartTime && timestamp <= rangeEndTime,
  ).length;

  const baselineUsers = joinedTimestamps.filter((timestamp) => timestamp < rangeStartTime).length;
  const growthRate = baselineUsers > 0
    ? (growthThisPeriod / baselineUsers) * 100
    : growthThisPeriod > 0
      ? 100
      : 0;

  const avgDailySignups = growthThisPeriod / getRangeDayCount(range, rangeStart, rangeEnd);

  return {
    points,
    growthThisPeriod,
    growthRate,
    avgDailySignups,
  };
};

export const createUserGrowthChartScale = (points: UserGrowthPoint[]): UserGrowthChartScale => {
  const values = points.map((point) => point.users);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const spread = maxValue - minValue;
  const padding = spread > 0
    ? Math.max(1, Math.ceil(spread * 0.2))
    : Math.max(1, Math.ceil(Math.max(1, maxValue) * 0.1));
  const scaledMin = Math.max(0, minValue - padding);
  const scaledMax = maxValue + padding;
  const denominator = Math.max(1, scaledMax - scaledMin);

  return {
    getY: (value: number, chartBottom: number, chartHeight: number) => {
      return chartBottom - ((value - scaledMin) / denominator) * chartHeight;
    },
  };
};
