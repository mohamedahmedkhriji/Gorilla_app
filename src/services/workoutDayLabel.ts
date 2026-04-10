import { AppLanguage } from './language';

const DAY_LABELS: Record<string, { long: string; short: string }> = {
  monday: { long: 'Monday', short: 'Mon' },
  tuesday: { long: 'Tuesday', short: 'Tue' },
  wednesday: { long: 'Wednesday', short: 'Wed' },
  thursday: { long: 'Thursday', short: 'Thu' },
  friday: { long: 'Friday', short: 'Fri' },
  saturday: { long: 'Saturday', short: 'Sat' },
  sunday: { long: 'Sunday', short: 'Sun' },
};

const ARABIC_DAY_LABELS: Record<string, { long: string; short: string }> = {
  monday: { long: '\u0627\u0644\u0627\u062b\u0646\u064a\u0646', short: '\u0627\u062b\u0646' },
  tuesday: { long: '\u0627\u0644\u062b\u0644\u0627\u062b\u0627\u0621', short: '\u062b\u0644\u0627' },
  wednesday: { long: '\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621', short: '\u0623\u0631\u0628' },
  thursday: { long: '\u0627\u0644\u062e\u0645\u064a\u0633', short: '\u062e\u0645\u064a' },
  friday: { long: '\u0627\u0644\u062c\u0645\u0639\u0629', short: '\u062c\u0645\u0639' },
  saturday: { long: '\u0627\u0644\u0633\u0628\u062a', short: '\u0633\u0628\u062a' },
  sunday: { long: '\u0627\u0644\u0623\u062d\u062f', short: '\u0623\u062d\u062f' },
};

const ITALIAN_DAY_LABELS: Record<string, { long: string; short: string }> = {
  monday: { long: 'Lunedi', short: 'Lun' },
  tuesday: { long: 'Martedi', short: 'Mar' },
  wednesday: { long: 'Mercoledi', short: 'Mer' },
  thursday: { long: 'Giovedi', short: 'Gio' },
  friday: { long: 'Venerdi', short: 'Ven' },
  saturday: { long: 'Sabato', short: 'Sab' },
  sunday: { long: 'Domenica', short: 'Dom' },
};

const GERMAN_DAY_LABELS: Record<string, { long: string; short: string }> = {
  monday: { long: 'Montag', short: 'Mo' },
  tuesday: { long: 'Dienstag', short: 'Di' },
  wednesday: { long: 'Mittwoch', short: 'Mi' },
  thursday: { long: 'Donnerstag', short: 'Do' },
  friday: { long: 'Freitag', short: 'Fr' },
  saturday: { long: 'Samstag', short: 'Sa' },
  sunday: { long: 'Sonntag', short: 'So' },
};

const FRENCH_DAY_LABELS: Record<string, { long: string; short: string }> = {
  monday: { long: 'Lundi', short: 'Lun' },
  tuesday: { long: 'Mardi', short: 'Mar' },
  wednesday: { long: 'Mercredi', short: 'Mer' },
  thursday: { long: 'Jeudi', short: 'Jeu' },
  friday: { long: 'Vendredi', short: 'Ven' },
  saturday: { long: 'Samedi', short: 'Sam' },
  sunday: { long: 'Dimanche', short: 'Dim' },
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

const getDayLabels = (language: AppLanguage) => {
  if (language === 'ar') return ARABIC_DAY_LABELS;
  if (language === 'it') return ITALIAN_DAY_LABELS;
  if (language === 'de') return GERMAN_DAY_LABELS;
  if (language === 'fr') return FRENCH_DAY_LABELS;
  return DAY_LABELS;
};

export const formatWorkoutDayLabel = (value: unknown, fallback = '', language: AppLanguage = 'en') => {
  const key = normalizeWorkoutDayKey(value);
  return key ? getDayLabels(language)[key].long : fallback;
};

export const formatWorkoutDayShortLabel = (value: unknown, fallback = '', language: AppLanguage = 'en') => {
  const key = normalizeWorkoutDayKey(value);
  return key ? getDayLabels(language)[key].short : fallback;
};
