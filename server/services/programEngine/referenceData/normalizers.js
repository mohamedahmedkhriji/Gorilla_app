const MULTI_VALUE_BRACKET_RE = /^\[(.*)\]$/;

export const normalizeReferenceString = (value, { maxLength = 5000 } = {}) => {
  const text = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

export const normalizeExerciseName = (value) => normalizeReferenceString(value, { maxLength: 200 });

export const normalizeMatchKey = (value) => normalizeReferenceString(value, { maxLength: 200 })
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const parseListField = (value) => {
  const text = normalizeReferenceString(value, { maxLength: 1000 });
  if (!text) return [];
  const bracketMatch = text.match(MULTI_VALUE_BRACKET_RE);
  const body = bracketMatch ? bracketMatch[1] : text;
  return body
    .split(',')
    .map((item) => item.replace(/^['"\s]+|['"\s]+$/g, '').trim())
    .filter(Boolean);
};

export const normalizeExternalGoal = (value) => {
  const labels = Array.isArray(value) ? value : parseListField(value);
  const keys = labels.map(normalizeMatchKey);

  if (keys.some((label) => label === 'powerlifting')) return 'powerlifting';
  if (keys.some((label) => label === 'bodybuilding' || label === 'muscle and sculpting')) return 'hypertrophy';
  if (keys.some((label) => label === 'fat loss' || label === 'weight loss')) return 'fat_loss';
  if (keys.some((label) => label === 'endurance' || label === 'cardio')) return 'endurance';
  if (keys.some((label) => label === 'cutting')) return 'cutting';
  if (keys.some((label) => label === 'bulking')) return 'bulking';
  return 'unknown';
};

export const normalizeExternalLevel = (value) => {
  const labels = Array.isArray(value) ? value : parseListField(value);
  const keys = labels.map(normalizeMatchKey);
  if (keys.includes('advanced')) return 'advanced';
  if (keys.includes('intermediate')) return 'intermediate';
  if (keys.includes('beginner') || keys.includes('novice')) return 'beginner';
  return 'unknown';
};

export const normalizeEquipment = (value) => {
  const key = normalizeMatchKey(value);
  if (!key) return 'unknown';
  if (key === 'full gym') return 'full_gym';
  if (key === 'garage gym') return 'garage_gym';
  if (key === 'at home' || key === 'home') return 'home';
  if (key === 'dumbbell only' || key === 'dumbbells only') return 'dumbbell_only';
  return 'unknown';
};

export const parsePositiveInteger = (value, { max = 10000 } = {}) => {
  const text = normalizeReferenceString(value, { maxLength: 50 });
  if (!/^\d+(\.0+)?$/.test(text)) return null;
  const number = Number.parseInt(text, 10);
  return number > 0 && number <= max ? number : null;
};

export const parsePositiveNumber = (value, { max = 10000 } = {}) => {
  const text = normalizeReferenceString(value, { maxLength: 50 });
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number.parseFloat(text);
  return number > 0 && number <= max ? number : null;
};

export const parseWeekNumber = (value) => {
  const text = normalizeReferenceString(value, { maxLength: 50 });
  const match = text.match(/(?:week\s*)?(\d+)/i);
  if (!match) return null;
  return parsePositiveInteger(match[1], { max: 104 });
};

export const parseDayNumber = (value) => {
  const text = normalizeReferenceString(value, { maxLength: 50 });
  const match = text.match(/(?:day\s*)?(\d+)/i);
  if (!match) return null;
  return parsePositiveInteger(match[1], { max: 14 });
};

export const parseSets = (value) => {
  const text = normalizeReferenceString(value, { maxLength: 50 });
  if (!text) return { type: 'unknown', raw: '' };
  const number = parsePositiveInteger(text, { max: 20 });
  if (number) return { type: 'fixed', value: number, raw: text };
  return { type: 'unknown', raw: text };
};

export const parseReps = (value) => {
  const text = normalizeReferenceString(value, { maxLength: 80 });
  if (!text) return { type: 'unknown', raw: '' };
  const lower = text.toLowerCase();
  if (['amrap', 'as many reps as possible'].includes(lower)) return { type: 'special', value: 'amrap', raw: text };
  if (['failure', 'to failure'].includes(lower)) return { type: 'special', value: 'failure', raw: text };

  const range = text.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) {
    const min = Number.parseInt(range[1], 10);
    const max = Number.parseInt(range[2], 10);
    if (min > 0 && max >= min && max <= 200) return { type: 'range', min, max, raw: text };
  }

  const fixed = parsePositiveInteger(text, { max: 200 });
  if (fixed) return { type: 'fixed', value: fixed, raw: text };
  return { type: 'unknown', raw: text };
};

export const parseIntensity = (value) => {
  const text = normalizeReferenceString(value, { maxLength: 120 });
  if (!text) return { type: 'unknown', raw: '' };
  const lower = text.toLowerCase();

  const percent = lower.match(/^(\d{1,3})(?:\.\d+)?\s*%$/);
  if (percent) {
    const number = Number.parseInt(percent[1], 10);
    if (number > 0 && number <= 100) return { type: 'percent', value: number, raw: text };
  }

  const rpe = lower.match(/^rpe\s*(\d(?:\.\d)?)$/);
  if (rpe) {
    const number = Number.parseFloat(rpe[1]);
    if (number > 0 && number <= 10) return { type: 'rpe', value: number, raw: text };
  }

  if (['bodyweight', 'bw'].includes(lower)) return { type: 'bodyweight', raw: text };
  return { type: 'unknown', raw: text };
};

export const inferDaysPerWeek = (title, description = '') => {
  const text = `${title ?? ''} ${description ?? ''}`;
  const match = text.match(/\b([1-7])\s*(?:day|days)[-\s]*(?:per\s*)?(?:week|weekly|program|split|workout)?\b/i);
  return match ? Number.parseInt(match[1], 10) : null;
};
