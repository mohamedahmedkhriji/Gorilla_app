import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DEFAULT_ONBOARDING_CONFIG, type SelectOption } from '../../config/onboardingConfig';
import { getOnboardingLanguage } from './onboardingI18n';

const MAX_BODY_METRIC = 250;

interface PersonalInfoScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  genderOptions?: SelectOption[];
}

const COPY = {
  en: {
    title: 'Tell us about yourself',
    subtitle: 'We use this to calibrate your initial plan.',
    age: 'Age',
    gender: 'Gender',
    height: 'Height',
    weight: 'Weight',
    next: 'Next Step',
    ageRequired: 'Age is required',
    genderRequired: 'Gender is required',
    heightRequired: 'Height is required',
    weightRequired: 'Weight is required',
    heightMax: `Height must be ${MAX_BODY_METRIC} cm or less`,
    weightMax: `Weight must be ${MAX_BODY_METRIC} kg or less`,
    agePlaceholder: 'e.g. 28',
    heightPlaceholder: 'cm',
    weightPlaceholder: 'kg',
    male: 'Man',
    female: 'Woman',
  },
  ar: {
    title: '\u0623\u062e\u0628\u0631\u0646\u0627 \u0639\u0646 \u0646\u0641\u0633\u0643',
    subtitle: '\u0646\u0633\u062a\u062e\u062f\u0645 \u0647\u0630\u0627 \u0644\u0636\u0628\u0637 \u062e\u0637\u062a\u0643 \u0627\u0644\u0623\u0648\u0644\u0649.',
    age: '\u0627\u0644\u0639\u0645\u0631',
    gender: '\u0627\u0644\u062c\u0646\u0633',
    height: '\u0627\u0644\u0637\u0648\u0644',
    weight: '\u0627\u0644\u0648\u0632\u0646',
    next: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
    ageRequired: '\u0627\u0644\u0639\u0645\u0631 \u0645\u0637\u0644\u0648\u0628',
    genderRequired: '\u0627\u0644\u062c\u0646\u0633 \u0645\u0637\u0644\u0648\u0628',
    heightRequired: '\u0627\u0644\u0637\u0648\u0644 \u0645\u0637\u0644\u0648\u0628',
    weightRequired: '\u0627\u0644\u0648\u0632\u0646 \u0645\u0637\u0644\u0648\u0628',
    heightMax: `\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u0637\u0648\u0644 ${MAX_BODY_METRIC} \u0633\u0645 \u0623\u0648 \u0623\u0642\u0644`,
    weightMax: `\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u0648\u0632\u0646 ${MAX_BODY_METRIC} \u0643\u062c\u0645 \u0623\u0648 \u0623\u0642\u0644`,
    agePlaceholder: '\u0645\u062b\u0627\u0644: 28',
    heightPlaceholder: '\u0633\u0645',
    weightPlaceholder: '\u0643\u062c\u0645',
    male: '\u0630\u0643\u0631',
    female: '\u0623\u0646\u062b\u0649',
  },
  it: {
    title: 'Parlaci di te',
    subtitle: 'Usiamo queste informazioni per calibrare il tuo primo piano.',
    age: 'Eta',
    gender: 'Genere',
    height: 'Altezza',
    weight: 'Peso',
    next: 'Prossimo passo',
    ageRequired: 'L eta e obbligatoria',
    genderRequired: 'Il genere e obbligatorio',
    heightRequired: 'L altezza e obbligatoria',
    weightRequired: 'Il peso e obbligatorio',
    heightMax: `L altezza deve essere ${MAX_BODY_METRIC} cm o meno`,
    weightMax: `Il peso deve essere ${MAX_BODY_METRIC} kg o meno`,
    agePlaceholder: 'es. 28',
    heightPlaceholder: 'cm',
    weightPlaceholder: 'kg',
    male: 'Uomo',
    female: 'Donna',
  },
  de: {
    title: 'Erzaehl uns etwas ueber dich',
    subtitle: 'Wir nutzen das, um deinen ersten Plan anzupassen.',
    age: 'Alter',
    gender: 'Geschlecht',
    height: 'Groesse',
    weight: 'Gewicht',
    next: 'Naechster Schritt',
    ageRequired: 'Alter ist erforderlich',
    genderRequired: 'Geschlecht ist erforderlich',
    heightRequired: 'Groesse ist erforderlich',
    weightRequired: 'Gewicht ist erforderlich',
    heightMax: `Die Groesse muss ${MAX_BODY_METRIC} cm oder weniger sein`,
    weightMax: `Das Gewicht muss ${MAX_BODY_METRIC} kg oder weniger sein`,
    agePlaceholder: 'z. B. 28',
    heightPlaceholder: 'cm',
    weightPlaceholder: 'kg',
    male: 'Mann',
    female: 'Frau',
  },
} as const;

