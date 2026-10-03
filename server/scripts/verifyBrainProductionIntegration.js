import { spawn } from 'node:child_process';
import process from 'node:process';

import pool from '../database.js';
import {
  createAuthToken,
  hashPassword,
} from '../auth.js';
import {
  generateAndPersistProgramEnginePlan,
  routeProgramEngineRequest,
} from '../services/programEngine/index.js';

const TEST_RUN = `phase4_${Date.now()}`;
const PORT = Number(process.env.PHASE4_VERIFY_PORT || 5097);
const API_BASE = `http://127.0.0.1:${PORT}/api`;

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeEquipment = (value) => {
  const text = String(value || '').trim();
  if (/body only/i.test(text)) return 'Bodyweight';
  if (/lever/i.test(text)) return 'Machine';
  return text || null;
};

const CATALOG_IDS = [
  929, 1135, 2530, 1478, 1699, 1689, 2533, 2581,
  1823, 1553, 1306, 1564, 2039, 2075, 1357, 888,
  154, 736, 2875, 1085, 1875, 1106, 1436, 1,
  2455, 2688, 3076, 2705, 2087, 2594,
];

const TEST_PROFILES = {
  A: {
    name: 'Phase4 User A Hypertrophy',
    onboardingInput: {
      gender: 'Woman',
      athleteIdentity: 'Bodybuilding',
      athleteSubCategoryId: 'hypertrophy',
      experienceLevel: 'intermediate',
      workoutDays: 5,
      sessionDuration: 60,
      aiEquipmentNotes: 'Full gym',
      age: 30,
      height: 168,
      weight: 66,
    },
  },
  B: {
    name: 'Phase4 User B Fat Loss',
    onboardingInput: {
      gender: 'Man',
      athleteIdentity: 'Cardio',
      athleteSubCategoryId: 'fat_loss',
      experienceLevel: 'beginner',
      workoutDays: 6,
      sessionDuration: 45,
      aiEquipmentNotes: 'Full gym',
      age: 34,
      height: 180,
      weight: 91,
    },
  },
  C: {
    name: 'Phase4 User C Endurance',
    onboardingInput: {
      gender: 'Woman',
      athleteIdentity: 'Cardio',
      athleteSubCategoryId: 'endurance',
      experienceLevel: 'advanced',
      workoutDays: 5,
      sessionDuration: 60,
      aiEquipmentNotes: 'Full gym',
      age: 29,
      height: 170,
      weight: 62,
    },
  },
  D: {
    name: 'Phase4 User D Powerlifting',
    onboardingInput: {
      gender: 'Man',
      athleteIdentity: 'Bodybuilding',
      athleteSubCategoryId: 'powerlifting',
      experienceLevel: 'intermediate',
      workoutDays: 4,
      sessionDuration: 90,
      aiEquipmentNotes: 'Full gym',
      age: 36,
      height: 182,
      weight: 96,
    },
  },
};

const execute = async (conn, sql, params = []) => conn.execute(sql, params);

const loadLocalCatalogProvider = async (conn) => {
  const [rows] = await execute(
    conn,
    `SELECT id, canonical_name, description, exercise_type, body_part, equipment,
            level, mechanics, force_type, difficulty_tier
     FROM exercise_catalog
     WHERE id IN (${CATALOG_IDS.map(() => '?').join(',')})
       AND is_active = 1`,
    CATALOG_IDS,
  );

  const catalog = rows.map((row) => {
    const muscle = row.body_part || 'Full Body';
    return {
      id: Number(row.id),
      name: row.canonical_name,
      slug: slugify(row.canonical_name),
      description: row.description || null,
      equipment: normalizeEquipment(row.equipment),
      difficultyLevel: Number(row.difficulty_tier || 2) || 2,
      mechanics: row.mechanics || null,
      forceType: row.force_type || null,
      muscle,
      bodyPart: muscle,
      categories: [{ name: muscle, slug: slugify(muscle) }],
      muscles: [{ name: muscle, muscleGroup: muscle, role: 'primary' }],
      primaryMedia: null,
    };
  });

  return async () => catalog;
};

const createTestUser = async (conn, label) => {
  const password = await hashPassword('Phase4Verify!123');
  const email = `${TEST_RUN}_${label.toLowerCase()}@repset.test`;
  const [result] = await execute(
    conn,
    `INSERT INTO users
       (name, email, password, role, age, onboarding_completed, first_login, is_active)
     VALUES (?, ?, ?, 'user', 30, 0, 1, 1)`,
    [`${TEST_PROFILES[label]?.name || 'Phase4 Existing Safety'} ${TEST_RUN}`, email, password],
  );
  return {
    id: Number(result.insertId),
    email,
    token: createAuthToken({ id: Number(result.insertId), role: 'user', gym_id: null, coach_id: null }),
  };
};

