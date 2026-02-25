import { UserProfile } from './trainingPlan';

// Store your 2 coach documents here
export const COACH_DOCUMENTS = {
  coach1: `
    // PASTE COACH 1 DOCUMENT CONTENT HERE
    Training Philosophy:
    - Focus on compound movements
    - Progressive overload principle
    - Proper form over heavy weight
    
    Beginner Program:
    - 3 days per week full body
    - 3 sets of 10-12 reps
    - Focus on learning movements
    
    Intermediate Program:
    - 4-5 days per week
    - Upper/Lower or Push/Pull/Legs split
    - 4 sets of 8-10 reps
    
    Advanced Program:
    - 5-6 days per week
    - Specialized splits
    - Periodization and deload weeks
  `,
  
  coach2: `
    // PASTE COACH 2 DOCUMENT CONTENT HERE
    Training Methodology:
    - Muscle-specific training
    - Volume and intensity balance
    - Recovery optimization
    
    Body Type Considerations:
    - Ectomorph: Higher frequency, moderate volume
    - Mesomorph: Balanced approach
    - Endomorph: Higher intensity, controlled volume
    
    Goal-Specific Training:
    - Muscle Gain: 8-12 reps, 3-4 sets, shorter rest
    - Strength: 4-6 reps, 4-5 sets, longer rest
    - Fat Loss: Circuit training, higher reps, shorter rest
  `,
};

export interface PersonalizedProgram {
  programName: string;
  duration: string;
  schedule: {
    day: string;
    type: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      rest: string;
      muscleGroup: string;
      notes?: string;
    }[];
  }[];
  nutrition: {
    dailyCalories: number;
    protein: number;
    carbs: number;
    fats: number;
    meals: number;
  };
  guidelines: string[];
  progressionRules: string[];
}

export class CoachBasedProgramGenerator {
  generateProgram(userProfile: UserProfile): PersonalizedProgram {
    const {
      bodyType,
      fitnessLevel,
      goals,
      availability,
      injuries = [],
    } = userProfile;

    // Determine program structure based on coach documents
    const schedule = this.createSchedule(fitnessLevel, availability, goals);
    const nutrition = this.calculateNutrition(bodyType, goals);
    const guidelines = this.getGuidelines(fitnessLevel, bodyType);
    const progression = this.getProgressionRules(fitnessLevel);

    return {
      programName: `${fitnessLevel.toUpperCase()} ${goals[0].toUpperCase()} Program`,
      duration: '12 weeks',
      schedule,
      nutrition,
      guidelines,
      progressionRules: progression,
    };
  }

  private createSchedule(level: string, days: number, goals: string[]): any[] {
    // Based on Coach 1 & 2 documents
    if (level === 'beginner') {
      return this.beginnerSchedule();
    } else if (level === 'intermediate') {
      return days >= 5 ? this.intermediatePPL() : this.intermediateUpperLower();
    } else {
      return this.advancedSchedule(goals);
    }
  }

