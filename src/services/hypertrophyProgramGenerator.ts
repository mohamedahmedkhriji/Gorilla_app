import { UserProfile } from './trainingPlan';

// Jeff Nippard's Fundamentals Hypertrophy Program - Training Principles
export const HYPERTROPHY_PROGRAM_BOOK = {
  author: 'Jeff Nippard',
  programName: 'Fundamentals Hypertrophy Program',
  
  principles: [
    'Progressive Overload: Gradually increase stress on the body (weight/reps)',
    'Frequency: Train each muscle 2x per week for optimal growth',
    'Volume: 10-15 sets per muscle group per week',
    'Intensity: RPE 7-8 for most sets (2-3 reps in reserve)',
    'Mind-Muscle Connection: Focus on target muscle contraction',
    'Compound Movements: Prioritize multi-joint exercises',
    'Recovery: 48-72 hours between same muscle groups',
    'Technique Mastery: Perfect form before adding weight'
  ],
  
  muscleGrowthEstimates: {
    untrained: '1-2 lbs per month (12-24 lbs first year)',
    earlyIntermediate: '0.5-1 lbs per month (6-12 lbs second year)',
    women: 'Divide male estimates by half'
  },
  
  rpeGuidelines: {
    untrained: '5-7 RPE (focus on technique)',
    beginner: '7-8 RPE (can push harder)',
    intermediate: '7-9 RPE (close to failure)'
  }
};

export interface BookBasedProgram {
  programName: string;
  phase: string;
  weeks: number;
  schedule: {
    day: string;
    focus: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      rest: string;
      tempo?: string;
      notes?: string;
    }[];
  }[];
  principles: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

export class HypertrophyProgramGenerator {
  generateProgram(userProfile: UserProfile): BookBasedProgram {
    const { fitnessLevel, bodyType, goals, availability } = userProfile;

    // Generate program based on book principles
    return {
      programName: `Hypertrophy ${fitnessLevel} Program`,
      phase: 'Foundation Phase',
      weeks: 12,
      schedule: this.createScheduleFromBook(fitnessLevel, availability),
      principles: this.getBookPrinciples(),
      nutrition: this.calculateNutritionFromBook(bodyType, goals),
    };
  }

