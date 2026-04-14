import { useEffect, useState } from 'react';
import { AppLanguage, getActiveLanguage } from '../services/language';

export const useAppLanguage = () => {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLanguage(getActiveLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);

    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  return {
    language,
    isArabic: language === 'ar',
  };
};