const summarizeDbProgram = async (conn, { userId, programId, assignmentId }) => {
  const [[program]] = await execute(
    conn,
    `SELECT id, generation_source, engine_version, generation_key, split_id,
            days_per_week, cycle_weeks, program_metadata_json
     FROM programs
     WHERE id = ?`,
    [programId],
  );
  const [[assignment]] = await execute(
    conn,
    `SELECT id, user_id, program_id, status, assignment_source, notes
     FROM program_assignments
     WHERE id = ?`,
    [assignmentId],
  );
  const [[workouts]] = await execute(
    conn,
    `SELECT COUNT(*) AS count,
            COUNT(DISTINCT program_engine_week) AS week_count,
            MIN(program_engine_week) AS min_week,
            MAX(program_engine_week) AS max_week,
            SUM(CASE WHEN cardio_prescription_json IS NOT NULL THEN 1 ELSE 0 END) AS cardio_count
     FROM workouts
     WHERE program_id = ?`,
    [programId],
  );
  const [[exerciseRows]] = await execute(
    conn,
    `SELECT COUNT(*) AS count,
            SUM(CASE WHEN we.exercise_catalog_id IS NOT NULL THEN 1 ELSE 0 END) AS with_catalog_id,
            SUM(CASE WHEN ec.id IS NOT NULL THEN 1 ELSE 0 END) AS matching_catalog_rows,
            SUM(CASE WHEN we.exercise_slug_snapshot IS NOT NULL AND we.exercise_slug_snapshot <> '' THEN 1 ELSE 0 END) AS with_slug
     FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     LEFT JOIN exercise_catalog ec ON ec.id = we.exercise_catalog_id
     WHERE w.program_id = ?`,
    [programId],
  );
  const [weekRows] = await execute(
    conn,
    `SELECT program_engine_week AS week, COUNT(*) AS workouts
     FROM workouts
     WHERE program_id = ?
     GROUP BY program_engine_week
     ORDER BY program_engine_week`,
    [programId],
  );
  const [patterns] = await execute(
    conn,
    `SELECT DISTINCT we.slot_movement_pattern AS pattern
     FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     WHERE w.program_id = ?
       AND we.slot_movement_pattern IN ('squat_pattern', 'bench', 'deadlift')`,
    [programId],
  );

  const metadata = typeof program.program_metadata_json === 'string'
    ? JSON.parse(program.program_metadata_json)
    : program.program_metadata_json;

  return {
    userId,
    programId,
    assignmentId,
    program: {
      generationSource: program.generation_source,
      engineVersion: program.engine_version,
      generationKey: program.generation_key,
      splitId: program.split_id,
      daysPerWeek: Number(program.days_per_week),
      cycleWeeks: Number(program.cycle_weeks),
      metadata: metadata?.generationMetadata || null,
    },
    assignment: {
      id: Number(assignment.id),
      userId: Number(assignment.user_id),
      programId: Number(assignment.program_id),
      status: assignment.status,
      source: assignment.assignment_source,
      notes: assignment.notes,
    },
    counts: {
      workouts: Number(workouts.count),
      weekCount: Number(workouts.week_count),
      minWeek: Number(workouts.min_week),
      maxWeek: Number(workouts.max_week),
      cardioWorkouts: Number(workouts.cardio_count),
      exerciseRows: Number(exerciseRows.count),
      exerciseRowsWithCatalogId: Number(exerciseRows.with_catalog_id),
      exerciseRowsMatchingCatalog: Number(exerciseRows.matching_catalog_rows),
      exerciseRowsWithSlug: Number(exerciseRows.with_slug),
    },
    weekRows: weekRows.map((row) => ({ week: Number(row.week), workouts: Number(row.workouts) })),
    competitionPatterns: patterns.map((row) => row.pattern).sort(),
  };
};

