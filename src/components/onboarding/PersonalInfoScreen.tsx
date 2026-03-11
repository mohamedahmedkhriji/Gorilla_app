import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
interface PersonalInfoScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}
export function PersonalInfoScreen({ onNext, onDataChange, onboardingData }: PersonalInfoScreenProps) {
  const [age, setAge] = useState(String(onboardingData?.age ?? ''));
  const [gender, setGender] = useState(String(onboardingData?.gender ?? ''));
  const [height, setHeight] = useState(String(onboardingData?.height ?? ''));
  const [weight, setWeight] = useState(String(onboardingData?.weight ?? ''));
  const [errors, setErrors] = useState<{ age?: string; gender?: string; height?: string; weight?: string }>({});

  const validate = () => {
    const nextErrors: { age?: string; gender?: string; height?: string; weight?: string } = {};

    const ageValue = Number(age);
    if (!age.trim() || !Number.isFinite(ageValue) || ageValue <= 0) {
      nextErrors.age = 'Age is required';
    }

    if (!gender.trim()) {
      nextErrors.gender = 'Gender is required';
    }

    const heightValue = Number(height);
    if (!height.trim() || !Number.isFinite(heightValue) || heightValue <= 0) {
      nextErrors.height = 'Height is required';
    }

    const weightValue = Number(weight);
    if (!weight.trim() || !Number.isFinite(weightValue) || weightValue <= 0) {
      nextErrors.weight = 'Weight is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    onDataChange?.({ age: parseInt(age, 10), gender, height: parseFloat(height), weight: parseFloat(weight) });
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
        <Input
          label="Age"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g. 28"
          value={age}
          onChange={(e) => {
            const nextValue = e.target.value;
            setAge(nextValue);
            onDataChange?.({ age: nextValue.trim() ? parseInt(nextValue, 10) : undefined });
            if (errors.age) setErrors((prev) => ({ ...prev, age: undefined }));
          }}
          required
          min={1}
          error={errors.age}
        />

        <Select
          label="Gender"
          value={gender}
          onChange={(e) => {
            const nextValue = e.target.value;
            setGender(nextValue);
            onDataChange?.({ gender: nextValue.trim() });
            if (errors.gender) setErrors((prev) => ({ ...prev, gender: undefined }));
          }}
          placeholder="Select gender"
          required
          aria-required="true"
          error={errors.gender}
          options={[
          {
            value: '',
            label: 'Select gender'
          },
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
          <Input
            label="Height"
            placeholder="cm"
            type="number"
            inputMode="decimal"
            pattern="[0-9]*"
            value={height}
            onChange={(e) => {
              const nextValue = e.target.value;
              setHeight(nextValue);
              onDataChange?.({ height: nextValue.trim() ? parseFloat(nextValue) : undefined });
              if (errors.height) setErrors((prev) => ({ ...prev, height: undefined }));
            }}
            required
            min={1}
            error={errors.height}
          />
          <Input
            label="Weight"
            placeholder="kg"
            type="number"
            inputMode="decimal"
            pattern="[0-9]*"
            value={weight}
            onChange={(e) => {
              const nextValue = e.target.value;
              setWeight(nextValue);
              onDataChange?.({ weight: nextValue.trim() ? parseFloat(nextValue) : undefined });
              if (errors.weight) setErrors((prev) => ({ ...prev, weight: undefined }));
            }}
            required
            min={1}
            error={errors.weight}
          />
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>Next Step</Button>
    </div>);

}
