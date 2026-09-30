import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProgramBlueprint,
  normalizeTrainingProfile,
  validateProgramBlueprint,
} from '../index.js';

const baseInput = {
  gender: 'Man',
  age: 30,
  height: 180,
  weight: 82,
  bodyType: 'Mesomorph',
  appMotivation: 'guided_start',
  athleteIdentity: 'Bodybuilding',
  athleteSubCategoryId: 'hypertrophy',
  experienceLevel: 'I train regularly',
  workoutDays: 4,
  sessionDuration: 60,
  preferredTime: 'Evening',
  aiTrainingFocus: 'Balanced',
  aiRecoveryPriority: 'Balanced',
};

const profileFor = ({
  identity = 'Bodybuilding',
  goal = 'hypertrophy',
  experience = 'intermediate',
  days = 4,
  duration = 60,
  gender = 'Man',
  bodyType = 'Mesomorph',
  motivation = 'guided_start',
  trainingFocus = 'Balanced',
  recovery = 'Balanced',
  cycleContext = null,
} = {}) => normalizeTrainingProfile({
  ...baseInput,
  gender,
  bodyType,
  appMotivation: motivation,
  athleteIdentity: identity,
  athleteSubCategoryId: goal,
  experienceLevel: experience,
  workoutDays: days,
  sessionDuration: duration,
  aiTrainingFocus: trainingFocus,
  aiRecoveryPriority: recovery,
  periodCycle: cycleContext,
});

const assertValidBlueprint = (profile) => {
  const blueprint = buildProgramBlueprint(profile);
  const validation = validateProgramBlueprint(blueprint);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.equal(blueprint.weekTemplate.length, 7);
  assert.equal(blueprint.weekTemplate.filter((day) => day.type === 'training').length, blueprint.daysPerWeek);
  assert.equal(new Set(blueprint.weekTemplate.map((day) => day.dayOfWeek)).size, 7);
  return blueprint;
};

const coreStructure = (blueprint) => ({
  split: blueprint.split,
  weekTemplate: blueprint.weekTemplate,
  modifiers: blueprint.modifiers,
});

test('intermediate hypertrophy 5 days 60m produces PPL + Upper/Lower abstract blueprint', () => {
  const blueprint = assertValidBlueprint(profileFor({
    goal: 'hypertrophy',
    experience: 'intermediate',
    days: 5,
    duration: 60,
  }));

  assert.equal(blueprint.split.id, 'ppl_upper_lower');
  assert.deepEqual(
    blueprint.weekTemplate
      .filter((day) => day.type === 'training')
      .map((day) => day.sessionType),
    ['push', 'pull', 'legs', 'upper', 'lower'],
  );
  assert.equal(blueprint.weekTemplate.find((day) => day.dayOfWeek === 4).type, 'rest');
  assert.equal(blueprint.weekTemplate.find((day) => day.dayOfWeek === 7).type, 'rest');
  assert.equal(blueprint.weekTemplate.find((day) => day.sessionType === 'push').slots.length, 6);
  assert.equal(blueprint.weekTemplate.find((day) => day.sessionType === 'pull').slots.length, 6);
  assert.equal(blueprint.weekTemplate.find((day) => day.sessionType === 'legs').slots.length, 6);
});

test('hypertrophy matrix is valid', () => {
  [
    ['beginner', 2, 30, 'full_body_ab'],
    ['beginner', 3, 45, 'full_body_abc'],
    ['intermediate', 4, 60, 'upper_lower'],
    ['intermediate', 5, 60, 'ppl_upper_lower'],
    ['advanced', 6, 90, 'ppl_x2'],
  ].forEach(([experience, days, duration, splitId]) => {
    const blueprint = assertValidBlueprint(profileFor({ goal: 'hypertrophy', experience, days, duration }));
    assert.equal(blueprint.split.id, splitId);
  });
});

