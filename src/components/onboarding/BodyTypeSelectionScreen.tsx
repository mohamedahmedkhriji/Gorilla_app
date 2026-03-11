import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { User, Circle, BoxIcon } from 'lucide-react';
import { SelectionCheck } from '../ui/SelectionCheck';
interface BodyTypeSelectionScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}
export function BodyTypeSelectionScreen({
  onNext,
  onDataChange,
  onboardingData
}: BodyTypeSelectionScreenProps) {
  const initialBodyType = typeof onboardingData?.bodyType === 'string'
    ? onboardingData.bodyType.toLowerCase()
    : null;
  const [selected, setSelected] = useState<string | null>(initialBodyType);
  const types = [
  {
    id: 'ectomorph',
    name: 'Ectomorph',
    desc: 'Lean, slim build. Harder to gain mass.',
    icon: User
  },
  {
    id: 'mesomorph',
    name: 'Mesomorph',
    desc: 'Naturally muscular. Gains muscle easily.',
    icon: BoxIcon
  },
  {
    id: 'endomorph',
    name: 'Endomorph',
    desc: 'Broader build. Gains size easily.',
    icon: Circle
  },
  {
    id: 'unsure',
    name: 'Not Sure',
    desc: 'Let RepSet AI analyze your photos.',
    icon: Zap
  }];

  // Mock Zap icon for the last option
  function Zap(props: any) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}>

        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>);

  }

  const handleNext = () => {
    if (!selected) return;
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Body Type</h2>
        <p className="text-text-secondary">
          This helps RepSet personalize your training and recovery.
        </p>
      </div>

      <div className="space-y-3">
        {types.map((type) => {
          const Icon = type.icon;
          const isSelected = selected === type.id;
          return (
            <button
              key={type.id}
              onClick={() => {
                setSelected(type.id);
                onDataChange?.({
                  bodyType: type.id,
                  bodyTypeLabel: type.name || 'Not Sure',
                });
              }}
              className={`
                w-full p-4 rounded-xl border text-left transition-all duration-200 flex items-center gap-4
                ${isSelected ? 'bg-accent/10 border-accent shadow-[0_0_15px_rgba(191,255,0,0.1)]' : 'bg-card border-white/5 hover:bg-white/5'}
              `}>

              <div
                className={`
                w-12 h-12 rounded-full flex items-center justify-center shrink-0
                ${isSelected ? 'bg-accent text-black' : 'bg-white/5 text-text-tertiary'}
              `}>

                <Icon size={24} />
              </div>

              <div className="flex-1">
                <h3
                  className={`font-bold ${isSelected ? 'text-white' : 'text-white'}`}>

                  {type.name}
                </h3>
                <p
                  className={`text-xs ${isSelected ? 'text-white/80' : 'text-text-secondary'}`}>

                  {type.desc}
                </p>
              </div>

              {isSelected && <SelectionCheck selected size={24} className="shrink-0" />}
            </button>);

        })}
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext} disabled={!selected}>
        Next Step
      </Button>
    </div>);

}
