import React, { useEffect, useState } from 'react';
import { Dumbbell, Mail, Lock, Eye, EyeOff, Sparkles, ShieldCheck, Zap, Download } from 'lucide-react';
import { api } from '../services/api';
import { persistStoredUserSession } from '../shared/authStorage';
import { AppLanguage, getActiveLanguage, getStoredLanguage, pickLanguage } from '../services/language';
import { LoginTransitionOverlay } from '../components/ui/LoginTransitionOverlay';

interface LoginPageProps {
  onLoginSuccess: () => void | Promise<void>;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');

  const copy = pickLanguage(language, {
    en: {
      badge: 'Training App',
      performance: 'Performance',
      intro: 'Personalized workouts, intelligent recovery, and coach-grade insights in one clean experience.',
      featureAdaptive: 'Adaptive daily plan based on your progress.',
      featureCoach: 'Coach-approved workflow for safer training.',
      tagline: 'Train smart and stay consistent.',
      download: 'Download App',
      iosHint: 'On iPhone, tap Share in Safari, then choose Add to Home Screen.',
      loginFailed: 'Login failed',
      email: 'Email',
      emailPlaceholder: 'your@email.com',
      password: 'Password',
      passwordPlaceholder: 'Enter your password',
      loggingIn: 'Logging In...',
      loadingSubtitle: 'Preparing your dashboard and loading your plan.',
      login: 'Login',
      needAccount: 'Need an account?',
      contactCoach: 'Contact your coach',
      adminLogin: 'Admin and Coach Login',
    },
    ar: {
      badge: '\u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u062a\u062f\u0631\u064a\u0628',
      performance: '\u0627\u0644\u0623\u062f\u0627\u0621',
      intro: '\u062a\u0645\u0627\u0631\u064a\u0646 \u0645\u062e\u0635\u0635\u0629\u060c \u0648\u0627\u0633\u062a\u0634\u0641\u0627\u0621 \u0630\u0643\u064a\u060c \u0648\u0631\u0624\u0649 \u0628\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0645\u062f\u0631\u0628 \u0641\u064a \u062a\u062c\u0631\u0628\u0629 \u0648\u0627\u062d\u062f\u0629 \u0646\u0638\u064a\u0641\u0629.',
      featureAdaptive: '\u062e\u0637\u0629 \u064a\u0648\u0645\u064a\u0629 \u0645\u062a\u0643\u064a\u0641\u0629 \u062d\u0633\u0628 \u062a\u0642\u062f\u0645\u0643.',
      featureCoach: '\u062a\u062f\u0641\u0642 \u0645\u0639\u062a\u0645\u062f \u0645\u0646 \u0627\u0644\u0645\u062f\u0631\u0628 \u0644\u062a\u062f\u0631\u064a\u0628 \u0623\u0643\u062b\u0631 \u0623\u0645\u0627\u0646\u064b\u0627.',
      tagline: '\u062a\u062f\u0631\u0628 \u0628\u0630\u0643\u0627\u0621 \u0648\u0627\u0633\u062a\u0645\u0631 \u0628\u062b\u0628\u0627\u062a.',
      download: '\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062a\u0637\u0628\u064a\u0642',
      iosHint: '\u0639\u0644\u0649 iPhone\u060c \u0627\u0636\u063a\u0637 Share \u0641\u064a Safari \u062b\u0645 \u0627\u062e\u062a\u0631 Add to Home Screen.',
      loginFailed: '\u0641\u0634\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
      email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
      emailPlaceholder: 'your@email.com',
      password: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631',
      passwordPlaceholder: '\u0623\u062f\u062e\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631',
      loggingIn: '\u062c\u0627\u0631\u064d \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644...',
      loadingSubtitle: '\u0646\u0642\u0648\u0645 \u0628\u062a\u062c\u0647\u064a\u0632 \u0644\u0648\u062d\u062a\u0643 \u0648\u062e\u0637\u062a\u0643 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629.',
      login: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
      needAccount: '\u062a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u062d\u0633\u0627\u0628\u061f',
      contactCoach: '\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0645\u062f\u0631\u0628\u0643',
      adminLogin: '\u062a\u0633\u062c\u064a\u0644 \u062f\u062e\u0648\u0644 \u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u062f\u0631\u0628',
    },
    it: {
      badge: 'App di Allenamento',
      performance: 'Performance',
      intro: 'Allenamenti personalizzati, recupero intelligente e insight da coach in un\'unica esperienza pulita.',
      featureAdaptive: 'Piano giornaliero adattivo in base ai tuoi progressi.',
      featureCoach: 'Flusso approvato dal coach per allenarti in modo piu sicuro.',
      tagline: 'Allenati con intelligenza e resta costante.',
      download: 'Scarica l\'app',
      iosHint: 'Su iPhone, tocca Condividi in Safari e poi scegli Aggiungi alla schermata Home.',
      loginFailed: 'Accesso non riuscito',
      email: 'Email',
      emailPlaceholder: 'your@email.com',
      password: 'Password',
      passwordPlaceholder: 'Inserisci la tua password',
      loggingIn: 'Accesso in corso...',
      loadingSubtitle: 'Stiamo preparando la tua dashboard e il tuo piano.',
      login: 'Accedi',
      needAccount: 'Hai bisogno di un account?',
      contactCoach: 'Contatta il tuo coach',
      adminLogin: 'Accesso Admin e Coach',
    },
    de: {
      badge: 'Trainings-App',
      performance: 'Leistung',
      intro: 'Personliche Workouts, intelligente Erholung und Coach-Einblicke in einer klaren Erfahrung.',
      featureAdaptive: 'Adaptiver Tagesplan basierend auf deinem Fortschritt.',
      featureCoach: 'Vom Coach geprufter Ablauf fur sichereres Training.',
      tagline: 'Trainiere smart und bleib konstant.',
      download: 'App herunterladen',
      iosHint: 'Tippe auf dem iPhone in Safari auf Teilen und dann auf Zum Home-Bildschirm.',
      loginFailed: 'Anmeldung fehlgeschlagen',
      email: 'E-Mail',
      emailPlaceholder: 'deine@email.com',
      password: 'Passwort',
      passwordPlaceholder: 'Gib dein Passwort ein',
      loggingIn: 'Anmeldung lauft...',
      loadingSubtitle: 'Dein Dashboard und dein Plan werden vorbereitet.',
      login: 'Anmelden',
      needAccount: 'Brauchst du ein Konto?',
      contactCoach: 'Kontaktiere deinen Coach',
      adminLogin: 'Admin- und Coach-Login',
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    let loginSucceeded = false;

    try {
      const result = await api.login(email, password, 'user');
      if (result.error || !result.user) {
        setError(result.error || copy.loginFailed);
        return;
      }

      persistStoredUserSession({ user: result.user, token: result.token });
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
      await Promise.resolve(onLoginSuccess());
      loginSucceeded = true;
    } catch (err: any) {
      setError(err.message || copy.loginFailed);
    } finally {
      if (!loginSucceeded) {
        setLoading(false);
      }
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen px-4 py-8 flex items-center justify-center">
      {loading ? (
        <LoginTransitionOverlay
          title={copy.loggingIn}
          subtitle={copy.loadingSubtitle}
        />
      ) : null}

      <div className="relative w-full max-w-5xl grid gap-5 md:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden md:flex flex-col justify-between rounded-3xl surface-card p-8 border border-white/12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
              <Sparkles size={14} />
              {copy.badge}
            </div>

            <h1 className="mt-6 text-3xl md:text-[2.6rem] leading-[0.95] text-white font-black italic">
              <span className="font-brand text-[3rem] md:text-[3.4rem] leading-none not-italic font-normal">RepSet</span>
              <span className="block text-gradient">{copy.performance}</span>
            </h1>

            <p className="mt-6 max-w-md text-sm leading-relaxed text-text-secondary">
              {copy.intro}
            </p>
          </div>

          <div className="grid gap-3">
            <div className="surface-glass rounded-2xl p-4 flex items-center gap-3 text-sm text-text-secondary">
              <Zap size={16} className="text-accent" />
              {copy.featureAdaptive}
            </div>
            <div className="surface-glass rounded-2xl p-4 flex items-center gap-3 text-sm text-text-secondary">
              <ShieldCheck size={16} className="text-info" />
              {copy.featureCoach}
            </div>
          </div>
        </section>

        <section className="rounded-2xl surface-glass border border-white/12 p-5 md:p-7">
          <div className="text-center md:text-left mb-6">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Dumbbell size={28} className="text-accent" />
              <h2 className="font-brand text-[2.2rem] leading-none text-white">RepSet</h2>
            </div>
            <p className="text-text-secondary mt-2 text-sm">{copy.tagline}</p>
          </div>

          {!isStandalone && deferredPrompt ? (
            <button
              type="button"
              onClick={handleInstall}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/15"
            >
              <Download size={16} />
              {copy.download}
            </button>
          ) : null}

          {!isStandalone && showIosInstallHint ? (
            <p className="mb-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs leading-relaxed text-text-secondary">
              {copy.iosHint}
            </p>
          ) : null}

          {error && <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200 mb-4">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-text-secondary mb-2">{copy.email}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.emailPlaceholder}
                  className="w-full surface-glass border border-white/15 text-text-primary pl-10 pr-3 py-3 rounded-xl focus:outline-none focus:border-accent/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-text-secondary mb-2">{copy.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={copy.passwordPlaceholder}
                  className="w-full surface-glass border border-white/15 text-text-primary pl-10 pr-10 py-3 rounded-xl focus:outline-none focus:border-accent/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-accent text-black font-marker text-xl hover:bg-accent/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? copy.loggingIn : copy.login}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-text-secondary">
            {copy.needAccount}
            <span className="text-accent font-semibold"> {copy.contactCoach}</span>
          </div>

          <div className="text-center mt-4 pt-4 border-t border-white/10">
            <a href="/admin.html" className="text-xs text-text-tertiary hover:text-text-primary transition-colors">
              {copy.adminLogin}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};
