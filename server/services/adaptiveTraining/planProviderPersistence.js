import {
  persistPersonalizedProgramDraft,
} from '../planGenerator.js';

import {
  PLAN_ARTIFACT_TYPES,
} from './planProviderResult.js';

export class PlanProviderPersistenceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlanProviderPersistenceError';
  }
}

export const persistPlanProviderResult = async (
  conn,
  providerResult,
  {
    userId,
    gymId = null,
    notes = null,
  } = {},
  dependencies = {},
) => {
  if (!conn) {
    throw new PlanProviderPersistenceError(
      'A database connection is required',
    );
  }

  if (!providerResult) {
    throw new PlanProviderPersistenceError(
      'A provider result is required',
    );
  }

  if (!Number.isInteger(Number(userId))) {
    throw new PlanProviderPersistenceError(
      'A valid userId is required',
    );
  }

  let program;

  switch (providerResult.artifactType) {
    case PLAN_ARTIFACT_TYPES.RULES_DRAFT: {
      const persistRulesDraft =
        dependencies.persistRulesDraft
        || persistPersonalizedProgramDraft;

      program = await persistRulesDraft(
        conn,
        {
          userId: Number(userId),
          gymId,
          notes,
          programDraft: providerResult.draft,
        },
      );
      break;
    }

    case PLAN_ARTIFACT_TYPES.CUSTOM_PAYLOAD: {
      const persistCustomPayload =
        dependencies.persistCustomPayload;

      if (typeof persistCustomPayload !== 'function') {
        throw new PlanProviderPersistenceError(
          'A custom payload persister is required',
        );
      }

      program = await persistCustomPayload({
        conn,
        userId: Number(userId),
        gymId,
        notes,
        payload: providerResult.payload,
        providerResult,
      });
      break;
    }

    default:
      throw new PlanProviderPersistenceError(
        `Unsupported artifact type: ${providerResult.artifactType}`,
      );
  }

  return {
    provider: providerResult.provider,
    planSource: providerResult.planSource,
    artifactType: providerResult.artifactType,
    program,
    normalizedPlan:
      providerResult.normalizedPlan,
    metadata: providerResult.metadata,
    warnings: providerResult.warnings,
  };
};
