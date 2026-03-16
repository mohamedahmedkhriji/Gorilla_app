import React, { useState, useEffect } from 'react';
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
    myBlogPosts: 'My Blog Posts',
    manageUploads: 'Manage Uploads',
    open: 'Open',
    createWorkoutPlan: 'Create My Workout Plan',
    planBuilder: 'Plan Builder',
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
    myBlogPosts: '\u0645\u0646\u0634\u0648\u0631\u0627\u062a\u064a',
    manageUploads: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0641\u0648\u0639\u0627\u062a',
    open: '\u0641\u062a\u062d',
    createWorkoutPlan: '\u0623\u0646\u0634\u0626 \u062e\u0637\u0629 \u062a\u0645\u0631\u064a\u0646\u064a',
    planBuilder: '\u0628\u0646\u0627\u0621 \u0627\u0644\u062e\u0637\u0629',
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
} as const;

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
  const createdAt = user?.created_at || user?.createdAt;
  const copy = PROFILE_I18N[language] || PROFILE_I18N.en;

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
      <div className="flex items-center gap-4 pt-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-text-tertiary overflow-hidden">
            <button
              type="button"
              className="w-full h-full"
              onClick={() => {
                if (profilePicture) setIsPreviewOpen(true);
              }}
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
          <label className="absolute bottom-0 right-0 w-6 h-6 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-accent/80 transition-colors">
            <Camera size={12} className="text-white" />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">{userName}</h1>
          <p className="text-text-secondary">{memberSinceText}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-3 text-center border border-white/5">
          <div className="text-xl font-bold text-white">{completedExercises ?? '-'}</div>
          <div className="text-[10px] text-text-secondary uppercase">
            {copy.exercises}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('rank')}
          className="bg-card rounded-xl p-3 text-center border border-white/5 hover:bg-white/5 transition-colors"
        >
          <div className="text-xl font-bold text-white">{rankPosition > 0 ? `#${rankPosition}` : '0'}</div>
          <div className="text-[10px] text-text-secondary uppercase">
            {copy.classification}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">{copy.of} {Math.max(0, rankTotalMembers)}</div>
        </button>
        <div className="bg-card rounded-xl p-3 text-center border border-white/5">
          <div className="text-xl font-bold text-white">{Math.max(0, planDaysLeft)}</div>
          <div className="text-[10px] text-text-secondary uppercase">
            {copy.daysLeft}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">{planSessionsLeft} {copy.sessions}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FriendsCard onClick={() => onNavigate('friends')} />
        <CoachCard onClick={() => onNavigate('coachList')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('posts')}
          className="surface-card rounded-2xl p-5 relative overflow-hidden p-4 flex flex-col justify-between h-full cursor-pointer border border-white/15 hover:border-emerald-400/35 transition-colors group text-left"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/50 to-black/70" />
          <div className="relative z-10 flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <FileText size={20} />
            </div>
            <img src={emojiRightArrow} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="relative z-10 mt-4 min-w-0">
            <div className="text-lg leading-none text-white truncate">{copy.myBlogPosts}</div>
            <div className="text-[10px] text-text-secondary uppercase tracking-[0.12em] mt-1">{copy.manageUploads}</div>
          </div>
          <div className="relative z-10 mt-3 text-[11px] text-emerald-300 font-semibold uppercase tracking-[0.1em]">{copy.open}</div>
        </button>

        <button
          type="button"
          onClick={() => setIsPlanChoiceOpen(true)}
          className="surface-card rounded-2xl p-5 relative overflow-hidden p-4 flex flex-col justify-between h-full cursor-pointer border border-white/15 hover:border-accent/35 transition-colors group text-left"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/50 to-black/70" />
          <div className="relative z-10 flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/35 flex items-center justify-center text-accent">
              <Dumbbell size={20} />
            </div>
            <img src={emojiRightArrow} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="relative z-10 mt-4 min-w-0">
            <div className="text-lg leading-none text-white truncate">{copy.createWorkoutPlan}</div>
            <div className="text-[10px] text-text-secondary uppercase tracking-[0.12em] mt-1">{copy.planBuilder}</div>
          </div>
          <div className="relative z-10 mt-3 text-[11px] text-accent font-semibold uppercase tracking-[0.1em]">{copy.start}</div>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setIsLogoutOpen(true)}
        className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-marker flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
      >
        <LogOut size={20} />
        {copy.logOut}
      </button>

      {isPlanChoiceOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsPlanChoiceOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg">{copy.choosePlanTitle}</h3>
            <p className="text-sm text-text-secondary">{copy.choosePlanSubtitle}</p>
            <button
              type="button"
              onClick={() => handlePlanChoice('alone')}
              className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 text-left text-white border border-white/10"
            >
              {copy.createAlone}
            </button>
            <button
              type="button"
              onClick={() => handlePlanChoice('coach')}
              className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 text-left text-white border border-white/10"
            >
              {copy.withCoach}
            </button>
          </div>
        </div>
      )}

      {isLogoutOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setIsLogoutOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-white/10 rounded-3xl p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsLogoutOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 text-text-secondary hover:bg-white/20 transition-colors flex items-center justify-center"
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
                className="w-full rounded-full border border-success/30 bg-success/10 py-2.5 text-sm font-semibold text-success hover:bg-success/20 transition-colors"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutOpen(false);
                  onLogout();
                }}
                className="w-full rounded-full bg-success py-2.5 text-sm font-semibold text-text-primary hover:bg-success/90 transition-colors"
              >
                {copy.yesLogout}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCoachPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsCoachPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-4 space-y-3 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg">{copy.chooseCoach}</h3>
            <p className="text-sm text-text-secondary">{copy.chooseCoachSubtitle}</p>

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
                className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 text-left text-white border border-white/10 disabled:opacity-50"
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
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-sm px-3 py-1 rounded bg-white/10 hover:bg-white/20"
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
