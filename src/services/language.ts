export type AppLanguage = 'en' | 'ar' | 'it' | 'de';

const LANGUAGE_STORAGE_KEY = 'appLanguagePreference';
const MOJIBAKE_MARKERS = /[ØÙÃÂ]/;
const UTF8_DECODER = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

const isValidLanguage = (value: unknown): value is AppLanguage =>
  value === 'en' || value === 'ar' || value === 'it' || value === 'de';

export const getLanguageLocale = (language: AppLanguage) => {
  if (language === 'ar') return 'ar-EG';
  if (language === 'it') return 'it-IT';
  if (language === 'de') return 'de-DE';
  return 'en-US';
};

export const isArabicLanguage = (language: AppLanguage) => language === 'ar';

export const repairMojibakeText = (value: string) => {
  if (!MOJIBAKE_MARKERS.test(value) || !UTF8_DECODER) return value;

  try {
    const bytes = Uint8Array.from(Array.from(value), (char) => char.charCodeAt(0) & 0xff);
    const repaired = UTF8_DECODER.decode(bytes);
    return repaired.includes('\ufffd') ? value : repaired;
  } catch {
    return value;
  }
};

export const normalizeLocalizedValue = <T>(value: T): T => {
  if (typeof value === 'string') {
    return repairMojibakeText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeLocalizedValue(entry)) as T;
  }

  if (typeof value === 'function') {
    return ((...args: unknown[]) => normalizeLocalizedValue((value as (...innerArgs: unknown[]) => unknown)(...args))) as T;
  }

  if (value && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      normalized[key] = normalizeLocalizedValue(entry);
    });
    return normalized as T;
  }

  return value;
};

export const pickLanguage = <T>(
  language: AppLanguage,
  values: { en: T; ar: T; it: T; de: T },
) => normalizeLocalizedValue(values[language] ?? values.en);

export const getStoredLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isValidLanguage(saved) ? saved : 'en';
};

export const getActiveLanguage = (): AppLanguage => {
  if (typeof document === 'undefined') return getStoredLanguage();
  const attr = document.documentElement.getAttribute('data-language');
  return isValidLanguage(attr) ? attr : getStoredLanguage();
};

export const applyLanguage = (language: AppLanguage, persist = true) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-language', language);
    document.documentElement.setAttribute('lang', language);
    // Keep layout order stable across languages; only text changes.
    document.documentElement.setAttribute('dir', 'ltr');
  }

  if (persist && typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app-language-changed', { detail: { language } }),
    );
  }
};

export const initializeLanguage = () => {
  const language = getStoredLanguage();
  applyLanguage(language, true);
};
