import { api } from './api';
import type { AiPlanGenerationResponse, AiPlanOnboardingPayload } from '../ai/types';

export const generateAiTrainingPlan = async (
  userId: number,
  onboardingData: AiPlanOnboardingPayload,
): Promise<AiPlanGenerationResponse> => {
  return api.saveOnboarding(userId, {
    ...(onboardingData || {}),
    useClaude: true,
    disableClaude: false,
  }) as Promise<AiPlanGenerationResponse>;
};
