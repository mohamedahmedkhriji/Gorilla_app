import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { aiCoach } from '../../services/aiCoach';

interface AIInsightsScreenProps {
  onBack: () => void;
}

export const AIInsightsScreen: React.FC<AIInsightsScreenProps> = ({ onBack }) => {
  const [insights, setInsights] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateInsights();
  }, []);

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      const workoutHistory = JSON.parse(localStorage.getItem('programHistory') || '[]');
      const measurements = JSON.parse(localStorage.getItem('bodyMeasurements') || '[]');
      const activeProgram = JSON.parse(localStorage.getItem('activeProgram') || '{}');

      const context = {
        totalWorkouts: workoutHistory.length,
        recentWorkouts: workoutHistory.slice(-5),
        latestMeasurement: measurements[0],
        programWeek: activeProgram.currentWeek,
        programPhase: activeProgram.phase
      };

      const response = await aiCoach.answerTrainingQuestion(
        `Analyze my training progress and provide detailed insights including:
1. Overall progress assessment
2. Strengths and areas for improvement
3. Recovery recommendations
4. Nutrition adjustments
5. Next steps for continued progress`,
        context
      );

      setInsights(response);
    } catch (error) {
      console.error('Failed to generate insights:', error);
      setInsights('Unable to generate insights at this time. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={24} className="text-[#BFFF00]" />
          <h1 className="text-2xl font-bold">AI Insights</h1>
        </div>

        {isLoading ? (
          <div className="bg-[#242424] rounded-lg p-8 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#BFFF00] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Analyzing your progress...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#BFFF00]/10 to-purple-500/10 border border-[#BFFF00]/20 rounded-lg p-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {insights}
              </div>
            </div>

            <button
              onClick={generateInsights}
              className="w-full bg-[#242424] py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#2A2A2A] transition-colors"
            >
              <Sparkles size={16} />
              <span>Regenerate Insights</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
