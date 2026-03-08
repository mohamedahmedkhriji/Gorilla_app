import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { Bell, Shield, User, Moon, Sun, Database, Lock, SlidersHorizontal, Share2, MapPin, CreditCard, KeyRound, Scale, Mail, ChevronDown, ChevronRight, Eye, EyeOff, Languages } from 'lucide-react';
import { applyTheme, getActiveTheme, getStoredTheme } from '../../services/theme';
import { AppLanguage, applyLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { api } from '../../services/api';
interface SettingsScreenProps {
  onBack: () => void;
  onOpenGym?: () => void;
}

const SETTINGS_I18N = {
  en: {
    settings: 'Settings',
    account: 'Account',
    personalDetails: 'Personal Details',
    privacyAndSecurity: 'Privacy & Security',
    preferences: 'Preferences',
    notifications: 'Notifications',
    notificationControls: 'Notification Controls',
    coachMessages: 'Coach Messages',
    restBetweenSets: 'Rest Between Sets',
    missionChallengeComplete: 'Mission & Challenge Complete',
    theme: 'Theme',
    language: 'Language',
    english: 'English',
    french: 'French',
    dark: 'Dark',
    light: 'Light',
    logOut: 'Log Out',
    failedLoadNotificationSettings: 'Failed to load notification settings',
    failedLoadPersonalDetails: 'Failed to load personal details',
    failedSavePersonalDetails: 'Failed to save personal details',
    failedUpdatePassword: 'Failed to update password',
    failedUpdateNotificationSettings: 'Failed to update notification settings',
    savedSuccessfully: 'Saved successfully',
    fullName: 'Full Name',
    email: 'Email',
    age: 'Age',
    gender: 'Gender',
    select: 'Select',
    man: 'Man',
    woman: 'Woman',
    heightCm: 'Height (cm)',
    weightKg: 'Weight (kg)',
    saving: 'Saving...',
    saveChanges: 'Save Changes',
    changePassword: 'Change Password',
    oldPassword: 'Old Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    updatingPassword: 'Updating Password...',
    updatePassword: 'Update Password',
    pleaseFillPasswordFields: 'Please fill old, new and confirm password',
    newPasswordMinLength: 'New password must be at least 6 characters',
    confirmPasswordMismatch: 'Confirm password does not match',
    passwordUpdated: 'Password updated successfully',
    toggleLabelPrefix: 'Toggle',
    privacyIntro: 'Clear summary of what data is collected, how it is protected, and the controls available to you.',
    privacyCards: [
      {
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
        title: '2. How We Protect Data',
        points: [
          'Encrypted transport (HTTPS) for data in transit.',
          'Secure cloud/database access controls.',
          'Limited staff access based on role and need.',
          'Security checks and routine hardening updates.',
        ],
      },
      {
        title: '3. User Privacy Controls',
        points: [
          'Manage notification permissions anytime.',
          'Request account data export (planned flow).',
          'Request account deletion permanently.',
          'Control profile and data-sharing preferences.',
        ],
      },
      {
        title: '4. Data Sharing Policy',
        points: [
          'No sale of personal data.',
          'Data shared only when needed: payment processors, analytics, legal obligations.',
        ],
      },
      {
        title: '5. Location & Tracking',
        points: [
          'Location is used only for location-based fitness features (if enabled).',
          'Users can disable location tracking in app/device settings.',
          'Location data retention follows minimum-necessary storage.',
        ],
      },
      {
        title: '6. Payment Security',
        points: [
          'Payments run through trusted third-party processors.',
          'Card numbers are not stored directly on our servers.',
        ],
      },
      {
        title: '7. Account Security Features',
        points: [
          'Strong password requirements.',
          'Suspicious login detection and account protection controls.',
          '2FA support can be added in future releases.',
        ],
      },
      {
        title: '8. Legal Compliance',
        points: [
          'Designed with GDPR-style privacy principles.',
          'Respects applicable data protection and age-related requirements.',
        ],
      },
      {
        title: '9. Contact & Support',
        points: [
          'For privacy concerns: privacy@repset.app',
          'For support: use in-app support/contact channel.',
        ],
      },
    ],
  },
  fr: {
    settings: 'Parametres',
    account: 'Compte',
    personalDetails: 'Details personnels',
    privacyAndSecurity: 'Confidentialite et securite',
    preferences: 'Preferences',
    notifications: 'Notifications',
    notificationControls: 'Controle des notifications',
    coachMessages: 'Messages du coach',
    restBetweenSets: 'Repos entre les series',
    missionChallengeComplete: 'Mission et challenge termines',
    theme: 'Theme',
    language: 'Langue',
    english: 'Anglais',
    french: 'Francais',
    dark: 'Sombre',
    light: 'Clair',
    logOut: 'Se deconnecter',
    failedLoadNotificationSettings: 'Impossible de charger les parametres de notification',
    failedLoadPersonalDetails: 'Impossible de charger les details personnels',
    failedSavePersonalDetails: 'Impossible de sauvegarder les details personnels',
    failedUpdatePassword: 'Impossible de mettre a jour le mot de passe',
    failedUpdateNotificationSettings: 'Impossible de mettre a jour les notifications',
    savedSuccessfully: 'Sauvegarde reussie',
    fullName: 'Nom complet',
    email: 'Email',
    age: 'Age',
    gender: 'Genre',
    select: 'Selectionner',
    man: 'Homme',
    woman: 'Femme',
    heightCm: 'Taille (cm)',
    weightKg: 'Poids (kg)',
    saving: 'Sauvegarde...',
    saveChanges: 'Enregistrer les changements',
    changePassword: 'Changer le mot de passe',
    oldPassword: 'Ancien mot de passe',
    newPassword: 'Nouveau mot de passe',
    confirmNewPassword: 'Confirmer le nouveau mot de passe',
    updatingPassword: 'Mise a jour du mot de passe...',
    updatePassword: 'Mettre a jour le mot de passe',
    pleaseFillPasswordFields: 'Remplissez ancien, nouveau et confirmation du mot de passe',
    newPasswordMinLength: 'Le nouveau mot de passe doit contenir au moins 6 caracteres',
    confirmPasswordMismatch: 'La confirmation du mot de passe ne correspond pas',
    passwordUpdated: 'Mot de passe mis a jour avec succes',
    toggleLabelPrefix: 'Activer',
    privacyIntro: 'Resume clair des donnees collectees, de leur protection et des controles disponibles pour vous.',
    privacyCards: [
      {
        title: '1. Donnees collectees',
        points: [
          'Infos personnelles: nom, email, age, genre.',
          'Donnees fitness: entrainements, objectifs, progression, mesures corporelles.',
          'Donnees sante optionnelles: calories, elements lies au rythme cardiaque.',
          'Donnees techniques: usage de l app et diagnostics de crash.',
          'Donnees de paiement gerees par des fournisseurs securises.',
        ],
      },
      {
        title: '2. Protection des donnees',
        points: [
          'Transport chiffre (HTTPS) pour les donnees en transit.',
          'Controle d acces securise cloud/base de donnees.',
          'Acces limite du personnel selon le role et le besoin.',
          'Controles de securite et mises a jour regulieres.',
        ],
      },
      {
        title: '3. Controles de confidentialite',
        points: [
          'Gerer les autorisations de notification a tout moment.',
          'Demander un export des donnees du compte (prevu).',
          'Demander la suppression permanente du compte.',
          'Controler les preferences de profil et de partage de donnees.',
        ],
      },
      {
        title: '4. Politique de partage',
        points: [
          'Aucune vente de donnees personnelles.',
          'Partage uniquement si necessaire: paiement, analytics, obligations legales.',
        ],
      },
      {
        title: '5. Localisation et suivi',
        points: [
          'La localisation est utilisee seulement pour les fonctions fitness geolocalisees (si activees).',
          'Les utilisateurs peuvent desactiver la localisation dans l app/appareil.',
          'La retention des donnees de localisation suit le minimum necessaire.',
        ],
      },
      {
        title: '6. Securite des paiements',
        points: [
          'Les paiements passent par des processeurs tiers de confiance.',
          'Les numeros de carte ne sont pas stockes directement sur nos serveurs.',
        ],
      },
      {
        title: '7. Securite du compte',
        points: [
          'Exigences de mot de passe robustes.',
          'Detection des connexions suspectes et protections du compte.',
          'Le support 2FA peut etre ajoute dans de futures versions.',
        ],
      },
      {
        title: '8. Conformite legale',
        points: [
          'Concu avec des principes de confidentialite de type GDPR.',
          'Respecte les exigences applicables de protection des donnees et d age.',
        ],
      },
      {
        title: '9. Contact et support',
        points: [
          'Pour la confidentialite: privacy@repset.app',
          'Pour le support: utilisez le canal support/contact de l app.',
        ],
      },
    ],
  },
} as const;

export function SettingsScreen({ onBack, onOpenGym }: SettingsScreenProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<AppLanguage>('en');
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
  const copy = SETTINGS_I18N[language] || SETTINGS_I18N.en;

  useEffect(() => {
    setTheme(getActiveTheme());
    setLanguage(getActiveLanguage());

    const onThemeChanged = () => {
      setTheme(getStoredTheme());
    };
    const onLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-theme-changed', onThemeChanged);
    window.addEventListener('app-language-changed', onLanguageChanged);
    window.addEventListener('storage', onThemeChanged);
    window.addEventListener('storage', onLanguageChanged);

    return () => {
      window.removeEventListener('app-theme-changed', onThemeChanged);
      window.removeEventListener('app-language-changed', onLanguageChanged);
      window.removeEventListener('storage', onThemeChanged);
      window.removeEventListener('storage', onLanguageChanged);
    };
  }, []);

  const handleThemeChange = (nextTheme: 'dark' | 'light') => {
    applyTheme(nextTheme, true);
    setTheme(nextTheme);
  };

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    applyLanguage(nextLanguage, true);
    setLanguage(nextLanguage);
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
        const fallbackCopy = SETTINGS_I18N[getStoredLanguage()];
        setNotificationSettingsError(error?.message || fallbackCopy.failedLoadNotificationSettings);
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
        const fallbackCopy = SETTINGS_I18N[getStoredLanguage()];
        setDetailsError(error?.message || fallbackCopy.failedLoadPersonalDetails);
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
      setDetailsMessage(copy.savedSuccessfully);
    } catch (error: any) {
      setDetailsError(error?.message || copy.failedSavePersonalDetails);
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePasswordChange = async () => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const userId = Number(user?.id || 0);
    if (!userId) return;

    if (!passwordFields.oldPassword || !passwordFields.newPassword || !passwordFields.confirmPassword) {
      setPasswordError(copy.pleaseFillPasswordFields);
      setPasswordMessage('');
      return;
    }
    if (passwordFields.newPassword.length < 6) {
      setPasswordError(copy.newPasswordMinLength);
      setPasswordMessage('');
      return;
    }
    if (passwordFields.newPassword !== passwordFields.confirmPassword) {
      setPasswordError(copy.confirmPasswordMismatch);
      setPasswordMessage('');
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError('');
      setPasswordMessage('');
      await api.updateProfilePassword(userId, passwordFields);
      setPasswordFields({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage(copy.passwordUpdated);
    } catch (error: any) {
      setPasswordError(error?.message || copy.failedUpdatePassword);
    } finally {
      setSavingPassword(false);
    }
  };

  const sections = [
    {
      title: copy.account,
      items: [
        { key: 'personal', icon: User, label: copy.personalDetails },
        { key: 'privacy', icon: Shield, label: copy.privacyAndSecurity },
      ],
    },
    {
      title: copy.preferences,
      items: [
        { key: 'notifications', icon: Bell, label: copy.notifications },
      ],
    },
  ] as const;

  if (activePage === 'privacy') {
    const privacyIcons = [Database, Lock, SlidersHorizontal, Share2, MapPin, CreditCard, KeyRound, Scale, Mail];
    const cards = copy.privacyCards.map((card, index) => ({
      icon: privacyIcons[index] || Shield,
      title: card.title,
      points: card.points,
    }));

    return (
      <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
        <div className="px-4 sm:px-6 pt-2">
          <Header title={copy.privacyAndSecurity} onBack={() => setActivePage('settings')} compact />
        </div>
        <div className="px-4 sm:px-6 space-y-3">
          <div className="bg-card rounded-2xl border border-white/5 p-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              {copy.privacyIntro}
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
      <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
        <div className="px-4 sm:px-6 pt-2">
          <Header title={copy.personalDetails} onBack={() => setActivePage('settings')} compact />
        </div>

        <div className="px-4 sm:px-6 space-y-3">
          <div className="bg-card rounded-2xl border border-white/5 p-4 space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">{copy.fullName}</label>
              <input
                value={personalDetails.name}
                onChange={(e) => setPersonalDetails((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">{copy.email}</label>
              <input
                type="email"
                value={personalDetails.email}
                onChange={(e) => setPersonalDetails((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">{copy.age}</label>
                <input
                  type="number"
                  value={personalDetails.age}
                  onChange={(e) => setPersonalDetails((prev) => ({ ...prev, age: e.target.value }))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">{copy.gender}</label>
                <div className="relative">
                  <select
                    value={personalDetails.gender}
                    onChange={(e) => setPersonalDetails((prev) => ({ ...prev, gender: e.target.value }))}
                    className="w-full appearance-none bg-background border border-white/10 rounded-xl px-3 py-2.5 pr-9 text-white text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-colors"
                  >
                    <option value="">{copy.select}</option>
                    <option value="male">{copy.man}</option>
                    <option value="female">{copy.woman}</option>
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">{copy.heightCm}</label>
                <input
                  type="number"
                  value={personalDetails.heightCm}
                  onChange={(e) => setPersonalDetails((prev) => ({ ...prev, heightCm: e.target.value }))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">{copy.weightKg}</label>
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
              {savingDetails ? copy.saving : copy.saveChanges}
            </button>
            {detailsMessage ? <p className="text-xs text-green-400">{detailsMessage}</p> : null}
            {detailsError ? <p className="text-xs text-red-400">{detailsError}</p> : null}
          </div>

          <div className="bg-card rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">{copy.changePassword}</h3>
            {(['oldPassword', 'newPassword', 'confirmPassword'] as const).map((fieldKey) => {
              const labelMap = {
                oldPassword: copy.oldPassword,
                newPassword: copy.newPassword,
                confirmPassword: copy.confirmNewPassword,
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
              {savingPassword ? copy.updatingPassword : copy.updatePassword}
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
      setNotificationSettingsError(error?.message || copy.failedUpdateNotificationSettings);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.settings} onBack={onBack} compact />
      </div>

      <div className="px-4 sm:px-6 space-y-8">
        <button
          type="button"
          onClick={() => onOpenGym?.()}
          className="w-full bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <MapPin size={20} />
            </div>
            <div className="text-left">
              <div className="font-medium text-white">Gym Access</div>
              <div className="text-xs text-text-secondary">Iron Paradise Gym</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-text-tertiary" />
        </button>

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
                if (item.key === 'personal') {
                  setActivePage('personal');
                }
                if (item.key === 'privacy') {
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
            {copy.notificationControls}
          </h3>
          <div className="bg-card rounded-2xl overflow-hidden border border-white/5">
            {[
              { key: 'coachMessages', label: copy.coachMessages },
              { key: 'restTimer', label: copy.restBetweenSets },
              { key: 'missionChallenge', label: copy.missionChallengeComplete },
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
                    aria-label={`${copy.toggleLabelPrefix} ${item.label}`}
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
            {copy.theme}
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
              <span className="text-sm font-medium">{copy.dark}</span>
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
              <span className="text-sm font-medium">{copy.light}</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider px-2">
            {copy.language}
          </h3>
          <div className="bg-card rounded-2xl border border-white/5 p-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                language === 'en'
                  ? 'bg-white/10 border-accent text-white'
                  : 'bg-background border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <Languages size={16} />
              <span className="text-sm font-medium">{copy.english}</span>
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('fr')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                language === 'fr'
                  ? 'bg-accent-soft border-accent-dark text-text-primary'
                  : 'bg-background border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <Languages size={16} />
              <span className="text-sm font-medium">{copy.french}</span>
            </button>
          </div>
        </div>

      </div>
    </div>);

}
