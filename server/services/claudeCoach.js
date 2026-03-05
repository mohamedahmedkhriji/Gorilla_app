/* eslint-env node */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest';
const MAX_INCLUDED_IMAGES = 3;
const MAX_IMAGE_BYTES = 3_500_000;
const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const WEEKDAY_BY_DAYS_PER_WEEK = {
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
};

const DAY_ALIAS = {
  mon: 'monday',
  monday: 'monday',
  tue: 'tuesday',
  tues: 'tuesday',
  tuesday: 'tuesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  thursday: 'thursday',
  fri: 'friday',
  friday: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
  sun: 'sunday',
  sunday: 'sunday',
};

const DEFAULT_EXERCISES_BY_WORKOUT_TYPE = {
  'Full Body': [
    { name: 'Back Squat', sets: 4, reps: '6-8', restSeconds: 120 },
    { name: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
    { name: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 90 },
    { name: 'Lat Pulldown', sets: 3, reps: '8-12', restSeconds: 90 },
    { name: 'Plank', sets: 3, reps: '45 sec', restSeconds: 60 },
  ],
  'Upper Body': [
    { name: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
    { name: 'Overhead Press', sets: 3, reps: '6-10', restSeconds: 90 },
    { name: 'Barbell Row', sets: 4, reps: '6-10', restSeconds: 120 },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '8-12', restSeconds: 90 },
    { name: 'Face Pull', sets: 3, reps: '12-15', restSeconds: 60 },
  ],
  'Lower Body': [
    { name: 'Back Squat', sets: 4, reps: '5-8', restSeconds: 120 },
    { name: 'Romanian Deadlift', sets: 4, reps: '6-10', restSeconds: 120 },
    { name: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
    { name: 'Walking Lunge', sets: 3, reps: '10-12', restSeconds: 75 },
    { name: 'Standing Calf Raise', sets: 3, reps: '12-18', restSeconds: 60 },
  ],
  Push: [
    { name: 'Barbell Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '8-12', restSeconds: 90 },
    { name: 'Seated Dumbbell Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
    { name: 'Cable Triceps Pushdown', sets: 3, reps: '10-14', restSeconds: 60 },
  ],
  Pull: [
    { name: 'Deadlift', sets: 3, reps: '4-6', restSeconds: 150 },
    { name: 'Lat Pulldown', sets: 4, reps: '8-12', restSeconds: 90 },
    { name: 'Seated Cable Row', sets: 3, reps: '8-12', restSeconds: 90 },
    { name: 'Face Pull', sets: 3, reps: '12-15', restSeconds: 60 },
    { name: 'Dumbbell Hammer Curl', sets: 3, reps: '10-14', restSeconds: 60 },
  ],
  Legs: [
    { name: 'Back Squat', sets: 4, reps: '5-8', restSeconds: 120 },
    { name: 'Romanian Deadlift', sets: 4, reps: '6-10', restSeconds: 120 },
    { name: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
    { name: 'Leg Curl', sets: 3, reps: '10-14', restSeconds: 75 },
    { name: 'Standing Calf Raise', sets: 4, reps: '12-20', restSeconds: 60 },
  ],
};

const RECOVERY_TARGET_MUSCLES = [
  'Chest',
  'Back',
  'Quadriceps',
  'Hamstrings',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Calves',
  'Abs',
];

const TARGET_MUSCLE_ALIASES = {
  chest: 'Chest',
  pectorals: 'Chest',
  back: 'Back',
  lats: 'Back',
  traps: 'Back',
  quadriceps: 'Quadriceps',
  quadricep: 'Quadriceps',
  quads: 'Quadriceps',
  thighs: 'Quadriceps',
  hamstrings: 'Hamstrings',
  hamstring: 'Hamstrings',
  glutes: 'Hamstrings',
  glute: 'Hamstrings',
  shoulders: 'Shoulders',
  shoulder: 'Shoulders',
  delts: 'Shoulders',
  biceps: 'Biceps',
  bicep: 'Biceps',
  triceps: 'Triceps',
  tricep: 'Triceps',
  forearms: 'Forearms',
  forearm: 'Forearms',
  calves: 'Calves',
  calf: 'Calves',
  abs: 'Abs',
  core: 'Abs',
  abdominals: 'Abs',
};

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const sanitizeText = (value, fallback = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

const normalizeDayName = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  if (DAY_ALIAS[key]) return DAY_ALIAS[key];
  const short = key.slice(0, 3);
  return DAY_ALIAS[short] || null;
};

const toTitleCase = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
};

const normalizeReps = (value, fallback = '8-12') => {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.slice(0, 20);
};

const normalizeTargetMuscleName = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  return TARGET_MUSCLE_ALIASES[key] || null;
};

const normalizeTargetMuscles = (value) => {
  const items = Array.isArray(value)
    ? value
    : (typeof value === 'string' ? value.split(/[,;|]+/) : []);

  return [...new Set(
    items
      .map((item) => normalizeTargetMuscleName(item))
      .filter((item) => item && RECOVERY_TARGET_MUSCLES.includes(item)),
  )].slice(0, 3);
};

const estimateBase64Bytes = (base64Data) => {
  const clean = String(base64Data || '').replace(/\s+/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
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
  const bytes = estimateBase64Bytes(data);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_IMAGE_BYTES) return null;

  return { mediaType, data };
};

const normalizeExercise = (exercise) => {
  const targetMuscles = normalizeTargetMuscles(
    exercise?.targetMuscles
    || exercise?.muscleTargets
    || exercise?.primaryMuscles
    || exercise?.muscles
    || exercise?.muscleGroup,
  );

  return {
    name: sanitizeText(exercise?.name || exercise?.exerciseName, 'Exercise'),
    sets: clampInt(exercise?.sets, 1, 10, 3),
    reps: normalizeReps(exercise?.reps, '8-12'),
    restSeconds: clampInt(exercise?.restSeconds, 30, 300, 90),
    rpe: Number(clampNumber(exercise?.rpe, 6, 10, 7.5).toFixed(1)),
    notes: sanitizeText(exercise?.notes, ''),
    targetMuscles,
  };
};

const buildDefaultSchedule = (daysPerWeek = 4) => {
  const days = WEEKDAY_BY_DAYS_PER_WEEK[daysPerWeek] || WEEKDAY_BY_DAYS_PER_WEEK[4];
  return days.map((dayName, index) => {
    const rotation = [
      { workoutName: 'Upper Strength', workoutType: 'Upper Body' },
      { workoutName: 'Lower Strength', workoutType: 'Lower Body' },
      { workoutName: 'Upper Hypertrophy', workoutType: 'Upper Body' },
      { workoutName: 'Lower Hypertrophy', workoutType: 'Lower Body' },
      { workoutName: 'Push', workoutType: 'Push' },
      { workoutName: 'Pull', workoutType: 'Pull' },
      { workoutName: 'Legs', workoutType: 'Legs' },
    ];
    const template = rotation[index % rotation.length];
    const defaultExercises = DEFAULT_EXERCISES_BY_WORKOUT_TYPE[template.workoutType] || DEFAULT_EXERCISES_BY_WORKOUT_TYPE['Full Body'];

    return {
      dayName,
      workoutName: template.workoutName,
      workoutType: template.workoutType,
      focus: `${template.workoutType} development and progressive overload`,
      exercises: defaultExercises.map((item) => normalizeExercise(item)),
    };
  });
};

const normalizeWeeklySchedule = (rawSchedule, daysPerWeek) => {
  if (!Array.isArray(rawSchedule) || !rawSchedule.length) {
    return buildDefaultSchedule(daysPerWeek);
  }

  const normalized = [];
  const usedDays = new Set();

  for (const row of rawSchedule) {
    const dayName = normalizeDayName(row?.dayName || row?.day || row?.weekday);
    if (!dayName || usedDays.has(dayName)) continue;
    usedDays.add(dayName);

    const workoutType = sanitizeText(row?.workoutType, 'Full Body');
    const fallbackExercises = DEFAULT_EXERCISES_BY_WORKOUT_TYPE[workoutType] || DEFAULT_EXERCISES_BY_WORKOUT_TYPE['Full Body'];
    const rawExercises = Array.isArray(row?.exercises) ? row.exercises : [];
    const normalizedExercises = (rawExercises.length ? rawExercises : fallbackExercises)
      .slice(0, 10)
      .map((exercise) => normalizeExercise(exercise))
      .filter((exercise) => sanitizeText(exercise.name).length > 0);

    normalized.push({
      dayName,
      workoutName: sanitizeText(row?.workoutName, `${toTitleCase(dayName)} Workout`),
      workoutType,
      focus: sanitizeText(row?.focus, `${workoutType} progression`),
      exercises: normalizedExercises.length
        ? normalizedExercises
        : fallbackExercises.map((exercise) => normalizeExercise(exercise)),
    });
  }

  if (normalized.length < 2) {
    return buildDefaultSchedule(daysPerWeek);
  }

  return normalized;
};

const findFirstBalancedJsonObject = (text) => {
  const source = String(text || '');
  const start = source.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
      if (depth < 0) break;
    }
  }

  return null;
};

const extractJsonObject = (text) => {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty Claude response');

  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] || raw;
  const balancedJson = findFirstBalancedJsonObject(candidate);

  if (!balancedJson) {
    throw new Error('Claude response JSON was incomplete');
  }

  try {
    return JSON.parse(balancedJson);
  } catch (error) {
    const details = error?.message || 'Invalid JSON';
    throw new Error(`Claude returned invalid JSON: ${details}`);
  }
};

