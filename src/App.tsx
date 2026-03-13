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
import { useScrollToTopOnChange } from './shared/scroll';

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [tabResetSignal, setTabResetSignal] = useState(0);
  const [workoutDay, setWorkoutDay] = useState('Push Day');

  useEffect(() => {
    const userId = localStorage.getItem('appUserId') || localStorage.getItem('userId');
    const user = localStorage.getItem('appUser') || localStorage.getItem('user');
    if (userId && user) {
      const userData = JSON.parse(user);
      if (userData?.role === 'user') {
        setIsLoggedIn(true);
        setHasOnboarded(userData.onboarding_completed || false);
      }
    }
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

  if (isLoading) {
    return <SplashScreen onComplete={() => setIsLoading(false)} />;
  }

  if (!isLoggedIn) {
    if (!showLogin) {
      return <PublicLandingPage onGetStarted={() => setShowLogin(true)} />;
    }

    return (
      <LoginPage
        onLoginSuccess={() => {
          const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
          if (user?.role === 'user') {
            setIsLoggedIn(true);
            setHasOnboarded(user.onboarding_completed || false);
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

