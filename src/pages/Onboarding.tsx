import React, { useCallback, useEffect, useState } from 'react';
import { OnboardingLayout } from '../components/onboarding/OnboardingLayout';
import { AppMotivationScreen } from '../components/onboarding/AppMotivationScreen';
import { WelcomeScreen } from '../components/onboarding/WelcomeScreen';
import { PersonalInfoScreen } from '../components/onboarding/PersonalInfoScreen';
import { FitnessBackgroundScreen } from '../components/onboarding/FitnessBackgroundScreen';
import { BodyTypeSelectionScreen } from '../components/onboarding/BodyTypeSelectionScreen';
import { GoalsAvailabilityScreen } from '../components/onboarding/GoalsAvailabilityScreen';
import { WorkoutSplitScreen } from '../components/onboarding/WorkoutSplitScreen';
import { GymSelectionScreen } from '../components/onboarding/GymSelectionScreen';
import { BodyImageUploadScreen } from '../components/onboarding/BodyImageUploadScreen';
import { AIAnalysisScreen } from '../components/onboarding/AIAnalysisScreen';
import { BodyAnalysisResultsScreen } from '../components/onboarding/BodyAnalysisResultsScreen';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<any>({});
  
  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);
  
  const handleComplete = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      user.onboarding_completed = true;
      user.first_login = false;
      localStorage.setItem('appUser', JSON.stringify(user));
      localStorage.setItem('appUserId', String(user.id || ''));
      localStorage.setItem('user', JSON.stringify(user));
      onComplete();
    } catch (error) {
      console.error('Error:', error);
      onComplete();
    }
  }, [onComplete]);
  const steps = [
  {
    component: AppMotivationScreen,
    title: 'Motivation',
    showBack: false
  },
  {
    component: WelcomeScreen,
    title: ''
  },
  {
    component: PersonalInfoScreen,
    title: 'Personal Info'
  },
  {
    component: FitnessBackgroundScreen,
    title: 'Background'
  },
  {
    component: BodyTypeSelectionScreen,
    title: 'Body Type'
  },
  {
    component: GoalsAvailabilityScreen,
    title: 'Goals'
  },
  {
    component: GymSelectionScreen,
    title: 'Select Gym'
  },
  {
    component: BodyImageUploadScreen,
    title: 'Body Scan'
  },
  {
    component: WorkoutSplitScreen,
    title: 'Plan Selection'
  },
  {
    component: AIAnalysisScreen,
    title: 'Analyzing',
    showBack: false
  },
  {
    component: BodyAnalysisResultsScreen,
    title: 'Results'
  }];

  const CurrentComponent = steps[step]?.component;

  useEffect(() => {
    if (!CurrentComponent) {
      void handleComplete();
    }
  }, [CurrentComponent, handleComplete]);

  if (!CurrentComponent) return null;
  
  return (
    <OnboardingLayout
      currentStep={step}
      totalSteps={steps.length}
      onBack={back}
      title={steps[step].title}
      showBack={steps[step].showBack !== false}>

      <CurrentComponent
        onNext={next}
        onComplete={step === steps.length - 1 ? handleComplete : next}
        onDataChange={(data: any) => setOnboardingData({...onboardingData, ...data})}
        onboardingData={onboardingData}
        userId={JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}').id}
      />
    </OnboardingLayout>);

}
