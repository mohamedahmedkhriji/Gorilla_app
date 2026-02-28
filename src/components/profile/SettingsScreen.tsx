import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { Bell, Shield, User, LogOut, Moon, Sun, Database, Lock, SlidersHorizontal, Share2, MapPin, CreditCard, KeyRound, Scale, Mail, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { applyTheme, getActiveTheme, getStoredTheme } from '../../services/theme';
import { api } from '../../services/api';
interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
}
export function SettingsScreen({ onBack, onLogout }: SettingsScreenProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activePage, setActivePage] = useState<'settings' | 'privacy' | 'personal'>('settings');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordFields, setPasswordFields] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [personalDetails, setPersonalDetails] = useState({
    name: '',
    email: '',
    age: '',
    gender: '',
    heightCm: '',
    weightKg: '',
    primaryGoal: '',
    fitnessGoal: '',
    experienceLevel: '',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    coachMessages: true,
    restTimer: true,
    missionChallenge: true,
  });
  const [loadingNotificationSettings, setLoadingNotificationSettings] = useState(false);
  const [notificationSettingsError, setNotificationSettingsError] = useState('');

  useEffect(() => {
    setTheme(getActiveTheme());

    const onThemeChanged = () => {
      setTheme(getStoredTheme());
    };

    window.addEventListener('app-theme-changed', onThemeChanged);
    window.addEventListener('storage', onThemeChanged);

    return () => {
      window.removeEventListener('app-theme-changed', onThemeChanged);
      window.removeEventListener('storage', onThemeChanged);
    };
  }, []);

  const handleThemeChange = (nextTheme: 'dark' | 'light') => {
    applyTheme(nextTheme, true);
    setTheme(nextTheme);
  };

  useEffect(() => {
    const loadNotificationSettings = async () => {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      const userId = Number(user?.id || 0);
      if (!userId) return;

      try {
        setLoadingNotificationSettings(true);
        setNotificationSettingsError('');
        const data = await api.getNotificationSettings(userId);
        const next = {
          coachMessages: !!data?.coachMessages,
          restTimer: !!data?.restTimer,
          missionChallenge: !!data?.missionChallenge,
        };
        setNotificationSettings(next);
        localStorage.setItem('notificationSettings', JSON.stringify(next));
      } catch (error: any) {
        setNotificationSettingsError(error?.message || 'Failed to load notification settings');
      } finally {
        setLoadingNotificationSettings(false);
      }
    };

    void loadNotificationSettings();
  }, []);

  useEffect(() => {
    const loadPersonalDetails = async () => {
      if (activePage !== 'personal') return;

      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      const userId = Number(user?.id || 0);
      if (!userId) return;

      try {
        setDetailsError('');
        setDetailsMessage('');
        const data = await api.getProfileDetails(userId);
        setPersonalDetails({
          name: data?.name || '',
          email: data?.email || '',
          age: data?.age == null ? '' : String(data.age),
          gender: data?.gender || '',
          heightCm: data?.heightCm == null ? '' : String(data.heightCm),
          weightKg: data?.weightKg == null ? '' : String(data.weightKg),
          primaryGoal: data?.primaryGoal || '',
          fitnessGoal: data?.fitnessGoal || '',
          experienceLevel: data?.experienceLevel || '',
        });
      } catch (error: any) {
        setDetailsError(error?.message || 'Failed to load personal details');
      }
    };

    void loadPersonalDetails();
  }, [activePage]);

  const savePersonalDetails = async () => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const userId = Number(user?.id || 0);
    if (!userId) return;

    try {
      setSavingDetails(true);
      setDetailsError('');
      setDetailsMessage('');
      await api.updateProfileDetails(userId, {
        ...personalDetails,
        age: personalDetails.age.trim() ? Number(personalDetails.age) : null,
        heightCm: personalDetails.heightCm.trim() ? Number(personalDetails.heightCm) : null,
        weightKg: personalDetails.weightKg.trim() ? Number(personalDetails.weightKg) : null,
      });
      const nextUser = { ...user, name: personalDetails.name, email: personalDetails.email };
      localStorage.setItem('appUser', JSON.stringify(nextUser));
      localStorage.setItem('user', JSON.stringify(nextUser));
      setDetailsMessage('Saved successfully');
    } catch (error: any) {
      setDetailsError(error?.message || 'Failed to save personal details');
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePasswordChange = async () => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const userId = Number(user?.id || 0);
    if (!userId) return;

    if (!passwordFields.oldPassword || !passwordFields.newPassword || !passwordFields.confirmPassword) {
      setPasswordError('Please fill old, new and confirm password');
      setPasswordMessage('');
      return;
    }
    if (passwordFields.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      setPasswordMessage('');
      return;
    }
    if (passwordFields.newPassword !== passwordFields.confirmPassword) {
      setPasswordError('Confirm password does not match');
      setPasswordMessage('');
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError('');
      setPasswordMessage('');
      await api.updateProfilePassword(userId, passwordFields);
      setPasswordFields({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage('Password updated successfully');
    } catch (error: any) {
      setPasswordError(error?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const sections = [
  {
    title: 'Account',
    items: [
    {
      icon: User,
      label: 'Personal Details'
    },
    {
      icon: Shield,
      label: 'Privacy & Security'
    }]

  },
  {
    title: 'Preferences',
    items: [
    {
      icon: Bell,
      label: 'Notifications'
    }]

  }];

  if (activePage === 'privacy') {
    const cards = [
      {
        icon: Database,
        title: '1. Data You Collect',
        points: [
          'Personal info: name, email, age, gender.',
          'Fitness data: workouts, goals, progress, body metrics.',
          'Optional health data: calories, heart-rate related inputs.',
          'Technical data: app usage and crash diagnostics.',
          'Payment data handled by secure payment providers.',
        ],
      },
      {
        icon: Lock,
        title: '2. How We Protect Data',
        points: [
          'Encrypted transport (HTTPS) for data in transit.',
          'Secure cloud/database access controls.',
          'Limited staff access based on role and need.',
          'Security checks and routine hardening updates.',
        ],
      },
      {
        icon: SlidersHorizontal,
        title: '3. User Privacy Controls',
        points: [
          'Manage notification permissions anytime.',
          'Request account data export (planned flow).',
          'Request account deletion permanently.',
          'Control profile and data-sharing preferences.',
        ],
      },
      {
        icon: Share2,
        title: '4. Data Sharing Policy',
        points: [
          'No sale of personal data.',
          'Data shared only when needed: payment processors, analytics, legal obligations.',
        ],
      },
      {
        icon: MapPin,
        title: '5. Location & Tracking',
        points: [
          'Location is used only for location-based fitness features (if enabled).',
          'Users can disable location tracking in app/device settings.',
          'Location data retention follows minimum-necessary storage.',
        ],
      },
      {
        icon: CreditCard,
        title: '6. Payment Security',
        points: [
          'Payments run through trusted third-party processors.',
          'Card numbers are not stored directly on our servers.',
        ],
      },
      {
        icon: KeyRound,
        title: '7. Account Security Features',
        points: [
          'Strong password requirements.',
          'Suspicious login detection and account protection controls.',
          '2FA support can be added in future releases.',
        ],
      },
      {
        icon: Scale,
        title: '8. Legal Compliance',
        points: [
          'Designed with GDPR-style privacy principles.',
          'Respects applicable data protection and age-related requirements.',
        ],
      },
      {
        icon: Mail,
        title: '9. Contact & Support',
        points: [
          'For privacy concerns: privacy@gorilla.app',
          'For support: use in-app support/contact channel.',
        ],
      },
    ];

    return (
      <div className="flex-1 flex flex-col pb-24">
        <Header title="Privacy & Security" onBack={() => setActivePage('settings')} />
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-white/5 p-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              Clear summary of what data is collected, how it is protected, and the controls available to you.
            </p>
          </div>

          {cards.map((card) => (
            <div key={card.title} className="bg-card rounded-2xl border border-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <card.icon size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-white">{card.title}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {card.points.map((point) => (
                      <li key={point} className="text-xs sm:text-sm text-text-secondary leading-relaxed break-words [overflow-wrap:anywhere]">
                        - {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activePage === 'personal') {
    return (
      <div className="flex-1 flex flex-col pb-24">
        <Header title="Personal Details" onBack={() => setActivePage('settings')} />

        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-white/5 p-4 space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Full Name</label>
              <input
                value={personalDetails.name}
                onChange={(e) => setPersonalDetails((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={personalDetails.email}
                onChange={(e) => setPersonalDetails((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Age</label>
                <input
                  type="number"
                  value={personalDetails.age}
                  onChange={(e) => setPersonalDetails((prev) => ({ ...prev, age: e.target.value }))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Gender</label>
                <div className="relative">
                  <select
                    value={personalDetails.gender}
                    onChange={(e) => setPersonalDetails((prev) => ({ ...prev, gender: e.target.value }))}
                    className="w-full appearance-none bg-background border border-white/10 rounded-xl px-3 py-2.5 pr-9 text-white text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-colors"
                  >
                    <option value="">Select</option>
                    <option value="male">Man</option>
                    <option value="female">Woman</option>
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={personalDetails.heightCm}
                  onChange={(e) => setPersonalDetails((prev) => ({ ...prev, heightCm: e.target.value }))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={personalDetails.weightKg}
                  onChange={(e) => setPersonalDetails((prev) => ({ ...prev, weightKg: e.target.value }))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={savePersonalDetails}
              disabled={savingDetails}
              className="w-full rounded-xl bg-accent text-black font-semibold py-3 hover:bg-accent/90 transition-colors disabled:opacity-60"
            >
              {savingDetails ? 'Saving...' : 'Save Changes'}
            </button>
            {detailsMessage ? <p className="text-xs text-green-400">{detailsMessage}</p> : null}
            {detailsError ? <p className="text-xs text-red-400">{detailsError}</p> : null}
          </div>

          <div className="bg-card rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Change Password</h3>
            {(['oldPassword', 'newPassword', 'confirmPassword'] as const).map((fieldKey) => {
              const labelMap = {
                oldPassword: 'Old Password',
                newPassword: 'New Password',
                confirmPassword: 'Confirm New Password',
              };
              return (
                <div key={fieldKey}>
                  <label className="block text-xs text-text-secondary mb-1">{labelMap[fieldKey]}</label>
                  <div className="relative">
                    <input
                      type={showPassword[fieldKey] ? 'text' : 'password'}
                      value={passwordFields[fieldKey]}
                      onChange={(e) => setPasswordFields((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                      className="w-full bg-background border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-white text-sm outline-none focus:border-accent/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                    >
                      {showPassword[fieldKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={savingPassword}
              className="w-full rounded-xl border border-accent/40 text-accent font-semibold py-3 hover:bg-accent/10 transition-colors disabled:opacity-60"
            >
              {savingPassword ? 'Updating Password...' : 'Update Password'}
            </button>
            {passwordMessage ? <p className="text-xs text-green-400">{passwordMessage}</p> : null}
            {passwordError ? <p className="text-xs text-red-400">{passwordError}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  const updateNotificationPreference = async (
    key: 'coachMessages' | 'restTimer' | 'missionChallenge',
    value: boolean,
  ) => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const userId = Number(user?.id || 0);
    if (!userId) return;

    const previous = { ...notificationSettings };
    const next = { ...notificationSettings, [key]: value };
    setNotificationSettings(next);
    setNotificationSettingsError('');

    try {
      await api.updateNotificationSettings(userId, next);
      localStorage.setItem('notificationSettings', JSON.stringify(next));
    } catch (error: any) {
      setNotificationSettings(previous);
      setNotificationSettingsError(error?.message || 'Failed to update notification settings');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-24">
      <Header title="Settings" onBack={onBack} />

      <div className="space-y-8">
        {sections.map((section, i) =>
        <div key={i} className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider px-2">
              {section.title}
            </h3>
            <div className="bg-card rounded-2xl overflow-hidden border border-white/5">
              {section.items.map((item, j) =>
            <button
              key={j}
              type="button"
              onClick={() => {
                if (item.label === 'Personal Details') {
                  setActivePage('personal');
                }
                if (item.label === 'Privacy & Security') {
                  setActivePage('privacy');
                }
              }}
              className={`
                    w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors
                    ${j !== section.items.length - 1 ? 'border-b border-white/5' : ''}
                  `}>

                  <div className="flex items-center gap-3">
                    <item.icon size={20} className="text-text-secondary" />
                    <span className="text-white font-medium">{item.label}</span>
                  </div>
                </button>
            )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider px-2">
            Notification Controls
          </h3>
          <div className="bg-card rounded-2xl overflow-hidden border border-white/5">
            {[
              { key: 'coachMessages', label: 'Coach Messages' },
              { key: 'restTimer', label: 'Rest Between Sets' },
              { key: 'missionChallenge', label: 'Mission & Challenge Complete' },
            ].map((item, index, arr) => {
              const enabled = notificationSettings[item.key as keyof typeof notificationSettings];
              return (
                <div
                  key={item.key}
                  className={`w-full flex items-center justify-between p-4 ${
                    index !== arr.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Bell size={18} className="text-text-secondary" />
                    <span className="text-white font-medium">{item.label}</span>
                  </div>
                  <button
                    type="button"
                    aria-pressed={enabled}
                    aria-label={`Toggle ${item.label}`}
                    disabled={loadingNotificationSettings}
                    onClick={() =>
                      updateNotificationPreference(
                        item.key as 'coachMessages' | 'restTimer' | 'missionChallenge',
                        !enabled,
                      )
                    }
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                      enabled ? 'bg-accent' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full shadow-sm transition-transform duration-200 ${
                        enabled ? 'translate-x-6 bg-black' : 'translate-x-1 bg-white'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
          {notificationSettingsError && (
            <p className="text-xs text-red-400 px-2">{notificationSettingsError}</p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider px-2">
            Theme
          </h3>
          <div className="bg-card rounded-2xl border border-white/5 p-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                theme === 'dark'
                  ? 'bg-white/10 border-accent text-white'
                  : 'bg-background border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <Moon size={16} />
              <span className="text-sm font-medium">Dark</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                theme === 'light'
                  ? 'bg-accent-soft border-accent-dark text-text-primary'
                  : 'bg-background border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <Sun size={16} />
              <span className="text-sm font-medium">Light</span>
            </button>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-medium flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors">
          <LogOut size={20} />
          Log Out
        </button>
      </div>
    </div>);

}
