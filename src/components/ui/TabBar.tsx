import React, { useEffect, useState } from 'react';
import { Home, Activity, Dumbbell, User, Film } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../../services/language';

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
  fr: {
    home: 'Accueil',
    workout: 'Mon Plan',
    blogs: 'Blogs',
    progress: 'Progres',
    profile: 'Profil',
  },
};

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');

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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div className="w-full pointer-events-auto">
        <div
          data-coachmark-target="nav_bar"
          className="relative overflow-hidden border-t border-[#f4d17f]/18 bg-[linear-gradient(180deg,rgba(9,9,11,0.985)_0%,rgba(4,4,6,0.99)_100%)] px-2.5 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.8rem)] shadow-[0_-18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        >
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#f4d17f]/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-center justify-between gap-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  layout
                  onClick={() => onTabChange(tab.id)}
                  whileTap={{ scale: 0.97 }}
                  data-coachmark-target={`nav_${tab.id}`}
                  aria-label={tab.label}
                  transition={{ layout: { type: 'spring', stiffness: 430, damping: 34, mass: 0.85 } }}
                  className={`relative flex h-[3.4rem] shrink-0 items-center justify-center overflow-hidden rounded-full ${
                    isActive ? 'px-4' : 'w-[3.4rem]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.82 }}
                      className="absolute inset-0 rounded-full border border-[#f8e4ae]/70 bg-[linear-gradient(180deg,rgba(255,239,198,0.98)_0%,rgba(246,201,91,0.98)_100%)] shadow-[0_10px_24px_rgba(242,192,73,0.24)]"
                    />
                  )}

                  <div className="relative z-10 flex items-center justify-center gap-2.5 whitespace-nowrap">
                    <Icon
                      size={19}
                      strokeWidth={isActive ? 2.25 : 1.9}
                      className={`transition-[color,transform] duration-300 ${
                        isActive ? 'text-[#1f1400]' : 'text-white/68'
                      }`}
                    />
                    <AnimatePresence initial={false}>
                      {isActive ? (
                        <motion.span
                          key={`${tab.id}-label`}
                          initial={{ opacity: 0, width: 0, x: -8 }}
                          animate={{ opacity: 1, width: 'auto', x: 0 }}
                          exit={{ opacity: 0, width: 0, x: -8 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="overflow-hidden text-[0.82rem] font-semibold tracking-[0.01em] text-[#1f1400]"
                        >
                          {tab.label}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
