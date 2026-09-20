import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { MapPin, Ticket, Calendar } from 'lucide-react';
interface GymAccessScreenProps {
  onBack: () => void;
}

const readStoredStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const isGirlsStyleValue = (value: string) =>
  value === 'woman' || value === 'female' || value === 'f' || value === 'girls' || value === 'femme';

export function GymAccessScreen({ onBack }: GymAccessScreenProps) {
  const [styleGender, setStyleGender] = useState(() => readStoredStyleGender());

  // Example subscription data (replace with actual data from backend)
  const subscription = {
    type: '1 Year' as '1 Month' | '3 Months' | '6 Months' | '1 Year',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
  };

  useEffect(() => {
    const refreshStyleGender = () => setStyleGender(readStoredStyleGender());
    window.addEventListener('repset:app-style-gender-changed', refreshStyleGender);
    window.addEventListener('repset:stored-user-changed', refreshStyleGender);
    window.addEventListener('storage', refreshStyleGender);
    return () => {
      window.removeEventListener('repset:app-style-gender-changed', refreshStyleGender);
      window.removeEventListener('repset:stored-user-changed', refreshStyleGender);
      window.removeEventListener('storage', refreshStyleGender);
    };
  }, []);

  const getDaysRemaining = () => {
    const today = new Date();
    const diff = subscription.endDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining();
  const isActive = daysRemaining >= 0;
  const isGirlsTheme = isGirlsStyleValue(styleGender);
  const pageClassName = isGirlsTheme
    ? 'flex-1 flex flex-col pb-24 px-4 sm:px-6 text-[#4A4A4A]'
    : 'flex-1 flex flex-col pb-24';
  const subscriptionCardClassName = isGirlsTheme
    ? '!border-[#E2B4BD]/45 !bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(249,178,215,0.24)_48%,rgba(207,236,243,0.34))] !shadow-[0_18px_42px_rgba(226,180,189,0.16)] ring-1 ring-white/45'
    : 'bg-gradient-to-r from-accent/20 to-blue-600/20 border-accent/20';
  const surfaceClassName = isGirlsTheme
    ? 'border border-[#E2B4BD]/45 bg-white/72 shadow-[0_12px_28px_rgba(226,180,189,0.12)]'
    : 'bg-card border border-white/5';
  const primaryTextClassName = isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white';
  const secondaryTextClassName = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';
  const tertiaryTextClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary';

  return (
    <div className={pageClassName}>
      <Header title="Gym Access" onBack={onBack} titleClassName={isGirlsTheme ? '!text-[#4A4A4A]' : undefined} />

      <div className="space-y-6">
        <Card className={subscriptionCardClassName}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className={`font-bold text-lg ${primaryTextClassName}`}>
                {subscription.type} Subscription
              </h3>
              <p className={`text-xs mt-1 ${secondaryTextClassName}`}>
                {isActive ? 'Active' : 'Expired'} • {Math.max(daysRemaining, 0)} days remaining
              </p>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-mono ${isGirlsTheme ? 'border border-[#E2B4BD]/45 bg-white/65 text-[#A87884]' : 'bg-white/10 text-white'}`}>
              ID: 883-291
            </div>
          </div>
          <div className={`flex items-center gap-2 text-sm mb-3 ${isGirlsTheme ? 'text-[#795E67]' : 'text-white/80'}`}>
            <Calendar size={16} />
            <span>{isActive ? 'Renews' : 'Ended'} {subscription.endDate.toLocaleDateString()}</span>
          </div>
          <div className={`flex items-center gap-2 text-sm ${isGirlsTheme ? 'text-[#795E67]' : 'text-white/80'}`}>
            <Ticket size={16} />
            <span>3 Guest Passes Remaining</span>
          </div>
        </Card>

        <div className="space-y-4">
          <h3 className={`text-sm font-medium uppercase tracking-wider ${secondaryTextClassName}`}>
            Nearby Partners
          </h3>

          {/* Mock Map Placeholder */}
          <div className={`w-full h-48 rounded-2xl flex items-center justify-center relative overflow-hidden ${
            isGirlsTheme
              ? 'border border-[#CFECF3]/70 bg-[linear-gradient(135deg,rgba(207,236,243,0.34),rgba(255,255,255,0.72)_52%,rgba(249,178,215,0.18))] shadow-[0_12px_30px_rgba(207,236,243,0.18)]'
              : 'bg-white/5 border border-white/10'
          }`}>
            <div className={`absolute inset-0 ${isGirlsTheme ? 'opacity-35 bg-[radial-gradient(#E2B4BD_1px,transparent_1px)]' : 'opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)]'} [background-size:16px_16px]`} />
            <div className={`flex flex-col items-center gap-2 ${tertiaryTextClassName}`}>
              <MapPin size={24} />
              <span className="text-xs">Map View</span>
            </div>
          </div>

          <div className="space-y-3">
            {[
            {
              name: 'Iron Paradise',
              dist: '0.8mi',
              status: 'Open'
            },
            {
              name: 'Metro Fitness',
              dist: '1.2mi',
              status: 'Busy'
            },
            {
              name: "Gold's Gym",
              dist: '2.5mi',
              status: 'Open'
            }].
            map((gym, i) =>
            <div
              key={i}
              className={`flex items-center justify-between p-4 rounded-xl ${surfaceClassName}`}>

                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isGirlsTheme ? 'border border-[#F9B2D7]/45 bg-[#F9B2D7]/16 text-[#A87884]' : 'bg-white/5 text-text-secondary'}`}>
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className={`font-medium ${primaryTextClassName}`}>{gym.name}</h4>
                    <p className={`text-xs ${secondaryTextClassName}`}>
                      {gym.dist} • {gym.status}
                    </p>
                  </div>
                </div>
                <button className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isGirlsTheme
                    ? 'border border-[#E2B4BD]/45 bg-white/65 text-[#A87884] hover:border-[#F9B2D7]/70 hover:bg-[#F9B2D7]/16'
                    : 'bg-white/5 hover:bg-white/10 text-white'
                }`}>
                  Check In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>);

}
