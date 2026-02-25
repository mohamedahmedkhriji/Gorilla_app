import React from 'react';
import { Header } from '../ui/Header';
import { Bell, Shield, User, LogOut, ChevronRight } from 'lucide-react';
interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
}
export function SettingsScreen({ onBack, onLogout }: SettingsScreenProps) {
  const sections = [
  {
    title: 'Account',
    items: [
    {
      icon: User,
      label: 'Personal Details'
    },
    {
      icon: Shield,
      label: 'Privacy & Security'
    }]

  },
  {
    title: 'Preferences',
    items: [
    {
      icon: Bell,
      label: 'Notifications'
    }]

  }];

  return (
    <div className="flex-1 flex flex-col pb-24">
      <Header title="Settings" onBack={onBack} />

      <div className="space-y-8">
        {sections.map((section, i) =>
        <div key={i} className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider px-2">
              {section.title}
            </h3>
            <div className="bg-card rounded-2xl overflow-hidden border border-white/5">
              {section.items.map((item, j) =>
            <button
              key={j}
              className={`
                    w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors
                    ${j !== section.items.length - 1 ? 'border-b border-white/5' : ''}
                  `}>

                  <div className="flex items-center gap-3">
                    <item.icon size={20} className="text-text-secondary" />
                    <span className="text-white font-medium">{item.label}</span>
                  </div>
                  <ChevronRight size={18} className="text-text-tertiary" />
                </button>
            )}
            </div>
          </div>
        )}

        <button 
          onClick={onLogout}
          className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-medium flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors">
          <LogOut size={20} />
          Log Out
        </button>
      </div>
    </div>);

}