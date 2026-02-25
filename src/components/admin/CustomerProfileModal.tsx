import React, { useState } from 'react';
import { X, Dumbbell, Calendar, TrendingUp, Target, Camera } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  age: number;
  avatar: string;
  rank: 'bronze' | 'silver' | 'gold' | 'elite';
}

interface CustomerProfileModalProps {
  client: Client;
  onClose: () => void;
}

const rankStyles = {
  bronze: {
    bg: 'bg-gradient-to-b from-amber-800 to-amber-600',
    border: 'border-amber-400',
    glow: 'shadow-[0_0_20px_rgba(217,119,6,0.6)]',
    label: 'Beginner',
    shieldBg: 'border-t-amber-700'
  },
  silver: {
    bg: 'bg-gradient-to-b from-gray-300 to-gray-500',
    border: 'border-gray-200',
    glow: 'shadow-[0_0_25px_rgba(156,163,175,0.7)]',
    label: 'Intermediate',
    shieldBg: 'border-t-gray-400'
  },
  gold: {
    bg: 'bg-gradient-to-b from-yellow-400 to-yellow-600',
    border: 'border-yellow-300',
    glow: 'shadow-[0_0_30px_rgba(253,224,71,0.8)]',
    label: 'Advanced',
    shieldBg: 'border-t-yellow-500'
  },
  elite: {
    bg: 'bg-gradient-to-b from-cyan-400 via-blue-600 to-blue-900',
    border: 'border-cyan-300',
    glow: 'shadow-[0_0_40px_rgba(59,130,246,0.9)]',
    label: 'Elite',
    shieldBg: 'border-t-blue-800'
  }
};

