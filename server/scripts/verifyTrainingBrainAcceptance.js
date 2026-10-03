import { spawn } from 'node:child_process';
import process from 'node:process';

import pool from '../database.js';
import { createAuthToken, hashPassword } from '../auth.js';
import { routeProgramEngineRequest } from '../services/programEngine/index.js';

const TEST_RUN = `phase5_${Date.now()}`;
const PORT = Number(process.env.PHASE5_VERIFY_PORT || 5099);
const API_BASE = `http://127.0.0.1:${PORT}/api`;
const PASSWORD = 'Phase5Verify!123';

const PROFILES = {
  A: {
    name: 'Phase5 Hypertrophy User',
    payload: {
      age: 30,
      gender: 'Woman',
      height: 168,
      weight: 66,
      primaryGoal: 'muscle_gain',
      fitnessGoal: 'muscle_gain',
      athleteIdentity: 'Bodybuilding',
      athleteSubCategoryId: 'hypertrophy',
      athleteSubCategoryLabel: 'Hypertrophy',
      experienceLevel: 'intermediate',
      workoutDays: 5,
      sessionDuration: 60,
      aiEquipmentNotes: 'Full gym',
      disableClaude: true,
    },
  },
  B: {
    name: 'Phase5 Fat Loss User',
    payload: {
      age: 34,
      gender: 'Man',
      height: 180,
      weight: 91,
      primaryGoal: 'fat_loss',
      fitnessGoal: 'fat_loss',
      athleteIdentity: 'Cardio',
      athleteSubCategoryId: 'fat_loss',
      athleteSubCategoryLabel: 'Fat Loss',
      experienceLevel: 'beginner',
      workoutDays: 6,
      sessionDuration: 45,
      aiEquipmentNotes: 'Full gym',
      disableClaude: true,
    },
  },
  C: {
    name: 'Phase5 Endurance User',
    payload: {
      age: 29,
      gender: 'Woman',
      height: 170,
      weight: 62,
      primaryGoal: 'endurance',
      fitnessGoal: 'endurance',
      athleteIdentity: 'Cardio',
      athleteSubCategoryId: 'endurance',
      athleteSubCategoryLabel: 'Endurance',
      experienceLevel: 'advanced',
      workoutDays: 5,
      sessionDuration: 60,
      aiEquipmentNotes: 'Full gym',
      disableClaude: true,
    },
  },
  D: {
    name: 'Phase5 Powerlifting User',
    payload: {
      age: 36,
      gender: 'Man',
      height: 182,
      weight: 96,
      primaryGoal: 'strength',
      fitnessGoal: 'strength',
      athleteIdentity: 'Bodybuilding',
      athleteSubCategoryId: 'powerlifting',
      athleteSubCategoryLabel: 'Powerlifting',
      experienceLevel: 'intermediate',
      workoutDays: 4,
      sessionDuration: 90,
      aiEquipmentNotes: 'Full gym',
      disableClaude: true,
    },
  },
};

const assert = (condition, message, details = undefined) => {
  if (!condition) {
    const suffix = details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
};

const execute = (sql, params = []) => pool.execute(sql, params);

const formatDateISO = (date = new Date()) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const parseExercises = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseRepTarget = (value) => {
  const values = String(value || '').match(/\d+/g)?.map(Number).filter((n) => Number.isFinite(n) && n > 0) || [];
  if (!values.length) return 10;
  return values.length > 1 ? Math.round((values[0] + values[1]) / 2) : values[0];
};

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const requestJson = async (path, { method = 'GET', token = null, body = undefined, expected = [200] } = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: token ? authHeaders(token) : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
  }
  return parsed;
};

const createUser = async (label) => {
  const password = await hashPassword(PASSWORD);
  const email = `${TEST_RUN}_${label.toLowerCase()}@repset.test`;
  const [result] = await execute(
    `INSERT INTO users
       (name, email, password, role, age, onboarding_completed, first_login, is_active)
     VALUES (?, ?, ?, 'user', 30, 0, 1, 1)`,
    [`${PROFILES[label]?.name || 'Phase5 User'} ${TEST_RUN}`, email, password],
  );
  const id = Number(result.insertId);
  return {
    id,
    email,
    token: createAuthToken({ id, role: 'user', gym_id: null, coach_id: null }),
  };
};

