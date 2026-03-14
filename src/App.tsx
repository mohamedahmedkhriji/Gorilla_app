import React, { useState, useEffect } from 'react';
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
import { AnimatePresence, motion } from 'framer-motion';
import { api } from './services/api';
import { useScrollToTopOnChange } from './shared/scroll';
import { clearStoredUserSession, getStoredAppUser, getStoredUserId } from './shared/authStorage';

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [tabResetSignal, setTabResetSignal] = useState(0);
  const [workoutDay, setWorkoutDay] = useState('Push Day');

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const user = getStoredAppUser();
      const userId = getStoredUserId();

      try {
        if (!user || !userId || user.role !== 'user') {
          clearStoredUserSession();
          if (!cancelled) {
            setIsLoggedIn(false);
            setHasOnboarded(false);
            setShowLogin(false);
          }
          return;
        }

        try {
          const session = await api.getUserSessionStatus(userId);
          if (!session?.exists || session?.active === false) {
            clearStoredUserSession();
            if (!cancelled) {
              setIsLoggedIn(false);
              setHasOnboarded(false);
              setShowLogin(false);
              setActiveTab('home');
            }
            return;
          }
        } catch {
          // Keep the local session if the validation check is temporarily unavailable.
        }

        if (!cancelled) {
          setIsLoggedIn(true);
          setHasOnboarded(Boolean(user.onboarding_completed));
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

  const handleNavigate = (tab: string, day?: string) => {
    setActiveTab(tab);
    if (day) setWorkoutDay(day);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
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
        return <Home onNavigate={handleNavigate} resetSignal={tabResetSignal} />;
      case 'workout':
        return <Workout onBack={() => setActiveTab('home')} workoutDay={workoutDay} resetSignal={tabResetSignal} />;
      case 'progress':
        return <Progress resetSignal={tabResetSignal} />;
      case 'profile':
        return <Profile onNavigateTab={handleNavigate} resetSignal={tabResetSignal} />;
      case 'blogs':
        return <Blogs />;
      default:
        return <Home onNavigate={handleNavigate} resetSignal={tabResetSignal} />;
    }
  };

  return (
    <div
      className={`min-h-screen text-text-primary font-sans selection:bg-accent/80 selection:text-black ${
        activeTab === 'blogs' ? 'bg-background' : ''
      }`}
    >
      <div
        className={`min-h-screen pb-6 pt-4 ${
          activeTab === 'blogs'
            ? 'bg-background px-4 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]'
            : activeTab === 'profile' || activeTab === 'workout'
              ? 'px-0 pt-0 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]'
              : 'px-4 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]'
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -10,
            }}
            transition={{
              duration: 0.2,
            }}
            className="min-h-screen"
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>

      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}