const normalizePlan = (rawPlan, profile) => {
  const goal = sanitizeText(profile?.goal, 'general_fitness');
  const daysPerWeek = clampInt(profile?.daysPerWeek, 2, 6, 4);
  const weeklySchedule = normalizeWeeklySchedule(rawPlan?.weeklySchedule, daysPerWeek);

  return {
    planName: sanitizeText(rawPlan?.planName, 'AI Coach 8-Week Plan'),
    summary: sanitizeText(
      rawPlan?.summary,
      `8-week ${goal.replace(/_/g, ' ')} plan tailored to current fitness profile and training availability.`,
    ),
    goalMatch: sanitizeText(rawPlan?.goalMatch, `Plan optimized for ${goal.replace(/_/g, ' ')}`),
    durationWeeks: 8,
    weeklySchedule,
    progressionRules: Array.isArray(rawPlan?.progressionRules)
      ? rawPlan.progressionRules.map((item) => sanitizeText(item)).filter(Boolean).slice(0, 8)
      : [],
    recoveryRules: Array.isArray(rawPlan?.recoveryRules)
      ? rawPlan.recoveryRules.map((item) => sanitizeText(item)).filter(Boolean).slice(0, 8)
      : [],
    nutritionGuidance: Array.isArray(rawPlan?.nutritionGuidance)
      ? rawPlan.nutritionGuidance.map((item) => sanitizeText(item)).filter(Boolean).slice(0, 8)
      : [],
    checkpoints: Array.isArray(rawPlan?.checkpoints)
      ? rawPlan.checkpoints
        .map((item) => ({
          week: clampInt(item?.week, 1, 8, 1),
          target: sanitizeText(item?.target),
        }))
        .filter((item) => item.target)
        .slice(0, 8)
      : [],
  };
};

