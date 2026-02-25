import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CustomerProfileModal } from './CustomerProfileModal';

interface Client {
  id: string;
  name: string;
  age: number;
  avatar: string;
  rank: 'bronze' | 'silver' | 'gold' | 'elite';
}

interface ClientsListScreenProps {
  onBack: () => void;
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

export const ClientsListScreen: React.FC<ClientsListScreenProps> = ({ onBack }) => {
  const [searchName, setSearchName] = useState('');
  const [filterRank, setFilterRank] = useState<'all' | 'bronze' | 'silver' | 'gold' | 'elite'>('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const clients: Client[] = [
    { id: '1', name: 'Alex Johnson', age: 28, avatar: 'AJ', rank: 'elite' },
    { id: '2', name: 'Sarah Smith', age: 32, avatar: 'SS', rank: 'gold' },
    { id: '3', name: 'Mike Brown', age: 25, avatar: 'MB', rank: 'bronze' },
    { id: '4', name: 'Emma Davis', age: 29, avatar: 'ED', rank: 'silver' },
    { id: '5', name: 'John Wilson', age: 35, avatar: 'JW', rank: 'gold' },
    { id: '6', name: 'Lisa Anderson', age: 27, avatar: 'LA', rank: 'bronze' },
    { id: '7', name: 'David Lee', age: 31, avatar: 'DL', rank: 'elite' },
    { id: '8', name: 'Maria Garcia', age: 26, avatar: 'MG', rank: 'silver' },
    { id: '9', name: 'James Taylor', age: 33, avatar: 'JT', rank: 'gold' },
    { id: '10', name: 'Anna White', age: 24, avatar: 'AW', rank: 'bronze' }
  ];

  const filteredClients = clients.filter(client => {
    const matchesName = client.name.toLowerCase().includes(searchName.toLowerCase());
    const matchesRank = filterRank === 'all' || client.rank === filterRank;
    return matchesName && matchesRank;
  });

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="border-b border-gray-800 p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-4">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">All Clients</h1>
        <p className="text-gray-400 text-sm">{filteredClients.length} total clients in your gym</p>
      </div>

      <div className="p-4 flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="flex-1 bg-[#242424] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
        />
        <select
          value={filterRank}
          onChange={(e) => setFilterRank(e.target.value as any)}
          className="bg-[#242424] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
        >
          <option value="all">All Levels</option>
          <option value="bronze">Beginner</option>
          <option value="silver">Intermediate</option>
          <option value="gold">Advanced</option>
          <option value="elite">Elite</option>
        </select>
      </div>

      <div className="p-4 grid grid-cols-4 gap-x-8 gap-y-16 justify-items-center">
        {filteredClients.map(client => {
          const style = rankStyles[client.rank];
          return (
            <div 
              key={client.id} 
              onClick={() => setSelectedClient(client)}
              className={`relative w-52 h-72 rounded-t-2xl flex flex-col items-center pt-8 border-2 ${style.bg} ${style.border} ${style.glow} transition-transform duration-300 hover:scale-105 cursor-pointer`}
            >
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
          );
        })}
      </div>

      {selectedClient && (
        <CustomerProfileModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
};
