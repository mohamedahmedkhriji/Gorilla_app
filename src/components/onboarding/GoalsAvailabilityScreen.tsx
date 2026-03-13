import React, { useEffect, useState } from 'react';
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
  const normalizeDays = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 4;
    return Math.max(2, Math.min(6, Math.round(parsed)));
  };

  const normalizeDuration = (value: unknown) => {
    const normalized = String(value || '').trim();
    if (['30', '45', '60', '90'].includes(normalized)) return normalized;
    return '60';
  };

  const normalizeTime = (value: unknown) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (['morning', 'afternoon', 'evening'].includes(normalized)) return normalized;
    return 'evening';
  };

  const [days, setDays] = useState(normalizeDays(onboardingData?.workoutDays));
  const [duration, setDuration] = useState(normalizeDuration(onboardingData?.sessionDuration));
  const [time, setTime] = useState(normalizeTime(onboardingData?.preferredTime));

  useEffect(() => {
    setDays(normalizeDays(onboardingData?.workoutDays));
  }, [onboardingData?.workoutDays]);

  useEffect(() => {
    setDuration(normalizeDuration(onboardingData?.sessionDuration));
  }, [onboardingData?.sessionDuration]);

  useEffect(() => {
    setTime(normalizeTime(onboardingData?.preferredTime));
  }, [onboardingData?.preferredTime]);

  useEffect(() => {
    onDataChange?.({
      workoutDays: days,
      sessionDuration: duration,
      preferredTime: time,
    });
  }, [days, duration, onDataChange, time]);

  const handleNext = () => {
    onDataChange?.({
      workoutDays: days,
      sessionDuration: duration,
      preferredTime: time,
    });
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
          onValueChange={(nextValue) => {
            setDuration(nextValue);
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
          onValueChange={(nextValue) => {
            setTime(nextValue);
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
