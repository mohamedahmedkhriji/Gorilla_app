import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTrainingStrategy,
  normalizeTrainingProfile,
  validateTrainingStrategy,
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
  experienceLevel: 'intermediate',
  workoutDays: 4,
  sessionDuration: 60,
  preferredTime: 'Evening',
  aiTrainingFocus: 'Balanced',
  aiRecoveryPriority: 'Balanced',
  aiEquipmentNotes: 'Full gym',
};

const inputFor = (patch = {}) => ({
  ...baseInput,
  ...patch,
});

const strategyFor = (patch = {}) => buildTrainingStrategy(normalizeTrainingProfile(inputFor(patch)));

const assertValidStrategy = (strategy) => {
  const validation = validateTrainingStrategy(strategy);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  return strategy;
};

const programmingShape = (strategy) => ({
  goal: strategy.goal,
  experience: strategy.experience,
  schedule: strategy.schedule,
  architecture: strategy.architecture,
  workload: strategy.workload,
  exerciseStrategy: strategy.exerciseStrategy,
  progressionStrategy: strategy.progressionStrategy,
  constraints: strategy.constraints,
  preferences: strategy.preferences,
});

const supportedCases = [
  ['Bodybuilding', 'hypertrophy'],
  ['Bodybuilding', 'powerlifting'],
  ['Bodybuilding', 'cutting'],
  ['Bodybuilding', 'bulking'],
  ['Cardio', 'fat_loss'],
  ['Cardio', 'endurance'],
];

const referenceFixtures = [
  {
    source: 'fitness.project/program_summary',
    goal: 'hypertrophy',
    level: 'intermediate',
    equipment: 'full_gym',
    programLengthWeeks: 8,
    averageSessionMinutes: 60,
    inferredDaysPerWeek: 5,
  },
  {
    source: 'fitness.project/program_summary',
    goal: 'hypertrophy',
    level: 'intermediate',
    equipment: 'full_gym',
    programLengthWeeks: 8,
    averageSessionMinutes: 55,
    inferredDaysPerWeek: null,
  },
  {
    source: 'fitness.project/program_summary',
    goal: 'fat_loss',
    level: 'beginner',
    equipment: 'full_gym',
    programLengthWeeks: 8,
    averageSessionMinutes: 45,
    inferredDaysPerWeek: 3,
  },
  {
    source: 'fitness.project/program_summary',
    goal: 'endurance',
    level: 'advanced',
    equipment: 'full_gym',
    programLengthWeeks: 8,
    averageSessionMinutes: 60,
    inferredDaysPerWeek: 5,
  },
];

const assertSerializable = (value) => {
  const serialized = JSON.stringify(value);
  assert.ok(serialized.length > 0);
  assert.deepEqual(JSON.parse(serialized), value);
};

const assertNoUndefinedOrNaN = (value, path = 'strategy') => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUndefinedOrNaN(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => assertNoUndefinedOrNaN(item, `${path}.${key}`));
    return;
  }
  assert.notEqual(value, undefined, path);
  if (typeof value === 'number') assert.equal(Number.isNaN(value), false, path);
};

test('Training Brain supports all Program Engine goals', () => {
  [
    ['Bodybuilding', 'hypertrophy'],
    ['Bodybuilding', 'powerlifting'],
    ['Bodybuilding', 'cutting'],
    ['Bodybuilding', 'bulking'],
    ['Cardio', 'fat_loss'],
    ['Cardio', 'endurance'],
  ].forEach(([athleteIdentity, athleteSubCategoryId]) => {
    const strategy = assertValidStrategy(strategyFor({ athleteIdentity, athleteSubCategoryId }));
    assert.equal(strategy.status, 'ready');
    assert.equal(strategy.goal, athleteSubCategoryId);
    assert.ok(strategy.reasons.some((entry) => entry.code === 'GOAL_RECOGNIZED'));
  });
});

