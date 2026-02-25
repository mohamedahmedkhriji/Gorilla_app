export interface UserProfile {
  bodyType: 'ectomorph' | 'mesomorph' | 'endomorph';
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: ('muscle_gain' | 'fat_loss' | 'strength' | 'endurance')[];
  availability: number; // days per week
  injuries?: string[];
  preferredSplit?: 'full_body' | 'upper_lower' | 'push_pull_legs' | 'bro_split';
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  muscleGroup: string;
}

export interface WorkoutDay {
  day: string;
  type: string;
  exercises: Exercise[];
}

export class TrainingPlanGenerator {
  generatePlan(profile: UserProfile): WorkoutDay[] {
    const { fitnessLevel, availability, goals, bodyType } = profile;

    // Determine split based on availability and level
    let split = this.determineSplit(availability, fitnessLevel);
    
    // Generate exercises based on split and profile
    return this.createWorkoutSchedule(split, profile);
  }

  private determineSplit(availability: number, level: string): string {
    if (availability <= 3) return 'full_body';
    if (availability === 4) return 'upper_lower';
    if (availability >= 5) return 'push_pull_legs';
    return 'full_body';
  }

  private createWorkoutSchedule(split: string, profile: UserProfile): WorkoutDay[] {
    const schedules: { [key: string]: () => WorkoutDay[] } = {
      'full_body': () => this.fullBodySplit(profile),
      'upper_lower': () => this.upperLowerSplit(profile),
      'push_pull_legs': () => this.pushPullLegsSplit(profile),
    };

    return schedules[split]?.() || this.fullBodySplit(profile);
  }

  private fullBodySplit(profile: UserProfile): WorkoutDay[] {
    const exercises = this.getExercisesByLevel(profile.fitnessLevel);
    
    return [
      {
        day: 'Monday',
        type: 'Full Body A',
        exercises: [
          exercises.squat,
          exercises.benchPress,
          exercises.row,
          exercises.shoulderPress,
          exercises.curl,
        ],
      },
      {
        day: 'Wednesday',
        type: 'Full Body B',
        exercises: [
          exercises.deadlift,
          exercises.inclinePress,
          exercises.pullUp,
          exercises.lateralRaise,
          exercises.tricepDip,
        ],
      },
      {
        day: 'Friday',
        type: 'Full Body C',
        exercises: [
          exercises.legPress,
          exercises.dumbbellPress,
          exercises.latPulldown,
          exercises.facePull,
          exercises.plank,
        ],
      },
    ];
  }

  private upperLowerSplit(profile: UserProfile): WorkoutDay[] {
    const exercises = this.getExercisesByLevel(profile.fitnessLevel);
    
    return [
      {
        day: 'Monday',
        type: 'Upper Body',
        exercises: [
          exercises.benchPress,
          exercises.row,
          exercises.shoulderPress,
          exercises.pullUp,
          exercises.curl,
          exercises.tricepDip,
        ],
      },
      {
        day: 'Tuesday',
        type: 'Lower Body',
        exercises: [
          exercises.squat,
          exercises.deadlift,
          exercises.legPress,
          exercises.legCurl,
          exercises.calfRaise,
        ],
      },
      {
        day: 'Thursday',
        type: 'Upper Body',
        exercises: [
          exercises.inclinePress,
          exercises.latPulldown,
          exercises.dumbbellPress,
          exercises.facePull,
          exercises.lateralRaise,
        ],
      },
      {
        day: 'Friday',
        type: 'Lower Body',
        exercises: [
          exercises.frontSquat,
          exercises.romanianDeadlift,
          exercises.lunges,
          exercises.legExtension,
          exercises.plank,
        ],
      },
    ];
  }

