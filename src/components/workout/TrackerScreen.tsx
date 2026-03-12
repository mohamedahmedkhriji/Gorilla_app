import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../ui/Header';
import { Play, Square, BarChart3, Video, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

interface TrackerScreenProps {
  onBack: () => void;
  exerciseName: string;
  plannedSets?: number;
  onVideoClick?: (exerciseName: string) => void;
  savedSets?: SetData[];
  onSaveSets?: (sets: SetData[]) => void;
  onRemoveExercise?: () => Promise<void> | void;
}

interface SetData {
  set: number;
  reps: number;
  weight: number;
  completed: boolean;
  duration?: number;
  restTime?: number;
}

const DEFAULT_SET_TEMPLATE: Array<{ reps: number; weight: number }> = [
  { reps: 11, weight: 70 },
  { reps: 10, weight: 75 },
  { reps: 8, weight: 80 },
  { reps: 8, weight: 80 },
];
const REST_WINDOW_MIN_SECONDS = 60;
const REST_WINDOW_MAX_SECONDS = 120;
const SEGMENT_MAP: Record<string, [boolean, boolean, boolean, boolean, boolean, boolean, boolean]> = {
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
};

function SevenSegmentDigit({ digit }: { digit: string }) {
  const segments = SEGMENT_MAP[digit] || SEGMENT_MAP['0'];

  return (
    <div className="seven-seg-digit" aria-hidden="true">
      <span className={`seg seg-a ${segments[0] ? 'on' : ''}`} />
      <span className={`seg seg-b ${segments[1] ? 'on' : ''}`} />
      <span className={`seg seg-c ${segments[2] ? 'on' : ''}`} />
      <span className={`seg seg-d ${segments[3] ? 'on' : ''}`} />
      <span className={`seg seg-e ${segments[4] ? 'on' : ''}`} />
      <span className={`seg seg-f ${segments[5] ? 'on' : ''}`} />
      <span className={`seg seg-g ${segments[6] ? 'on' : ''}`} />
    </div>
  );
}

const createInitialSets = (plannedSets?: number): SetData[] => {
  const requested = Number(plannedSets);
  const setCount = Number.isFinite(requested) && requested > 0
    ? Math.max(1, Math.round(requested))
    : DEFAULT_SET_TEMPLATE.length;

  return Array.from({ length: setCount }, (_, index) => {
    const template = DEFAULT_SET_TEMPLATE[index] || DEFAULT_SET_TEMPLATE[DEFAULT_SET_TEMPLATE.length - 1];
    return {
      set: index + 1,
      reps: template.reps,
      weight: template.weight,
      completed: false,
    };
  });
};

export function TrackerScreen({
  onBack,
  exerciseName,
  plannedSets,
  onVideoClick,
  savedSets,
  onSaveSets,
  onRemoveExercise,
}: TrackerScreenProps) {
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const [sets, setSets] = useState<SetData[]>(() => {
    if (savedSets && savedSets.length > 0) return savedSets;
    return createInitialSets(plannedSets);
  });
  const unit: 'kg' | 'lbs' = 'kg';
  const [isRunning, setIsRunning] = useState(false);
  const [setTimerSeconds, setSetTimerSeconds] = useState(0);
  const [swipedIndex, setSwipedIndex] = useState<number | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [restReminderText, setRestReminderText] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemovingExercise, setIsRemovingExercise] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const restReminderLock = useRef(false);
  const [notificationSettings, setNotificationSettings] = useState({
    coachMessages: true,
    restTimer: true,
    missionChallenge: true,
  });

  useEffect(() => {
    if (savedSets && savedSets.length > 0) {
      setSets(savedSets);
      return;
    }
    setSets(createInitialSets(plannedSets));
  }, [exerciseName, plannedSets, savedSets]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setSetTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting) {
      interval = setInterval(() => {
        setRestTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting]);

  useEffect(() => {
    const loadNotificationSettings = async () => {
      const userId = Number(user?.id || 0);
      const cached = localStorage.getItem('notificationSettings');
      if (cached) {
        try {
          setNotificationSettings((prev) => ({ ...prev, ...JSON.parse(cached) }));
        } catch {
          // ignore malformed cache
        }
      }

      if (!userId) return;
      try {
        const remote = await api.getNotificationSettings(userId);
        const next = {
          coachMessages: !!remote?.coachMessages,
          restTimer: !!remote?.restTimer,
          missionChallenge: !!remote?.missionChallenge,
        };
        setNotificationSettings(next);
        localStorage.setItem('notificationSettings', JSON.stringify(next));
      } catch {
        // Keep defaults/cached values.
      }
    };

    void loadNotificationSettings();
  }, [user?.id]);

  const sendRestReminder = (message: string) => {
    if (!notificationSettings.restTimer) return;
    setRestReminderText(message);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const showBrowserNotification = () => {
      try {
        new Notification('RepSet Rest Timer', {
          body: message,
          tag: 'rest-timeout-reminder',
        });
      } catch {
        // Ignore browser notification errors and keep the in-app reminder.
      }
    };

    if (Notification.permission === 'granted') {
      showBrowserNotification();
      return;
    }

    if (Notification.permission === 'default') {
      void Notification.requestPermission().then((permission) => {
        if (permission === 'granted') showBrowserNotification();
      }).catch(() => {
        // Ignore permission request failures.
      });
    }
  };

  useEffect(() => {
    if (!notificationSettings.restTimer) return;
    if (!isResting) return;
    if (restTime <= REST_WINDOW_MAX_SECONDS) return;
    if (restReminderLock.current) return;

    const nextSet = sets.find((set) => !set.completed)?.set;
    if (!nextSet) return;

    restReminderLock.current = true;
    sendRestReminder(
      `Rest exceeded 2:00 on ${exerciseName}. Start set ${nextSet} now.`,
    );
  }, [exerciseName, isResting, notificationSettings.restTimer, restTime, sets]);

  const persistSets = (nextSets: SetData[]) => {
    setSets(nextSets);
    onSaveSets?.(nextSets);
  };

  const handleRemoveExercise = async () => {
    if (!onRemoveExercise || isRemovingExercise) return;

    try {
      setRemoveError(null);
      setIsRemovingExercise(true);
      await onRemoveExercise();
      setShowRemoveConfirm(false);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'Failed to remove exercise.');
    } finally {
      setIsRemovingExercise(false);
    }
  };

  const toggleTimer = async () => {
    if (isRunning) {
      const firstIncomplete = sets.findIndex(s => !s.completed);
      if (firstIncomplete !== -1) {
        const newSets = [...sets];
        const setDuration = Math.max(0, setTimerSeconds);
        newSets[firstIncomplete].completed = true;
        newSets[firstIncomplete].duration = setDuration;
        newSets[firstIncomplete].restTime = restTime;
        persistSets(newSets);
        
        // Save to database
        if (user?.id) {
          try {
            await api.saveWorkoutSet({
              userId: user.id,
              exerciseName,
              setNumber: newSets[firstIncomplete].set,
              reps: newSets[firstIncomplete].reps,
              weight: newSets[firstIncomplete].weight,
              duration: setDuration,
              restTime: restTime,
              completed: true,
            });
            window.dispatchEvent(new CustomEvent('gamification-updated'));
            localStorage.setItem('recoveryNeedsUpdate', 'true');
            window.dispatchEvent(new CustomEvent('recovery-updated'));
          } catch (error) {
            console.error('Failed to save workout set:', error);
          }
        }

        const hasMoreSets = newSets.some((s) => !s.completed);
        if (hasMoreSets) {
          // Start rest timer between sets.
          setRestTime(0);
          setRestReminderText(null);
          restReminderLock.current = false;
          setIsResting(true);
        } else {
          // All sets done for this exercise.
          setRestTime(0);
          setRestReminderText(null);
          restReminderLock.current = false;
          setIsResting(false);
        }
      }
      setSetTimerSeconds(0);
      setIsRunning(false);
      return;
    } else {
      if (areAllSetsCompleted) {
        setIsResting(false);
        setRestReminderText(null);
        restReminderLock.current = false;
        return;
      }
      // Stop rest timer and start set timer
      setIsResting(false);
      setRestReminderText(null);
      restReminderLock.current = false;
      setSetTimerSeconds(0);
      setIsRunning(true);
      return;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateSet = (index: number, field: 'reps' | 'weight', value: number) => {
    if (!sets[index] || sets[index].completed) return;
    const newSets = [...sets];
    newSets[index][field] = value;
    persistSets(newSets);
  };

  const removeSet = (index: number) => {
    const updated = sets.filter((_, i) => i !== index).map((s, i) => ({ ...s, set: i + 1 }));
    persistSets(updated);
    setSwipedIndex(null);
  };

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    if (!sets[index] || sets[index].completed) return;
    const touch = e.touches[0];
    (e.currentTarget as any).startX = touch.clientX;
  };

  const handleTouchMove = (index: number, e: React.TouchEvent) => {
    if (!sets[index] || sets[index].completed) return;
    const touch = e.touches[0];
    const startX = (e.currentTarget as any).startX;
    const diff = startX - touch.clientX;
    if (diff > 50) {
      setSwipedIndex(index);
    } else if (diff < -20) {
      setSwipedIndex(null);
    }
  };

  const getTotalWorkTime = () => sets.filter(s => s.completed).reduce((acc, set) => acc + (set.duration || 0), 0);
  const getTotalRestTime = () => sets.filter(s => s.completed).reduce((acc, set) => acc + (set.restTime || 0), 0);
  const getTotalVolume = () => sets.filter(s => s.completed).reduce((acc, set) => acc + (set.reps * set.weight), 0);
  const getCompletedSets = () => sets.filter(s => s.completed).length;
  const areAllSetsCompleted = sets.length > 0 && sets.every((set) => set.completed);
  const timerText = formatTime(setTimerSeconds);
  const [m1, m2, s1, s2] = timerText.replace(':', '').split('');

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title="The Tracker"
          onBack={onBack}
          rightElement={onRemoveExercise ? (
            <button
              type="button"
              onClick={() => {
                setShowRemoveConfirm(true);
              }}
              disabled={isRemovingExercise}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/25 bg-[rgb(var(--color-card))]/80 text-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-red-500/45 hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Remove exercise"
            >
              <Trash2 size={17} />
            </button>
          ) : undefined}
        />
      </div>
      <div className="px-4 sm:px-6 -mt-2 mb-2">
        <div className="w-full flex justify-center">
          <div className="seven-seg-shell" role="timer" aria-label={`Set timer ${timerText}`}>
            <div className="seven-seg-group">
              <SevenSegmentDigit digit={m1} />
              <SevenSegmentDigit digit={m2} />
            </div>
            <div className="seven-seg-colon" aria-hidden="true">
              <span className="dot" />
              <span className="dot" />
            </div>
            <div className="seven-seg-group">
              <SevenSegmentDigit digit={s1} />
              <SevenSegmentDigit digit={s2} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-6">
        {removeError && (
          <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {removeError}
          </div>
        )}
        <h2 className="text-2xl font-bold text-white mb-6 text-center">{exerciseName}</h2>

        {showAnalytics ? (
          <div className="space-y-4 mb-8">
            <button onClick={() => setShowAnalytics(false)} className="text-accent text-sm mb-4">
              {"<- Back to Tracker"}
            </button>
            <div className="rounded-xl p-6 border border-white/10 bg-transparent">
              <h3 className="text-lg font-bold text-white mb-4">Workout Analytics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Work Time</span>
                  <span className="text-white font-semibold">{formatTime(getTotalWorkTime())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Rest Time</span>
                  <span className="text-white font-semibold">{formatTime(getTotalRestTime())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Volume</span>
                  <span className="text-white font-semibold">{getTotalVolume()} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Sets Completed</span>
                  <span className="text-white font-semibold">{getCompletedSets()} / {sets.length}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Set Details</h4>
              {sets.filter(s => s.completed).map((set) => (
                <div key={set.set} className="rounded-xl p-4 border border-white/10 bg-transparent">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold">Set {set.set}</span>
                    <span className="text-text-secondary text-sm">{set.reps} reps × {set.weight} {unit}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-text-secondary">
                    <span>Work: {formatTime(set.duration || 0)}</span>
                    {set.restTime && <span>Rest: {formatTime(set.restTime)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-around mb-8">
              <button
                onClick={toggleTimer}
                disabled={!isRunning && areAllSetsCompleted}
                className="flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                  isRunning
                    ? 'border-red-500 bg-red-500/10'
                    : areAllSetsCompleted
                      ? 'border-white/15 bg-white/5'
                      : 'border-green-500 bg-green-500/10'
                }`}>
                  {isRunning ? (
                    <Square size={18} className="text-red-500" />
                  ) : (
                    <Play size={18} className={`${areAllSetsCompleted ? 'text-text-tertiary' : 'text-green-500'} ml-0.5`} />
                  )}
                </div>
              </button>
              <button onClick={() => onVideoClick?.(exerciseName)} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
                  <Video size={20} className="text-white" />
                </div>
                <span className="text-xs text-text-secondary">Video</span>
              </button>
              <button onClick={() => setShowAnalytics(true)} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
                  <BarChart3 size={20} className="text-white" />
                </div>
                <span className="text-xs text-text-secondary">Analytics</span>
              </button>

            </div>

            {isResting && (
              <div className={`mb-4 rounded-xl border p-3 ${
                restTime > REST_WINDOW_MAX_SECONDS
                  ? 'border-red-500/50 bg-red-500/10'
                  : restTime >= REST_WINDOW_MIN_SECONDS
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-white/10 bg-transparent'
              }`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white font-semibold">Rest Timer: {formatTime(restTime)}</span>
                  <span className="text-text-secondary">Target 01:00 - 02:00</span>
                </div>
                {restTime > REST_WINDOW_MAX_SECONDS && (
                  <p className="text-xs text-red-300 mt-2">Rest is over 2 minutes. Start your next set.</p>
                )}
              </div>
            )}

            {restReminderText && (
              <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white">{restReminderText}</p>
                  <button
                    onClick={() => setRestReminderText(null)}
                    className="text-xs text-accent hover:text-white transition-colors"
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {areAllSetsCompleted && !isRunning && (
              <div className="mb-4 rounded-xl border border-green-500/35 bg-green-500/10 p-3 text-sm text-green-200">
                All sets are completed for this exercise.
              </div>
            )}

            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">
              Effective sets
            </h3>

            <div className="grid grid-cols-[60px_60px_80px_1fr] gap-3 mb-3 px-2">
              <span className="text-xs text-text-secondary uppercase">Set</span>
              <span className="text-xs text-text-secondary uppercase">Reps</span>
              <span className="text-xs text-text-secondary uppercase">Weight</span>
              <span></span>
            </div>

            <div className="space-y-3">
              {sets.map((set, index) => (
                <div
                  key={index}
                  className="relative overflow-hidden"
                  onTouchStart={(e) => handleTouchStart(index, e)}
                  onTouchMove={(e) => handleTouchMove(index, e)}>
                  {swipedIndex === index && (
                    <button
                      onClick={() => removeSet(index)}
                      className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center text-white font-bold rounded-r-lg z-10">
                      Delete
                    </button>
                  )}
                  <div className={`grid grid-cols-[60px_60px_80px_1fr] gap-4 items-center transition-transform ${
                    swipedIndex === index ? '-translate-x-20' : ''
                  } ${set.completed ? 'opacity-50' : ''}`}>
                    <div className={`rounded-full px-4 py-2 text-center ${
                      set.completed ? 'bg-green-500/20 border border-green-500' : 'bg-transparent border border-white/20'
                    }`}>
                      <span className={`font-semibold ${
                        set.completed ? 'text-green-500' : 'text-white'
                      }`}>{set.set}</span>
                    </div>
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(index, 'reps', parseInt(e.target.value) || 0)}
                      disabled={set.completed}
                      className="bg-transparent rounded-full px-4 py-2 text-center text-white font-semibold border border-white/20 focus:border-accent outline-none disabled:cursor-not-allowed disabled:border-white/10 disabled:text-text-tertiary"
                    />
                    <input
                      type="number"
                      value={set.weight}
                      onChange={(e) => updateSet(index, 'weight', parseInt(e.target.value) || 0)}
                      disabled={set.completed}
                      className="bg-transparent rounded-full px-4 py-2 text-center text-white font-semibold border border-white/20 focus:border-accent outline-none disabled:cursor-not-allowed disabled:border-white/10 disabled:text-text-tertiary"
                    />
                    <div className="relative h-8">
                      {(() => {
                        const sliderPercent = Math.max(0, Math.min(100, (set.weight / 200) * 100));
                        return (
                          <>
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={set.weight}
                              onChange={(e) => updateSet(index, 'weight', parseInt(e.target.value))}
                              disabled={set.completed}
                              className="barbell-slider-hit absolute inset-y-0 left-6 right-0 z-20 h-full w-auto cursor-pointer opacity-0 disabled:cursor-not-allowed"
                              aria-label={`Set ${set.set} weight`}
                            />
                            <div className="barbell-track-shell pointer-events-none absolute left-6 right-0 top-1/2 z-10 h-[10px] -translate-y-1/2">
                              <div className="barbell-track-fill" style={{ width: `${sliderPercent}%` }} />
                              <div className="barbell-track-remainder" style={{ left: `${sliderPercent}%` }} />
                              <div className="barbell-knob" style={{ left: `${sliderPercent}%` }}>
                                <span className="plate plate-red" />
                                <span className="plate plate-steel" />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => persistSets([...sets, { set: sets.length + 1, reps: 8, weight: 80, completed: false }])}
              className="w-full mt-6 py-3 bg-accent text-black font-bold rounded-full hover:bg-accent/90 transition-colors">
              Add Set
            </button>
          </>
        )}
      </div>

      {showRemoveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
          onClick={() => {
            if (!isRemovingExercise) setShowRemoveConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/12 bg-[rgb(var(--color-card))]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden px-6 pb-5 pt-6">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/12 text-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                  <Trash2 size={22} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-text-primary">Remove Exercise?</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  <span className="font-semibold text-text-primary">{exerciseName}</span> will be removed from today&apos;s workout.
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-tertiary">
                  This updates your workout plan immediately.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/8 bg-black/5 px-6 py-5">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isRemovingExercise}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRemoveExercise();
                }}
                disabled={isRemovingExercise}
                className="rounded-2xl border border-red-500/25 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRemovingExercise ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .barbell-track-shell {
          position: relative;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: linear-gradient(90deg, rgba(7, 12, 20, 0.95), rgba(12, 20, 32, 0.95));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.45),
            0 3px 8px rgba(0, 0, 0, 0.35);
          overflow: visible;
        }

        .barbell-track-shell::before {
          content: '';
          position: absolute;
          top: 50%;
          left: -14px;
          transform: translateY(-50%);
          width: 10px;
          height: 4px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: linear-gradient(90deg, #9ca3af 0%, #d1d5db 48%, #6b7280 100%);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }

        .barbell-track-shell::after {
          content: '';
          position: absolute;
          top: 50%;
          left: -5px;
          transform: translateY(-50%);
          width: 8px;
          height: 6px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: linear-gradient(90deg, #9ca3af 0%, #e5e7eb 52%, #6b7280 100%);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }

        .barbell-track-fill {
          position: absolute;
          inset: 0 auto 0 0;
          border-radius: 9999px;
          background: linear-gradient(180deg, #ff7a7a 0%, #ef4444 65%, #b91c1c 100%);
          box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.18);
          z-index: 2;
        }

        .barbell-track-remainder {
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          border-top-right-radius: 9999px;
          border-bottom-right-radius: 9999px;
          background: linear-gradient(90deg, rgba(19, 31, 46, 0.95), rgba(10, 17, 29, 0.95));
          z-index: 1;
        }

        .barbell-knob {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: 0;
          filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.45));
        }

        .barbell-knob .plate {
          display: inline-block;
          border-radius: 2px;
          border: 1px solid rgba(255, 255, 255, 0.22);
        }

        .barbell-knob .plate-red {
          width: 11px;
          height: 33px;
          background: linear-gradient(180deg, #ff7a7a, #ef4444 65%, #b91c1c);
          z-index: 2;
        }

        .barbell-knob .plate-steel {
          width: 8px;
          height: 25px;
          margin-left: -1px;
          border-color: rgba(255, 255, 255, 0.2);
          background: linear-gradient(180deg, #374151, #1f2937 60%, #111827);
          z-index: 1;
        }

        .barbell-slider-hit:focus-visible + .barbell-track-shell {
          box-shadow:
            0 0 0 2px rgba(187, 255, 92, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.45),
            0 3px 8px rgba(0, 0, 0, 0.35);
        }

        .barbell-slider-hit {
          accent-color: #ef4444;
        }

        .seven-seg-shell {
          --seg-on: #ff2136;
          --seg-off: #3b2a2a;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(180deg, #2a1717 0%, #120b0b 100%);
          box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.65), 0 8px 18px rgba(0, 0, 0, 0.35);
        }

        .seven-seg-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .seven-seg-digit {
          position: relative;
          width: 34px;
          height: 58px;
        }

        .seg {
          position: absolute;
          background: var(--seg-off);
          border-radius: 999px;
          opacity: 0.32;
          transition: background 120ms ease, opacity 120ms ease, box-shadow 120ms ease;
        }

        .seg.on {
          background: var(--seg-on);
          opacity: 1;
          box-shadow: 0 0 6px var(--seg-on), 0 0 12px color-mix(in srgb, var(--seg-on) 85%, transparent), 0 0 20px color-mix(in srgb, var(--seg-on) 45%, transparent);
        }

        .seg-a,
        .seg-d,
        .seg-g {
          width: 22px;
          height: 6px;
          left: 6px;
        }

        .seg-a { top: 0; }
        .seg-g { top: 26px; }
        .seg-d { bottom: 0; }

        .seg-b,
        .seg-c,
        .seg-e,
        .seg-f {
          width: 6px;
          height: 22px;
        }

        .seg-b { right: 0; top: 3px; }
        .seg-c { right: 0; bottom: 3px; }
        .seg-f { left: 0; top: 3px; }
        .seg-e { left: 0; bottom: 3px; }

        .seven-seg-colon {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          margin: 0 2px;
        }

        .seven-seg-colon .dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--seg-on);
          box-shadow: 0 0 6px var(--seg-on), 0 0 12px color-mix(in srgb, var(--seg-on) 70%, transparent);
        }

        [data-theme='light'] .seven-seg-shell {
          --seg-on: #9FCC2A;
          --seg-off: #2f3f1f;
          border-color: rgba(191, 255, 0, 0.35);
          background: linear-gradient(180deg, #1f2a16 0%, #12190d 100%);
        }

        [data-theme='light'] .seven-seg-shell .seg.on {
          box-shadow: 0 0 4px color-mix(in srgb, var(--seg-on) 70%, transparent), 0 0 8px color-mix(in srgb, var(--seg-on) 35%, transparent);
        }

        [data-theme='light'] .seven-seg-shell .seven-seg-colon .dot {
          box-shadow: 0 0 4px color-mix(in srgb, var(--seg-on) 65%, transparent), 0 0 7px color-mix(in srgb, var(--seg-on) 30%, transparent);
        }
      `}</style>
    </div>
  );
}

