import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Camera } from 'lucide-react';
import { AppLanguage, getActiveLanguage, getLanguageLocale, pickLanguage } from '../../services/language';

interface ProgressPhoto {
  date: string;
  front?: string;
  side?: string;
  back?: string;
}

interface ProgressPhotosScreenProps {
  onBack: () => void;
}

const getCopy = (language: AppLanguage) =>
  pickLanguage(language, {
    en: {
      back: 'Back',
      title: 'Progress Photos',
      compare: 'Compare',
      gallery: 'Gallery',
      timeline: 'Timeline',
      empty: 'No progress photos yet. Upload your first set to start comparing changes.',
      needTwoPhotos: 'Add at least two progress photos to use compare mode.',
      front: 'Front',
      side: 'Side',
      backView: 'Back',
      before: 'Before',
      after: 'After',
    },
    ar: {
      back: 'رجوع',
      title: 'صور التقدم',
      compare: 'مقارنة',
      gallery: 'المعرض',
      timeline: 'الجدول الزمني',
      empty: 'لا توجد صور تقدم بعد. ارفع أول مجموعة صور لبدء مقارنة التغييرات.',
      needTwoPhotos: 'أضف صورتين على الأقل لاستخدام وضع المقارنة.',
      front: 'أمام',
      side: 'جانب',
      backView: 'خلف',
      before: 'قبل',
      after: 'بعد',
    },
    it: {
      back: 'Indietro',
      title: 'Foto dei progressi',
      compare: 'Confronta',
      gallery: 'Galleria',
      timeline: 'Timeline',
      empty: 'Nessuna foto dei progressi ancora. Carica il primo set per iniziare a confrontare i cambiamenti.',
      needTwoPhotos: 'Aggiungi almeno due foto dei progressi per usare la modalita confronto.',
      front: 'Fronte',
      side: 'Lato',
      backView: 'Retro',
      before: 'Prima',
      after: 'Dopo',
    },
    de: {
      back: 'Zurueck',
      title: 'Fortschrittsfotos',
      compare: 'Vergleichen',
      gallery: 'Galerie',
      timeline: 'Zeitverlauf',
      empty: 'Noch keine Fortschrittsfotos vorhanden. Lade dein erstes Set hoch, um Veraenderungen zu vergleichen.',
      needTwoPhotos: 'Fuege mindestens zwei Fortschrittsfotos hinzu, um den Vergleichsmodus zu nutzen.',
      front: 'Vorne',
      side: 'Seite',
      backView: 'Hinten',
      before: 'Vorher',
      after: 'Nachher',
    },
  });

export const ProgressPhotosScreen: React.FC<ProgressPhotosScreenProps> = ({ onBack }) => {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<[number, number]>([0, 1]);

  const copy = getCopy(language);
  const isArabic = language === 'ar';

  useEffect(() => {
    const saved = localStorage.getItem('progressPhotos');
    if (saved) setPhotos(JSON.parse(saved));
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

  const handlePhotoUpload = (type: 'front' | 'side' | 'back', file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto: ProgressPhoto = {
        date: new Date().toISOString().split('T')[0],
        [type]: reader.result as string,
      };
      const updated = [newPhoto, ...photos];
      setPhotos(updated);
      localStorage.setItem('progressPhotos', JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(getLanguageLocale(language));
  };

  const poseLabels = {
    front: copy.front,
    side: copy.side,
    back: copy.backView,
  } as const;

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
            onClick={() => setCompareMode(!compareMode)}
            className="text-sm bg-[#242424] px-4 py-2 rounded-lg"
          >
            {compareMode ? copy.gallery : copy.compare}
          </button>
        </div>

        {!compareMode ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(['front', 'side', 'back'] as const).map((type) => (
                <label key={type} className="cursor-pointer">
                  <div className="aspect-[3/4] bg-[#242424] rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-700 hover:border-[#10b981] transition-colors">
                    <Camera size={24} className="text-gray-400 mb-2" />
                    <span className="text-xs text-gray-400">{poseLabels[type]}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(type, file);
                    }}
                  />
                </label>
              ))}
            </div>

            <h2 className="text-lg font-semibold mb-3">{copy.timeline}</h2>
            {photos.length === 0 ? (
              <div className="bg-[#242424] rounded-lg p-4 text-sm text-gray-400">
                {copy.empty}
              </div>
            ) : (
              <div className="space-y-4">
                {photos.map((photo, idx) => (
                  <div key={idx} className="bg-[#242424] rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                      <Calendar size={14} />
                      <span>{formatDate(photo.date)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {photo.front && (
                        <img src={photo.front} alt={copy.front} className="w-full aspect-[3/4] object-cover rounded" />
                      )}
                      {photo.side && (
                        <img src={photo.side} alt={copy.side} className="w-full aspect-[3/4] object-cover rounded" />
                      )}
                      {photo.back && (
                        <img src={photo.back} alt={copy.backView} className="w-full aspect-[3/4] object-cover rounded" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : photos.length < 2 ? (
          <div className="bg-[#242424] rounded-lg p-4 text-sm text-gray-400">
            {copy.needTwoPhotos}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <select
                value={selectedPhotos[0]}
                onChange={(e) => setSelectedPhotos([Number(e.target.value), selectedPhotos[1]])}
                className="flex-1 bg-[#242424] rounded px-3 py-2"
              >
                {photos.map((photo, index) => (
                  <option key={index} value={index}>
                    {formatDate(photo.date)}
                  </option>
                ))}
              </select>
              <select
                value={selectedPhotos[1]}
                onChange={(e) => setSelectedPhotos([selectedPhotos[0], Number(e.target.value)])}
                className="flex-1 bg-[#242424] rounded px-3 py-2"
              >
                {photos.map((photo, index) => (
                  <option key={index} value={index}>
                    {formatDate(photo.date)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {photos[selectedPhotos[0]]?.front && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">{copy.before}</div>
                  <img src={photos[selectedPhotos[0]].front} alt={copy.before} className="w-full aspect-[3/4] object-cover rounded" />
                </div>
              )}
              {photos[selectedPhotos[1]]?.front && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">{copy.after}</div>
                  <img src={photos[selectedPhotos[1]].front} alt={copy.after} className="w-full aspect-[3/4] object-cover rounded" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
