import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';

interface PresetProgramScreenProps {
  onBack: () => void;
  onSaved: () => void;
  onBuildCustom: () => void;
}

interface TemplateExercise {
  exerciseName: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

interface TemplateWorkoutDay {
  dayName: string;
  workoutName: string;
  workoutType: string;
  exercises: TemplateExercise[];
}

interface ProgramTemplate {
  id: 'ppl' | 'splitpush' | 'upperlower';
  title: string;
  subtitle: string;
  daysPerWeek: number;
  selectedDays: string[];
  weeklyWorkouts: TemplateWorkoutDay[];
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const DAY_ORDER: string[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'ppl',
    title: 'PPL',
    subtitle: 'Classic Push/Pull/Legs done 6 days for high volume.',
    daysPerWeek: 6,
    selectedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Push A',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Seated Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Pull A',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Pull Up', sets: 4, reps: '6-10', restSeconds: 120 },
          { exerciseName: 'Barbell Row', sets: 3, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Face Pull', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'EZ Bar Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'wednesday',
        workoutName: 'Legs A',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8', restSeconds: 150 },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Push B',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Incline Barbell Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Cable Chest Fly', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Upright Row', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Overhead Triceps Extension', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Pull B',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Deadlift', sets: 3, reps: '4-6', restSeconds: 150 },
          { exerciseName: 'Chest Supported Row', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Rear Delt Fly', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'saturday',
        workoutName: 'Legs B',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Front Squat', sets: 4, reps: '5-8', restSeconds: 150 },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Bulgarian Split Squat', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 75 },
          { exerciseName: 'Seated Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
    ],
  },
  {
    id: 'splitpush',
    title: 'SP',
    subtitle: 'Split Push (5-day hybrid split).',
    daysPerWeek: 5,
    selectedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Push Strength',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '5-6', restSeconds: 150 },
          { exerciseName: 'Overhead Press', sets: 4, reps: '5-6', restSeconds: 120 },
          { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Cable Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Weighted Dips', sets: 3, reps: '6-8', restSeconds: 90 },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Pull',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Pull Up', sets: 4, reps: '6-10', restSeconds: 120 },
          { exerciseName: 'Barbell Row', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Single Arm Dumbbell Row', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Face Pull', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Incline Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'wednesday',
        workoutName: 'Legs',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8', restSeconds: 150 },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Push Hypertrophy',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Incline Barbell Press', sets: 4, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Machine Chest Press', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Lateral Raise', sets: 4, reps: '12-20', restSeconds: 60 },
          { exerciseName: 'Triceps Rope Pushdown', sets: 3, reps: '10-15', restSeconds: 60 },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Upper Balance',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Flat Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Chest Supported Row', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Rear Delt Fly', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Cable Curl', sets: 2, reps: '12-15', restSeconds: 60 },
        ],
      },
    ],
  },
  {
    id: 'upperlower',
    title: 'UL',
    subtitle: 'Upper / Lower (balanced 4-day split).',
    daysPerWeek: 4,
    selectedDays: ['monday', 'tuesday', 'thursday', 'friday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Upper A',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Barbell Row', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Seated Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Lower A',
        workoutType: 'Lower Body',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8', restSeconds: 150 },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Walking Lunge', sets: 3, reps: '10/leg', restSeconds: 90 },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Upper B',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Incline Dumbbell Press', sets: 4, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Chest Supported Row', sets: 4, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'EZ Bar Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Lower B',
        workoutType: 'Lower Body',
        exercises: [
          { exerciseName: 'Front Squat', sets: 4, reps: '6-8', restSeconds: 150 },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 75 },
          { exerciseName: 'Seated Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
    ],
  },
];

const clampWorkoutDays = (value: number) => {
  if (!Number.isFinite(value)) return 4;
  return Math.max(2, Math.min(6, Math.round(value)));
};

const recommendTemplateByDays = (daysPerWeek: number): ProgramTemplate['id'] => {
  if (daysPerWeek >= 6) return 'ppl';
  if (daysPerWeek >= 5) return 'splitpush';
  return 'upperlower';
};

