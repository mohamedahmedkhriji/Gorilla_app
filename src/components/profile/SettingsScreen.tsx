import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { Bell, Shield, User, Moon, Sun, Database, Lock, SlidersHorizontal, Share2, MapPin, CreditCard, KeyRound, Scale, Mail, ChevronDown, ChevronRight, Eye, EyeOff, Languages } from 'lucide-react';
import { applyTheme, getActiveTheme, getStoredTheme } from '../../services/theme';
import { AppLanguage, applyLanguage, getActiveLanguage, getStoredLanguage, normalizeLocalizedValue } from '../../services/language';
import { api } from '../../services/api';
import {
  APP_COACHMARK_TOUR_ID,
  APP_COACHMARK_VERSION,
  BLOGS_COACHMARK_TOUR_ID,
  BLOGS_COACHMARK_VERSION,
  HOME_COACHMARK_TOUR_ID,
  HOME_COACHMARK_VERSION,
  PROFILE_COACHMARK_TOUR_ID,
  PROFILE_COACHMARK_VERSION,
  PROGRESS_COACHMARK_TOUR_ID,
  PROGRESS_COACHMARK_VERSION,
  resetCoachmarkProgress,
  WORKOUT_PLAN_COACHMARK_TOUR_ID,
  WORKOUT_PLAN_COACHMARK_VERSION,
  WORKOUT_TRACKER_COACHMARK_TOUR_ID,
  WORKOUT_TRACKER_COACHMARK_VERSION,
} from '../../services/coachmarks';
import { persistStoredUser } from '../../shared/authStorage';
interface SettingsScreenProps {
  onBack: () => void;
  onOpenGym?: () => void;
  onOpenHomeTour?: () => void;
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
    notifications: 'Notifiche',
    notificationControls: 'Controlli notifiche',
    coachMessages: 'Messaggi del coach',
    restBetweenSets: 'Recupero tra le serie',
    missionChallengeComplete: 'Missioni e sfide completate',
    theme: 'Tema',
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
    notifications: 'الإشعارات',
    notificationControls: 'إعدادات الإشعارات',
    coachMessages: 'رسائل المدرب',
    restBetweenSets: 'الراحة بين الجولات',
    missionChallengeComplete: 'إكمال المهام والتحديات',
    theme: 'المظهر',
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
    notifications: 'Benachrichtigungen',
    notificationControls: 'Benachrichtigungssteuerung',
    coachMessages: 'Coach-Nachrichten',
    restBetweenSets: 'Pause zwischen den Satzen',
    missionChallengeComplete: 'Missionen & Challenges abgeschlossen',
    theme: 'Design',
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
} as const;

