import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CoachmarkOverlay, type CoachmarkStep } from '../components/coachmarks/CoachmarkOverlay';
import { ProfileScreen } from '../components/profile/ProfileScreen';
import { GymAccessScreen } from '../components/profile/GymAccessScreen';
import { RankingsRewardsScreen } from '../components/profile/RankingsRewardsScreen';
import { SettingsScreen } from '../components/profile/SettingsScreen';
import { CurrentWeekPlanScreen } from '../components/profile/CurrentWeekPlanScreen';
import { CustomPlanBuilderScreen } from '../components/profile/CustomPlanBuilderScreen';
import { PresetProgramScreen } from '../components/profile/PresetProgramScreen';
import { MyPostsScreen } from '../components/profile/MyPostsScreen';
import { NotificationsScreen } from '../components/notifications/NotificationsScreen';
import { FriendChallengeScreen } from '../components/profile/FriendChallengeScreen';
import { FriendsList, FriendMember } from './FriendsList';
import { FriendProfile } from './FriendProfile';
import { CoachList } from './CoachList';
import { Messaging } from './Messaging';
import { Settings } from 'lucide-react';
import { useScrollToTopOnChange } from '../shared/scroll';
import { useScreenshotProtection } from '../shared/useScreenshotProtection';
import { clearStoredUserSession } from '../shared/authStorage';
import { AppLanguage, getActiveLanguage, getStoredLanguage, pickLanguage } from '../services/language';
import { deactivateCurrentPushDevice } from '../services/pushNotifications';
import type { NotificationEventPayload } from '../services/notificationEvents';
import { toFriendChallengeCardId } from '../services/friendChallenges';
import { ScreenSection, ScreenTransition, getNavigationDirection } from '../components/ui/ScreenTransition';
import {
  PROFILE_COACHMARK_TOUR_ID,
  PROFILE_COACHMARK_VERSION,
  getCoachmarkUserScope,
  patchCoachmarkProgress,
  readCoachmarkProgress,
} from '../services/coachmarks';
interface ProfileProps {
  onNavigateTab?: (tab: string, day?: string) => void;
  onTabBarVisibilityChange?: (visible: boolean) => void;
  resetSignal?: number;
  guidedTourActive?: boolean;
  onGuidedTourComplete?: () => void;
  onGuidedTourDismiss?: () => void;
  onRestartGuidedTour?: () => void;
}

const hasCoachmarkTargets = (steps: CoachmarkStep[]) =>
  typeof document !== 'undefined'
  && steps.some((step) => Boolean(document.querySelector(`[data-coachmark-target="${step.targetId}"]`)));

const PROFILE_PAGE_I18N = {
  en: {
    back: 'Back',
    challenge: 'Challenge',
    challengePlaceholder: 'Challenge screen placeholder for',
    challengeFallbackFriend: 'this friend',
    openSettings: 'Open settings',
    openNotifications: 'Open notifications',
  },
  ar: {
    back: '\u0631\u062c\u0648\u0639',
    challenge: '\u0627\u0644\u062a\u062d\u062f\u064a',
    challengePlaceholder: '\u0634\u0627\u0634\u0629 \u0627\u0644\u062a\u062d\u062f\u064a \u0627\u0644\u062a\u062c\u0631\u064a\u0628\u064a\u0629 \u0644\u0640',
    challengeFallbackFriend: '\u0647\u0630\u0627 \u0627\u0644\u0635\u062f\u064a\u0642',
    openSettings: '\u0641\u062a\u062d \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a',
    openNotifications: '\u0641\u062a\u062d \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a',
  },
  it: {
    back: 'Indietro',
    challenge: 'Sfida',
    challengePlaceholder: 'Schermata segnaposto della sfida per',
    challengeFallbackFriend: 'questo amico',
    openSettings: 'Apri impostazioni',
    openNotifications: 'Apri notifiche',
  },
  de: {
    back: 'Zurueck',
    challenge: 'Challenge',
    challengePlaceholder: 'Challenge-Platzhalter fuer',
    challengeFallbackFriend: 'diesen Freund',
    openSettings: 'Einstellungen oeffnen',
    openNotifications: 'Benachrichtigungen oeffnen',
  },
  fr: {
    back: 'Retour',
    challenge: 'Defi',
    challengePlaceholder: 'Ecran temporaire du defi pour',
    challengeFallbackFriend: 'cet ami',
    openSettings: 'Ouvrir les parametres',
    openNotifications: 'Ouvrir les notifications',
  },
} as const;

