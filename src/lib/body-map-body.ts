export type BodyMapBody = 'male' | 'female';

const BODY_MAP_BODY_PREFERENCE_KEY = 'bodyMapBodyPreference';
export const BODY_MAP_BODY_PREFERENCE_CHANGED_EVENT = 'repset:body-map-body-preference-changed';

const FEMALE_BODY_VALUES = [
  'female',
  'woman',
  'women',
  'girl',
  'femme',
  'donna',
  'frau',
  'أنثى',
  'انثى',
  'امرأة',
  'امراة',
] as const;

const MALE_BODY_VALUES = [
  'male',
  'man',
  'men',
  'boy',
  'homme',
  'uomo',
  'mann',
  'ذكر',
  'رجل',
] as const;

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function resolveBodyMapBody(value: unknown): BodyMapBody {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'f' || FEMALE_BODY_VALUES.some((gender) => normalized.includes(gender))) {
    return 'female';
  }

  if (
    normalized === 'm'
    || MALE_BODY_VALUES.some((gender) => new RegExp(`(^|[^a-z])${gender}([^a-z]|$)`).test(normalized))
  ) {
    return 'male';
  }

  return 'male';
}

export function getStoredBodyMapBodyPreference(): BodyMapBody | null {
  if (!hasWindow()) return null;

  const saved = window.localStorage.getItem(BODY_MAP_BODY_PREFERENCE_KEY);
  if (saved === 'male' || saved === 'female') return saved;
  return null;
}

export function resolvePreferredBodyMapBody(fallbackGender: unknown): BodyMapBody {
  return getStoredBodyMapBodyPreference() || resolveBodyMapBody(fallbackGender);
}

export function setStoredBodyMapBodyPreference(body: BodyMapBody) {
  if (!hasWindow()) return;

  window.localStorage.setItem(BODY_MAP_BODY_PREFERENCE_KEY, body);
  window.dispatchEvent(new CustomEvent(BODY_MAP_BODY_PREFERENCE_CHANGED_EVENT, { detail: { body } }));
}