  private beginnerSchedule(): any[] {
    return [
      {
        day: 'Monday',
        type: 'Full Body A',
        exercises: [
          { name: 'Squat', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Quadriceps', notes: 'Focus on form' },
          { name: 'Bench Press', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Chest' },
          { name: 'Barbell Row', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Back' },
          { name: 'Overhead Press', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Shoulders' },
          { name: 'Plank', sets: 3, reps: '30-60 sec', rest: '60 sec', muscleGroup: 'Abs' },
        ],
      },
      {
        day: 'Wednesday',
        type: 'Full Body B',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: '8-10', rest: '2 min', muscleGroup: 'Hamstrings', notes: 'Keep back straight' },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Chest' },
          { name: 'Pull-Ups (Assisted)', sets: 3, reps: '8-10', rest: '90 sec', muscleGroup: 'Back' },
          { name: 'Lateral Raises', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Shoulders' },
          { name: 'Bicep Curls', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Biceps' },
        ],
      },
      {
        day: 'Friday',
        type: 'Full Body C',
        exercises: [
          { name: 'Leg Press', sets: 3, reps: '12-15', rest: '90 sec', muscleGroup: 'Quadriceps' },
          { name: 'Dumbbell Bench Press', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Chest' },
          { name: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Back' },
          { name: 'Face Pulls', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Back' },
          { name: 'Tricep Dips', sets: 3, reps: '8-10', rest: '60 sec', muscleGroup: 'Triceps' },
        ],
      },
    ];
  }

  private intermediateUpperLower(): any[] {
    return [
      {
        day: 'Monday',
        type: 'Upper Body',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Chest' },
          { name: 'Barbell Row', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Back' },
          { name: 'Overhead Press', sets: 3, reps: '8-10', rest: '90 sec', muscleGroup: 'Shoulders' },
          { name: 'Pull-Ups', sets: 3, reps: '8-10', rest: '90 sec', muscleGroup: 'Back' },
          { name: 'Bicep Curls', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Biceps' },
          { name: 'Tricep Extensions', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Triceps' },
        ],
      },
      {
        day: 'Tuesday',
        type: 'Lower Body',
        exercises: [
          { name: 'Squat', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Quadriceps' },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Hamstrings' },
          { name: 'Leg Press', sets: 3, reps: '12-15', rest: '90 sec', muscleGroup: 'Quadriceps' },
          { name: 'Leg Curl', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Hamstrings' },
          { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '60 sec', muscleGroup: 'Calves' },
        ],
      },
      {
        day: 'Thursday',
        type: 'Upper Body',
        exercises: [
          { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Chest' },
          { name: 'Lat Pulldown', sets: 4, reps: '10-12', rest: '90 sec', muscleGroup: 'Back' },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Shoulders' },
          { name: 'Face Pulls', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Back' },
          { name: 'Hammer Curls', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Biceps' },
        ],
      },
      {
        day: 'Friday',
        type: 'Lower Body',
        exercises: [
          { name: 'Front Squat', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Quadriceps' },
          { name: 'Deadlift', sets: 3, reps: '6-8', rest: '2 min', muscleGroup: 'Hamstrings' },
          { name: 'Lunges', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Quadriceps' },
          { name: 'Leg Extensions', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Quadriceps' },
          { name: 'Plank', sets: 3, reps: '60 sec', rest: '60 sec', muscleGroup: 'Abs' },
        ],
      },
    ];
  }

  private intermediatePPL(): any[] {
    // Push/Pull/Legs for 5+ days
    return [
      {
        day: 'Monday',
        type: 'Push Day',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Chest' },
          { name: 'Overhead Press', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Shoulders' },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Chest' },
          { name: 'Lateral Raises', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Shoulders' },
          { name: 'Tricep Dips', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Triceps' },
        ],
      },
      {
        day: 'Tuesday',
        type: 'Pull Day',
        exercises: [
          { name: 'Pull-Ups', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Back' },
          { name: 'Barbell Row', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Back' },
          { name: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90 sec', muscleGroup: 'Back' },
          { name: 'Face Pulls', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Back' },
          { name: 'Bicep Curls', sets: 3, reps: '10-12', rest: '60 sec', muscleGroup: 'Biceps' },
        ],
      },
      {
        day: 'Wednesday',
        type: 'Legs Day',
        exercises: [
          { name: 'Squat', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Quadriceps' },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: '2 min', muscleGroup: 'Hamstrings' },
          { name: 'Leg Press', sets: 3, reps: '12-15', rest: '90 sec', muscleGroup: 'Quadriceps' },
          { name: 'Leg Curl', sets: 3, reps: '12-15', rest: '60 sec', muscleGroup: 'Hamstrings' },
          { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '60 sec', muscleGroup: 'Calves' },
        ],
      },
    ];
  }

  private advancedSchedule(goals: string[]): any[] {
    // Advanced programs with periodization
    return this.intermediatePPL(); // Can be expanded
  }

  private calculateNutrition(bodyType: string, goals: string[]): any {
    let baseCalories = 2500;
    let protein = 180;
    let carbs = 250;
    let fats = 70;

    // Adjust for body type (Coach 2 guidelines)
    if (bodyType === 'ectomorph') {
      carbs += 50;
      baseCalories += 300;
    } else if (bodyType === 'endomorph') {
      carbs -= 50;
      baseCalories -= 200;
    }

    // Adjust for goals
    if (goals.includes('muscle_gain')) {
      baseCalories += 300;
      protein += 20;
    } else if (goals.includes('fat_loss')) {
      baseCalories -= 500;
      carbs -= 100;
    }

    return {
      dailyCalories: baseCalories,
      protein,
      carbs,
      fats,
      meals: 4,
    };
  }

  private getGuidelines(level: string, bodyType: string): string[] {
    return [
      'Train with proper form - quality over quantity',
      'Progressive overload: increase weight by 2.5-5% when completing all sets',
      'Get 7-9 hours of sleep per night',
      'Stay hydrated: drink 3-4 liters of water daily',
      'Warm up for 5-10 minutes before each workout',
      'Cool down and stretch after training',
      level === 'beginner' ? 'Focus on learning movement patterns' : 'Push intensity while maintaining form',
    ];
  }

  private getProgressionRules(level: string): string[] {
    if (level === 'beginner') {
      return [
        'Week 1-4: Learn exercises, use light weights',
        'Week 5-8: Increase weight by 5-10%',
        'Week 9-12: Continue progressive overload',
      ];
    } else if (level === 'intermediate') {
      return [
        'Increase weight when completing all sets with 2 reps in reserve',
        'Deload every 4-6 weeks (reduce weight by 40%)',
        'Track all workouts and aim for weekly improvements',
      ];
    } else {
      return [
        'Periodize training: 3 weeks progressive, 1 week deload',
        'Vary rep ranges: strength (4-6), hypertrophy (8-12), endurance (15+)',
        'Advanced techniques: drop sets, supersets, rest-pause',
      ];
    }
  }
}

export const coachProgramGenerator = new CoachBasedProgramGenerator();
