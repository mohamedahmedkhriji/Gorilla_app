// @ts-check

import {
  MAX_IMAGE_BYTES,
  MAX_INCLUDED_IMAGES,
  SUPPORTED_IMAGE_MEDIA_TYPES,
} from './types.js';
import { buildClaudePlanPrompt } from './buildClaudePlanPrompt.js';
import { parseClaudePlanResponse, extractClaudeTextContent } from './parseClaudePlanResponse.js';
import { normalizeGeneratedPlan } from './normalizeGeneratedPlan.js';
import {
  buildClaudePlanOnboardingPayload,
  validateClaudePlanOnboardingPayload,
} from './buildClaudePlanPayload.js';
import {
  repairNormalizedPlan,
  validateNormalizedPlan,
  validateOnboardingForClaude,
} from './validateClaudePlan.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest';
const DEFAULT_REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const estimateBase64Bytes = (base64Data) => {
  const clean = String(base64Data || '').replace(/\s+/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
};

const parsePositiveIntegerEnv = (name, fallbackValue, minimumValue = 1_000) => {
  const rawValue = Number(process.env[name] || '');
  if (!Number.isFinite(rawValue)) return fallbackValue;
  const normalizedValue = Math.floor(rawValue);
  return normalizedValue >= minimumValue ? normalizedValue : fallbackValue;
};

const parseDataUriImage = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;

  const mediaTypeRaw = String(match[1] || '').toLowerCase();
  const mediaType = mediaTypeRaw === 'image/jpg' ? 'image/jpeg' : mediaTypeRaw;
  if (!SUPPORTED_IMAGE_MEDIA_TYPES.has(mediaType)) return null;

  const data = String(match[2] || '').replace(/\s+/g, '');
  if (!data) return null;

  const estimatedBytes = estimateBase64Bytes(data);
  if (!Number.isFinite(estimatedBytes) || estimatedBytes <= 0 || estimatedBytes > MAX_IMAGE_BYTES) {
    return null;
  }

  return {
    mediaType,
    data,
  };
};

const buildClaudeHttpErrorDetails = ({ statusCode, rawBody, parsedBody }) => {
  const status = Number(statusCode || 0);
  const parsedMessage = String(parsedBody?.error?.message || parsedBody?.message || '').trim();
  const normalizedRaw = String(rawBody || '').replace(/\s+/g, ' ').trim();

  if (status === 429) return 'Claude rate limit reached. Please retry shortly.';
  if (status === 401 || status === 403) return 'Claude authentication failed. Verify ANTHROPIC_API_KEY.';
  if ([502, 503, 504].includes(status)) return 'Claude service is temporarily unavailable.';
  return (parsedMessage || normalizedRaw || 'Unknown Claude API error').slice(0, 300);
};

const isRetryableStatus = (statusCode) => [408, 409, 429, 500, 502, 503, 504].includes(Number(statusCode || 0));

const isRetryableParseError = (error) => /json|response did not contain|empty response|no text content|validation failed/i.test(String(error?.message || ''));

export const generateAiTrainingPlan = async (
  inputPayload,
  {
    bodyImages = [],
  } = {},
) => {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const payload = buildClaudePlanOnboardingPayload(inputPayload, { bodyImages });
  const validationIssues = [
    ...validateClaudePlanOnboardingPayload(payload),
    ...validateOnboardingForClaude(payload),
  ];
  if (validationIssues.length > 0) {
    throw new Error(validationIssues.join(' '));
  }

  const preparedImages = (Array.isArray(bodyImages) ? bodyImages : [])
    .map((image) => parseDataUriImage(image))
    .filter(Boolean)
    .slice(0, MAX_INCLUDED_IMAGES);
  const requestTimeoutMs = parsePositiveIntegerEnv(
    'ANTHROPIC_REQUEST_TIMEOUT_MS',
    DEFAULT_REQUEST_TIMEOUT_MS,
    5_000,
  );
  const model = String(process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL).trim() || DEFAULT_ANTHROPIC_MODEL;
  const prompts = buildClaudePlanPrompt({
    ...payload,
    images_provided_count: preparedImages.length,
  });

  /** @type {Error | null} */
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    const attemptStartedAt = Date.now();

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: attempt === 1 ? 5_500 : 7_000,
          temperature: 0.15,
          system: prompts.systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompts.userPrompt },
                ...preparedImages.map((image) => ({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: image.mediaType,
                    data: image.data,
                  },
                })),
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      const rawBody = await response.text();
      /** @type {any} */
      let parsedBody = null;
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsedBody = null;
      }

      if (!response.ok) {
        const error = new Error(
          `Claude API request failed (${response.status}): ${buildClaudeHttpErrorDetails({
            statusCode: response.status,
            rawBody,
            parsedBody,
          })}`,
        );
        lastError = error;

        if (attempt < MAX_ATTEMPTS && isRetryableStatus(response.status)) {
          await wait(350 * attempt);
          continue;
        }

        throw error;
      }

      const rawText = extractClaudeTextContent(parsedBody);
      const parsedResponse = parseClaudePlanResponse(rawText);
      const normalizedPlan = normalizeGeneratedPlan(parsedResponse.parsed, payload, {
        narrativeText: parsedResponse.narrativeText,
      });
      const repairedPlan = repairNormalizedPlan(normalizedPlan, payload);
      const planValidation = validateNormalizedPlan(repairedPlan, payload);
      if (!planValidation.valid) {
        throw new Error(`Claude plan validation failed: ${planValidation.issues.slice(0, 4).join(' ')}`);
      }

      return {
        plan: planValidation.repairedPlan,
        rawText: parsedResponse.rawText,
        narrativeText: parsedResponse.narrativeText,
        model: String(parsedBody?.model || model).trim() || model,
        usedImages: preparedImages.length,
        attemptsUsed: attempt,
        requestTimeoutMs,
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - attemptStartedAt,
        requestPayload: payload,
      };
    } catch (error) {
      clearTimeout(timeout);
      const normalizedError = error?.name === 'AbortError'
        ? new Error('Claude API request timed out')
        : error instanceof Error
          ? error
          : new Error(String(error || 'Claude API request failed'));
      lastError = normalizedError;

      if (attempt < MAX_ATTEMPTS && isRetryableParseError(normalizedError)) {
        await wait(300 * attempt);
        continue;
      }

      throw normalizedError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('Claude plan generation failed.');
};
