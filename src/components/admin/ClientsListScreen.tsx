import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CustomerProfileModal } from './CustomerProfileModal';

export type ClientRank = 'bronze' | 'silver' | 'gold' | 'elite';

export interface CoachPanelClient {
  id: string;
  name: string;
  age: number | null;
  avatar: string;
  rank: ClientRank;
  profilePicture?: string | null;
}

interface ClientsListScreenProps {
  onBack: () => void;
  clients: CoachPanelClient[];
  isLightTheme?: boolean;
  initialSelectedClientId?: string | null;
  onConsumedInitialSelection?: () => void;
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

export const ClientsListScreen: React.FC<ClientsListScreenProps> = ({
  onBack,
  clients,
  isLightTheme,
  initialSelectedClientId,
  onConsumedInitialSelection,
}) => {
  const [searchName, setSearchName] = useState('');
  const [filterRank, setFilterRank] = useState<'all' | ClientRank>('all');
  const [selectedClient, setSelectedClient] = useState<CoachPanelClient | null>(null);
  const resolvedIsLightTheme = isLightTheme ?? (localStorage.getItem('coach-dashboard-theme') === 'light');

  const filteredClients = useMemo(
    () =>
      clients.filter((client) => {
        const matchesName = client.name.toLowerCase().includes(searchName.toLowerCase());
        const matchesRank = filterRank === 'all' || client.rank === filterRank;
        return matchesName && matchesRank;
      }),
    [clients, filterRank, searchName],
  );

  useEffect(() => {
    if (!initialSelectedClientId) return;
    const target = clients.find((client) => String(client.id) === String(initialSelectedClientId));
    if (!target) return;
    setSelectedClient(target);
    onConsumedInitialSelection?.();
  }, [clients, initialSelectedClientId, onConsumedInitialSelection]);

  return (
    <div className={`min-h-screen ${resolvedIsLightTheme ? 'bg-[#F5F7FB] text-[#111827]' : 'bg-[#1A1A1A] text-white'}`}>
      <div className={`border-b p-4 ${resolvedIsLightTheme ? 'border-slate-200' : 'border-gray-800'}`}>
        <button onClick={onBack} className={`flex items-center gap-2 mb-4 ${resolvedIsLightTheme ? 'text-slate-600 hover:text-[#111827]' : 'text-gray-400 hover:text-white'}`}>
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">All Clients</h1>
        <p className={`text-sm ${resolvedIsLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>{filteredClients.length} total clients in your gym</p>
      </div>

      <div className="p-4 flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className={`flex-1 px-4 py-2 rounded-lg border focus:border-[#BFFF00] outline-none ${
            resolvedIsLightTheme
              ? 'bg-white text-[#111827] border-slate-300'
              : 'bg-[#242424] text-white border-gray-700'
          }`}
        />
        <select
          value={filterRank}
          onChange={(e) => setFilterRank(e.target.value as any)}
          className={`px-4 py-2 rounded-lg border focus:border-[#BFFF00] outline-none ${
            resolvedIsLightTheme
              ? 'bg-white text-[#111827] border-slate-300'
              : 'bg-[#242424] text-white border-gray-700'
          }`}
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
              <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-white bg-white/20 flex items-center justify-center">
                {client.profilePicture ? (
                  <img
                    src={client.profilePicture}
                    alt={`${client.name} profile`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-4xl text-white">{client.avatar}</span>
                )}
              </div>
              <p className="mt-4 text-white text-base font-semibold tracking-wide uppercase text-center px-2">
                {client.name}
              </p>
              <span className="text-sm text-white/80 mt-2">{style.label}</span>
              <p className="text-white/70 text-sm mt-1">
                {typeof client.age === 'number' ? `${client.age} years` : 'Age N/A'}
              </p>
              <div className={`absolute -bottom-8 w-0 h-0 border-l-[104px] border-l-transparent border-r-[104px] border-r-transparent border-t-[32px] ${style.shieldBg}`} />
            </div>
          );
        })}
      </div>

      {selectedClient && (
        <CustomerProfileModal
          client={selectedClient}
          isLightTheme={resolvedIsLightTheme}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
};
