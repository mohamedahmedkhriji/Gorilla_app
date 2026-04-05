import React, { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { aiCoach } from '../../services/aiCoach';
import { AppLanguage, getActiveLanguage, pickLanguage } from '../../services/language';

interface AIInsightsScreenProps {
  onBack: () => void;
}

const getCopy = (language: AppLanguage) =>
  pickLanguage(language, {
    en: {
      back: 'Back',
      title: 'AI Insights',
      loading: 'Analyzing your progress...',
      regenerate: 'Regenerate Insights',
      error: 'Unable to generate insights at this time. Please try again later.',
      responseLanguage: 'English',
    },
    ar: {
      back: 'رجوع',
      title: 'تحليلات الذكاء الاصطناعي',
      loading: 'جارٍ تحليل تقدمك...',
      regenerate: 'إعادة إنشاء التحليلات',
      error: 'تعذر إنشاء التحليلات الآن. حاول مرة أخرى لاحقًا.',
      responseLanguage: 'Arabic',
    },
    it: {
      back: 'Indietro',
      title: 'Insight AI',
      loading: 'Analisi dei tuoi progressi in corso...',
      regenerate: 'Rigenera insight',
      error: 'Impossibile generare gli insight in questo momento. Riprova piu tardi.',
      responseLanguage: 'Italian',
    },
    de: {
      back: 'Zurueck',
      title: 'KI-Einblicke',
      loading: 'Dein Fortschritt wird analysiert...',
      regenerate: 'Einblicke neu erzeugen',
      error: 'Einblicke koennen derzeit nicht erzeugt werden. Bitte versuche es spaeter erneut.',
      responseLanguage: 'German',
    },
  });

export const AIInsightsScreen: React.FC<AIInsightsScreenProps> = ({ onBack }) => {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [insights, setInsights] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const copy = getCopy(language);
  const isArabic = language === 'ar';

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getActiveLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);

    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
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
        programPhase: activeProgram.phase,
        requestedLanguage: copy.responseLanguage,
      };

      const response = await aiCoach.answerTrainingQuestion(
        `Analyze my training progress and provide detailed insights including overall progress, strengths, weak points, recovery recommendations, nutrition adjustments, and next steps. Respond entirely in ${copy.responseLanguage}.`,
        context,
      );

      setInsights(response);
    } catch (error) {
      console.error('Failed to generate insights:', error);
      setInsights(copy.error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void generateInsights();
  }, [language]);

  return (
    <div
      className={`min-h-screen bg-[#1A1A1A] text-white pb-20 ${isArabic ? 'text-right' : 'text-left'}`}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>{copy.back}</span>
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={24} className="text-emerald-600" />
          <h1 className="text-2xl font-bold">{copy.title}</h1>
        </div>

        {isLoading ? (
          <div className="bg-[#242424] rounded-lg p-8 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400">{copy.loading}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#10b981]/10 to-purple-500/10 border border-[#10b981]/20 rounded-lg p-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {insights}
              </div>
            </div>

            <button
              onClick={() => {
                void generateInsights();
              }}
              className="w-full bg-[#242424] py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#2A2A2A] transition-colors"
            >
              <Sparkles size={16} />
              <span>{copy.regenerate}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