test('powerlifting matrix is valid and exposes squat, bench, and deadlift patterns', () => {
  [
    ['beginner', 2],
    ['beginner', 3],
    ['intermediate', 4],
    ['intermediate', 5],
    ['advanced', 6],
  ].forEach(([experience, days]) => {
    const blueprint = assertValidBlueprint(profileFor({ goal: 'powerlifting', experience, days, duration: 60 }));
    const patterns = new Set(
      blueprint.weekTemplate
        .filter((day) => day.type === 'training')
        .flatMap((day) => day.slots.map((slot) => slot.movementPattern)),
    );
    assert.equal(patterns.has('squat_pattern'), true);
    assert.equal(patterns.has('bench'), true);
    assert.equal(patterns.has('deadlift'), true);
    assert.match(blueprint.split.id, /^powerlifting_/);
  });
});

test('cutting and bulking matrices use resistance splits without changing nutrition assumptions', () => {
  [
    ['cutting', 'beginner', 3],
    ['cutting', 'intermediate', 4],
    ['cutting', 'advanced', 5],
    ['bulking', 'beginner', 3],
    ['bulking', 'intermediate', 5],
    ['bulking', 'advanced', 6],
  ].forEach(([goal, experience, days]) => {
    const blueprint = assertValidBlueprint(profileFor({ goal, experience, days, duration: 60 }));
    assert.equal(blueprint.profile.goal, goal);
    assert.notEqual(blueprint.split.id, 'fat_loss_3_day');
  });
});

test('fat loss matrix mixes resistance and cardiovascular slots', () => {
  [
    ['beginner', 2],
    ['beginner', 3],
    ['intermediate', 4],
    ['intermediate', 5],
  ].forEach(([experience, days]) => {
    const blueprint = assertValidBlueprint(profileFor({
      identity: 'Cardio',
      goal: 'fat_loss',
      experience,
      days,
      duration: experience === 'beginner' ? 45 : 60,
    }));
    const patterns = blueprint.weekTemplate.flatMap((day) => day.slots ?? []).map((slot) => slot.movementPattern);
    assert.equal(patterns.includes('easy_aerobic'), true);
    assert.equal(patterns.some((pattern) => ['squat_pattern', 'horizontal_press', 'horizontal_pull'].includes(pattern)), true);
  });
});

test('endurance matrix is valid and avoids stacked hard sessions', () => {
  [
    ['beginner', 2],
    ['beginner', 3],
    ['intermediate', 4],
    ['advanced', 5],
    ['advanced', 6],
  ].forEach(([experience, days]) => {
    const blueprint = assertValidBlueprint(profileFor({
      identity: 'Cardio',
      goal: 'endurance',
      experience,
      days,
      duration: experience === 'beginner' ? 45 : 60,
    }));
    const hardDays = blueprint.weekTemplate
      .filter((day) => day.type === 'training')
      .filter((day) => day.slots.some((slot) => ['tempo', 'interval'].includes(slot.movementPattern)))
      .map((day) => day.dayOfWeek);
    hardDays.forEach((day, index) => {
      const next = hardDays[index + 1];
      if (next != null) assert.ok(next - day > 1);
    });
  });
});

test('duration controls slot count from compact to expanded', () => {
  const compact = assertValidBlueprint(profileFor({ goal: 'hypertrophy', experience: 'intermediate', days: 5, duration: 30 }));
  const expanded = assertValidBlueprint(profileFor({ goal: 'hypertrophy', experience: 'intermediate', days: 5, duration: 90 }));
  const compactSlots = compact.weekTemplate.find((day) => day.sessionType === 'push').slots.length;
  const expandedSlots = expanded.weekTemplate.find((day) => day.sessionType === 'push').slots.length;

  assert.ok(compactSlots < expandedSlots);
});

test('45 and 60 minute blueprints preserve valid structure', () => {
  [45, 60].forEach((duration) => {
    const blueprint = assertValidBlueprint(profileFor({ goal: 'hypertrophy', experience: 'intermediate', days: 4, duration }));
    assert.equal(blueprint.sessionDurationMinutes, duration);
  });
});

test('recovery strategies modestly adjust optional slot retention', () => {
  const conservative = assertValidBlueprint(profileFor({
    goal: 'hypertrophy',
    experience: 'advanced',
    days: 5,
    duration: 90,
    recovery: 'Conservative',
  }));
  const push = assertValidBlueprint(profileFor({
    goal: 'hypertrophy',
    experience: 'advanced',
    days: 5,
    duration: 90,
    recovery: 'Push progression',
  }));

  const countSlots = (blueprint) => blueprint.weekTemplate
    .filter((day) => day.type === 'training')
    .reduce((sum, day) => sum + day.slots.length, 0);
  assert.ok(countSlots(push) >= countSlots(conservative));
});

