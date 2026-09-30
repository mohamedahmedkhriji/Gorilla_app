import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isProgramEngineSupportedProfile,
  normalizeTrainingProfile,
  validateTrainingProfile,
} from './index.js';

const baseInput = {
  gender: 'Man',
  age: 28,
  height: 178,
  weight: 82,
  bodyType: 'Mesomorph',
  appMotivation: 'guided_start',
  athleteIdentity: 'bodybuilding',
  athleteSubCategoryId: 'hypertrophy',
  experienceLevel: 'I train regularly',
  workoutDays: 4,
  sessionDuration: 60,
  preferredTime: 'Evening',
  aiTrainingFocus: 'Balanced',
  aiRecoveryPriority: 'Balanced',
};

const assertValidGoal = (patch, expectedGoal) => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    ...patch,
  });

  assert.equal(profile.engineTarget, 'program_engine');
  assert.equal(profile.bypassReason, null);
  assert.equal(profile.goal, expectedGoal);
  assert.equal(validateTrainingProfile(profile).valid, true);
  return profile;
};

test('normalizes Bodybuilding + Hypertrophy', () => {
  const profile = assertValidGoal({
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'hypertrophy',
  }, 'hypertrophy');

  assert.equal(profile.identity, 'bodybuilding');
});

test('normalizes Bodybuilding + Powerlifting', () => {
  assertValidGoal({
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'powerlifting',
  }, 'powerlifting');
});

test('normalizes Bodybuilding + Cutting', () => {
  assertValidGoal({
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'cutting',
  }, 'cutting');
});

test('normalizes Bodybuilding + Bulking', () => {
  assertValidGoal({
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'bulking',
  }, 'bulking');
});

test('normalizes Cardio + Fat Loss', () => {
  const profile = assertValidGoal({
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'fat_loss',
  }, 'fat_loss');

  assert.equal(profile.identity, 'cardio');
});

test('normalizes Cardio + Endurance', () => {
  assertValidGoal({
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'endurance',
  }, 'endurance');
});

test('maps beginner experience', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    experienceLevel: 'I am new or returning',
  });

  assert.equal(profile.experience, 'beginner');
});

test('maps intermediate experience', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    experienceLevel: 'I train regularly',
  });

  assert.equal(profile.experience, 'intermediate');
});

test('maps advanced experience', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    experienceLevel: 'I am experienced',
  });

  assert.equal(profile.experience, 'advanced');
});

test('normalizes woman with cycle information', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    gender: 'Woman',
    periodCycle: {
      lastPeriodStart: '2026-09-10',
      typicalCycleLength: 29,
      typicalPeriodDuration: 5,
      stats: {
        confidence: 'medium',
      },
    },
  });

  assert.equal(profile.gender, 'woman');
  assert.deepEqual(profile.cycleContext, {
    lastPeriodStart: '2026-09-10',
    typicalCycleLength: 29,
    typicalPeriodDuration: 5,
    stats: {
      confidence: 'medium',
    },
  });
});

test('normalizes woman without cycle information', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    gender: 'Woman',
  });

  assert.equal(profile.gender, 'woman');
  assert.equal(profile.cycleContext, null);
});

test('normalizes man', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    gender: 'Man',
  });

  assert.equal(profile.gender, 'man');
});

test('validates invalid days per week', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    workoutDays: 7,
  });
  const result = validateTrainingProfile(profile);

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'invalid_days_per_week'), true);
});

test('validates invalid session duration', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    sessionDuration: 75,
  });
  const result = validateTrainingProfile(profile);

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'invalid_session_duration'), true);
});

test('validates unsupported goal', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    athleteSubCategoryId: 'mobility',
    fitnessGoal: 'Mobility',
    aiTrainingFocus: '',
  });
  const result = validateTrainingProfile({
    ...profile,
    goal: 'mobility',
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'unsupported_goal'), true);
});

test('HYROX bypasses this engine', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    athleteIdentity: 'hyrox',
    athleteSubCategoryId: '',
  });
  const result = validateTrainingProfile(profile);

  assert.equal(profile.engineTarget, 'legacy');
  assert.equal(profile.bypassReason, 'hyrox');
  assert.equal(result.valid, true);
  assert.equal(result.bypassed, true);
  assert.equal(isProgramEngineSupportedProfile(profile), false);
});

test('Boxing bypasses this engine', () => {
  const profile = normalizeTrainingProfile({
    ...baseInput,
    athleteIdentity: 'Box',
    athleteSubCategoryId: '',
  });
  const result = validateTrainingProfile(profile);

  assert.equal(profile.identity, 'boxing');
  assert.equal(profile.engineTarget, 'legacy');
  assert.equal(profile.bypassReason, 'boxing');
  assert.equal(result.valid, true);
  assert.equal(result.bypassed, true);
  assert.equal(isProgramEngineSupportedProfile(profile), false);
});

