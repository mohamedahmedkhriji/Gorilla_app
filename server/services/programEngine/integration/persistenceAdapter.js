const DAY_NAMES = Object.freeze([
  null,
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export class ProgramEnginePersistenceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProgramEnginePersistenceError';
    this.code = details.code || 'PROGRAM_ENGINE_PERSISTENCE_ERROR';
    this.details = details;
  }
}

const clampText = (value, maxLength) => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, maxLength) : null;
};

const json = (value) => JSON.stringify(value ?? null);

const toRpeTarget = (prescription) => {
  const rir = Number(prescription?.effort?.target);
  if (!Number.isFinite(rir)) return null;
  return Number(Math.max(5.5, Math.min(10, 10 - rir)).toFixed(1));
};

const repsToStorage = (prescription) => {
  const reps = prescription?.reps;
  if (reps?.type === 'range') return `${reps.min}-${reps.max}`.slice(0, 20);
  return '8-12';
};

const dayNameFor = (dayOfWeek) => DAY_NAMES[Number(dayOfWeek)] || 'monday';

const workoutTypeFor = ({ goal, sessionType, cardioPrescription }) => {
  if (cardioPrescription && (!sessionType || String(sessionType).includes('aerobic'))) return 'Cardio';
  if (goal === 'endurance') return 'Endurance';
  if (goal === 'powerlifting') return 'Powerlifting';
  if (goal === 'fat_loss') return 'Fat Loss';
  return 'Strength';
};

const sessionTitle = (sessionType) => String(sessionType || 'training')
  .replace(/^pl_/, 'powerlifting_')
  .split('_')
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const normalizeAssignmentSource = (source) => {
  const normalized = String(source || '').trim().toLowerCase();
  if (['coach', 'manual', 'template', 'ai'].includes(normalized)) return normalized;
  return 'ai';
};

const formatDateISO = (date) => date.toISOString().slice(0, 10);

const assignProgramToUser = async (
  conn,
  {
    userId,
    programId,
    reason = 'user_request',
    note = null,
    assignmentSource = 'ai',
  },
) => {
  const startDate = new Date();
  const nextRotationDate = new Date(startDate);
  nextRotationDate.setDate(nextRotationDate.getDate() + 8 * 7);
  const startDateStr = formatDateISO(startDate);
  const nextRotationDateStr = formatDateISO(nextRotationDate);
  const storedReason = ['injury_adjustment', 'user_request'].includes(String(reason || '').trim().toLowerCase())
    ? String(reason || '').trim().toLowerCase()
    : 'user_request';

  const [activeRows] = await conn.execute(
    `SELECT id, program_id
     FROM program_assignments
     WHERE user_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );

  const active = activeRows?.[0] || null;
  if (active && Number(active.program_id) === Number(programId)) {
    await conn.execute(
      `UPDATE program_assignments
       SET start_date = ?, next_rotation_date = ?, rotation_weeks = ?, auto_rotate_enabled = 1,
           coach_override_allowed = 1, status = 'active', end_date = NULL, notes = ?
       WHERE id = ?`,
      [startDateStr, nextRotationDateStr, 8, note, active.id],
    );
    return { assignmentId: active.id, replacedProgramId: null, reusedActiveAssignment: true };
  }

  if (active) {
    await conn.execute(
      `UPDATE program_assignments
       SET status = 'archived', end_date = CURDATE()
       WHERE id = ?`,
      [active.id],
    );
  }

  const [insertResult] = await conn.execute(
    `INSERT INTO program_assignments
      (user_id, program_id, assigned_by_user_id, assignment_source, rotation_weeks, auto_rotate_enabled, coach_override_allowed, start_date, next_rotation_date, status, notes)
     VALUES (?, ?, NULL, ?, ?, 1, 1, ?, ?, 'active', ?)`,
    [
      userId,
      programId,
      normalizeAssignmentSource(assignmentSource),
      8,
      startDateStr,
      nextRotationDateStr,
      note,
    ],
  );

  if (active) {
    await conn.execute(
      `INSERT INTO program_change_log
        (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      [insertResult.insertId, userId, active.program_id, programId, storedReason, note],
    );
  }

  return {
    assignmentId: insertResult.insertId,
    replacedProgramId: active ? active.program_id : null,
    reusedActiveAssignment: false,
  };
};

const loadActiveProgramForGenerationKey = async (conn, { userId, generationKey }) => {
  const [rows] = await conn.execute(
    `SELECT p.id, p.name, p.program_type, p.goal, p.days_per_week, p.cycle_weeks,
            pa.id AS assignment_id
     FROM program_assignments pa
     JOIN programs p ON p.id = pa.program_id
     WHERE pa.user_id = ?
       AND pa.status = 'active'
       AND p.generation_key = ?
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [userId, generationKey],
  );
  return rows?.[0] || null;
};

const insertResistanceExercise = async (conn, { workoutId, item, orderIndex }) => {
  const prescription = item.prescription || {};
  const slot = item.slot || {};
  const exercise = item.exercise || {};
  const muscleGroup = clampText(exercise.primaryMuscle || slot.primaryMuscleGroup, 255);

  await conn.execute(
    `INSERT INTO workout_exercises
      (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot,
       target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes,
       exercise_catalog_id, exercise_slug_snapshot, slot_id, slot_movement_pattern,
       prescription_json, progression_rule)
     VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workoutId,
      orderIndex,
      clampText(exercise.name, 255),
      muscleGroup,
      Number(prescription.sets || 1),
      repsToStorage(prescription),
      Number(prescription.restSeconds || 90),
      toRpeTarget(prescription),
      clampText(`${slot.role || 'slot'} ${slot.movementPattern || ''}`.trim(), 500),
      Number(exercise.exerciseId || 0) || null,
      clampText(exercise.slug, 255),
      clampText(slot.slotId, 128),
      clampText(slot.movementPattern, 80),
      json({ slot, prescription, exercise }),
      clampText(prescription.progressionRule || 'program_engine_v1', 128),
    ],
  );
};