const mapAiWorkoutTypesToTemplate = (
  suggestedWorkoutTypes: string[],
  workoutDays: number,
): ProgramTemplate['id'] => {
  const joined = suggestedWorkoutTypes.join(' ').toLowerCase();
  if (/upper|lower/.test(joined)) return 'upperlower';
  if (/push|pull|legs|ppl/.test(joined)) {
    return workoutDays >= 6 ? 'ppl' : 'splitpush';
  }
  return recommendTemplateByDays(workoutDays);
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

export function PresetProgramScreen({ onBack, onSaved, onBuildCustom }: PresetProgramScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [workoutDays, setWorkoutDays] = useState(4);
  const [recommendedTemplateId, setRecommendedTemplateId] = useState<ProgramTemplate['id']>('upperlower');
  const [selectedTemplateId, setSelectedTemplateId] = useState<ProgramTemplate['id'] | null>(null);
  const [aiRecommendationNote, setAiRecommendationNote] = useState('AI is preparing your best split recommendation.');

  const templateById = useMemo(() => {
    const map = new Map<ProgramTemplate['id'], ProgramTemplate>();
    PROGRAM_TEMPLATES.forEach((template) => {
      map.set(template.id, template);
    });
    return map;
  }, []);

  const selectedTemplate = selectedTemplateId ? (templateById.get(selectedTemplateId) || null) : null;
  const selectedTemplateDays = useMemo(
    () => (selectedTemplate
      ? [...selectedTemplate.selectedDays].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
      : []),
    [selectedTemplate],
  );

  useEffect(() => {
    const bootstrap = async () => {
      const user = readStoredUser();
      const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
      if (!userId) return;

      try {
        const progress = await api.getProgramProgress(userId);
        const fromProgram = Number(
          progress?.program?.daysPerWeek
          ?? progress?.summary?.workoutsPlannedThisWeek
          ?? 0,
        );
        const fromLocalUser = Number(
          user?.workoutDays
          ?? user?.workout_days_per_week
          ?? user?.daysPerWeek
          ?? user?.days_per_week
          ?? 0,
        );
        const resolvedDays = clampWorkoutDays(fromProgram > 0 ? fromProgram : fromLocalUser);
        let recommended = recommendTemplateByDays(resolvedDays);
        let recommendationNote = `AI fallback: selected from your ${resolvedDays} training days/week.`;

        try {
          const insights = await api.getOnboardingInsights({
            age: user?.age ?? null,
            gender: user?.gender ?? null,
            weightKg: user?.weightKg ?? user?.weight_kg ?? null,
            heightCm: user?.heightCm ?? user?.height_cm ?? null,
            restingBpm: user?.restingBpm ?? user?.resting_bpm ?? null,
            workoutFrequency: resolvedDays,
          });

          const suggestedWorkoutTypes = Array.isArray(insights?.interpretation?.suggestedWorkoutTypes)
            ? insights.interpretation.suggestedWorkoutTypes.map((item: unknown) => String(item || '').trim()).filter(Boolean)
            : [];
          const suggestedLevel = String(insights?.interpretation?.suggestedExperienceLevel || '').trim();

          recommended = mapAiWorkoutTypesToTemplate(suggestedWorkoutTypes, resolvedDays);
          recommendationNote = suggestedWorkoutTypes.length
            ? `AI signals: ${suggestedWorkoutTypes.slice(0, 2).join(', ')}${suggestedLevel ? ` | level: ${suggestedLevel}` : ''}.`
            : `AI analyzed your profile and selected this split for ${resolvedDays} days/week.`;
        } catch (aiError) {
          console.error('Failed to compute AI recommendation, using fallback:', aiError);
        }

        setWorkoutDays(resolvedDays);
        setAiRecommendationNote(recommendationNote);
        setRecommendedTemplateId(recommended);
      } catch (fetchError) {
        console.error('Failed to infer workout-day recommendation:', fetchError);
      }
    };

    void bootstrap();
  }, []);

  const handleSavePlan = async () => {
    setError(null);
    setSuccess(null);
    if (!selectedTemplate) {
      setError('Select a plan card first (PPL, SP, or UL).');
      return;
    }
    const user = readStoredUser();
    const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
    if (!userId) {
      setError('No active user session found.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        planName: `${selectedTemplate.title} 2-Month Program`,
        description: `${selectedTemplate.title} template selected from preset programs`,
        cycleWeeks: 8,
        selectedDays: selectedTemplate.selectedDays,
        weeklyWorkouts: selectedTemplate.weeklyWorkouts.map((day) => ({
          dayName: day.dayName,
          workoutName: day.workoutName,
          workoutType: day.workoutType,
          exercises: day.exercises.map((exercise) => ({
            exerciseName: exercise.exerciseName,
            sets: exercise.sets,
            reps: exercise.reps,
            restSeconds: exercise.restSeconds,
          })),
        })),
      };

      const result = await api.saveCustomProgram(userId, payload);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save program');
      }

      localStorage.removeItem('recoveryNeedsUpdate');
      setSuccess(`${selectedTemplate.title} saved as your active plan.`);
      window.setTimeout(() => onSaved(), 500);
    } catch (saveError) {
      console.error('Failed to save preset plan:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save program.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Customized Programs" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 pt-2 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 text-green-300 text-sm p-3">
            {success}
          </div>
        )}

        <div className="bg-card border border-white/10 rounded-xl p-4">
          <div className="text-sm text-text-secondary">Recommended by AI</div>
          <div className="text-white mt-1">
            AI recommends <span className="font-semibold">{templateById.get(recommendedTemplateId)?.title || 'UL'}</span> for your profile.
          </div>
          <div className="text-xs text-text-secondary mt-1">
            {aiRecommendationNote}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PROGRAM_TEMPLATES.map((template) => {
            const isSelected = selectedTemplateId === template.id;
            const isRecommended = recommendedTemplateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-white/10 bg-card hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-white font-semibold">{template.title}</div>
                  {isRecommended && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded border border-accent/50 text-accent bg-accent/10">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary mt-1">{template.subtitle}</div>
                <div className="text-xs text-text-tertiary mt-3">{template.daysPerWeek} days/week</div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onBuildCustom}
            className="text-left rounded-xl border border-white/10 bg-card p-4 hover:bg-white/5 transition-colors"
          >
            <div className="text-white font-semibold">Build Manual Plan</div>
            <div className="text-xs text-text-secondary mt-1">
              Create your own plan, then confirm it or send it to coach for validation.
            </div>
            <div className="text-xs text-text-tertiary mt-3">Custom builder</div>
          </button>
        </div>

        {!selectedTemplate && (
          <div className="bg-card border border-white/10 rounded-xl p-4 text-sm text-text-secondary">
            Days and program details are hidden until you click a plan card.
          </div>
        )}

        {selectedTemplate && (
          <>
            <div className="bg-card border border-white/10 rounded-xl p-4">
              <div className="text-sm text-text-secondary">Available Days (auto from selected plan)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTemplateDays.map((day) => (
                  <span
                    key={`selected-day-${day}`}
                    className="text-xs px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-accent"
                  >
                    {DAY_LABELS[day] || day}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-3 border bg-accent/5 border-accent/40">
              <div>
                <div className="text-white font-semibold">{selectedTemplate.title} - 2 Month Program</div>
                <div className="text-xs text-text-secondary mt-1">Weekly split below repeats for 8 weeks.</div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={`${selectedTemplate.id}-week-${index + 1}`}
                    className="text-center text-xs rounded-lg border border-white/10 bg-background py-2 text-text-secondary"
                  >
                    W{index + 1}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {selectedTemplate.weeklyWorkouts.map((workout) => (
                  <div key={`${selectedTemplate.id}-${workout.dayName}`} className="rounded-lg border border-white/10 bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-white text-sm font-medium">
                        {DAY_LABELS[workout.dayName] || workout.dayName} - {workout.workoutName}
                      </div>
                      <div className="text-[10px] uppercase text-text-tertiary">{workout.workoutType}</div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {workout.exercises.map((exercise) => (
                        <div key={`${selectedTemplate.id}-${workout.dayName}-${exercise.exerciseName}`} className="text-xs text-text-secondary">
                          <span className="text-white">{exercise.exerciseName}</span>
                          {' | '}
                          {exercise.sets} sets
                          {' | '}
                          {exercise.reps}
                          {' | '}
                          {exercise.restSeconds}s rest
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => void handleSavePlan()}
            disabled={isSaving || !selectedTemplate}
            className="w-full bg-accent text-black font-semibold rounded-xl p-3 hover:bg-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save This Plan'}
          </button>
          {!selectedTemplate && (
            <div className="text-xs text-text-secondary text-center">
              Select a plan card first to enable save.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
