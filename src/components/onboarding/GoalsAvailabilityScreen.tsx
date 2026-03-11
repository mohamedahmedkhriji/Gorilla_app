import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
interface GoalsAvailabilityScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}
export function GoalsAvailabilityScreen({
  onNext,
  onDataChange,
  onboardingData,
}: GoalsAvailabilityScreenProps) {
  const initialDays = Number(onboardingData?.workoutDays || 4);
  const [days, setDays] = useState(Math.max(2, Math.min(6, Number.isFinite(initialDays) ? Math.round(initialDays) : 4)));
  const [duration, setDuration] = useState(String(onboardingData?.sessionDuration || '60'));
  const [time, setTime] = useState(String(onboardingData?.preferredTime || 'evening'));

  const handleNext = () => {
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Availability</h2>
        <p className="text-text-secondary">How often can you train?</p>
      </div>

      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <label className="text-sm font-medium text-text-secondary ml-1">
              Days per week
            </label>
            <span className="text-2xl font-light text-accent">{days} days</span>
          </div>
          <input
            type="range"
            min="2"
            max="6"
            value={days}
            onChange={(e) => {
              const nextDays = parseInt(e.target.value, 10);
              setDays(nextDays);
              onDataChange?.({ workoutDays: nextDays });
            }}
            className="w-full h-2 bg-card rounded-lg appearance-none cursor-pointer accent-accent" />

          <div className="flex justify-between text-xs text-text-tertiary px-1">
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
            <span>6</span>
          </div>
        </div>
        <Select
          label="Session Duration"
          value={duration}
          onChange={(e) => {
            const nextValue = e.target.value;
            setDuration(nextValue);
            onDataChange?.({ sessionDuration: nextValue });
          }}
          options={[
          {
            value: '30',
            label: '30 minutes'
          },
          {
            value: '45',
            label: '45 minutes'
          },
          {
            value: '60',
            label: '60 minutes'
          },
          {
            value: '90',
            label: '90 minutes'
          }]
          } />


        <Select
          label="Preferred Time"
          value={time}
          onChange={(e) => {
            const nextValue = e.target.value;
            setTime(nextValue);
            onDataChange?.({ preferredTime: nextValue });
          }}
          options={[
          {
            value: 'morning',
            label: 'Morning'
          },
          {
            value: 'afternoon',
            label: 'Afternoon'
          },
          {
            value: 'evening',
            label: 'Evening'
          }]
          } />

      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>Next Step</Button>
    </div>);

}