test('training focus modifies priorities without replacing the primary goal', () => {
  const blueprint = assertValidBlueprint(profileFor({
    goal: 'hypertrophy',
    trainingFocus: 'Strength',
    days: 5,
    duration: 60,
  }));

  assert.equal(blueprint.profile.goal, 'hypertrophy');
  assert.equal(blueprint.modifiers.trainingFocus, 'strength');
  assert.ok(blueprint.weekTemplate.flatMap((day) => day.slots ?? []).some((slot) => slot.role === 'primary_compound'));
});

test('male and female profiles keep equivalent core logic', () => {
  const male = assertValidBlueprint(profileFor({ gender: 'Man', goal: 'hypertrophy', days: 5, duration: 60 }));
  const female = assertValidBlueprint(profileFor({ gender: 'Woman', goal: 'hypertrophy', days: 5, duration: 60 }));

  assert.deepEqual(coreStructure(female), coreStructure(male));
});

test('woman with and without cycle context keeps core structure and only changes metadata', () => {
  const withoutCycle = assertValidBlueprint(profileFor({ gender: 'Woman', goal: 'hypertrophy', days: 4, duration: 60 }));
  const withCycle = assertValidBlueprint(profileFor({
    gender: 'Woman',
    goal: 'hypertrophy',
    days: 4,
    duration: 60,
    cycleContext: {
      lastPeriodStart: '2026-09-10',
      typicalCycleLength: 29,
      typicalPeriodDuration: 5,
    },
  }));

  assert.deepEqual(coreStructure(withCycle), coreStructure(withoutCycle));
  assert.equal(withCycle.metadata.cycleContextPresent, true);
  assert.equal(withoutCycle.metadata.cycleContextPresent, false);
});

test('bodyType does not alter blueprint training structure', () => {
  const ectomorph = assertValidBlueprint(profileFor({ bodyType: 'Ectomorph', goal: 'hypertrophy', days: 5, duration: 60 }));
  const endomorph = assertValidBlueprint(profileFor({ bodyType: 'Endomorph', goal: 'hypertrophy', days: 5, duration: 60 }));

  assert.deepEqual(coreStructure(ectomorph), coreStructure(endomorph));
});

test('motivation does not alter blueprint training structure', () => {
  const guided = assertValidBlueprint(profileFor({ motivation: 'guided_start', goal: 'hypertrophy', days: 4, duration: 60 }));
  const confidence = assertValidBlueprint(profileFor({ motivation: 'confidence', goal: 'hypertrophy', days: 4, duration: 60 }));

  assert.deepEqual(coreStructure(guided), coreStructure(confidence));
});

test('blueprint generation is deterministic', () => {
  const profile = profileFor({ goal: 'powerlifting', experience: 'intermediate', days: 4, duration: 60 });
  assert.deepEqual(buildProgramBlueprint(profile), buildProgramBlueprint(profile));
});

test('invalid profile and bypassed identities are rejected', () => {
  assert.throws(
    () => buildProgramBlueprint(profileFor({ goal: 'hypertrophy', days: 7, duration: 60 })),
    /Days per week must be between 2 and 6/,
  );

  assert.throws(
    () => buildProgramBlueprint(profileFor({ identity: 'hyrox', goal: 'hypertrophy', days: 4, duration: 60 })),
    /Bypassed profiles cannot enter/,
  );

  assert.throws(
    () => buildProgramBlueprint(profileFor({ identity: 'Box', goal: 'hypertrophy', days: 4, duration: 60 })),
    /Bypassed profiles cannot enter/,
  );
});

test('dataset availability is not required for blueprint generation', () => {
  const blueprint = assertValidBlueprint(profileFor({ goal: 'hypertrophy', days: 5, duration: 60 }));
  assert.equal(blueprint.metadata.datasetRequired, false);
});