export const persistCompleteGeneratedProgram = async (
  conn,
  {
    userId,
    gymId = null,
    program,
    assignmentReason = 'user_request',
    assignmentNote = null,
    assignmentSource = 'ai',
    actorUserId = userId,
  },
) => {
  if (!program?.generationKey) {
    throw new ProgramEnginePersistenceError('Complete generated program is missing generationKey.', {
      code: 'MISSING_GENERATION_KEY',
    });
  }

  const existing = await loadActiveProgramForGenerationKey(conn, {
    userId,
    generationKey: program.generationKey,
  });
  if (existing) {
    return {
      reusedExistingProgram: true,
      programId: Number(existing.id),
      assignment: {
        assignmentId: Number(existing.assignment_id),
        replacedProgramId: null,
        reusedActiveAssignment: true,
      },
      assignedProgram: {
        id: Number(existing.id),
        name: existing.name,
        programType: existing.program_type,
        goal: existing.goal,
        daysPerWeek: Number(existing.days_per_week),
        cycleWeeks: Number(existing.cycle_weeks),
      },
    };
  }

  const planName = `RepSet ${sessionTitle(program.goal)} ${program.programLengthWeeks}-Week Plan`;
  const description = `${program.experience} ${program.goal} plan generated by Program Engine v1.0 using ${program.split?.name || program.split?.id}.`;
  const [programInsert] = await conn.execute(
    `INSERT INTO programs
      (gym_id, created_by_user_id, target_user_id, name, description, program_type, goal,
       experience_level, days_per_week, cycle_weeks, is_template, is_active,
       engine_version, generation_key, generation_source, split_id, program_metadata_json)
     VALUES (?, ?, ?, ?, ?, 'program_engine', ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)`,
    [
      gymId,
      actorUserId,
      userId,
      planName.slice(0, 255),
      description,
      program.goal,
      program.experience,
      Number(program.daysPerWeek),
      Number(program.programLengthWeeks),
      program.engineVersion,
      program.generationKey,
      'program_engine_v1',
      program.split?.id || null,
      json({
        split: program.split,
        progressionPolicy: program.progressionPolicy,
        volumeSummary: program.volumeSummary,
        generationMetadata: program.generationMetadata,
      }),
    ],
  );

  const programId = Number(programInsert.insertId);
  let dayOrder = 0;
  for (const week of program.weeks || []) {
    for (const day of week.days || []) {
      if (day.type !== 'training') continue;
      dayOrder += 1;
      const cardioPrescription = day.cardioPrescription || null;
      const workoutName = `Week ${week.weekNumber} - ${sessionTitle(day.sessionType || cardioPrescription?.sessionPurpose)}`;
      const [workoutInsert] = await conn.execute(
        `INSERT INTO workouts
          (program_id, workout_name, workout_type, day_order, day_name,
           estimated_duration_minutes, notes, program_engine_week, program_engine_day,
           cardio_prescription_json, slot_metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          programId,
          workoutName.slice(0, 255),
          workoutTypeFor({ goal: program.goal, sessionType: day.sessionType, cardioPrescription }).slice(0, 100),
          dayOrder,
          dayNameFor(day.dayOfWeek),
          Number(day.estimatedDurationMinutes || day.targetDurationMinutes || program.sessionDurationMinutes),
          clampText(`${week.phase?.name || week.phase?.id || 'Program Engine week'}${day.dayPurpose ? `: ${day.dayPurpose}` : ''}`, 500),
          Number(week.weekNumber),
          Number(day.dayOfWeek),
          cardioPrescription ? json(cardioPrescription) : null,
          json({
            sessionType: day.sessionType,
            dayPurpose: day.dayPurpose,
            targetDurationMinutes: day.targetDurationMinutes,
            phase: week.phase,
          }),
        ],
      );

      const workoutId = Number(workoutInsert.insertId);
      for (const [exerciseIndex, item] of (day.exercises || []).entries()) {
        await insertResistanceExercise(conn, {
          workoutId,
          item,
          orderIndex: exerciseIndex + 1,
        });
      }
    }
  }

  const assignment = await assignProgramToUser(conn, {
    userId,
    programId,
    reason: assignmentReason,
    note: assignmentNote || `Program Engine v1.0 onboarding plan: ${program.goal}, ${program.daysPerWeek} days/week, ${program.programLengthWeeks} weeks`,
    assignmentSource,
  });

  return {
    reusedExistingProgram: false,
    programId,
    assignment,
    assignedProgram: {
      id: programId,
      name: planName,
      programType: 'program_engine',
      goal: program.goal,
      daysPerWeek: Number(program.daysPerWeek),
      cycleWeeks: Number(program.programLengthWeeks),
      splitId: program.split?.id || null,
      engineVersion: program.engineVersion,
    },
  };
};