const buildSystemPrompt = () => (
  'You are an elite professional strength coach and gym programming specialist. '
  + 'You produce safe, practical, evidence-informed 8-week plans for general gym users. '
  + 'Return ONLY valid JSON with no markdown and no extra text. '
  + 'Respect user goal, experience, available days, and optional body-image context.'
);

const buildUserPrompt = (profile, imageCount) => {
  const daysPerWeek = clampInt(profile?.daysPerWeek, 2, 6, 4);
  const sessionDuration = clampInt(profile?.sessionDuration, 30, 120, 60);

  return [
    'Create a highly personalized 8-week gym plan.',
    '',
    'User profile:',
    `- Age: ${profile?.age ?? 'unknown'}`,
    `- Gender: ${profile?.gender || 'unknown'}`,
    `- Height (cm): ${profile?.heightCm ?? 'unknown'}`,
    `- Weight (kg): ${profile?.weightKg ?? 'unknown'}`,
    `- Goal: ${profile?.goal || 'general_fitness'}`,
    `- Experience level: ${profile?.experienceLevel || 'intermediate'}`,
    `- Body type: ${profile?.bodyType || 'unknown'}`,
    `- Training days per week: ${daysPerWeek}`,
    `- Session duration target (minutes): ${sessionDuration}`,
    `- Preferred training time: ${profile?.preferredTime || 'unspecified'}`,
    `- Equipment notes: ${profile?.equipment || 'full gym access'}`,
    `- Body images provided: ${imageCount}`,
    '',
    'Output JSON schema:',
    '{',
    '  "planName": "string",',
    '  "summary": "string",',
    '  "goalMatch": "string",',
    '  "durationWeeks": 8,',
    '  "weeklySchedule": [',
    '    {',
    '      "dayName": "Monday|Tuesday|...|Sunday",',
    '      "workoutName": "string",',
    '      "workoutType": "Upper Body|Lower Body|Push|Pull|Legs|Full Body",',
    '      "focus": "string",',
    '      "exercises": [',
    '        {',
    '          "name": "string",',
    '          "targetMuscles": ["Chest|Back|Quadriceps|Hamstrings|Shoulders|Biceps|Triceps|Forearms|Calves|Abs"],',
    '          "sets": 1-10 integer,',
    '          "reps": "string, e.g. 6-8 or 45 sec",',
    '          "restSeconds": 30-300 integer,',
    '          "rpe": 6.0-10.0 number,',
    '          "notes": "string"',
    '        }',
    '      ]',
    '    }',
    '  ],',
    '  "progressionRules": ["string"],',
    '  "recoveryRules": ["string"],',
    '  "nutritionGuidance": ["string"],',
    '  "checkpoints": [{ "week": 1-8, "target": "string" }]',
    '}',
    '',
    `Important: weeklySchedule must include exactly ${daysPerWeek} unique training days.`,
    'Prefer setting targetMuscles for each exercise to help downstream recovery modeling.',
  ].join('\n');
};

