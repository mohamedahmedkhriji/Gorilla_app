import React, { useEffect, useMemo, useState } from 'react';
import { X, Clock, Dumbbell, Check, Loader2, Send } from 'lucide-react';
import { stripExercisePrefix } from '../../services/exerciseName';
import { api } from '../../services/api';

type SessionStatus = 'picked' | 'confirmed' | 'pending' | 'completed' | 'missed' | 'cancelled';

interface SessionSummary {
  id: string;
  userId: number;
  clientName: string;
  clientAvatar: string;
  time: string;
  duration: number;
  type: string;
  status: SessionStatus;
  date: string;
}

interface SessionExerciseSet {
  setNumber: number;
  reps: number;
  weight: number;
  notes?: string;
}

interface SessionExercise {
  id?: number | null;
  name: string;
  plannedSets?: number | null;
  plannedReps?: string;
  plannedWeight?: number | null;
  completedSets?: number;
  totalReps?: number;
  topWeight?: number;
  targetMuscles?: string[];
  notes?: string;
  sets?: SessionExerciseSet[];
}

interface SessionNote {
  id?: number | null;
  text: string;
  updatedAt?: string | null;
}

interface SessionDetailsResponse {
  session?: {
    id?: number | string | null;
    userId?: number;
    sessionDate?: string | null;
    sessionTime?: string | null;
    durationMinutes?: number;
    workoutName?: string;
    status?: SessionStatus | string;
    summaryText?: string;
  };
  exerciseSource?: 'completed' | 'planned' | 'empty';
  exercises?: SessionExercise[];
  note?: SessionNote | null;
}

interface SessionDetailsModalProps {
  session: SessionSummary;
  coachId?: number | null;
  onClose: () => void;
  onUpdate: (sessionId: string, newTime: string, newDuration: number) => void;
}

const getStatusClasses = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'picked') return 'bg-amber-500/15 text-amber-700';
  if (normalized === 'confirmed') return 'bg-green-500/15 text-green-700';
  if (normalized === 'pending') return 'bg-yellow-500/15 text-yellow-700';
  if (normalized === 'missed' || normalized === 'cancelled') return 'bg-rose-500/15 text-rose-700';
  return 'bg-slate-100 text-slate-500';
};

