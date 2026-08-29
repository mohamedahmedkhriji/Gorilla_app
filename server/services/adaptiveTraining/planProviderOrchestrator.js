const serializeProviderError = (error) => ({
  name: error?.name || 'Error',
  message: error?.message || 'Unknown provider error',
});

export const executePlanProviderOrder = async ({
  order = [],
  handlers = {},
  context = {},
} = {}) => {
  if (!Array.isArray(order)) {
    throw new TypeError(
      'Provider order must be an array',
    );
  }

  const attempts = [];
  const failures = [];

  for (const provider of order) {
    const handler = handlers[provider];

    if (typeof handler !== 'function') {
      attempts.push({
        provider,
        status: 'unavailable',
      });
      continue;
    }

    try {
      const result = await handler(context);

      if (!result) {
        throw new Error(
          'Provider returned no result',
        );
      }

      if (result.provider !== provider) {
        throw new Error(
          `Provider mismatch: expected ${provider}, received ${result.provider}`,
        );
      }

      attempts.push({
        provider,
        status: 'success',
      });

      return {
        result,
        attempts,
        failures,
      };
    } catch (error) {
      const serializedError =
        serializeProviderError(error);

      attempts.push({
        provider,
        status: 'failed',
      });

      failures.push({
        provider,
        ...serializedError,
      });
    }
  }

  return {
    result: null,
    attempts,
    failures,
  };
};
