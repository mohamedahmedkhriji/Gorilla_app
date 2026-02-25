import React, { useState } from 'react';
import { ArrowLeft, Calendar, Clock, User, AlertCircle, Check, X } from 'lucide-react';
import { SessionDetailsModal } from './SessionDetailsModal';

interface Session {
  id: string;
  clientName: string;
  clientAvatar: string;
  time: string;
  duration: number;
  type: string;
  status: 'confirmed' | 'pending' | 'completed';
}

interface CoachScheduleProps {
  onBack: () => void;
}

export const CoachSchedule: React.FC<CoachScheduleProps> = ({ onBack }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [draggedSession, setDraggedSession] = useState<Session | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [newTime, setNewTime] = useState('');
  const [sessions, setSessions] = useState<Session[]>([
    { id: '1', clientName: 'Alex Johnson', clientAvatar: 'AJ', time: '08:00', duration: 60, type: 'Personal Training', status: 'confirmed' },
    { id: '2', clientName: 'Sarah Smith', clientAvatar: 'SS', time: '10:00', duration: 60, type: 'Form Check', status: 'confirmed' },
    { id: '3', clientName: 'Mike Brown', clientAvatar: 'MB', time: '14:00', duration: 90, type: 'Personal Training', status: 'pending' },
    { id: '4', clientName: 'Emma Davis', clientAvatar: 'ED', time: '16:30', duration: 60, type: 'Consultation', status: 'confirmed' },
    { id: '5', clientName: 'John Wilson', clientAvatar: 'JW', time: '18:00', duration: 60, type: 'Personal Training', status: 'completed' }
  ]);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hours = Array.from({ length: 19 }, (_, i) => i + 6);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      const today = new Date();
      if (today.getMonth() === selectedMonth) {
        const todayIndex = today.getDate() - 1;
        const dayWidth = 80;
        scrollContainerRef.current.scrollLeft = todayIndex * dayWidth - 150;
      }
    }
  }, [selectedMonth]);

  const get30Days = () => {
    const days = [];
    const year = new Date().getFullYear();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(year, selectedMonth, i);
      days.push(day);
    }
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const getSessionsForTime = (hour: number) => {
    return sessions.filter(session => {
      const sessionHour = parseInt(session.time.split(':')[0]);
      return sessionHour === hour;
    });
  };

  const handleDragStart = (session: Session) => {
    setDraggedSession(session);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (hour: number) => {
    if (!draggedSession) return;
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    setNewTime(timeStr);
    setShowConfirmModal(true);
  };

  const confirmReschedule = () => {
    if (!draggedSession) return;
    setSessions(sessions.map(s => 
      s.id === draggedSession.id ? { ...s, time: newTime } : s
    ));
    alert(`✓ Session rescheduled!\n\nNotification sent to ${draggedSession.clientName}:\n"Your ${draggedSession.type} session has been rescheduled to ${newTime}"`);
    setShowConfirmModal(false);
    setDraggedSession(null);
    setNewTime('');
  };

  const cancelReschedule = () => {
    setShowConfirmModal(false);
    setDraggedSession(null);
    setNewTime('');
  };

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setShowDetailsModal(true);
  };

  const handleUpdateSession = (sessionId: string, newTime: string, newDuration: number) => {
    setSessions(sessions.map(s => 
      s.id === sessionId ? { ...s, time: newTime, duration: newDuration } : s
    ));
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      alert(`✓ Session updated!\n\nNotification sent to ${session.clientName}:\n"Your ${session.type} session has been updated to ${newTime} (${newDuration} minutes)"`);
    }
  };

  const days30 = get30Days();

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="border-b border-gray-800 p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-4">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="text-gray-400 text-sm">Manage your training sessions</p>
      </div>

      <div className="p-4">
        <div className="bg-[#242424] rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-[#BFFF00]" />
            <h2 className="font-semibold">Calendar</h2>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="ml-auto bg-[#1A1A1A] text-white px-3 py-1 rounded-lg text-sm border border-gray-700"
            >
              {monthNames.map((month, idx) => (
                <option key={idx} value={idx}>{month}</option>
              ))}
            </select>
          </div>
          <div 
            ref={scrollContainerRef}
            className="flex gap-2 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'thin' }}
          >
            {days30.map((day, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`min-w-[70px] p-3 rounded-lg text-center transition-colors flex-shrink-0 ${
                  isSelected(day)
                    ? 'bg-[#BFFF00] text-black'
                    : isToday(day)
                    ? 'bg-[#BFFF00]/20 border border-[#BFFF00]'
                    : 'bg-[#1A1A1A] hover:bg-[#2A2A2A]'
                }`}
              >
                <div className="text-xs opacity-70">{daysOfWeek[day.getDay()]}</div>
                <div className="text-lg font-bold">{day.getDate()}</div>
                <div className="text-xs opacity-70">{monthNames[day.getMonth()]}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#242424] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <div className="text-sm text-gray-400">{sessions.length} sessions</div>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <Calendar size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No sessions scheduled</p>
              <p className="text-xs text-gray-500 mt-2">Clients with rest days are not shown</p>
            </div>
          ) : (
            <div className="space-y-2">
              {hours.map(hour => {
                const hourSessions = getSessionsForTime(hour);
                const timeStr = `${hour.toString().padStart(2, '0')}:00`;

                return (
                  <div 
                    key={hour} 
                    className="flex gap-3"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(hour)}
                  >
                    <div className="w-16 text-sm text-gray-400 pt-2">{timeStr}</div>
                    <div className="flex-1">
                      {hourSessions.length > 0 ? (
                        <div className="space-y-2">
                          {hourSessions.map(session => (
                            <div
                              key={session.id}
                              draggable
                              onDragStart={() => handleDragStart(session)}
                              onClick={() => handleSessionClick(session)}
                              className={`p-3 rounded-lg border-l-4 cursor-pointer hover:opacity-80 transition-opacity ${
                                session.status === 'confirmed'
                                  ? 'bg-[#BFFF00]/10 border-[#BFFF00]'
                                  : session.status === 'pending'
                                  ? 'bg-yellow-500/10 border-yellow-500'
                                  : 'bg-gray-700/30 border-gray-600'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-[#BFFF00]/20 flex items-center justify-center text-xs font-bold">
                                    {session.clientAvatar}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-sm">{session.clientName}</div>
                                    <div className="text-xs text-gray-400">{session.type}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock size={12} />
                                    {session.duration} min
                                  </div>
                                  <div className={`text-xs mt-1 px-2 py-0.5 rounded ${
                                    session.status === 'confirmed'
                                      ? 'bg-green-500/20 text-green-500'
                                      : session.status === 'pending'
                                      ? 'bg-yellow-500/20 text-yellow-500'
                                      : 'bg-gray-600/20 text-gray-400'
                                  }`}>
                                    {session.status}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-12 border-l-2 border-dashed border-gray-800" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showDetailsModal && selectedSession && (
        <SessionDetailsModal
          session={selectedSession}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSession(null);
          }}
          onUpdate={handleUpdateSession}
        />
      )}

      {showConfirmModal && draggedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#242424] rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={24} className="text-yellow-500" />
              <h3 className="text-xl font-bold">Confirm Reschedule</h3>
            </div>
            <p className="text-gray-300 mb-4">
              Are you sure you want to reschedule this session?
            </p>
            <div className="bg-[#1A1A1A] rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#BFFF00]/20 flex items-center justify-center text-xs font-bold">
                  {draggedSession.clientAvatar}
                </div>
                <div>
                  <div className="font-semibold">{draggedSession.clientName}</div>
                  <div className="text-xs text-gray-400">{draggedSession.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">From:</span>
                <span className="line-through text-red-400">{draggedSession.time}</span>
                <span className="text-gray-400">→</span>
                <span className="text-[#BFFF00] font-semibold">{newTime}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-6">
              {draggedSession.clientName} will receive a notification about this change.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelReschedule}
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <X size={20} />
                Cancel
              </button>
              <button
                onClick={confirmReschedule}
                className="flex-1 bg-[#BFFF00] text-black py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Check size={20} />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
