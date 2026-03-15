export type ReadyTemplateId = 'ppl' | 'sp' | 'ul' | 'ppl_ul';

export interface ReadyTemplateExercise {
  exerciseName: string;
  sets: number;
  reps: string;
  notes?: string;
}

export interface ReadyTemplateWorkoutDay {
  dayName: string;
  workoutName: string;
  workoutType: string;
  exercises: ReadyTemplateExercise[];
}

export interface ReadyPlanTemplate {
  id: ReadyTemplateId;
  title: string;
  subtitle: string;
  cycleWeeks: number;
  selectedDays: string[];
  weeklyWorkouts: ReadyTemplateWorkoutDay[];
}

const clampWorkoutDays = (value: number) => {
  if (!Number.isFinite(value)) return 4;
  return Math.max(2, Math.min(6, Math.round(value)));
};

export const recommendTemplateByDays = (daysPerWeek: number): ReadyTemplateId => {
  if (daysPerWeek >= 6) return 'ppl';
  if (daysPerWeek >= 5) return 'ppl_ul';
  return 'ul';
};

export const mapAiWorkoutTypesToTemplate = (
  suggestedWorkoutTypes: string[],
  workoutDays: number,
): ReadyTemplateId => {
  const joined = suggestedWorkoutTypes.join(' ').toLowerCase();
  if (/push|pull|legs|ppl/.test(joined) && /upper|lower/.test(joined)) return 'ppl_ul';
  if (/upper|lower/.test(joined)) return 'ul';
  if (/split push|split/.test(joined)) return 'sp';
  if (/push|pull|legs|ppl/.test(joined)) {
    return workoutDays >= 6 ? 'ppl' : 'ppl_ul';
  }
  return recommendTemplateByDays(clampWorkoutDays(workoutDays));
};

export const inferTemplateFromPrompt = (prompt: string): ReadyTemplateId | null => {
  const normalized = String(prompt || '').toLowerCase();
  if (!normalized) return null;
  if ((/ppl/.test(normalized) || (/push/.test(normalized) && /pull/.test(normalized) && /legs/.test(normalized)))
    && (/upper/.test(normalized) || /lower/.test(normalized))) {
    return 'ppl_ul';
  }
  if (/split push/.test(normalized) || /\bsp\b/.test(normalized)) return 'sp';
  if ((/upper/.test(normalized) && /lower/.test(normalized)) || /\bul\b/.test(normalized)) return 'ul';
  if (/ppl/.test(normalized) || (/push/.test(normalized) && /pull/.test(normalized) && /legs/.test(normalized))) {
    return 'ppl';
  }
  return null;
};

