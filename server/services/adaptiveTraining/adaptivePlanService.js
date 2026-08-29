import {
  executePlanProviderOrder,
} from './planProviderOrchestrator.js';
import {
  persistPlanProviderResult,
} from './planProviderPersistence.js';
import {
  PLAN_PROVIDERS,
} from './planProviderPolicy.js';
import {
  generateRulesPlanResult,
} from './rulesPlanProvider.js';

const RULES_ONLY_PROVIDER_ORDER = Object.freeze([
  PLAN_PROVIDERS.RULES,
]);

const parsePositiveIntegerUserId = (userId) => {
  const parsedUserId = Number(userId);

  if (
    !Number.isInteger(parsedUserId)
    || parsedUserId <= 0
  ) {
    throw new TypeError(
      'A positive integer userId is required',
    );
  }

  return parsedUserId;
};

const buildNoProviderSucceededError = (
  failures = [],
) => {
  const failureMessage = failures
    .map((failure) => failure.message)
    .filter(Boolean)
    .join('; ');

  return new Error(
    failureMessage
      ? `No adaptive plan provider succeeded: ${failureMessage}`
      : 'No adaptive plan provider succeeded',
  );
};

export const generateAndPersistAdaptivePlan = async (
  conn,
  options = {},
  dependencies = {},
) => {
  if (!conn) {
    throw new TypeError(
      'A database connection is required',
    );
  }

  const userId = parsePositiveIntegerUserId(
    options.userId,
  );

  const executeProviderOrder =
    dependencies.executePlanProviderOrder
    || executePlanProviderOrder;

  const generateRulesPlan =
    dependencies.generateRulesPlanResult
    || generateRulesPlanResult;

  const persistProviderResult =
    dependencies.persistPlanProviderResult
    || persistPlanProviderResult;

  const orchestration =
    await executeProviderOrder({
      order: RULES_ONLY_PROVIDER_ORDER,
      handlers: {
        [PLAN_PROVIDERS.RULES]: async ({
          conn: providerConn,
          options: providerOptions,
        }) => generateRulesPlan(
          providerConn,
          providerOptions,
        ),
      },
      context: {
        conn,
        options,
      },
    });

  const providerResult = orchestration.result;

  if (!providerResult) {
    throw buildNoProviderSucceededError(
      orchestration.failures,
    );
  }

  const persistedResult =
    await persistProviderResult(
      conn,
      providerResult,
      {
        userId,
        gymId: options.gymId ?? null,
        notes: options.notes ?? null,
      },
    );

  return {
    provider: providerResult.provider,
    planSource: providerResult.planSource,
    providerResult,
    persistedProgram: persistedResult.program,
    attempts: orchestration.attempts,
  };
};
