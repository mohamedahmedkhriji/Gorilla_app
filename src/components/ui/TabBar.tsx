import React, { useEffect, useState } from 'react';
import { Home, Activity, Dumbbell, User, Film } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { AppTheme, getActiveTheme, getStoredTheme } from '../../services/theme';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TAB_LABELS: LocalizedLanguageRecord<Record<string, string>> = {
  en: {
    home: 'Home',
    workout: 'My Plan',
    blogs: 'Blogs',
    progress: 'Progress',
    profile: 'Profile',
  },
  ar: {
    home: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
    workout: '\u062e\u0637\u062a\u064a',
    blogs: '\u0627\u0644\u0645\u062f\u0648\u0646\u0627\u062a',
    progress: '\u0627\u0644\u062a\u0642\u062f\u0645',
    profile: '\u0627\u0644\u0645\u0644\u0641',
  },
  it: {
    home: 'Home',
    workout: 'Il Mio Piano',
    blogs: 'Blog',
    progress: 'Progressi',
    profile: 'Profilo',
  },
  de: {
    home: 'Home',
    workout: 'Mein Plan',
    blogs: 'Blogs',
    progress: 'Fortschritt',
    profile: 'Profil',
  },
};

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [theme, setTheme] = useState<AppTheme>('dark');

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    setTheme(getActiveTheme());

    const handleThemeChanged = () => {
      setTheme(getStoredTheme());
    };

    window.addEventListener('app-theme-changed', handleThemeChanged);
    window.addEventListener('storage', handleThemeChanged);
    return () => {
      window.removeEventListener('app-theme-changed', handleThemeChanged);
      window.removeEventListener('storage', handleThemeChanged);
    };
  }, []);

  const labels = TAB_LABELS[language] || TAB_LABELS.en;

  const tabs = [
    {
      id: 'home',
      icon: Home,
      label: labels.home,
    },
    {
      id: 'workout',
      icon: Dumbbell,
      label: labels.workout,
    },
    {
      id: 'blogs',
      icon: Film,
      label: labels.blogs,
    },
    {
      id: 'progress',
      icon: Activity,
      label: labels.progress,
    },
    {
      id: 'profile',
      icon: User,
      label: labels.profile,
    },
  ];

  const shellClassName = theme === 'light'
    ? 'relative border-t border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(236,243,250,0.98)_100%)] px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.8rem)] shadow-[0_-10px_30px_rgba(23,36,55,0.12)] backdrop-blur-2xl'
    : 'relative border-t border-white/10 bg-[linear-gradient(180deg,rgba(12,20,44,0.92)_0%,rgba(9,15,35,0.98)_100%)] px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.8rem)] shadow-[0_-12px_40px_rgba(0,0,0,0.34)] backdrop-blur-2xl';

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div className="w-full pointer-events-auto">
        <div data-coachmark-target="nav_bar" className={shellClassName}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="grid grid-cols-5 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  whileTap={{ scale: 0.95 }}
                  data-coachmark-target={`nav_${tab.id}`}
                  aria-label={tab.label}
                  className="relative flex min-h-[4.2rem] flex-col items-center justify-center gap-1 rounded-2xl py-2"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                      className="absolute inset-0 rounded-2xl border border-white/10 bg-white/5"
                    />
                  )}

                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className={`relative transition-colors duration-300 ${isActive ? 'text-accent' : 'text-text-tertiary'}`}
                  />
                  <span
                    className={`relative text-[11px] font-medium transition-colors duration-300 ${
                      isActive ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                  >
                    {tab.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
