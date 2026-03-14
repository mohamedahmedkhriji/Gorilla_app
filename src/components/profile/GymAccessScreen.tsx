import React from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { MapPin, Ticket, Calendar } from 'lucide-react';
interface GymAccessScreenProps {
  onBack: () => void;
}
export function GymAccessScreen({ onBack }: GymAccessScreenProps) {
  // Example subscription data (replace with actual data from backend)
  const subscription = {
    type: '1 Year' as '1 Month' | '3 Months' | '6 Months' | '1 Year',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
  };

  const getDaysRemaining = () => {
    const today = new Date();
    const diff = subscription.endDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="flex-1 flex flex-col pb-24">
      <Header title="Gym Access" onBack={onBack} />

      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-accent/20 to-blue-600/20 border-accent/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-white text-lg">
                {subscription.type} Subscription
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Active • {daysRemaining} days remaining
              </p>
            </div>
            <div className="px-2 py-1 bg-white/10 rounded text-xs font-mono text-white">
              ID: 883-291
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/80 mb-3">
            <Calendar size={16} />
            <span>Renews {subscription.endDate.toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Ticket size={16} />
            <span>3 Guest Passes Remaining</span>
          </div>
        </Card>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Nearby Partners
          </h3>

          {/* Mock Map Placeholder */}
          <div className="w-full h-48 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="flex flex-col items-center gap-2 text-text-tertiary">
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
              className="flex items-center justify-between p-4 bg-card rounded-xl border border-white/5">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{gym.name}</h4>
                    <p className="text-xs text-text-secondary">
                      {gym.dist} • {gym.status}
                    </p>
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-white transition-colors">
                  Check In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>);

}
