import React, { useState } from 'react';
import { Header } from '../components/ui/Header';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
interface CalculatorProps {
  onBack: () => void;
}
export function Calculator({ onBack }: CalculatorProps) {
  const [activeTab, setActiveTab] = useState<'bmr' | 'tdee'>('bmr');
  const [result, setResult] = useState<number | null>(null);
  const calculate = () => {
    // Mock calculation
    setResult(activeTab === 'bmr' ? 1850 : 2600);
  };
  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title="Calculators" onBack={onBack} />
      </div>

      <div className="px-6 mb-6">
        <div className="flex p-1 bg-card rounded-xl border border-white/5">
          <button
            onClick={() => {
              setActiveTab('bmr');
              setResult(null);
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'bmr' ? 'bg-white/10 text-white' : 'text-text-secondary'}`}>

            BMR
          </button>
          <button
            onClick={() => {
              setActiveTab('tdee');
              setResult(null);
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tdee' ? 'bg-white/10 text-white' : 'text-text-secondary'}`}>

            TDEE
          </button>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <Input label="Age" type="number" placeholder="25" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Weight (kg)" type="number" placeholder="75" />
          <Input label="Height (cm)" type="number" placeholder="180" />
        </div>
        <Select
          label="Activity Level"
          options={[
          {
            value: 'sedentary',
            label: 'Sedentary'
          },
          {
            value: 'light',
            label: 'Lightly Active'
          },
          {
            value: 'moderate',
            label: 'Moderately Active'
          },
          {
            value: 'very',
            label: 'Very Active'
          }]
          } />


        <Button onClick={calculate} className="mt-4">
          Calculate {activeTab.toUpperCase()}
        </Button>

        {result &&
        <Card className="mt-6 bg-accent/10 border-accent/20 text-center">
            <div className="text-sm font-medium text-text-secondary mb-1">
              Your Estimated {activeTab.toUpperCase()}
            </div>
            <div className="text-4xl font-black text-accent mb-2">
              {result}{' '}
              <span className="text-lg font-medium text-white">kcal</span>
            </div>
            <p className="text-xs text-text-tertiary">
              {activeTab === 'bmr' ?
            'Basal Metabolic Rate: Calories burned at complete rest.' :
            'Total Daily Energy Expenditure: Estimated daily calorie burn.'}
            </p>
          </Card>
        }
      </div>
    </div>);

}