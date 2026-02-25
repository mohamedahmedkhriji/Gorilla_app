import React, { useState, useEffect } from 'react';
import { ArrowLeft, Camera, Calendar } from 'lucide-react';

interface ProgressPhoto {
  date: string;
  front?: string;
  side?: string;
  back?: string;
}

interface ProgressPhotosScreenProps {
  onBack: () => void;
}

export const ProgressPhotosScreen: React.FC<ProgressPhotosScreenProps> = ({ onBack }) => {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<[number, number]>([0, 1]);

  useEffect(() => {
    const saved = localStorage.getItem('progressPhotos');
    if (saved) setPhotos(JSON.parse(saved));
  }, []);

  const handlePhotoUpload = (type: 'front' | 'side' | 'back', file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto: ProgressPhoto = {
        date: new Date().toISOString().split('T')[0],
        [type]: reader.result as string
      };
      const updated = [newPhoto, ...photos];
      setPhotos(updated);
      localStorage.setItem('progressPhotos', JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Progress Photos</h1>
          <button
            onClick={() => setCompareMode(!compareMode)}
            className="text-sm bg-[#242424] px-4 py-2 rounded-lg"
          >
            {compareMode ? 'Gallery' : 'Compare'}
          </button>
        </div>

        {!compareMode ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {['front', 'side', 'back'].map((type) => (
                <label key={type} className="cursor-pointer">
                  <div className="aspect-[3/4] bg-[#242424] rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-700 hover:border-[#BFFF00] transition-colors">
                    <Camera size={24} className="text-gray-400 mb-2" />
                    <span className="text-xs text-gray-400 capitalize">{type}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(type as any, file);
                    }}
                  />
                </label>
              ))}
            </div>

            <h2 className="text-lg font-semibold mb-3">Timeline</h2>
            <div className="space-y-4">
              {photos.map((photo, idx) => (
                <div key={idx} className="bg-[#242424] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                    <Calendar size={14} />
                    <span>{new Date(photo.date).toLocaleDateString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {photo.front && (
                      <img src={photo.front} alt="Front" className="w-full aspect-[3/4] object-cover rounded" />
                    )}
                    {photo.side && (
                      <img src={photo.side} alt="Side" className="w-full aspect-[3/4] object-cover rounded" />
                    )}
                    {photo.back && (
                      <img src={photo.back} alt="Back" className="w-full aspect-[3/4] object-cover rounded" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <select
                value={selectedPhotos[0]}
                onChange={(e) => setSelectedPhotos([Number(e.target.value), selectedPhotos[1]])}
                className="flex-1 bg-[#242424] rounded px-3 py-2"
              >
                {photos.map((p, i) => (
                  <option key={i} value={i}>{new Date(p.date).toLocaleDateString()}</option>
                ))}
              </select>
              <select
                value={selectedPhotos[1]}
                onChange={(e) => setSelectedPhotos([selectedPhotos[0], Number(e.target.value)])}
                className="flex-1 bg-[#242424] rounded px-3 py-2"
              >
                {photos.map((p, i) => (
                  <option key={i} value={i}>{new Date(p.date).toLocaleDateString()}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {photos[selectedPhotos[0]]?.front && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Before</div>
                  <img src={photos[selectedPhotos[0]].front} alt="Before" className="w-full aspect-[3/4] object-cover rounded" />
                </div>
              )}
              {photos[selectedPhotos[1]]?.front && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">After</div>
                  <img src={photos[selectedPhotos[1]].front} alt="After" className="w-full aspect-[3/4] object-cover rounded" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
