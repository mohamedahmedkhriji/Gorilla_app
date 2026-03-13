import React, { useCallback, useEffect, useState } from 'react';
import { OnboardingLayout } from '../components/onboarding/OnboardingLayout';
import { AppMotivationScreen } from '../components/onboarding/AppMotivationScreen';
import { WelcomeScreen } from '../components/onboarding/WelcomeScreen';
import { AthleteIdentityScreen } from '../components/onboarding/AthleteIdentityScreen';
import { PersonalInfoScreen } from '../components/onboarding/PersonalInfoScreen';
import { SportAgeGenderScreen } from '../components/onboarding/SportAgeGenderScreen';
import { SportExperienceYearsScreen } from '../components/onboarding/SportExperienceYearsScreen';
import { SportPlanChoiceScreen } from '../components/onboarding/SportPlanChoiceScreen';
import { FitnessBackgroundScreen } from '../components/onboarding/FitnessBackgroundScreen';
import { FitnessGoalsScreen } from '../components/onboarding/FitnessGoalsScreen';
import { BodyTypeSelectionScreen } from '../components/onboarding/BodyTypeSelectionScreen';
import { GoalsAvailabilityScreen } from '../components/onboarding/GoalsAvailabilityScreen';
import { WorkoutSplitScreen } from '../components/onboarding/WorkoutSplitScreen';
import { AIPlanTuningScreen } from '../components/onboarding/AIPlanTuningScreen';
import { BodyImageUploadScreen } from '../components/onboarding/BodyImageUploadScreen';
import { AIAnalysisScreen } from '../components/onboarding/AIAnalysisScreen';
import { BodyAnalysisResultsScreen } from '../components/onboarding/BodyAnalysisResultsScreen';
import { CustomPlanOnboardingScreen } from '../components/onboarding/CustomPlanOnboardingScreen';
import { CustomPlanAdviceScreen } from '../components/onboarding/CustomPlanAdviceScreen';

interface OnboardingProps {
  onComplete: () => void;
}

