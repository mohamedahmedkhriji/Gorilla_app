import React, { useState } from 'react';
import { ArrowLeft, Dumbbell, Calendar, Target, User, Activity } from 'lucide-react';
import { hypertrophyProgramGenerator } from '../../services/hypertrophyProgramGenerator';
import { aiCoach } from '../../services/aiCoach';
import { UserProfile } from '../../services/trainingPlan';

interface ProgramGeneratorScreenProps {
  onBack: () => void;
  onProgramGenerated: (program: any) => void;
}

export const ProgramGeneratorScreen: React.FC<ProgramGeneratorScreenProps> = ({ onBack, onProgramGenerated }) => {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    fitnessLevel: 'beginner',
    bodyType: 'mesomorph',
    goals: ['build muscle'],
    availability: 4,
    injuries: []
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Get body images from onboarding if available
      const onboardingData = localStorage.getItem('onboardingData');
      const bodyImages = onboardingData ? JSON.parse(onboardingData).bodyImages : null;

      // Generate AI-powered personalized plan
      const aiPlan = await aiCoach.generatePersonalizedPlan({
        name: 'User',
        age: 25,
        fitnessLevel: profile.fitnessLevel || 'beginner',
        bodyType: profile.bodyType || 'mesomorph',
        goals: profile.goals || ['build muscle'],
        availability: profile.availability || 4,
        injuries: profile.injuries,
        bodyImages: bodyImages || undefined
      });

      // Also generate structured program
      const program = hypertrophyProgramGenerator.generateProgram(profile as UserProfile);
      
      // Add AI recommendations to program
      const enhancedProgram = {
        ...program,
        aiRecommendations: aiPlan
      };

      localStorage.setItem('activeProgram', JSON.stringify({ 
        ...enhancedProgram, 
        startDate: new Date(), 
        currentWeek: 1 
      }));
      
      onProgramGenerated(enhancedProgram);
    } catch (error) {
      console.error('AI generation failed, using default program:', error);
      // Fallback to regular program if AI fails
      const program = hypertrophyProgramGenerator.generateProgram(profile as UserProfile);
      localStorage.setItem('activeProgram', JSON.stringify({ ...program, startDate: new Date(), currentWeek: 1 }));
      onProgramGenerated(program);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <h1 className="text-2xl font-bold mb-2">Generate Your Program</h1>
        <p className="text-gray-400 mb-6">Based on Jeff Nippard's Fundamentals</p>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1 flex-1 rounded ${s <= step ? 'bg-[#10b981]' : 'bg-gray-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity size={20} className="text-emerald-600" />
              Fitness Level
            </h2>
            {['beginner', 'intermediate', 'advanced'].map(level => (
              <button
                key={level}
                onClick={() => setProfile({ ...profile, fitnessLevel: level })}
                className={`w-full p-4 rounded-lg border-2 text-left ${
                  profile.fitnessLevel === level ? 'border-[#10b981] bg-[#10b981]/10' : 'border-gray-700'
                }`}
              >
                <div className="font-semibold capitalize">{level}</div>
                <div className="text-sm text-gray-400">
                  {level === 'beginner' && '0-12 months training'}
                  {level === 'intermediate' && '1-3 years training'}
                  {level === 'advanced' && '3+ years training'}
                </div>
              </button>
            ))}
            <button onClick={() => setStep(2)} className="w-full bg-[#10b981] text-black py-3 rounded-lg font-semibold mt-6">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <User size={20} className="text-emerald-600" />
              Body Type
            </h2>
            {['ectomorph', 'mesomorph', 'endomorph'].map(type => (
              <button
                key={type}
                onClick={() => setProfile({ ...profile, bodyType: type })}
                className={`w-full p-4 rounded-lg border-2 text-left ${
                  profile.bodyType === type ? 'border-[#10b981] bg-[#10b981]/10' : 'border-gray-700'
                }`}
              >
                <div className="font-semibold capitalize">{type}</div>
                <div className="text-sm text-gray-400">
                  {type === 'ectomorph' && 'Lean, hard to gain weight'}
                  {type === 'mesomorph' && 'Athletic, gains muscle easily'}
                  {type === 'endomorph' && 'Stocky, gains weight easily'}
                </div>
              </button>
            ))}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-700 py-3 rounded-lg">Back</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-[#10b981] text-black py-3 rounded-lg font-semibold">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Target size={20} className="text-emerald-600" />
              Primary Goal
            </h2>
            {['build muscle', 'gain strength', 'lose fat'].map(goal => (
              <button
                key={goal}
                onClick={() => setProfile({ ...profile, goals: [goal] })}
                className={`w-full p-4 rounded-lg border-2 text-left ${
                  profile.goals?.includes(goal) ? 'border-[#10b981] bg-[#10b981]/10' : 'border-gray-700'
                }`}
              >
                <div className="font-semibold capitalize">{goal}</div>
              </button>
            ))}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-700 py-3 rounded-lg">Back</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-[#10b981] text-black py-3 rounded-lg font-semibold">Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-emerald-600" />
              Training Days Per Week
            </h2>
            {[3, 4, 5].map(days => (
              <button
                key={days}
                onClick={() => setProfile({ ...profile, availability: days })}
                className={`w-full p-4 rounded-lg border-2 text-left ${
                  profile.availability === days ? 'border-[#10b981] bg-[#10b981]/10' : 'border-gray-700'
                }`}
              >
                <div className="font-semibold">{days} Days Per Week</div>
                <div className="text-sm text-gray-400">
                  {days === 3 && 'Full Body Split'}
                  {days === 4 && 'Upper/Lower Split'}
                  {days === 5 && 'Body Part Split'}
                </div>
              </button>
            ))}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(3)} className="flex-1 border border-gray-700 py-3 rounded-lg">Back</button>
              <button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="flex-1 bg-[#10b981] text-black py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Dumbbell size={20} />
                    Generate Program
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

