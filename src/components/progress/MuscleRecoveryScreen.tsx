import React, { useState, useEffect } from 'react';
import { Header } from '../ui/Header';
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { api } from '../../services/api';
interface MuscleRecoveryScreenProps {
  onBack: () => void;
}

type MuscleRecoveryItem = {
  muscle: string;
  name: string;
  score: number;
  lastWorkout: string | null;
  hoursNeeded?: number;
  hoursElapsed?: number;
  hoursRemaining?: number;
  overtrainingRisk?: boolean;
  plannedTodaySetUnits?: number;
  completedTodaySetUnits?: number;
  todayPlanCompletionPct?: number;
  plannedWeekSetUnits?: number;
  completedWeekSetUnits?: number;
  weekPlanCompletionPct?: number;
  completedTodayVolume?: number;
  completedWeekVolume?: number;
};

type RecoverySummary = {
  readyMuscles?: number;
  almostReadyMuscles?: number;
  damagedMuscles?: number;
  planBased?: {
    hasActiveProgram?: boolean;
    weekStart?: string;
    weekEnd?: string;
    plannedTodaySetUnits?: number;
    completedTodaySetUnits?: number;
    plannedWeekSetUnits?: number;
    completedWeekSetUnits?: number;
    completedTodayVolume?: number;
    completedWeekVolume?: number;
    todayPlanCompletionPct?: number;
    weekPlanCompletionPct?: number;
  };
};

const DEFAULT_MUSCLES: MuscleRecoveryItem[] = [
  { muscle: 'chest', name: 'Chest', score: 100, lastWorkout: null },
  { muscle: 'back', name: 'Back', score: 100, lastWorkout: null },
  { muscle: 'quadriceps', name: 'Quadriceps', score: 100, lastWorkout: null },
  { muscle: 'hamstrings', name: 'Hamstrings', score: 100, lastWorkout: null },
  { muscle: 'shoulders', name: 'Shoulders', score: 100, lastWorkout: null },
  { muscle: 'biceps', name: 'Biceps', score: 100, lastWorkout: null },
  { muscle: 'triceps', name: 'Triceps', score: 100, lastWorkout: null },
  { muscle: 'forearms', name: 'Forearms', score: 100, lastWorkout: null },
  { muscle: 'calves', name: 'Calves', score: 100, lastWorkout: null },
  { muscle: 'abs', name: 'Abs', score: 100, lastWorkout: null },
];

const mergeRecoveryWithDefaults = (incoming: MuscleRecoveryItem[] = []): MuscleRecoveryItem[] => {
  const safeNumber = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const byName = new Map(
    incoming.map((m) => [String(m.name || m.muscle).toLowerCase(), m]),
  );

  return DEFAULT_MUSCLES.map((muscle) => {
    const found = byName.get(muscle.name.toLowerCase()) || byName.get(muscle.muscle.toLowerCase());
    if (!found) return muscle;
    return {
      ...muscle,
      ...found,
      score: Number.isFinite(Number(found.score)) ? Math.max(0, Math.min(100, Math.round(Number(found.score)))) : 100,
      lastWorkout: found.lastWorkout ?? null,
      hoursNeeded: safeNumber(found.hoursNeeded, 0),
      hoursElapsed: safeNumber(found.hoursElapsed, 0),
      hoursRemaining: safeNumber(found.hoursRemaining, 0),
      plannedTodaySetUnits: safeNumber(found.plannedTodaySetUnits, 0),
      completedTodaySetUnits: safeNumber(found.completedTodaySetUnits, 0),
      todayPlanCompletionPct: Math.max(0, Math.min(100, Math.round(safeNumber(found.todayPlanCompletionPct, 0)))),
      plannedWeekSetUnits: safeNumber(found.plannedWeekSetUnits, 0),
      completedWeekSetUnits: safeNumber(found.completedWeekSetUnits, 0),
      weekPlanCompletionPct: Math.max(0, Math.min(100, Math.round(safeNumber(found.weekPlanCompletionPct, 0)))),
      completedTodayVolume: safeNumber(found.completedTodayVolume, 0),
      completedWeekVolume: safeNumber(found.completedWeekVolume, 0),
    };
  });
};

