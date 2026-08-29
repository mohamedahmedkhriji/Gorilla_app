import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPhaseForWeek,
  validateRulesPlanDraft,
} from './rulesPlanDraft.js';

const buildValidDraft = () => {
  const selectedDays = ['Monday', 'Thursday'];

  return {
    planName: 'RepSet Rules Plan',
    description: 'Eight-week adaptive training plan.',
    programType: 'upper_lower',
    goal: 'muscle_gain',
    experienceLevel: 'intermediate',
    daysPerWeek: 2,
    cycleWeeks: 8,
    selectedDays,
    weeklySchedule: selectedDays.map((dayName) => ({
      dayName,
      name: 'Full Body',
      workoutType: 'Full Body',
      focusLabel: null,
      cardioFinisher: null,
    })),
    weeks: Array.from({ length: 8 }, (_, index) => {
      const weekNumber = index + 1;

      return {
        weekNumber,
        phaseName: getPhaseForWeek(weekNumber).label,
        workouts: selectedDays.map((dayName) => ({
          dayName,
          workoutName: `Week ${weekNumber} - Full Body`,
          workoutType: 'Full Body',
          estimatedDurationMinutes: 60,
          notes: null,
          exercises: [
            {
              exerciseCatalogId: 153,
              exerciseName: 'Bench Press',
              targetMuscles: ['Chest', 'Triceps'],
              sets: 4,
              reps: '8-10',
              restSeconds: 90,
              targetWeight: null,
              tempo: null,
              rpeTarget: 7.5,
              notes: null,
            },
          ],
        })),
      };
    }),
    summary: {
      weeklyFatigueScore: 40,
      weeklyCapacity: 60,
      cardioGoals: null,
    },
  };
};

test('maps weeks to the centralized phase blueprint', () => {
  assert.equal(getPhaseForWeek(1).label, 'Foundation');
  assert.equal(getPhaseForWeek(3).label, 'Build');
  assert.equal(getPhaseForWeek(5).label, 'Progression');
  assert.equal(
    getPhaseForWeek(7).label,
    'Peak And Consolidation',
  );
});

test('accepts a valid eight-week draft', () => {
  const validation =
    validateRulesPlanDraft(buildValidDraft());

  assert.deepEqual(validation, {
    valid: true,
    errors: [],
  });
});

test('rejects missing weeks', () => {
  const draft = buildValidDraft();
  draft.weeks.pop();

  const validation = validateRulesPlanDraft(draft);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some(
      (error) => error.includes('weeks must contain 8'),
    ),
  );
});

test('rejects mismatched daysPerWeek', () => {
  const draft = buildValidDraft();
  draft.daysPerWeek = 3;

  const validation = validateRulesPlanDraft(draft);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some(
      (error) => error.includes(
        'daysPerWeek must match selectedDays length',
      ),
    ),
  );
});

test('rejects a weekly schedule length mismatch', () => {
  const draft = buildValidDraft();
  draft.weeklySchedule.pop();

  const validation = validateRulesPlanDraft(draft);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some(
      (error) => error.includes(
        'weeklySchedule must match daysPerWeek',
      ),
    ),
  );
});

test('rejects an incorrect phase', () => {
  const draft = buildValidDraft();
  draft.weeks[2].phaseName = 'Foundation';

  const validation = validateRulesPlanDraft(draft);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some(
      (error) => error.includes(
        'phaseName must equal Build',
      ),
    ),
  );
});

test('rejects invalid exercise prescriptions', () => {
  const draft = buildValidDraft();
  draft.weeks[0].workouts[0].exercises[0].sets = 0;
  draft.weeks[0].workouts[0].exercises[0].rpeTarget = 11;

  const validation = validateRulesPlanDraft(draft);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 2);
});
