import React, { useEffect, useRef, useState } from 'react';
import { User, Camera, Dumbbell, FileText, LogOut, X } from 'lucide-react';
import { api } from '../../services/api';
import { getStoredAppUser, getStoredUserId, persistStoredUser } from '../../shared/authStorage';
import { FriendsCard } from '../home/FriendsCard';
import { CoachCard } from '../home/CoachCard';
import { emojiRightArrow } from '../../services/emojiTheme';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
interface ProfileScreenProps {
  onNavigate: (screen: 'gym' | 'rank' | 'settings' | 'workout' | 'weeklyPlan' | 'posts' | 'friends' | 'coachList') => void;
  onLogout: () => void;
}

interface CoachOption {
  id: number;
  name: string;
  email?: string;
}

const PROFILE_I18N = {
  en: {
    memberSincePrefix: 'Member since',
    memberSinceUnknown: 'Member since -',
    exercises: 'Exercises',
    classification: 'Classification',
    of: 'of',
    daysLeft: 'Days Left',
    sessions: 'sessions',
    myBlogPostsLine1: 'My Blog',
    myBlogPostsLine2: 'Posts',
    open: 'Open',
    createWorkoutPlanLine1: 'Create My',
    createWorkoutPlanLine2: 'Workout Plan',
    start: 'Start',
    logOut: 'Log Out',
    choosePlanTitle: 'Create My Workout Plan',
    choosePlanSubtitle: 'Choose how you want to build your plan.',
    createAlone: 'Create Alone',
    withCoach: 'With Coach',
    closeLogoutDialog: 'Close logout dialog',
    logoutTitle: 'Logout',
    logoutConfirm: 'Are you sure want to Logout?',
    logoutThanks: 'Thank you and see you again!',
    cancel: 'Cancel',
    yesLogout: 'Yes, Logout',
    chooseCoach: 'Choose Coach',
    chooseCoachSubtitle: 'Select a coach to request a personalized plan.',
    loadingCoaches: 'Loading coaches...',
    noCoaches: 'No coaches available.',
    sending: 'Sending...',
    close: 'Close',
    profileAlt: 'Profile',
    profilePreviewAlt: 'Profile preview',
    profileSaveFailed: 'Could not save profile picture to database.',
    noSession: 'No active user session found. Please log in again.',
    requestSentPrefix: 'Request sent to',
    requestFailed: 'Failed to send request to coach.',
    coachFallbackName: 'Coach',
  },
  ar: {
    memberSincePrefix: '\u0639\u0636\u0648 \u0645\u0646\u0630',
    memberSinceUnknown: '\u0639\u0636\u0648 \u0645\u0646\u0630 -',
    exercises: '\u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646',
    classification: '\u0627\u0644\u062a\u0635\u0646\u064a\u0641',
    of: '\u0645\u0646',
    daysLeft: '\u0627\u0644\u0623\u064a\u0627\u0645 \u0627\u0644\u0645\u062a\u0628\u0642\u064a\u0629',
    sessions: '\u062d\u0635\u0635',
    myBlogPostsLine1: '\u0645\u0646\u0634\u0648\u0631\u0627\u062a\u064a',
    myBlogPostsLine2: '\u0627\u0644\u0645\u062f\u0648\u0646\u0629',
    open: '\u0641\u062a\u062d',
    createWorkoutPlanLine1: '\u0623\u0646\u0634\u0626',
    createWorkoutPlanLine2: '\u062e\u0637\u0629 \u062a\u0645\u0631\u064a\u0646\u064a',
    start: '\u0627\u0628\u062f\u0623',
    logOut: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c',
    choosePlanTitle: '\u0623\u0646\u0634\u0626 \u062e\u0637\u0629 \u062a\u0645\u0631\u064a\u0646\u064a',
    choosePlanSubtitle: '\u0627\u062e\u062a\u0631 \u0637\u0631\u064a\u0642\u0629 \u0628\u0646\u0627\u0621 \u062e\u0637\u062a\u0643.',
    createAlone: '\u0625\u0646\u0634\u0627\u0621 \u0628\u0646\u0641\u0633\u064a',
    withCoach: '\u0645\u0639 \u0645\u062f\u0631\u0628',
    closeLogoutDialog: '\u0625\u063a\u0644\u0627\u0642 \u0646\u0627\u0641\u0630\u0629 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c',
    logoutTitle: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c',
    logoutConfirm: '\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c\u061f',
    logoutThanks: '\u0634\u0643\u0631\u0627\u064b \u0648\u0646\u0631\u0627\u0643 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649!',
    cancel: '\u0625\u0644\u063a\u0627\u0621',
    yesLogout: '\u0646\u0639\u0645\u060c \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c',
    chooseCoach: '\u0627\u062e\u062a\u0631 \u0645\u062f\u0631\u0628\u0627\u064b',
    chooseCoachSubtitle: '\u0627\u062e\u062a\u0631 \u0645\u062f\u0631\u0628\u0627\u064b \u0644\u0637\u0644\u0628 \u062e\u0637\u0629 \u0645\u062e\u0635\u0635\u0629.',
    loadingCoaches: '\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u062f\u0631\u0628\u064a\u0646...',
    noCoaches: '\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u062f\u0631\u0628\u0648\u0646 \u0645\u062a\u0627\u062d\u0648\u0646.',
    sending: '\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644...',
    close: '\u0625\u063a\u0644\u0627\u0642',
    profileAlt: '\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a',
    profilePreviewAlt: '\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a',
    profileSaveFailed: '\u062a\u0639\u0630\u0631 \u062d\u0641\u0638 \u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0644\u0641 \u0641\u064a \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.',
    noSession: '\u0644\u0627 \u062a\u0648\u062c\u062f \u062c\u0644\u0633\u0629 \u0645\u0633\u062a\u062e\u062f\u0645 \u0646\u0634\u0637\u0629. \u064a\u0631\u062c\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.',
    requestSentPrefix: '\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628 \u0625\u0644\u0649',
    requestFailed: '\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628 \u0625\u0644\u0649 \u0627\u0644\u0645\u062f\u0631\u0628.',
    coachFallbackName: '\u0645\u062f\u0631\u0628',
  },
  it: {
    memberSincePrefix: 'Membro dal',
    memberSinceUnknown: 'Membro dal -',
    exercises: 'Esercizi',
    classification: 'Classifica',
    of: 'su',
    daysLeft: 'Giorni Rimasti',
    sessions: 'sessioni',
    myBlogPostsLine1: 'I Miei Post',
    myBlogPostsLine2: 'del Blog',
    open: 'Apri',
    createWorkoutPlanLine1: 'Crea il Mio',
    createWorkoutPlanLine2: 'Piano di Allenamento',
    start: 'Inizia',
    logOut: 'Esci',
    choosePlanTitle: 'Crea il Mio Piano di Allenamento',
    choosePlanSubtitle: 'Scegli come vuoi costruire il tuo piano.',
    createAlone: 'Crea da Solo',
    withCoach: 'Con Coach',
    closeLogoutDialog: 'Chiudi finestra di logout',
    logoutTitle: 'Esci',
    logoutConfirm: 'Sei sicuro di voler uscire?',
    logoutThanks: 'Grazie e a presto!',
    cancel: 'Annulla',
    yesLogout: 'Si, Esci',
    chooseCoach: 'Scegli Coach',
    chooseCoachSubtitle: 'Seleziona un coach per richiedere un piano personalizzato.',
    loadingCoaches: 'Caricamento coach...',
    noCoaches: 'Nessun coach disponibile.',
    sending: 'Invio...',
    close: 'Chiudi',
    profileAlt: 'Profilo',
    profilePreviewAlt: 'Anteprima profilo',
    profileSaveFailed: 'Impossibile salvare la foto profilo nel database.',
    noSession: 'Nessuna sessione utente attiva trovata. Effettua di nuovo l accesso.',
    requestSentPrefix: 'Richiesta inviata a',
    requestFailed: 'Invio richiesta al coach non riuscito.',
    coachFallbackName: 'Coach',
  },
  fr: {
    memberSincePrefix: 'Membre depuis',
    memberSinceUnknown: 'Membre depuis -',
    exercises: 'Exercices',
    classification: 'Classement',
    of: 'sur',
    daysLeft: 'Jours restants',
    sessions: 'seances',
    myBlogPostsLine1: 'Mes Articles',
    myBlogPostsLine2: 'de Blog',
    open: 'Ouvrir',
    createWorkoutPlanLine1: 'Creer Mon',
    createWorkoutPlanLine2: 'Plan d entrainement',
    start: 'Commencer',
    logOut: 'Se deconnecter',
    choosePlanTitle: 'Creer Mon Plan d entrainement',
    choosePlanSubtitle: 'Choisis comment tu veux construire ton plan.',
    createAlone: 'Creer seul',
    withCoach: 'Avec Coach',
    closeLogoutDialog: 'Fermer la fenetre de deconnexion',
    logoutTitle: 'Deconnexion',
    logoutConfirm: 'Es-tu sur de vouloir te deconnecter ?',
    logoutThanks: 'Merci et a tres bientot !',
    cancel: 'Annuler',
    yesLogout: 'Oui, se deconnecter',
    chooseCoach: 'Choisir un Coach',
    chooseCoachSubtitle: 'Selectionne un coach pour demander un plan personnalise.',
    loadingCoaches: 'Chargement des coachs...',
    noCoaches: 'Aucun coach disponible.',
    sending: 'Envoi...',
    close: 'Fermer',
    profileAlt: 'Profil',
    profilePreviewAlt: 'Apercu du profil',
    profileSaveFailed: 'Impossible d enregistrer la photo de profil dans la base de donnees.',
    noSession: 'Aucune session utilisateur active trouvee. Merci de te reconnecter.',
    requestSentPrefix: 'Demande envoyee a',
    requestFailed: 'Impossible d envoyer la demande au coach.',
    coachFallbackName: 'Coach',
  },
  de: {
    memberSincePrefix: 'Mitglied seit',
    memberSinceUnknown: 'Mitglied seit -',
    exercises: 'Uebungen',
    classification: 'Platzierung',
    of: 'von',
    daysLeft: 'Tage Uebrig',
    sessions: 'Einheiten',
    myBlogPostsLine1: 'Meine Blog',
    myBlogPostsLine2: 'Beitraege',
    open: 'Oeffnen',
    createWorkoutPlanLine1: 'Meinen Trainingsplan',
    createWorkoutPlanLine2: 'Erstellen',
    start: 'Starten',
    logOut: 'Abmelden',
    choosePlanTitle: 'Meinen Trainingsplan Erstellen',
    choosePlanSubtitle: 'Waehle, wie du deinen Plan erstellen moechtest.',
    createAlone: 'Allein Erstellen',
    withCoach: 'Mit Coach',
    closeLogoutDialog: 'Abmeldedialog schliessen',
    logoutTitle: 'Abmelden',
    logoutConfirm: 'Bist du sicher, dass du dich abmelden willst?',
    logoutThanks: 'Danke und bis bald!',
    cancel: 'Abbrechen',
    yesLogout: 'Ja, Abmelden',
    chooseCoach: 'Coach Auswaehlen',
    chooseCoachSubtitle: 'Waehle einen Coach fuer einen personalisierten Plan.',
    loadingCoaches: 'Coaches werden geladen...',
    noCoaches: 'Keine Coaches verfuegbar.',
    sending: 'Wird gesendet...',
    close: 'Schliessen',
    profileAlt: 'Profil',
    profilePreviewAlt: 'Profilvorschau',
    profileSaveFailed: 'Profilbild konnte nicht in der Datenbank gespeichert werden.',
    noSession: 'Keine aktive Benutzersitzung gefunden. Bitte melde dich erneut an.',
    requestSentPrefix: 'Anfrage gesendet an',
    requestFailed: 'Anfrage an den Coach konnte nicht gesendet werden.',
    coachFallbackName: 'Coach',
  },
} as const;

