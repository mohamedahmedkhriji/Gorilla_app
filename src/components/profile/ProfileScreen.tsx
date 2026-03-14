import React, { useState, useEffect } from 'react';
import { User, ChevronRight, Camera, Dumbbell, FileText, LogOut, X } from 'lucide-react';
import { api } from '../../services/api';
import { FriendsCard } from '../home/FriendsCard';
import { CoachCard } from '../home/CoachCard';
interface ProfileScreenProps {
  onNavigate: (screen: 'gym' | 'rank' | 'settings' | 'workout' | 'weeklyPlan' | 'posts' | 'friends' | 'coachList') => void;
  onLogout: () => void;
}

interface CoachOption {
  id: number;
  name: string;
  email?: string;
}

export function ProfileScreen({ onNavigate, onLogout }: ProfileScreenProps) {
  const parseStoredUser = (raw: string | null) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const appUser = parseStoredUser(localStorage.getItem('appUser'));
  const legacyUser = parseStoredUser(localStorage.getItem('user'));
  const user = appUser || legacyUser || { name: 'Moha' };
  const userName = String(user?.name || 'Moha');

  const appUserId = Number(localStorage.getItem('appUserId') || 0);
  const legacyUserId = Number(localStorage.getItem('userId') || 0);
  const parsedUserId = Number(
    user?.id
    ?? user?.userId
    ?? user?.user_id
    ?? 0,
  );
  const userId = appUserId || legacyUserId || parsedUserId;
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
  const createdAt = user?.created_at || user?.createdAt;

  const isValidImageDataUrl = (value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('data:image/') && value.includes(';base64,');

  const memberSinceText = (() => {
    if (!createdAt) return 'Member since -';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return 'Member since -';
    return `Member since ${date.getFullYear()}`;
  })();
  
  useEffect(() => {
    if (!userId) return;

    // Keep user-app storage keys aligned.
    if (appUserId !== userId || legacyUserId !== userId) {
      localStorage.setItem('appUserId', String(userId));
      localStorage.setItem('userId', String(userId));
    }

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
  }, [userId, appUserId, legacyUserId]);

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
          alert(error instanceof Error ? error.message : 'Could not save profile picture to database.');
        }
      };
      reader.readAsDataURL(file);
    } else if (file && !userId) {
      alert('No active user session found. Please log in again.');
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
              name: String(coach?.name || '').trim() || 'Coach',
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
  }, [isCoachPickerOpen]);

  const handleSelectCoach = async (coach: CoachOption) => {
    if (!userId || coachRequestingId) return;
    try {
      setCoachRequestingId(coach.id);
      await api.requestCoachPlanCreation(userId, coach.id);
      setIsCoachPickerOpen(false);
      alert(`Request sent to ${coach.name}.`);
    } catch (error: any) {
      console.error('Failed to send coach plan request:', error);
      alert(error?.message || 'Failed to send request to coach.');
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
                  alt="Profile"
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
            Exercises
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('rank')}
          className="bg-card rounded-xl p-3 text-center border border-white/5 hover:bg-white/5 transition-colors"
        >
          <div className="text-xl font-bold text-white">{rankPosition > 0 ? `#${rankPosition}` : '0'}</div>
          <div className="text-[10px] text-text-secondary uppercase">
            Classification
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">of {Math.max(0, rankTotalMembers)}</div>
        </button>
        <div className="bg-card rounded-xl p-3 text-center border border-white/5">
          <div className="text-xl font-bold text-white">{Math.max(0, planDaysLeft)}</div>
          <div className="text-[10px] text-text-secondary uppercase">
            Days Left
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">{planSessionsLeft} sessions</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FriendsCard onClick={() => onNavigate('friends')} />
        <CoachCard onClick={() => onNavigate('coachList')} />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onNavigate('posts')}
          className="w-full bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <FileText size={20} />
            </div>
            <div className="text-left">
              <div className="font-medium text-white">My Blog Posts</div>
              <div className="text-xs text-text-secondary">Edit or remove your uploads</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-text-tertiary" />
        </button>

        <button
          type="button"
          onClick={() => setIsPlanChoiceOpen(true)}
          className="w-full bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors">

          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <Dumbbell size={20} />
            </div>
            <div className="text-left">
              <div className="font-medium text-white">Create My Workout Plan</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-text-tertiary" />
        </button>

        <button
          type="button"
          onClick={() => setIsLogoutOpen(true)}
          className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-marker flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
        >
          <LogOut size={20} />
          Log Out
        </button>
      </div>

      {isPlanChoiceOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsPlanChoiceOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg">Create My Workout Plan</h3>
            <p className="text-sm text-text-secondary">Choose how you want to build your plan.</p>
            <button
              type="button"
              onClick={() => handlePlanChoice('alone')}
              className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 text-left text-white border border-white/10"
            >
              Create Alone
            </button>
            <button
              type="button"
              onClick={() => handlePlanChoice('coach')}
              className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 text-left text-white border border-white/10"
            >
              With Coach
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
                aria-label="Close logout dialog"
              >
                <X size={18} />
              </button>
              <h3 className="text-base font-semibold text-error">Logout</h3>
              <div className="w-9 h-9" aria-hidden="true" />
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm font-semibold text-text-primary">Are you sure want to Logout?</p>
              <p className="text-xs text-text-secondary mt-1">Thank you and see you again!</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsLogoutOpen(false)}
                className="w-full rounded-full border border-success/30 bg-success/10 py-2.5 text-sm font-semibold text-success hover:bg-success/20 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutOpen(false);
                  onLogout();
                }}
                className="w-full rounded-full bg-success py-2.5 text-sm font-semibold text-text-primary hover:bg-success/90 transition-colors"
              >
                Yes, Logout
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
            <h3 className="text-white font-semibold text-lg">Choose Coach</h3>
            <p className="text-sm text-text-secondary">Select a coach to request a personalized plan.</p>

            {coachesLoading && (
              <div className="text-sm text-text-secondary">Loading coaches...</div>
            )}

            {!coachesLoading && coaches.length === 0 && (
              <div className="text-sm text-text-secondary">No coaches available.</div>
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
                  {coachRequestingId === coach.id ? ' (Sending...)' : ''}
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
            Close
          </button>
          <img
            src={profilePicture}
            alt="Profile preview"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>);

}
