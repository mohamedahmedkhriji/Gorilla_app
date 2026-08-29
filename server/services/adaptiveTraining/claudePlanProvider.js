import {
  buildCustomProgramPayloadFromClaudePlan,
  generateTwoMonthPlanWithClaude,
} from '../claudeCoach.js';

import {
  createPlanProviderResult,
} from './planProviderResult.js';

export const generateClaudePlanResult = async (
  {
    profile = {},
    bodyImages = [],
    daysPerWeek = null,
    splitPreference = null,
    preferredSplit = null,
    exerciseAnchors = [],
  } = {},
  dependencies = {},
) => {
  const generatePlan =
    dependencies.generateTwoMonthPlanWithClaude
    || generateTwoMonthPlanWithClaude;

  const buildPayload =
    dependencies.buildCustomProgramPayloadFromClaudePlan
    || buildCustomProgramPayloadFromClaudePlan;

  const generation = await generatePlan({
    profile,
    bodyImages,
  });

  if (!generation?.plan || typeof generation.plan !== 'object') {
    throw new Error('Claude provider returned no normalized plan.');
  }

  const payload = buildPayload(generation.plan, {
    cycleWeeks: 8,
    daysPerWeek,
    splitPreference,
    preferredSplit,
    exerciseAnchors,
  });

  const metadata = Object.fromEntries(
    Object.entries({
      model: generation.model,
      usedImages: generation.usedImages,
      attemptsUsed: generation.attemptsUsed,
      requestTimeoutMs: generation.requestTimeoutMs,
      generatedAt: generation.generatedAt,
    }).filter(([, value]) => value !== undefined),
  );

  return createPlanProviderResult({
    provider: 'claude',
    payload,
    normalizedPlan: generation.plan,
    metadata,
  });
};
