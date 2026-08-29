import {
  PLAN_PROVIDER_MODES,
  resolveAdaptiveTrainingConfig,
} from './adaptiveTrainingConfig.js';

export const PLAN_PROVIDERS = Object.freeze({
  RULES: 'rules',
  CLAUDE: 'claude',
  TEMPLATE_LIBRARY: 'template_library',
  LEGACY_RULES: 'legacy_rules',
});

const appendUnique = (providers, provider, allowed) => {
  if (allowed && !providers.includes(provider)) {
    providers.push(provider);
  }
};

export const resolvePlanProviderOrder = ({
  config = resolveAdaptiveTrainingConfig(),
  rulesAllowed = true,
  claudeAllowed = false,
  templateLibraryAllowed = true,
  legacyRulesAllowed = true,
} = {}) => {
  const providers = [];

  const rulesEnabled =
    config.rulesEnabled && rulesAllowed;

  const claudeFallbackAllowed =
    config.claudeFallbackEnabled && claudeAllowed;

  switch (config.mode) {
    case PLAN_PROVIDER_MODES.RULES:
    case PLAN_PROVIDER_MODES.AUTO:
      appendUnique(
        providers,
        PLAN_PROVIDERS.RULES,
        rulesEnabled,
      );

      appendUnique(
        providers,
        PLAN_PROVIDERS.CLAUDE,
        claudeFallbackAllowed,
      );
      break;

    case PLAN_PROVIDER_MODES.CLAUDE:
      appendUnique(
        providers,
        PLAN_PROVIDERS.CLAUDE,
        claudeAllowed,
      );

      appendUnique(
        providers,
        PLAN_PROVIDERS.RULES,
        rulesEnabled,
      );
      break;

    case PLAN_PROVIDER_MODES.LEGACY:
    default:
      // Preserve the current production order:
      // Claude -> template library -> legacy rules.
      appendUnique(
        providers,
        PLAN_PROVIDERS.CLAUDE,
        claudeAllowed,
      );
      break;
  }

  appendUnique(
    providers,
    PLAN_PROVIDERS.TEMPLATE_LIBRARY,
    templateLibraryAllowed,
  );

  appendUnique(
    providers,
    PLAN_PROVIDERS.LEGACY_RULES,
    legacyRulesAllowed,
  );

  return Object.freeze(providers);
};
