import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

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

export const BodyMeasurementsScreen: React.FC<BodyMeasurementsScreenProps> = ({ onBack }) => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMeasurement, setNewMeasurement] = useState<Partial<Measurement>>({
    date: new Date().toISOString().split('T')[0],
    weight: 0,
    bodyFat: 0
  });

  useEffect(() => {
    const saved = localStorage.getItem('bodyMeasurements');
    if (saved) setMeasurements(JSON.parse(saved));
  }, []);

  const handleAdd = () => {
    const updated = [...measurements, newMeasurement as Measurement].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setMeasurements(updated);
    localStorage.setItem('bodyMeasurements', JSON.stringify(updated));
    setShowAddForm(false);
    setNewMeasurement({ date: new Date().toISOString().split('T')[0], weight: 0, bodyFat: 0 });
  };

  const latest = measurements[0];
  const previous = measurements[1];
  const weightChange = latest && previous ? latest.weight - previous.weight : 0;
  const bodyFatChange = latest && previous && latest.bodyFat && previous.bodyFat 
    ? latest.bodyFat - previous.bodyFat : 0;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Body Measurements</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-[#BFFF00] text-black p-2 rounded-lg"
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
              placeholder="Weight (kg)"
              value={newMeasurement.weight || ''}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, weight: Number(e.target.value) })}
              className="w-full bg-[#1A1A1A] rounded px-3 py-2"
            />
            <input
              type="number"
              placeholder="Body Fat %"
              value={newMeasurement.bodyFat || ''}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, bodyFat: Number(e.target.value) })}
              className="w-full bg-[#1A1A1A] rounded px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Chest (cm)"
                value={newMeasurement.chest || ''}
                onChange={(e) => setNewMeasurement({ ...newMeasurement, chest: Number(e.target.value) })}
                className="bg-[#1A1A1A] rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Waist (cm)"
                value={newMeasurement.waist || ''}
                onChange={(e) => setNewMeasurement({ ...newMeasurement, waist: Number(e.target.value) })}
                className="bg-[#1A1A1A] rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Arms (cm)"
                value={newMeasurement.arms || ''}
                onChange={(e) => setNewMeasurement({ ...newMeasurement, arms: Number(e.target.value) })}
                className="bg-[#1A1A1A] rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Thighs (cm)"
                value={newMeasurement.thighs || ''}
                onChange={(e) => setNewMeasurement({ ...newMeasurement, thighs: Number(e.target.value) })}
                className="bg-[#1A1A1A] rounded px-3 py-2"
              />
            </div>
            <button onClick={handleAdd} className="w-full bg-[#BFFF00] text-black py-2 rounded-lg font-semibold">
              Save Measurement
            </button>
          </div>
        )}

        {latest && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#242424] rounded-lg p-4">
              <div className="text-3xl font-bold">{latest.weight}kg</div>
              <div className="text-sm text-gray-400 mt-1">Weight</div>
              {weightChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs mt-2 ${weightChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {weightChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{Math.abs(weightChange).toFixed(1)}kg</span>
                </div>
              )}
            </div>
            {latest.bodyFat && (
              <div className="bg-[#242424] rounded-lg p-4">
                <div className="text-3xl font-bold">{latest.bodyFat}%</div>
                <div className="text-sm text-gray-400 mt-1">Body Fat</div>
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

        <h2 className="text-lg font-semibold mb-3">History</h2>
        <div className="space-y-3">
          {measurements.map((m, idx) => (
            <div key={idx} className="bg-[#242424] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar size={14} />
                  <span>{new Date(m.date).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-400">Weight</div>
                  <div className="font-semibold">{m.weight}kg</div>
                </div>
                {m.bodyFat && (
                  <div>
                    <div className="text-gray-400">Body Fat</div>
                    <div className="font-semibold">{m.bodyFat}%</div>
                  </div>
                )}
                {m.chest && (
                  <div>
                    <div className="text-gray-400">Chest</div>
                    <div className="font-semibold">{m.chest}cm</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