export function MuscleRecoveryScreen({ onBack }: MuscleRecoveryScreenProps) {
  const [muscleRecoveries, setMuscleRecoveries] = useState<MuscleRecoveryItem[]>(DEFAULT_MUSCLES);
  const [showFactors, setShowFactors] = useState(false);
  const [factors, setFactors] = useState({ sleepHours: '7', proteinIntake: 'medium', supplements: 'none', soreness: 3, energy: 3 });
  const [overallRecovery, setOverallRecovery] = useState(100);
  const [summary, setSummary] = useState<RecoverySummary>({});
  const [error, setError] = useState('');

  const loadRecovery = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      if (!user.id) {
        setMuscleRecoveries(DEFAULT_MUSCLES);
        setOverallRecovery(100);
        setSummary({});
        return;
      }

      const data = await api.getRecoveryStatus(user.id);
      setMuscleRecoveries(mergeRecoveryWithDefaults(Array.isArray(data?.recovery) ? data.recovery : []));
      setOverallRecovery(Number.isFinite(Number(data?.overallRecovery)) ? Math.max(0, Math.min(100, Math.round(Number(data.overallRecovery)))) : 100);
      setSummary((data?.summary && typeof data.summary === 'object') ? data.summary : {});
      if (data.factors) setFactors((prev) => ({ ...prev, ...data.factors }));
      setError('');
    } catch (loadError) {
      console.error('Failed to load recovery status:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load recovery status');
    }
  };

  useEffect(() => {
    void loadRecovery();

    const handleRecoveryUpdated = () => {
      void loadRecovery();
    };

    window.addEventListener('recovery-updated', handleRecoveryUpdated);

    const pendingRefreshInterval = window.setInterval(() => {
      if (localStorage.getItem('recoveryNeedsUpdate') !== 'true') return;
      localStorage.removeItem('recoveryNeedsUpdate');
      void loadRecovery();
    }, 2000);

    const periodicRefreshInterval = window.setInterval(() => {
      void loadRecovery();
    }, 30000);

    return () => {
      window.removeEventListener('recovery-updated', handleRecoveryUpdated);
      window.clearInterval(pendingRefreshInterval);
      window.clearInterval(periodicRefreshInterval);
    };
  }, []);

  const handleUpdateFactors = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      await api.updateRecoveryFactors(user.id, factors);
      await loadRecovery();
      setShowFactors(false);
    } catch (updateError) {
      console.error('Failed to update recovery factors:', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Failed to update recovery factors');
    }
  };

  const getLastTrained = (date: string | null) => {
    if (!date) return 'Not trained recently';
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    const days = Math.floor(hours / 24);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getStatusColor = (val: number) => {
    if (val >= 90) return 'text-green-500 bg-green-500/10';
    if (val >= 70) return 'text-[#BFFF00] bg-[#BFFF00]/10';
    if (val >= 50) return 'text-yellow-500 bg-yellow-500/10';
    return 'text-red-500 bg-red-500/10';
  };

  const formatSetUnits = (value: number | undefined) => Number(value || 0).toFixed(1);
  const formatVolume = (value: number | undefined) => Math.round(Number(value || 0));

  const getMuscleImage = (muscleGroup: string) => {
    const imageMap: { [key: string]: string } = {
      'Abs': '/body part/abs.png',
      'Back': '/body part/back.png',
      'Biceps': '/body part/biceps.png',
      'Calves': '/body part/calves.png',
      'Chest': '/body part/chest.jpg',
      'Forearms': '/body part/forearm.png',
      'Hamstrings': '/body part/hamstring.png',
      'Quadriceps': '/body part/quadriceps.png',
      'Shoulders': '/body part/shoulders.png',
      'Triceps': '/body part/triceps.png',
    };
    return imageMap[muscleGroup] || '/body part/chest.jpg';
  };

  const readyMuscles = muscleRecoveries.filter(m => m.score >= 90).sort((a, b) => a.score - b.score);
  const otherMuscles = muscleRecoveries.filter(m => m.score < 90).sort((a, b) => a.score - b.score);
  const planSummary = summary.planBased;
  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title="Muscle Recovery"
          onBack={onBack}
          rightElement={(
            <button onClick={() => setShowFactors(!showFactors)} className="text-accent text-sm font-medium">
              <SlidersHorizontal size={20} />
            </button>
          )}
        />
      </div>

      {showFactors && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full border border-white/10 relative">
            <button 
              onClick={() => setShowFactors(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-xl font-bold text-white mb-6">Recovery Factors</h3>
            
            <div className="space-y-5">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Sleep Hours</label>
                <input 
                  type="number" 
                  min="0" 
                  max="12" 
                  step="0.5"
                  value={factors.sleepHours} 
                  onChange={e => setFactors({...factors, sleepHours: e.target.value})} 
                  className="w-full bg-background rounded-xl px-4 py-3 text-white border border-white/10 focus:outline-none focus:border-accent/50" 
                />
              </div>
              
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Protein Intake</label>
                <div className="relative">
                  <select 
                    value={factors.proteinIntake} 
                    onChange={e => setFactors({...factors, proteinIntake: e.target.value})} 
                    className="w-full bg-background rounded-xl px-4 py-3 text-white border border-white/10 focus:outline-none focus:border-accent/50 appearance-none cursor-pointer pr-10">
                    <option value="low">Low (&lt;0.8g/kg)</option>
                    <option value="medium">Medium (0.8-1.2g/kg)</option>
                    <option value="high">High (1.6-2.2g/kg)</option>
                  </select>
                  <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Supplements</label>
                <div className="relative">
                  <select 
                    value={factors.supplements} 
                    onChange={e => setFactors({...factors, supplements: e.target.value})} 
                    className="w-full bg-background rounded-xl px-4 py-3 text-white border border-white/10 focus:outline-none focus:border-accent/50 appearance-none cursor-pointer pr-10">
                    <option value="none">None</option>
                    <option value="creatine">Creatine</option>
                    <option value="full">Full Stack</option>
                  </select>
                  <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowFactors(false)}
                  className="flex-1 bg-white/5 text-white font-bold py-3 rounded-xl hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateFactors} 
                  className="flex-1 bg-accent text-black font-bold py-3 rounded-xl hover:bg-accent/90 transition-colors">
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 space-y-6 mt-4">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Overall Recovery</p>
            <p className="text-xl font-semibold text-white mt-1">{overallRecovery}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Today Plan</p>
            <p className="text-xl font-semibold text-white mt-1">
              {Number(planSummary?.todayPlanCompletionPct || 0)}%
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {formatSetUnits(planSummary?.completedTodaySetUnits)} / {formatSetUnits(planSummary?.plannedTodaySetUnits)} sets
            </p>
          </div>
        </div>

        {/* Damaged Muscles Section */}
        {otherMuscles.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              Damaged muscles
            </h3>
            <div className="space-y-2">
              {otherMuscles.map((m) => (
                <div
                  key={m.muscle}
                  className="bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-24 rounded-full bg-transparent flex items-center justify-center overflow-hidden">
                      <img
                        src={getMuscleImage(m.name)}
                        alt={m.name}
                        className="w-full h-full object-contain scale-[1.35]"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{m.name}</h4>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        Last trained {getLastTrained(m.lastWorkout)}
                      </p>
                      <p className="text-[11px] text-text-secondary mt-1">
                        Today: {formatSetUnits(m.completedTodaySetUnits)} / {formatSetUnits(m.plannedTodaySetUnits)} sets
                      </p>
                      <p className="text-[11px] text-text-secondary">
                        Week: {formatSetUnits(m.completedWeekSetUnits)} / {formatSetUnits(m.plannedWeekSetUnits)} sets
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        Remaining: {Math.max(0, Math.round(Number(m.hoursRemaining || 0)))}h | Volume: {formatVolume(m.completedWeekVolume)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${getStatusColor(m.score)}`}>
                    {m.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ready Muscles Section */}
        {readyMuscles.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              Ready to train
            </h3>
            <div className="space-y-2">
              {readyMuscles.map((m) => (
                <div
                  key={m.muscle}
                  className="bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-24 rounded-full bg-transparent flex items-center justify-center overflow-hidden">
                      <img
                        src={getMuscleImage(m.name)}
                        alt={m.name}
                        className="w-full h-full object-contain scale-[1.35]"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{m.name}</h4>
                      <p className="text-[11px] text-text-secondary mt-1">
                        Today: {formatSetUnits(m.completedTodaySetUnits)} / {formatSetUnits(m.plannedTodaySetUnits)} sets
                      </p>
                      <p className="text-[11px] text-text-secondary">
                        Week: {formatSetUnits(m.completedWeekSetUnits)} / {formatSetUnits(m.plannedWeekSetUnits)} sets
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        Remaining: {Math.max(0, Math.round(Number(m.hoursRemaining || 0)))}h | Volume: {formatVolume(m.completedWeekVolume)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full text-green-500 bg-green-500/10">
                    {m.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>);

}

