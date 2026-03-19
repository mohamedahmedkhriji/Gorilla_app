import process from 'node:process';

const DEFAULT_OPENAI_ENDPOINT = String(process.env.OPENAI_API_URL || process.env.VITE_AI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions').trim();
const DEFAULT_OPENAI_MODEL = String(process.env.OPENAI_MODEL || 'gpt-4o').trim() || 'gpt-4o';

const getApiKey = () =>
  String(
    process.env.OPENAI_API_KEY
    || process.env.VITE_OPENAI_API_KEY
    || process.env.VITE_AI_API_KEY
    || '',
  ).trim();

export const hasOpenAIConfig = () => Boolean(getApiKey());

export const requestOpenAIChatCompletion = async ({
  messages = [],
  model = DEFAULT_OPENAI_MODEL,
  temperature = 0.7,
  maxTokens = 2000,
  apiKey: apiKeyOverride = '',
} = {}) => {
  const apiKey = String(apiKeyOverride || getApiKey()).trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(DEFAULT_OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: Array.isArray(messages) ? messages : [],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = String(payload?.error?.message || payload?.message || `OpenAI request failed (${response.status})`).trim();
    throw new Error(errorMessage);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return {
    content,
    model: String(payload?.model || model),
    raw: payload,
  };
};