  private createScheduleFromBook(level: string, days: number): any[] {
    // Based on Jeff Nippard's Fundamentals Program structure
    
    if (level === 'beginner' && days <= 3) {
      return [
        {
          day: 'Monday',
          focus: 'Upper Body - Push',
          exercises: [
            { name: 'Bench Press', sets: 3, reps: '8-12', rest: '90 sec', tempo: '3-0-1-0', notes: 'Control the negative' },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', rest: '90 sec', tempo: '3-0-1-0' },
            { name: 'Overhead Press', sets: 3, reps: '8-10', rest: '90 sec', tempo: '2-0-1-0' },
            { name: 'Lateral Raises', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-1-1-0' },
            { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-0-1-0' },
          ],
        },
        {
          day: 'Wednesday',
          focus: 'Lower Body',
          exercises: [
            { name: 'Squat', sets: 4, reps: '8-12', rest: '2 min', tempo: '3-0-1-0', notes: 'Full depth' },
            { name: 'Romanian Deadlift', sets: 3, reps: '10-12', rest: '90 sec', tempo: '3-0-1-0' },
            { name: 'Leg Press', sets: 3, reps: '12-15', rest: '90 sec', tempo: '2-0-1-0' },
            { name: 'Leg Curl', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-1-1-0' },
            { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '60 sec', tempo: '2-2-1-0' },
          ],
        },
        {
          day: 'Friday',
          focus: 'Upper Body - Pull',
          exercises: [
            { name: 'Pull-Ups', sets: 3, reps: '8-12', rest: '90 sec', tempo: '2-0-1-0', notes: 'Use assistance if needed' },
            { name: 'Barbell Row', sets: 3, reps: '8-12', rest: '90 sec', tempo: '2-0-1-0' },
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90 sec', tempo: '2-0-1-0' },
            { name: 'Face Pulls', sets: 3, reps: '15-20', rest: '60 sec', tempo: '2-1-1-0' },
            { name: 'Bicep Curls', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-0-1-0' },
          ],
        },
      ];
    }

    // Intermediate/Advanced programs
    return this.advancedHypertrophySchedule();
  }

  private advancedHypertrophySchedule(): any[] {
    return [
      {
        day: 'Monday',
        focus: 'Chest & Triceps',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '6-8', rest: '2 min', tempo: '3-0-X-0' },
          { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10', rest: '90 sec', tempo: '3-0-1-0' },
          { name: 'Cable Flyes', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-1-1-0' },
          { name: 'Close Grip Bench', sets: 3, reps: '8-10', rest: '90 sec', tempo: '2-0-1-0' },
          { name: 'Tricep Extensions', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-1-1-0' },
        ],
      },
      {
        day: 'Tuesday',
        focus: 'Back & Biceps',
        exercises: [
          { name: 'Deadlift', sets: 4, reps: '6-8', rest: '2 min', tempo: '2-0-X-0' },
          { name: 'Pull-Ups', sets: 4, reps: '8-10', rest: '90 sec', tempo: '2-0-1-0' },
          { name: 'Barbell Row', sets: 4, reps: '8-10', rest: '90 sec', tempo: '2-0-1-0' },
          { name: 'Face Pulls', sets: 3, reps: '15-20', rest: '60 sec', tempo: '2-1-1-0' },
          { name: 'Hammer Curls', sets: 3, reps: '10-12', rest: '60 sec', tempo: '2-0-1-0' },
        ],
      },
      {
        day: 'Thursday',
        focus: 'Shoulders',
        exercises: [
          { name: 'Overhead Press', sets: 4, reps: '6-8', rest: '2 min', tempo: '2-0-X-0' },
          { name: 'Dumbbell Shoulder Press', sets: 4, reps: '8-10', rest: '90 sec', tempo: '2-0-1-0' },
          { name: 'Lateral Raises', sets: 4, reps: '12-15', rest: '60 sec', tempo: '2-1-1-0' },
          { name: 'Rear Delt Flyes', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-1-1-0' },
          { name: 'Shrugs', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-1-1-0' },
        ],
      },
      {
        day: 'Friday',
        focus: 'Legs',
        exercises: [
          { name: 'Squat', sets: 4, reps: '6-8', rest: '2 min', tempo: '3-0-X-0' },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: '90 sec', tempo: '3-0-1-0' },
          { name: 'Leg Press', sets: 3, reps: '12-15', rest: '90 sec', tempo: '2-0-1-0' },
          { name: 'Leg Curl', sets: 3, reps: '12-15', rest: '60 sec', tempo: '2-1-1-0' },
          { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '60 sec', tempo: '2-2-1-0' },
        ],
      },
    ];
  }

  private getBookPrinciples(): string[] {
    return HYPERTROPHY_PROGRAM_BOOK.principles;
  }

  private calculateNutritionFromBook(bodyType: string, goals: string[]): any {
    // Based on 0.8-1g protein per lb bodyweight, caloric surplus for growth
    let baseCalories = 2800;
    const protein = 180; // ~1g per lb for 180lb person
    let carbs = 350;
    let fats = 80;

    // Adjust for body type
    if (bodyType === 'ectomorph') {
      baseCalories += 300; // Hard gainers need more
      carbs += 50;
    } else if (bodyType === 'endomorph') {
      baseCalories -= 200; // Easy gainers need less surplus
      carbs -= 50;
      fats += 10;
    }

    // Adjust for goals
    if (goals.includes('lose weight')) {
      baseCalories -= 500; // Deficit for fat loss
      carbs -= 75;
    }

    return { 
      calories: baseCalories, 
      protein, 
      carbs, 
      fats,
      notes: 'Protein: 0.8-1g per lb bodyweight. Adjust calories based on weekly weight changes.'
    };
  }
}

export const hypertrophyProgramGenerator = new HypertrophyProgramGenerator();
