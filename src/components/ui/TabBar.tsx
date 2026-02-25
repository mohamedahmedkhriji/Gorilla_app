import React from 'react';
import { Home, Activity, Dumbbell, User } from 'lucide-react';
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
    label: 'Home'
  },
  {
    id: 'workout',
    icon: Dumbbell,
    label: 'Workout'
  },
  {
    id: 'progress',
    icon: Activity,
    label: 'Progress'
  },
  {
    id: 'profile',
    icon: User,
    label: 'Profile'
  }];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-white/5 pb-8 pt-4 px-6 z-50">
      <div className="max-w-md mx-auto flex justify-between items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              whileTap={{
                scale: 0.9
              }}
              className="flex flex-col items-center justify-center w-12 relative">

              {isActive &&
              <motion.div
                layoutId="activeTab"
                className="absolute -top-4 w-8 h-1 bg-accent rounded-full shadow-glow" />

              }
              <Icon
                size={24}
                strokeWidth={isActive ? 2.5 : 1.5}
                className={`transition-colors duration-300 ${isActive ? 'text-accent' : 'text-text-tertiary'}`} />

              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-300 ${isActive ? 'text-accent' : 'text-text-tertiary'}`}>

                {tab.label}
              </span>
            </motion.button>);

        })}
      </div>
    </div>);

}