const parseClaudeText = (responsePayload) => {
  const contentBlocks = Array.isArray(responsePayload?.content) ? responsePayload.content : [];
  const text = contentBlocks
    .filter((block) => block?.type === 'text')
    .map((block) => String(block?.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Claude returned no text content');
  }
  return text;
};

export const hasAnthropicConfig = () => Boolean(String(process.env.ANTHROPIC_API_KEY || '').trim());

const CLAUDE_MAX_ATTEMPTS = 3;
const CLAUDE_REQUEST_TIMEOUT_MS = 90_000;

const isRetryableClaudeStatus = (statusCode) => (
  [408, 409, 429, 500, 502, 503, 504].includes(Number(statusCode))
);

const isRetryableClaudeParseError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error instanceof SyntaxError
    || message.includes('json')
    || message.includes('claude response did not contain')
    || message.includes('empty claude response')
  );
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stripHtml = (value) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildClaudeHttpErrorDetails = ({ statusCode, rawBody, parsedBody }) => {
  const status = Number(statusCode || 0);
  const parsedMessage = parsedBody?.error?.message || parsedBody?.message || '';
  const normalizedParsedMessage = String(parsedMessage || '').trim();
  const rawText = String(rawBody || '');
  const normalizedRawText = stripHtml(rawText);
  const mentionsCloudflare = /cloudflare/i.test(rawText) || /cloudflare/i.test(normalizedRawText);

  if (status === 429) {
    return 'Claude rate limit reached. Please retry in a few moments.';
  }
  if (status === 401 || status === 403) {
    return 'Claude authentication failed. Verify ANTHROPIC_API_KEY.';
  }
  if ([502, 503, 504].includes(status)) {
    const gatewayLabel = mentionsCloudflare ? ' (Cloudflare gateway)' : '';
    return `Claude service is temporarily unavailable${gatewayLabel}.`;
  }

  const safeMessage = normalizedParsedMessage || normalizedRawText || 'Unknown Claude API error';
  return safeMessage.slice(0, 300);
};