const waitForServer = async (child) => {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 20_000) {
    if (child.exitCode != null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error('Timed out waiting for server');
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

const fetchApiProgram = async ({ userId, token }) => {
  const response = await fetch(`${API_BASE}/user/${userId}/program`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`API read failed for user ${userId}: ${response.status} ${JSON.stringify(body)}`);
  }
  return {
    id: Number(body.id || 0) || null,
    assignmentId: Number(body.assignmentId || 0) || null,
    daysPerWeek: Number(body.daysPerWeek || 0),
    totalWeeks: Number(body.totalWeeks || 0),
    workouts: Array.isArray(body.workouts) ? body.workouts.length : 0,
    currentWeekWorkouts: Array.isArray(body.currentWeekWorkouts) ? body.currentWeekWorkouts.length : 0,
    firstWorkoutExerciseCount: Array.isArray(body.workouts?.[0]?.exercises)
      ? body.workouts[0].exercises.length
      : JSON.parse(body.workouts?.[0]?.exercises || '[]').length,
  };
};

const activeProgramCounts = async (conn, userId) => {
  const [[row]] = await execute(
    conn,
    `SELECT COUNT(*) AS active_assignments,
            COUNT(DISTINCT pa.program_id) AS active_programs,
            COALESCE(MAX(pa.program_id), 0) AS active_program_id
     FROM program_assignments pa
     WHERE pa.user_id = ? AND pa.status = 'active'`,
    [userId],
  );
  return {
    activeAssignments: Number(row.active_assignments),
    activePrograms: Number(row.active_programs),
    activeProgramId: Number(row.active_program_id),
  };
};

const createExistingSafetyFixture = async (conn) => {
  const user = await createTestUser(conn, 'safety');
  const [programResult] = await execute(
    conn,
    `INSERT INTO programs
       (created_by_user_id, target_user_id, name, description, program_type, goal,
        experience_level, days_per_week, cycle_weeks, is_template, is_active)
     VALUES (?, ?, ?, 'Existing safety plan', 'manual', 'hypertrophy',
        'intermediate', 3, 8, 0, 1)`,
    [user.id, user.id, `Existing Safety Program ${TEST_RUN}`],
  );
  const programId = Number(programResult.insertId);
  const [workoutResult] = await execute(
    conn,
    `INSERT INTO workouts
       (program_id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes)
     VALUES (?, 'Existing Safety Workout', 'Strength', 1, 'monday', 45, 'safety')`,
    [programId],
  );
  const [assignmentResult] = await execute(
    conn,
    `INSERT INTO program_assignments
       (user_id, program_id, assignment_source, rotation_weeks, auto_rotate_enabled,
        coach_override_allowed, start_date, next_rotation_date, status, notes)
     VALUES (?, ?, 'manual', 8, 1, 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 56 DAY), 'active', 'safety')`,
    [user.id, programId],
  );
  const [sessionResult] = await execute(
    conn,
    `INSERT INTO workout_sessions
       (user_id, program_assignment_id, workout_id, workout_name, muscle_group, status, completed_at)
     VALUES (?, ?, ?, 'Existing Safety Workout', 'Chest', 'completed', NOW())`,
    [user.id, Number(assignmentResult.insertId), Number(workoutResult.insertId)],
  );
  await execute(
    conn,
    `INSERT INTO workout_sets
       (user_id, session_id, exercise_name, set_number, weight, reps, completed)
     VALUES (?, ?, 'Existing Safety Set', 1, 10, 10, 1)`,
    [user.id, Number(sessionResult.insertId)],
  );

  return {
    user,
    programId,
    assignmentId: Number(assignmentResult.insertId),
    workoutId: Number(workoutResult.insertId),
    sessionId: Number(sessionResult.insertId),
  };
};

const safetySnapshot = async (conn, fixture) => {
  const counts = await activeProgramCounts(conn, fixture.user.id);
  const [[history]] = await execute(
    conn,
    `SELECT
       (SELECT COUNT(*) FROM workout_sessions WHERE user_id = ?) AS sessions,
       (SELECT COUNT(*) FROM workout_sets WHERE user_id = ?) AS sets`,
    [fixture.user.id, fixture.user.id],
  );
  return {
    ...counts,
    expectedProgramId: fixture.programId,
    expectedAssignmentId: fixture.assignmentId,
    sessions: Number(history.sessions),
    sets: Number(history.sets),
  };
};

const rollbackProbe = async (catalogProvider) => {
  const conn = await pool.getConnection();
  const user = await createTestUser(conn, 'rollback');
  await conn.beginTransaction();
  let error = null;
  let insertedWorkoutAttempts = 0;
  const proxyConn = {
    execute: async (sql, params = []) => {
      if (/^\s*INSERT INTO workouts/i.test(sql)) {
        insertedWorkoutAttempts += 1;
        if (insertedWorkoutAttempts === 2) {
          throw new Error('Injected persistence failure after partial workout insert');
        }
      }
      return conn.execute(sql, params);
    },
    query: async (sql, params = []) => conn.query(sql, params),
  };

  try {
    await generateAndPersistProgramEnginePlan(proxyConn, {
      userId: user.id,
      onboardingInput: TEST_PROFILES.A.onboardingInput,
      catalogProvider,
    });
    await conn.commit();
  } catch (err) {
    error = err;
    await conn.rollback();
  } finally {
    conn.release();
  }

  const [[rows]] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM programs WHERE target_user_id = ?) AS programs,
       (SELECT COUNT(*) FROM program_assignments WHERE user_id = ?) AS assignments,
       (SELECT COUNT(*) FROM workouts w JOIN programs p ON p.id = w.program_id WHERE p.target_user_id = ?) AS workouts`,
    [user.id, user.id, user.id],
  );

  return {
    injectedError: error?.message || null,
    rolledBack: Number(rows.programs) === 0 && Number(rows.assignments) === 0 && Number(rows.workouts) === 0,
    rowsAfterRollback: {
      programs: Number(rows.programs),
      assignments: Number(rows.assignments),
      workouts: Number(rows.workouts),
    },
  };
};

const main = async () => {
  const conn = await pool.getConnection();
  const catalogProvider = await loadLocalCatalogProvider(conn);
  const users = {};
  const db = {};
  const generation = {};

  const safetyFixture = await createExistingSafetyFixture(conn);
  const safetyBefore = await safetySnapshot(conn, safetyFixture);

  for (const label of Object.keys(TEST_PROFILES)) {
    users[label] = await createTestUser(conn, label);
    const started = Date.now();
    await conn.beginTransaction();
    try {
      const result = await generateAndPersistProgramEnginePlan(conn, {
        userId: users[label].id,
        onboardingInput: TEST_PROFILES[label].onboardingInput,
        catalogProvider,
      });
      await conn.commit();
      generation[label] = {
        ms: Date.now() - started,
        route: result.route,
        validation: result.finalValidation?.valid ? 'PASS' : 'FAIL',
        availableDaysPerWeek: result.trainingStrategy.schedule.availableDaysPerWeek,
        prescribedDaysPerWeek: result.trainingStrategy.schedule.prescribedDaysPerWeek,
        split: result.trainingStrategy.architecture.splitStrategy,
        programId: result.programId,
        assignmentId: result.assignment.assignmentId,
        referenceEvidence: {
          dataset: result.referenceEvidence.dataset,
          datasetVersion: result.referenceEvidence.datasetVersion,
          matchedCount: result.referenceEvidence.matchedCount,
          supportLevel: result.referenceEvidence.supportLevel,
        },
      };
      db[label] = await summarizeDbProgram(conn, {
        userId: users[label].id,
        programId: result.programId,
        assignmentId: result.assignment.assignmentId,
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  }

  const firstBProgramId = generation.B.programId;
  const secondB = await generateAndPersistProgramEnginePlan(conn, {
    userId: users.B.id,
    onboardingInput: TEST_PROFILES.B.onboardingInput,
    catalogProvider,
  });
  const idempotency = {
    firstProgramId: firstBProgramId,
    secondProgramId: secondB.programId,
    reused: Boolean(secondB.reusedExistingProgram),
    reason: secondB.reusedExistingProgram ? 'active generation_key match' : 'new generation_key',
  };

  const safetyAfter = await safetySnapshot(conn, safetyFixture);
  const routes = {
    hyrox: routeProgramEngineRequest({
      onboardingInput: { ...TEST_PROFILES.C.onboardingInput, athleteIdentity: 'hyrox' },
    }).route,
    boxing: routeProgramEngineRequest({
      onboardingInput: { ...TEST_PROFILES.A.onboardingInput, athleteIdentity: 'box' },
    }).route,
    customizedPlan: routeProgramEngineRequest({
      onboardingInput: TEST_PROFILES.A.onboardingInput,
      splitPreference: 'custom',
    }).route,
  };

  conn.release();

  const rollback = await rollbackProbe(catalogProvider);

  const server = await startServer();
  let api = {};
  let noRegenerationOnRead = {};
  try {
    for (const label of Object.keys(TEST_PROFILES)) {
      const before = await activeProgramCounts(pool, users[label].id);
      const first = await fetchApiProgram({ userId: users[label].id, token: users[label].token });
      const second = await fetchApiProgram({ userId: users[label].id, token: users[label].token });
      const after = await activeProgramCounts(pool, users[label].id);
      api[label] = first;
      noRegenerationOnRead[label] = {
        stableProgramId: first.id === second.id && first.id === before.activeProgramId && after.activeProgramId === before.activeProgramId,
        before,
        after,
      };
    }
  } finally {
    server.kill('SIGTERM');
  }

  const ownership = {
    userAProgramId: api.A.id,
    userBProgramId: api.B.id,
    separateAssignments: api.A.assignmentId !== api.B.assignmentId,
    separatePrograms: api.A.id !== api.B.id,
    userAReceivedUserBProgram: api.A.id === api.B.id,
  };

  console.log(JSON.stringify({
    testRun: TEST_RUN,
    catalog: {
      source: 'local_mysql.exercise_catalog',
      requestedIds: CATALOG_IDS.length,
    },
    generation,
    db,
    api,
    noRegenerationOnRead,
    idempotency,
    existingUserSafety: {
      before: safetyBefore,
      after: safetyAfter,
      unchanged: JSON.stringify(safetyBefore) === JSON.stringify(safetyAfter),
    },
    specialRoutes: routes,
    rollback,
    ownership,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
