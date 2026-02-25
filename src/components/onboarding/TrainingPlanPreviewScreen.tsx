import React from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Calendar, Dumbbell, Zap } from 'lucide-react';
interface TrainingPlanPreviewScreenProps {
  onComplete: () => void;
}
export function TrainingPlanPreviewScreen({
  onComplete
}: TrainingPlanPreviewScreenProps) {
  
  const handleFinish = async () => {
    onComplete();
  };
  
  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Your Custom Plan</h2>
        <p className="text-text-secondary">
          Designed for muscle gain & core strength.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-white/5">
          <Calendar className="text-accent mb-2" size={20} />
          <div className="text-lg font-bold text-white">4 Days</div>
          <div className="text-xs text-text-tertiary">Per Week</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-white/5">
          <Zap className="text-yellow-500 mb-2" size={20} />
          <div className="text-lg font-bold text-white">High</div>
          <div className="text-xs text-text-tertiary">Intensity</div>
        </div>
      </div>

      <Card>
        <h3 className="text-sm font-medium text-white mb-4">Weekly Split</h3>
        <div className="space-y-3">
          {[
          'Upper Power',
          'Lower Power',
          'Rest',
          'Push Hypertrophy',
          'Pull Hypertrophy',
          'Legs Hypertrophy',
          'Rest'].
          map((day, i) =>
          <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-text-secondary font-medium">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
              </div>
              <span
              className={`text-sm ${day === 'Rest' ? 'text-text-tertiary' : 'text-white'}`}>

                {day}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card className="bg-accent/10 border-accent/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent rounded-lg text-white">
            <Dumbbell size={20} />
          </div>
          <div>
            <h3 className="font-medium text-white">Ready to start?</h3>
            <p className="text-xs text-text-secondary mt-1">
              Your first workout "Upper Power" is ready.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex-1" />

      <Button onClick={handleFinish}>Enter App</Button>
    </div>);

}