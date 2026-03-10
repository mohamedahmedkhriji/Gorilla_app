const DAY_LABELS: Record<string, { long: string; short: string }> = {
  monday: { long: 'Monday', short: 'Mon' },
  tuesday: { long: 'Tuesday', short: 'Tue' },
  wednesday: { long: 'Wednesday', short: 'Wed' },
  thursday: { long: 'Thursday', short: 'Thu' },
  friday: { long: 'Friday', short: 'Fri' },
  saturday: { long: 'Saturday', short: 'Sat' },
  sunday: { long: 'Sunday', short: 'Sun' },
};

const DAY_ALIASES: Record<string, keyof typeof DAY_LABELS> = {
  mon: 'monday',
  monday: 'monday',
  tue: 'tuesday',
  tues: 'tuesday',
  tuesday: 'tuesday',
  wed: 'wednesday',
  weds: 'wednesday',
  wednesday: 'wednesday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  thursday: 'thursday',
  fri: 'friday',
  friday: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
  sun: 'sunday',
  sunday: 'sunday',
};

export const normalizeWorkoutDayKey = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return DAY_ALIASES[normalized] || '';
};

export const formatWorkoutDayLabel = (value: unknown, fallback = '') => {
  const key = normalizeWorkoutDayKey(value);
  return key ? DAY_LABELS[key].long : fallback;
};

export const formatWorkoutDayShortLabel = (value: unknown, fallback = '') => {
  const key = normalizeWorkoutDayKey(value);
  return key ? DAY_LABELS[key].short : fallback;
};