export const generateTwoMonthPlanWithClaude = async ({ profile = {}, bodyImages = [] } = {}) => {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model = String(process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL).trim() || DEFAULT_ANTHROPIC_MODEL;
  const preparedImages = (Array.isArray(bodyImages) ? bodyImages : [])
    .map((image) => parseDataUriImage(image))
    .filter(Boolean)
    .slice(0, MAX_INCLUDED_IMAGES);

  let lastError = null;

  for (let attempt = 1; attempt <= CLAUDE_MAX_ATTEMPTS; attempt += 1) {
    const retryInstruction = attempt > 1
      ? '\n\nIMPORTANT: Return one valid JSON object only. No markdown, no commentary, no partial output.'
      : '';

    const content = [
      {
        type: 'text',
        text: `${buildUserPrompt(profile, preparedImages.length)}${retryInstruction}`,
      },
      ...preparedImages.map((image) => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mediaType,
          data: image.data,
        },
      })),
    ];

    const requestBody = {
      model,
      max_tokens: attempt === 1 ? 4096 : 6144,
      temperature: attempt === 1 ? 0.3 : 0.1,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLAUDE_REQUEST_TIMEOUT_MS);

    let response;
    let rawBody = '';
    let parsedResponse = null;

    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      rawBody = await response.text();
      try {
        parsedResponse = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsedResponse = null;
      }
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      lastError = timedOut
        ? new Error('Claude API request timed out')
        : new Error(error?.message || 'Claude API request failed');

      if (attempt < CLAUDE_MAX_ATTEMPTS) {
        await wait(400 * attempt);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const details = buildClaudeHttpErrorDetails({
        statusCode: response.status,
        rawBody,
        parsedBody: parsedResponse,
      });
      lastError = new Error(`Claude API request failed (${response.status}): ${details}`);

      if (attempt < CLAUDE_MAX_ATTEMPTS && isRetryableClaudeStatus(response.status)) {
        await wait(500 * attempt);
        continue;
      }
      throw lastError;
    }

    try {
      const rawText = parseClaudeText(parsedResponse);
      const json = extractJsonObject(rawText);
      const plan = normalizePlan(json, profile);

      return {
        plan,
        rawText,
        model,
        usedImages: preparedImages.length,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || 'Claude response parsing failed'));
      const wasTruncated = String(parsedResponse?.stop_reason || '').toLowerCase() === 'max_tokens';

      if (attempt < CLAUDE_MAX_ATTEMPTS && (wasTruncated || isRetryableClaudeParseError(lastError))) {
        await wait(450 * attempt);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Claude onboarding generation failed');
};

export const buildCustomProgramPayloadFromClaudePlan = (plan = {}, options = {}) => {
  const durationWeeks = clampInt(options?.cycleWeeks ?? plan?.durationWeeks, 8, 8, 8);
  const desiredDays = clampInt(options?.daysPerWeek, 2, 6, 4);
  let weeklySchedule = normalizeWeeklySchedule(plan?.weeklySchedule, desiredDays);
  if (weeklySchedule.length > desiredDays) {
    weeklySchedule = weeklySchedule.slice(0, desiredDays);
  }

  const selectedDays = [...new Set(
    weeklySchedule
      .map((row) => normalizeDayName(row?.dayName))
      .filter(Boolean),
  )];

  const weeklyWorkouts = weeklySchedule.map((row) => ({
    dayName: normalizeDayName(row?.dayName),
    workoutName: sanitizeText(row?.workoutName, `${toTitleCase(normalizeDayName(row?.dayName))} Workout`),
    workoutType: sanitizeText(row?.workoutType, 'Custom'),
    notes: sanitizeText(row?.focus, null),
    exercises: (Array.isArray(row?.exercises) ? row.exercises : [])
      .map((exercise) => normalizeExercise(exercise))
      .slice(0, 10)
      .map((exercise) => ({
        name: exercise.name,
        muscleGroup: exercise.targetMuscles?.[0] || null,
        targetMuscles: Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles : [],
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
        notes: sanitizeText(exercise.notes, null),
      })),
  }));

  return {
    planName: sanitizeText(plan?.planName, 'AI Coach 8-Week Plan'),
    description: sanitizeText(
      plan?.summary,
      'AI-generated 8-week plan from onboarding profile and optional body-image analysis.',
    ),
    cycleWeeks: durationWeeks,
    selectedDays,
    weeklyWorkouts,
  };
};
