import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import { api } from '../../services/api';

interface TodaysActivityProps {
  onBack: () => void;
}

export const TodaysActivity: React.FC<TodaysActivityProps> = ({ onBack }) => {
  const [activities, setActivities] = useState<Array<{
    id: string;
    name: string;
    avatar: string;
    workout: string;
    time: string;
    status: 'completed' | 'in-progress' | 'scheduled';
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const formatDateKey = (date: Date) => date.toLocaleDateString('en-CA');
  const toInitials = (name: string) => name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  const normalizeStatus = (rawStatus: string | null | undefined, dateKey: string) => {
    const key = String(rawStatus || '').toLowerCase();
    if (key.includes('progress')) return 'in-progress';
    if (key.includes('complete')) return 'completed';
    if (key.includes('pending')) return 'scheduled';
    if (key.includes('confirm')) return 'scheduled';
    return dateKey < formatDateKey(new Date()) ? 'completed' : 'scheduled';
  };

  const formatWorkoutLabel = (workoutName?: string | null, muscleGroup?: string | null) => {
    const rawName = String(workoutName || '').trim();
    if (rawName) return rawName;
    const rawMuscle = String(muscleGroup || '').trim();
    if (!rawMuscle) return 'Training Session';

    const normalized = rawMuscle.toLowerCase();
    const hasUpper = /(chest|back|shoulder|arm|bicep|tricep|upper)/.test(normalized);
    const hasLower = /(leg|quad|hamstring|glute|calf|lower)/.test(normalized);
    if (/(full)/.test(normalized)) return 'Full Body';
    if (/(cardio|conditioning)/.test(normalized)) return 'Cardio';
    if (hasUpper && hasLower) return 'Full Body';
    if (hasUpper) return 'Upper Body';
    if (hasLower) return 'Lower Body';

    return rawMuscle
      .split(/[,|]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(', ');
  };

  const formatTimeLabel = (timeValue?: string | null) => {
    if (!timeValue) return '—';
    const clean = String(timeValue).slice(0, 5);
    const [hourRaw, minuteRaw] = clean.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw || 0);
    if (!Number.isFinite(hour)) return clean;
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const loadToday = async () => {
      try {
        setLoading(true);
        setLoadError('');
        const coach = JSON.parse(localStorage.getItem('coach') || '{}');
        const coachId = Number(coach?.id || localStorage.getItem('coachId') || 0);
        if (!coachId) {
          setActivities([]);
          return;
        }

        const todayKey = formatDateKey(new Date());
        const response = await api.getCoachSchedule(coachId, todayKey, todayKey);
        const rawSessions = Array.isArray(response?.sessions) ? response.sessions : [];

        const mapped = rawSessions.map((session: any) => {
          const sessionDate = typeof session.session_date === 'string'
            ? session.session_date.slice(0, 10)
            : session.session_date
              ? formatDateKey(new Date(session.session_date))
              : todayKey;
          const name = String(session.client_name || 'Client');
          const status = normalizeStatus(session.status, sessionDate);

          return {
            id: String(session.id),
            name,
            avatar: toInitials(name),
            workout: formatWorkoutLabel(session.workout_name, session.muscle_group),
            time: formatTimeLabel(session.session_time),
            status,
          };
        });

        setActivities(mapped);
      } catch (error) {
        console.error('Failed to load today activity', error);
        setLoadError('Failed to load today activity.');
      } finally {
        setLoading(false);
      }
    };

    loadToday();
  }, []);

  const activeCountLabel = useMemo(() => {
    if (loading) return 'Loading...';
    return `${activities.length} clients active today`;
  }, [activities.length, loading]);

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#111827]">
      <div className="border-b border-slate-200 bg-white p-4">
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-slate-600 hover:text-[#111827]">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">Today's Activity</h1>
        <p className="text-slate-600 text-sm">{activeCountLabel}</p>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Loading today&apos;s sessions...
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">
            {loadError}
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No sessions scheduled for today.
          </div>
        ) : (
          activities.map(activity => (
            <div key={activity.id} className="bg-white rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#10b981]/20 flex items-center justify-center text-[#111827]">
                    <span className="font-bold">{activity.avatar}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{activity.name}</p>
                    <p className="text-sm text-slate-500">{activity.workout}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Clock size={14} />
                    {activity.time}
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    activity.status === 'completed'
                      ? 'bg-green-500/15 text-green-700'
                      : activity.status === 'in-progress'
                        ? 'bg-yellow-500/15 text-yellow-700'
                        : 'bg-blue-500/15 text-blue-700'
                  }`}>
                    {activity.status === 'completed' ? 'Completed' : activity.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

