import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Workout } from './pages/Workout';
import { Progress } from './pages/Progress';
import { Profile } from './pages/Profile';
import { Blogs } from './pages/Blogs';
import { LoginPage } from './pages/LoginPage';
import { PublicLandingPage } from './pages/PublicLandingPage';
import { TabBar } from './components/ui/TabBar';
import { SplashScreen } from './components/ui/SplashScreen';
import { ScreenTransition, getNavigationDirection } from './components/ui/ScreenTransition';
import { OPEN_PICKED_WORKOUT_PLAN } from './services/workoutNavigation';
import { useManualScrollRestoration, useScrollToTopOnChange } from './shared/scroll';
import { clearStoredUserSession, getStoredAppUser, getStoredUserId, getStoredUserAuthToken, persistStoredUserSession } from './shared/authStorage';
import { api } from './services/api';
import { isOfflineApiError } from './services/offlineCache';
import {
  APP_COACHMARK_TOUR_ID,
  APP_COACHMARK_VERSION,
  getCoachmarkUserScope,
  patchCoachmarkProgress,
  readCoachmarkProgress,
} from './services/coachmarks';

type GuidedTourStage = 'home' | 'my_plan' | 'blogs' | 'progress' | 'profile' | 'done';

const GUIDED_TOUR_ORDER: GuidedTourStage[] = ['home', 'my_plan', 'blogs', 'progress', 'profile'];
const TAB_NAV_ORDER = ['home', 'workout', 'blogs', 'progress', 'profile'] as const;

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);
  const [tabResetSignal, setTabResetSignal] = useState(0);
  const [workoutDay, setWorkoutDay] = useState('Push Day');
  const [workoutLaunchMode, setWorkoutLaunchMode] = useState<'default' | 'picked-plan'>('default');
  const [guidedTourStage, setGuidedTourStage] = useState<GuidedTourStage>('done');
  const previousTabRef = useRef(activeTab);

  const coachmarkScope = useMemo(() => getCoachmarkUserScope(getStoredAppUser()), [isLoggedIn, hasOnboarded]);
  const guidedTourOptions = useMemo(
    () => ({
      tourId: APP_COACHMARK_TOUR_ID,
      version: APP_COACHMARK_VERSION,
      userScope: coachmarkScope,
      defaultSeenSteps: {
        home: false,
        my_plan: false,
        blogs: false,
        progress: false,
        profile: false,
      },
    }),
    [coachmarkScope],
  );

  useManualScrollRestoration();

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const user = getStoredAppUser();
      const userId = getStoredUserId();
      const token = getStoredUserAuthToken();

      try {
        if (!user || !userId || !token || user.role !== 'user') {
          clearStoredUserSession();
          if (!cancelled) {
            setIsLoggedIn(false);
            setHasOnboarded(false);
            setShowLogin(false);
          }
          return;
        }

        const session = await api.getCurrentSession('user');
        const sessionUser = session?.user;
        if (!sessionUser || sessionUser.role !== 'user') {
          throw new Error('Invalid session');
        }

        persistStoredUserSession({ user: sessionUser, token });

        if (!cancelled) {
          setIsLoggedIn(true);
          setHasOnboarded(Boolean(sessionUser.onboarding_completed));
        }
      } catch (error) {
        if (isOfflineApiError(error) && user && userId && token && user.role === 'user') {
          if (!cancelled) {
            setIsLoggedIn(true);
            setHasOnboarded(Boolean(user.onboarding_completed));
            setShowLogin(false);
          }
        } else {
          clearStoredUserSession();
          if (!cancelled) {
            setIsLoggedIn(false);
            setHasOnboarded(false);
            setShowLogin(false);
          }
        }
      } finally {
        if (!cancelled) {
          setIsSessionReady(true);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useScrollToTopOnChange([
    isLoading,
    isLoggedIn,
    hasOnboarded,
    showLogin,
    activeTab,
    tabResetSignal,
  ]);

  useEffect(() => {
    if (!isSessionReady || !isLoggedIn || !hasOnboarded) {
      setGuidedTourStage('done');
      return;
    }

    const progress = readCoachmarkProgress(guidedTourOptions);
    if (progress.completed || progress.dismissed) {
      setGuidedTourStage('done');
      return;
    }

    const nextStage = GUIDED_TOUR_ORDER.find((stage) => !progress.seenSteps[stage])
      || GUIDED_TOUR_ORDER[Math.max(0, Math.min(GUIDED_TOUR_ORDER.length - 1, progress.currentStep))]
      || 'home';
    setGuidedTourStage(nextStage);
  }, [guidedTourOptions, hasOnboarded, isLoggedIn, isSessionReady]);

  useEffect(() => {
    if (guidedTourStage === 'done') return;

    if (guidedTourStage === 'home') {
      setWorkoutLaunchMode('default');
      setActiveTab('home');
      return;
    }

    if (guidedTourStage === 'my_plan') {
      setWorkoutLaunchMode('default');
      setActiveTab('workout');
      return;
    }

    setActiveTab(guidedTourStage);
  }, [guidedTourStage]);

  useEffect(() => {
    previousTabRef.current = activeTab;
  }, [activeTab]);

  const completeGuidedTourStage = useCallback((stage: Exclude<GuidedTourStage, 'done'>) => {
    const currentIndex = GUIDED_TOUR_ORDER.indexOf(stage);
    const nextStage = GUIDED_TOUR_ORDER[currentIndex + 1] || 'done';

    patchCoachmarkProgress(guidedTourOptions, (current) => ({
      completed: nextStage === 'done',
      dismissed: false,
      currentStep: Math.min(currentIndex + 1, GUIDED_TOUR_ORDER.length - 1),
      seenSteps: {
        ...current.seenSteps,
        [stage]: true,
      },
    }));

    setGuidedTourStage(nextStage);
  }, [guidedTourOptions]);

  const dismissGuidedTour = useCallback((stage: Exclude<GuidedTourStage, 'done'>) => {
    patchCoachmarkProgress(guidedTourOptions, (current) => ({
      completed: true,
      dismissed: true,
      currentStep: Math.max(0, GUIDED_TOUR_ORDER.indexOf(stage)),
      seenSteps: {
        ...current.seenSteps,
        [stage]: true,
      },
    }));
    setGuidedTourStage('done');
  }, [guidedTourOptions]);

  const handleNavigate = (tab: string, day?: string) => {
    setActiveTab(tab);
    if (tab === 'workout' && day === OPEN_PICKED_WORKOUT_PLAN) {
      setWorkoutLaunchMode('picked-plan');
      return;
    }

    if (tab === 'workout') {
      setWorkoutLaunchMode('default');
    }

    if (day) setWorkoutDay(day);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'workout') {
      setWorkoutLaunchMode('default');
    }
    setTabResetSignal((prev) => prev + 1);
  };

  if (isLoading || !isSessionReady) {
    return <SplashScreen onComplete={() => setIsLoading(false)} />;
  }

  if (!isLoggedIn) {
    if (!showLogin) {
      return <PublicLandingPage onGetStarted={() => setShowLogin(true)} />;
    }

    return (
      <LoginPage
        onLoginSuccess={() => {
          const user = getStoredAppUser();
          const userId = getStoredUserId();
          if (user?.role === 'user' && userId) {
            setIsLoggedIn(true);
            setHasOnboarded(Boolean(user.onboarding_completed));
            setShowLogin(false);
          }
        }}
      />
    );
  }

  if (!hasOnboarded) {
    return <Onboarding onComplete={() => setHasOnboarded(true)} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Home
            onNavigate={handleNavigate}
            onTabBarVisibilityChange={setIsTabBarVisible}
            resetSignal={tabResetSignal}
            guidedTourActive={guidedTourStage === 'home'}
            onGuidedTourComplete={() => completeGuidedTourStage('home')}
            onGuidedTourDismiss={() => dismissGuidedTour('home')}
          />
        );
      case 'workout':
        return (
          <Workout
            onBack={() => setActiveTab('home')}
            workoutDay={workoutDay}
            openPickedPlan={workoutLaunchMode === 'picked-plan'}
            resetSignal={tabResetSignal}
            guidedTourActive={guidedTourStage === 'my_plan'}
            onGuidedTourComplete={() => completeGuidedTourStage('my_plan')}
            onGuidedTourDismiss={() => dismissGuidedTour('my_plan')}
          />
        );
      case 'progress':
        return (
          <Progress
            resetSignal={tabResetSignal}
            guidedTourActive={guidedTourStage === 'progress'}
            onGuidedTourComplete={() => completeGuidedTourStage('progress')}
            onGuidedTourDismiss={() => dismissGuidedTour('progress')}
          />
        );
      case 'profile':
        return (
          <Profile
            onNavigateTab={handleNavigate}
            onTabBarVisibilityChange={setIsTabBarVisible}
            resetSignal={tabResetSignal}
            guidedTourActive={guidedTourStage === 'profile'}
            onGuidedTourComplete={() => completeGuidedTourStage('profile')}
            onGuidedTourDismiss={() => dismissGuidedTour('profile')}
            onRestartGuidedTour={() => setGuidedTourStage('home')}
          />
        );
      case 'blogs':
        return (
          <Blogs
            guidedTourActive={guidedTourStage === 'blogs'}
            onGuidedTourComplete={() => completeGuidedTourStage('blogs')}
            onGuidedTourDismiss={() => dismissGuidedTour('blogs')}
          />
        );
      default:
        return (
          <Home
            onNavigate={handleNavigate}
            onTabBarVisibilityChange={setIsTabBarVisible}
            resetSignal={tabResetSignal}
            guidedTourActive={guidedTourStage === 'home'}
            onGuidedTourComplete={() => completeGuidedTourStage('home')}
            onGuidedTourDismiss={() => dismissGuidedTour('home')}
          />
        );
    }
  };

  const tabMotionDirection = getNavigationDirection(
    activeTab,
    previousTabRef.current,
    TAB_NAV_ORDER,
  );

  return (
    <div
      className={`min-h-screen text-text-primary font-sans selection:bg-accent/80 selection:text-black ${
        activeTab === 'blogs' ? 'bg-background' : ''
      }`}
    >
      <div
        className={`min-h-screen pb-6 pt-4 ${
          activeTab === 'blogs'
            ? `bg-background px-4 sm:px-6 ${isTabBarVisible ? 'pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]' : 'pb-6'}`
            : activeTab === 'profile' || activeTab === 'workout'
              ? `px-0 pt-0 ${isTabBarVisible ? 'pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]' : 'pb-0'}`
              : `px-4 sm:px-6 ${isTabBarVisible ? 'pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]' : 'pb-6'}`
        }`}
      >
        <ScreenTransition
          screenKey={activeTab}
          direction={tabMotionDirection}
          className="min-h-screen"
        >
          {renderTab()}
        </ScreenTransition>
      </div>

      {isTabBarVisible && <TabBar activeTab={activeTab} onTabChange={handleTabChange} />}
    </div>
  );
}

