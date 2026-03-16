import React, { useState } from 'react';
import { X, Clock, Dumbbell, Check } from 'lucide-react';
import { stripExercisePrefix } from '../../services/exerciseName';

interface SessionDetailsModalProps {
  session: any;
  onClose: () => void;
  onUpdate: (sessionId: string, newTime: string, newDuration: number) => void;
}

export const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({ session, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newTime, setNewTime] = useState(session.time);
  const [newDuration, setNewDuration] = useState(session.duration);

  const exercises = [
    { name: 'Bench Press', sets: 4, reps: '8-10', weight: '80kg' },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', weight: '30kg' },
    { name: 'Cable Flyes', sets: 3, reps: '12-15', weight: '15kg' },
    { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', weight: '25kg' },
  ];

  const handleConfirm = () => {
    onUpdate(session.id, newTime, newDuration);
    onClose();
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
                <p className="text-sm text-slate-500">{session.type}</p>
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
                  <span className="font-semibold">{session.time}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-semibold">{session.duration} minutes</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-slate-500">Status</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    session.status === 'confirmed'
                      ? 'bg-green-500/15 text-green-700'
                      : session.status === 'pending'
                        ? 'bg-amber-500/15 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}>
                    {session.status}
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
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Dumbbell size={18} className="text-emerald-600" />
              Workout Plan
            </h3>
            <div className="space-y-3">
              {exercises.map((exercise, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold">{stripExercisePrefix(exercise.name)}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500">Sets</p>
                      <p className="mt-1 font-semibold">{exercise.sets}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Reps</p>
                      <p className="mt-1 font-semibold">{exercise.reps}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Weight</p>
                      <p className="mt-1 font-semibold">{exercise.weight}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold">Notes</h3>
            <textarea
              placeholder="Add session notes..."
              className="min-h-[110px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