export const extractCycleWeeksFromPrompt = (prompt: string): number | null => {
  const normalized = String(prompt || '').toLowerCase();
  const match = normalized.match(/(\d{1,2})\s*weeks?/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.max(8, Math.min(16, Math.round(value)));
};

export const READY_PLAN_TEMPLATES: ReadyPlanTemplate[] = [
  {
    id: 'ppl',
    title: 'PPL',
    subtitle: 'Push / Pull / Legs split with high weekly volume.',
    cycleWeeks: 8,
    selectedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Push A',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '6-8' },
          { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Seated Shoulder Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Cable Lateral Raise', sets: 3, reps: '12-15' },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Pull A',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Pull Up', sets: 4, reps: '6-10' },
          { exerciseName: 'Barbell Row', sets: 4, reps: '6-8' },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12' },
          { exerciseName: 'Face Pull', sets: 3, reps: '12-15' },
          { exerciseName: 'Hammer Curl', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'wednesday',
        workoutName: 'Legs A',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10' },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12' },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12' },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15' },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Push B',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Incline Barbell Press', sets: 4, reps: '6-8' },
          { exerciseName: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Machine Chest Press', sets: 3, reps: '10-12' },
          { exerciseName: 'Lateral Raise', sets: 3, reps: '12-15' },
          { exerciseName: 'Overhead Triceps Extension', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Pull B',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Deadlift', sets: 3, reps: '4-6' },
          { exerciseName: 'Chest Supported Row', sets: 3, reps: '8-10' },
          { exerciseName: 'Seated Cable Row', sets: 3, reps: '10-12' },
          { exerciseName: 'Rear Delt Fly', sets: 3, reps: '12-15' },
          { exerciseName: 'EZ Bar Curl', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'saturday',
        workoutName: 'Legs B',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Front Squat', sets: 4, reps: '5-8' },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '8-10' },
          { exerciseName: 'Bulgarian Split Squat', sets: 3, reps: '8-10' },
          { exerciseName: 'Leg Extension', sets: 3, reps: '12-15' },
          { exerciseName: 'Seated Calf Raise', sets: 4, reps: '12-15' },
        ],
      },
    ],
  },
  {
    id: 'sp',
    title: 'SP',
    subtitle: 'Split Push with mixed strength and hypertrophy focus.',
    cycleWeeks: 8,
    selectedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Push Strength',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '5-6' },
          { exerciseName: 'Overhead Press', sets: 4, reps: '5-6' },
          { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Cable Lateral Raise', sets: 3, reps: '12-15' },
          { exerciseName: 'Weighted Dips', sets: 3, reps: '6-8' },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Pull',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Pull Up', sets: 4, reps: '6-10' },
          { exerciseName: 'Barbell Row', sets: 4, reps: '6-8' },
          { exerciseName: 'Single Arm Dumbbell Row', sets: 3, reps: '8-10' },
          { exerciseName: 'Face Pull', sets: 3, reps: '12-15' },
          { exerciseName: 'Incline Dumbbell Curl', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'wednesday',
        workoutName: 'Legs',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10' },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12' },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12' },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15' },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Push Hypertrophy',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Incline Barbell Press', sets: 4, reps: '8-10' },
          { exerciseName: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Machine Chest Press', sets: 3, reps: '10-12' },
          { exerciseName: 'Lateral Raise', sets: 4, reps: '12-20' },
          { exerciseName: 'Triceps Rope Pushdown', sets: 3, reps: '10-15' },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Upper Balance',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Flat Dumbbell Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Chest Supported Row', sets: 3, reps: '8-10' },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12' },
          { exerciseName: 'Rear Delt Fly', sets: 3, reps: '12-15' },
          { exerciseName: 'Cable Curl', sets: 2, reps: '12-15' },
        ],
      },
    ],
  },
  {
    id: 'ul',
    title: 'UL',
    subtitle: 'Upper / Lower split for balanced progression.',
    cycleWeeks: 8,
    selectedDays: ['monday', 'tuesday', 'thursday', 'friday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Upper A',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '6-8' },
          { exerciseName: 'Barbell Row', sets: 4, reps: '6-8' },
          { exerciseName: 'Seated Shoulder Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12' },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Lower A',
        workoutType: 'Lower Body',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10' },
          { exerciseName: 'Walking Lunge', sets: 3, reps: '10/leg' },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12' },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15' },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Upper B',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Incline Dumbbell Press', sets: 4, reps: '8-10' },
          { exerciseName: 'Chest Supported Row', sets: 4, reps: '8-10' },
          { exerciseName: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15' },
          { exerciseName: 'Cable Row', sets: 3, reps: '10-12' },
          { exerciseName: 'EZ Bar Curl', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Lower B',
        workoutType: 'Lower Body',
        exercises: [
          { exerciseName: 'Front Squat', sets: 4, reps: '6-8' },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '8-10' },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12' },
          { exerciseName: 'Leg Extension', sets: 3, reps: '12-15' },
          { exerciseName: 'Seated Calf Raise', sets: 4, reps: '12-15' },
        ],
      },
    ],
  },
  {
    id: 'ppl_ul',
    title: 'PPL UL',
    subtitle: 'Push / Pull / Legs + Upper / Lower hybrid.',
    cycleWeeks: 8,
    selectedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Push',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '6-8' },
          { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Overhead Press', sets: 3, reps: '6-8' },
          { exerciseName: 'Lateral Raise', sets: 3, reps: '12-15' },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Pull',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Pull Up', sets: 4, reps: '6-10' },
          { exerciseName: 'Barbell Row', sets: 4, reps: '6-8' },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12' },
          { exerciseName: 'Face Pull', sets: 3, reps: '12-15' },
          { exerciseName: 'Hammer Curl', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'wednesday',
        workoutName: 'Legs',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10' },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12' },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12' },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15' },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Upper',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Incline Barbell Press', sets: 4, reps: '6-8' },
          { exerciseName: 'Chest Supported Row', sets: 4, reps: '8-10' },
          { exerciseName: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10' },
          { exerciseName: 'Cable Row', sets: 3, reps: '10-12' },
          { exerciseName: 'EZ Bar Curl', sets: 3, reps: '10-12' },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Lower',
        workoutType: 'Lower Body',
        exercises: [
          { exerciseName: 'Front Squat', sets: 4, reps: '6-8' },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '8-10' },
          { exerciseName: 'Bulgarian Split Squat', sets: 3, reps: '8-10' },
          { exerciseName: 'Leg Extension', sets: 3, reps: '12-15' },
          { exerciseName: 'Seated Calf Raise', sets: 4, reps: '12-15' },
        ],
      },
    ],
  },
];
