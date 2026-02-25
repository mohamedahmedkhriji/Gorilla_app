import React, { useState } from 'react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Trophy, Calendar, Activity, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
interface FriendProfileProps {
  onBack: () => void;
}
export function FriendProfile({ onBack }: FriendProfileProps) {
  const [showInvite, setShowInvite] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState({ hour: 9, minute: 0 });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const isSameDay = (date1: Date | null, date2: Date) => {
    if (!date1) return false;
    return date1.getDate() === date2.getDate() && 
           date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
  };

  const handleSendInvite = async () => {
    if (!selectedDate) return;
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const dateStr = selectedDate.toISOString().split('T')[0];
    const timeStr = `${selectedTime.hour.toString().padStart(2, '0')}:${selectedTime.minute.toString().padStart(2, '0')}`;
    await api.sendInvitation(user.id, 2, dateStr, timeStr);
    setShowInvite(false);
    alert('Invitation sent!');
  };
  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title="Friend Profile" onBack={onBack} />
      </div>

      <div className="px-6 flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white mb-4">
          SC
        </div>
        <h2 className="text-2xl font-bold text-white">Sarah Connor</h2>
        <div className="flex items-center gap-2 mt-2">
          <Trophy size={16} className="text-yellow-500" />
          <span className="text-sm text-text-secondary">
            Iron Back • Level 8
          </span>
        </div>
      </div>

      <div className="px-6 space-y-6">
        <button 
          onClick={() => setShowInvite(true)}
          className="w-full bg-accent text-black font-bold py-3 rounded-xl hover:bg-accent/90 transition-colors">
          Invite to Gym Day
        </button>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
            Badges
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) =>
            <div
              key={i}
              className="w-16 h-16 rounded-full bg-card border border-white/10 flex items-center justify-center shrink-0">

                <Trophy
                size={24}
                className={i === 1 ? 'text-accent' : 'text-text-tertiary'} />

              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
            Training Split
          </h3>
          <Card className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white">Push</span>
              <span className="text-text-tertiary">Mon, Thu</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white">Pull</span>
              <span className="text-text-tertiary">Tue, Fri</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white">Legs</span>
              <span className="text-text-tertiary">Wed, Sat</span>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
            Recent Activity
          </h3>
          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <Activity size={20} />
            </div>
            <div>
              <div className="font-bold text-white">Leg Day Destruction</div>
              <div className="text-xs text-text-secondary">
                Yesterday • 12,400kg Volume
              </div>
            </div>
          </Card>
        </div>
      </div>

      {showInvite && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={() => setShowInvite(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-white">Invite to Gym</h3>
              <button onClick={() => setShowInvite(false)} className="text-text-secondary hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Calendar */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button 
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-1 hover:bg-white/5 rounded">
                    <ChevronLeft size={20} className="text-text-secondary" />
                  </button>
                  <span className="text-white font-bold">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button 
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-1 hover:bg-white/5 rounded">
                    <ChevronRight size={20} className="text-text-secondary" />
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs text-text-tertiary font-bold py-2">{day}</div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: getDaysInMonth(currentMonth).firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: getDaysInMonth(currentMonth).daysInMonth }).map((_, i) => {
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                    const selected = isSameDay(selectedDate, date);
                    const today = isToday(date);
                    
                    return (
                      <button
                        key={i}
                        disabled={isPast}
                        onClick={() => setSelectedDate(date)}
                        className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                          selected ? 'bg-accent text-black' : 
                          today ? 'bg-white/10 text-white' :
                          isPast ? 'text-text-tertiary cursor-not-allowed' : 
                          'text-white hover:bg-white/5'
                        }`}>
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Time Picker */}
              <div>
                <label className="text-sm text-text-secondary mb-3 block">Time</label>
                <div className="flex gap-3 items-center justify-center">
                  <div className="flex flex-col items-center">
                    <button 
                      onClick={() => setSelectedTime(t => ({ ...t, hour: t.hour === 23 ? 0 : t.hour + 1 }))}
                      className="p-2 hover:bg-white/5 rounded">
                      <ChevronLeft size={20} className="text-text-secondary rotate-90" />
                    </button>
                    <div className="bg-background rounded-lg px-4 py-3 min-w-[60px] text-center">
                      <span className="text-2xl font-bold text-white">{selectedTime.hour.toString().padStart(2, '0')}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedTime(t => ({ ...t, hour: t.hour === 0 ? 23 : t.hour - 1 }))}
                      className="p-2 hover:bg-white/5 rounded">
                      <ChevronRight size={20} className="text-text-secondary rotate-90" />
                    </button>
                  </div>
                  
                  <span className="text-2xl font-bold text-white">:</span>
                  
                  <div className="flex flex-col items-center">
                    <button 
                      onClick={() => setSelectedTime(t => ({ ...t, minute: t.minute === 45 ? 0 : t.minute + 15 }))}
                      className="p-2 hover:bg-white/5 rounded">
                      <ChevronLeft size={20} className="text-text-secondary rotate-90" />
                    </button>
                    <div className="bg-background rounded-lg px-4 py-3 min-w-[60px] text-center">
                      <span className="text-2xl font-bold text-white">{selectedTime.minute.toString().padStart(2, '0')}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedTime(t => ({ ...t, minute: t.minute === 0 ? 45 : t.minute - 15 }))}
                      className="p-2 hover:bg-white/5 rounded">
                      <ChevronRight size={20} className="text-text-secondary rotate-90" />
                    </button>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleSendInvite}
                disabled={!selectedDate}
                className="w-full bg-accent text-black font-bold py-3 rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);

}