  private pushPullLegsSplit(profile: UserProfile): WorkoutDay[] {
    const exercises = this.getExercisesByLevel(profile.fitnessLevel);
    
    return [
      {
        day: 'Monday',
        type: 'Push Day',
        exercises: [
          exercises.benchPress,
          exercises.shoulderPress,
          exercises.inclinePress,
          exercises.tricepDip,
          exercises.lateralRaise,
        ],
      },
      {
        day: 'Tuesday',
        type: 'Pull Day',
        exercises: [
          exercises.pullUp,
          exercises.row,
          exercises.latPulldown,
          exercises.facePull,
          exercises.curl,
        ],
      },
      {
        day: 'Wednesday',
        type: 'Legs Day',
        exercises: [
          exercises.squat,
          exercises.romanianDeadlift,
          exercises.legPress,
          exercises.legCurl,
          exercises.calfRaise,
        ],
      },
      {
        day: 'Friday',
        type: 'Push Day',
        exercises: [
          exercises.dumbbellPress,
          exercises.inclinePress,
          exercises.shoulderPress,
          exercises.tricepExtension,
          exercises.lateralRaise,
        ],
      },
      {
        day: 'Saturday',
        type: 'Pull Day',
        exercises: [
          exercises.deadlift,
          exercises.row,
          exercises.pullUp,
          exercises.facePull,
          exercises.curl,
        ],
      },
    ];
  }

  private getExercisesByLevel(level: string): { [key: string]: Exercise } {
    const repSchemes = {
      beginner: { sets: 3, reps: '10-12', rest: '90 sec' },
      intermediate: { sets: 4, reps: '8-10', rest: '2 min' },
      advanced: { sets: 4, reps: '6-8', rest: '2-3 min' },
    };

    const scheme = repSchemes[level as keyof typeof repSchemes] || repSchemes.beginner;

    return {
      // Push exercises
      benchPress: { name: 'Bench Press', ...scheme, muscleGroup: 'Chest' },
      inclinePress: { name: 'Incline Dumbbell Press', ...scheme, muscleGroup: 'Chest' },
      dumbbellPress: { name: 'Dumbbell Bench Press', ...scheme, muscleGroup: 'Chest' },
      shoulderPress: { name: 'Overhead Press', ...scheme, muscleGroup: 'Shoulders' },
      lateralRaise: { name: 'Lateral Raises', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Shoulders' },
      tricepDip: { name: 'Tricep Dips', ...scheme, muscleGroup: 'Triceps' },
      tricepExtension: { name: 'Tricep Extension', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Triceps' },

      // Pull exercises
      pullUp: { name: 'Pull-Ups', ...scheme, muscleGroup: 'Back' },
      row: { name: 'Barbell Row', ...scheme, muscleGroup: 'Back' },
      latPulldown: { name: 'Lat Pulldown', ...scheme, muscleGroup: 'Back' },
      facePull: { name: 'Face Pulls', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Back' },
      curl: { name: 'Bicep Curls', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Biceps' },

      // Leg exercises
      squat: { name: 'Squat', ...scheme, muscleGroup: 'Quadriceps' },
      frontSquat: { name: 'Front Squat', ...scheme, muscleGroup: 'Quadriceps' },
      deadlift: { name: 'Deadlift', ...scheme, muscleGroup: 'Hamstrings' },
      romanianDeadlift: { name: 'Romanian Deadlift', ...scheme, muscleGroup: 'Hamstrings' },
      legPress: { name: 'Leg Press', sets: 3, reps: '12-15', rest: '90 sec', muscleGroup: 'Quadriceps' },
      legCurl: { name: 'Leg Curl', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Hamstrings' },
      legExtension: { name: 'Leg Extension', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Quadriceps' },
      lunges: { name: 'Lunges', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Quadriceps' },
      calfRaise: { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '60 sec', muscleGroup: 'Calves' },

      // Core
      plank: { name: 'Plank', sets: 3, reps: '60 sec', rest: '60 sec', muscleGroup: 'Abs' },
    };
  }
}

export const trainingPlanGenerator = new TrainingPlanGenerator();
