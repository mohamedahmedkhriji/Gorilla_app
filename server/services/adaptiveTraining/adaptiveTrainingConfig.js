export const PLAN_PROVIDER_MODES = Object.freeze({
  LEGACY: 'legacy',
  RULES: 'rules',
  CLAUDE: 'claude',
  AUTO: 'auto',
});

const VALID_PROVIDER_MODES = new Set(
  Object.values(PLAN_PROVIDER_MODES),
);

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export const parseEnvironmentBoolean = (
  value,
  fallback = false,
) => {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return fallback;
};

export const resolveAdaptiveTrainingConfig = (
  environment = process.env,
) => {
  const requestedMode = String(
    environment.PLAN_PROVIDER || PLAN_PROVIDER_MODES.LEGACY,
  )
    .trim()
    .toLowerCase();

  const mode = VALID_PROVIDER_MODES.has(requestedMode)
    ? requestedMode
    : PLAN_PROVIDER_MODES.LEGACY;

  const modeUsesRules =
    mode === PLAN_PROVIDER_MODES.RULES
    || mode === PLAN_PROVIDER_MODES.AUTO;

  return Object.freeze({
    mode,

    rulesEnabled: parseEnvironmentBoolean(
      environment.ADAPTIVE_TRAINING_RULES_ENABLED,
      modeUsesRules,
    ),

    claudeFallbackEnabled: parseEnvironmentBoolean(
      environment.CLAUDE_PLAN_FALLBACK_ENABLED,
      true,
    ),

    shadowMode: parseEnvironmentBoolean(
      environment.ADAPTIVE_TRAINING_SHADOW_MODE,
      true,
    ),
  });
};
