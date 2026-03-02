import React from 'react';
import { Card } from '../ui/Card';
import { Calendar, Clock } from 'lucide-react';
export function WorkoutHistory() {
  const history = [
  {
    name: 'Upper Power',
    date: 'Yesterday',
    duration: '45m',
    vol: '12.4t'
  },
  {
    name: 'Legs Hypertrophy',
    date: '3 days ago',
    duration: '60m',
    vol: '18.2t'
  },
  {
    name: 'Pull Strength',
    date: '5 days ago',
    duration: '50m',
    vol: '10.1t'
  }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
          History
        </h3>
        <div className="flex gap-2">
          <button className="text-xs font-bold text-white">All</button>
          <button className="text-xs font-medium text-text-tertiary">
            Week
          </button>
          <button className="text-xs font-medium text-text-tertiary">
            Month
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {history.map((workout, i) =>
        <Card key={i} className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white">{workout.name}</h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <Calendar size={10} /> {workout.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {workout.duration}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-accent">{workout.vol}</div>
              <div className="text-[10px] text-text-tertiary uppercase">
                Volume
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>);

}
