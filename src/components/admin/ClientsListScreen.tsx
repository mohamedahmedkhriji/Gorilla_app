import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, ChevronDown, Trash2, Ban } from 'lucide-react';
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
  onRemoveClient?: (clientId: string) => Promise<void> | void;
  onBanClient?: (clientId: string, payload: { days: number; reason: string }) => Promise<void> | void;
}

const rankMeta: Record<ClientRank, { label: string; chip: string }> = {
  bronze: { label: 'Beginner', chip: 'bg-amber-500/15 text-amber-600 border-amber-500/20' },
  silver: { label: 'Intermediate', chip: 'bg-slate-500/15 text-slate-500 border-slate-300/50' },
  gold: { label: 'Advanced', chip: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  elite: { label: 'Elite', chip: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/20' },
};

export const ClientsListScreen: React.FC<ClientsListScreenProps> = ({
  onBack,
  clients,
  isLightTheme,
  initialSelectedClientId,
  onConsumedInitialSelection,
  onRemoveClient,
  onBanClient,
}) => {
  const [searchName, setSearchName] = useState('');
  const [filterRank, setFilterRank] = useState<'all' | ClientRank>('all');
  const [selectedClient, setSelectedClient] = useState<CoachPanelClient | null>(null);
  const [pendingDeleteClient, setPendingDeleteClient] = useState<CoachPanelClient | null>(null);
  const [pendingBanClient, setPendingBanClient] = useState<CoachPanelClient | null>(null);
  const [banReason, setBanReason] = useState('Uploaded disrespectful content');
  const resolvedIsLightTheme = isLightTheme ?? (localStorage.getItem('coach-dashboard-theme') === 'light');

  const banReasons = ['Uploaded disrespectful content', 'Posted a bad comment'];

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
    <div className={`min-h-screen ${resolvedIsLightTheme ? 'bg-[#F5F7FB] text-[#111827]' : 'bg-[#111315] text-white'}`}>
      <div className={`sticky top-0 z-20 border-b px-4 pb-4 pt-4 backdrop-blur ${resolvedIsLightTheme ? 'border-slate-200 bg-white/95' : 'border-white/10 bg-[#111315]/95'}`}>
        <button
          onClick={onBack}
          className={`flex items-center gap-2 text-sm ${resolvedIsLightTheme ? 'text-slate-600 hover:text-[#111827]' : 'text-white/65 hover:text-white'}`}
        >
          <ArrowLeft size={18} />
          <span>Back to Dashboard</span>
        </button>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.22em] ${resolvedIsLightTheme ? 'text-slate-500' : 'text-white/45'}`}>Athlete Roster</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Coach clients</h1>
            <p className={`mt-1 text-sm ${resolvedIsLightTheme ? 'text-slate-600' : 'text-white/55'}`}>
              {filteredClients.length} athletes ready for coaching
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_0.8fr]">
          <label className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${resolvedIsLightTheme ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
            <Search size={18} className={resolvedIsLightTheme ? 'text-slate-400' : 'text-white/35'} />
            <input
              type="text"
              placeholder="Search athlete..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className={`w-full bg-transparent text-sm outline-none ${resolvedIsLightTheme ? 'placeholder:text-slate-400' : 'placeholder:text-white/35'}`}
            />
          </label>

          <div className="relative">
            <select
              value={filterRank}
              onChange={(e) => setFilterRank(e.target.value as 'all' | ClientRank)}
              className={`w-full appearance-none rounded-2xl border px-4 py-3 pr-11 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#10b981]/40 ${
                resolvedIsLightTheme
                  ? 'border-slate-200 bg-white text-[#111827] shadow-[0_10px_24px_rgba(15,23,42,0.06)] hover:bg-slate-50'
                  : 'border-white/10 bg-white/5 text-white'
              }`}
            >
              <option value="all">All levels</option>
              <option value="bronze">Beginner</option>
              <option value="silver">Intermediate</option>
              <option value="gold">Advanced</option>
              <option value="elite">Elite</option>
            </select>
            <ChevronDown
              size={16}
              className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${
                resolvedIsLightTheme ? 'text-slate-400' : 'text-white/60'
              }`}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client) => {
            const meta = rankMeta[client.rank];
            return (
              <div
                key={client.id}
                onClick={() => setSelectedClient(client)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedClient(client);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`relative overflow-hidden rounded-[28px] border p-4 text-left transition-transform hover:-translate-y-0.5 ${
                  resolvedIsLightTheme
                    ? 'border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <button
                    type="button"
                    title="Ban user"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!onBanClient) return;
                      setBanReason('Uploaded disrespectful content');
                      setPendingBanClient(client);
                    }}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition-colors ${
                      resolvedIsLightTheme
                        ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
                        : 'border-white/10 bg-white/5 text-amber-400 hover:bg-white/10'
                    }`}
                  >
                    <Ban size={16} />
                  </button>
                  <button
                    type="button"
                    title="Remove user"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!onRemoveClient) return;
                      setPendingDeleteClient(client);
                    }}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition-colors ${
                      resolvedIsLightTheme
                        ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'border-white/10 bg-white/5 text-rose-400 hover:bg-white/10'
                    }`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-[#10b981]/20">
                    {client.profilePicture ? (
                      <img src={client.profilePicture} alt={`${client.name} profile`} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold">{client.avatar}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold">{client.name}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.chip}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm ${resolvedIsLightTheme ? 'text-slate-600' : 'text-white/55'}`}>
                      {typeof client.age === 'number' ? `${client.age} years old` : 'Age not available'}
                    </p>
                  </div>
                </div>

                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${resolvedIsLightTheme ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/10 bg-black/20 text-white/60'}`}>
                  Open profile, progress, and coaching plan tools
                </div>
              </div>
            );
          })}
        </div>

        {filteredClients.length === 0 && (
          <div className={`rounded-[28px] border border-dashed p-8 text-center text-sm ${resolvedIsLightTheme ? 'border-slate-200 text-slate-500' : 'border-white/10 text-white/55'}`}>
            No athletes match this search yet.
          </div>
        )}
      </div>

      {selectedClient && (
        <CustomerProfileModal
          client={selectedClient}
          isLightTheme={resolvedIsLightTheme}
          onClose={() => setSelectedClient(null)}
        />
      )}

      {pendingDeleteClient && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div
            className={`w-full max-w-md rounded-[24px] border p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] ${
              resolvedIsLightTheme ? 'border-slate-200 bg-white text-[#111827]' : 'border-white/10 bg-[#1A1A1A] text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Remove User</p>
                <h3 className="mt-2 text-lg font-semibold">Remove {pendingDeleteClient.name}?</h3>
                <p className={`mt-2 text-sm ${resolvedIsLightTheme ? 'text-slate-600' : 'text-white/60'}`}>
                  This will hide the user from the coach panel. You can restore them by setting <span className="font-semibold">is_active</span> back to 1.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteClient(null)}
                className={`h-9 w-9 rounded-xl border text-sm transition-colors ${
                  resolvedIsLightTheme
                    ? 'border-slate-200 bg-white hover:bg-slate-50'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteClient(null)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  resolvedIsLightTheme
                    ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!pendingDeleteClient || !onRemoveClient) return;
                  try {
                    await onRemoveClient(pendingDeleteClient.id);
                    if (selectedClient?.id === pendingDeleteClient.id) {
                      setSelectedClient(null);
                    }
                    setPendingDeleteClient(null);
                  } catch (error) {
                    console.error('Failed to remove user', error);
                    alert('Failed to remove user. Please try again.');
                  }
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
              >
                Remove User
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingBanClient && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div
            className={`w-full max-w-md rounded-[24px] border p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] ${
              resolvedIsLightTheme ? 'border-slate-200 bg-white text-[#111827]' : 'border-white/10 bg-[#1A1A1A] text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Ban User</p>
                <h3 className="mt-2 text-lg font-semibold">Ban {pendingBanClient.name} for 14 days?</h3>
                <p className={`mt-2 text-sm ${resolvedIsLightTheme ? 'text-slate-600' : 'text-white/60'}`}>
                  This will block blog uploads and comments for 14 days. The user has 24 hours to remove any bad blogs or the account will be deleted in 48 hours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingBanClient(null)}
                className={`h-9 w-9 rounded-xl border text-sm transition-colors ${
                  resolvedIsLightTheme
                    ? 'border-slate-200 bg-white hover:bg-slate-50'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${resolvedIsLightTheme ? 'text-slate-500' : 'text-white/50'}`}>Reason</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {banReasons.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setBanReason(reason)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      banReason === reason
                        ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                        : resolvedIsLightTheme
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-white/5 text-white/70 border border-white/10'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingBanClient(null)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  resolvedIsLightTheme
                    ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!pendingBanClient || !onBanClient) return;
                  try {
                    await onBanClient(pendingBanClient.id, { days: 14, reason: banReason });
                    setPendingBanClient(null);
                  } catch (error) {
                    console.error('Failed to ban user', error);
                    alert('Failed to ban user. Please try again.');
                  }
                }}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-600"
              >
                Ban for 14 days
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

