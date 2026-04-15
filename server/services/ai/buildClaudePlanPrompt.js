// @ts-check

import {
  AI_PLAN_PHASE_BLUEPRINT,
  AI_TRAINING_PLAN_DURATION_WEEKS,
  AI_TRAINING_PLAN_SCHEMA_VERSION,
} from './types.js';
import { buildBranchGuardrailSpec } from './validateClaudePlan.js';

const safeJsonStringify = (value, fallback = '{}') => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
};

const titleCase = (value) => {
  const normalized = String(value || '').trim().replace(/[_-]+/g, ' ');
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
};

const normalizeSplitPreference = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['upperlower', 'ul'].includes(normalized)) return 'upper_lower';
  if (['ppl', 'pushpulllegs'].includes(normalized)) return 'push_pull_legs';
  if (['ppl_ul', 'pplul'].includes(normalized)) return 'hybrid';
  if (['splitpush', 'split_push', 'sp'].includes(normalized)) return 'split_push';
  if (['auto', 'full_body', 'upper_lower', 'push_pull_legs', 'hybrid', 'split_push', 'custom'].includes(normalized)) {
    return normalized;
  }
  return 'auto';
};

const buildSplitDirective = (payload) => {
  const split = normalizeSplitPreference(payload?.split_preference || 'auto');
  if (split === 'full_body') {
    return 'Use a full-body structure across all training days.';
  }
  if (split === 'upper_lower') {
    return 'Use an upper/lower structure and keep weekly sequencing recovery-aware.';
  }
  if (split === 'push_pull_legs') {
    return 'Use a push/pull/legs structure and sequence it across the available weekly days.';
  }
  if (split === 'split_push') {
    return 'Use a split-push structure with Push, Pull, Legs, Push Hypertrophy, and Upper Balance sequencing.';
  }
  if (split === 'hybrid') {
    return 'Use a hybrid split that combines upper/lower and push/pull/legs when helpful.';
  }
  return 'Choose the best split automatically from the onboarding profile, recovery needs, and weekly availability.';
};

const buildTrackSpecificDirectives = (payload) => {
  const planningTrack = String(payload?.taxonomy?.planning_track || 'neutral').trim().toLowerCase();
  const branchFocus = titleCase(payload?.selected_sub_category || payload?.taxonomy?.branch_focus || '');
  const branchFamily = titleCase(payload?.taxonomy?.branch_family || '');

  if (planningTrack === 'female') {
    return [
      'Women-specific onboarding taxonomy must drive the plan. Do not flatten it into generic male bodybuilding logic.',
      branchFamily ? `Primary women branch family: ${branchFamily}.` : null,
      branchFocus ? `Selected women branch: ${branchFocus}.` : null,
      'If the branch points to glutes, silhouette/posture, toning, beginner fitness, fat loss, or muscle strengthening, reflect that directly in split choice, lower-body emphasis, exercise selection, and progression style.',
      'Keep enough upper-body work for balance, posture, symmetry, and injury prevention.',
    ].filter(Boolean);
  }

  if (planningTrack === 'male') {
    return [
      'Men-specific onboarding taxonomy must drive the plan.',
      branchFamily ? `Primary men branch family: ${branchFamily}.` : null,
      branchFocus ? `Selected men branch: ${branchFocus}.` : null,
      'If the branch points to hypertrophy, powerlifting, cutting, mass gain, beginner gym, natural athlete, classic physique, or a field/court/combat sport, the training logic must reflect that directly.',
      'Choose volume, intensity, movement bias, and progression style from the exact selected branch rather than from a generic template.',
    ].filter(Boolean);
  }

  return [
    'Use the provided onboarding taxonomy as the primary planning logic.',
    branchFamily ? `Branch family: ${branchFamily}.` : null,
    branchFocus ? `Selected branch: ${branchFocus}.` : null,
  ].filter(Boolean);
};

const buildImageDirective = (payload) => {
  const photoSummary = String(payload?.photo_analysis_summary_or_null || '').trim();
  const imagesProvidedCount = Number(payload?.images_provided_count || 0);

  if (photoSummary) {
    return [
      'A body-photo analysis summary is available and must be used as a high-signal input.',
      `Photo analysis summary: ${photoSummary}`,
      'Also infer practical coaching implications from the summary without making medical claims.',
    ];
  }

  if (imagesProvidedCount > 0) {
    return [
      `The user attached ${imagesProvidedCount} optional body photo(s).`,
      'Use the images to infer broad physique observations only, then return a concise photoAnalysisSummary string inside the JSON.',
      'If the photos are ambiguous, say so briefly and avoid overconfident claims.',
    ];
  }

  return [
    'No body-photo analysis is available. Build the plan from onboarding data only.',
    'Return photoAnalysisSummary as null.',
  ];
};

const buildPhaseJsonExample = () => safeJsonStringify(
  AI_PLAN_PHASE_BLUEPRINT.map((phase) => ({
    phaseName: phase.label,
    weekRange: { start: phase.startWeek, end: phase.endWeek },
    objective: 'string',
    workouts: [
      {
        dayName: 'Monday',
        sessionName: 'string',
        workoutType: 'Push|Pull|Legs|Upper Body|Lower Body|Full Body',
        focus: 'string',
        estimatedDurationMinutes: 60,
        notes: 'string',
        exercises: [
          {
            name: 'string',
            targetMuscles: ['Glutes', 'Hamstrings'],
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            tempo: '3-1-1-0',
            rpeTarget: 7.5,
            notes: 'string',
          },
        ],
      },
    ],
  })),
  '[]',
);

