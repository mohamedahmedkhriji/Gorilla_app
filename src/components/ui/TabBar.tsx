import React from 'react';
import { Home, Activity, Dumbbell, User, BookOpenText } from 'lucide-react';
import { motion } from 'framer-motion';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs = [
    {
      id: 'home',
      icon: Home,
      label: 'Home',
    },
    {
      id: 'workout',
      icon: Dumbbell,
      label: 'Workout',
    },
    {
      id: 'blogs',
      icon: BookOpenText,
      label: 'Blogs',
    },
    {
      id: 'progress',
      icon: Activity,
      label: 'Progress',
    },
    {
      id: 'profile',
      icon: User,
      label: 'Profile',
    },
  ];

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4 pointer-events-none">
      <div className="mx-auto w-full max-w-md pointer-events-auto">
        <div className="rounded-2xl border border-white/10 bg-background-secondary/95 px-2 py-2">
          <div className="grid grid-cols-5 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  whileTap={{ scale: 0.95 }}
                  className="relative flex flex-col items-center justify-center gap-1 rounded-xl py-2"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                      className="absolute inset-0 rounded-xl border border-accent/25 bg-accent/12"
                    />
                  )}

                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className={`relative transition-colors duration-300 ${isActive ? 'text-accent' : 'text-text-tertiary'}`}
                  />
                  <span
                    className={`relative text-[10px] uppercase tracking-[0.1em] transition-colors duration-300 ${
                      isActive ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                  >
                    {tab.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
