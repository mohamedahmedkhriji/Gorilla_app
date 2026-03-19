import { api } from './api';
import { UserProfile } from './trainingPlan';

export interface AIGeneratedProgram {
  weeklySchedule: {
    day: string;
    workoutType: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      rest: string;
      notes?: string;
    }[];
  }[];
  nutritionGuidelines: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  progressionPlan: string;
  tips: string[];
}

export class AIProgramGenerator {
  async generateProgram(userProfile: UserProfile, documents: string[]): Promise<AIGeneratedProgram> {
    const prompt = this.buildPrompt(userProfile, documents);

    try {
      const response = await api.chatCompletions({
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2000,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fitness coach creating personalized workout programs based on scientific training principles and user profiles.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      return this.parseAIResponse(response.content);
    } catch (error) {
      console.error('AI Program Generation Error:', error);
      return this.fallbackGeneration(userProfile);
    }
  }

  private buildPrompt(userProfile: UserProfile, documents: string[]): string {
    return `
Create a personalized workout program based on the following:

USER PROFILE:
- Body Type: ${userProfile.bodyType}
- Fitness Level: ${userProfile.fitnessLevel}
- Goals: ${userProfile.goals.join(', ')}
- Available Days: ${userProfile.availability} days per week
- Injuries: ${userProfile.injuries?.join(', ') || 'None'}

TRAINING DOCUMENTS:
${documents.join('\n\n')}

Please create a detailed weekly workout program including:
1. Weekly schedule with specific workout days and types
2. Exercises with sets, reps, and rest periods for each day
3. Nutrition guidelines (calories, macros)
4. Progression plan
5. Important tips

Format the response as JSON with this structure:
{
  "weeklySchedule": [...],
  "nutritionGuidelines": {...},
  "progressionPlan": "...",
  "tips": [...]
}
`;
  }

  private parseAIResponse(response: string): AIGeneratedProgram {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error);
    }

    return this.getDefaultProgram();
  }

  private fallbackGeneration(userProfile: UserProfile): AIGeneratedProgram {
    const { availability } = userProfile;

    const schedule = this.generateSchedule(availability);
    const nutrition = this.calculateNutrition(userProfile);

    return {
      weeklySchedule: schedule,
      nutritionGuidelines: nutrition,
      progressionPlan: 'Increase weight by 2.5-5% when you can complete all sets with good form.',
      tips: [
        'Focus on progressive overload',
        'Prioritize compound movements',
        'Get 7-9 hours of sleep',
        'Stay hydrated throughout the day',
      ],
    };
  }

  private generateSchedule(days: number): any[] {
    if (days <= 3) {
      return [
        { day: 'Monday', workoutType: 'Full Body', exercises: [] },
        { day: 'Wednesday', workoutType: 'Full Body', exercises: [] },
        { day: 'Friday', workoutType: 'Full Body', exercises: [] },
      ];
    } else if (days === 4) {
      return [
        { day: 'Monday', workoutType: 'Upper Body', exercises: [] },
        { day: 'Tuesday', workoutType: 'Lower Body', exercises: [] },
        { day: 'Thursday', workoutType: 'Upper Body', exercises: [] },
        { day: 'Friday', workoutType: 'Lower Body', exercises: [] },
      ];
    }

    return [
      { day: 'Monday', workoutType: 'Push', exercises: [] },
      { day: 'Tuesday', workoutType: 'Pull', exercises: [] },
      { day: 'Wednesday', workoutType: 'Legs', exercises: [] },
      { day: 'Friday', workoutType: 'Push', exercises: [] },
      { day: 'Saturday', workoutType: 'Pull', exercises: [] },
    ];
  }

  private calculateNutrition(profile: UserProfile): any {
    const baseCalories = 2500;

    if (profile.goals.includes('muscle_gain')) {
      return {
        calories: baseCalories + 300,
        protein: 180,
        carbs: 300,
        fats: 70,
      };
    } else if (profile.goals.includes('fat_loss')) {
      return {
        calories: baseCalories - 500,
        protein: 180,
        carbs: 150,
        fats: 60,
      };
    }

    return {
      calories: baseCalories,
      protein: 160,
      carbs: 250,
      fats: 70,
    };
  }

  private getDefaultProgram(): AIGeneratedProgram {
    return {
      weeklySchedule: [],
      nutritionGuidelines: {
        calories: 2500,
        protein: 160,
        carbs: 250,
        fats: 70,
      },
      progressionPlan: 'Progressive overload weekly',
      tips: ['Train consistently', 'Eat enough protein', 'Rest adequately'],
    };
  }
}

export const aiProgramGenerator = new AIProgramGenerator();
