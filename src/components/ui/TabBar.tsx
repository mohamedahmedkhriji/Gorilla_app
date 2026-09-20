import { useEffect, useMemo, useRef, useState } from 'react';
import { Home, Activity, Dumbbell, User, MessageCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../../services/language';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TAB_LABELS: LocalizedLanguageRecord<Record<string, string>> = {
  en: {
    home: 'Home',
    workout: 'My Plan',
    blogs: 'Community',
    progress: 'Progress',
    profile: 'Profile',
  },
  ar: {
    home: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
    workout: '\u062e\u0637\u062a\u064a',
    blogs: '\u0627\u0644\u0645\u062c\u062a\u0645\u0639',
    progress: '\u0627\u0644\u062a\u0642\u062f\u0645',
    profile: '\u0627\u0644\u0645\u0644\u0641',
  },
  it: {
    home: 'Home',
    workout: 'Il Mio Piano',
    blogs: 'Community',
    progress: 'Progressi',
    profile: 'Profilo',
  },
  de: {
    home: 'Home',
    workout: 'Mein Plan',
    blogs: 'Community',
    progress: 'Fortschritt',
    profile: 'Profil',
  },
  fr: {
    home: 'Accueil',
    workout: 'Mon Plan',
    blogs: 'Communaute',
    progress: 'Progres',
    profile: 'Profil',
  },
};

const readAppStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const isGirlsStyle = (value: string) => value === 'woman' || value === 'female' || value === 'f' || value === 'girls' || value === 'femme';

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [appStyleGender, setAppStyleGender] = useState('');
  const [rowWidth, setRowWidth] = useState(0);
  const [isIndicatorMoving, setIsIndicatorMoving] = useState(false);
  const [movementDirection, setMovementDirection] = useState<1 | -1>(1);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const previousActiveIndexRef = useRef(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setLanguage(getActiveLanguage());
    setAppStyleGender(readAppStyleGender());

    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };
    const handleStyleChanged = () => {
      setAppStyleGender(readAppStyleGender());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('repset:app-style-gender-changed', handleStyleChanged);
    window.addEventListener('storage', handleLanguageChanged);
    window.addEventListener('storage', handleStyleChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('repset:app-style-gender-changed', handleStyleChanged);
      window.removeEventListener('storage', handleLanguageChanged);
      window.removeEventListener('storage', handleStyleChanged);
    };
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;

    const updateRowWidth = () => setRowWidth(row.getBoundingClientRect().width);
    updateRowWidth();

    const resizeObserver = new ResizeObserver(updateRowWidth);
    resizeObserver.observe(row);
    window.addEventListener('resize', updateRowWidth);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateRowWidth);
    };
  }, []);

  const labels = TAB_LABELS[language] || TAB_LABELS.en;

  const tabs: Array<{
    id: string;
    icon: typeof Home;
    label: string;
    badgeCount?: number;
  }> = useMemo(() => [
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
      icon: MessageCircle,
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
  ], [labels]);

  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
  const tabGap = 4;
  const tabWidth = rowWidth > 0 ? (rowWidth - tabGap * (tabs.length - 1)) / tabs.length : 0;
  const indicatorOverflow = 4;
  const indicatorWidth = Math.max(0, tabWidth + indicatorOverflow * 2);
  const indicatorX = activeIndex * (tabWidth + tabGap) - indicatorOverflow;
  const isGirlsTheme = isGirlsStyle(appStyleGender);

  useEffect(() => {
    const previousActiveIndex = previousActiveIndexRef.current;
    setMovementDirection(activeIndex >= previousActiveIndex ? 1 : -1);
    previousActiveIndexRef.current = activeIndex;

    if (shouldReduceMotion) return undefined;

    setIsIndicatorMoving(true);
    const settleTimer = window.setTimeout(() => setIsIndicatorMoving(false), 220);
    return () => window.clearTimeout(settleTimer);
  }, [activeIndex, shouldReduceMotion]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div className="w-full pointer-events-auto">
        <div
          data-coachmark-target="nav_bar"
          className={isGirlsTheme
            ? "relative mx-2.5 mb-2 overflow-hidden rounded-[30px] border border-[#E2B4BD]/55 bg-[rgba(255,245,245,0.76)] px-1.5 py-1.5 shadow-[0_10px_34px_rgba(226,180,189,0.24)] backdrop-blur-[14px] backdrop-saturate-[145%] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/75 before:via-[#FFF5F5]/35 before:to-transparent before:content-[''] min-[390px]:mx-3.5 min-[390px]:rounded-[32px]"
            : "relative mx-2.5 mb-2 overflow-hidden rounded-[30px] border border-white/10 bg-[rgba(20,20,20,0.38)] px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-[14px] backdrop-saturate-[145%] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/[0.10] before:via-white/[0.02] before:to-transparent before:content-[''] min-[390px]:mx-3.5 min-[390px]:rounded-[32px]"}
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.375rem)',
            WebkitBackdropFilter: 'blur(14px) saturate(145%)',
            backdropFilter: 'blur(14px) saturate(145%)',
          }}
        >
          <div ref={rowRef} className="relative mx-auto flex w-full max-w-3xl items-center justify-between gap-1">
            {indicatorWidth > 0 ? (
              <motion.div
                layoutId="bottom-nav-glass-indicator"
                className={isGirlsTheme
                  ? "pointer-events-none absolute bottom-[-3px] top-[-3px] z-0 overflow-hidden rounded-[30px] border border-[#F9B2D7]/45 bg-[#FFF5F5]/60 shadow-[0_8px_24px_rgba(226,180,189,0.22),inset_0_1px_0_rgba(255,255,255,0.80),inset_0_-1px_0_rgba(226,180,189,0.18)] backdrop-blur-[8px] backdrop-brightness-[1.08] backdrop-saturate-[165%] before:pointer-events-none before:absolute before:inset-[1px] before:rounded-[inherit] before:bg-gradient-to-br before:from-white/70 before:via-[#CFECF3]/20 before:to-transparent before:content-['']"
                  : "pointer-events-none absolute bottom-[-3px] top-[-3px] z-0 overflow-hidden rounded-[30px] border border-white/[0.18] bg-white/[0.035] shadow-[0_8px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(255,255,255,0.05)] backdrop-blur-[8px] backdrop-brightness-[1.08] backdrop-saturate-[165%] before:pointer-events-none before:absolute before:inset-[1px] before:rounded-[inherit] before:bg-gradient-to-br before:from-white/[0.14] before:via-white/[0.025] before:to-transparent before:content-['']"}
                animate={{
                  x: indicatorX,
                  scaleX: isIndicatorMoving && !shouldReduceMotion ? 1.1 : 1,
                  scaleY: isIndicatorMoving && !shouldReduceMotion ? 0.985 : 1,
                }}
                initial={false}
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 30, mass: 0.65 }}
                style={{
                  width: indicatorWidth,
                  transformOrigin: movementDirection > 0 ? 'left center' : 'right center',
                  WebkitBackdropFilter: 'blur(8px) saturate(165%) brightness(1.08)',
                  backdropFilter: 'blur(8px) saturate(165%) brightness(1.08)',
                }}
              >
                <div
                  className="pointer-events-none absolute inset-[-1px] rounded-[inherit] opacity-40"
                  style={{
                    background: isGirlsTheme
                      ? 'conic-gradient(from 145deg, rgba(249,178,215,0.34), rgba(255,255,255,0.34), rgba(207,236,243,0.34), rgba(226,180,189,0.24), rgba(249,178,215,0.32))'
                      : 'conic-gradient(from 145deg, rgba(82,236,255,0.25), rgba(255,255,255,0.10), rgba(255,217,77,0.18), rgba(255,92,214,0.14), rgba(82,236,255,0.22))',
                    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    padding: 1,
                  }}
                />
              </motion.div>
            ) : null}
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badgeLabel = typeof tab.badgeCount === 'number' && tab.badgeCount > 9
                ? '9+'
                : tab.badgeCount;

              return (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  whileTap={{ scale: 0.97 }}
                  data-coachmark-target={`nav_${tab.id}`}
                  aria-label={tab.label}
                  tabIndex={0}
                  className="relative z-10 flex h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] overflow-hidden rounded-[24px] px-0.5"
                >
                  <div className="relative z-10 flex items-center justify-center">
                    <Icon
                      size={21}
                      strokeWidth={isActive ? 2.2 : 1.9}
                      className={`transition-[color,transform] duration-300 ${
                        isActive
                          ? isGirlsTheme ? 'scale-[1.05] text-[#E2B4BD]' : 'scale-[1.05] text-accent'
                          : isGirlsTheme ? 'scale-100 text-[#795E67]/70' : 'scale-100 text-white/60'
                      }`}
                    />
                    {tab.badgeCount ? (
                      <span className={`absolute -right-2 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${isGirlsTheme ? 'bg-[#E2B4BD] text-[#4A4A4A]' : 'bg-accent text-black'}`}>
                        {badgeLabel}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`relative z-10 max-w-full whitespace-nowrap text-[9px] font-semibold leading-none transition-colors duration-200 min-[370px]:text-[10px] min-[430px]:text-[11px] ${
                      isActive
                        ? isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'
                        : isGirlsTheme ? 'text-[#795E67]/70' : 'text-white/50'
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
