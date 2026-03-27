import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Clock, AlertCircle, Check, X } from 'lucide-react';
import { SessionDetailsModal } from './SessionDetailsModal';
import { api } from '../../services/api';

interface Session {
  id: string;
  userId: number;
  clientName: string;
  clientAvatar: string;
  time: string;
  duration: number;
  type: string;
  status: 'picked' | 'confirmed' | 'pending' | 'completed' | 'missed' | 'cancelled';
  date: string;
}

interface CoachScheduleProps {
  onBack: () => void;
  coachId?: number | null;
}

export const CoachSchedule: React.FC<CoachScheduleProps> = ({ onBack, coachId }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [draggedSession, setDraggedSession] = useState<Session | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [newTime, setNewTime] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hours = Array.from({ length: 19 }, (_, i) => i + 6);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const formatDateKey = (date: Date) => date.toLocaleDateString('en-CA');
  const normalizeStatus = (rawStatus: string | null | undefined): Session['status'] => {
    const key = String(rawStatus || '').toLowerCase();
    if (key.includes('complete')) return 'completed';
    if (key.includes('pick')) return 'picked';
    if (key.includes('pending')) return 'pending';
    if (key.includes('miss')) return 'missed';
    if (key.includes('cancel')) return 'cancelled';
    return 'confirmed';
  };

  React.useEffect(() => {
    if (!scrollContainerRef.current) return;
    const today = new Date();
    if (today.getMonth() !== selectedMonth) return;
    scrollContainerRef.current.scrollLeft = (today.getDate() - 1) * 80 - 150;
  }, [selectedMonth]);

  useEffect(() => {
    const year = new Date().getFullYear();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    setSelectedDate((current) => {
      if (current.getMonth() !== selectedMonth || current.getFullYear() !== year) {
        const nextDay = Math.min(current.getDate(), daysInMonth);
        return new Date(year, selectedMonth, nextDay);
      }
      return current;
    });
  }, [selectedMonth]);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        setLoading(true);
        setLoadError('');
        const coach = JSON.parse(localStorage.getItem('coach') || '{}');
        const resolvedCoachId = Number(coachId || coach?.id || localStorage.getItem('coachId') || 0);
        if (!resolvedCoachId) {
          setSessions([]);
          return;
        }

        const year = new Date().getFullYear();
        const start = new Date(year, selectedMonth, 1);
        const end = new Date(year, selectedMonth + 1, 0);
        const startDate = formatDateKey(start);
        const endDate = formatDateKey(end);

        const response = await api.getCoachSchedule(resolvedCoachId, startDate, endDate);
        const rawSessions = Array.isArray(response?.sessions) ? response.sessions : [];

        const mappedSessions = rawSessions.map((session: any) => {
          const sessionDate =
            typeof session.session_date === 'string'
              ? session.session_date.slice(0, 10)
              : session.session_date
                ? formatDateKey(new Date(session.session_date))
                : startDate;
          const timeRaw = session.session_time ? String(session.session_time) : '08:00';
          const time = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : timeRaw;
          const status = normalizeStatus(session.status);

          return {
            id: String(session.id),
            userId: Number(session.user_id || 0),
            clientName: String(session.client_name || 'Client'),
            clientAvatar: String(session.client_name || 'C').trim().slice(0, 2).toUpperCase(),
            time,
            duration: Number(session.duration_minutes || 60),
            type: String(session.workout_name || session.muscle_group || 'Training Session'),
            status,
            date: sessionDate,
          } as Session;
        });

        setSessions(mappedSessions);
      } catch (error) {
        console.error('Failed to load schedule', error);
        setLoadError('Failed to load schedule. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, [coachId, selectedMonth]);

  const get30Days = () => {
    const year = new Date().getFullYear();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => new Date(year, selectedMonth, index + 1));
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isSelected = (date: Date) => date.toDateString() === selectedDate.toDateString();
  const selectedDateKey = formatDateKey(selectedDate);
  const sessionsForDay = sessions.filter((session) => session.date === selectedDateKey);
  const activityByDate = React.useMemo(() => {
    const summary = new Map<string, { picked: number; completed: number; missed: number }>();

    sessions.forEach((session) => {
      const existing = summary.get(session.date) || { picked: 0, completed: 0, missed: 0 };
      if (session.status === 'picked') existing.picked += 1;
      if (session.status === 'completed') existing.completed += 1;
      if (session.status === 'missed' || session.status === 'cancelled') existing.missed += 1;
      summary.set(session.date, existing);
    });

    return summary;
  }, [sessions]);
  const selectedDayActivity = activityByDate.get(selectedDateKey) || { picked: 0, completed: 0, missed: 0 };
  const getSessionsForTime = (hour: number) => sessionsForDay.filter((session) => parseInt(session.time.split(':')[0], 10) === hour);

  const handleDrop = (hour: number) => {
    if (!draggedSession) return;
    setNewTime(`${hour.toString().padStart(2, '0')}:00`);
    setShowConfirmModal(true);
  };

  const confirmReschedule = () => {
    if (!draggedSession) return;
    setSessions((current) => current.map((session) => (
      session.id === draggedSession.id ? { ...session, time: newTime } : session
    )));
    alert(`Session rescheduled for ${draggedSession.clientName} to ${newTime}.`);
    setShowConfirmModal(false);
    setDraggedSession(null);
    setNewTime('');
  };

  const handleUpdateSession = (sessionId: string, updatedTime: string, updatedDuration: number) => {
    setSessions((current) => current.map((session) => (
      session.id === sessionId ? { ...session, time: updatedTime, duration: updatedDuration } : session
    )));
    const session = sessions.find((item) => item.id === sessionId);
    if (session) {
      alert(`Session updated for ${session.clientName} to ${updatedTime} (${updatedDuration} minutes).`);
    }
  };

  const days30 = get30Days();

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#111827]">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-slate-600 hover:text-[#111827]">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-semibold">My Schedule</h1>
        <p className="text-sm text-slate-600">Manage your training sessions</p>
      </div>

      <div className="p-4">
        <div className="mb-4 rounded-[28px] border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-emerald-600" />
            <h2 className="font-semibold">Calendar</h2>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="ml-auto rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
          </div>

          <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {days30.map((day, index) => (
              <button
                key={index}
                onClick={() => setSelectedDate(day)}
                className={`min-w-[74px] rounded-2xl p-3 text-center transition-colors ${
                  isSelected(day)
                    ? 'bg-[#10b981] text-black'
                    : isToday(day)
                      ? 'border border-[#10b981] bg-[#10b981]/20'
                      : 'border border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {(() => {
                  const dayKey = formatDateKey(day);
                  const dayActivity = activityByDate.get(dayKey) || { picked: 0, completed: 0, missed: 0 };

                  return (
                    <>
                      <div className="text-xs text-slate-500">{daysOfWeek[day.getDay()]}</div>
                      <div className="text-lg font-bold">{day.getDate()}</div>
                      <div className="text-xs text-slate-500">{monthNames[day.getMonth()]}</div>
                      <div className="mt-1 flex min-h-[10px] items-center justify-center gap-1">
                        {dayActivity.picked > 0 && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-400"
                            title={`${dayActivity.picked} picked workout${dayActivity.picked === 1 ? '' : 's'}`}
                          />
                        )}
                        {dayActivity.completed > 0 && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                            title={`${dayActivity.completed} completed workout${dayActivity.completed === 1 ? '' : 's'}`}
                          />
                        )}
                        {dayActivity.missed > 0 && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-rose-500"
                            title={`${dayActivity.missed} missed workout${dayActivity.missed === 1 ? '' : 's'}`}
                          />
                        )}
                      </div>
                    </>
                  );
                })()}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <div className="text-sm text-slate-500">{sessionsForDay.length} items</div>
          </div>

          {(selectedDayActivity.picked > 0 || selectedDayActivity.completed > 0 || selectedDayActivity.missed > 0) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {selectedDayActivity.picked > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {selectedDayActivity.picked} picked
                </span>
              )}
              {selectedDayActivity.completed > 0 && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {selectedDayActivity.completed} completed
                </span>
              )}
              {selectedDayActivity.missed > 0 && (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  {selectedDayActivity.missed} missed
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading schedule...</div>
          ) : loadError ? (
            <div className="py-10 text-center text-sm text-rose-500">{loadError}</div>
          ) : sessionsForDay.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500">
                {sessions.length > 0
                  ? 'No sessions on this day. Pick another date with a dot.'
                  : 'No workout activity found for this month.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {hours.map((hour) => {
                const hourSessions = getSessionsForTime(hour);
                const timeStr = `${hour.toString().padStart(2, '0')}:00`;

                return (
                  <div
                    key={hour}
                    className="flex gap-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(hour)}
                  >
                    <div className="w-16 pt-2 text-sm text-slate-500">{timeStr}</div>
                    <div className="flex-1">
                      {hourSessions.length > 0 ? (
                        <div className="space-y-2">
                          {hourSessions.map((session) => (
                            <div
                              key={session.id}
                              draggable
                              onDragStart={() => setDraggedSession(session)}
                              onClick={() => {
                                setSelectedSession(session);
                                setShowDetailsModal(true);
                              }}
                              className={`cursor-pointer rounded-2xl border-l-4 p-3 transition-opacity hover:opacity-85 ${
                                session.status === 'picked'
                                  ? 'border-amber-500 bg-amber-500/10'
                                  : session.status === 'missed' || session.status === 'cancelled'
                                  ? 'border-rose-500 bg-rose-500/10'
                                  : session.status === 'confirmed'
                                  ? 'border-[#10b981] bg-[#10b981]/10'
                                  : session.status === 'pending'
                                    ? 'border-yellow-500 bg-yellow-500/10'
                                    : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#10b981]/20 text-xs font-bold text-[#111827]">
                                    {session.clientAvatar}
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold">{session.clientName}</div>
                                    <div className="text-xs text-slate-500">{session.type}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-xs text-slate-500">
                                    <Clock size={12} />
                                    {session.duration} min
                                  </div>
                                  <div className={`mt-1 rounded px-2 py-0.5 text-xs ${
                                    session.status === 'picked'
                                      ? 'bg-amber-500/15 text-amber-700'
                                      : session.status === 'missed' || session.status === 'cancelled'
                                      ? 'bg-rose-500/15 text-rose-700'
                                      : session.status === 'confirmed'
                                      ? 'bg-green-500/15 text-green-700'
                                      : session.status === 'pending'
                                        ? 'bg-yellow-500/15 text-yellow-700'
                                        : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {session.status}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-12 border-l-2 border-dashed border-slate-200" />
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
          coachId={coachId}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSession(null);
          }}
          onUpdate={handleUpdateSession}
        />
      )}

      {showConfirmModal && draggedSession && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:flex md:items-center md:justify-center">
          <div className="absolute inset-x-0 bottom-0 w-full rounded-t-[28px] border border-slate-200 bg-white p-6 md:relative md:mx-4 md:max-w-md md:rounded-[28px]">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200 md:hidden" />
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle size={24} className="text-yellow-500" />
              <h3 className="text-xl font-semibold">Confirm Reschedule</h3>
            </div>
            <p className="mb-4 text-slate-600">
              Are you sure you want to move this session?
            </p>
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#10b981]/20 text-xs font-bold text-[#111827]">
                  {draggedSession.clientAvatar}
                </div>
                <div>
                  <div className="font-semibold">{draggedSession.clientName}</div>
                  <div className="text-xs text-slate-500">{draggedSession.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">From</span>
                <span className="line-through text-red-400">{draggedSession.time}</span>
                <span className="text-slate-500">to</span>
                <span className="font-semibold text-emerald-600">{newTime}</span>
              </div>
            </div>
            <p className="mb-6 text-xs text-slate-500">
              {draggedSession.clientName} will receive a notification about this change.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setDraggedSession(null);
                  setNewTime('');
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X size={18} />
                Cancel
              </button>
              <button
                onClick={confirmReschedule}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#10b981] py-3 text-sm font-semibold text-black"
              >
                <Check size={18} />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