const waitForServer = async (child) => {
  const started = Date.now();
  while (Date.now() - started < 25_000) {
    if (child.exitCode != null) throw new Error(`Server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for verification server');
};

const startServer = async () => {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      CLIENT_URL: process.env.CLIENT_URL || `http://127.0.0.1:${PORT}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  await waitForServer(child);
  return child;
};

const completeOnboarding = async (label, user) => {
  const response = await requestJson('/user/onboarding', {
    method: 'POST',
    token: user.token,
    body: {
      userId: user.id,
      ...PROFILES[label].payload,
    },
  });
  assert(response?.success === true, `Onboarding failed for ${label}`, response);
  return response;
};

const loadDbProgram = async (programId) => {
  const [[program]] = await execute(
    `SELECT id, generation_source, split_id, days_per_week, cycle_weeks, generation_key
     FROM programs
     WHERE id = ?`,
    [programId],
  );
  const [[workoutCounts]] = await execute(
    `SELECT COUNT(*) AS workouts,
            COUNT(DISTINCT program_engine_week) AS week_count,
            MIN(program_engine_week) AS min_week,
            MAX(program_engine_week) AS max_week,
            SUM(CASE WHEN cardio_prescription_json IS NOT NULL THEN 1 ELSE 0 END) AS cardio_workouts
     FROM workouts
     WHERE program_id = ?`,
    [programId],
  );
  const [[exerciseCounts]] = await execute(
    `SELECT COUNT(*) AS exercise_rows,
            SUM(CASE WHEN we.exercise_catalog_id IS NOT NULL THEN 1 ELSE 0 END) AS with_catalog_id,
            SUM(CASE WHEN ec.id IS NOT NULL THEN 1 ELSE 0 END) AS matching_catalog_id
     FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     LEFT JOIN exercise_catalog ec ON ec.id = we.exercise_catalog_id
     WHERE w.program_id = ?`,
    [programId],
  );
  const [weekRows] = await execute(
    `SELECT program_engine_week AS week, COUNT(*) AS workouts
     FROM workouts
     WHERE program_id = ?
     GROUP BY program_engine_week
     ORDER BY program_engine_week`,
    [programId],
  );
  const [patterns] = await execute(
    `SELECT DISTINCT we.slot_movement_pattern AS pattern
     FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     WHERE w.program_id = ?
       AND we.slot_movement_pattern IN ('squat_pattern', 'bench', 'deadlift')`,
    [programId],
  );

  return {
    generationSource: program?.generation_source || null,
    splitId: program?.split_id || null,
    daysPerWeek: Number(program?.days_per_week || 0),
    cycleWeeks: Number(program?.cycle_weeks || 0),
    generationKey: program?.generation_key || null,
    workouts: Number(workoutCounts.workouts || 0),
    weekCount: Number(workoutCounts.week_count || 0),
    minWeek: Number(workoutCounts.min_week || 0),
    maxWeek: Number(workoutCounts.max_week || 0),
    cardioWorkouts: Number(workoutCounts.cardio_workouts || 0),
    exerciseRows: Number(exerciseCounts.exercise_rows || 0),
    exerciseRowsWithCatalogId: Number(exerciseCounts.with_catalog_id || 0),
    exerciseRowsMatchingCatalog: Number(exerciseCounts.matching_catalog_id || 0),
    weekRows: weekRows.map((row) => ({ week: Number(row.week), workouts: Number(row.workouts) })),
    movementPatterns: patterns.map((row) => row.pattern).sort(),
  };
};

const activeCounts = async (userId) => {
  const [[row]] = await execute(
    `SELECT COUNT(*) AS active_assignments,
            COUNT(DISTINCT program_id) AS active_programs,
            COALESCE(MAX(program_id), 0) AS active_program_id
     FROM program_assignments
     WHERE user_id = ? AND status = 'active'`,
    [userId],
  );
  return {
    activeAssignments: Number(row.active_assignments || 0),
    activePrograms: Number(row.active_programs || 0),
    activeProgramId: Number(row.active_program_id || 0),
  };
};

const setAssignmentWeek = async (assignmentId, week) => {
  const daysBack = (Number(week) - 1) * 7;
  await execute(
    `UPDATE program_assignments
     SET start_date = DATE_SUB(CURDATE(), INTERVAL ? DAY)
     WHERE id = ?`,
    [daysBack, assignmentId],
  );
};

const verifyWeekRetrieval = async (user, assignmentId, expectedDaysPerWeek) => {
  const weeks = {};
  for (const week of [1, 8]) {
    await setAssignmentWeek(assignmentId, week);
    const program = await requestJson(`/user/${user.id}/program`, { token: user.token });
    weeks[week] = {
      currentWeek: Number(program.currentWeek || 0),
      currentWeekWorkouts: Array.isArray(program.currentWeekWorkouts) ? program.currentWeekWorkouts.length : 0,
    };
    assert(weeks[week].currentWeek === week, `Expected API currentWeek=${week}`, weeks[week]);
    assert(weeks[week].currentWeekWorkouts === expectedDaysPerWeek, `Expected week ${week} workout count`, weeks[week]);
  }
  await setAssignmentWeek(assignmentId, 1);
  return weeks;
};

const pickWorkoutForToday = async (user, program, workout) => {
  const exercises = parseExercises(workout.exercises);
  const muscleGroups = [...new Set(exercises.flatMap((exercise) =>
    Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles : [exercise.muscleGroup].filter(Boolean),
  ))];
  return requestJson(`/user/${user.id}/program/today-workout/pick`, {
    method: 'POST',
    token: user.token,
    body: {
      workoutName: workout.workout_name,
      dayLabel: workout.day_name,
      durationMinutes: Number(workout.estimated_duration_minutes || 60) || 60,
      muscleGroups,
      muscleGroup: muscleGroups[0] || 'Cardio',
      programAssignmentId: Number(program.assignmentId || 0),
      exercises: exercises.map((exercise) => ({
        exerciseName: exercise.exerciseName,
        targetMuscles: Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles : [],
        muscleGroup: exercise.muscleGroup || null,
        sets: Number(exercise.sets || 1),
        reps: String(exercise.reps || ''),
      })),
    },
  });
};

const syncWorkoutSets = async (user, workout) => {
  const exercises = parseExercises(workout.exercises);
  const sets = exercises.flatMap((exercise, exerciseIndex) => {
    const setCount = Math.max(1, Math.round(Number(exercise.sets || 1)));
    const reps = parseRepTarget(exercise.reps);
    return Array.from({ length: setCount }, (_, setIndex) => ({
      exerciseName: exercise.exerciseName,
      exerciseCatalogId: Number(exercise.exerciseCatalogId || 0) || null,
      workoutExerciseId: Number(exercise.id || 0) || null,
      setNumber: setIndex + 1,
      reps,
      weight: 20 + exerciseIndex * 2,
      rpe: Number(exercise.rpeTarget || 8) || 8,
      duration: 45,
      restTime: Number(exercise.rest || 60) || 60,
      completed: true,
      notes: exercise.notes || null,
    }));
  });

  assert(sets.length > 0, 'Resistance workout did not expose trainable exercise sets');
  await requestJson('/workout-sets/sync-day', {
    method: 'POST',
    token: user.token,
    body: {
      userId: user.id,
      summaryDate: formatDateISO(),
      sets,
    },
  });
  return sets;
};

const completeWorkoutDay = async (user, program, workout, sets = []) => {
  const exercises = parseExercises(workout.exercises);
  const summaryExercises = exercises.map((exercise) => {
    const matchingSets = sets.filter((row) => row.exerciseName === exercise.exerciseName);
    const summarySets = matchingSets.map((row) => ({
      set: row.setNumber,
      reps: row.reps,
      weight: row.weight,
    }));
    return {
      name: exercise.exerciseName,
      sets: summarySets,
      totalSets: summarySets.length,
      totalReps: summarySets.reduce((sum, row) => sum + row.reps, 0),
      topWeight: summarySets.reduce((max, row) => Math.max(max, row.weight), 0),
      volume: summarySets.reduce((sum, row) => sum + (row.reps * row.weight), 0),
      targetMuscles: Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles : [],
    };
  });
  const muscles = summaryExercises.length
    ? [...new Set(summaryExercises.flatMap((exercise) => exercise.targetMuscles).filter(Boolean))]
      .slice(0, 6)
      .map((name) => ({ name, score: 100 }))
    : [{ name: 'Cardio', score: 100 }];
  const durationSeconds = Math.max(900, Number(workout.estimated_duration_minutes || 45) * 60);

  const session = await requestJson('/workout-sessions/complete-day', {
    method: 'POST',
    token: user.token,
    body: {
      userId: user.id,
      summaryDate: formatDateISO(),
      workoutName: workout.workout_name,
      durationSeconds,
      muscles,
      muscleGroups: muscles.map((entry) => entry.name),
      muscleGroup: muscles[0]?.name || 'Cardio',
      exercises: summaryExercises,
      intensity: 'moderate',
      volume: 'moderate',
      programAssignmentId: Number(program.assignmentId || 0),
    },
  });

  await requestJson('/workout-summaries', {
    method: 'POST',
    token: user.token,
    expected: [201],
    body: {
      userId: user.id,
      summaryDate: formatDateISO(),
      workoutName: workout.workout_name,
      durationSeconds,
      estimatedCalories: Math.max(1, Math.round(durationSeconds / 60 * 7)),
      totalVolume: summaryExercises.reduce((sum, exercise) => sum + Number(exercise.volume || 0), 0),
      recordsCount: 0,
      muscles,
      exercises: summaryExercises,
      summaryText: `${workout.workout_name} completed`,
    },
  });

  return session;
};

const verifyCompletionPersistence = async ({ user, program, sessionId, expectedSetCount }) => {
  const today = formatDateISO();
  const [[session]] = await execute(
    `SELECT id, user_id, program_assignment_id, workout_name, status, DATE(completed_at) AS completed_date
     FROM workout_sessions
     WHERE id = ?
     LIMIT 1`,
    [sessionId],
  );
  const [[setCounts]] = await execute(
    `SELECT COUNT(*) AS sets,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_sets,
            SUM(CASE WHEN workout_exercise_id IS NOT NULL THEN 1 ELSE 0 END) AS with_workout_exercise_id,
            SUM(CASE WHEN exercise_catalog_id IS NOT NULL THEN 1 ELSE 0 END) AS with_catalog_id
     FROM workout_sets
     WHERE user_id = ? AND DATE(created_at) = ?`,
    [user.id, today],
  );
  const [[summaryCounts]] = await execute(
    `SELECT COUNT(*) AS summaries
     FROM workout_day_summaries
     WHERE user_id = ? AND summary_date = ?`,
    [user.id, today],
  );

  assert(session?.status === 'completed', 'Workout session was not completed', session);
  assert(Number(session.program_assignment_id) === Number(program.assignmentId), 'Completed session is not attached to assignment', session);
  if (expectedSetCount > 0) {
    assert(Number(setCounts.sets || 0) >= expectedSetCount, 'Workout set history rows missing', setCounts);
    assert(Number(setCounts.completed_sets || 0) >= expectedSetCount, 'Completed set rows missing', setCounts);
    assert(Number(setCounts.with_workout_exercise_id || 0) >= expectedSetCount, 'Set rows missing workout_exercise_id', setCounts);
    assert(Number(setCounts.with_catalog_id || 0) >= expectedSetCount, 'Set rows missing catalog ids', setCounts);
  }
  assert(Number(summaryCounts.summaries || 0) >= 1, 'Workout day summary was not saved', summaryCounts);

  return {
    session,
    sets: {
      total: Number(setCounts.sets || 0),
      completed: Number(setCounts.completed_sets || 0),
      withWorkoutExerciseId: Number(setCounts.with_workout_exercise_id || 0),
      withCatalogId: Number(setCounts.with_catalog_id || 0),
    },
    summaries: Number(summaryCounts.summaries || 0),
  };
};

const createSafetyFixture = async () => {
  const password = await hashPassword(PASSWORD);
  const [userResult] = await execute(
    `INSERT INTO users (name, email, password, role, onboarding_completed, first_login, is_active)
     VALUES (?, ?, ?, 'user', 1, 0, 1)`,
    [`Phase5 Existing Safety ${TEST_RUN}`, `${TEST_RUN}_safety@repset.test`, password],
  );
  const userId = Number(userResult.insertId);
  const [programResult] = await execute(
    `INSERT INTO programs
       (created_by_user_id, target_user_id, name, program_type, goal, experience_level, days_per_week, cycle_weeks, is_template, is_active)
     VALUES (?, ?, ?, 'manual', 'hypertrophy', 'intermediate', 3, 8, 0, 1)`,
    [userId, userId, `Phase5 Existing Manual ${TEST_RUN}`],
  );
  const programId = Number(programResult.insertId);
  const [assignmentResult] = await execute(
    `INSERT INTO program_assignments
       (user_id, program_id, assignment_source, rotation_weeks, auto_rotate_enabled, coach_override_allowed, start_date, next_rotation_date, status, notes)
     VALUES (?, ?, 'manual', 8, 1, 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 56 DAY), 'active', 'phase5 safety')`,
    [userId, programId],
  );
  return { userId, programId, assignmentId: Number(assignmentResult.insertId) };
};

const safetySnapshot = async (fixture) => {
  const counts = await activeCounts(fixture.userId);
  const [[rows]] = await execute(
    `SELECT
       (SELECT COUNT(*) FROM workout_sessions WHERE user_id = ?) AS sessions,
       (SELECT COUNT(*) FROM workout_sets WHERE user_id = ?) AS sets`,
    [fixture.userId, fixture.userId],
  );
  return {
    ...counts,
    programId: fixture.programId,
    assignmentId: fixture.assignmentId,
    sessions: Number(rows.sessions || 0),
    sets: Number(rows.sets || 0),
  };
};

const main = async () => {
  const server = await startServer();
  const users = {};
  const onboarding = {};
  const apiPrograms = {};
  const dbPrograms = {};
  const weekRetrieval = {};
  const reloadStability = {};
  const completion = {};
  const safetyFixture = await createSafetyFixture();
  const safetyBefore = await safetySnapshot(safetyFixture);

  try {
    for (const label of Object.keys(PROFILES)) {
      users[label] = await createUser(label);
      onboarding[label] = await completeOnboarding(label, users[label]);
      apiPrograms[label] = await requestJson(`/user/${users[label].id}/program`, { token: users[label].token });
      dbPrograms[label] = await loadDbProgram(Number(apiPrograms[label].id || 0));

      assert(dbPrograms[label].generationSource === 'program_engine_brain_v1', `${label} did not use Training Brain source`, dbPrograms[label]);
      assert(Number(apiPrograms[label].totalWeeks || 0) === 8, `${label} is not an 8-week program`, apiPrograms[label]);
      assert(Array.isArray(apiPrograms[label].workouts), `${label} API did not return workouts`);
      assert(Number(apiPrograms[label].assignmentId || 0) > 0, `${label} API did not return assignmentId`);
    }

    assert(dbPrograms.A.daysPerWeek === 5 && dbPrograms.A.workouts === 40 && dbPrograms.A.exerciseRows > 0, 'A hypertrophy shape failed', dbPrograms.A);
    assert(dbPrograms.B.daysPerWeek === 3 && dbPrograms.B.workouts === 24 && dbPrograms.B.exerciseRows > 0, 'B fat loss shape failed', dbPrograms.B);
    assert(dbPrograms.C.daysPerWeek === 5 && dbPrograms.C.workouts === 40 && dbPrograms.C.exerciseRows === 0 && dbPrograms.C.cardioWorkouts === 40, 'C endurance shape failed', dbPrograms.C);
    assert(dbPrograms.D.daysPerWeek === 4 && dbPrograms.D.workouts === 32 && ['bench', 'deadlift', 'squat_pattern'].every((pattern) => dbPrograms.D.movementPatterns.includes(pattern)), 'D powerlifting shape failed', dbPrograms.D);

    for (const label of Object.keys(PROFILES)) {
      weekRetrieval[label] = await verifyWeekRetrieval(users[label], Number(apiPrograms[label].assignmentId), dbPrograms[label].daysPerWeek);
    }

    const beforeReload = await activeCounts(users.B.id);
    const bProgramBefore = await requestJson(`/user/${users.B.id}/program`, { token: users.B.token });
    const bProgramAfter = await requestJson(`/user/${users.B.id}/program`, { token: users.B.token });
    const afterReload = await activeCounts(users.B.id);
    reloadStability.B = {
      beforeReload,
      afterReload,
      sameProgram: Number(bProgramBefore.id) === Number(bProgramAfter.id),
      sameAssignment: Number(bProgramBefore.assignmentId) === Number(bProgramAfter.assignmentId),
    };
    assert(reloadStability.B.sameProgram && reloadStability.B.sameAssignment, 'Program reload changed identity', reloadStability.B);
    assert(JSON.stringify(beforeReload) === JSON.stringify(afterReload), 'GET /program regenerated or reassigned a program', reloadStability.B);

    const bWorkout = apiPrograms.B.currentWeekWorkouts.find((workout) => parseExercises(workout.exercises).length > 0);
    assert(bWorkout, 'B current week has no resistance workout to train', apiPrograms.B.currentWeekWorkouts);
    const pickedB = await pickWorkoutForToday(users.B, apiPrograms.B, bWorkout);
    const bSets = await syncWorkoutSets(users.B, bWorkout);
    const sessionB = await completeWorkoutDay(users.B, apiPrograms.B, bWorkout, bSets);
    const progressB = await requestJson(`/user/${users.B.id}/program-progress`, { token: users.B.token });
    const reloadB = await requestJson(`/user/${users.B.id}/program`, { token: users.B.token });
    completion.B = {
      pickedSessionId: pickedB.sessionId,
      completedSessionId: sessionB.sessionId,
      persistence: await verifyCompletionPersistence({
        user: users.B,
        program: apiPrograms.B,
        sessionId: Number(sessionB.sessionId),
        expectedSetCount: bSets.length,
      }),
      progress: progressB.summary,
      reload: {
        programId: reloadB.id,
        assignmentId: reloadB.assignmentId,
        currentWeekWorkouts: reloadB.currentWeekWorkouts?.length || 0,
      },
    };
    assert(Number(progressB.summary?.completedWorkouts || 0) >= 1, 'Completed B workout did not update progress', progressB);
    assert(Number(reloadB.id) === Number(apiPrograms.B.id), 'B reload did not return the same program', reloadB);

    const cWorkout = apiPrograms.C.currentWeekWorkouts.find((workout) => workout.cardioPrescription && parseExercises(workout.exercises).length === 0);
    assert(cWorkout, 'C current week has no cardio-only workout', apiPrograms.C.currentWeekWorkouts);
    await pickWorkoutForToday(users.C, apiPrograms.C, cWorkout);
    const sessionC = await completeWorkoutDay(users.C, apiPrograms.C, cWorkout, []);
    const progressC = await requestJson(`/user/${users.C.id}/program-progress`, { token: users.C.token });
    completion.C = {
      completedSessionId: sessionC.sessionId,
      persistence: await verifyCompletionPersistence({
        user: users.C,
        program: apiPrograms.C,
        sessionId: Number(sessionC.sessionId),
        expectedSetCount: 0,
      }),
      progress: progressC.summary,
    };
    assert(Number(progressC.summary?.completedWorkouts || 0) >= 1, 'Cardio completion did not update progress', progressC);

    const crossUser = await requestJson('/workout-sessions/complete-day', {
      method: 'POST',
      token: users.A.token,
      expected: [403],
      body: {
        userId: users.B.id,
        summaryDate: formatDateISO(),
        workoutName: 'Cross user attempt',
        durationSeconds: 900,
        muscles: [{ name: 'Chest', score: 100 }],
        exercises: [],
      },
    });

    const safetyAfter = await safetySnapshot(safetyFixture);
    assert(JSON.stringify(safetyBefore) === JSON.stringify(safetyAfter), 'Existing assigned user was modified', { safetyBefore, safetyAfter });

    const specialRoutes = {
      hyrox: routeProgramEngineRequest({
        onboardingInput: { ...PROFILES.C.payload, athleteIdentity: 'hyrox' },
      }).route,
      boxing: routeProgramEngineRequest({
        onboardingInput: { ...PROFILES.A.payload, athleteIdentity: 'box' },
      }).route,
      custom: routeProgramEngineRequest({
        onboardingInput: PROFILES.A.payload,
        splitPreference: 'custom',
      }).route,
    };

    console.log(JSON.stringify({
      status: 'PASS',
      testRun: TEST_RUN,
      users: Object.fromEntries(Object.entries(users).map(([label, user]) => [label, { id: user.id, email: user.email }])),
      onboarding: Object.fromEntries(Object.entries(onboarding).map(([label, result]) => [label, {
        planSource: result.planSource,
        assignedProgramId: result.assignedProgram?.id || null,
        assignmentId: result.assignment?.assignmentId || result.assignment?.id || null,
      }])),
      apiPrograms: Object.fromEntries(Object.entries(apiPrograms).map(([label, program]) => [label, {
        id: program.id,
        assignmentId: program.assignmentId,
        daysPerWeek: program.daysPerWeek,
        currentWeek: program.currentWeek,
        totalWeeks: program.totalWeeks,
        workouts: program.workouts?.length || 0,
        currentWeekWorkouts: program.currentWeekWorkouts?.length || 0,
      }])),
      dbPrograms,
      weekRetrieval,
      reloadStability,
      completion,
      security: {
        crossUserStatus: '403',
        crossUserError: crossUser?.error || null,
      },
      existingUserSafety: {
        before: safetyBefore,
        after: safetyAfter,
        unchanged: true,
      },
      specialRoutes,
    }, null, 2));
  } finally {
    server.kill('SIGTERM');
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
