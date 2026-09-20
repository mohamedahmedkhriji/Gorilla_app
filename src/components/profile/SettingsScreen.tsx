import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { Bell, Shield, User, MapPin, ChevronDown, ChevronRight, Eye, EyeOff, Languages } from 'lucide-react';
import { applyTheme, getActiveTheme, getStoredTheme } from '../../services/theme';
import { AppLanguage, applyLanguage, getActiveLanguage, getStoredLanguage, normalizeLocalizedValue } from '../../services/language';
import { api } from '../../services/api';
import {
  resetAllCoachmarkProgress,
} from '../../services/coachmarks';
import { getStoredAppUser, persistStoredUser } from '../../shared/authStorage';
import { useScrollToTopOnChange } from '../../shared/scroll';
import {
  resolvePreferredBodyMapBody,
  setStoredBodyMapBodyPreference,
  type BodyMapBody,
} from '../../lib/body-map-body';
interface SettingsScreenProps {
  onBack: () => void;
  onOpenGym?: () => void;
  onOpenHomeTour?: () => void;
}

type NotificationPreferenceKey =
  | 'coachMessages'
  | 'restTimer'
  | 'missionChallenge'
  | 'training'
  | 'social'
  | 'challenges'
  | 'gym'
  | 'content'
  | 'shop'
  | 'subscription';

const APP_STYLE_GENDER_STORAGE_KEY = 'appStyleGender';

const normalizeStyleGender = (value: unknown): 'male' | 'female' => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girls' || normalized === 'femme'
    ? 'female'
    : 'male';
};

const getStoredAppStyleGender = () => {
  if (typeof window === 'undefined') return normalizeStyleGender(getStoredAppUser()?.gender);
  const saved = window.localStorage.getItem(APP_STYLE_GENDER_STORAGE_KEY);
  return saved ? normalizeStyleGender(saved) : normalizeStyleGender(getStoredAppUser()?.gender);
};

const setStoredAppStyleGender = (gender: 'male' | 'female') => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(APP_STYLE_GENDER_STORAGE_KEY, gender);
  window.dispatchEvent(new CustomEvent('repset:app-style-gender-changed', { detail: { gender } }));
};

const NOTIFICATION_CATEGORY_LABELS: Record<AppLanguage, Record<Exclude<NotificationPreferenceKey, 'coachMessages' | 'restTimer' | 'missionChallenge'>, string>> = {
  en: { training: 'Training', social: 'Social', challenges: 'Challenges', gym: 'Gym', content: 'Books & Content', shop: 'Shop Promotions', subscription: 'Subscription Reminders' },
  fr: { training: 'Entrainement', social: 'Social', challenges: 'Defis', gym: 'Salle de sport', content: 'Livres et contenu', shop: 'Promotions boutique', subscription: "Rappels d'abonnement" },
  ar: { training: 'التدريب', social: 'التواصل الاجتماعي', challenges: 'التحديات', gym: 'النادي الرياضي', content: 'الكتب والمحتوى', shop: 'عروض المتجر', subscription: 'تذكيرات الاشتراك' },
  it: { training: 'Allenamento', social: 'Social', challenges: 'Sfide', gym: 'Palestra', content: 'Libri e contenuti', shop: 'Promozioni negozio', subscription: 'Promemoria abbonamento' },
  de: { training: 'Training', social: 'Sozial', challenges: 'Challenges', gym: 'Fitnessstudio', content: 'Buecher und Inhalte', shop: 'Shop-Angebote', subscription: 'Abo-Erinnerungen' },
};

