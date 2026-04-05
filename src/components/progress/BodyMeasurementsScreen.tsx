import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { AppLanguage, getActiveLanguage, getLanguageLocale, pickLanguage } from '../../services/language';

interface Measurement {
  date: string;
  weight: number;
  bodyFat?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
}

interface BodyMeasurementsScreenProps {
  onBack: () => void;
}

const getCopy = (language: AppLanguage) =>
  pickLanguage(language, {
    en: {
      back: 'Back',
      title: 'Body Measurements',
      weightPlaceholder: 'Weight (kg)',
      bodyFatPlaceholder: 'Body Fat %',
      chestPlaceholder: 'Chest (cm)',
      waistPlaceholder: 'Waist (cm)',
      armsPlaceholder: 'Arms (cm)',
      thighsPlaceholder: 'Thighs (cm)',
      saveMeasurement: 'Save Measurement',
      weight: 'Weight',
      bodyFat: 'Body Fat',
      chest: 'Chest',
      history: 'History',
      empty: 'No body measurements yet. Add your first check-in to start tracking progress.',
    },
    ar: {
      back: 'رجوع',
      title: 'قياسات الجسم',
      weightPlaceholder: 'الوزن (كجم)',
      bodyFatPlaceholder: 'دهون الجسم %',
      chestPlaceholder: 'الصدر (سم)',
      waistPlaceholder: 'الخصر (سم)',
      armsPlaceholder: 'الذراعان (سم)',
      thighsPlaceholder: 'الفخذان (سم)',
      saveMeasurement: 'حفظ القياس',
      weight: 'الوزن',
      bodyFat: 'دهون الجسم',
      chest: 'الصدر',
      history: 'السجل',
      empty: 'لا توجد قياسات جسم بعد. أضف أول تسجيل لبدء متابعة التقدم.',
    },
    it: {
      back: 'Indietro',
      title: 'Misure corporee',
      weightPlaceholder: 'Peso (kg)',
      bodyFatPlaceholder: 'Massa grassa %',
      chestPlaceholder: 'Petto (cm)',
      waistPlaceholder: 'Vita (cm)',
      armsPlaceholder: 'Braccia (cm)',
      thighsPlaceholder: 'Cosce (cm)',
      saveMeasurement: 'Salva misurazione',
      weight: 'Peso',
      bodyFat: 'Massa grassa',
      chest: 'Petto',
      history: 'Cronologia',
      empty: 'Nessuna misurazione corporea ancora. Aggiungi il tuo primo check-in per iniziare a monitorare i progressi.',
    },
    de: {
      back: 'Zurueck',
      title: 'Koerpermessungen',
      weightPlaceholder: 'Gewicht (kg)',
      bodyFatPlaceholder: 'Koerperfett %',
      chestPlaceholder: 'Brust (cm)',
      waistPlaceholder: 'Taille (cm)',
      armsPlaceholder: 'Arme (cm)',
      thighsPlaceholder: 'Oberschenkel (cm)',
      saveMeasurement: 'Messung speichern',
      weight: 'Gewicht',
      bodyFat: 'Koerperfett',
      chest: 'Brust',
      history: 'Verlauf',
      empty: 'Noch keine Koerpermessungen vorhanden. Fuege deinen ersten Check-in hinzu, um den Fortschritt zu verfolgen.',
    },
  });

