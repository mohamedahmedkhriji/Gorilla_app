import {
  PLAN_PROVIDERS,
} from './planProviderPolicy.js';

const PROVIDER_VALUES = new Set(
  Object.values(PLAN_PROVIDERS),
);

export const PLAN_SOURCE_BY_PROVIDER = Object.freeze({
  [PLAN_PROVIDERS.RULES]: 'repset_rules',
  [PLAN_PROVIDERS.CLAUDE]: 'claude',
  [PLAN_PROVIDERS.TEMPLATE_LIBRARY]: 'template_library',
  [PLAN_PROVIDERS.LEGACY_RULES]: 'template',
});

const isObject = (value) =>
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value);

export const validatePlanPersistencePayload = (payload) => {
  const errors = [];

  if (!isObject(payload)) {
    return {
      valid: false,
      errors: ['payload must be an object'],
    };
  }

  if (
    typeof payload.planName !== 'string'
    || !payload.planName.trim()
  ) {
    errors.push('planName must be a non-empty string');
  }

  if (typeof payload.description !== 'string') {
    errors.push('description must be a string');
  }

  if (payload.cycleWeeks !== 8) {
    errors.push('cycleWeeks must equal 8');
  }

  if (
    !Array.isArray(payload.selectedDays)
    || payload.selectedDays.length === 0
  ) {
    errors.push('selectedDays must be a non-empty array');
  }

  if (
    !Array.isArray(payload.weeklyWorkouts)
    || payload.weeklyWorkouts.length === 0
  ) {
    errors.push('weeklyWorkouts must be a non-empty array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export class PlanProviderResultError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'PlanProviderResultError';
    this.details = details;
  }
}

export const createPlanProviderResult = ({
  provider,
  payload,
  normalizedPlan = null,
  metadata = {},
  warnings = [],
}) => {
  if (!PROVIDER_VALUES.has(provider)) {
    throw new PlanProviderResultError(
      `Unsupported plan provider: ${provider}`,
    );
  }

  const validation =
    validatePlanPersistencePayload(payload);

  if (!validation.valid) {
    throw new PlanProviderResultError(
      'Invalid plan persistence payload',
      validation.errors,
    );
  }

  if (!isObject(metadata)) {
    throw new PlanProviderResultError(
      'metadata must be an object',
    );
  }

  if (!Array.isArray(warnings)) {
    throw new PlanProviderResultError(
      'warnings must be an array',
    );
  }

  return {
    provider,
    planSource: PLAN_SOURCE_BY_PROVIDER[provider],
    payload,
    normalizedPlan,
    metadata,
    warnings,
  };
};
