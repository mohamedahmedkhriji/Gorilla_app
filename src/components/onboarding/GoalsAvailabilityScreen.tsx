import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { DEFAULT_ONBOARDING_CONFIG, type SelectOption, type WorkoutDaysRange } from '../../config/onboardingConfig';
interface GoalsAvailabilityScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  sessionDurationOptions?: SelectOption[];
  preferredTimeOptions?: SelectOption[];
  workoutDaysRange?: WorkoutDaysRange;
}
export function GoalsAvailabilityScreen({
  onNext,
  onDataChange,
  onboardingData,
  sessionDurationOptions,
  preferredTimeOptions,
  workoutDaysRange,
}: GoalsAvailabilityScreenProps) {
  const durationOptions = sessionDurationOptions?.length
    ? sessionDurationOptions
    : DEFAULT_ONBOARDING_CONFIG.options.sessionDurations;
  const timeOptions = preferredTimeOptions?.length
    ? preferredTimeOptions
    : DEFAULT_ONBOARDING_CONFIG.options.preferredTimes;
  const daysRange = workoutDaysRange || DEFAULT_ONBOARDING_CONFIG.options.workoutDaysRange;

  const normalizeDays = (value: unknown) => {
    const parsed = Number(value);
    const fallback = Number(daysRange.defaultValue ?? 4);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(daysRange.min, Math.min(daysRange.max, Math.round(parsed)));
  };

  const normalizeDuration = (value: unknown) => {
    const normalized = String(value || '').trim();
    const allowed = new Set(durationOptions.map((option) => String(option.value)));
    if (allowed.has(normalized)) return normalized;
    return String(durationOptions[0]?.value || '60');
  };

  const normalizeTime = (value: unknown) => {
    const normalized = String(value || '').trim().toLowerCase();
    const allowed = new Set(timeOptions.map((option) => String(option.value).toLowerCase()));
    if (allowed.has(normalized)) return normalized;
    return String(timeOptions[0]?.value || 'evening');
  };

  const [days, setDays] = useState(normalizeDays(onboardingData?.workoutDays));
  const [duration, setDuration] = useState(normalizeDuration(onboardingData?.sessionDuration));
  const [time, setTime] = useState(normalizeTime(onboardingData?.preferredTime));

  useEffect(() => {
    setDays(normalizeDays(onboardingData?.workoutDays));
  }, [daysRange, onboardingData?.workoutDays]);

  useEffect(() => {
    setDuration(normalizeDuration(onboardingData?.sessionDuration));
  }, [durationOptions, onboardingData?.sessionDuration]);

  useEffect(() => {
    setTime(normalizeTime(onboardingData?.preferredTime));
  }, [timeOptions, onboardingData?.preferredTime]);

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
            min={daysRange.min}
            max={daysRange.max}
            value={days}
            onChange={(e) => {
              const nextDays = parseInt(e.target.value, 10);
              setDays(nextDays);
            }}
            className="w-full h-2 bg-card rounded-lg appearance-none cursor-pointer accent-accent" />

          <div className="flex justify-between text-xs text-text-tertiary px-1">
            {(daysRange.labels && daysRange.labels.length
              ? daysRange.labels
              : Array.from({ length: daysRange.max - daysRange.min + 1 }, (_, idx) => daysRange.min + idx)
            ).map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </div>
        <Select
          label="Session Duration"
          value={duration}
          onValueChange={(nextValue) => {
            setDuration(nextValue);
          }}
          options={durationOptions} />


        <Select
          label="Preferred Time"
          value={time}
          onValueChange={(nextValue) => {
            setTime(nextValue);
          }}
          options={timeOptions} />

      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>Next Step</Button>
    </div>);

}
