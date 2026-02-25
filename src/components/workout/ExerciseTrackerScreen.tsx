import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { Button } from '../ui/Button';
import {
  Play,
  FileText,
  BarChart2,
  Disc,
  Clock,
  Plus,
  Minus,
  Check,
  ChevronUp,
  ChevronDown } from
'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
interface ExerciseTrackerScreenProps {
  onBack: () => void;
  onVideo: () => void;
}
interface SetData {
  id: number;
  target: string;
  weight: number;
  reps: number;
  completed: boolean;
}
export function ExerciseTrackerScreen({
  onBack,
  onVideo
}: ExerciseTrackerScreenProps) {
  const [sets, setSets] = useState<SetData[]>([
  {
    id: 1,
    target: '8-10',
    weight: 60,
    reps: 8,
    completed: true
  },
  {
    id: 2,
    target: '8-10',
    weight: 60,
    reps: 8,
    completed: false
  },
  {
    id: 3,
    target: '8-10',
    weight: 60,
    reps: 0,
    completed: false
  }]
  );
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  useEffect(() => {
    let interval: any;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => setRestTimer((t) => t - 1), 1000);
    } else if (restTimer === 0) {
      setIsResting(false);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);
  const toggleComplete = (id: number) => {
    setSets(
      sets.map((s) => {
        if (s.id === id) {
          if (!s.completed) {
            // Start rest timer on completion
            setRestTimer(90);
            setIsResting(true);
          }
          return {
            ...s,
            completed: !s.completed
          };
        }
        return s;
      })
    );
  };
  const updateSet = (id: number, field: 'weight' | 'reps', value: number) => {
    setSets(
      sets.map((s) =>
      s.id === id ?
      {
        ...s,
        [field]: value
      } :
      s
      )
    );
  };
  const addSet = () => {
    const lastSet = sets[sets.length - 1];
    setSets([
    ...sets,
    {
      id: sets.length + 1,
      target: lastSet.target,
      weight: lastSet.weight,
      reps: 0,
      completed: false
    }]
    );
  };
  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <div className="px-6 pt-2">
        <Header
          title="Bench Press"
          onBack={onBack}
          rightElement={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border border-white/10">
              <Clock
              size={16}
              className={
              isResting ? 'text-accent animate-pulse' : 'text-text-tertiary'
              } />

              <span
              className={`font-mono font-medium ${isResting ? 'text-accent' : 'text-white'}`}>

                {Math.floor(restTimer / 60)}:
                {(restTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>
          } />

      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-6 mb-6">
        <button className="flex flex-col items-center gap-1 text-text-secondary hover:text-white transition-colors">
          <div className="w-10 h-10 rounded-full bg-card border border-white/5 flex items-center justify-center">
            <FileText size={18} />
          </div>
          <span className="text-[10px] uppercase font-medium">Guide</span>
        </button>
        <button
          onClick={onVideo}
          className="flex flex-col items-center gap-1 text-text-secondary hover:text-white transition-colors">

          <div className="w-10 h-10 rounded-full bg-card border border-white/5 flex items-center justify-center">
            <Play size={18} />
          </div>
          <span className="text-[10px] uppercase font-medium">Video</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-text-secondary hover:text-white transition-colors">
          <div className="w-10 h-10 rounded-full bg-card border border-white/5 flex items-center justify-center">
            <BarChart2 size={18} />
          </div>
          <span className="text-[10px] uppercase font-medium">Stats</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-text-secondary hover:text-white transition-colors">
          <div className="w-10 h-10 rounded-full bg-card border border-white/5 flex items-center justify-center">
            <Disc size={18} />
          </div>
          <span className="text-[10px] uppercase font-medium">Plates</span>
        </button>
      </div>

      {/* Previous Performance */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2 uppercase tracking-wider font-medium">
          Last Session
        </div>
        <div className="flex items-center gap-4">
          <div className="text-white font-medium">60kg x 8</div>
          <div className="text-white font-medium">60kg x 8</div>
          <div className="text-white font-medium">60kg x 7</div>
          <div className="flex items-center text-accent text-xs font-bold bg-accent/10 px-2 py-0.5 rounded">
            <ChevronUp size={12} className="mr-1" />
            PROGRESSIVE OVERLOAD
          </div>
        </div>
      </div>

      {/* Set Table */}
      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 mb-4 text-xs text-text-tertiary uppercase font-medium text-center">
          <div className="w-8">Set</div>
          <div>Kg</div>
          <div>Reps</div>
          <div>Vol</div>
          <div className="w-10">✓</div>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {sets.map((set) =>
            <motion.div
              key={set.id}
              initial={{
                opacity: 0,
                y: 10
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              className={`
                  grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 items-center p-3 rounded-xl border transition-colors duration-300
                  ${set.completed ? 'bg-accent/5 border-accent/20' : 'bg-card border-white/5'}
                `}>

                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-text-secondary">
                  {set.id}
                </div>

                <div className="relative">
                  <input
                  type="number"
                  value={set.weight}
                  onChange={(e) =>
                  updateSet(set.id, 'weight', Number(e.target.value))
                  }
                  className="w-full bg-transparent text-center font-bold text-white text-lg focus:outline-none" />

                </div>

                <div className="relative">
                  <input
                  type="number"
                  value={set.reps}
                  onChange={(e) =>
                  updateSet(set.id, 'reps', Number(e.target.value))
                  }
                  className={`w-full bg-transparent text-center font-bold text-lg focus:outline-none ${set.reps === 0 ? 'text-text-tertiary' : 'text-white'}`}
                  placeholder={set.target} />

                </div>

                <div className="text-center font-mono text-sm text-text-secondary">
                  {set.weight * (set.reps || 0)}
                </div>

                <button
                onClick={() => toggleComplete(set.id)}
                className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                    ${set.completed ? 'bg-accent text-black shadow-glow scale-105' : 'bg-white/5 text-text-tertiary hover:bg-white/10'}
                  `}>

                  <Check size={20} strokeWidth={3} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={addSet}
          className="w-full py-4 mt-4 flex items-center justify-center gap-2 text-sm font-medium text-text-secondary hover:text-white transition-colors border border-dashed border-white/10 rounded-xl hover:bg-white/5">

          <Plus size={16} />
          Add Set
        </button>
      </div>
    </div>);

}