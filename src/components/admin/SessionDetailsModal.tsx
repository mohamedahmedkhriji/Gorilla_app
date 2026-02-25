import React, { useState } from 'react';
import { X, Clock, Calendar, Dumbbell, Check } from 'lucide-react';

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
    { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', weight: '25kg' }
  ];

  const handleConfirm = () => {
    onUpdate(session.id, newTime, newDuration);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#242424] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#242424] border-b border-gray-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#BFFF00]/20 flex items-center justify-center font-bold">
              {session.clientAvatar}
            </div>
            <div>
              <h2 className="text-xl font-bold">{session.clientName}</h2>
              <p className="text-sm text-gray-400">{session.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#1A1A1A] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-[#1A1A1A] rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-[#BFFF00]" />
              Session Details
            </h3>
            
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full bg-[#242424] rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full bg-[#242424] rounded px-3 py-2"
                    step="15"
                    min="30"
                    max="180"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-gray-700 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-[#BFFF00] text-black py-2 rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    <Check size={18} />
                    Confirm Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Start Time:</span>
                  <span className="font-semibold">{session.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duration:</span>
                  <span className="font-semibold">{session.duration} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    session.status === 'confirmed'
                      ? 'bg-green-500/20 text-green-500'
                      : session.status === 'pending'
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : 'bg-gray-600/20 text-gray-400'
                  }`}>
                    {session.status}
                  </span>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full mt-3 bg-[#242424] py-2 rounded-lg text-sm hover:bg-[#2A2A2A] transition-colors"
                >
                  Edit Session Time
                </button>
              </div>
            )}
          </div>

          <div className="bg-[#1A1A1A] rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Dumbbell size={18} className="text-[#BFFF00]" />
              Workout Plan
            </h3>
            <div className="space-y-3">
              {exercises.map((ex, idx) => (
                <div key={idx} className="bg-[#242424] rounded-lg p-3">
                  <div className="font-semibold mb-2">{ex.name}</div>
                  <div className="grid grid-cols-3 gap-2 text-sm text-gray-400">
                    <div>
                      <span className="text-xs">Sets:</span>
                      <div className="text-white font-semibold">{ex.sets}</div>
                    </div>
                    <div>
                      <span className="text-xs">Reps:</span>
                      <div className="text-white font-semibold">{ex.reps}</div>
                    </div>
                    <div>
                      <span className="text-xs">Weight:</span>
                      <div className="text-white font-semibold">{ex.weight}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-lg p-4">
            <h3 className="font-semibold mb-2">Notes</h3>
            <textarea
              placeholder="Add session notes..."
              className="w-full bg-[#242424] rounded px-3 py-2 text-sm min-h-[80px] resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
