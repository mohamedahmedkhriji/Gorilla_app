// @ts-check

const findBalancedJsonObject = (text) => {
  const source = String(text || '');
  const start = source.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
      if (depth < 0) return null;
    }
  }

  return null;
};

const removeJsonFenceFromNarrative = (text) =>
  String(text || '')
    .replace(/```json\s*[\s\S]*?\s*```/gi, ' ')
    .replace(/```[\s\S]*?\s*```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseJsonCandidate = (candidate) => {
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

export const extractClaudeTextContent = (responsePayload) => {
  const contentBlocks = Array.isArray(responsePayload?.content) ? responsePayload.content : [];
  const text = contentBlocks
    .filter((block) => block?.type === 'text')
    .map((block) => String(block?.text || '').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (!text) {
    throw new Error('Claude returned no text content.');
  }

  return text;
};

export const parseClaudePlanResponse = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('Claude returned an empty response.');
  }

  const fencedJsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const fencedJson = fencedJsonMatch?.[1] ? parseJsonCandidate(fencedJsonMatch[1].trim()) : null;
  if (fencedJson && typeof fencedJson === 'object') {
    return {
      rawText: text,
      narrativeText: removeJsonFenceFromNarrative(text),
      parsed: fencedJson,
    };
  }

  const balancedJsonCandidate = findBalancedJsonObject(text);
  const balancedJson = parseJsonCandidate(balancedJsonCandidate);
  if (balancedJson && typeof balancedJson === 'object') {
    return {
      rawText: text,
      narrativeText: removeJsonFenceFromNarrative(text),
      parsed: balancedJson,
    };
  }

  throw new Error('Claude response did not contain a valid JSON object.');
};
