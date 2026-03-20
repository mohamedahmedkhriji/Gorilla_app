import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import logoA from '../../assets/gym_logo/646379168_914347981380799_6938641763717116038_n.jpg';
import logoB from '../../assets/gym_logo/841cc033449a0efdbfc315de6a29a52a.jpg';
import logoC from '../../assets/gym_logo/9d631105-f60d-4f63-8ec8-a353b8f6b7e9.png';
import logoD from '../../assets/gym_logo/a17097fedf53f8b861c7a5457c8a1f17.jpg';
import logoE from '../../assets/gym_logo/Screenshot 2026-03-01 000834.png';
import logoF from '../../assets/gym_logo/gymlogo.png';
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
  '--color-background': '9 14 23',
  '--color-background-secondary': '16 24 36',
  '--color-card': '20 32 46',
  '--color-border': '134 161 189',
  '--color-text-primary': '243 248 255',
  '--color-text-secondary': '175 192 213',
  '--color-text-tertiary': '131 149 171',
} as React.CSSProperties;

const logos = [logoA, logoB, logoC, logoD, logoE, logoF];
const loopedLogos = [...logos, ...logos, ...logos];

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onGetStarted }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');

  const copy = pickLanguage(language, {
    en: {
      titleAccent: 'Smart',
      titleLine1: 'Training,',
      titleLine2: 'Built Around',
      titleYou: 'You',
      body: 'RepSet builds each workout from your goals, recovery, and schedule so you always know your next best session.',
      logoAlt: 'Gym partner logo',
      install: 'Install on your phone',
      iosHint: 'On iPhone, tap the Share button in Safari, then choose Add to Home Screen.',
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
      iosHint: '\u0639\u0644\u0649 iPhone\u060c \u0627\u0636\u063a\u0637 \u0632\u0631 Share \u0641\u064a Safari \u062b\u0645 \u0627\u062e\u062a\u0631 Add to Home Screen.',
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
      iosHint: 'Su iPhone, tocca il pulsante Condividi in Safari e poi scegli Aggiungi alla schermata Home.',
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
      iosHint: 'Tippe auf dem iPhone in Safari auf Teilen und dann auf Zum Home-Bildschirm.',
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
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    setIsStandalone(standalone);
    setShowIosInstallHint(isIos && !standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as InstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowIosInstallHint(false);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
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

  return (
    <div
      className="relative min-h-screen overflow-hidden text-text-primary"
      style={{
        ...forcedDarkThemeVars,
        backgroundImage:
          'radial-gradient(circle at 100% -10%, rgb(var(--color-accent) / 0.08), transparent 38%), linear-gradient(155deg, rgb(var(--color-background)), rgb(var(--color-background-secondary)))',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'repeating-linear-gradient(120deg, rgb(255 255 255 / 0.015) 0px, rgb(255 255 255 / 0.015) 2px, transparent 2px, transparent 18px), repeating-linear-gradient(20deg, rgb(0 0 0 / 0.04) 0px, rgb(0 0 0 / 0.04) 1px, transparent 1px, transparent 12px)',
        }}
      />

      <div className="relative z-10 min-h-screen px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] flex flex-col">
        <header className="mb-8 flex justify-center">
          <h1 className="font-brand text-[2rem] leading-none text-white text-center">RepSet</h1>
        </header>

        <section className="mt-10 sm:mt-12 mb-9">
          <h2 className="font-display text-[2.7rem] sm:text-[3rem] leading-[0.92] tracking-[0.01em] max-w-[22rem]">
            <span className="text-accent">{copy.titleAccent}</span> {copy.titleLine1}
            <span className="block">{copy.titleLine2} <span className="text-accent">{copy.titleYou}</span></span>
          </h2>
          <p className="mt-5 max-w-[24rem] text-base leading-relaxed text-text-secondary">
            {copy.body}
          </p>
        </section>

        <section className="space-y-3 my-auto">
          <div className="overflow-hidden">
            <motion.div
              className="flex w-max gap-3"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 24, ease: 'linear', repeat: Infinity }}
            >
              {loopedLogos.map((logo, index) => (
                <div key={`forward-${index}`} className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                  <img src={logo} alt={copy.logoAlt} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </motion.div>
          </div>

          <div className="overflow-hidden">
            <motion.div
              className="flex w-max gap-3"
              animate={{ x: ['-50%', '0%'] }}
              transition={{ duration: 22, ease: 'linear', repeat: Infinity }}
            >
              {loopedLogos.map((logo, index) => (
                <div key={`backward-${index}`} className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                  <img src={logo} alt={copy.logoAlt} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </motion.div>
          </div>

          <div className="overflow-hidden">
            <motion.div
              className="flex w-max gap-3"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 26, ease: 'linear', repeat: Infinity }}
            >
              {loopedLogos.map((logo, index) => (
                <div key={`forward-bottom-${index}`} className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                  <img src={logo} alt={copy.logoAlt} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </motion.div>
          </div>
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

          {!isStandalone && showIosInstallHint ? (
            <p className="mb-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs leading-relaxed text-text-secondary">
              {copy.iosHint}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onGetStarted}
            className="w-full rounded-xl bg-accent text-black py-3.5 text-xl font-marker hover:bg-accent/90 transition-colors"
          >
            {copy.start}
          </button>
          <p className="mt-3 text-center text-xs text-text-secondary">
            {copy.footer}
          </p>
        </footer>
      </div>
    </div>
  );
};