const SCREENSHOT_PROTECTED_PROFILE_VIEWS = new Set([
  'settings',
  'notifications',
  'weeklyPlan',
  'presetPlans',
  'customPlanBuilder',
  'posts',
  'friends',
  'friendProfile',
  'friendChallenge',
  'notificationChallenge',
  'chat',
]);

const PROFILE_VIEW_ORDER = [
  'main',
  'settings',
  'notifications',
  'gym',
  'rank',
  'weeklyPlan',
  'presetPlans',
  'customPlanBuilder',
  'posts',
  'friends',
  'friendProfile',
  'friendChallenge',
  'notificationChallenge',
  'coachList',
  'chat',
] as const;

export function Profile({
  onNavigateTab,
  onTabBarVisibilityChange,
  resetSignal = 0,
  guidedTourActive = false,
  onGuidedTourComplete,
  onGuidedTourDismiss,
  onRestartGuidedTour,
}: ProfileProps) {
  const [view, setView] = useState<
    'main' | 'gym' | 'rank' | 'settings' | 'notifications' | 'weeklyPlan' | 'presetPlans' | 'customPlanBuilder' | 'posts' | 'friends' | 'friendProfile' | 'friendChallenge' | 'notificationChallenge' | 'coachList' | 'chat'>(
    'main');
  const [selectedFriend, setSelectedFriend] = useState<FriendMember | null>(null);
  const [acceptedChallengeContext, setAcceptedChallengeContext] = useState<{
    friendId: number;
    friendName: string;
    challengeKey: string;
    challengeTitle: string;
    challengeSessionId: number;
  } | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<{id: number, name: string} | null>(null);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [coachmarkStepIndex, setCoachmarkStepIndex] = useState(0);
  const [isCoachmarkOpen, setIsCoachmarkOpen] = useState(false);
  const previousViewRef = useRef(view);

  useScrollToTopOnChange([view, resetSignal]);
  useScreenshotProtection(SCREENSHOT_PROTECTED_PROFILE_VIEWS.has(view));

  useEffect(() => {
    onTabBarVisibilityChange?.(view !== 'friendChallenge' && view !== 'notificationChallenge');

    return () => {
      onTabBarVisibilityChange?.(true);
    };
  }, [onTabBarVisibilityChange, view]);

  useEffect(() => {
    previousViewRef.current = view;
  }, [view]);

  const copy = PROFILE_PAGE_I18N[language as keyof typeof PROFILE_PAGE_I18N] || PROFILE_PAGE_I18N.en;

  const coachmarkScope = useMemo(() => getCoachmarkUserScope(), []);
  const isArabic = language === 'ar';
  const profileCoachmarkOptions = useMemo(
    () => ({
      tourId: PROFILE_COACHMARK_TOUR_ID,
      version: PROFILE_COACHMARK_VERSION,
      userScope: coachmarkScope,
      defaultSeenSteps: {
        title: false,
        settings: false,
        summary: false,
        avatar: false,
        photo_upload: false,
        edit: false,
        stats: false,
        agenda: false,
        plan_builder: false,
        coach: false,
        posts: false,
        logout: false,
      },
    }),
    [coachmarkScope],
  );
  const legacyProfileCoachmarkCopy = useMemo(
    () => ({
      next: isArabic ? 'التالي' : 'Next',
      skip: isArabic ? 'تخطي' : 'Skip',
      finish: isArabic ? 'حسناً' : 'Got it',
      settingsTitle: isArabic ? 'الإعدادات هنا' : 'Settings live here',
      settingsBody: isArabic
        ? 'من هنا تصل بسرعة إلى إعدادات الحساب والإشعارات والمساعدة.'
        : 'Use this shortcut for account settings, notifications, and help.',
      notificationsTitle: isArabic ? 'تابع التنبيهات' : 'Check notifications',
      notificationsBody: isArabic
        ? 'هذا الزر يفتح الإشعارات والطلبات الجديدة والتنبيهات المهمة.'
        : 'This button opens your latest alerts, requests, and important updates.',
      avatarTitle: isArabic ? 'هذه صورتك الشخصية' : 'This is your profile photo',
      avatarBody: isArabic
        ? 'اضغط هنا لمعاينة صورتك الحالية بالحجم الكامل.'
        : 'Tap here to preview your current profile photo in full size.',
      uploadTitle: isArabic ? 'غيّر الصورة' : 'Change your photo',
      uploadBody: isArabic
        ? 'استخدم زر الكاميرا لتحديث صورتك الشخصية من الهاتف.'
        : 'Use the camera button to update your profile picture from your device.',
      exercisesTitle: isArabic ? 'إجمالي تمارينك' : 'Your total exercises',
      exercisesBody: isArabic
        ? 'هذه البطاقة تعرض عدد التمارين التي أنجزتها حتى الآن.'
        : 'This card shows how many exercises you have completed so far.',
      rankTitle: isArabic ? 'ترتيبك الحالي' : 'Your current rank',
      rankBody: isArabic
        ? 'افتح هذه البطاقة لرؤية ترتيبك ومكافآتك وتقدمك داخل النادي.'
        : 'Open this card to see your ranking, rewards, and progress in the gym.',
      daysLeftTitle: isArabic ? 'ماذا تبقى من الخطة' : 'What is left in your plan',
      daysLeftBody: isArabic
        ? 'هنا ترى الأيام والحصص المتبقية في خطتك الحالية.'
        : 'Here you can see the remaining days and sessions in your current plan.',
      friendsTitle: isArabic ? 'قسم الأصدقاء' : 'Your friends area',
      friendsBody: isArabic
        ? 'من هذه البطاقة تتابع أصدقاءك ونشاطهم داخل التطبيق.'
        : 'This card takes you to your friends area and activity inside the app.',
      coachTitle: isArabic ? 'دعم المدرب' : 'Coach support',
      coachBody: isArabic
        ? 'استخدم هذه البطاقة للوصول إلى دعم المدرب وبدء المحادثة.'
        : 'Use this card to reach coach support and start a conversation.',
      postsTitle: isArabic ? 'منشوراتك' : 'Your posts',
      postsBody: isArabic
        ? 'هذه البطاقة تفتح منشوراتك وإدارة كل ما رفعته.'
        : 'This card opens your posts and lets you manage what you uploaded.',
      planBuilderTitle: isArabic ? 'أنشئ خطتك' : 'Build your plan',
      planBuilderBody: isArabic
        ? 'من هنا تبدأ إنشاء خطة تمرين جديدة بنفسك أو مع مدرب.'
        : 'Start building a new workout plan here, on your own or with a coach.',
      logoutTitle: isArabic ? 'تسجيل الخروج' : 'Log out here',
      logoutBody: isArabic
        ? 'هذا الزر يفتح تأكيد تسجيل الخروج من حسابك.'
        : 'This button opens the confirmation to sign out of your account.',
    }),
    [isArabic],
  );
  const profileCoachmarkCopy = useMemo(
    () => pickLanguage(language, {
      en: {
        next: 'Next',
        skip: 'Skip',
        finish: 'Got it',
        titleTitle: 'This is your profile',
        titleBody: 'Your profile collects your account, training activity, plan shortcuts, and support tools.',
        settingsTitle: 'Settings live here',
        settingsBody: 'Use this shortcut for account settings, notifications, and help.',
        summaryTitle: 'Your profile card',
        summaryBody: 'This card shows your name, member date, photo controls, and training totals in one place.',
        notificationsTitle: 'Check notifications',
        notificationsBody: 'This button opens your latest alerts, requests, and important updates.',
        avatarTitle: 'This is your profile photo',
        avatarBody: 'Tap here to preview your current profile photo in full size.',
        uploadTitle: 'Change your photo',
        uploadBody: 'Use the camera button to update your profile picture from your device.',
        editTitle: 'Edit your details',
        editBody: 'Use this button to update your profile information and account preferences.',
        statsTitle: 'Your quick stats',
        statsBody: 'These numbers summarize your workouts, streak, and friends at a glance.',
        exercisesTitle: 'Your total exercises',
        exercisesBody: 'This card shows how many exercises you have completed so far.',
        rankTitle: 'Your current rank',
        rankBody: 'Open this card to see your ranking, rewards, and progress in the gym.',
        daysLeftTitle: 'What is left in your plan',
        daysLeftBody: 'Here you can see the remaining days and sessions in your current plan.',
        friendsTitle: 'Your friends area',
        friendsBody: 'This card takes you to your friends area and activity inside the app.',
        coachTitle: 'Coach support',
        coachBody: 'Use this card to reach coach support and start a conversation.',
        postsTitle: 'Your posts',
        postsBody: 'This card opens your posts and lets you manage what you uploaded.',
        planBuilderTitle: 'Build your plan',
        planBuilderBody: 'Start building a new workout plan here, on your own or with a coach.',
        logoutTitle: 'Log out here',
        logoutBody: 'This button opens the confirmation to sign out of your account.',
      },
      ar: {
        next: 'التالي',
        skip: 'تخطي',
        finish: 'حسناً',
        titleTitle: 'هذا ملفك الشخصي',
        titleBody: 'يجمع ملفك الحساب ونشاط التدريب واختصارات الخطة وأدوات الدعم.',
        settingsTitle: 'الإعدادات هنا',
        settingsBody: 'من هنا تصل بسرعة إلى إعدادات الحساب والإشعارات والمساعدة.',
        summaryTitle: 'بطاقة ملفك',
        summaryBody: 'تعرض هذه البطاقة اسمك وتاريخ العضوية وأدوات الصورة وإحصاءات التدريب.',
        notificationsTitle: 'تابع التنبيهات',
        notificationsBody: 'هذا الزر يفتح الإشعارات والطلبات الجديدة والتنبيهات المهمة.',
        avatarTitle: 'هذه صورتك الشخصية',
        avatarBody: 'اضغط هنا لمعاينة صورتك الحالية بالحجم الكامل.',
        uploadTitle: 'غيّر الصورة',
        uploadBody: 'استخدم زر الكاميرا لتحديث صورتك الشخصية من الهاتف.',
        editTitle: 'عدّل بياناتك',
        editBody: 'استخدم هذا الزر لتحديث معلومات ملفك وتفضيلات الحساب.',
        statsTitle: 'إحصاءاتك السريعة',
        statsBody: 'تلخص هذه الأرقام تمارينك وسلسلة أيامك وأصدقاءك بسرعة.',
        exercisesTitle: 'إجمالي تمارينك',
        exercisesBody: 'هذه البطاقة تعرض عدد التمارين التي أنجزتها حتى الآن.',
        rankTitle: 'ترتيبك الحالي',
        rankBody: 'افتح هذه البطاقة لرؤية ترتيبك ومكافآتك وتقدمك داخل النادي.',
        daysLeftTitle: 'ماذا تبقى من الخطة',
        daysLeftBody: 'هنا ترى الأيام والحصص المتبقية في خطتك الحالية.',
        friendsTitle: 'قسم الأصدقاء',
        friendsBody: 'من هذه البطاقة تتابع أصدقاءك ونشاطهم داخل التطبيق.',
        coachTitle: 'دعم المدرب',
        coachBody: 'استخدم هذه البطاقة للوصول إلى دعم المدرب وبدء المحادثة.',
        postsTitle: 'منشوراتك',
        postsBody: 'هذه البطاقة تفتح منشوراتك وإدارة كل ما رفعته.',
        planBuilderTitle: 'أنشئ خطتك',
        planBuilderBody: 'من هنا تبدأ إنشاء خطة تمرين جديدة بنفسك أو مع مدرب.',
        logoutTitle: 'تسجيل الخروج',
        logoutBody: 'هذا الزر يفتح تأكيد تسجيل الخروج من حسابك.',
      },
      it: {
        next: 'Avanti',
        skip: 'Salta',
        finish: 'Ho capito',
        titleTitle: 'Questo e il tuo profilo',
        titleBody: 'Il profilo raccoglie account, attivita, scorciatoie del piano e supporto.',
        settingsTitle: 'Le impostazioni sono qui',
        settingsBody: 'Usa questo accesso rapido per impostazioni account, notifiche e aiuto.',
        summaryTitle: 'La tua scheda profilo',
        summaryBody: 'Questa scheda mostra nome, data iscrizione, controlli foto e riepilogo allenamento.',
        notificationsTitle: 'Controlla le notifiche',
        notificationsBody: 'Questo pulsante apre i tuoi ultimi avvisi, richieste e aggiornamenti importanti.',
        avatarTitle: 'Questa e la tua foto profilo',
        avatarBody: 'Tocca qui per vedere la tua foto profilo a grandezza piena.',
        uploadTitle: 'Cambia la foto',
        uploadBody: 'Usa il pulsante della fotocamera per aggiornare la tua foto profilo dal dispositivo.',
        editTitle: 'Modifica i dettagli',
        editBody: 'Usa questo pulsante per aggiornare profilo e preferenze account.',
        statsTitle: 'Le tue statistiche rapide',
        statsBody: 'Questi numeri riassumono allenamenti, serie giornaliera e amici.',
        exercisesTitle: 'I tuoi esercizi totali',
        exercisesBody: 'Questa card mostra quanti esercizi hai completato finora.',
        rankTitle: 'Il tuo grado attuale',
        rankBody: 'Apri questa card per vedere classifica, ricompense e progressi in palestra.',
        daysLeftTitle: 'Cosa resta nel tuo piano',
        daysLeftBody: 'Qui puoi vedere i giorni e le sessioni rimanenti del tuo piano attuale.',
        friendsTitle: 'La tua area amici',
        friendsBody: 'Questa card ti porta alla tua area amici e alla loro attivita nell app.',
        coachTitle: 'Supporto coach',
        coachBody: 'Usa questa card per contattare il coach e iniziare una conversazione.',
        postsTitle: 'I tuoi post',
        postsBody: 'Questa card apre i tuoi post e ti permette di gestire cio che hai pubblicato.',
        planBuilderTitle: 'Crea il tuo piano',
        planBuilderBody: 'Inizia qui a creare un nuovo piano di allenamento, da solo o con un coach.',
        logoutTitle: 'Esci da qui',
        logoutBody: 'Questo pulsante apre la conferma per uscire dal tuo account.',
      },
      de: {
        next: 'Weiter',
        skip: 'Ueberspringen',
        finish: 'Verstanden',
        titleTitle: 'Das ist dein Profil',
        titleBody: 'Dein Profil sammelt Konto, Trainingsaktivitaet, Plan-Verknuepfungen und Support.',
        settingsTitle: 'Hier sind deine Einstellungen',
        settingsBody: 'Nutze diese Verknuepfung fuer Kontoeinstellungen, Benachrichtigungen und Hilfe.',
        summaryTitle: 'Deine Profilkarte',
        summaryBody: 'Diese Karte zeigt Name, Mitgliedsdatum, Fotosteuerung und Trainingsuebersicht.',
        notificationsTitle: 'Benachrichtigungen pruefen',
        notificationsBody: 'Diese Taste oeffnet deine neuesten Hinweise, Anfragen und wichtigen Updates.',
        avatarTitle: 'Das ist dein Profilbild',
        avatarBody: 'Tippe hier, um dein aktuelles Profilbild in voller Groesse anzusehen.',
        uploadTitle: 'Profilbild aendern',
        uploadBody: 'Nutze die Kamerataste, um dein Profilbild auf diesem Geraet zu aktualisieren.',
        editTitle: 'Details bearbeiten',
        editBody: 'Nutze diese Taste, um Profilinfos und Kontoeinstellungen zu aktualisieren.',
        statsTitle: 'Deine Schnellwerte',
        statsBody: 'Diese Zahlen fassen Workouts, Tages-Serie und Freunde zusammen.',
        exercisesTitle: 'Deine gesamten Uebungen',
        exercisesBody: 'Diese Karte zeigt, wie viele Uebungen du bisher abgeschlossen hast.',
        rankTitle: 'Dein aktueller Rang',
        rankBody: 'Oeffne diese Karte, um deinen Rang, Belohnungen und Fortschritt im Gym zu sehen.',
        daysLeftTitle: 'Was in deinem Plan noch offen ist',
        daysLeftBody: 'Hier siehst du die verbleibenden Tage und Einheiten deines aktuellen Plans.',
        friendsTitle: 'Dein Freunde-Bereich',
        friendsBody: 'Diese Karte bringt dich zu deinen Freunden und ihrer Aktivitaet in der App.',
        coachTitle: 'Coach-Support',
        coachBody: 'Nutze diese Karte, um den Coach-Support zu erreichen und ein Gespraech zu starten.',
        postsTitle: 'Deine Beitraege',
        postsBody: 'Diese Karte oeffnet deine Beitraege und laesst dich deine Uploads verwalten.',
        planBuilderTitle: 'Erstelle deinen Plan',
        planBuilderBody: 'Starte hier mit einem neuen Trainingsplan, allein oder mit einem Coach.',
        logoutTitle: 'Hier abmelden',
        logoutBody: 'Diese Taste oeffnet die Bestaetigung zum Abmelden von deinem Konto.',
      },
      fr: {
        next: 'Suivant',
        skip: 'Passer',
        finish: 'Compris',
        titleTitle: 'Voici ton profil',
        titleBody: 'Ton profil regroupe ton compte, ton activite, tes raccourcis de plan et le support.',
        settingsTitle: 'Les parametres sont ici',
        settingsBody: 'Utilise ce raccourci pour les parametres du compte, les notifications et l aide.',
        summaryTitle: 'Ta carte de profil',
        summaryBody: 'Cette carte affiche ton nom, ta date membre, les controles photo et ton resume sportif.',
        notificationsTitle: 'Verifier les notifications',
        notificationsBody: 'Ce bouton ouvre tes alertes, demandes et mises a jour importantes.',
        avatarTitle: 'Voici ta photo de profil',
        avatarBody: 'Appuie ici pour voir ta photo de profil en grand format.',
        uploadTitle: 'Changer ta photo',
        uploadBody: 'Utilise le bouton camera pour mettre a jour ta photo de profil depuis ton appareil.',
        editTitle: 'Modifier tes details',
        editBody: 'Utilise ce bouton pour mettre a jour ton profil et tes preferences de compte.',
        statsTitle: 'Tes stats rapides',
        statsBody: 'Ces chiffres resument tes entrainements, ta serie et tes amis.',
        exercisesTitle: 'Ton total d exercices',
        exercisesBody: 'Cette carte montre combien d exercices tu as termines jusqu ici.',
        rankTitle: 'Ton rang actuel',
        rankBody: 'Ouvre cette carte pour voir ton classement, tes recompenses et ta progression dans la salle.',
        daysLeftTitle: 'Ce qu il reste dans ton plan',
        daysLeftBody: 'Ici, tu peux voir les jours et les seances restantes dans ton plan actuel.',
        friendsTitle: 'Ton espace amis',
        friendsBody: 'Cette carte t emmene vers tes amis et leur activite dans l application.',
        coachTitle: 'Support coach',
        coachBody: 'Utilise cette carte pour contacter le coach et commencer une conversation.',
        postsTitle: 'Tes publications',
        postsBody: 'Cette carte ouvre tes publications et te permet de gerer ce que tu as partage.',
        planBuilderTitle: 'Construis ton plan',
        planBuilderBody: 'Commence ici a creer un nouveau plan d entrainement, seul ou avec un coach.',
        logoutTitle: 'Se deconnecter ici',
        logoutBody: 'Ce bouton ouvre la confirmation pour te deconnecter de ton compte.',
      },
    }),
    [language],
  );
  const profileCoachmarkSteps = useMemo<CoachmarkStep[]>(
    () => [
      {
        id: 'title',
        targetId: 'profile_page_title',
        title: profileCoachmarkCopy.titleTitle,
        body: profileCoachmarkCopy.titleBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 12,
      },
      {
        id: 'settings',
        targetId: 'profile_settings_button',
        title: profileCoachmarkCopy.settingsTitle,
        body: profileCoachmarkCopy.settingsBody,
        placement: 'bottom',
        shape: 'circle',
        padding: 8,
      },
      {
        id: 'summary',
        targetId: 'profile_summary_card',
        title: profileCoachmarkCopy.summaryTitle,
        body: profileCoachmarkCopy.summaryBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 18,
      },
      {
        id: 'avatar',
        targetId: 'profile_avatar_button',
        title: profileCoachmarkCopy.avatarTitle,
        body: profileCoachmarkCopy.avatarBody,
        placement: 'bottom',
        shape: 'circle',
        padding: 8,
      },
      {
        id: 'photo_upload',
        targetId: 'profile_avatar_upload_button',
        title: profileCoachmarkCopy.uploadTitle,
        body: profileCoachmarkCopy.uploadBody,
        placement: 'bottom',
        shape: 'circle',
        padding: 8,
      },
      {
        id: 'edit',
        targetId: 'profile_edit_button',
        title: profileCoachmarkCopy.editTitle,
        body: profileCoachmarkCopy.editBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 12,
      },
      {
        id: 'stats',
        targetId: 'profile_stats_row',
        title: profileCoachmarkCopy.statsTitle,
        body: profileCoachmarkCopy.statsBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 16,
      },
      {
        id: 'agenda',
        targetId: 'profile_agenda_card',
        title: profileCoachmarkCopy.daysLeftTitle,
        body: profileCoachmarkCopy.daysLeftBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 16,
      },
      {
        id: 'plan_builder',
        targetId: 'profile_plan_builder_card',
        title: profileCoachmarkCopy.planBuilderTitle,
        body: profileCoachmarkCopy.planBuilderBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'coach',
        targetId: 'profile_coach_card',
        title: profileCoachmarkCopy.coachTitle,
        body: profileCoachmarkCopy.coachBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'posts',
        targetId: 'profile_posts_card',
        title: profileCoachmarkCopy.postsTitle,
        body: profileCoachmarkCopy.postsBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'logout',
        targetId: 'profile_logout_button',
        title: profileCoachmarkCopy.logoutTitle,
        body: profileCoachmarkCopy.logoutBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
    ],
    [profileCoachmarkCopy],
  );
  const activeCoachmarkStep = profileCoachmarkSteps[coachmarkStepIndex] || null;

  useEffect(() => {
    const openRoute = (payload: NotificationEventPayload) => {
      const route = String(payload?.route || '').trim().toLowerCase();
      const messageMatch = route.match(/^\/messages\/(\d+)/);
      if (messageMatch) {
        setSelectedCoach({ id: Number(messageMatch[1]), name: 'Coach' });
        setView('chat');
      } else if (route.startsWith('/friends')) {
        setView('friends');
      } else if (route.startsWith('/challenges')) {
        setView('notifications');
      } else if (route.startsWith('/subscription')) {
        setView('settings');
      } else {
        setView('main');
      }
    };

    const handleRoute = (event: Event) => openRoute((event as CustomEvent<NotificationEventPayload>).detail || {});
    window.addEventListener('repset:open-profile-route', handleRoute);
    const pendingRaw = sessionStorage.getItem('repSetPendingProfileRoute');
    if (pendingRaw) {
      sessionStorage.removeItem('repSetPendingProfileRoute');
      try {
        openRoute(JSON.parse(pendingRaw));
      } catch {
        setView('main');
      }
    }
    return () => window.removeEventListener('repset:open-profile-route', handleRoute);
  }, []);

  useEffect(() => {
    setView('main');
    setSelectedFriend(null);
    setSelectedCoach(null);
    setCoachmarkStepIndex(0);
    setIsCoachmarkOpen(false);
  }, [resetSignal]);

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
    if (view !== 'main' || isCoachmarkOpen) return;

    const timer = window.setTimeout(() => {
      const progress = readCoachmarkProgress(profileCoachmarkOptions);
      const canShowProfileTour =
        guidedTourActive
        && !progress.completed
        && !progress.dismissed
        && hasCoachmarkTargets(profileCoachmarkSteps);

      if (canShowProfileTour) {
        setCoachmarkStepIndex(Math.min(progress.currentStep, profileCoachmarkSteps.length - 1));
        setIsCoachmarkOpen(true);
      }
    }, 460);

    return () => window.clearTimeout(timer);
  }, [guidedTourActive, isCoachmarkOpen, profileCoachmarkOptions, profileCoachmarkSteps, view]);

  const closeCoachmarks = () => {
    setIsCoachmarkOpen(false);
    setCoachmarkStepIndex(0);
  };

  const handleCoachmarkNext = () => {
    if (!activeCoachmarkStep) return;
    const isLastStep = coachmarkStepIndex >= profileCoachmarkSteps.length - 1;
    if (isLastStep) return;

    patchCoachmarkProgress(profileCoachmarkOptions, (current) => ({
      currentStep: coachmarkStepIndex + 1,
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    setCoachmarkStepIndex((current) => Math.min(current + 1, profileCoachmarkSteps.length - 1));
  };

  const handleCoachmarkFinish = () => {
    if (!activeCoachmarkStep) return;

    patchCoachmarkProgress(profileCoachmarkOptions, (current) => ({
      completed: true,
      dismissed: false,
      currentStep: Math.max(profileCoachmarkSteps.length - 1, 0),
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    closeCoachmarks();
    if (guidedTourActive) onGuidedTourComplete?.();
  };

  const handleCoachmarkSkip = () => {
    patchCoachmarkProgress(profileCoachmarkOptions, {
      dismissed: true,
      currentStep: coachmarkStepIndex,
    });
    closeCoachmarks();
    if (guidedTourActive) onGuidedTourDismiss?.();
  };

  const handleNavigate = (screen: 'gym' | 'rank' | 'settings' | 'notifications' | 'workout' | 'weeklyPlan' | 'customPlanBuilder' | 'posts' | 'friends' | 'coachList' | 'exercises') => {
    if (screen === 'workout') {
      onNavigateTab?.('workout');
      return;
    }
    if (screen === 'exercises') {
      onNavigateTab?.('home', 'exercises');
      return;
    }
    if (screen === 'weeklyPlan') {
      setView('weeklyPlan');
      return;
    }
    if (screen === 'customPlanBuilder') {
      setView('customPlanBuilder');
      return;
    }
    if (screen === 'posts') {
      setView('posts');
      return;
    }
    if (screen === 'friends') {
      setView('friends');
      return;
    }
    if (screen === 'coachList') {
      setView('coachList');
      return;
    }
    setView(screen);
  };

  const handleLogout = async () => {
    await deactivateCurrentPushDevice();
    clearStoredUserSession();
    window.location.href = '/';
  };

  const profileMotionDirection = getNavigationDirection(
    view,
    previousViewRef.current,
    PROFILE_VIEW_ORDER,
  );

  const renderTransitionedView = (content: React.ReactNode) => (
    <ScreenTransition screenKey={view} direction={profileMotionDirection}>
      {content}
    </ScreenTransition>
  );

  if (view === 'gym') return renderTransitionedView(<GymAccessScreen onBack={() => setView('main')} />);
  if (view === 'rank')
  return renderTransitionedView(<RankingsRewardsScreen onBack={() => setView('main')} />);
  if (view === 'settings')
  return renderTransitionedView(
    <SettingsScreen
      onBack={() => setView('main')}
      onOpenGym={() => setView('gym')}
      onOpenHomeTour={() => {
        onRestartGuidedTour?.();
        onNavigateTab?.('home');
      }}
    />
  );
  if (view === 'notifications')
  return renderTransitionedView(
    <NotificationsScreen
      onBack={() => setView('main')}
      onOpenAcceptedChallenge={(challenge) => {
        setAcceptedChallengeContext(challenge);
        setView('notificationChallenge');
      }}
    />
  );
  if (view === 'weeklyPlan')
  return renderTransitionedView(
    <CurrentWeekPlanScreen
      onBack={() => setView('main')}
      onOpenWorkout={() => onNavigateTab?.('workout')}
      onCreateCustom={() => setView('presetPlans')}
    />
  );
  if (view === 'presetPlans')
  return renderTransitionedView(
    <PresetProgramScreen
      onBack={() => setView('weeklyPlan')}
      onSaved={() => onNavigateTab?.('workout')}
      onBuildCustom={() => setView('customPlanBuilder')}
    />
  );
  if (view === 'customPlanBuilder')
  return renderTransitionedView(
    <CustomPlanBuilderScreen
      onBack={() => setView('presetPlans')}
      onSaved={() => onNavigateTab?.('workout')}
    />
  );
  if (view === 'posts')
  return renderTransitionedView(<MyPostsScreen onBack={() => setView('main')} />);
  if (view === 'friends')
  return renderTransitionedView(
    <FriendsList
      onBack={() => setView('main')}
      onFriendClick={(friend) => {
        setSelectedFriend(friend);
        setView('friendProfile');
      }}
    />
  );
  if (view === 'friendProfile')
  return renderTransitionedView(
    <FriendProfile
      onBack={() => setView('friends')}
      onChallenge={() => setView('friendChallenge')}
      friend={selectedFriend}
    />
  );
  if (view === 'friendChallenge') {
    return renderTransitionedView(
      <FriendChallengeScreen
        onBack={() => setView('friendProfile')}
        onExitHome={() => setView('main')}
        friendName={selectedFriend?.name}
        friendId={selectedFriend?.id}
      />
    );
  }
  if (view === 'notificationChallenge') {
    return renderTransitionedView(
      <FriendChallengeScreen
        onBack={() => setView('notifications')}
        onExitHome={() => setView('main')}
        friendName={acceptedChallengeContext?.friendName}
        friendId={acceptedChallengeContext?.friendId}
        initialView="intro"
        directChallengeId={toFriendChallengeCardId(acceptedChallengeContext?.challengeKey)}
        currentUserPlayer="player2"
        challengeSessionId={acceptedChallengeContext?.challengeSessionId}
      />
    );
  }
  if (view === 'coachList')
  return renderTransitionedView(
    <CoachList
      onBack={() => setView('main')}
      onSelectCoach={(id, name) => {
        setSelectedCoach({ id, name });
        setView('chat');
      }}
    />
  );
  if (view === 'chat')
  return renderTransitionedView(
    <Messaging
      onBack={() => setView('coachList')}
      coachId={selectedCoach?.id}
      coachName={selectedCoach?.name}
    />
  );
  return renderTransitionedView(
    <div className="relative">
      {/* Header action icons */}
      <ScreenSection index={0} className="relative z-20">
        <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
          <button
            data-coachmark-target="profile_settings_button"
            onClick={() => setView('settings')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/35 bg-accent/10 text-accent shadow-[0_12px_24px_-18px_rgba(0,0,0,0.8),0_0_18px_rgba(205,255,88,0.12)] ring-1 ring-inset ring-accent/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/55 hover:bg-accent/15 active:scale-95"
            aria-label={copy.openSettings}
          >
            <Settings size={20} />
          </button>
        </div>
      </ScreenSection>

      <ScreenSection index={1} className="relative z-0 space-y-6 pb-24 px-4 sm:px-6">
        <ProfileScreen onNavigate={handleNavigate} onLogout={handleLogout} />
      </ScreenSection>

      <CoachmarkOverlay
        isOpen={isCoachmarkOpen}
        step={activeCoachmarkStep}
        stepIndex={coachmarkStepIndex}
        totalSteps={profileCoachmarkSteps.length}
        nextLabel={profileCoachmarkCopy.next}
        finishLabel={profileCoachmarkCopy.finish}
        skipLabel={profileCoachmarkCopy.skip}
        onNext={handleCoachmarkNext}
        onFinish={handleCoachmarkFinish}
        onSkip={handleCoachmarkSkip}
      />
    </div>);

}