test('experience, days, and duration matrices produce valid deterministic strategies', () => {
  ['beginner', 'intermediate', 'advanced'].forEach((experienceLevel) => {
    [2, 3, 4, 5, 6].forEach((workoutDays) => {
      [30, 45, 60, 90].forEach((sessionDuration) => {
        const first = assertValidStrategy(strategyFor({
          experienceLevel,
          workoutDays,
          sessionDuration,
        }));
        const second = strategyFor({
          experienceLevel,
          workoutDays,
          sessionDuration,
        });

        assert.deepEqual(second, first);
        assert.equal(first.schedule.daysPerWeek, workoutDays);
        assert.equal(first.schedule.sessionDurationMinutes, sessionDuration);
      });
    });
  });
});

test('Phase 2 full 720 matrix preserves strategy invariants', () => {
  let combinations = 0;
  supportedCases.forEach(([athleteIdentity, athleteSubCategoryId]) => {
    ['beginner', 'intermediate', 'advanced'].forEach((experienceLevel) => {
      [2, 3, 4, 5, 6].forEach((workoutDays) => {
        [30, 45, 60, 90].forEach((sessionDuration) => {
          ['Man', 'Woman'].forEach((gender) => {
            combinations += 1;
            const first = assertValidStrategy(strategyFor({
              athleteIdentity,
              athleteSubCategoryId,
              experienceLevel,
              workoutDays,
              sessionDuration,
              gender,
            }));
            const second = strategyFor({
              athleteIdentity,
              athleteSubCategoryId,
              experienceLevel,
              workoutDays,
              sessionDuration,
              gender,
            });

            assert.deepEqual(second, first);
            assert.equal(first.goal, athleteSubCategoryId);
            assert.equal(first.schedule.daysPerWeek, workoutDays);
            assert.equal(first.schedule.sessionDurationMinutes, sessionDuration);
            assert.ok(first.reasons.length > 0);
            assert.ok(first.explainability.reasons.length > 0);
            assert.ok(['ready', 'conflict'].includes(first.status));
            assertNoUndefinedOrNaN(first);
            assertSerializable(first);

            if (first.status === 'ready') {
              assert.ok(first.architecture.splitStrategy);
              assert.equal(first.architecture.selectedStrategy, first.architecture.splitStrategy);
              assert.ok(first.reasons.some((entry) => entry.code === 'PROGRAM_ENGINE_COMPATIBLE'));
            } else {
              assert.ok(first.explainability.rejectedCandidates.length > 0);
            }
          });
        });
      });
    });
  });

  assert.equal(combinations, 720);
});

test('strategy maps expected high-level splits without replacing Program Engine construction', () => {
  assert.equal(strategyFor({ athleteSubCategoryId: 'hypertrophy', workoutDays: 2 }).architecture.splitStrategy, 'full_body_ab');
  assert.equal(strategyFor({ athleteSubCategoryId: 'hypertrophy', workoutDays: 5 }).architecture.splitStrategy, 'ppl_upper_lower');
  assert.equal(strategyFor({ athleteSubCategoryId: 'powerlifting', workoutDays: 4 }).architecture.splitStrategy, 'powerlifting_4_day');
  assert.equal(strategyFor({ athleteIdentity: 'Cardio', athleteSubCategoryId: 'fat_loss', workoutDays: 5 }).architecture.splitStrategy, 'fat_loss_4_day');
  assert.equal(strategyFor({ athleteIdentity: 'Cardio', athleteSubCategoryId: 'endurance', workoutDays: 6 }).architecture.splitStrategy, 'endurance_6_day');
});

test('available days and prescribed days are distinct and prescription never exceeds availability', () => {
  const fatLoss = assertValidStrategy(strategyFor({
    gender: 'Man',
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'fat_loss',
    experienceLevel: 'beginner',
    workoutDays: 6,
    sessionDuration: 45,
  }));

  assert.equal(fatLoss.status, 'ready');
  assert.equal(fatLoss.schedule.availableDaysPerWeek, 6);
  assert.equal(fatLoss.schedule.daysPerWeek, 6);
  assert.equal(fatLoss.schedule.prescribedDaysPerWeek, 3);
  assert.equal(fatLoss.architecture.splitStrategy, 'fat_loss_3_day');
  assert.ok(fatLoss.schedule.prescribedDaysPerWeek <= fatLoss.schedule.availableDaysPerWeek);

  supportedCases.forEach(([athleteIdentity, athleteSubCategoryId]) => {
    [2, 3, 4, 5, 6].forEach((workoutDays) => {
      const strategy = assertValidStrategy(strategyFor({
        athleteIdentity,
        athleteSubCategoryId,
        workoutDays,
        sessionDuration: 60,
      }));
      if (strategy.status === 'ready') {
        assert.ok(strategy.schedule.prescribedDaysPerWeek <= strategy.schedule.availableDaysPerWeek);
      }
    });
  });
});

