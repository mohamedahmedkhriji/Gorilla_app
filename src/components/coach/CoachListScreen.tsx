import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, Star, MapPin } from 'lucide-react';

interface Coach {
  id: string;
  name: string;
  avatar: string;
  gym: string;
  gymId: string;
  specialties: string[];
  rating: number;
  isOnline: boolean;
  isMyGym: boolean;
}

interface CoachListScreenProps {
  onBack: () => void;
  onSelectCoach: (coach: Coach) => void;
}

export const CoachListScreen: React.FC<CoachListScreenProps> = ({ onBack, onSelectCoach }) => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [userGymId, setUserGymId] = useState<string>('');

  useEffect(() => {
    // TODO: Replace with API call
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    setUserGymId(user.gymId || 'gym1');

    // Mock data
    const mockCoaches: Coach[] = [
      {
        id: '1',
        name: 'Coach Mike',
        avatar: 'CM',
        gym: 'Iron Paradise',
        gymId: 'gym1',
        specialties: ['Strength', 'Hypertrophy'],
        rating: 4.9,
        isOnline: true,
        isMyGym: true
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        avatar: 'SJ',
        gym: 'Iron Paradise',
        gymId: 'gym1',
        specialties: ['Powerlifting', 'Nutrition'],
        rating: 4.8,
        isOnline: false,
        isMyGym: true
      },
      {
        id: '3',
        name: 'Alex Chen',
        avatar: 'AC',
        gym: 'Fitness Hub',
        gymId: 'gym2',
        specialties: ['Bodybuilding', 'Cardio'],
        rating: 4.7,
        isOnline: true,
        isMyGym: false
      },
      {
        id: '4',
        name: 'Maria Garcia',
        avatar: 'MG',
        gym: 'Elite Gym',
        gymId: 'gym3',
        specialties: ['CrossFit', 'Olympic Lifting'],
        rating: 4.9,
        isOnline: true,
        isMyGym: false
      }
    ];

    // Sort: My gym coaches first, then by online status, then by rating
    const sorted = mockCoaches.sort((a, b) => {
      if (a.isMyGym !== b.isMyGym) return a.isMyGym ? -1 : 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return b.rating - a.rating;
    });

    setCoaches(sorted);
  }, []);

  const myGymCoaches = coaches.filter(c => c.isMyGym);
  const otherCoaches = coaches.filter(c => !c.isMyGym);

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <h1 className="text-2xl font-bold mb-2">Coaches</h1>
        <p className="text-gray-400 mb-6">Connect with expert trainers</p>

        {myGymCoaches.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
              My Gym Coaches
            </h2>
            <div className="space-y-3">
              {myGymCoaches.map(coach => (
                <button
                  key={coach.id}
                  onClick={() => onSelectCoach(coach)}
                  className="w-full bg-[#242424] rounded-lg p-4 border-2 border-[#BFFF00]/20 hover:border-[#BFFF00] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-[#BFFF00]/10 flex items-center justify-center">
                        <span className="font-bold text-[#BFFF00]">{coach.avatar}</span>
                      </div>
                      {coach.isOnline && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#242424]" />
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <div className="font-semibold">{coach.name}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <MapPin size={14} />
                        <span>{coach.gym}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {coach.specialties.slice(0, 2).map((spec, idx) => (
                          <span key={idx} className="text-xs bg-[#1A1A1A] px-2 py-1 rounded">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[#BFFF00] mb-2">
                        <Star size={14} fill="#BFFF00" />
                        <span className="text-sm font-semibold">{coach.rating}</span>
                      </div>
                      <MessageSquare size={20} className="text-gray-400" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {otherCoaches.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
              Other Coaches
            </h2>
            <div className="space-y-3">
              {otherCoaches.map(coach => (
                <button
                  key={coach.id}
                  onClick={() => onSelectCoach(coach)}
                  className="w-full bg-[#242424] rounded-lg p-4 hover:bg-[#2A2A2A] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="font-bold text-gray-400">{coach.avatar}</span>
                      </div>
                      {coach.isOnline && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#242424]" />
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <div className="font-semibold">{coach.name}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <MapPin size={14} />
                        <span>{coach.gym}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {coach.specialties.slice(0, 2).map((spec, idx) => (
                          <span key={idx} className="text-xs bg-[#1A1A1A] px-2 py-1 rounded">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-gray-400 mb-2">
                        <Star size={14} />
                        <span className="text-sm font-semibold">{coach.rating}</span>
                      </div>
                      <MessageSquare size={20} className="text-gray-400" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
