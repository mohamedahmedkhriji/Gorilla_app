export type AppTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'appThemePreference';
const THEME_ATTRIBUTE = 'data-theme';

const isValidTheme = (value: unknown): value is AppTheme =>
  value === 'dark' || value === 'light';

export const getStoredTheme = (): AppTheme => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return isValidTheme(saved) ? saved : 'dark';
};

export const getActiveTheme = (): AppTheme => {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isValidTheme(attr) ? attr : getStoredTheme();
};

export const applyTheme = (theme: AppTheme, persist = true) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);

  if (persist && typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: { theme } }));
  }
};

export const initializeTheme = () => {
  const theme = getStoredTheme();
  applyTheme(theme, true);
  return theme;
};

