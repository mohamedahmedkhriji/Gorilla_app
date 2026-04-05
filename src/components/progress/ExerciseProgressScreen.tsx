import React, { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { AppLanguage, getActiveLanguage, getLanguageLocale, pickLanguage } from '../../services/language';

interface ExerciseProgressScreenProps {
  onBack: () => void;
}

const getCopy = (language: AppLanguage) =>
  pickLanguage(language, {
    en: {
      back: 'Back',
      title: 'Exercise Progress',
      totalImprovement: 'Total Improvement',
      noData: 'No data available for this exercise',
      recentSessions: 'Recent Sessions',
      noExercises: 'No tracked exercises yet. Complete a workout to start seeing progress here.',
    },
    ar: {
      back: 'رجوع',
      title: 'تقدم التمارين',
      totalImprovement: 'إجمالي التحسن',
      noData: 'لا توجد بيانات متاحة لهذا التمرين',
      recentSessions: 'الجلسات الأخيرة',
      noExercises: 'لا توجد تمارين مسجلة بعد. أكمل تمرينًا لتبدأ برؤية التقدم هنا.',
    },
    it: {
      back: 'Indietro',
      title: 'Progressi esercizio',
      totalImprovement: 'Miglioramento totale',
      noData: 'Nessun dato disponibile per questo esercizio',
      recentSessions: 'Sessioni recenti',
      noExercises: 'Nessun esercizio tracciato ancora. Completa un allenamento per iniziare a vedere i progressi qui.',
    },
    de: {
      back: 'Zurueck',
      title: 'Trainingsfortschritt',
      totalImprovement: 'Gesamtverbesserung',
      noData: 'Keine Daten fuer diese Uebung verfuegbar',
      recentSessions: 'Letzte Einheiten',
      noExercises: 'Noch keine verfolgten Uebungen vorhanden. Schließe ein Training ab, um hier Fortschritt zu sehen.',
    },
  });

export const ExerciseProgressScreen: React.FC<ExerciseProgressScreenProps> = ({ onBack }) => {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [exercises, setExercises] = useState<string[]>([]);

  const copy = getCopy(language);
  const isArabic = language === 'ar';

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('programHistory') || '[]');
    setWorkoutHistory(history);

    const uniqueExercises = new Set<string>();
    history.forEach((workout: any) => {
      workout.exercises?.forEach((exercise: any) => {
        uniqueExercises.add(exercise.name);
      });
    });
    const exerciseList = Array.from(uniqueExercises);
    setExercises(exerciseList);
    if (exerciseList.length > 0) setSelectedExercise(exerciseList[0]);
  }, []);

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

  const formatShortDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(getLanguageLocale(language), { month: 'short', day: 'numeric' });
  };

  const getExerciseData = () => {
    const data: { date: string; maxWeight: number }[] = [];

    workoutHistory.forEach((workout) => {
      workout.exercises?.forEach((exercise: any) => {
        if (exercise.name === selectedExercise) {
          const maxWeight = Math.max(...exercise.sets.map((set: any) => set.weight || 0));
          if (maxWeight > 0) {
            data.push({
              date: formatShortDate(workout.date),
              maxWeight,
            });
          }
        }
      });
    });

    return data;
  };

  const exerciseData = getExerciseData();
  const maxWeight = Math.max(...exerciseData.map((entry) => entry.maxWeight), 0);
  const minWeight = Math.min(...exerciseData.map((entry) => entry.maxWeight), 0);
  const improvement =
    exerciseData.length > 1 ? exerciseData[exerciseData.length - 1].maxWeight - exerciseData[0].maxWeight : 0;
  const improvementPrefix = improvement > 0 ? '+' : '';

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

        <h1 className="text-2xl font-bold mb-6">{copy.title}</h1>

        {exercises.length === 0 ? (
          <div className="bg-[#242424] rounded-lg p-4 text-sm text-gray-400 mb-6">
            {copy.noExercises}
          </div>
        ) : (
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="w-full bg-[#242424] rounded-lg px-4 py-3 mb-6"
          >
            {exercises.map((exercise) => (
              <option key={exercise} value={exercise}>
                {exercise}
              </option>
            ))}
          </select>
        )}

        {improvement !== 0 && (
          <div className="bg-[#242424] rounded-lg p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">{copy.totalImprovement}</div>
              <div className="text-2xl font-bold text-emerald-600">{improvementPrefix}{improvement.toFixed(1)} kg</div>
            </div>
            <TrendingUp size={32} className="text-emerald-600" />
          </div>
        )}

        {exerciseData.length > 0 ? (
          <div className="bg-[#242424] rounded-lg p-4 mb-6">
            <div className="h-48 relative">
              <svg className="w-full h-full" viewBox="0 0 400 200">
                {exerciseData.map((entry, index) => {
                  const x = (index / Math.max(exerciseData.length - 1, 1)) * 380 + 10;
                  const y = 180 - ((entry.maxWeight - minWeight) / Math.max(maxWeight - minWeight, 1)) * 160;
                  const nextPoint = exerciseData[index + 1];
                  const nextX = nextPoint ? ((index + 1) / Math.max(exerciseData.length - 1, 1)) * 380 + 10 : x;
                  const nextY = nextPoint
                    ? 180 - ((nextPoint.maxWeight - minWeight) / Math.max(maxWeight - minWeight, 1)) * 160
                    : y;

                  return (
                    <g key={index}>
                      {index < exerciseData.length - 1 && (
                        <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#10b981" strokeWidth="2" />
                      )}
                      <circle cx={x} cy={y} r="4" fill="#10b981" />
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>{exerciseData[0]?.date}</span>
              <span>{exerciseData[exerciseData.length - 1]?.date}</span>
            </div>
          </div>
        ) : exercises.length > 0 ? (
          <div className="bg-[#242424] rounded-lg p-8 text-center text-gray-400 mb-6">
            {copy.noData}
          </div>
        ) : null}

        {exerciseData.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{copy.recentSessions}</h2>
            {exerciseData.slice(-5).reverse().map((entry, index) => (
              <div key={index} className="bg-[#242424] rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-gray-400">{entry.date}</span>
                <span className="font-semibold">{entry.maxWeight} kg</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