const SETTINGS_I18N = {
  en: {
    settings: 'Settings',
    account: 'Account',
    personalDetails: 'Personal Details',
    privacyAndSecurity: 'Privacy & Security',
    preferences: 'Preferences',
    bodyVisual: 'Body Visual',
    bodyVisualDetail: 'Controls the body map shown in muscle cards and recovery views.',
    notifications: 'Notifications',
    notificationControls: 'Notification Controls',
    coachMessages: 'Coach Messages',
    restBetweenSets: 'Rest Between Sets',
    missionChallengeComplete: 'Mission & Challenge Complete',
    theme: 'Theme',
    appStyle: 'App Style',
    appStyleDetail: 'Controls the Man/Woman visual theme used around the app.',
    language: 'Language',
    english: 'English',
    italian: 'Italian',
    arabic: 'العربية',
    dark: 'Dark',
    light: 'Light',
    appTour: 'App Tour',
    showAppTour: 'Show App Tour',
    showAppTourDetail: 'Replay the home guidance any time you want a refresher.',
    logOut: 'Log Out',
    gymAccess: 'Gym Access',
    gymLocation: 'Iron Paradise Gym',
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
    sessionDuration: 'Gym Session Duration',
    preferredTime: 'Preferred Training Time',
    thirtyMinutes: '30 minutes',
    fortyFiveMinutes: '45 minutes',
    sixtyMinutes: '60 minutes',
    ninetyMinutes: '90 minutes',
    morningTime: 'Morning',
    afternoonTime: 'Afternoon',
    eveningTime: 'Evening',
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
  it: {
    settings: 'Impostazioni',
    account: 'Account',
    personalDetails: 'Dati personali',
    privacyAndSecurity: 'Privacy e sicurezza',
    preferences: 'Preferenze',
    bodyVisual: 'Visuale corpo',
    bodyVisualDetail: 'Controlla il corpo mostrato nelle schede muscolari e nel recupero.',
    notifications: 'Notifiche',
    notificationControls: 'Controlli notifiche',
    coachMessages: 'Messaggi del coach',
    restBetweenSets: 'Recupero tra le serie',
    missionChallengeComplete: 'Missioni e sfide completate',
    theme: 'Tema',
    appStyle: 'Stile app',
    appStyleDetail: 'Controlla il tema visivo Uomo/Donna usato nell app.',
    language: 'Lingua',
    english: 'Inglese',
    italian: 'Italiano',
    arabic: 'Arabo',
    dark: 'Scuro',
    light: 'Chiaro',
    appTour: 'Tour app',
    showAppTour: 'Mostra tour app',
    showAppTourDetail: 'Rivedi la guida della home quando vuoi un ripasso rapido.',
    logOut: 'Esci',
    gymAccess: 'Accesso palestra',
    gymLocation: 'Iron Paradise Gym',
    failedLoadNotificationSettings: 'Impossibile caricare le impostazioni notifiche',
    failedLoadPersonalDetails: 'Impossibile caricare i dati personali',
    failedSavePersonalDetails: 'Impossibile salvare i dati personali',
    failedUpdatePassword: 'Impossibile aggiornare la password',
    failedUpdateNotificationSettings: 'Impossibile aggiornare le impostazioni notifiche',
    savedSuccessfully: 'Salvataggio completato',
    fullName: 'Nome completo',
    email: 'Email',
    age: 'Eta',
    gender: 'Genere',
    select: 'Seleziona',
    man: 'Uomo',
    woman: 'Donna',
    heightCm: 'Altezza (cm)',
    weightKg: 'Peso (kg)',
    sessionDuration: 'Durata sessione in palestra',
    preferredTime: 'Orario di allenamento preferito',
    thirtyMinutes: '30 minuti',
    fortyFiveMinutes: '45 minuti',
    sixtyMinutes: '60 minuti',
    ninetyMinutes: '90 minuti',
    morningTime: 'Mattina',
    afternoonTime: 'Pomeriggio',
    eveningTime: 'Sera',
    saving: 'Salvataggio in corso...',
    saveChanges: 'Salva modifiche',
    changePassword: 'Cambia password',
    oldPassword: 'Password attuale',
    newPassword: 'Nuova password',
    confirmNewPassword: 'Conferma nuova password',
    updatingPassword: 'Aggiornamento password...',
    updatePassword: 'Aggiorna password',
    pleaseFillPasswordFields: 'Compila password attuale, nuova password e conferma',
    newPasswordMinLength: 'La nuova password deve contenere almeno 6 caratteri',
    confirmPasswordMismatch: 'La conferma password non corrisponde',
    passwordUpdated: 'Password aggiornata con successo',
    toggleLabelPrefix: 'Attiva o disattiva',
    privacyIntro: 'Riepilogo chiaro dei dati raccolti, di come vengono protetti e dei controlli disponibili per te.',
    privacyCards: [
      {
        title: '1. Dati raccolti',
        points: [
          'Dati personali: nome, email, eta e genere.',
          'Dati fitness: allenamenti, obiettivi, progressi e misure corporee.',
          'Dati salute facoltativi: calorie e input collegati alla frequenza cardiaca.',
          'Dati tecnici: utilizzo dell\'app e diagnostica crash.',
          'I dati di pagamento sono gestiti da fornitori di pagamento sicuri.',
        ],
      },
      {
        title: '2. Come proteggiamo i dati',
        points: [
          'Trasporto cifrato (HTTPS) per i dati in transito.',
          'Controlli di accesso sicuri per cloud e database.',
          'Accesso limitato al personale in base a ruolo e necessita.',
          'Controlli di sicurezza e aggiornamenti periodici di hardening.',
        ],
      },
      {
        title: '3. Controlli privacy per l\'utente',
        points: [
          'Gestisci i permessi delle notifiche in qualsiasi momento.',
          'Richiedi l\'esportazione dei dati dell\'account (flusso pianificato).',
          'Richiedi l\'eliminazione permanente dell\'account.',
          'Controlla profilo e preferenze di condivisione dati.',
        ],
      },
      {
        title: '4. Politica di condivisione dati',
        points: [
          'Nessuna vendita di dati personali.',
          'I dati vengono condivisi solo quando necessario: pagamenti, analisi e obblighi legali.',
        ],
      },
      {
        title: '5. Posizione e tracciamento',
        points: [
          'La posizione viene usata solo per funzioni fitness basate sulla posizione, se abilitate.',
          'Puoi disattivare il tracciamento posizione dalle impostazioni app o dispositivo.',
          'La conservazione dei dati di posizione segue il principio del minimo necessario.',
        ],
      },
      {
        title: '6. Sicurezza dei pagamenti',
        points: [
          'I pagamenti passano tramite processori di terze parti affidabili.',
          'I numeri di carta non vengono memorizzati direttamente sui nostri server.',
        ],
      },
      {
        title: '7. Funzioni di sicurezza account',
        points: [
          'Requisiti password robusti.',
          'Rilevamento accessi sospetti e controlli di protezione account.',
          'Il supporto 2FA puo essere aggiunto in versioni future.',
        ],
      },
      {
        title: '8. Conformita legale',
        points: [
          'Progettato seguendo principi privacy in stile GDPR.',
          'Rispetta i requisiti applicabili su protezione dati ed eta.',
        ],
      },
      {
        title: '9. Contatti e supporto',
        points: [
          'Per richieste privacy: privacy@repset.app',
          'Per supporto: usa il canale supporto/contatti dentro l\'app.',
        ],
      },
    ],
  },
  ar: {
    settings: 'الإعدادات',
    account: 'الحساب',
    personalDetails: 'البيانات الشخصية',
    privacyAndSecurity: 'الخصوصية والأمان',
    preferences: 'التفضيلات',
    bodyVisual: 'شكل الجسم',
    bodyVisualDetail: 'يتحكم في خريطة الجسم داخل بطاقات العضلات وشاشات الاستشفاء.',
    notifications: 'الإشعارات',
    notificationControls: 'إعدادات الإشعارات',
    coachMessages: 'رسائل المدرب',
    restBetweenSets: 'الراحة بين الجولات',
    missionChallengeComplete: 'إكمال المهام والتحديات',
    theme: 'المظهر',
    appStyle: 'نمط التطبيق',
    appStyleDetail: 'يتحكم في مظهر الرجل/المرأة داخل التطبيق.',
    language: 'اللغة',
    english: 'الإنجليزية',
    italian: 'الإيطالية',
    arabic: 'العربية',
    dark: 'داكن',
    light: 'فاتح',
    appTour: 'جولة التطبيق',
    showAppTour: 'عرض جولة التطبيق',
    showAppTourDetail: 'أعد تشغيل إرشادات الصفحة الرئيسية في أي وقت.',
    logOut: 'تسجيل الخروج',
    gymAccess: 'دخول النادي',
    gymLocation: 'آيرون بارادايس جيم',
    failedLoadNotificationSettings: 'فشل تحميل إعدادات الإشعارات',
    failedLoadPersonalDetails: 'فشل تحميل البيانات الشخصية',
    failedSavePersonalDetails: 'فشل حفظ البيانات الشخصية',
    failedUpdatePassword: 'فشل تحديث كلمة المرور',
    failedUpdateNotificationSettings: 'فشل تحديث إعدادات الإشعارات',
    savedSuccessfully: 'تم الحفظ بنجاح',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    age: 'العمر',
    gender: 'الجنس',
    select: 'اختر',
    man: 'ذكر',
    woman: 'أنثى',
    heightCm: 'الطول (سم)',
    weightKg: 'الوزن (كجم)',
    sessionDuration: 'مدة التمرين',
    preferredTime: 'وقت التدريب المفضل',
    thirtyMinutes: '30 دقيقة',
    fortyFiveMinutes: '45 دقيقة',
    sixtyMinutes: '60 دقيقة',
    ninetyMinutes: '90 دقيقة',
    morningTime: 'صباحًا',
    afternoonTime: 'ظهرًا',
    eveningTime: 'مساءً',
    saving: 'جارٍ الحفظ...',
    saveChanges: 'حفظ التغييرات',
    changePassword: 'تغيير كلمة المرور',
    oldPassword: 'كلمة المرور القديمة',
    newPassword: 'كلمة المرور الجديدة',
    confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
    updatingPassword: 'جارٍ تحديث كلمة المرور...',
    updatePassword: 'تحديث كلمة المرور',
    pleaseFillPasswordFields: 'يرجى إدخال كلمة المرور القديمة والجديدة وتأكيدها',
    newPasswordMinLength: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل',
    confirmPasswordMismatch: 'تأكيد كلمة المرور غير مطابق',
    passwordUpdated: 'تم تحديث كلمة المرور بنجاح',
    toggleLabelPrefix: 'تبديل',
    privacyIntro: 'ملخص واضح للبيانات التي يتم جمعها، وكيف نحميها، وما هي أدوات التحكم المتاحة لك.',
    privacyCards: [
      {
        title: '1. البيانات التي تجمعها',
        points: [
          'بيانات شخصية: الاسم، البريد الإلكتروني، العمر، الجنس.',
          'بيانات اللياقة: التمارين، الأهداف، التقدم، ومقاييس الجسم.',
          'بيانات صحية اختيارية: السعرات وعناصر مرتبطة بمعدل نبض القلب.',
          'بيانات تقنية: استخدام التطبيق وتشخيص الأعطال.',
          'بيانات الدفع تتم معالجتها عبر مزودي دفع آمنين.',
        ],
      },
      {
        title: '2. كيف نحمي البيانات',
        points: [
          'تشفير النقل (HTTPS) للبيانات أثناء الإرسال.',
          'ضوابط وصول آمنة للسحابة/قاعدة البيانات.',
          'وصول محدود للموظفين حسب الدور والحاجة.',
          'فحوصات أمنية وتحديثات حماية دورية.',
        ],
      },
      {
        title: '3. أدوات الخصوصية للمستخدم',
        points: [
          'إدارة أذونات الإشعارات في أي وقت.',
          'طلب تصدير بيانات الحساب (مسار مخطط).',
          'طلب حذف الحساب نهائيًا.',
          'التحكم في إعدادات الملف الشخصي ومشاركة البيانات.',
        ],
      },
      {
        title: '4. سياسة مشاركة البيانات',
        points: [
          'لا نقوم ببيع البيانات الشخصية.',
          'تتم مشاركة البيانات فقط عند الحاجة: الدفع، التحليلات، الالتزامات القانونية.',
        ],
      },
      {
        title: '5. الموقع والتتبع',
        points: [
          'يُستخدم الموقع فقط لميزات اللياقة المعتمدة على الموقع (عند التفعيل).',
          'يمكن للمستخدم تعطيل تتبع الموقع من إعدادات التطبيق/الجهاز.',
          'الاحتفاظ ببيانات الموقع يتم وفق مبدأ الحد الأدنى اللازم.',
        ],
      },
      {
        title: '6. أمان الدفع',
        points: [
          'تتم المدفوعات عبر مزودي دفع موثوقين من طرف ثالث.',
          'أرقام البطاقات لا يتم تخزينها مباشرة على خوادمنا.',
        ],
      },
      {
        title: '7. ميزات أمان الحساب',
        points: [
          'متطلبات قوية لكلمات المرور.',
          'كشف عمليات تسجيل الدخول المشبوهة وإجراءات حماية الحساب.',
          'يمكن إضافة دعم المصادقة الثنائية في إصدارات قادمة.',
        ],
      },
      {
        title: '8. الامتثال القانوني',
        points: [
          'مصمم وفق مبادئ خصوصية شبيهة بـ GDPR.',
          'يلتزم بمتطلبات حماية البيانات والمتطلبات العمرية المعمول بها.',
        ],
      },
      {
        title: '9. التواصل والدعم',
        points: [
          'لاستفسارات الخصوصية: privacy@repset.app',
          'للدعم: استخدم قناة الدعم/التواصل داخل التطبيق.',
        ],
      },
    ],
  },
} as const;

const SETTINGS_I18N_WITH_DE = {
  ...SETTINGS_I18N,
  de: {
    ...SETTINGS_I18N.en,
    settings: 'Einstellungen',
    account: 'Konto',
    personalDetails: 'Personliche Daten',
    privacyAndSecurity: 'Datenschutz & Sicherheit',
    preferences: 'Einstellungen',
    bodyVisual: 'Korperansicht',
    bodyVisualDetail: 'Steuert die Korperkarte in Muskelkarten und Erholungsansichten.',
    notifications: 'Benachrichtigungen',
    notificationControls: 'Benachrichtigungssteuerung',
    coachMessages: 'Coach-Nachrichten',
    restBetweenSets: 'Pause zwischen den Satzen',
    missionChallengeComplete: 'Missionen & Challenges abgeschlossen',
    theme: 'Design',
    appStyle: 'App-Stil',
    appStyleDetail: 'Steuert den Mann/Frau-Look in der App.',
    language: 'Sprache',
    english: 'Englisch',
    italian: 'Italienisch',
    arabic: 'Arabisch',
    dark: 'Dunkel',
    light: 'Hell',
    appTour: 'App-Tour',
    showAppTour: 'App-Tour anzeigen',
    showAppTourDetail: 'Spiele die Home-Einfuhrung jederzeit erneut ab.',
    logOut: 'Abmelden',
    gymAccess: 'Studiozugang',
    failedLoadNotificationSettings: 'Benachrichtigungseinstellungen konnten nicht geladen werden',
    failedLoadPersonalDetails: 'Personliche Daten konnten nicht geladen werden',
    failedSavePersonalDetails: 'Personliche Daten konnten nicht gespeichert werden',
    failedUpdatePassword: 'Passwort konnte nicht aktualisiert werden',
    failedUpdateNotificationSettings: 'Benachrichtigungseinstellungen konnten nicht aktualisiert werden',
    savedSuccessfully: 'Erfolgreich gespeichert',
    fullName: 'Vollstandiger Name',
    age: 'Alter',
    gender: 'Geschlecht',
    select: 'Auswahlen',
    man: 'Mann',
    woman: 'Frau',
    heightCm: 'Grosse (cm)',
    weightKg: 'Gewicht (kg)',
    sessionDuration: 'Trainingsdauer im Studio',
    preferredTime: 'Bevorzugte Trainingszeit',
    thirtyMinutes: '30 Minuten',
    fortyFiveMinutes: '45 Minuten',
    sixtyMinutes: '60 Minuten',
    ninetyMinutes: '90 Minuten',
    morningTime: 'Morgen',
    afternoonTime: 'Nachmittag',
    eveningTime: 'Abend',
    saving: 'Speichern...',
    saveChanges: 'Anderungen speichern',
    changePassword: 'Passwort andern',
    oldPassword: 'Altes Passwort',
    newPassword: 'Neues Passwort',
    confirmNewPassword: 'Neues Passwort bestatigen',
    updatingPassword: 'Passwort wird aktualisiert...',
    updatePassword: 'Passwort aktualisieren',
    pleaseFillPasswordFields: 'Bitte altes, neues und bestatigtes Passwort ausfullen',
    newPasswordMinLength: 'Das neue Passwort muss mindestens 6 Zeichen lang sein',
    confirmPasswordMismatch: 'Die Passwortbestatigung stimmt nicht uberein',
    passwordUpdated: 'Passwort erfolgreich aktualisiert',
    toggleLabelPrefix: 'Umschalten',
    privacyIntro: 'Klare Ubersicht daruber, welche Daten gesammelt werden, wie sie geschutzt werden und welche Einstellungen dir zur Verfugung stehen.',
    privacyCards: [
      {
        title: '1. Daten, die du bereitstellst',
        points: [
          'Personliche Daten: Name, E-Mail, Alter und Geschlecht.',
          'Fitnessdaten: Workouts, Ziele, Fortschritt und Korperwerte.',
          'Optionale Gesundheitsdaten: Kalorien und herzfrequenzbezogene Eingaben.',
          'Technische Daten: App-Nutzung und Absturzdiagnosen.',
          'Zahlungsdaten werden von sicheren Zahlungsanbietern verarbeitet.',
        ],
      },
      {
        title: '2. Wie wir Daten schutzen',
        points: [
          'Verschlusselte Ubertragung (HTTPS) fur Daten wahrend der Ubermittlung.',
          'Sichere Zugriffssteuerung fur Cloud und Datenbank.',
          'Begrenzter Mitarbeiterzugriff nach Rolle und Bedarf.',
          'Sicherheitsprufungen und regelmassige Hardening-Updates.',
        ],
      },
      {
        title: '3. Datenschutzkontrollen fur Nutzer',
        points: [
          'Benachrichtigungsrechte konnen jederzeit verwaltet werden.',
          'Export deiner Kontodaten anfordern (geplanter Ablauf).',
          'Dauerhafte Loschung des Kontos anfordern.',
          'Profil- und Freigabeeinstellungen selbst steuern.',
        ],
      },
      {
        title: '4. Richtlinie zur Datenweitergabe',
        points: [
          'Keine Weiterverauferung personlicher Daten.',
          'Daten werden nur bei Bedarf geteilt: Zahlungsanbieter, Analysen oder gesetzliche Pflichten.',
        ],
      },
      {
        title: '5. Standort & Tracking',
        points: [
          'Standort wird nur fur standortbasierte Fitnessfunktionen genutzt, wenn aktiviert.',
          'Nutzer konnen Standorttracking in den App- oder Gerateeinstellungen deaktivieren.',
          'Standortdaten werden nur so lange wie notig gespeichert.',
        ],
      },
      {
        title: '6. Zahlungssicherheit',
        points: [
          'Zahlungen laufen uber vertrauenswurdige Drittanbieter.',
          'Kartennummern werden nicht direkt auf unseren Servern gespeichert.',
        ],
      },
      {
        title: '7. Kontosicherheitsfunktionen',
        points: [
          'Starke Passwortanforderungen.',
          'Erkennung verdachtiger Anmeldungen und Schutzmechanismen fur Konten.',
          '2FA-Unterstutzung kann in zukunftigen Versionen hinzugefugt werden.',
        ],
      },
      {
        title: '8. Rechtliche Konformitat',
        points: [
          'Entwickelt nach Datenschutzprinzipien im Stil der DSGVO.',
          'Beachtet geltende Datenschutz- und altersbezogene Anforderungen.',
        ],
      },
      {
        title: '9. Kontakt & Support',
        points: [
          'Bei Datenschutzfragen: privacy@repset.app',
          'Fur Support: Nutze den Support-/Kontaktbereich in der App.',
        ],
      },
    ],
  },
  fr: {
    ...SETTINGS_I18N.en,
    settings: 'Parametres',
    account: 'Compte',
    personalDetails: 'Informations personnelles',
    privacyAndSecurity: 'Confidentialite et securite',
    preferences: 'Preferences',
    bodyVisual: 'Vue du corps',
    bodyVisualDetail: 'Controle le corps affiche dans les cartes musculaires et la recuperation.',
    notifications: 'Notifications',
    notificationControls: 'Controle des notifications',
    coachMessages: 'Messages du coach',
    restBetweenSets: 'Repos entre les series',
    missionChallengeComplete: 'Missions et defis termines',
    theme: 'Theme',
    appStyle: 'Style de l app',
    appStyleDetail: 'Controle le theme visuel Homme/Femme utilise dans l app.',
    language: 'Langue',
    english: 'Anglais',
    italian: 'Italien',
    arabic: 'Arabe',
    dark: 'Sombre',
    light: 'Clair',
    appTour: 'Visite de l app',
    showAppTour: 'Afficher la visite',
    showAppTourDetail: 'Relance la visite de l accueil quand tu veux un rappel rapide.',
    logOut: 'Se deconnecter',
    gymAccess: 'Acces a la salle',
    failedLoadNotificationSettings: 'Impossible de charger les parametres de notification',
    failedLoadPersonalDetails: 'Impossible de charger les informations personnelles',
    failedSavePersonalDetails: 'Impossible d enregistrer les informations personnelles',
    failedUpdatePassword: 'Impossible de mettre a jour le mot de passe',
    failedUpdateNotificationSettings: 'Impossible de mettre a jour les notifications',
    savedSuccessfully: 'Enregistre avec succes',
    fullName: 'Nom complet',
    age: 'Age',
    gender: 'Genre',
    select: 'Selectionner',
    man: 'Homme',
    woman: 'Femme',
    heightCm: 'Taille (cm)',
    weightKg: 'Poids (kg)',
    sessionDuration: 'Duree de la seance a la salle',
    preferredTime: 'Heure d entrainement preferee',
    thirtyMinutes: '30 minutes',
    fortyFiveMinutes: '45 minutes',
    sixtyMinutes: '60 minutes',
    ninetyMinutes: '90 minutes',
    morningTime: 'Matin',
    afternoonTime: 'Apres-midi',
    eveningTime: 'Soir',
    saving: 'Enregistrement...',
    saveChanges: 'Enregistrer les modifications',
    changePassword: 'Changer le mot de passe',
    oldPassword: 'Ancien mot de passe',
    newPassword: 'Nouveau mot de passe',
    confirmNewPassword: 'Confirmer le nouveau mot de passe',
    updatingPassword: 'Mise a jour du mot de passe...',
    updatePassword: 'Mettre a jour le mot de passe',
    pleaseFillPasswordFields: 'Renseigne l ancien mot de passe, le nouveau et la confirmation',
    newPasswordMinLength: 'Le nouveau mot de passe doit contenir au moins 6 caracteres',
    confirmPasswordMismatch: 'La confirmation du mot de passe ne correspond pas',
    passwordUpdated: 'Mot de passe mis a jour avec succes',
    toggleLabelPrefix: 'Basculer',
  },
} as const;

const PRIVACY_POLICY_DOCUMENT = {
  appName: 'RepSet',
  title: 'Privacy Policy & Terms Summary',
  metadata: ['Last updated: April 2026', 'English', 'Applies to all accounts'],
  importantNotice:
    'By creating an account or continuing to use RepSet, you agree to this policy in full. Existing account holders are bound by these terms. Any future changes to this policy will be considered accepted by continued use of the app.',
  sections: [
    {
      heading: '1. Data we collect',
      points: [
        'Personal info: name, email address, age, and gender.',
        'Fitness data: workouts, goals, progress, and body metrics.',
        'Optional health data: calorie intake and heart-rate related inputs.',
        'Technical data: app usage patterns and crash diagnostics.',
        'Payment data: handled exclusively by secure third-party payment providers.',
        'Product improvement: The RepSet development team may use your personal data (including usage patterns and fitness data) to analyze, improve, and develop new features within the app. This data is processed internally and used solely to enhance your experience.',
      ],
    },
    {
      heading: '2. How we protect your data',
      points: [
        'Encrypted transport (HTTPS) for all data in transit.',
        'Secure cloud and database access controls.',
        'Staff access limited strictly by role and operational need.',
        'Regular security audits and routine system hardening updates.',
      ],
    },
    {
      heading: '3. Your privacy controls',
      points: [
        'Manage notification permissions at any time from app settings.',
        'Request an export of your account data (feature in progress).',
        'Request permanent deletion of your account and associated data.',
        'Control your profile visibility and data-sharing preferences.',
      ],
    },
    {
      heading: '4. Data sharing policy',
      points: [
        'We do not sell your personal data to any third party.',
        'Data is shared only as necessary with: payment processors, analytics providers, and where required by law.',
      ],
    },
    {
      heading: '5. Location & tracking',
      points: [
        'Location is used only to power location-based fitness features, if you have enabled them.',
        'You can disable location tracking at any time via app or device settings.',
        'Location data is stored only for the minimum period necessary.',
      ],
    },
    {
      heading: '6. Payment & subscriptions',
      points: [
        'Payments are processed by trusted third-party providers. We do not store card numbers on our servers.',
        'Auto-renewal: All RepSet subscriptions automatically renew at the end of each billing period. You will be charged the applicable subscription fee unless you cancel before the renewal date. You can manage or cancel your subscription at any time through your app store account settings.',
      ],
    },
    {
      heading: '7. Account security',
      points: [
        'Strong password requirements are enforced on all accounts.',
        'Suspicious login detection and account protection controls are active.',
        'Two-factor authentication (2FA) support planned for a future release.',
      ],
    },
    {
      heading: '8. Dispute resolution & liability',
      points: [
        'Mandatory arbitration: Any dispute, claim, or controversy arising out of or relating to your use of RepSet shall be resolved exclusively through binding individual arbitration, not through court litigation or class action proceedings. By using this app, you waive the right to a jury trial or participation in any class action lawsuit to the fullest extent permitted by applicable law.',
        'RepSet\'s liability is limited to the maximum extent permitted by applicable law.',
        'Nothing in this clause limits rights you may have under mandatory consumer protection laws in your jurisdiction.',
      ],
    },
    {
      heading: '9. Legal compliance',
      points: [
        'Designed in accordance with GDPR-style privacy principles.',
        'Respects applicable data protection and age-related legal requirements.',
      ],
    },
    {
      heading: '10. Changes to this policy',
      points: [
        'We may update this policy at any time. Continued use of RepSet after any changes constitutes your acceptance of the revised policy. We recommend reviewing this page periodically.',
      ],
    },
    {
      heading: '11. Contact & support',
      points: [
        'Privacy concerns: privacy@repset.app',
        'General support: In-app support / contact channel',
      ],
    },
  ],
  footer:
    'RepSet © 2026. This document constitutes the complete privacy policy and governs your use of the RepSet application. Existing account holders are considered to have accepted these terms. All rights reserved.',
} as const;

export function SettingsScreen({ onBack, onOpenGym, onOpenHomeTour }: SettingsScreenProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [appStyleGender, setAppStyleGender] = useState<'male' | 'female'>('male');
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
    sessionDuration: '60',
    preferredTime: 'evening',
    primaryGoal: '',
    fitnessGoal: '',
    experienceLevel: '',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    coachMessages: true,
    restTimer: true,
    missionChallenge: true,
    training: true,
    social: true,
    challenges: true,
    gym: true,
    content: true,
    shop: true,
    subscription: true,
  });
  const [loadingNotificationSettings, setLoadingNotificationSettings] = useState(false);
  const [notificationSettingsError, setNotificationSettingsError] = useState('');
  const [bodyMapBody, setBodyMapBody] = useState<BodyMapBody>('male');
  const copy = normalizeLocalizedValue(SETTINGS_I18N_WITH_DE[language] || SETTINGS_I18N_WITH_DE.en);
  const isGirlsTheme = appStyleGender === 'female';
  const pageClassName = isGirlsTheme
    ? 'settings-screen--girls flex-1 flex flex-col min-h-screen pb-24 bg-[radial-gradient(circle_at_top_left,rgba(249,178,215,0.22),transparent_36%),linear-gradient(180deg,#FFF5F5_0%,#F7D6D0_58%,#FFF5F5_100%)] text-[#4A4A4A]'
    : 'flex-1 flex flex-col bg-background min-h-screen pb-24';
  const sectionTitleClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-text-secondary';
  const cardClassName = isGirlsTheme
    ? 'border border-[#E2B4BD]/45 bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(255,245,245,0.76)_48%,rgba(207,236,243,0.30))] shadow-[0_14px_34px_rgba(226,180,189,0.16)] ring-1 ring-white/45'
    : 'bg-card border border-white/5';
  const listCardClassName = isGirlsTheme
    ? 'border border-[#E2B4BD]/45 bg-white/72 shadow-[0_14px_34px_rgba(226,180,189,0.14)] ring-1 ring-white/40'
    : 'bg-card border border-white/5';
  const primaryTextClassName = isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white';
  const secondaryTextClassName = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';
  const tertiaryTextClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary';
  const iconChipClassName = isGirlsTheme
    ? 'border border-[#F9B2D7]/45 bg-[#F9B2D7]/18 text-[#A87884] shadow-[0_8px_18px_rgba(249,178,215,0.14)]'
    : 'bg-blue-500/10 text-blue-500';
  const personalInputClassName = isGirlsTheme
    ? 'w-full border border-[#E2B4BD]/45 bg-white/70 px-3 py-2 text-sm text-[#4A4A4A] outline-none transition-colors placeholder:text-[#A87884] focus:border-[#F9B2D7]/75 focus:ring-2 focus:ring-[#F9B2D7]/20'
    : 'w-full bg-background border border-white/10 px-3 py-2 text-white text-sm outline-none focus:border-accent/60';
  const personalSelectClassName = isGirlsTheme
    ? 'w-full appearance-none border border-[#E2B4BD]/45 bg-white/70 px-3 py-2.5 pr-9 text-sm text-[#4A4A4A] outline-none transition-colors focus:border-[#F9B2D7]/75 focus:ring-2 focus:ring-[#F9B2D7]/20'
    : 'w-full appearance-none bg-background border border-white/10 px-3 py-2.5 pr-9 text-white text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-colors';
  const segmentedClassName = isGirlsTheme
    ? 'border border-[#E2B4BD]/45 bg-white/65 shadow-inner'
    : 'border border-white/10 bg-background';
  const languageActiveClass = isGirlsTheme
    ? 'bg-[#F9B2D7]/28 border-[#F9B2D7]/70 text-[#4A4A4A] shadow-[0_8px_18px_rgba(249,178,215,0.18)]'
    : 'bg-white/10 border-accent text-white';
  const languageInactiveClass = isGirlsTheme
    ? 'bg-white/65 border-[#E2B4BD]/40 text-[#795E67] hover:border-[#F9B2D7]/65 hover:text-[#4A4A4A] hover:bg-white/80'
    : 'bg-background border-white/10 text-text-secondary hover:bg-white/5';
  const genderStyleOptions = [
    { value: 'male' as const, label: copy.man },
    { value: 'female' as const, label: copy.woman },
  ];

  useScrollToTopOnChange([activePage]);

  useEffect(() => {
    const resolveStoredGender = () => {
      return getStoredAppStyleGender();
    };

    setTheme(getActiveTheme());
    setLanguage(getActiveLanguage());
    setBodyMapBody(resolvePreferredBodyMapBody(getStoredAppUser()?.gender));
    setAppStyleGender(resolveStoredGender());

    const onThemeChanged = () => {
      setTheme(getStoredTheme());
    };
    const onLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };
    const onStoredUserChanged = () => {
      const nextGender = resolveStoredGender();
      setAppStyleGender(nextGender);
      setBodyMapBody(resolvePreferredBodyMapBody(nextGender));
    };

    window.addEventListener('app-theme-changed', onThemeChanged);
    window.addEventListener('app-language-changed', onLanguageChanged);
    window.addEventListener('repset:stored-user-changed', onStoredUserChanged);
    window.addEventListener('repset:app-style-gender-changed', onStoredUserChanged);
    window.addEventListener('storage', onThemeChanged);
    window.addEventListener('storage', onLanguageChanged);
    window.addEventListener('storage', onStoredUserChanged);

    return () => {
      window.removeEventListener('app-theme-changed', onThemeChanged);
      window.removeEventListener('app-language-changed', onLanguageChanged);
      window.removeEventListener('repset:stored-user-changed', onStoredUserChanged);
      window.removeEventListener('repset:app-style-gender-changed', onStoredUserChanged);
      window.removeEventListener('storage', onThemeChanged);
      window.removeEventListener('storage', onLanguageChanged);
      window.removeEventListener('storage', onStoredUserChanged);
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

  const handleBodyMapBodyChange = (nextBody: BodyMapBody) => {
    setStoredBodyMapBodyPreference(nextBody);
    setBodyMapBody(nextBody);
  };

  const handleAppStyleGenderChange = (nextGender: 'male' | 'female') => {
    setAppStyleGender(nextGender);
    setStoredAppStyleGender(nextGender);
    setStoredBodyMapBodyPreference(nextGender);
    setBodyMapBody(nextGender);
    setPersonalDetails((prev) => ({ ...prev, gender: nextGender }));

    const storedUser = getStoredAppUser() || {};
    persistStoredUser({
      ...storedUser,
      gender: nextGender,
    });

    const userId = Number(storedUser?.id || storedUser?.userId || 0);
    if (!userId) return;

    void (async () => {
      try {
        const details = await api.getProfileDetails(userId);
        await api.updateProfileDetails(userId, {
          name: details?.name || storedUser?.name || '',
          email: details?.email || storedUser?.email || '',
          age: details?.age ?? null,
          gender: nextGender,
          heightCm: details?.heightCm ?? null,
          weightKg: details?.weightKg ?? null,
          primaryGoal: details?.primaryGoal || '',
          fitnessGoal: details?.fitnessGoal || '',
          experienceLevel: details?.experienceLevel || '',
          sessionDuration: details?.sessionDuration ?? undefined,
          preferredTime: details?.preferredTime || undefined,
        });
      } catch (error) {
        console.warn('Failed to sync app style gender to profile:', error);
      }
    })();
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
          training: data?.training !== false,
          social: data?.social !== false,
          challenges: data?.challenges !== false,
          gym: data?.gym !== false,
          content: data?.content !== false,
          shop: data?.shop !== false,
          subscription: data?.subscription !== false,
        };
        setNotificationSettings(next);
        localStorage.setItem('notificationSettings', JSON.stringify(next));
      } catch (error: any) {
        const fallbackCopy = SETTINGS_I18N_WITH_DE[getStoredLanguage()] || SETTINGS_I18N_WITH_DE.en;
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
          sessionDuration: data?.sessionDuration == null ? '60' : String(data.sessionDuration),
          preferredTime: data?.preferredTime || 'evening',
          primaryGoal: data?.primaryGoal || '',
          fitnessGoal: data?.fitnessGoal || '',
          experienceLevel: data?.experienceLevel || '',
        });
      } catch (error: any) {
        const fallbackCopy = SETTINGS_I18N_WITH_DE[getStoredLanguage()] || SETTINGS_I18N_WITH_DE.en;
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
        sessionDuration: personalDetails.sessionDuration.trim() ? Number(personalDetails.sessionDuration) : null,
        preferredTime: personalDetails.preferredTime || null,
      });
      const nextUser = {
        ...user,
        name: personalDetails.name,
        email: personalDetails.email,
        gender: personalDetails.gender,
      };
      persistStoredUser(nextUser);
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
    return (
      <div className={pageClassName}>
        <div className="px-4 sm:px-6 pt-2">
          <Header title={copy.privacyAndSecurity} onBack={() => setActivePage('settings')} compact titleClassName={isGirlsTheme ? '!text-[#4A4A4A]' : undefined} />
        </div>
        <div className="px-4 sm:px-6 pb-8">
          <article className={`mx-auto max-w-3xl space-y-8 text-left ${isGirlsTheme ? 'rounded-[1.75rem] border border-[#E2B4BD]/45 bg-white/72 p-5 shadow-[0_18px_44px_rgba(226,180,189,0.16)] ring-1 ring-white/45 sm:p-7' : ''}`}>
            <header className="space-y-3">
              <p className={`text-sm font-medium uppercase tracking-[0.18em] ${isGirlsTheme ? 'text-[#A87884]' : 'text-accent/80'}`}>
                {PRIVACY_POLICY_DOCUMENT.appName}
              </p>
              <div className="space-y-2">
                <h2 className={`text-2xl font-semibold leading-tight sm:text-3xl ${primaryTextClassName}`}>
                  {PRIVACY_POLICY_DOCUMENT.title}
                </h2>
                <div className={`flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.14em] sm:text-sm ${tertiaryTextClassName}`}>
                  {PRIVACY_POLICY_DOCUMENT.metadata.map((item) => (
                    <span key={item} className={isGirlsTheme ? 'rounded-full border border-[#E2B4BD]/35 bg-[#FFF5F5]/70 px-2.5 py-1' : ''}>{item}</span>
                  ))}
                </div>
              </div>
            </header>

            <section className={`space-y-2 ${isGirlsTheme ? 'rounded-2xl border border-[#F9B2D7]/35 bg-[#FFF5F5]/66 p-4' : ''}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-[0.14em] ${primaryTextClassName}`}>
                Important notice
              </h3>
              <p className={`text-sm leading-7 sm:text-base ${secondaryTextClassName}`}>
                {PRIVACY_POLICY_DOCUMENT.importantNotice}
              </p>
            </section>

            {PRIVACY_POLICY_DOCUMENT.sections.map((section) => (
              <section key={section.heading} className={`space-y-3 ${isGirlsTheme ? 'rounded-2xl border border-[#E2B4BD]/35 bg-white/55 p-4 shadow-[0_10px_24px_rgba(226,180,189,0.10)]' : ''}`}>
                <h3 className={`text-base font-semibold sm:text-lg ${primaryTextClassName}`}>
                  {section.heading}
                </h3>
                <ul className="space-y-3">
                  {section.points.map((point) => (
                    <li
                      key={point}
                      className={`text-sm leading-7 break-words [overflow-wrap:anywhere] sm:text-base ${secondaryTextClassName}`}
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <footer className={`border-t pt-6 ${isGirlsTheme ? 'border-[#E2B4BD]/35' : 'border-white/10'}`}>
              <p className={`text-sm leading-7 sm:text-base ${secondaryTextClassName}`}>
                {PRIVACY_POLICY_DOCUMENT.footer}
              </p>
            </footer>
          </article>
        </div>
      </div>
    );
  }

  if (activePage === 'personal') {
    return (
      <div className={pageClassName}>
        <div className="px-4 sm:px-6 pt-2">
          <Header title={copy.personalDetails} onBack={() => setActivePage('settings')} compact titleClassName={isGirlsTheme ? '!text-[#4A4A4A]' : undefined} />
        </div>

        <div className="px-4 sm:px-6 space-y-3">
          <div className={`rounded-2xl p-4 space-y-3 ${cardClassName}`}>
            <div>
              <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{copy.fullName}</label>
              <input
                value={personalDetails.name}
                onChange={(e) => setPersonalDetails((prev) => ({ ...prev, name: e.target.value }))}
                className={`${personalInputClassName} rounded-lg`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{copy.email}</label>
              <input
                type="email"
                value={personalDetails.email}
                onChange={(e) => setPersonalDetails((prev) => ({ ...prev, email: e.target.value }))}
                className={`${personalInputClassName} rounded-lg`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{copy.age}</label>
                <input
                  type="number"
                  value={personalDetails.age}
                  onChange={(e) => setPersonalDetails((prev) => ({ ...prev, age: e.target.value }))}
                  className={`${personalInputClassName} rounded-lg`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{copy.gender}</label>
                <div className="relative">
                  <select
                    value={personalDetails.gender}
                    onChange={(e) => setPersonalDetails((prev) => ({ ...prev, gender: e.target.value }))}
                    className={`${personalSelectClassName} rounded-xl`}
                  >
                    <option value="">{copy.select}</option>
                    <option value="male">{copy.man}</option>
                    <option value="female">{copy.woman}</option>
                  </select>
                  <ChevronDown size={16} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${tertiaryTextClassName}`} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{copy.heightCm}</label>
                <input
                  type="number"
                  value={personalDetails.heightCm}
                  onChange={(e) => setPersonalDetails((prev) => ({ ...prev, heightCm: e.target.value }))}
                  className={`${personalInputClassName} rounded-lg`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{copy.weightKg}</label>
                <input
                  type="number"
                  value={personalDetails.weightKg}
                  onChange={(e) => setPersonalDetails((prev) => ({ ...prev, weightKg: e.target.value }))}
                  className={`${personalInputClassName} rounded-lg`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{copy.sessionDuration}</label>
                <div className="relative">
                  <select
                    value={personalDetails.sessionDuration}
                    onChange={(e) => setPersonalDetails((prev) => ({ ...prev, sessionDuration: e.target.value }))}
                    className={`${personalSelectClassName} rounded-xl`}
                  >
                    <option value="30">{copy.thirtyMinutes}</option>
                    <option value="45">{copy.fortyFiveMinutes}</option>
                    <option value="60">{copy.sixtyMinutes}</option>
                    <option value="90">{copy.ninetyMinutes}</option>
                  </select>
                  <ChevronDown size={16} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${tertiaryTextClassName}`} />
                </div>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{copy.preferredTime}</label>
                <div className="relative">
                  <select
                    value={personalDetails.preferredTime}
                    onChange={(e) => setPersonalDetails((prev) => ({ ...prev, preferredTime: e.target.value }))}
                    className={`${personalSelectClassName} rounded-xl`}
                  >
                    <option value="morning">{copy.morningTime}</option>
                    <option value="afternoon">{copy.afternoonTime}</option>
                    <option value="evening">{copy.eveningTime}</option>
                  </select>
                  <ChevronDown size={16} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${tertiaryTextClassName}`} />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={savePersonalDetails}
              disabled={savingDetails}
              className={`w-full rounded-xl font-semibold py-3 transition-colors disabled:opacity-60 ${
                isGirlsTheme
                  ? 'bg-[#F9B2D7] text-[#4A4A4A] shadow-[0_10px_22px_rgba(249,178,215,0.22)] hover:bg-[#E2B4BD]'
                  : 'bg-accent text-black hover:bg-accent/90'
              }`}
            >
              {savingDetails ? copy.saving : copy.saveChanges}
            </button>
            {detailsMessage ? <p className="text-xs text-green-400">{detailsMessage}</p> : null}
            {detailsError ? <p className="text-xs text-red-400">{detailsError}</p> : null}
          </div>

          <div className={`rounded-2xl p-4 space-y-3 ${cardClassName}`}>
            <h3 className={`text-sm font-semibold ${primaryTextClassName}`}>{copy.changePassword}</h3>
            {(['oldPassword', 'newPassword', 'confirmPassword'] as const).map((fieldKey) => {
              const labelMap = {
                oldPassword: copy.oldPassword,
                newPassword: copy.newPassword,
                confirmPassword: copy.confirmNewPassword,
              };
              return (
                <div key={fieldKey}>
                  <label className={`block text-xs mb-1 ${secondaryTextClassName}`}>{labelMap[fieldKey]}</label>
                  <div className="relative">
                    <input
                      type={showPassword[fieldKey] ? 'text' : 'password'}
                      autoComplete={
                        fieldKey === 'oldPassword'
                          ? 'current-password'
                          : 'new-password'
                      }
                      value={passwordFields[fieldKey]}
                      onChange={(e) => setPasswordFields((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                      className={`${isGirlsTheme ? personalInputClassName.replace('py-2', 'py-2.5') : 'w-full bg-background border border-white/10 px-3 py-2.5 text-white text-sm outline-none focus:border-accent/60'} rounded-xl pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 transition-colors ${isGirlsTheme ? 'text-[#A87884] hover:text-[#4A4A4A]' : 'text-text-tertiary hover:text-text-primary'}`}
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
              className={`w-full rounded-xl border font-semibold py-3 transition-colors disabled:opacity-60 ${
                isGirlsTheme
                  ? 'border-[#E2B4BD]/60 bg-white/55 text-[#A87884] hover:border-[#F9B2D7]/70 hover:bg-[#F9B2D7]/16'
                  : 'border-accent/40 text-accent hover:bg-accent/10'
              }`}
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
    key: NotificationPreferenceKey,
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

  const handleOpenHomeTour = () => {
    resetAllCoachmarkProgress();
    onOpenHomeTour?.();
  };

  return (
    <div className={pageClassName}>
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.settings} onBack={onBack} compact titleClassName={isGirlsTheme ? '!text-[#4A4A4A]' : undefined} />
      </div>

      <div className="px-4 sm:px-6 space-y-8">
        <button
          type="button"
          onClick={() => onOpenGym?.()}
          className={`w-full rounded-xl p-4 flex items-center justify-between transition-colors ${
            isGirlsTheme
              ? 'border border-[#CFECF3]/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(207,236,243,0.34))] shadow-[0_14px_34px_rgba(207,236,243,0.18)] hover:border-[#F9B2D7]/70 hover:bg-white/80'
              : 'bg-card border border-white/5 hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${iconChipClassName}`}>
              <MapPin size={20} />
            </div>
            <div className="text-left">
              <div className={`font-medium ${primaryTextClassName}`}>{copy.gymAccess}</div>
              <div className={`text-xs ${secondaryTextClassName}`}>{copy.gymLocation}</div>
            </div>
          </div>
          <ChevronRight size={20} className={tertiaryTextClassName} />
        </button>

        {sections.map((section, i) =>
        <div key={i} className="space-y-3">
            <h3 className={`text-sm font-medium uppercase tracking-wider px-2 ${sectionTitleClassName}`}>
              {section.title}
            </h3>
            <div className={`rounded-2xl overflow-hidden ${listCardClassName}`}>
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
                    w-full flex items-center justify-between p-4 transition-colors
                    ${isGirlsTheme ? 'hover:bg-white/70' : 'hover:bg-white/5'}
                    ${j !== section.items.length - 1 ? (isGirlsTheme ? 'border-b border-[#E2B4BD]/30' : 'border-b border-white/5') : ''}
                  `}>

                  <div className="flex items-center gap-3">
                    <item.icon size={20} className={tertiaryTextClassName} />
                    <span className={`font-medium ${primaryTextClassName}`}>{item.label}</span>
                  </div>
                </button>
            )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className={`text-sm font-medium uppercase tracking-wider px-2 ${sectionTitleClassName}`}>
            {copy.bodyVisual}
          </h3>
          <div className={`rounded-2xl p-4 ${cardClassName}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className={`font-medium ${primaryTextClassName}`}>{copy.bodyVisual}</div>
                <div className={`mt-1 text-xs ${secondaryTextClassName}`}>{copy.bodyVisualDetail}</div>
              </div>
              <div className={`grid w-full shrink-0 grid-cols-2 overflow-hidden rounded-xl p-1 sm:w-auto ${segmentedClassName}`}>
                {[
                  { body: 'male', label: copy.man },
                  { body: 'female', label: copy.woman },
                ].map((option) => {
                  const isActive = bodyMapBody === option.body;
                  return (
                    <button
                      key={option.body}
                      type="button"
                      onClick={() => handleBodyMapBodyChange(option.body as BodyMapBody)}
                      aria-pressed={isActive}
                      className={`min-w-[74px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        isActive
                          ? isGirlsTheme
                            ? 'bg-[linear-gradient(135deg,#F9B2D7,#E2B4BD)] text-[#4A4A4A] shadow-[0_8px_18px_rgba(249,178,215,0.22)]'
                            : 'bg-accent text-black shadow-[0_0_18px_rgba(var(--color-accent),0.25)]'
                          : isGirlsTheme
                            ? 'text-[#795E67] hover:bg-white/70 hover:text-[#4A4A4A]'
                            : 'text-text-secondary hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className={`text-sm font-medium uppercase tracking-wider px-2 ${sectionTitleClassName}`}>
            {copy.notificationControls}
          </h3>
          <div className={`rounded-2xl overflow-hidden ${listCardClassName}`}>
            {[
              { key: 'coachMessages', label: copy.coachMessages },
              { key: 'restTimer', label: copy.restBetweenSets },
              { key: 'missionChallenge', label: copy.missionChallengeComplete },
              { key: 'training', label: NOTIFICATION_CATEGORY_LABELS[language].training },
              { key: 'social', label: NOTIFICATION_CATEGORY_LABELS[language].social },
              { key: 'challenges', label: NOTIFICATION_CATEGORY_LABELS[language].challenges },
              { key: 'gym', label: NOTIFICATION_CATEGORY_LABELS[language].gym },
              { key: 'content', label: NOTIFICATION_CATEGORY_LABELS[language].content },
              { key: 'shop', label: NOTIFICATION_CATEGORY_LABELS[language].shop },
              { key: 'subscription', label: NOTIFICATION_CATEGORY_LABELS[language].subscription },
            ].map((item, index, arr) => {
              const enabled = notificationSettings[item.key as keyof typeof notificationSettings];
              return (
                <div
                  key={item.key}
                  className={`w-full flex items-center justify-between p-4 ${
                    index !== arr.length - 1 ? (isGirlsTheme ? 'border-b border-[#E2B4BD]/30' : 'border-b border-white/5') : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Bell size={18} className={tertiaryTextClassName} />
                    <span className={`font-medium ${primaryTextClassName}`}>{item.label}</span>
                  </div>
                  <label className={`uiverse-toggle ${loadingNotificationSettings ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={loadingNotificationSettings}
                      aria-label={`${copy.toggleLabelPrefix} ${item.label}`}
                      onChange={(event) =>
                        updateNotificationPreference(
                          item.key as NotificationPreferenceKey,
                          event.target.checked,
                        )
                      }
                    />
                    <div className="uiverse-toggle__slider">
                      <div className="uiverse-toggle__circle">
                        <svg
                          className="uiverse-toggle__cross"
                          viewBox="0 0 365.696 365.696"
                          height="6"
                          width="6"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            fill="currentColor"
                            d="M243.188 182.86 356.32 69.726c12.5-12.5 12.5-32.766 0-45.247L341.238 9.398c-12.504-12.503-32.77-12.503-45.25 0L182.86 122.528 69.727 9.374c-12.5-12.5-32.766-12.5-45.247 0L9.375 24.457c-12.5 12.504-12.5 32.77 0 45.25l113.152 113.152L9.398 295.99c-12.503 12.503-12.503 32.769 0 45.25L24.48 356.32c12.5 12.5 32.766 12.5 45.247 0l113.132-113.132L295.99 356.32c12.503 12.5 32.769 12.5 45.25 0l15.081-15.082c12.5-12.504 12.5-32.77 0-45.25z"
                          />
                        </svg>
                        <svg
                          className="uiverse-toggle__checkmark"
                          viewBox="0 0 24 24"
                          height="10"
                          width="10"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            fill="currentColor"
                            d="M9.707 19.121a.997.997 0 0 1-1.414 0l-5.646-5.647a1.5 1.5 0 0 1 0-2.121l.707-.707a1.5 1.5 0 0 1 2.121 0L9 14.171l9.525-9.525a1.5 1.5 0 0 1 2.121 0l.707.707a1.5 1.5 0 0 1 0 2.121z"
                          />
                        </svg>
                      </div>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
          {notificationSettingsError && (
            <p className="text-xs text-red-400 px-2">{notificationSettingsError}</p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className={`text-sm font-medium uppercase tracking-wider px-2 ${sectionTitleClassName}`}>
            {copy.theme}
          </h3>
          <div className={`rounded-2xl p-4 ${cardClassName}`}>
            <div className="flex items-center justify-between gap-4">
              <span
                className={`text-sm font-semibold transition-colors ${
                  theme === 'light'
                    ? primaryTextClassName
                    : secondaryTextClassName
                }`}
              >
                {copy.light}
              </span>

              <label className="theme-switch" aria-label={`${copy.theme}: ${theme === 'dark' ? copy.dark : copy.light}`}>
                <input
                  type="checkbox"
                  className="theme-switch__checkbox"
                  checked={theme === 'dark'}
                  onChange={(event) => handleThemeChange(event.target.checked ? 'dark' : 'light')}
                />
                <div className="theme-switch__container">
                  <div className="theme-switch__clouds"></div>
                  <div className="theme-switch__stars-container">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 55" fill="none" aria-hidden="true">
                      <path fillRule="evenodd" clipRule="evenodd" d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1114 25.2995 54 25.3545C55.1114 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 58.172 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6075 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6075 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z" fill="currentColor"></path>
                    </svg>
                  </div>
                  <div className="theme-switch__circle-container">
                    <div className="theme-switch__sun-moon-container">
                      <div className="theme-switch__moon">
                        <div className="theme-switch__spot"></div>
                        <div className="theme-switch__spot"></div>
                        <div className="theme-switch__spot"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </label>

              <span
                className={`text-sm font-semibold transition-colors ${
                  theme === 'dark'
                    ? primaryTextClassName
                    : secondaryTextClassName
                }`}
              >
                {copy.dark}
              </span>
            </div>
          </div>

          <div className={`rounded-2xl p-4 ${cardClassName}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className={`font-medium ${primaryTextClassName}`}>{copy.appStyle}</div>
                <div className={`mt-1 text-xs leading-5 ${secondaryTextClassName}`}>{copy.appStyleDetail}</div>
              </div>
              <div className={`grid w-full shrink-0 grid-cols-2 overflow-hidden rounded-xl p-1 sm:w-auto ${segmentedClassName}`}>
                {genderStyleOptions.map((option) => {
                  const isActive = appStyleGender === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleAppStyleGenderChange(option.value)}
                      aria-pressed={isActive}
                      className={`min-w-[74px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        isActive
                          ? option.value === 'female'
                            ? 'bg-[#F9B2D7] text-[#4A4A4A] shadow-[0_0_18px_rgba(226,180,189,0.28)]'
                            : 'bg-accent text-black shadow-[0_0_18px_rgba(var(--color-accent),0.25)]'
                          : isGirlsTheme
                            ? 'text-[#795E67] hover:bg-white/70 hover:text-[#4A4A4A]'
                            : 'text-text-secondary hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className={`text-sm font-medium uppercase tracking-wider px-2 ${sectionTitleClassName}`}>
            {copy.language}
          </h3>
          <div className={`rounded-2xl p-3 grid grid-cols-3 gap-3 ${cardClassName}`}>
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                language === 'en'
                  ? languageActiveClass
                  : languageInactiveClass
              }`}
            >
              <Languages size={16} />
              <span className="text-sm font-medium">{copy.english}</span>
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ar')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                language === 'ar'
                  ? languageActiveClass
                  : languageInactiveClass
              }`}
            >
              <Languages size={16} />
              <span className="text-sm font-medium">{copy.arabic}</span>
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('it')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                language === 'it'
                  ? languageActiveClass
                  : languageInactiveClass
              }`}
            >
              <Languages size={16} />
              <span className="text-sm font-medium">{copy.italian}</span>
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('de')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                language === 'de'
                  ? languageActiveClass
                  : languageInactiveClass
              }`}
            >
              <Languages size={16} />
              <span className="text-sm font-medium">Deutsch</span>
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('fr')}
              className={`rounded-xl p-3 border transition-colors flex items-center justify-center gap-2 ${
                language === 'fr'
                  ? languageActiveClass
                  : languageInactiveClass
              }`}
            >
              <Languages size={16} />
              <span className="text-sm font-medium">Francais</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className={`text-sm font-medium uppercase tracking-wider px-2 ${sectionTitleClassName}`}>
            {copy.appTour}
          </h3>
          <button
            type="button"
            onClick={handleOpenHomeTour}
            className={`w-full rounded-2xl p-4 flex items-center justify-between transition-colors ${
              isGirlsTheme
                ? 'border border-[#E2B4BD]/45 bg-white/72 shadow-[0_14px_34px_rgba(226,180,189,0.14)] hover:border-[#F9B2D7]/70 hover:bg-white/85'
                : 'bg-card border border-white/5 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3 text-left">
              <div className={`p-2 rounded-xl ${isGirlsTheme ? 'border border-[#F9B2D7]/45 bg-[#F9B2D7]/18 text-[#A87884]' : 'bg-accent/10 text-accent border border-accent/20'}`}>
                <Eye size={18} />
              </div>
              <div>
                <div className={`font-medium ${primaryTextClassName}`}>{copy.showAppTour}</div>
                <div className={`text-xs mt-1 ${secondaryTextClassName}`}>{copy.showAppTourDetail}</div>
              </div>
            </div>
            <ChevronRight size={20} className={tertiaryTextClassName} />
          </button>
        </div>

      </div>
    </div>);

}