export const BodyMeasurementsScreen: React.FC<BodyMeasurementsScreenProps> = ({ onBack }) => {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMeasurement, setNewMeasurement] = useState<Partial<Measurement>>({
    date: new Date().toISOString().split('T')[0],
    weight: 0,
    bodyFat: 0,
  });

  const copy = getCopy(language);
  const isArabic = language === 'ar';

  useEffect(() => {
    const saved = localStorage.getItem('bodyMeasurements');
    if (saved) setMeasurements(JSON.parse(saved));
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

  const handleAdd = () => {
    const updated = [...measurements, newMeasurement as Measurement].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    setMeasurements(updated);
    localStorage.setItem('bodyMeasurements', JSON.stringify(updated));
    setShowAddForm(false);
    setNewMeasurement({ date: new Date().toISOString().split('T')[0], weight: 0, bodyFat: 0 });
  };

  const latest = measurements[0];
  const previous = measurements[1];
  const weightChange = latest && previous ? latest.weight - previous.weight : 0;
  const bodyFatChange =
    latest && previous && latest.bodyFat && previous.bodyFat ? latest.bodyFat - previous.bodyFat : 0;
  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(getLanguageLocale(language));
  };

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

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-[#10b981] text-black p-2 rounded-lg"
            aria-label={copy.saveMeasurement}
          >
            <Plus size={20} />
          </button>
        </div>

        {showAddForm && (
          <div className="bg-[#242424] rounded-lg p-4 mb-6 space-y-3">
            <input
              type="date"
              value={newMeasurement.date}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, date: e.target.value })}
              className="w-full bg-[#1A1A1A] rounded px-3 py-2"
            />
            <input
              type="number"
              placeholder={copy.weightPlaceholder}
              value={newMeasurement.weight || ''}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, weight: Number(e.target.value) })}
              className="w-full bg-[#1A1A1A] rounded px-3 py-2"
            />
            <input
              type="number"
              placeholder={copy.bodyFatPlaceholder}
              value={newMeasurement.bodyFat || ''}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, bodyFat: Number(e.target.value) })}
              className="w-full bg-[#1A1A1A] rounded px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder={copy.chestPlaceholder}
                value={newMeasurement.chest || ''}
                onChange={(e) => setNewMeasurement({ ...newMeasurement, chest: Number(e.target.value) })}
                className="bg-[#1A1A1A] rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder={copy.waistPlaceholder}
                value={newMeasurement.waist || ''}
                onChange={(e) => setNewMeasurement({ ...newMeasurement, waist: Number(e.target.value) })}
                className="bg-[#1A1A1A] rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder={copy.armsPlaceholder}
                value={newMeasurement.arms || ''}
                onChange={(e) => setNewMeasurement({ ...newMeasurement, arms: Number(e.target.value) })}
                className="bg-[#1A1A1A] rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder={copy.thighsPlaceholder}
                value={newMeasurement.thighs || ''}
                onChange={(e) => setNewMeasurement({ ...newMeasurement, thighs: Number(e.target.value) })}
                className="bg-[#1A1A1A] rounded px-3 py-2"
              />
            </div>
            <button onClick={handleAdd} className="w-full bg-[#10b981] text-black py-2 rounded-lg font-semibold">
              {copy.saveMeasurement}
            </button>
          </div>
        )}

        {latest && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#242424] rounded-lg p-4">
              <div className="text-3xl font-bold">{latest.weight} kg</div>
              <div className="text-sm text-gray-400 mt-1">{copy.weight}</div>
              {weightChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs mt-2 ${weightChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {weightChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{Math.abs(weightChange).toFixed(1)} kg</span>
                </div>
              )}
            </div>
            {latest.bodyFat && (
              <div className="bg-[#242424] rounded-lg p-4">
                <div className="text-3xl font-bold">{latest.bodyFat}%</div>
                <div className="text-sm text-gray-400 mt-1">{copy.bodyFat}</div>
                {bodyFatChange !== 0 && (
                  <div className={`flex items-center gap-1 text-xs mt-2 ${bodyFatChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {bodyFatChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span>{Math.abs(bodyFatChange).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold mb-3">{copy.history}</h2>
        {measurements.length === 0 ? (
          <div className="bg-[#242424] rounded-lg p-4 text-sm text-gray-400">
            {copy.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {measurements.map((measurement, idx) => (
              <div key={idx} className="bg-[#242424] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar size={14} />
                    <span>{formatDate(measurement.date)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400">{copy.weight}</div>
                    <div className="font-semibold">{measurement.weight} kg</div>
                  </div>
                  {measurement.bodyFat && (
                    <div>
                      <div className="text-gray-400">{copy.bodyFat}</div>
                      <div className="font-semibold">{measurement.bodyFat}%</div>
                    </div>
                  )}
                  {measurement.chest && (
                    <div>
                      <div className="text-gray-400">{copy.chest}</div>
                      <div className="font-semibold">{measurement.chest} cm</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
