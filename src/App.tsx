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
import { RepSetLoader } from './components/RepSetLoader';
import { ScrollToTop } from './components/ui/ScrollToTop';
import { ScreenTransition, getNavigationDirection } from './components/ui/ScreenTransition';
import { OPEN_PICKED_WORKOUT_PLAN } from './services/workoutNavigation';
import { useManualScrollRestoration } from './shared/scroll';
import { clearStoredUserSession, getStoredAppUser, getStoredUserId, getStoredUserAuthToken, persistStoredUserSession } from './shared/authStorage';
import { api } from './services/api';
import { isOfflineApiError } from './services/offlineCache';
import { initializePushNotifications, removePushNotificationListeners } from './services/pushNotifications';
import { socketService } from './services/socket';
import type { NotificationEventPayload } from './services/notificationEvents';
import {
  APP_COACHMARK_TOUR_ID,
  APP_COACHMARK_VERSION,
  getCoachmarkUserScope,
  patchCoachmarkProgress,
  readCoachmarkProgress,
  resetAllCoachmarkProgress,
} from './services/coachmarks';

type GuidedTourStage = 'home' | 'my_plan' | 'blogs' | 'progress' | 'profile' | 'done';
type HomeRequestedView = 'exercises';

const GUIDED_TOUR_ORDER: GuidedTourStage[] = ['home', 'my_plan', 'blogs', 'progress', 'profile'];
const TAB_NAV_ORDER = ['home', 'workout', 'blogs', 'progress', 'profile'] as const;

export function App() {
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);
  const [tabResetSignal, setTabResetSignal] = useState(0);
  const [workoutDay, setWorkoutDay] = useState('Push Day');
  const [workoutLaunchMode, setWorkoutLaunchMode] = useState<'default' | 'picked-plan'>('default');
  const [homeRequestedView, setHomeRequestedView] = useState<HomeRequestedView | null>(null);
  const [guidedTourStage, setGuidedTourStage] = useState<GuidedTourStage>('done');
  const previousTabRef = useRef(activeTab);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const pendingNotificationRouteRef = useRef<NotificationEventPayload | null>(null);
  const navigationScrollKey = useMemo(() => {
    if (!isSplashComplete || !isSessionReady) return 'splash';
    if (!isLoggedIn) return showLogin ? 'login' : 'landing';
    if (!hasOnboarded) return 'onboarding';
    return `app:${activeTab}:${tabResetSignal}`;
  }, [activeTab, hasOnboarded, isLoggedIn, isSessionReady, isSplashComplete, showLogin, tabResetSignal]);

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

  const openNotificationRoute = useCallback((payload: NotificationEventPayload) => {
    const route = String(payload?.route || '').trim().toLowerCase();
    if (!route) return;
    if (route.startsWith('/workout') || route.startsWith('/plans')) {
      setWorkoutLaunchMode('default');
      setActiveTab('workout');
    } else if (route.startsWith('/recovery')) {
      setActiveTab('progress');
    } else if (route.startsWith('/posts')) {
      setActiveTab('blogs');
      window.dispatchEvent(new CustomEvent('repset:open-post', { detail: payload }));
    } else {
      sessionStorage.setItem('repSetPendingProfileRoute', JSON.stringify(payload));
      setActiveTab('profile');
      window.dispatchEvent(new CustomEvent('repset:open-profile-route', { detail: payload }));
    }
    setTabResetSignal((current) => current + 1);
  }, []);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const payload = (event as CustomEvent<NotificationEventPayload>).detail || {};
      if (!isSessionReady || !isLoggedIn || !hasOnboarded) {
        pendingNotificationRouteRef.current = payload;
        return;
      }
      openNotificationRoute(payload);
    };
    window.addEventListener('repset:notification:open', handleOpen);
    return () => window.removeEventListener('repset:notification:open', handleOpen);
  }, [hasOnboarded, isLoggedIn, isSessionReady, openNotificationRoute]);

  useEffect(() => {
    if (!isSessionReady || !isLoggedIn || !hasOnboarded || !pendingNotificationRouteRef.current) return;
    const pending = pendingNotificationRouteRef.current;
    pendingNotificationRouteRef.current = null;
    openNotificationRoute(pending);
  }, [hasOnboarded, isLoggedIn, isSessionReady, openNotificationRoute]);

  useEffect(() => {
    if (!isSessionReady || !isLoggedIn || !hasOnboarded) return undefined;
    const userId = getStoredUserId();
    if (userId) socketService.connect(userId, 'user');
    const timer = window.setTimeout(() => {
      void initializePushNotifications();
    }, 1200);
    return () => {
      window.clearTimeout(timer);
      void removePushNotificationListeners();
      socketService.disconnect();
    };
  }, [hasOnboarded, isLoggedIn, isSessionReady]);

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

  const restartGuidedTour = useCallback(() => {
    resetAllCoachmarkProgress(coachmarkScope);
    setWorkoutLaunchMode('default');
    setHomeRequestedView(null);
    setActiveTab('home');
    setTabResetSignal((current) => current + 1);
    setGuidedTourStage('home');
  }, [coachmarkScope]);

  const handleNavigate = (tab: string, day?: string) => {
    setActiveTab(tab);
    if (tab === 'home' && day === 'exercises') {
      setHomeRequestedView('exercises');
      return;
    }

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

  const handleLoginSuccess = useCallback(() => {
    const user = getStoredAppUser();
    const userId = getStoredUserId();
    if (user?.role === 'user' && userId) {
      setIsLoggedIn(true);
      setHasOnboarded(Boolean(user.onboarding_completed));
      setShowLogin(false);
    }
  }, []);

  const handleSplashComplete = useCallback(() => {
    setActiveTab('home');
    setIsSplashComplete(true);
  }, []);

  useEffect(() => {
    if (isSplashComplete) return undefined;

    const splashTimer = window.setTimeout(handleSplashComplete, 3500);
    return () => window.clearTimeout(splashTimer);
  }, [handleSplashComplete, isSplashComplete]);

  if (!isSplashComplete) {
    return <RepSetLoader />;
  }

  if (!isSessionReady) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isLoggedIn) {
    if (!showLogin) {
      return <PublicLandingPage onGetStarted={() => setShowLogin(true)} />;
    }

    return (
      <LoginPage onLoginSuccess={handleLoginSuccess} />
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
            requestedView={homeRequestedView}
            onRequestedViewConsumed={() => setHomeRequestedView(null)}
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
            onNavigateTab={handleNavigate}
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
            onRestartGuidedTour={restartGuidedTour}
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
            requestedView={homeRequestedView}
            onRequestedViewConsumed={() => setHomeRequestedView(null)}
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
      className={`min-h-[100dvh] pt-[env(safe-area-inset-top,0px)] text-text-primary font-sans selection:bg-accent/80 selection:text-black ${
        activeTab === 'blogs' ? 'bg-background' : ''
      }`}
    >
      <ScrollToTop
        navigationKey={navigationScrollKey}
        containerRef={scrollRootRef}
      />

      <div
        ref={scrollRootRef}
        data-scroll-root
        className={`mx-auto min-h-[100dvh] w-full max-w-7xl pb-6 pt-4 ${
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

