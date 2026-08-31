import React, { useEffect, useRef, useState } from 'react';

import { AppLanguage, getActiveLanguage, getStoredLanguage, pickLanguage } from '../services/language';

interface PublicLandingPageProps {
  onGetStarted: () => void;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const forcedDarkThemeVars: React.CSSProperties = {
  '--color-accent': '187 255 92',
  '--color-accent-dark': '187 255 92',
  '--color-background': '16 24 36',
  '--color-background-secondary': '16 24 36',
  '--color-card': '20 32 46',
  '--color-border': '134 161 189',
  '--color-text-primary': '243 248 255',
  '--color-text-secondary': '175 192 213',
  '--color-text-tertiary': '131 149 171',
} as React.CSSProperties;

const logoModules = import.meta.glob('../../assets/gym_logo/*.{jpg,jpeg,png,webp,avif,gif,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const logos = Object.entries(logoModules)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([, src]) => src);
const repeatedLogos = [...logos, ...logos];

const marqueeEdgeFade: React.CSSProperties = {
  WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
  maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
};

const renderLogoStrip = (
  direction: 'forward' | 'backward',
  duration: number,
  altText: string,
) => (
  <div className="overflow-hidden py-1" style={marqueeEdgeFade}>
    <div
      className={`flex w-max items-center gap-10 will-change-transform ${direction === 'forward' ? 'animate-logo-marquee' : 'animate-logo-marquee-reverse'}`}
      style={{ animationDuration: `${duration}s` }}
    >
      {repeatedLogos.map((logo, index) => (
        <div key={`${direction}-${duration}-${index}`} className="flex h-[72px] w-[104px] shrink-0 items-center justify-center">
          <img src={logo} alt={altText} className="max-h-[72px] max-w-[104px] object-contain opacity-90 drop-shadow-[0_12px_28px_rgb(0_0_0_/_0.28)]" loading="lazy" />
        </div>
      ))}
    </div>
  </div>
);

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onGetStarted }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [isStartPressed, setIsStartPressed] = useState(false);
  const startTimerRef = useRef<number | null>(null);

  const copy = pickLanguage(language, {
    en: {
      titleAccent: 'Smart',
      titleLine1: 'Training,',
      titleLine2: 'Built Around',
      titleYou: 'You',
      body: 'RepSet builds each workout from your goals, recovery, and schedule so you always know your next best session.',
      logoAlt: 'Gym partner logo',
      install: 'Install on your phone',
      start: 'Start Now',
      footer: 'Join RepSet to get adaptive workouts that fit your goals.',
    },
    ar: {
      titleAccent: '\u0630\u0643\u064a',
      titleLine1: '\u062a\u062f\u0631\u064a\u0628',
      titleLine2: '\u0645\u0628\u0646\u064a \u062d\u0648\u0644',
      titleYou: '\u0623\u0646\u062a',
      body: '\u064a\u0628\u0646\u064a RepSet \u0643\u0644 \u062d\u0635\u0629 \u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 \u0623\u0647\u062f\u0627\u0641\u0643 \u0648\u062a\u0639\u0627\u0641\u064a\u0643 \u0648\u062c\u062f\u0648\u0644\u0643 \u062d\u062a\u0649 \u062a\u0639\u0631\u0641 \u062f\u0627\u0626\u0645\u064b\u0627 \u0645\u0627 \u0647\u064a \u0623\u0641\u0636\u0644 \u062d\u0635\u0629 \u062a\u0627\u0644\u064a\u0629 \u0644\u0643.',
      logoAlt: '\u0634\u0639\u0627\u0631 \u0635\u0627\u0644\u0629 \u0634\u0631\u064a\u0643\u0629',
      install: '\u062b\u0628\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0639\u0644\u0649 \u0647\u0627\u062a\u0641\u0643',
      start: '\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646',
      footer: '\u0627\u0646\u0636\u0645 \u0625\u0644\u0649 RepSet \u0644\u062a\u062d\u0635\u0644 \u0639\u0644\u0649 \u062a\u0645\u0627\u0631\u064a\u0646 \u0645\u062a\u0643\u064a\u0641\u0629 \u062a\u0646\u0627\u0633\u0628 \u0623\u0647\u062f\u0627\u0641\u0643.',
    },
    it: {
      titleAccent: 'Smart',
      titleLine1: 'Training,',
      titleLine2: 'Costruito Intorno a',
      titleYou: 'Te',
      body: 'RepSet costruisce ogni allenamento in base ai tuoi obiettivi, al recupero e al tuo programma, cosi sai sempre quale sessione fare dopo.',
      logoAlt: 'Logo palestra partner',
      install: 'Installa sul tuo telefono',
      start: 'Inizia Ora',
      footer: 'Unisciti a RepSet per ricevere allenamenti adattivi che seguono i tuoi obiettivi.',
    },
    de: {
      titleAccent: 'Smart',
      titleLine1: 'Training,',
      titleLine2: 'Gebaut fur',
      titleYou: 'Dich',
      body: 'RepSet baut jedes Training aus deinen Zielen, deiner Erholung und deinem Zeitplan auf, damit du immer deine beste nachste Einheit kennst.',
      logoAlt: 'Logo des Partnerstudios',
      install: 'Auf deinem Handy installieren',
      start: 'Jetzt starten',
      footer: 'Komm zu RepSet und erhalte adaptive Workouts, die zu deinen Zielen passen.',
    },
  });

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
    const nav = navigator as NavigatorWithStandalone;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone);

    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as InstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleGetStarted = () => {
    if (isStartPressed) {
      return;
    }

    setIsStartPressed(true);
    startTimerRef.current = window.setTimeout(() => {
      onGetStarted();
    }, 220);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden text-text-primary"
      style={{
        ...forcedDarkThemeVars,
        backgroundColor: '#101824',
      }}
    >
      <div className="relative z-10 min-h-screen px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] flex flex-col">
        <header className="mb-8 flex justify-center">
          <h1 className="font-brand text-[2.3rem] leading-none text-white text-center">RepSet</h1>
        </header>

        <section className="mt-10 sm:mt-12 mb-9">
          <h2 className="font-display text-[3rem] sm:text-[3.35rem] leading-[0.92] tracking-[0.01em] max-w-[24rem]">
            <span className="text-accent">{copy.titleAccent}</span> {copy.titleLine1}
            <span className="block">{copy.titleLine2} <span className="text-accent">{copy.titleYou}</span></span>
          </h2>
          <p className="mt-5 max-w-[24rem] text-base leading-relaxed text-text-secondary">
            {copy.body}
          </p>
        </section>

        <section className="my-auto -mx-4 space-y-5 sm:-mx-6">
          {renderLogoStrip('forward', 24, copy.logoAlt)}
          {renderLogoStrip('backward', 22, copy.logoAlt)}
          {renderLogoStrip('forward', 26, copy.logoAlt)}
        </section>

        <footer className="mt-10">
          {!isStandalone && deferredPrompt ? (
            <button
              type="button"
              onClick={handleInstall}
              className="mb-3 w-full rounded-xl border border-white/10 bg-white/10 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              {copy.install}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleGetStarted}
            className={`animated-button w-full${isStartPressed ? ' is-starting' : ''}`}
            aria-label={copy.start}
            aria-busy={isStartPressed}
            disabled={isStartPressed}
          >
            <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
            </svg>
            <span className="text">{copy.start}</span>
            <span className="circle" aria-hidden="true" />
            <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
            </svg>
          </button>
          <p className="mt-3 text-center text-xs text-text-secondary">
            {copy.footer}
          </p>
        </footer>
      </div>
    </div>
  );
};