test('equipment restrictions and movement avoidance are represented as hard constraints', () => {
  const strategy = assertValidStrategy(strategyFor({
    aiEquipmentNotes: 'Dumbbells only',
    aiLimitations: 'avoid overhead press',
  }));

  assert.deepEqual(strategy.constraints.requiredEquipment, ['dumbbell']);
  assert.ok(strategy.constraints.excludedEquipment.includes('barbell'));
  assert.ok(strategy.constraints.movementsToAvoid.includes('vertical_press'));
  assert.ok(strategy.reasons.some((entry) => entry.code === 'HARD_CONSTRAINTS_RECORDED'));
});

test('targeted Phase 2 decision cases are valid and explainable', () => {
  [
    { athleteSubCategoryId: 'hypertrophy', experienceLevel: 'beginner', workoutDays: 2, sessionDuration: 30, expected: 'full_body_ab' },
    { athleteSubCategoryId: 'hypertrophy', experienceLevel: 'intermediate', workoutDays: 5, sessionDuration: 60, expected: 'ppl_upper_lower' },
    { athleteSubCategoryId: 'hypertrophy', experienceLevel: 'advanced', workoutDays: 6, sessionDuration: 90, expected: 'ppl_x2' },
    { athleteSubCategoryId: 'powerlifting', experienceLevel: 'beginner', workoutDays: 3, sessionDuration: 60, expected: 'powerlifting_3_day' },
    { athleteSubCategoryId: 'powerlifting', experienceLevel: 'intermediate', workoutDays: 4, sessionDuration: 90, expected: 'powerlifting_4_day' },
    { athleteSubCategoryId: 'powerlifting', experienceLevel: 'advanced', workoutDays: 6, sessionDuration: 90, expected: 'powerlifting_6_day' },
    { athleteSubCategoryId: 'cutting', experienceLevel: 'intermediate', workoutDays: 4, sessionDuration: 60, aiRecoveryPriority: 'Conservative', expected: 'upper_lower' },
    { athleteSubCategoryId: 'bulking', experienceLevel: 'intermediate', workoutDays: 5, sessionDuration: 60, aiRecoveryPriority: 'Push progression', expected: 'ppl_upper_lower' },
    { athleteIdentity: 'Cardio', athleteSubCategoryId: 'fat_loss', experienceLevel: 'beginner', workoutDays: 3, sessionDuration: 30, expected: 'fat_loss_3_day' },
    { athleteIdentity: 'Cardio', athleteSubCategoryId: 'endurance', experienceLevel: 'intermediate', workoutDays: 5, sessionDuration: 60, expected: 'endurance_5_day' },
  ].forEach(({ expected, ...patch }) => {
    const strategy = assertValidStrategy(strategyFor(patch));
    assert.equal(strategy.status, 'ready');
    assert.equal(strategy.architecture.splitStrategy, expected);
    assert.ok(strategy.explainability.rejectedCandidates.length >= 0);
  });
});

test('powerlifting primary movement conflict is structured and never silently ignored', () => {
  const strategy = assertValidStrategy(strategyFor({
    athleteSubCategoryId: 'powerlifting',
    workoutDays: 4,
    sessionDuration: 90,
    aiLimitations: 'avoid squats',
  }));

  assert.equal(strategy.status, 'conflict');
  assert.ok(strategy.warnings.some((entry) => entry.code === 'POWERLIFTING_PRIMARY_MOVEMENT_CONFLICT'));
  assert.ok(strategy.explainability.rejectedCandidates.some((candidate) =>
    candidate.reasons.some((entry) => entry.code === 'POWERLIFTING_PRIMARY_MOVEMENT_CONFLICT')));
});