export function PersonalInfoScreen({
  onNext,
  onDataChange,
  onboardingData,
  genderOptions,
}: PersonalInfoScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const genderSelectOptions = genderOptions?.length
    ? genderOptions
    : DEFAULT_ONBOARDING_CONFIG.options.genders;
  const genderButtonOptions = genderSelectOptions
    .filter((option) => ['male', 'female'].includes(String(option?.value || '').trim().toLowerCase()))
    .map((option) => ({
      value: String(option.value || '').trim().toLowerCase(),
      label: String(option.value || '').trim().toLowerCase() === 'male' ? copy.male : copy.female,
    }));

  if (!genderButtonOptions.length) {
    genderButtonOptions.push(
      { value: 'male', label: copy.male },
      { value: 'female', label: copy.female },
    );
  }

  const [age, setAge] = useState(String(onboardingData?.age ?? ''));
  const [gender, setGender] = useState(String(onboardingData?.gender ?? '').trim().toLowerCase());
  const [height, setHeight] = useState(String(onboardingData?.height ?? ''));
  const [weight, setWeight] = useState(String(onboardingData?.weight ?? ''));
  const [errors, setErrors] = useState<{ age?: string; gender?: string; height?: string; weight?: string }>({});

  const validate = () => {
    const nextErrors: { age?: string; gender?: string; height?: string; weight?: string } = {};

    const ageValue = Number(age);
    if (!age.trim() || !Number.isFinite(ageValue) || ageValue <= 0) {
      nextErrors.age = copy.ageRequired;
    }

    if (!gender.trim()) {
      nextErrors.gender = copy.genderRequired;
    }

    const heightValue = Number(height);
    if (!height.trim() || !Number.isFinite(heightValue) || heightValue <= 0) {
      nextErrors.height = copy.heightRequired;
    } else if (heightValue > MAX_BODY_METRIC) {
      nextErrors.height = copy.heightMax;
    }

    const weightValue = Number(weight);
    if (!weight.trim() || !Number.isFinite(weightValue) || weightValue <= 0) {
      nextErrors.weight = copy.weightRequired;
    } else if (weightValue > MAX_BODY_METRIC) {
      nextErrors.weight = copy.weightMax;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    onDataChange?.({
      age: parseInt(age, 10),
      gender: gender.trim().toLowerCase(),
      height: parseFloat(height),
      weight: parseFloat(weight),
    });
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="space-y-4">
        <Input
          label={copy.age}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={copy.agePlaceholder}
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

        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary ml-1">
            {copy.gender} <span className="text-accent">*</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {genderButtonOptions.map((option) => {
              const selected = gender === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setGender(option.value);
                    onDataChange?.({ gender: option.value });
                    if (errors.gender) setErrors((prev) => ({ ...prev, gender: undefined }));
                  }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    selected
                      ? 'border-accent bg-accent/15 text-white'
                      : 'border-white/15 bg-white/[0.03] text-text-secondary hover:border-white/25 hover:bg-white/[0.05]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {errors.gender ? <p className="text-xs text-red-400 ml-1">{errors.gender}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={copy.height}
            placeholder={copy.heightPlaceholder}
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
            max={MAX_BODY_METRIC}
            error={errors.height}
          />
          <Input
            label={copy.weight}
            placeholder={copy.weightPlaceholder}
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
            max={MAX_BODY_METRIC}
            error={errors.weight}
          />
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>{copy.next}</Button>
    </div>
  );
}
