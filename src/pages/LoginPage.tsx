import React, { useEffect, useState } from 'react';
import { Dumbbell, Mail, Lock, Eye, EyeOff, Sparkles, ShieldCheck, Zap, Download } from 'lucide-react';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
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

    try {
      const result = await api.login(email, password, 'user');
      if (result.error || !result.user) {
        setError(result.error || 'Login failed');
        return;
      }

      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('userId', String(result.user.id));
      localStorage.setItem('appUser', JSON.stringify(result.user));
      localStorage.setItem('appUserId', String(result.user.id));
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
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
      <div className="relative w-full max-w-5xl grid gap-5 md:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden md:flex flex-col justify-between rounded-3xl surface-card p-8 border border-white/12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
              <Sparkles size={14} />
              Training App
            </div>

            <h1 className="mt-6 text-3xl md:text-[2.6rem] leading-[0.95] text-white font-black italic">
              <span className="font-brand text-[3rem] md:text-[3.4rem] leading-none not-italic font-normal">RepSet</span>
              <span className="block text-gradient">Performance</span>
            </h1>

            <p className="mt-6 max-w-md text-sm leading-relaxed text-text-secondary">
              Personalized workouts, intelligent recovery, and coach-grade insights in one clean experience.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="surface-glass rounded-2xl p-4 flex items-center gap-3 text-sm text-text-secondary">
              <Zap size={16} className="text-accent" />
              Adaptive daily plan based on your progress.
            </div>
            <div className="surface-glass rounded-2xl p-4 flex items-center gap-3 text-sm text-text-secondary">
              <ShieldCheck size={16} className="text-info" />
              Coach-approved workflow for safer training.
            </div>
          </div>
        </section>

        <section className="rounded-2xl surface-glass border border-white/12 p-5 md:p-7">
          <div className="text-center md:text-left mb-6">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Dumbbell size={28} className="text-accent" />
              <h2 className="font-brand text-[2.2rem] leading-none text-white">RepSet</h2>
            </div>
            <p className="text-text-secondary mt-2 text-sm">Train smart and stay consistent.</p>
          </div>

          {!isStandalone && deferredPrompt ? (
            <button
              type="button"
              onClick={handleInstall}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/15"
            >
              <Download size={16} />
              Download App
            </button>
          ) : null}

          {!isStandalone && showIosInstallHint ? (
            <p className="mb-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs leading-relaxed text-text-secondary">
              On iPhone, tap Share in Safari, then choose Add to Home Screen.
            </p>
          ) : null}

          {error && <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200 mb-4">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-text-secondary mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full surface-glass border border-white/15 text-text-primary pl-10 pr-3 py-3 rounded-xl focus:outline-none focus:border-accent/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-text-secondary mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
              {loading ? 'Logging In...' : 'Login'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-text-secondary">
            Need an account?
            <span className="text-accent font-semibold"> Contact your coach</span>
          </div>

          <div className="text-center mt-4 pt-4 border-t border-white/10">
            <a href="/admin.html" className="text-xs text-text-tertiary hover:text-text-primary transition-colors">
              Admin and Coach Login
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};
