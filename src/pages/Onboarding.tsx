import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { OnboardingLayout } from '../components/onboarding/OnboardingLayout';
import { AppMotivationScreen } from '../components/onboarding/AppMotivationScreen';
import { WelcomeScreen } from '../components/onboarding/WelcomeScreen';
import { AthleteIdentityScreen } from '../components/onboarding/AthleteIdentityScreen';
import { FirstNameScreen } from '../components/onboarding/FirstNameScreen';
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
import { api } from '../services/api';
import {
  DEFAULT_ONBOARDING_CONFIG,
  mergeOnboardingConfig,
  type OnboardingConfig,
  type OnboardingStepId,
  type OnboardingTrack,
} from '../config/onboardingConfig';

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

  if (hasOwn(patch, 'firstName')) {
    const firstName = String(patch.firstName || '').trim();
    next.firstName = firstName;
    if (firstName) next.name = firstName;
  }
  if (hasOwn(patch, 'name')) {
    const name = String(patch.name || '').trim();
    if (name) next.name = name;
  }

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

const STEP_COMPONENTS: Record<OnboardingStepId, React.ComponentType<any>> = {
  welcome: WelcomeScreen,
  first_name: FirstNameScreen,
  app_motivation: AppMotivationScreen,
  athlete_identity: AthleteIdentityScreen,
  personal_info: PersonalInfoScreen,
  fitness_background: FitnessBackgroundScreen,
  fitness_goals: FitnessGoalsScreen,
  body_type: BodyTypeSelectionScreen,
  goals_availability: GoalsAvailabilityScreen,
  workout_split: WorkoutSplitScreen,
  ai_plan_tuning: AIPlanTuningScreen,
  body_image_upload: BodyImageUploadScreen,
  ai_analysis: AIAnalysisScreen,
  body_results: BodyAnalysisResultsScreen,
  custom_plan: CustomPlanOnboardingScreen,
  custom_plan_advice: CustomPlanAdviceScreen,
  sport_age_gender: SportAgeGenderScreen,
  sport_experience: SportExperienceYearsScreen,
  sport_plan_choice: SportPlanChoiceScreen,
};

const normalizeAthleteIdentity = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bodybuilder') return 'bodybuilding';
  if (normalized === 'fotballer') return 'football';
  if (normalized === 'basketballer') return 'basketball';
  if (normalized === 'handballer') return 'handball';
  if (normalized === 'swimmer') return 'swimming';
  return normalized;
};

const resolveTrack = (config: OnboardingConfig, onboardingData: any): OnboardingTrack => {
  const selected = normalizeAthleteIdentity(onboardingData?.athleteIdentity);
  if (selected) {
    return config.trackMap.bodybuilding.includes(selected) ? 'bodybuilding' : 'sport';
  }
  return config.trackMap.defaultTrack === 'bodybuilding' ? 'bodybuilding' : 'sport';
};

const buildStepIds = (
  config: OnboardingConfig,
  onboardingData: any,
  track: OnboardingTrack,
) => {
  const splitPreference = String(onboardingData?.workoutSplitPreference || '').trim().toLowerCase();
  const isCustom = splitPreference === 'custom';
  const includeAiTuning = splitPreference === 'auto';
  const base = [
    ...config.steps.intro,
    ...(track === 'bodybuilding' ? config.steps.bodybuilding : config.steps.sport),
  ];

  let branch = isCustom
    ? config.steps.branchBySplit.custom
    : track === 'bodybuilding'
      ? config.steps.branchBySplit.aiBodybuilding
      : config.steps.branchBySplit.aiSport;

  if (!includeAiTuning) {
    branch = branch.filter((id) => id !== 'ai_plan_tuning');
  }

  const combined = [...base, ...branch];
  return combined.filter((id, index) => combined.indexOf(id) === index);
};

