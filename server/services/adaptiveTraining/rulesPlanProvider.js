import {
  buildPersonalizedProgramDraftFromContext,
  buildPersonalizedProgramPlanningContext,
} from '../planGenerator.js';

import {
  PLAN_PROVIDERS,
} from './planProviderPolicy.js';

import {
  createPlanProviderResult,
} from './planProviderResult.js';

export const generateRulesPlanResult = async (
  conn,
  options = {},
  dependencies = {},
) => {
  if (!conn) {
    throw new TypeError(
      'A database connection is required',
    );
  }

  const buildPlanningContext =
    dependencies.buildPlanningContext
    || buildPersonalizedProgramPlanningContext;

  const buildDraft =
    dependencies.buildDraft
    || buildPersonalizedProgramDraftFromContext;

  const normalizedOptions = {
    ...options,
    cycleWeeks: 8,
  };

  const planningContext =
    await buildPlanningContext(
      conn,
      normalizedOptions,
    );

  const draft = buildDraft({
    planningContext,
    splitPreference:
      normalizedOptions.splitPreference || 'auto',
  });

  return createPlanProviderResult({
    provider: PLAN_PROVIDERS.RULES,
    draft,
    metadata: {
      engine: 'repset-rules-v1',
      cycleWeeks: draft.cycleWeeks,
      daysPerWeek: draft.selectedDays.length,
      goal: planningContext.normalizedGoal,
      experienceLevel:
        planningContext.normalizedLevel,
      catalogExerciseCount:
        Array.isArray(planningContext.pool)
          ? planningContext.pool.length
          : null,
    },
  });
};
