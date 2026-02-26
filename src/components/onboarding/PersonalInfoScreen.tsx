import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
interface PersonalInfoScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
}
export function PersonalInfoScreen({ onNext, onDataChange }: PersonalInfoScreenProps) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const handleNext = () => {
    onDataChange?.({ age: parseInt(age), gender: gender || 'Male', height: parseFloat(height), weight: parseFloat(weight) });
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">
          Tell us about yourself
        </h2>
        <p className="text-text-secondary">
          We use this to calibrate your initial plan.
        </p>
      </div>

      <div className="space-y-4">
        <Input label="Age" type="number" placeholder="e.g. 28" value={age} onChange={(e) => setAge(e.target.value)} />

        <Select
          label="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          options={[
          {
            value: 'Male',
            label: 'Male'
          },
          {
            value: 'Female',
            label: 'Female'
          }]
          } />


        <div className="grid grid-cols-2 gap-4">
          <Input label="Height" placeholder="cm" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          <Input label="Weight" placeholder="kg" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>Next Step</Button>
    </div>);

}
