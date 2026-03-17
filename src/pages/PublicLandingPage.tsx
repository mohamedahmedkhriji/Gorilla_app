import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import logoA from '../../assets/gym_logo/646379168_914347981380799_6938641763717116038_n.jpg';
import logoB from '../../assets/gym_logo/841cc033449a0efdbfc315de6a29a52a.jpg';
import logoC from '../../assets/gym_logo/9d631105-f60d-4f63-8ec8-a353b8f6b7e9.png';
import logoD from '../../assets/gym_logo/a17097fedf53f8b861c7a5457c8a1f17.jpg';
import logoE from '../../assets/gym_logo/Screenshot 2026-03-01 000834.png';
import logoF from '../../assets/gym_logo/gymlogo.png';

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
            <span className="text-accent">Smart</span> Training,
            <span className="block">Built Around <span className="text-accent">You</span></span>
          </h2>
          <p className="mt-5 max-w-[24rem] text-base leading-relaxed text-text-secondary">
            RepSet builds each workout from your goals, recovery, and schedule so you always know your next best session.
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
                  <img src={logo} alt="Gym partner logo" className="h-full w-full object-cover" loading="lazy" />
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
                  <img src={logo} alt="Gym partner logo" className="h-full w-full object-cover" loading="lazy" />
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
                  <img src={logo} alt="Gym partner logo" className="h-full w-full object-cover" loading="lazy" />
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
              Install on your phone
            </button>
          ) : null}

          {!isStandalone && showIosInstallHint ? (
            <p className="mb-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs leading-relaxed text-text-secondary">
              On iPhone, tap the Share button in Safari, then choose Add to Home Screen.
            </p>
          ) : null}

          <button
            type="button"
            onClick={onGetStarted}
            className="w-full rounded-xl bg-accent text-black py-3.5 text-xl font-marker hover:bg-accent/90 transition-colors"
          >
            Start Now
          </button>
          <p className="mt-3 text-center text-xs text-text-secondary">
            Join RepSet to get adaptive workouts that fit your goals.
          </p>
        </footer>
      </div>
    </div>
  );
};