const attributes = [
  {
    name: 'Speed',
    value: 92,
    color: '#22d3ee',
    stats: [
      { label: 'Sprint Speed', value: 91 },
      { label: 'Acceleration', value: 93 }
    ]
  },
  {
    name: 'Strength',
    value: 85,
    color: '#22c55e',
    stats: [
      { label: 'Max Lift', value: 88 },
      { label: 'Power', value: 82 }
    ]
  },
  {
    name: 'Technique',
    value: 78,
    color: '#f59e0b',
    stats: [
      { label: 'Form Quality', value: 80 },
      { label: 'Control', value: 76 }
    ]
  },
  {
    name: 'Mobility',
    value: 88,
    color: '#a855f7',
    stats: [
      { label: 'Flexibility', value: 90 },
      { label: 'Range of Motion', value: 86 }
    ]
  },
  {
    name: 'Discipline',
    value: 95,
    color: '#ef4444',
    stats: [
      { label: 'Attendance', value: 98 },
      { label: 'Consistency', value: 92 }
    ]
  },
  {
    name: 'Endurance',
    value: 82,
    color: '#06b6d4',
    stats: [
      { label: 'Stamina', value: 84 },
      { label: 'Recovery', value: 80 }
    ]
  }
];

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({ client, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'workouts' | 'program' | 'progress' | 'missions'>('overview');
  const style = rankStyles[client.rank];

  const workoutHistory = [
    { date: '2024-01-15', type: 'Upper Body', duration: 65, exercises: 8 },
    { date: '2024-01-13', type: 'Lower Body', duration: 70, exercises: 6 },
    { date: '2024-01-11', type: 'Full Body', duration: 60, exercises: 10 }
  ];

  const currentProgram = {
    name: 'Hypertrophy Program',
    week: 4,
    totalWeeks: 12,
    nextWorkout: 'Push Day',
    schedule: ['Mon: Push', 'Wed: Pull', 'Fri: Legs']
  };

  const measurements = {
    weight: '75 kg',
    bodyFat: '15%',
    chest: '102 cm',
    waist: '82 cm',
    arms: '38 cm',
    legs: '58 cm'
  };

  const missions = {
    completed: 45,
    total: 60,
    rank: 'Gold',
    nextRank: 'Platinum',
    remaining: 15
  };

  const attendance = {
    thisWeek: 4,
    thisMonth: 16,
    streak: 15,
    totalSessions: 128
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1A1A1A] rounded-xl max-w-[90vw] w-full max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#1A1A1A] border-b border-gray-800 p-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-white">Customer Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-1 bg-[#242424] rounded-xl p-6">
            <h3 className="text-xl font-bold text-white">{client.name}</h3>
            <p className="text-sm text-cyan-400 mb-6">{style.label}</p>

            <div className="flex justify-center mb-6">
              <div className={`relative w-52 h-72 rounded-t-2xl flex flex-col items-center pt-8 border-2 ${style.bg} ${style.border} ${style.glow}`}>
                <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-white">
                  <div className="w-full h-full bg-white/20 flex items-center justify-center">
                    <span className="font-bold text-4xl text-white">{client.avatar}</span>
                  </div>
                </div>
                <p className="mt-4 text-white text-base font-semibold tracking-wide uppercase text-center px-2">
                  {client.name}
                </p>
                <span className="text-sm text-white/80 mt-2">{style.label}</span>
                <p className="text-white/70 text-sm mt-1">{client.age} years</p>
                <div className={`absolute -bottom-8 w-0 h-0 border-l-[104px] border-l-transparent border-r-[104px] border-r-transparent border-t-[32px] ${style.shieldBg}`} />
              </div>
            </div>

            <div className="text-sm text-white/70 space-y-2">
              <p>📅 Member Since: Jan 2024</p>
              <p>🔥 Streak: {attendance.streak} days</p>
              <p>💪 Total Sessions: {attendance.totalSessions}</p>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-2 bg-[#242424] rounded-xl p-6">
            <div className="flex gap-2 mb-6 border-b border-gray-700">
              <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 ${activeTab === 'overview' ? 'border-b-2 border-[#BFFF00] text-[#BFFF00]' : 'text-gray-400'}`}>Overview</button>
              <button onClick={() => setActiveTab('workouts')} className={`px-4 py-2 ${activeTab === 'workouts' ? 'border-b-2 border-[#BFFF00] text-[#BFFF00]' : 'text-gray-400'}`}>Workouts</button>
              <button onClick={() => setActiveTab('program')} className={`px-4 py-2 ${activeTab === 'program' ? 'border-b-2 border-[#BFFF00] text-[#BFFF00]' : 'text-gray-400'}`}>Program</button>
              <button onClick={() => setActiveTab('progress')} className={`px-4 py-2 ${activeTab === 'progress' ? 'border-b-2 border-[#BFFF00] text-[#BFFF00]' : 'text-gray-400'}`}>Progress</button>
              <button onClick={() => setActiveTab('missions')} className={`px-4 py-2 ${activeTab === 'missions' ? 'border-b-2 border-[#BFFF00] text-[#BFFF00]' : 'text-gray-400'}`}>Missions</button>
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1A1A1A] p-4 rounded-lg">
                    <Calendar className="text-[#BFFF00] mb-2" size={20} />
                    <p className="text-2xl font-bold text-white">{attendance.thisWeek}</p>
                    <p className="text-xs text-gray-400">Workouts This Week</p>
                  </div>
                  <div className="bg-[#1A1A1A] p-4 rounded-lg">
                    <Target className="text-blue-400 mb-2" size={20} />
                    <p className="text-2xl font-bold text-white">{missions.completed}/{missions.total}</p>
                    <p className="text-xs text-gray-400">Missions Completed</p>
                  </div>
                </div>
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <h4 className="text-white font-semibold mb-3">Body Measurements</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p className="text-gray-400">Weight: <span className="text-white">{measurements.weight}</span></p>
                    <p className="text-gray-400">Body Fat: <span className="text-white">{measurements.bodyFat}</span></p>
                    <p className="text-gray-400">Chest: <span className="text-white">{measurements.chest}</span></p>
                    <p className="text-gray-400">Waist: <span className="text-white">{measurements.waist}</span></p>
                    <p className="text-gray-400">Arms: <span className="text-white">{measurements.arms}</span></p>
                    <p className="text-gray-400">Legs: <span className="text-white">{measurements.legs}</span></p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'workouts' && (
              <div className="space-y-3">
                {workoutHistory.map((workout, idx) => (
                  <div key={idx} className="bg-[#1A1A1A] p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold">{workout.type}</p>
                        <p className="text-xs text-gray-400">{workout.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">{workout.duration} min</p>
                        <p className="text-xs text-gray-400">{workout.exercises} exercises</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'program' && (
              <div className="space-y-4">
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <h4 className="text-white font-semibold mb-2">{currentProgram.name}</h4>
                  <p className="text-sm text-gray-400 mb-3">Week {currentProgram.week} of {currentProgram.totalWeeks}</p>
                  <div className="w-full h-2 bg-gray-700 rounded mb-4">
                    <div className="h-2 bg-[#BFFF00] rounded" style={{width: `${(currentProgram.week / currentProgram.totalWeeks) * 100}%`}} />
                  </div>
                  <p className="text-sm text-white mb-2">Next: <span className="text-[#BFFF00]">{currentProgram.nextWorkout}</span></p>
                </div>
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <h4 className="text-white font-semibold mb-3">Weekly Schedule</h4>
                  {currentProgram.schedule.map((day, idx) => (
                    <p key={idx} className="text-sm text-gray-400 mb-1">{day}</p>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'progress' && (
              <div className="space-y-4">
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="text-[#BFFF00]" size={20} />
                    <h4 className="text-white font-semibold">Progress Photos</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                      <Camera className="text-gray-500" size={24} />
                    </div>
                    <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                      <Camera className="text-gray-500" size={24} />
                    </div>
                    <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                      <Camera className="text-gray-500" size={24} />
                    </div>
                  </div>
                </div>
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <h4 className="text-white font-semibold mb-3">Strength Progress</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Bench Press</span>
                      <span className="text-[#BFFF00]">+15 kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Squat</span>
                      <span className="text-[#BFFF00]">+20 kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Deadlift</span>
                      <span className="text-[#BFFF00]">+25 kg</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'missions' && (
              <div className="space-y-4">
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <h4 className="text-white font-semibold mb-2">Current Rank: {missions.rank}</h4>
                  <p className="text-sm text-gray-400 mb-3">Next Rank: {missions.nextRank} ({missions.remaining} missions remaining)</p>
                  <div className="w-full h-2 bg-gray-700 rounded">
                    <div className="h-2 bg-[#BFFF00] rounded" style={{width: `${(missions.completed / missions.total) * 100}%`}} />
                  </div>
                </div>
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <h4 className="text-white font-semibold mb-3">Recent Missions</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-gray-400">Complete 5 workouts this week</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-gray-400">Hit new PR on bench press</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                      <span className="text-gray-400">Maintain 30-day streak (15/30)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