const hasOwn = (obj: unknown, key: string) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const toSafeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mergeOnboardingIntoUser = (user: Record<string, any>, patch: Record<string, any>) => {
  const next = { ...(user || {}) };

  if (hasOwn(patch, 'age')) next.age = toSafeNumber(patch.age);
  if (hasOwn(patch, 'gender')) next.gender = String(patch.gender || '').trim();

  if (hasOwn(patch, 'height')) {
    const height = toSafeNumber(patch.height);
    next.height = height;
    next.height_cm = height;
  }

  if (hasOwn(patch, 'weight')) {
    const weight = toSafeNumber(patch.weight);
    next.weight = weight;
    next.weight_kg = weight;
  }

  if (hasOwn(patch, 'primaryGoal')) {
    next.primaryGoal = String(patch.primaryGoal || '').trim();
    next.primary_goal = String(patch.primaryGoal || '').trim();
  }

  if (hasOwn(patch, 'fitnessGoal')) {
    next.fitnessGoal = String(patch.fitnessGoal || '').trim();
    next.fitness_goal = String(patch.fitnessGoal || '').trim();
  }

  if (hasOwn(patch, 'experienceLevel')) {
    const experience = String(patch.experienceLevel || '').trim();
    next.experienceLevel = experience;
    next.experience_level = experience;
  }

  if (hasOwn(patch, 'workoutDays')) {
    const days = toSafeNumber(patch.workoutDays);
    next.workoutDays = days;
    next.workout_days = days;
  }

  if (hasOwn(patch, 'sessionDuration')) {
    const duration = toSafeNumber(patch.sessionDuration);
    next.sessionDuration = duration;
    next.session_duration_minutes = duration;
  }

  if (hasOwn(patch, 'preferredTime')) {
    const preferredTime = String(patch.preferredTime || '').trim().toLowerCase();
    next.preferredTime = preferredTime;
    next.preferred_time = preferredTime;
  }

  if (hasOwn(patch, 'workoutSplitPreference')) {
    const splitPreference = String(patch.workoutSplitPreference || '').trim().toLowerCase();
    next.workoutSplitPreference = splitPreference;
    next.workout_split_preference = splitPreference;
  }

  if (hasOwn(patch, 'workoutSplitLabel')) {
    const splitLabel = String(patch.workoutSplitLabel || '').trim();
    next.workoutSplitLabel = splitLabel;
    next.workout_split_label = splitLabel;
  }

  return next;
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<any>({});
  const handleDataChange = useCallback((data: any) => {
    setOnboardingData((prev: any) => {
      const next = { ...prev, ...data };

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('onboardingData', JSON.stringify(next));

          const storedUserRaw = localStorage.getItem('appUser') || localStorage.getItem('user') || '{}';
          const storedUser = JSON.parse(storedUserRaw);
          const mergedUser = mergeOnboardingIntoUser(
            storedUser && typeof storedUser === 'object' ? storedUser : {},
            data || {},
          );

          localStorage.setItem('appUser', JSON.stringify(mergedUser));
          localStorage.setItem('user', JSON.stringify(mergedUser));
        }
      } catch (storageError) {
        console.warn('Failed to persist onboarding draft:', storageError);
      }

      return next;
    });
  }, []);
  
  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);
  
  const handleComplete = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      const mergedUser = mergeOnboardingIntoUser(
        user && typeof user === 'object' ? user : {},
        onboardingData || {},
      );

      mergedUser.onboarding_completed = true;
      mergedUser.first_login = false;

      localStorage.setItem('appUser', JSON.stringify(mergedUser));
      localStorage.setItem('appUserId', String(mergedUser.id || ''));
      localStorage.setItem('user', JSON.stringify(mergedUser));
      localStorage.setItem('onboardingData', JSON.stringify(onboardingData || {}));
      onComplete();
    } catch (error) {
      console.error('Error:', error);
      onComplete();
    }
  }, [onComplete, onboardingData]);

  const normalizeAthleteIdentity = (value: unknown) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'bodybuilder') return 'bodybuilding';
    if (normalized === 'fotballer') return 'football';
    if (normalized === 'basketballer') return 'basketball';
    if (normalized === 'handballer') return 'handball';
    if (normalized === 'swimmer') return 'swimming';
    return normalized;
  };

  const selectedAthleteIdentity = normalizeAthleteIdentity(onboardingData?.athleteIdentity);
  const isBodybuildingTrack = selectedAthleteIdentity === 'bodybuilding';
  const selectedSplitType = String(onboardingData?.workoutSplitPreference || '').trim().toLowerCase();
  const shouldShowCustomPlanStep = selectedSplitType === 'custom';
  const shouldShowAiPlanTuningStep = selectedSplitType === 'auto';

  const introSteps = [
    {
      component: WelcomeScreen,
      title: '',
      showBack: false,
    },
    {
      component: AppMotivationScreen,
      title: 'Motivation',
    },
    {
      component: AthleteIdentityScreen,
      title: 'I AM',
    },
  ];

  const bodybuildingSteps = [
    ...introSteps,
    {
      component: PersonalInfoScreen,
      title: 'Personal Info',
    },
    {
      component: FitnessBackgroundScreen,
      title: 'Background',
    },
    {
      component: FitnessGoalsScreen,
      title: 'Fitness Goal',
    },
    {
      component: BodyTypeSelectionScreen,
      title: 'Body Type',
    },
    {
      component: GoalsAvailabilityScreen,
      title: 'Availability',
    },
    {
      component: WorkoutSplitScreen,
      title: 'Plan Selection',
    },
    ...(shouldShowCustomPlanStep
      ? [
          {
            component: CustomPlanOnboardingScreen,
            title: 'Customize Plan',
          },
          {
            component: CustomPlanAdviceScreen,
            title: 'AI Advice',
            showBack: false,
          },
        ]
      : [
          ...(shouldShowAiPlanTuningStep
            ? [
                {
                  component: AIPlanTuningScreen,
                  title: 'AI Preferences',
                },
              ]
            : []),
          {
            component: BodyImageUploadScreen,
            title: 'Body Scan',
          },
          {
            component: AIAnalysisScreen,
            title: 'Analyzing',
            showBack: false,
          },
          {
            component: BodyAnalysisResultsScreen,
            title: 'Results',
            showBack: false,
            showHeader: false,
            showProgress: false,
          },
        ]),
  ];

  const sportTrackSteps = [
    ...introSteps,
    {
      component: SportAgeGenderScreen,
      title: 'Age & Gender',
    },
    {
      component: SportExperienceYearsScreen,
      title: 'Sports Experience',
    },
    {
      component: SportPlanChoiceScreen,
      title: 'Plan Selection',
    },
    ...(shouldShowCustomPlanStep
      ? [
          {
            component: CustomPlanOnboardingScreen,
            title: 'Generate Plan',
          },
          {
            component: CustomPlanAdviceScreen,
            title: 'AI Advice',
            showBack: false,
          },
        ]
      : [
          {
            component: AIAnalysisScreen,
            title: 'Analyzing',
            showBack: false,
          },
          {
            component: BodyAnalysisResultsScreen,
            title: 'Results',
            showBack: false,
            showHeader: false,
            showProgress: false,
          },
        ]),
  ];

  const steps = isBodybuildingTrack ? bodybuildingSteps : sportTrackSteps;

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
      showBack={steps[step].showBack !== false}
      showHeader={steps[step].showHeader !== false}
      showProgress={steps[step].showProgress !== false}>

      <CurrentComponent
        onNext={next}
        onComplete={step === steps.length - 1 ? handleComplete : next}
        onDataChange={handleDataChange}
        onboardingData={onboardingData}
        userId={JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}').id}
      />
    </OnboardingLayout>);

}