test('no barbell prevents powerlifting selection through equipment compatibility', () => {
  const strategy = assertValidStrategy(strategyFor({
    athleteSubCategoryId: 'powerlifting',
    workoutDays: 4,
    sessionDuration: 90,
    aiEquipmentNotes: 'No barbell',
  }));

  assert.equal(strategy.status, 'conflict');
  assert.ok(strategy.explainability.rejectedCandidates.some((candidate) =>
    candidate.reasons.some((entry) => entry.code === 'POWERLIFTING_EQUIPMENT_CONFLICT')));
});

test('recovery preference changes fatigue and progression concepts conservatively', () => {
  const conservative = assertValidStrategy(strategyFor({ aiRecoveryPriority: 'Conservative' }));
  const push = assertValidStrategy(strategyFor({ aiRecoveryPriority: 'Push progression' }));

  assert.equal(conservative.workload.fatigueStrategy, 'conservative');
  assert.equal(conservative.progressionStrategy.aggressiveness, 'conservative');
  assert.equal(push.workload.fatigueStrategy, 'performance_biased');
  assert.equal(push.progressionStrategy.aggressiveness, 'moderate_high');
});

test('sex-aware metadata is represented without stereotype-driven programming', () => {
  const male = assertValidStrategy(strategyFor({ gender: 'Man', athleteSubCategoryId: 'hypertrophy' }));
  const female = assertValidStrategy(strategyFor({ gender: 'Woman', athleteSubCategoryId: 'hypertrophy' }));

  assert.equal(male.sexAware.profile, 'male');
  assert.equal(female.sexAware.profile, 'female');
  assert.deepEqual(male.sexAware.adjustments, []);
  assert.deepEqual(female.sexAware.adjustments, []);
  assert.equal(female.goal, 'hypertrophy');
  assert.notEqual(female.exerciseStrategy.isolationPriority, 'glutes');
  assert.notEqual(male.exerciseStrategy.isolationPriority, 'chest_arms');
  assert.equal(female.sexAware.adjustments.every((entry) => entry.reasonCode), true);
  assert.deepEqual(programmingShape(female), {
    ...programmingShape(male),
  });
});

test('cycle context is metadata only and does not reduce workload', () => {
  const withoutCycle = assertValidStrategy(strategyFor({ gender: 'Woman' }));
  const withCycle = assertValidStrategy(strategyFor({
    gender: 'Woman',
    periodCycle: {
      lastPeriodStart: '2026-09-10',
      typicalCycleLength: 29,
      typicalPeriodDuration: 5,
    },
  }));

  assert.equal(withCycle.sexAware.cycleContextAvailable, true);
  assert.equal(withoutCycle.sexAware.cycleContextAvailable, false);
  assert.deepEqual(programmingShape(withCycle), programmingShape(withoutCycle));
});

test('body type has zero programming effect', () => {
  const ectomorph = assertValidStrategy(strategyFor({ bodyType: 'Ectomorph' }));
  const mesomorph = assertValidStrategy(strategyFor({ bodyType: 'Mesomorph' }));
  const endomorph = assertValidStrategy(strategyFor({ bodyType: 'Endomorph' }));

  assert.deepEqual(programmingShape(ectomorph), programmingShape(mesomorph));
  assert.deepEqual(programmingShape(endomorph), programmingShape(mesomorph));
  assert.equal(ectomorph.metadata.bodyTypeProgrammingEffect, 'none');
});

test('confidence uses deterministic warnings for incomplete or ambiguous inputs', () => {
  const complete = assertValidStrategy(strategyFor({ aiEquipmentNotes: 'Dumbbells only' }));
  const missing = assertValidStrategy(strategyFor({
    gender: '',
    aiTrainingFocus: '',
    aiRecoveryPriority: '',
    aiEquipmentNotes: '',
  }));
  const ambiguous = assertValidStrategy(strategyFor({ aiEquipmentNotes: 'I like quiet workouts' }));

  assert.equal(complete.confidence, 1);
  assert.ok(missing.confidence < complete.confidence);
  assert.equal(missing.quality.profileCompleteness, missing.confidence);
  assert.ok(['low', 'medium', 'high'].includes(missing.quality.decisionConfidence));
  assert.ok(missing.warnings.some((entry) => entry.code === 'EQUIPMENT_INFORMATION_MISSING'));
  assert.ok(ambiguous.warnings.some((entry) => entry.code === 'EQUIPMENT_INFORMATION_AMBIGUOUS'));
});

