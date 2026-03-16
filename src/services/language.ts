export type AppLanguage = 'en' | 'ar';

const LANGUAGE_STORAGE_KEY = 'appLanguagePreference';

const isValidLanguage = (value: unknown): value is AppLanguage =>
  value === 'en' || value === 'ar';

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
