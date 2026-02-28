import React, { useState, useEffect } from 'react';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Workout } from './pages/Workout';
import { Progress } from './pages/Progress';
import { Profile } from './pages/Profile';
import { Blogs } from './pages/Blogs';
import { LoginPage } from './pages/LoginPage';
import { TabBar } from './components/ui/TabBar';
import { SplashScreen } from './components/ui/SplashScreen';
import { AnimatePresence, motion } from 'framer-motion';

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
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

  const handleNavigate = (tab: string, day?: string) => {
    setActiveTab(tab);
    if (day) setWorkoutDay(day);
  };

  if (isLoading) {
    return <SplashScreen onComplete={() => setIsLoading(false)} />;
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLoginSuccess={() => {
          const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
          if (user?.role === 'user') {
            setIsLoggedIn(true);
            setHasOnboarded(user.onboarding_completed || false);
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
        return <Home onNavigate={(tab) => handleNavigate(tab, workoutDay)} />;
      case 'workout':
        return <Workout onBack={() => setActiveTab('home')} workoutDay={workoutDay} />;
      case 'progress':
        return <Progress />;
      case 'profile':
        return <Profile onNavigateTab={handleNavigate} />;
      case 'blogs':
        return <Blogs />;
      default:
        return <Home onNavigate={(tab) => handleNavigate(tab, workoutDay)} />;
    }
  };

  return (
    <div
      className={`min-h-screen text-text-primary font-sans selection:bg-accent/80 selection:text-black ${
        activeTab === 'blogs' ? 'bg-[#ECEEF3]' : ''
      }`}
    >
      <div
        className={`min-h-screen pb-6 pt-4 ${
          activeTab === 'blogs'
            ? 'bg-[#ECEEF3] px-2 sm:px-4 lg:px-6'
            : activeTab === 'profile'
              ? 'px-0 pt-0 pb-0'
              : 'px-5 sm:px-6'
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

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
