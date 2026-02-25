const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

import { HYPERTROPHY_PROGRAM_BOOK } from './hypertrophyProgramGenerator';

class OpenAICoachService {
  private async callOpenAI(messages: any[]) {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using gpt-4o for vision capabilities
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generatePersonalizedPlan(userProfile: {
    name: string;
    age: number;
    fitnessLevel: string;
    bodyType: string;
    goals: string[];
    availability: number;
    injuries?: string[];
    experience?: string;
    bodyImages?: string[]; // Base64 images from onboarding
  }) {
    const bookContext = `
Jeff Nippard's Fundamentals Hypertrophy Program Principles:
${HYPERTROPHY_PROGRAM_BOOK.principles.join('\n')}

Training Guidelines:
- Frequency: Train each muscle 2x per week
- Volume: 10-15 sets per muscle group per week
- Intensity: RPE 7-8 for most sets
- Progressive Overload: Gradually increase weight or reps
- Recovery: 48-72 hours between same muscle groups
`;

    const messages = [
      {
        role: 'system',
        content: `You are a professional gym coach with expertise in Jeff Nippard's science-based training methodology. 
You create personalized workout programs based on evidence-based principles from hypertrophy research.
You can analyze body composition from images to provide more accurate recommendations.
Use the provided book principles to create detailed, actionable training plans.
Format your response as a structured workout program with exercises, sets, reps, and coaching notes.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${bookContext}

Create a personalized ${userProfile.availability}-day per week training program for:
- Name: ${userProfile.name}
- Age: ${userProfile.age}
- Fitness Level: ${userProfile.fitnessLevel}
- Body Type: ${userProfile.bodyType}
- Goals: ${userProfile.goals.join(', ')}
${userProfile.injuries?.length ? `- Injuries/Limitations: ${userProfile.injuries.join(', ')}` : ''}
${userProfile.experience ? `- Experience: ${userProfile.experience}` : ''}
${userProfile.bodyImages?.length ? '\n\nAnalyze the provided body images to assess current physique, muscle development, and body composition. Use this visual analysis to create more accurate training and nutrition recommendations.' : ''}

Provide:
1. ${userProfile.bodyImages?.length ? 'Body composition analysis from images\n2. ' : ''}Weekly training split
${userProfile.bodyImages?.length ? '3' : '2'}. Specific exercises for each day with sets/reps/rest
${userProfile.bodyImages?.length ? '4' : '3'}. Progression strategy
${userProfile.bodyImages?.length ? '5' : '4'}. Key coaching tips
${userProfile.bodyImages?.length ? '6' : '5'}. Nutrition recommendations based on ${userProfile.bodyImages?.length ? 'visual assessment and ' : ''}body type`
          },
          ...(userProfile.bodyImages?.map(img => ({
            type: 'image_url',
            image_url: { url: img }
          })) || [])
        ]
      }
    ];

    return await this.callOpenAI(messages);
  }

  async analyzeExerciseForm(exerciseName: string, userDescription: string) {
    const messages = [
      {
        role: 'system',
        content: 'You are a professional strength coach specializing in exercise technique and form correction.'
      },
      {
        role: 'user',
        content: `Analyze this exercise form issue:
Exercise: ${exerciseName}
User Description: ${userDescription}

Provide:
1. Common form mistakes for this exercise
2. Specific corrections based on the description
3. Cues to improve technique
4. Safety considerations`
      }
    ];

    return await this.callOpenAI(messages);
  }

  async answerTrainingQuestion(question: string, userContext?: any) {
    const bookContext = `
Training Principles from Jeff Nippard's Program:
${HYPERTROPHY_PROGRAM_BOOK.principles.join('\n')}
`;

    const messages = [
      {
        role: 'system',
        content: `You are a professional gym coach with expertise in science-based training. 
Answer questions using evidence-based principles and practical coaching experience.
Reference Jeff Nippard's methodology when relevant.`
      },
      {
        role: 'user',
        content: `${bookContext}

Question: ${question}
${userContext ? `\nUser Context: ${JSON.stringify(userContext)}` : ''}`
      }
    ];

    return await this.callOpenAI(messages);
  }

  async generateWorkoutVariation(baseWorkout: any, reason: string) {
    const messages = [
      {
        role: 'system',
        content: 'You are a professional gym coach creating workout variations while maintaining training principles.'
      },
      {
        role: 'user',
        content: `Create a variation of this workout:
${JSON.stringify(baseWorkout, null, 2)}

Reason for variation: ${reason}

Provide alternative exercises that target the same muscles with similar volume and intensity.`
      }
    ];

    return await this.callOpenAI(messages);
  }

  async chatWithCoach(conversationHistory: { role: string; content: string }[]) {
    const systemMessage = {
      role: 'system',
      content: `You are a professional gym coach and personal trainer. 
You provide expert advice on training, nutrition, recovery, and motivation.
Be supportive, knowledgeable, and practical in your responses.
Use Jeff Nippard's science-based principles when relevant.`
    };

    const messages = [systemMessage, ...conversationHistory];
    return await this.callOpenAI(messages);
  }
}

export const aiCoach = new OpenAICoachService();