const resolveStepMeta = (
  config: OnboardingConfig,
  track: OnboardingTrack,
  stepId: OnboardingStepId,
) => {
  const base = config.stepMeta[stepId] || {};
  const override = config.stepMetaByTrack?.[track]?.[stepId] || {};
  return { ...base, ...override };
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const [onboardingData, setOnboardingData] = useState<any>({});
  const [remoteConfig, setRemoteConfig] = useState<Partial<OnboardingConfig> | null>(null);
  const [currentStepId, setCurrentStepId] = useState<OnboardingStepId | null>(null);

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

  useEffect(() => {
    let active = true;
    api.getOnboardingConfig()
      .then((data: any) => {
        if (!active) return;
        const configPayload = data?.config || data;
        if (configPayload && typeof configPayload === 'object') {
          setRemoteConfig(configPayload);
        }
      })
      .catch((error: unknown) => {
        console.warn('Failed to load onboarding config:', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const config = useMemo(
    () => mergeOnboardingConfig(DEFAULT_ONBOARDING_CONFIG, remoteConfig),
    [remoteConfig],
  );
  const track = useMemo(
    () => resolveTrack(config, onboardingData),
    [config, onboardingData],
  );

  const stepIds = useMemo(
    () => buildStepIds(config, onboardingData, track),
    [config, onboardingData, track],
  );
  const steps = useMemo(
    () =>
      stepIds
        .map((id) => ({
          id,
          component: STEP_COMPONENTS[id],
          meta: resolveStepMeta(config, track, id),
        }))
        .filter((step) => step.component),
    [config, stepIds, track],
  );

  useEffect(() => {
    if (!steps.length) return;
    if (!currentStepId || !steps.some((step) => step.id === currentStepId)) {
      setCurrentStepId(steps[0].id);
    }
  }, [currentStepId, steps]);

  const stepIndex = useMemo(() => {
    if (!currentStepId) return 0;
    const index = steps.findIndex((step) => step.id === currentStepId);
    return index < 0 ? 0 : index;
  }, [currentStepId, steps]);

  const next = useCallback(() => {
    if (!steps.length) return;

    const index = steps.findIndex((step) => step.id === currentStepId);
    if (index < 0) {
      setCurrentStepId(steps[0].id);
      return;
    }

    const nextStep = steps[index + 1];
    if (!nextStep) {
      void handleComplete();
      return;
    }

    setCurrentStepId(nextStep.id);
  }, [currentStepId, handleComplete, steps]);

  const back = useCallback(() => {
    setCurrentStepId((prev) => {
      if (!steps.length) return null;
      const index = steps.findIndex((step) => step.id === prev);
      if (index <= 0) return steps[0].id;
      return steps[index - 1].id;
    });
  }, [steps]);

  const currentStep = steps[stepIndex];
  const CurrentComponent = currentStep?.component;
  const isLastStep = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!CurrentComponent) {
      void handleComplete();
    }
  }, [CurrentComponent, handleComplete]);

  if (!CurrentComponent) return null;

  const stepPropsById: Partial<Record<OnboardingStepId, Record<string, unknown>>> = {
    app_motivation: {
      options: config.options.appMotivation,
    },
    athlete_identity: {
      options: config.options.athleteIdentity,
      groupSelectionLimits: config.options.athleteIdentityGroupLimits,
    },
    fitness_goals: {
      options: config.options.fitnessGoals,
    },
    workout_split: {
      options: config.options.workoutSplit,
      recommendedByDays: config.splitRecommendations,
    },
    sport_plan_choice: {
      options: config.options.sportPlan,
    },
    ai_plan_tuning: {
      trainingFocusOptions: config.options.aiTrainingFocus,
      recoveryStrategyOptions: config.options.aiRecoveryPriority,
    },
    personal_info: {
      genderOptions: config.options.genders,
    },
    sport_age_gender: {
      genderOptions: config.options.genders,
    },
    goals_availability: {
      sessionDurationOptions: config.options.sessionDurations,
      preferredTimeOptions: config.options.preferredTimes,
      workoutDaysRange: config.options.workoutDaysRange,
    },
  };

  const storedUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');

  return (
    <OnboardingLayout
      currentStep={stepIndex}
      totalSteps={steps.length}
      onBack={back}
      title={currentStep?.meta?.title || ''}
      showBack={currentStep?.meta?.showBack !== false}
      showHeader={currentStep?.meta?.showHeader !== false}
      showProgress={currentStep?.meta?.showProgress !== false}
    >
      <CurrentComponent
        onNext={next}
        onComplete={isLastStep ? handleComplete : next}
        onDataChange={handleDataChange}
        onboardingData={onboardingData}
        userId={storedUser?.id}
        {...(stepPropsById[currentStep.id] || {})}
      />
    </OnboardingLayout>
  );
}