export const buildClaudePlanPrompt = (payload) => {
  const branchGuardrailSpec = buildBranchGuardrailSpec(payload);
  const phaseBlueprint = AI_PLAN_PHASE_BLUEPRINT
    .map((phase) => `- ${phase.label}: weeks ${phase.startWeek}-${phase.endWeek}`)
    .join('\n');

  const systemPrompt = [
    'You are an elite strength coach, hypertrophy specialist, and sport performance planner.',
    'Build a realistic, highly personalized 8-week training plan from onboarding data.',
    'The plan must feel like a professional coach wrote it.',
    'Do not repeat the same week 8 times.',
    'Every phase must materially change through volume, intensity, exercise emphasis, tempo, or recovery strategy.',
    'Respect training availability, session duration, goal, recovery limits, equipment constraints, and the selected onboarding taxonomy.',
    'Never collapse women-specific onboarding branches into the same logic as men-specific branches.',
    'Never output markdown tables.',
    'Return two parts only:',
    '1. A short coaching rationale in plain text.',
    '2. One ```json``` block that exactly follows the requested schema.',
  ].join(' ');

  const userPrompt = [
    `Schema version: ${AI_TRAINING_PLAN_SCHEMA_VERSION}`,
    `Duration: ${AI_TRAINING_PLAN_DURATION_WEEKS} weeks`,
    '',
    'Coach objective:',
    '- Build a structured 8-week plan that fits this exact athlete.',
    '- Use the onboarding taxonomy as the core planning logic.',
    '- Make each phase meaningfully different.',
    '- Keep workouts realistic for a gym setting and the stated session duration.',
    '',
    'Core athlete payload:',
    safeJsonStringify(payload),
    '',
    'Planning directives:',
    `- ${buildSplitDirective(payload)}`,
    ...buildTrackSpecificDirectives(payload).map((line) => `- ${line}`),
    ...buildImageDirective(payload).map((line) => `- ${line}`),
    '- Branch guardrails:',
    `- Preserve this planning headline: ${branchGuardrailSpec.repairHeadline}.`,
    `- Preserve this coaching focus: ${branchGuardrailSpec.repairFocus}.`,
    `- Preserve this rationale: ${branchGuardrailSpec.repairObjective}.`,
    ...branchGuardrailSpec.requiredTextTerms.map((item) => `- Include branch-appropriate planning language around: ${item}.`),
    ...branchGuardrailSpec.requiredTargetMuscles.map((item) => `- The plan should visibly emphasize this target when appropriate: ${item}.`),
    '- Respect injuries, movement restrictions, recovery bias, and equipment notes.',
    '- Use exercise names that a real coach would prescribe in a commercial gym or home-gym context depending on equipment.',
    '- Each phase must keep the same overall weekly availability while progressing intelligently.',
    '',
    'Phase blueprint:',
    phaseBlueprint,
    '',
    'Required JSON shape:',
    '{',
    '  "planName": "string",',
    '  "userSummary": {',
    '    "name": "string|null",',
    '    "goal": "string",',
    '    "fitnessLevel": "string",',
    '    "mainProfileCategory": "string",',
    '    "selectedSubCategory": "string|null",',
    '    "daysPerWeek": "number",',
    '    "sessionDurationMinutes": "number"',
    '  },',
    '  "programOverview": "string",',
    '  "coachingInterpretation": "string",',
    '  "photoAnalysisSummary": "string|null",',
    '  "weeklySplit": [',
    '    {',
    '      "weekRange": { "start": 1, "end": 2 },',
    '      "splitName": "string",',
    '      "rationale": "string",',
    '      "trainingDays": [',
    '        {',
    '          "dayName": "Monday",',
    '          "sessionName": "string",',
    '          "workoutType": "Push|Pull|Legs|Upper Body|Lower Body|Full Body",',
    '          "focus": "string",',
    '          "estimatedDurationMinutes": 60',
    '        }',
    '      ]',
    '    }',
    '  ],',
    '  "workoutsByPhase": ',
    buildPhaseJsonExample(),
    ',',
    '  "progressionStrategy": [',
    '    {',
    '      "weekRange": { "start": 1, "end": 2 },',
    '      "title": "string",',
    '      "details": "string"',
    '    }',
    '  ],',
    '  "recoveryStrategy": [',
    '    {',
    '      "title": "string",',
    '      "details": "string"',
    '    }',
    '  ],',
    '  "nutritionGuidance": ["string"],',
    '  "coachNotes": [',
    '    {',
    '      "title": "string",',
    '      "details": "string"',
    '    }',
    '  ],',
    '  "finalCoachMessage": "string"',
    '}',
    '',
    'Hard requirements:',
    `- There must be 4 phases covering all ${AI_TRAINING_PLAN_DURATION_WEEKS} weeks.`,
    `- Every phase must include exactly ${Number(payload?.days_per_week || 4)} training days.`,
    `- Every workout should fit inside about ${Number(payload?.session_duration_minutes || 60)} minutes.`,
    '- Exercises must include sets, reps, restSeconds, and useful coaching notes.',
    '- The JSON must be valid and complete.',
  ].join('\n');

  return {
    systemPrompt,
    userPrompt,
  };
};
