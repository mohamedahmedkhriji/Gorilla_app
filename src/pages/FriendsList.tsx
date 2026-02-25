import React, { useEffect, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Search, Trophy, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
interface FriendsListProps {
  onBack: () => void;
  onFriendClick: (friendId: string) => void;
}
export function FriendsList({ onBack, onFriendClick }: FriendsListProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'gym' | 'rank'>('all');
  const [userGymId, setUserGymId] = useState<number | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    setUserGymId(user.gym_id);
    if (user.id) {
      api.getGymMembers(user.id).then(data => {
        if (data.members) setMembers(data.members);
      });
    }
  }, []);

  let filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  // Apply filter
  if (filter === 'gym' && userGymId) {
    filteredMembers = filteredMembers.filter(m => m.gym_id === userGymId);
  } else if (filter === 'rank') {
    const rankOrder: any = { 'Platinum': 4, 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
    filteredMembers = filteredMembers.sort((a, b) => (rankOrder[b.rank] || 0) - (rankOrder[a.rank] || 0));
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title="Friends" onBack={onBack} />
      </div>

      <div className="px-6 mb-4">
        <div className="flex gap-2 mb-4">
          <button 
            onClick={() => setFilter('all')} 
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}>
            All
          </button>
          <button 
            onClick={() => setFilter('gym')} 
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'gym' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}>
            My Gym
          </button>
          <button 
            onClick={() => setFilter('rank')} 
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'rank' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}>
            Top Rank
          </button>
        </div>
      </div>

      <div className="px-6 mb-6 relative">
        <Input placeholder="Search friends..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Search
          className="absolute left-10 top-1/2 -translate-y-1/2 text-text-tertiary"
          size={18} />

      </div>

      <div className="px-6 space-y-4">
        {filteredMembers.map((member) =>
        <Card
          key={member.id}
          onClick={() => onFriendClick(member.id)}
          className="p-4 flex items-center gap-4 cursor-pointer border border-accent/30 hover:border-accent transition-colors">

            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-white">
              {member.name.split(' ').map((n: string) => n[0]).join('')}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white">{member.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                  <Trophy size={10} /> {member.rank}
                </span>
                <span className="text-xs text-text-tertiary">
                  • {member.total_workouts} workouts
                </span>
              </div>
            </div>
            <ChevronRight size={20} className="text-text-tertiary" />
          </Card>
        )}
      </div>
    </div>);

}