const formatWeight = (value: number | null | undefined) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '-';
  return Number.isInteger(numeric) ? `${numeric}kg` : `${numeric.toFixed(1)}kg`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({
  session,
  coachId,
  onClose,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newTime, setNewTime] = useState(session.time);
  const [newDuration, setNewDuration] = useState(session.duration);
  const [details, setDetails] = useState<SessionDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState('');
  const [notesText, setNotesText] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [sendingNote, setSendingNote] = useState(false);

  const resolvedCoachId = useMemo(() => {
    if (coachId) return Number(coachId);
    try {
      const storedCoach = JSON.parse(localStorage.getItem('coach') || '{}');
      return Number(storedCoach?.id || localStorage.getItem('coachId') || 0);
    } catch {
      return Number(localStorage.getItem('coachId') || 0);
    }
  }, [coachId]);

  useEffect(() => {
    let cancelled = false;

    const loadDetails = async () => {
      if (!resolvedCoachId || !session.userId) {
        if (!cancelled) {
          setDetails(null);
          setDetailsLoading(false);
          setDetailsError('Missing coach or user information for this session.');
          setNotesText('');
        }
        return;
      }

      try {
        setDetailsLoading(true);
        setDetailsError('');
        const response = await api.getCoachSessionDetails(resolvedCoachId, session.userId, {
          date: session.date,
          sessionId: session.id.startsWith('planned-') ? null : session.id,
          workoutName: session.type,
        });

        if (cancelled) return;
        setDetails(response || null);
        setNotesText(String(response?.note?.text || ''));
      } catch (error: any) {
        if (cancelled) return;
        setDetails(null);
        setDetailsError(error?.message || 'Failed to load session details.');
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    };

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [resolvedCoachId, session.date, session.id, session.type, session.userId]);

  useEffect(() => {
    if (isEditing) return;
    setNewTime(String(details?.session?.sessionTime || session.time || '08:00').slice(0, 5));
    setNewDuration(Number(details?.session?.durationMinutes || session.duration || 60));
  }, [details?.session?.durationMinutes, details?.session?.sessionTime, isEditing, session.duration, session.time]);

  const displayedTime = String(details?.session?.sessionTime || session.time || '08:00').slice(0, 5);
  const displayedDuration = Number(details?.session?.durationMinutes || session.duration || 60);
  const displayedStatus = String(details?.session?.status || session.status || 'confirmed').toLowerCase();
  const displayedWorkoutName = String(details?.session?.workoutName || session.type || 'Workout').trim() || 'Workout';
  const exerciseSource = details?.exerciseSource || 'empty';
  const exercises = Array.isArray(details?.exercises) ? details.exercises : [];
  const lastSentAt = details?.note?.updatedAt || null;
  const summaryText = String(details?.session?.summaryText || '').trim();
  const sourceTitle = exerciseSource === 'completed' ? 'Workout Results' : 'Workout Plan';
  const sourceHint = exerciseSource === 'completed'
    ? 'Showing the athlete’s logged reps and weight for each exercise.'
    : exerciseSource === 'planned'
      ? 'Showing the planned workout because there is no completed log for this day.'
      : 'No workout data was found for this day yet.';

  const handleConfirm = () => {
    onUpdate(session.id, newTime, newDuration);
    onClose();
  };

  const handleSendNote = async () => {
    const trimmed = notesText.trim();
    if (!trimmed) {
      setSendSuccess('');
      setSendError('Write a note before sending it.');
      return;
    }

    if (!resolvedCoachId || !session.userId) {
      setSendSuccess('');
      setSendError('Missing coach or user information for this note.');
      return;
    }

    try {
      setSendingNote(true);
      setSendError('');
      setSendSuccess('');

      const response = await api.sendCoachSessionNote(resolvedCoachId, session.userId, {
        sessionDate: session.date,
        sessionId: session.id.startsWith('planned-') ? null : session.id,
        workoutName: displayedWorkoutName,
        note: trimmed,
      });

      const nextNote = response?.note || { text: trimmed };
      setNotesText(String(nextNote?.text || trimmed));
      setDetails((current) => ({
        ...(current || {}),
        note: nextNote,
      }));
      setSendSuccess('Note sent. The user can now see it in notifications.');
    } catch (error: any) {
      setSendSuccess('');
      setSendError(error?.message || 'Failed to send the note.');
    } finally {
      setSendingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-0 md:p-4" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[28px] border border-slate-200 bg-white text-[#111827] md:relative md:mx-auto md:mt-8 md:max-w-2xl md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur md:px-6 md:pt-5">
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200 md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10b981]/20 font-bold text-emerald-600">
                {session.clientAvatar}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{session.clientName}</h2>
                <p className="text-sm text-slate-500">{displayedWorkoutName}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-2xl p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#111827]">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4 md:px-6 md:py-6">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Clock size={18} className="text-emerald-600" />
              Session Details
            </h3>

            {isEditing ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-2 block text-slate-500">Time</span>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block text-slate-500">Duration (minutes)</span>
                  <input
                    type="number"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    step="15"
                    min="30"
                    max="180"
                  />
                </label>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-4 py-3 text-sm font-semibold text-black"
                  >
                    <Check size={18} />
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-slate-500">Start time</span>
                  <span className="font-semibold">{displayedTime || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-semibold">{displayedDuration} minutes</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-slate-500">Status</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(displayedStatus)}`}>
                    {displayedStatus}
                  </span>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit session time
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Dumbbell size={18} className="text-emerald-600" />
                  {sourceTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{sourceHint}</p>
              </div>
              {exerciseSource !== 'empty' && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  exerciseSource === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {exerciseSource}
                </span>
              )}
            </div>

            {detailsLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading workout data...
              </div>
            ) : detailsError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {detailsError}
              </div>
            ) : exercises.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                No exercise data available for this session yet.
              </div>
            ) : (
              <div className="space-y-3">
                {exercises.map((exercise, index) => {
                  const exerciseSets = Array.isArray(exercise.sets) ? exercise.sets : [];
                  const targetMuscles = Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles.filter(Boolean) : [];
                  const plannedReps = String(exercise.plannedReps || '').trim() || '-';

                  return (
                    <div key={`${exercise.name}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{stripExercisePrefix(exercise.name)}</div>
                          {targetMuscles.length > 0 && (
                            <p className="mt-1 text-xs text-slate-500">{targetMuscles.join(' • ')}</p>
                          )}
                        </div>
                        {exerciseSource === 'completed' && exercise.completedSets ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {exercise.completedSets} set{exercise.completedSets === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </div>

                      {exerciseSource === 'completed' ? (
                        <>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <p className="text-slate-500">Sets done</p>
                              <p className="mt-1 font-semibold">{exercise.completedSets || exerciseSets.length || 0}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Total reps</p>
                              <p className="mt-1 font-semibold">{exercise.totalReps || 0}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Top weight</p>
                              <p className="mt-1 font-semibold">{formatWeight(exercise.topWeight)}</p>
                            </div>
                          </div>

                          {exerciseSets.length > 0 && (
                            <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3">
                              {exerciseSets.map((setEntry) => (
                                <div key={`${exercise.name}-${setEntry.setNumber}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                                  <span className="text-slate-500">Set {setEntry.setNumber}</span>
                                  <span className="font-semibold">
                                    {formatWeight(setEntry.weight)} x {setEntry.reps || 0} reps
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {(exercise.plannedSets || exercise.plannedReps || exercise.plannedWeight) && (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                              <p className="mb-2 font-semibold text-slate-700">Planned target</p>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <p className="text-slate-500">Sets</p>
                                  <p className="mt-1 font-semibold">{exercise.plannedSets || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Reps</p>
                                  <p className="mt-1 font-semibold">{plannedReps}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Weight</p>
                                  <p className="mt-1 font-semibold">{formatWeight(exercise.plannedWeight)}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-slate-500">Sets</p>
                            <p className="mt-1 font-semibold">{exercise.plannedSets || '-'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Reps</p>
                            <p className="mt-1 font-semibold">{plannedReps}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Weight</p>
                            <p className="mt-1 font-semibold">{formatWeight(exercise.plannedWeight)}</p>
                          </div>
                        </div>
                      )}

                      {exercise.notes && (
                        <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          {exercise.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {summaryText && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {summaryText}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Notes</h3>
              {lastSentAt && (
                <span className="text-xs text-slate-500">Last sent {formatDateTime(lastSentAt)}</span>
              )}
            </div>

            <textarea
              value={notesText}
              onChange={(e) => {
                setNotesText(e.target.value);
                if (sendError) setSendError('');
                if (sendSuccess) setSendSuccess('');
              }}
              placeholder="Add session notes..."
              className="min-h-[110px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400"
            />

            {sendError && (
              <p className="mt-3 text-sm text-rose-500">{sendError}</p>
            )}
            {sendSuccess && (
              <p className="mt-3 text-sm text-emerald-600">{sendSuccess}</p>
            )}

            <button
              onClick={() => void handleSendNote()}
              disabled={sendingNote || !notesText.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingNote ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {sendingNote ? 'Sending...' : 'Send notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