export function SettingsScreen({ onBack, onOpenGym, onOpenHomeTour }: SettingsScreenProps) {
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
  });
  const [loadingNotificationSettings, setLoadingNotificationSettings] = useState(false);
  const [notificationSettingsError, setNotificationSettingsError] = useState('');
  const copy = normalizeLocalizedValue(SETTINGS_I18N_WITH_DE[language] || SETTINGS_I18N_WITH_DE.en);
  const languageActiveClass = 'bg-white/10 border-accent text-white';
  const languageInactiveClass = 'bg-background border-white/10 text-text-secondary hover:bg-white/5';

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">{copy.sessionDuration}</label>
                <div className="relative">
                  <select
                    value={personalDetails.sessionDuration}
                    onChange={(e) => setPersonalDetails((prev) => ({ ...prev, sessionDuration: e.target.value }))}
                    className="w-full appearance-none bg-background border border-white/10 rounded-xl px-3 py-2.5 pr-9 text-white text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-colors"
                  >
                    <option value="30">{copy.thirtyMinutes}</option>
                    <option value="45">{copy.fortyFiveMinutes}</option>
                    <option value="60">{copy.sixtyMinutes}</option>
                    <option value="90">{copy.ninetyMinutes}</option>
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">{copy.preferredTime}</label>
                <div className="relative">
                  <select
                    value={personalDetails.preferredTime}
                    onChange={(e) => setPersonalDetails((prev) => ({ ...prev, preferredTime: e.target.value }))}
                    className="w-full appearance-none bg-background border border-white/10 rounded-xl px-3 py-2.5 pr-9 text-white text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-colors"
                  >
                    <option value="morning">{copy.morningTime}</option>
                    <option value="afternoon">{copy.afternoonTime}</option>
                    <option value="evening">{copy.eveningTime}</option>
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                </div>
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

  const handleOpenHomeTour = () => {
    resetCoachmarkProgress({
      tourId: APP_COACHMARK_TOUR_ID,
      version: APP_COACHMARK_VERSION,
      defaultSeenSteps: {
        home: false,
        my_plan: false,
        blogs: false,
        progress: false,
        profile: false,
      },
    });
    resetCoachmarkProgress({
      tourId: HOME_COACHMARK_TOUR_ID,
      version: HOME_COACHMARK_VERSION,
      defaultSeenSteps: {
        header: false,
        today_gradient: false,
        today_plan: false,
        rank: false,
        recovery: false,
        nutrition: false,
        exercises: false,
        books: false,
      },
    });
    resetCoachmarkProgress({
      tourId: BLOGS_COACHMARK_TOUR_ID,
      version: BLOGS_COACHMARK_VERSION,
      defaultSeenSteps: {
        create: false,
        intro: false,
        filters: false,
        first_post: false,
      },
    });
    resetCoachmarkProgress({
      tourId: PROGRESS_COACHMARK_TOUR_ID,
      version: PROGRESS_COACHMARK_VERSION,
      defaultSeenSteps: {
        page_intro: false,
        strength_chart: false,
        consistency: false,
        total_volume: false,
        muscle_distribution: false,
        report: false,
        overload: false,
      },
    });
    resetCoachmarkProgress({
      tourId: PROFILE_COACHMARK_TOUR_ID,
      version: PROFILE_COACHMARK_VERSION,
      defaultSeenSteps: {
        settings: false,
        notifications: false,
        avatar: false,
        photo_upload: false,
        exercises: false,
        rank: false,
        days_left: false,
        friends: false,
        coach: false,
        posts: false,
        plan_builder: false,
        logout: false,
      },
    });
    resetCoachmarkProgress({
      tourId: WORKOUT_PLAN_COACHMARK_TOUR_ID,
      version: WORKOUT_PLAN_COACHMARK_VERSION,
      defaultSeenSteps: {
        back: false,
        current_day_gradient: false,
        current_day: false,
        agenda: false,
        week_card: false,
        action_button: false,
      },
    });
    resetCoachmarkProgress({
      tourId: WORKOUT_TRACKER_COACHMARK_TOUR_ID,
      version: WORKOUT_TRACKER_COACHMARK_VERSION,
      defaultSeenSteps: {
        back: false,
        remove: false,
        timer: false,
        start_stop: false,
        video: false,
        analytics: false,
        set_row: false,
        add_set: false,
      },
    });
    onOpenHomeTour?.();
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
              <div className="font-medium text-white">{copy.gymAccess}</div>
              <div className="text-xs text-text-secondary">{copy.gymLocation}</div>
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
          <div className="bg-card rounded-2xl border border-white/5 p-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <div className="bg-card rounded-2xl border border-white/5 p-3 grid grid-cols-3 gap-3">
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
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider px-2">
            {copy.appTour}
          </h3>
          <button
            type="button"
            onClick={handleOpenHomeTour}
            className="w-full bg-card rounded-2xl p-4 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20">
                <Eye size={18} />
              </div>
              <div>
                <div className="font-medium text-white">{copy.showAppTour}</div>
                <div className="text-xs text-text-secondary mt-1">{copy.showAppTourDetail}</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-text-tertiary" />
          </button>
        </div>

      </div>
    </div>);

}
