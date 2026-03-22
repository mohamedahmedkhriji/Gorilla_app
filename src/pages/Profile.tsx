import React, { useEffect, useMemo, useState } from 'react';
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
import { api } from '../services/api';
import { ArrowLeft, Bell, Settings } from 'lucide-react';
import { useScrollToTopOnChange } from '../shared/scroll';
import { clearStoredUserSession, getStoredUserId } from '../shared/authStorage';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../services/language';
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
  && steps.every((step) => Boolean(document.querySelector(`[data-coachmark-target="${step.targetId}"]`)));

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
} as const;

const toChallengeCardId = (challengeKey?: string | null) => {
  const normalized = String(challengeKey || '').trim().toLowerCase();
  if (normalized === 'push_up_duel') return 'push-up-duel';
  if (normalized === 'squat_rep_race') return 'squat-rep-race';
  if (normalized === 'bench_press') return 'bench-press';
  if (normalized === 'deadlift_one') return 'deadlift-one';
  return 'push-up-duel';
};

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [coachmarkStepIndex, setCoachmarkStepIndex] = useState(0);
  const [isCoachmarkOpen, setIsCoachmarkOpen] = useState(false);

  useScrollToTopOnChange([view, resetSignal]);

  useEffect(() => {
    onTabBarVisibilityChange?.(view !== 'friendChallenge' && view !== 'notificationChallenge');

    return () => {
      onTabBarVisibilityChange?.(true);
    };
  }, [onTabBarVisibilityChange, view]);

  const copy = PROFILE_PAGE_I18N[language] || PROFILE_PAGE_I18N.en;

  const userId = useMemo(() => {
    return Number(getStoredUserId() || 0);
  }, []);
  const coachmarkScope = useMemo(() => getCoachmarkUserScope(), []);
  const isArabic = language === 'ar';
  const profileCoachmarkOptions = useMemo(
    () => ({
      tourId: PROFILE_COACHMARK_TOUR_ID,
      version: PROFILE_COACHMARK_VERSION,
      userScope: coachmarkScope,
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
    }),
    [coachmarkScope],
  );
  const profileCoachmarkCopy = useMemo(
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
  const profileCoachmarkSteps = useMemo<CoachmarkStep[]>(
    () => [
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
        id: 'notifications',
        targetId: 'profile_notifications_button',
        title: profileCoachmarkCopy.notificationsTitle,
        body: profileCoachmarkCopy.notificationsBody,
        placement: 'bottom',
        shape: 'circle',
        padding: 8,
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
        id: 'exercises',
        targetId: 'profile_exercises_card',
        title: profileCoachmarkCopy.exercisesTitle,
        body: profileCoachmarkCopy.exercisesBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 16,
      },
      {
        id: 'rank',
        targetId: 'profile_rank_card',
        title: profileCoachmarkCopy.rankTitle,
        body: profileCoachmarkCopy.rankBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 16,
      },
      {
        id: 'days_left',
        targetId: 'profile_days_left_card',
        title: profileCoachmarkCopy.daysLeftTitle,
        body: profileCoachmarkCopy.daysLeftBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 16,
      },
      {
        id: 'friends',
        targetId: 'profile_friends_card',
        title: profileCoachmarkCopy.friendsTitle,
        body: profileCoachmarkCopy.friendsBody,
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
    let cancelled = false;

    const refreshUnread = async () => {
      if (!userId) {
        if (!cancelled) setUnreadCount(0);
        return;
      }
      try {
        const notifications = await api.getNotifications(userId);
        if (cancelled) return;
        const count = Array.isArray(notifications)
          ? notifications.filter((item: any) => Boolean(item?.unread)).length
          : 0;
        setUnreadCount(count);
      } catch (error) {
        if (!cancelled) setUnreadCount(0);
      }
    };

    void refreshUnread();
    const timer = window.setInterval(() => {
      void refreshUnread();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [userId, view]);

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

  const handleNavigate = (screen: 'gym' | 'rank' | 'settings' | 'workout' | 'weeklyPlan' | 'customPlanBuilder' | 'posts' | 'friends' | 'coachList') => {
    if (screen === 'workout') {
      onNavigateTab?.('workout');
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

  const handleLogout = () => {
    clearStoredUserSession();
    window.location.href = '/';
  };
  if (view === 'gym') return <GymAccessScreen onBack={() => setView('main')} />;
  if (view === 'rank')
  return <RankingsRewardsScreen onBack={() => setView('main')} />;
  if (view === 'settings')
  return (
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
  return (
    <NotificationsScreen
      onBack={() => setView('main')}
      onOpenAcceptedChallenge={(challenge) => {
        setAcceptedChallengeContext(challenge);
        setView('notificationChallenge');
      }}
    />
  );
  if (view === 'weeklyPlan')
  return (
    <CurrentWeekPlanScreen
      onBack={() => setView('main')}
      onOpenWorkout={() => onNavigateTab?.('workout')}
      onCreateCustom={() => setView('presetPlans')}
    />
  );
  if (view === 'presetPlans')
  return (
    <PresetProgramScreen
      onBack={() => setView('weeklyPlan')}
      onSaved={() => onNavigateTab?.('workout')}
      onBuildCustom={() => setView('customPlanBuilder')}
    />
  );
  if (view === 'customPlanBuilder')
  return (
    <CustomPlanBuilderScreen
      onBack={() => setView('presetPlans')}
      onSaved={() => onNavigateTab?.('workout')}
    />
  );
  if (view === 'posts')
  return <MyPostsScreen onBack={() => setView('main')} />;
  if (view === 'friends')
  return (
    <FriendsList
      onBack={() => setView('main')}
      onFriendClick={(friend) => {
        setSelectedFriend(friend);
        setView('friendProfile');
      }}
    />
  );
  if (view === 'friendProfile')
  return (
    <FriendProfile
      onBack={() => setView('friends')}
      onChallenge={() => setView('friendChallenge')}
      friend={selectedFriend}
    />
  );
  if (view === 'friendChallenge') {
    return (
      <FriendChallengeScreen
        onBack={() => setView('friendProfile')}
        onExitHome={() => setView('main')}
        friendName={selectedFriend?.name}
        friendId={selectedFriend?.id}
      />
    );
  }
  if (view === 'notificationChallenge') {
    return (
      <FriendChallengeScreen
        onBack={() => setView('notifications')}
        onExitHome={() => setView('main')}
        friendName={acceptedChallengeContext?.friendName}
        friendId={acceptedChallengeContext?.friendId}
        initialView="intro"
        directChallengeId={toChallengeCardId(acceptedChallengeContext?.challengeKey)}
        currentUserPlayer="player2"
        challengeSessionId={acceptedChallengeContext?.challengeSessionId}
      />
    );
  }
  if (view === 'coachList')
  return (
    <CoachList
      onBack={() => setView('main')}
      onSelectCoach={(id, name) => {
        setSelectedCoach({ id, name });
        setView('chat');
      }}
    />
  );
  if (view === 'chat')
  return (
    <Messaging
      onBack={() => setView('coachList')}
      coachId={selectedCoach?.id}
      coachName={selectedCoach?.name}
    />
  );
  return (
    <div className="relative">
      {/* Header action icons */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <button
          data-coachmark-target="profile_settings_button"
          onClick={() => setView('settings')}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label={copy.openSettings}
        >
          <Settings size={20} />
        </button>

        <button
          data-coachmark-target="profile_notifications_button"
          onClick={() => setView('notifications')}
          className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label={copy.openNotifications}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-accent text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-glow">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </button>
      </div>

      <div className="space-y-6 pb-24 px-4 sm:px-6">
        <ProfileScreen onNavigate={handleNavigate} onLogout={handleLogout} />
      </div>

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
