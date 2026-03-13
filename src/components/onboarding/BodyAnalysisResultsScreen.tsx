import React, { useMemo } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CalendarDays, Clock3, Dumbbell, Layers3, MapPin } from 'lucide-react';

type AnalysisInput = {
  age?: number;
  gender?: string;
  weight?: number;
  experienceLevel?: string;
  primaryGoal?: string;
  fitnessGoal?: string;
  workoutDays?: number;
  workoutSplitPreference?: string;
  workoutSplitLabel?: string;
  sessionDuration?: number | string;
  preferredTime?: string;
  gymName?: string;
  [key: string]: unknown;
};

type CoachPlan = {
  planName?: string;
  summary?: string;
  goalMatch?: string;
  usedImages?: number;
};

type CustomAdvice = {
  summary?: string;
  strengths?: string[];
  recommendations?: string[];
  metrics?: {
    trainingDays?: number;
    totalExercises?: number;
    avgExercisesPerDay?: number;
  };
};

type AssignedProgram = {
  daysPerWeek?: number;
  goal?: string;
  programType?: string;
};

interface BodyAnalysisResultsScreenProps {
  onNext: () => void;
  onboardingData?: AnalysisInput;
  userData?: AnalysisInput;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseStoredJson = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalize = (value: unknown) => String(value || '').trim();
const normalizeLower = (value: unknown) => normalize(value).toLowerCase();

const toTitleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1).toLowerCase()}`)
    .join(' ');

const formatGender = (value: unknown) => {
  const normalized = normalizeLower(value);
  if (!normalized) return '-';
  return toTitleCase(normalized);
};

const formatGoal = (value: unknown) => {
  const normalized = normalizeLower(value);
  if (!normalized) return 'General fitness';
  if (normalized === 'fat_loss') return 'Fat loss';
  if (normalized === 'muscle_gain') return 'Build muscle';
  return toTitleCase(normalized);
};

const formatLevel = (value: unknown) => {
  const normalized = normalizeLower(value);
  if (!normalized) return 'Intermediate';
  return toTitleCase(normalized);
};

const formatSessionDuration = (value: unknown) => {
  const parsed = toNumber(value);
  if (parsed == null || parsed <= 0) return '-';
  return `${Math.round(parsed)} min`;
};

const formatPreferredTime = (value: unknown) => {
  const normalized = normalizeLower(value);
  if (!normalized) return '-';
  if (normalized === 'morning') return 'Morning';
  if (normalized === 'afternoon') return 'Afternoon';
  if (normalized === 'evening') return 'Evening';
  return toTitleCase(normalized);
};

const mapProgramTypeToSplit = (value: unknown) => {
  const normalized = normalizeLower(value);
  if (!normalized) return '';
  if (normalized === 'full_body') return 'Full Body Focus';
  if (normalized === 'upper_lower') return 'Upper / Lower';
  if (normalized === 'push_pull_legs') return 'Push / Pull / Legs';
  if (normalized === 'hybrid') return 'Push / Pull / Legs + Upper / Lower';
  if (normalized === 'custom') return 'Custom';
  return toTitleCase(normalized);
};

const formatSplit = (label: unknown, preference: unknown, fallbackProgramType: unknown) => {
  const directLabel = normalize(label);
  if (directLabel) return directLabel;

  const normalizedPreference = normalizeLower(preference);
  if (normalizedPreference === 'auto') return 'Coach Selected Split';
  if (normalizedPreference) return mapProgramTypeToSplit(normalizedPreference);

  return mapProgramTypeToSplit(fallbackProgramType) || 'Coach Selected Split';
};

export function BodyAnalysisResultsScreen({
  onNext,
  onboardingData,
  userData,
}: BodyAnalysisResultsScreenProps) {
  const input = onboardingData || userData || {};

  const coachPlan = useMemo<CoachPlan | null>(
    () => parseStoredJson('onboardingCoachPlan') as CoachPlan | null,
    [],
  );

  const customAdvice = useMemo<CustomAdvice | null>(
    () => parseStoredJson('onboardingCustomAdvice') as CustomAdvice | null,
    [],
  );

  const assignedProgram = useMemo<AssignedProgram | null>(
    () => parseStoredJson('assignedProgramTemplate') as AssignedProgram | null,
    [],
  );

  const appUser = useMemo<Record<string, unknown>>(() => {
    const fromAppUser = parseStoredJson('appUser');
    if (fromAppUser && typeof fromAppUser === 'object') return fromAppUser as Record<string, unknown>;
    const fromUser = parseStoredJson('user');
    if (fromUser && typeof fromUser === 'object') return fromUser as Record<string, unknown>;
    return {};
  }, []);

  const firstName = useMemo(() => {
    const fullName = normalize(appUser?.name);
    if (!fullName) return 'Athlete';
    return fullName.split(' ')[0];
  }, [appUser]);

  const age = toNumber(input.age);
  const weight = toNumber(input.weight);
  const gender = formatGender(input.gender);

  const trainingDays = Math.max(
    2,
    Math.min(6, Number(assignedProgram?.daysPerWeek || toNumber(input.workoutDays) || 4)),
  );
  const level = formatLevel(input.experienceLevel);
  const split = formatSplit(
    input.workoutSplitLabel,
    input.workoutSplitPreference,
    assignedProgram?.programType,
  );
  const goal = formatGoal(input.fitnessGoal || input.primaryGoal || assignedProgram?.goal);
  const sessionDuration = formatSessionDuration(input.sessionDuration ?? appUser?.session_duration_minutes);
  const preferredTime = formatPreferredTime(input.preferredTime ?? appUser?.preferred_time);

  const gymId = toNumber(appUser?.gym_id);
  const gymLabel = normalize(input.gymName) || (gymId ? `Gym #${gymId}` : 'Not selected');
  const summaryText =
    normalize(customAdvice?.summary)
    || normalize(coachPlan?.goalMatch)
    || normalize(coachPlan?.summary)
    || `A personalized ${goal.toLowerCase()} plan built around your routine and recovery.`;
  const planLabel = normalize(coachPlan?.planName) || 'RepSet AI';
  const planHeadline = goal === 'Build muscle' ? 'Build and tone muscle' : goal;

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-[1.9rem] leading-tight font-semibold text-white">
          Congratulations, {firstName}! Your <span className="text-accent">AI-powered</span> coach is ready.
        </h2>
      </div>

      <Card className="rounded-2xl border border-white/10 bg-[#091533]/80 p-4">
        <p className="text-base font-semibold text-white mb-3">About you</p>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-white/10 bg-[#0c1c43]/85 p-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Weight</p>
            <p className="text-sm text-white mt-1">{weight != null ? `${weight.toFixed(1)} kg` : '-'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c1c43]/85 p-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Age</p>
            <p className="text-sm text-white mt-1">{age != null ? `${Math.round(age)}` : '-'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c1c43]/85 p-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Gender</p>
            <p className="text-sm text-white mt-1">{gender}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <p className="text-base font-semibold text-white">Built for you</p>
        <Card className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#0a1a3d] p-0">
          <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.02),rgba(255,255,255,0),rgba(191,255,0,0.09))]" />
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent/12 blur-3xl" />
          <div className="relative p-5 space-y-4">
            <p className="text-3xl font-extrabold uppercase tracking-[0.08em] text-white">{planLabel}</p>
            <div className="space-y-1">
              <h3 className="text-[1.55rem] leading-tight font-semibold text-white">{planHeadline}</h3>
              <p className="text-sm text-text-secondary">{summaryText}</p>
            </div>

            {Array.isArray(customAdvice?.recommendations) && customAdvice?.recommendations.length > 0 && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">AI Advice</p>
                <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
                  {customAdvice.recommendations.slice(0, 3).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <CalendarDays size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">Sessions</span>
                </div>
                <p className="text-sm text-white mt-1">{trainingDays}/week</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Dumbbell size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">Fitness level</span>
                </div>
                <p className="text-sm text-white mt-1">{level}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <MapPin size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">Location</span>
                </div>
                <p className="text-sm text-white mt-1">{gymLabel}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Layers3 size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">Workout split</span>
                </div>
                <p className="text-sm text-white mt-1">{split}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Clock3 size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">Session duration</span>
                </div>
                <p className="text-sm text-white mt-1">{sessionDuration}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <CalendarDays size={14} />
                  <span className="text-[11px] uppercase tracking-[0.08em]">Preferred time</span>
                </div>
                <p className="text-sm text-white mt-1">{preferredTime}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} className="uppercase tracking-[0.11em]">
        Get My Plan
      </Button>
    </div>
  );
}