test('conflicting training focus preserves primary goal and records precedence', () => {
  const strategy = assertValidStrategy(strategyFor({
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'fat_loss',
    aiTrainingFocus: 'Muscle growth',
    workoutDays: 3,
    sessionDuration: 45,
  }));

  assert.equal(strategy.goal, 'fat_loss');
  assert.equal(strategy.status, 'ready');
  assert.ok(strategy.reasons.some((entry) => entry.code === 'TRAINING_FOCUS_GOAL_PRECEDENCE'));
});

test('reference evidence is optional, supportive, and non-distorting', () => {
  const noReference = assertValidStrategy(buildTrainingStrategy(
    normalizeTrainingProfile(inputFor({ athleteSubCategoryId: 'hypertrophy', workoutDays: 5, sessionDuration: 60 })),
  ));
  const matching = assertValidStrategy(buildTrainingStrategy(
    normalizeTrainingProfile(inputFor({ athleteSubCategoryId: 'hypertrophy', workoutDays: 5, sessionDuration: 60 })),
    { referencePrograms: referenceFixtures },
  ));
  const irrelevant = assertValidStrategy(buildTrainingStrategy(
    normalizeTrainingProfile(inputFor({ athleteSubCategoryId: 'hypertrophy', workoutDays: 5, sessionDuration: 60 })),
    { referencePrograms: referenceFixtures.filter((program) => program.goal === 'endurance') },
  ));

  assert.equal(noReference.referenceEvidence.used, false);
  assert.equal(matching.referenceEvidence.used, true);
  assert.ok(matching.referenceEvidence.matchedCount > 0);
  assert.equal(matching.architecture.splitStrategy, noReference.architecture.splitStrategy);
  assert.equal(irrelevant.referenceEvidence.used, true);
  assert.equal(irrelevant.referenceEvidence.matchedCount, 0);
  assert.equal(irrelevant.architecture.splitStrategy, noReference.architecture.splitStrategy);
});

test('JSON serialization preserves a representative v1.1 strategy', () => {
  assertSerializable(assertValidStrategy(strategyFor({
    gender: 'Woman',
    athleteSubCategoryId: 'endurance',
    athleteIdentity: 'Cardio',
    workoutDays: 5,
    sessionDuration: 60,
    periodCycle: { lastPeriodStart: '2026-09-10', typicalCycleLength: 29 },
  })));
});

test('unsupported HYROX and Boxing return bypass results', () => {
  const hyrox = assertValidStrategy(strategyFor({ athleteIdentity: 'hyrox', athleteSubCategoryId: '' }));
  const boxing = assertValidStrategy(strategyFor({ athleteIdentity: 'Box', athleteSubCategoryId: '' }));

  assert.equal(hyrox.status, 'bypassed');
  assert.equal(hyrox.bypassReason, 'hyrox');
  assert.equal(boxing.status, 'bypassed');
  assert.equal(boxing.bypassReason, 'boxing');
});

test('invalid goal and days fail before strategy construction', () => {
  assert.throws(
    () => buildTrainingStrategy({
      ...normalizeTrainingProfile(inputFor({ athleteSubCategoryId: 'mobility', aiTrainingFocus: '' })),
      goal: 'mobility',
    }),
    (error) => error.name === 'TrainingBrainInputError'
      && error.errors.some((entry) => entry.code === 'unsupported_goal'),
  );

  assert.throws(
    () => strategyFor({ workoutDays: 7 }),
    (error) => error.name === 'TrainingBrainInputError'
      && error.errors.some((entry) => entry.code === 'invalid_days_per_week'),
  );
});

test('validator rejects malformed TrainingStrategy objects with structured errors', () => {
  const strategy = strategyFor();
  const validation = validateTrainingStrategy({
    ...strategy,
    confidence: 1.5,
    architecture: {
      ...strategy.architecture,
      splitStrategy: 'made_up_split',
    },
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((entry) => entry.path === 'confidence'));
  assert.ok(validation.errors.some((entry) => entry.path === 'architecture.splitStrategy'));
});