const profilePanelClassName =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.03] backdrop-blur-sm';

const statCardClassName =
  `${profilePanelClassName} px-3 py-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 active:scale-[0.985]`;

const featureCardClassName =
  `${profilePanelClassName} group flex h-full cursor-pointer flex-col justify-between p-4 text-left transition-all duration-300 hover:-translate-y-1 active:scale-[0.985]`;

const featureIconClassName =
  'relative flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';

export function ProfileScreen({ onNavigate, onLogout }: ProfileScreenProps) {
  const user = getStoredAppUser() || { name: 'Moha' };
  const userName = String(user?.name || 'Moha');

  const parsedUserId = Number(
    user?.id
    ?? user?.userId
    ?? user?.user_id
    ?? 0,
  );
  const userId = Number(getStoredUserId() || parsedUserId || 0);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [completedExercises, setCompletedExercises] = useState(0);
  const [rankPosition, setRankPosition] = useState(0);
  const [rankTotalMembers, setRankTotalMembers] = useState(0);
  const [planDaysLeft, setPlanDaysLeft] = useState(0);
  const [planSessionsLeft, setPlanSessionsLeft] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPlanChoiceOpen, setIsPlanChoiceOpen] = useState(false);
  const [isCoachPickerOpen, setIsCoachPickerOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [coachRequestingId, setCoachRequestingId] = useState<number | null>(null);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const createdAt = user?.created_at || user?.createdAt;
  const copy = PROFILE_I18N[language as keyof typeof PROFILE_I18N] || PROFILE_I18N.en;

  const isValidImageDataUrl = (value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('data:image/') && value.includes(';base64,');

  const memberSinceText = (() => {
    if (!createdAt) return copy.memberSinceUnknown;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return copy.memberSinceUnknown;
    return `${copy.memberSincePrefix} ${date.getFullYear()}`;
  })();

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
    if (!userId) return;

    // Keep user-app storage keys aligned.
    persistStoredUser({ ...user, id: userId });

    const fetchProfilePicture = async () => {
      try {
        const result = await api.getProfilePicture(userId);
        setProfilePicture(isValidImageDataUrl(result.profilePicture) ? result.profilePicture : null);
      } catch (error) {
        console.error('Failed to load profile picture:', error);
      }
    };

    const fetchProfileStats = async () => {
      try {
        const stats = await api.getProfileStats(userId);
        const completedExercisesValue = Number(stats?.completedExercises || 0);
        setCompletedExercises(Number.isFinite(completedExercisesValue) ? Math.max(0, completedExercisesValue) : 0);
        let position = Number(
          stats?.classification?.position
          ?? stats?.rankPosition
          ?? 0,
        );
        let totalMembers = Number(
          stats?.classification?.total
          ?? stats?.totalMembers
          ?? 0,
        );

        // Fallback for older/inconsistent profile-stats payloads.
        if ((!(position > 0) || !(totalMembers > 0)) && userId > 0) {
          try {
            const leaderboard = await api.getLeaderboard(userId, 'alltime');
            const rows = Array.isArray(leaderboard?.leaderboard) ? leaderboard.leaderboard : [];
            const getRowUserId = (row: any) =>
              Number(row?.id ?? row?.userId ?? row?.user_id ?? 0);
            const me = rows.find((row: any) => getRowUserId(row) === userId);
            const rowIndex = rows.findIndex((row: any) => getRowUserId(row) === userId);
            const fallbackRank = Number(
              me?.rank
              ?? me?.position
              ?? (rowIndex >= 0 ? rowIndex + 1 : 0),
            );
            if (fallbackRank > 0) position = fallbackRank;
            if (rows.length > 0) totalMembers = rows.length;

            // If the current user is not present in leaderboard rows, estimate
            // rank from all-time points so the UI still shows a numeric position.
            if (!(position > 0) && rows.length > 0) {
              const userPoints = Number(
                stats?.totalPoints
                ?? stats?.points
                ?? 0,
              );
              const aheadCount = rows.filter((row: any) => {
                const rowPoints = Number(
                  row?.points
                  ?? row?.total_points
                  ?? row?.totalPoints
                  ?? 0,
                );
                const rowUserId = getRowUserId(row);
                return rowPoints > userPoints || (rowPoints === userPoints && rowUserId > 0 && rowUserId < userId);
              }).length;
              position = aheadCount + 1;
            }
          } catch {
            // ignore fallback failure and keep base stats values
          }
        }

        setRankPosition(position > 0 ? position : 0);
        setRankTotalMembers(totalMembers > 0 ? totalMembers : 0);

        const statsSessionsLeft = Number(
          stats?.planSessionsLeft
          ?? (
            Number(stats?.planPlannedWorkouts || 0)
            - Number(stats?.planCompletedWorkouts || 0)
          )
          ?? 0,
        );
        const statsDaysLeft = Number(stats?.planDaysLeft ?? 0);
        if (Number.isFinite(statsSessionsLeft)) {
          setPlanSessionsLeft(Math.max(0, Math.round(statsSessionsLeft)));
        }
        if (Number.isFinite(statsDaysLeft)) {
          setPlanDaysLeft(Math.max(0, Math.round(statsDaysLeft)));
        }
      } catch (error) {
        console.error('Failed to load profile stats:', error);
        setCompletedExercises(0);
        setRankPosition(0);
        setRankTotalMembers(0);
      }
    };

    const fetchProgramProgress = async () => {
      try {
        const progress = await api.getProgramProgress(userId);
        if (!progress?.hasActiveProgram) {
          setPlanDaysLeft(0);
          setPlanSessionsLeft(0);
          return;
        }

        const summary = progress?.summary || {};
        const program = progress?.program || {};
        const planned = Number(summary.plannedWorkouts || 0);
        const completed = Number(summary.completedWorkouts || 0);
        const sessionsLeft = Math.max(planned - completed, 0);
        const calendarDaysLeft = Number(summary.calendarDaysLeft);
        const daysPerWeekRaw = Number(program.daysPerWeek || summary.workoutsPlannedThisWeek || 0);
        const daysPerWeek = daysPerWeekRaw > 0 ? daysPerWeekRaw : 4;
        const estimatedDaysLeft = sessionsLeft > 0 ? Math.ceil((sessionsLeft / daysPerWeek) * 7) : 0;
        const daysLeft = Number.isFinite(calendarDaysLeft) && calendarDaysLeft >= 0
          ? Math.round(calendarDaysLeft)
          : estimatedDaysLeft;

        setPlanSessionsLeft(sessionsLeft);
        setPlanDaysLeft(daysLeft);
      } catch (error) {
        console.error('Failed to load program progress:', error);
      }
    };

    fetchProfilePicture();
    void fetchProfileStats();
    void fetchProgramProgress();

    const statsRefresh = setInterval(() => {
      void fetchProfileStats();
      void fetchProgramProgress();
    }, 15 * 1000);

    return () => clearInterval(statsRefresh);
  }, [userId]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && userId) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const previousPicture = profilePicture;
        setProfilePicture(base64);
        try {
          await api.updateProfilePicture(userId, base64);
        } catch (error) {
          console.error('Failed to save profile picture:', error);
          setProfilePicture(previousPicture);
          alert(error instanceof Error ? error.message : copy.profileSaveFailed);
        }
      };
      reader.readAsDataURL(file);
    } else if (file && !userId) {
      alert(copy.noSession);
    }

    event.target.value = '';
  };

  const handleAvatarButtonClick = () => {
    if (profilePicture) {
      setIsPreviewOpen(true);
      return;
    }

    avatarInputRef.current?.click();
  };

  const handlePlanChoice = (choice: 'alone' | 'coach') => {
    setIsPlanChoiceOpen(false);
    if (choice === 'alone') {
      onNavigate('weeklyPlan');
      return;
    }
    setIsCoachPickerOpen(true);
  };

  useEffect(() => {
    let cancelled = false;

    const loadCoaches = async () => {
      if (!isCoachPickerOpen) return;
      try {
        setCoachesLoading(true);
        const list = await api.getAllCoaches();
        if (cancelled) return;
        const normalized = Array.isArray(list)
          ? list
            .map((coach: any) => ({
              id: Number(coach?.id || 0),
              name: String(coach?.name || '').trim() || copy.coachFallbackName,
              email: coach?.email ? String(coach.email) : undefined,
            }))
            .filter((coach: CoachOption) => coach.id > 0)
          : [];
        setCoaches(normalized);
      } catch (error) {
        console.error('Failed to load coaches:', error);
        if (!cancelled) setCoaches([]);
      } finally {
        if (!cancelled) setCoachesLoading(false);
      }
    };

    void loadCoaches();
    return () => {
      cancelled = true;
    };
  }, [isCoachPickerOpen, copy.coachFallbackName]);

  const handleSelectCoach = async (coach: CoachOption) => {
    if (!userId || coachRequestingId) return;
    try {
      setCoachRequestingId(coach.id);
      await api.requestCoachPlanCreation(userId, coach.id);
      setIsCoachPickerOpen(false);
      alert(`${copy.requestSentPrefix} ${coach.name}.`);
    } catch (error: any) {
      console.error('Failed to send coach plan request:', error);
      alert(error?.message || copy.requestFailed);
    } finally {
      setCoachRequestingId(null);
    }
  };
  
  return (
    <div className="space-y-6 pb-24">
      <div className={`${profilePanelClassName} flex items-center gap-4 px-4 py-4 pt-5`}>
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute -right-10 top-0 h-24 w-24 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <div
            data-coachmark-target="profile_avatar_button"
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_58%,rgba(255,255,255,0.02))] text-text-tertiary shadow-[0_16px_36px_-22px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/10"
          >
            <button
              type="button"
              className="w-full h-full"
              aria-label={profilePicture ? copy.profilePreviewAlt : copy.profileAlt}
              onClick={handleAvatarButtonClick}
            >
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={copy.profileAlt}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={36} className="mx-auto my-auto" />
              )}
            </button>
          </div>
          <label
            data-coachmark-target="profile_avatar_upload_button"
            className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-black/15 bg-accent text-black shadow-[0_10px_20px_-12px_rgba(205,255,88,0.7)] transition-all duration-200 hover:scale-105 hover:bg-accent/90 active:scale-95"
          >
            <Camera size={12} className="text-black" />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-semibold tracking-[-0.04em] text-white">{userName}</h1>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary">{memberSinceText}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          data-coachmark-target="profile_exercises_card"
          type="button"
          onClick={() => onNavigate('weeklyPlan')}
          className={statCardClassName}
        >
          <div className="mx-auto mb-3 h-px w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="text-[23px] font-semibold tracking-[-0.04em] text-white">{completedExercises ?? '-'}</div>
          <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-text-secondary">
            {copy.exercises}
          </div>
        </button>
        <button
          data-coachmark-target="profile_rank_card"
          type="button"
          onClick={() => onNavigate('rank')}
          className={statCardClassName}
        >
          <div className="mx-auto mb-3 h-px w-10 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
          <div className="text-[23px] font-semibold tracking-[-0.04em] text-white">{rankPosition > 0 ? `#${rankPosition}` : '0'}</div>
          <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-text-secondary">
            {copy.classification}
          </div>
          <div className="mt-1 text-[10px] font-medium text-text-tertiary">{copy.of} {Math.max(0, rankTotalMembers)}</div>
        </button>
        <div
          data-coachmark-target="profile_days_left_card"
          className={statCardClassName}
        >
          <div className="mx-auto mb-3 h-px w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="text-[23px] font-semibold tracking-[-0.04em] text-white">{Math.max(0, planDaysLeft)}</div>
          <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-text-secondary">
            {copy.daysLeft}
          </div>
          <div className="mt-1 text-[10px] font-medium text-text-tertiary">{planSessionsLeft} {copy.sessions}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FriendsCard
          onClick={() => onNavigate('friends')}
          coachmarkTargetId="profile_friends_card"
        />
        <CoachCard
          onClick={() => onNavigate('coachList')}
          coachmarkTargetId="profile_coach_card"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          data-coachmark-target="profile_posts_card"
          type="button"
          onClick={() => onNavigate('posts')}
          className={`${featureCardClassName} hover:border-emerald-400/30`}
        >
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.52))]" />
          <div className="relative z-10 flex justify-between items-start">
            <div className={`${featureIconClassName} text-emerald-300`}>
              <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <FileText size={20} />
            </div>
            <img src={emojiRightArrow} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-70 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
          <div className="relative z-10 mt-4 min-w-0">
            <div className="text-xl font-semibold leading-none tracking-[-0.03em] text-white">
              <div>{copy.myBlogPostsLine1}</div>
              <div>{copy.myBlogPostsLine2}</div>
            </div>
          </div>
          <div className="relative z-10 mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300">{copy.open}</div>
        </button>

        <button
          data-coachmark-target="profile_plan_builder_card"
          type="button"
          onClick={() => setIsPlanChoiceOpen(true)}
          className={`${featureCardClassName} hover:border-accent/30`}
        >
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(205,255,88,0.16),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.52))]" />
          <div className="relative z-10 flex justify-between items-start">
            <div className={`${featureIconClassName} text-accent`}>
              <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <Dumbbell size={20} />
            </div>
            <img src={emojiRightArrow} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-70 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
          <div className="relative z-10 mt-4 min-w-0">
            <div className="text-xl font-semibold leading-none tracking-[-0.03em] text-white">
              <div>{copy.createWorkoutPlanLine1}</div>
              <div>{copy.createWorkoutPlanLine2}</div>
            </div>
          </div>
          <div className="relative z-10 mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">{copy.start}</div>
        </button>
      </div>

      <button
        data-coachmark-target="profile_logout_button"
        type="button"
        onClick={() => setIsLogoutOpen(true)}
        className={`${profilePanelClassName} flex w-full items-center justify-center gap-2 rounded-[24px] border-red-500/15 bg-[linear-gradient(180deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04))] p-4 text-red-300 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-500/15 active:scale-[0.99]`}
      >
        <LogOut size={20} />
        {copy.logOut}
      </button>

      {isPlanChoiceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
          onClick={() => setIsPlanChoiceOpen(false)}
        >
          <div
            className={`${profilePanelClassName} w-full max-w-sm space-y-3 p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">{copy.choosePlanTitle}</h3>
            <p className="text-sm leading-6 text-text-secondary">{copy.choosePlanSubtitle}</p>
            <button
              type="button"
              onClick={() => handlePlanChoice('alone')}
              className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:border-accent/25 hover:bg-white/[0.08] active:scale-[0.99]"
            >
              {copy.createAlone}
            </button>
            <button
              type="button"
              onClick={() => handlePlanChoice('coach')}
              className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:border-accent/25 hover:bg-white/[0.08] active:scale-[0.99]"
            >
              {copy.withCoach}
            </button>
          </div>
        </div>
      )}

      {isLogoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          onClick={() => setIsLogoutOpen(false)}
        >
          <div
            className={`${profilePanelClassName} w-full max-w-sm rounded-[28px] p-5 shadow-card`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsLogoutOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-text-secondary transition-all duration-200 hover:bg-white/[0.12] active:scale-95"
                aria-label={copy.closeLogoutDialog}
              >
                <X size={18} />
              </button>
              <h3 className="text-base font-semibold text-error">{copy.logoutTitle}</h3>
              <div className="w-9 h-9" aria-hidden="true" />
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm font-semibold text-text-primary">{copy.logoutConfirm}</p>
              <p className="text-xs text-text-secondary mt-1">{copy.logoutThanks}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsLogoutOpen(false)}
                className="w-full rounded-full border border-success/30 bg-success/10 py-2.5 text-sm font-semibold text-success transition-all duration-200 hover:bg-success/20 active:scale-[0.99]"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutOpen(false);
                  onLogout();
                }}
                className="w-full rounded-full bg-success py-2.5 text-sm font-semibold text-text-primary shadow-[0_12px_24px_-16px_rgba(34,197,94,0.8)] transition-all duration-200 hover:bg-success/90 active:scale-[0.99]"
              >
                {copy.yesLogout}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCoachPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
          onClick={() => setIsCoachPickerOpen(false)}
        >
          <div
            className={`${profilePanelClassName} max-h-[80vh] w-full max-w-sm space-y-3 overflow-y-auto p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">{copy.chooseCoach}</h3>
            <p className="text-sm leading-6 text-text-secondary">{copy.chooseCoachSubtitle}</p>

            {coachesLoading && (
              <div className="text-sm text-text-secondary">{copy.loadingCoaches}</div>
            )}

            {!coachesLoading && coaches.length === 0 && (
              <div className="text-sm text-text-secondary">{copy.noCoaches}</div>
            )}

            {!coachesLoading && coaches.map((coach) => (
              <button
                key={coach.id}
                type="button"
                disabled={coachRequestingId !== null}
                onClick={() => void handleSelectCoach(coach)}
                className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:border-accent/25 hover:bg-white/[0.08] disabled:opacity-50"
              >
                <div className="font-medium">
                  {coach.name}
                  {coachRequestingId === coach.id ? ` (${copy.sending})` : ''}
                </div>
                {coach.email && (
                  <div className="text-xs text-text-secondary mt-0.5">{coach.email}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {isPreviewOpen && profilePicture && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-[2px]"
          onClick={() => setIsPreviewOpen(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition-all duration-200 hover:bg-white/20 active:scale-95"
            onClick={() => setIsPreviewOpen(false)}
          >
            {copy.close}
          </button>
          <img
            src={profilePicture}
            alt={copy.profilePreviewAlt}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>);

}
