/* eslint-env node */
import pool from '../database.js';

const WEEKDAY_BY_DAYS_PER_WEEK = {
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
};

const EXERCISE_NAME_ALIASES = {
  'Reverse Grip Lat Pulldown': 'Reverse-Grip Lat Pulldown',
  'Cable Triceps Kickback': 'Cable Tricep Kickback',
};

const MUSCLE_MAP = {
  'Assisted Dip': { p: ['Triceps', 'Pectoralis Major'], s: ['Anterior Deltoid'] },
  'Back Squat': { p: ['Quadriceps'], s: ['Glutes', 'Hamstrings', 'Core', 'Erector Spinae'] },
  'Barbell Bench Press': { p: ['Pectoralis Major'], s: ['Anterior Deltoid', 'Triceps'] },
  'Barbell Bent Over Row': { p: ['Latissimus Dorsi', 'Rhomboids', 'Traps (mid)'], s: ['Biceps', 'Rear Delts', 'Erector Spinae'] },
  'Barbell Hip Thrust': { p: ['Glutes'], s: ['Hamstrings'] },
  'Bent Over Reverse Dumbbell Flye': { p: ['Rear Deltoids'], s: ['Rhomboids', 'Traps (mid)'] },
  'Bicycle Crunch': { p: ['Rectus Abdominis', 'Obliques'], s: [] },
  'Cable Flye': { p: ['Pectoralis Major'], s: ['Anterior Deltoid'] },
  'Cable Lateral Raise': { p: ['Lateral Deltoid'], s: ['Traps (upper)'] },
  'Cable Reverse Fly': { p: ['Rear Deltoids'], s: ['Rhomboids', 'Traps (mid)'] },
  'Cable Seated Row': { p: ['Latissimus Dorsi', 'Rhomboids', 'Traps (mid)'], s: ['Biceps', 'Rear Delts'] },
  'Cable Tricep Kickback': { p: ['Triceps Brachii'], s: [] },
  'Chest-Supported T-Bar Row': { p: ['Latissimus Dorsi', 'Rhomboids', 'Traps (mid)'], s: ['Biceps', 'Rear Delts'] },
  'Close-Grip Bench Press': { p: ['Triceps'], s: ['Pectoralis Major', 'Anterior Deltoid'] },
  Crunch: { p: ['Rectus Abdominis'], s: ['Obliques'] },
  Deadlift: { p: ['Hamstrings', 'Glutes', 'Erector Spinae'], s: ['Traps', 'Forearms', 'Quadriceps'] },
  'Dumbbell Floor Press': { p: ['Triceps'], s: ['Pectoralis Major', 'Anterior Deltoid'] },
  'Dumbbell Incline Press': { p: ['Pectoralis Major (upper/clavicular)'], s: ['Anterior Deltoid', 'Triceps'] },
  'Dumbbell Lateral Raise': { p: ['Lateral Deltoid'], s: ['Anterior Deltoid', 'Traps (upper)'] },
  'Dumbbell Row': { p: ['Latissimus Dorsi', 'Rhomboids', 'Traps (mid)'], s: ['Biceps', 'Rear Delts'] },
  'Dumbbell Seated Shoulder Press': { p: ['Deltoids (anterior & lateral)'], s: ['Triceps', 'Traps'] },
  'Dumbbell Single-Leg Hip Thrust': { p: ['Glutes'], s: ['Hamstrings'] },
  'Dumbbell Skull Crusher': { p: ['Triceps Brachii'], s: [] },
  'Dumbbell Supinated Curl': { p: ['Biceps Brachii'], s: ['Brachialis', 'Forearms'] },
  'Dumbbell Walking Lunge': { p: ['Quadriceps', 'Glutes'], s: ['Hamstrings', 'Calves'] },
  'EZ Bar Curl': { p: ['Biceps Brachii'], s: ['Brachialis', 'Forearms'] },
  'Goblet Squat': { p: ['Quadriceps'], s: ['Glutes', 'Hamstrings', 'Core'] },
  'Hammer Curl': { p: ['Brachialis', 'Brachioradialis'], s: ['Biceps'] },
  'Hanging Leg Raise': { p: ['Rectus Abdominis', 'Hip Flexors'], s: ['Obliques'] },
  'Lat Pulldown': { p: ['Latissimus Dorsi'], s: ['Biceps', 'Rhomboids', 'Traps (mid/lower)'] },
  'Leg Curl': { p: ['Hamstrings'], s: [] },
  'Leg Extension': { p: ['Quadriceps'], s: [] },
  'Leg Press': { p: ['Quadriceps'], s: ['Glutes', 'Hamstrings'] },
  'Lying Leg Curl': { p: ['Hamstrings'], s: [] },
  'Machine Incline Chest Press': { p: ['Pectoralis Major (upper)'], s: ['Anterior Deltoid', 'Triceps'] },
  'Machine Seated Hip Abduction': { p: ['Gluteus Medius', 'Gluteus Minimus'], s: [] },
  'Neutral-Grip Pulldown': { p: ['Latissimus Dorsi'], s: ['Biceps', 'Brachialis', 'Rhomboids'] },
  'Overhead Press': { p: ['Deltoids (anterior & lateral)'], s: ['Triceps', 'Traps (upper)'] },
  'Pec Deck': { p: ['Pectoralis Major'], s: ['Anterior Deltoid'] },
  Plank: { p: ['Core (Rectus Abdominis, Transverse Abdominis)'], s: ['Shoulders', 'Glutes'] },
  'Reverse-Grip Lat Pulldown': { p: ['Latissimus Dorsi', 'Biceps'], s: ['Rhomboids', 'Traps (mid)'] },
  'Reverse Pec Deck': { p: ['Rear Deltoids'], s: ['Rhomboids', 'Traps (mid)'] },
  'Romanian Deadlift': { p: ['Hamstrings', 'Glutes'], s: ['Erector Spinae'] },
  'Seated Face Pull': { p: ['Rear Deltoids', 'Traps (mid/lower)', 'Rhomboids'], s: ['External Rotators'] },
  'Seated Leg Curl': { p: ['Hamstrings'], s: [] },
  'Single-Arm Cable Curl': { p: ['Biceps Brachii'], s: ['Brachialis', 'Forearms'] },
  'Single-Arm Pulldown': { p: ['Latissimus Dorsi'], s: ['Biceps', 'Rhomboids', 'Traps'] },
  'Single-Arm Rope Tricep Extension': { p: ['Triceps Brachii'], s: [] },
  'Single-Leg Leg Extension': { p: ['Quadriceps'], s: [] },
  'Single-Leg Lying Leg Curl': { p: ['Hamstrings'], s: [] },
  'Standing Calf Raise': { p: ['Gastrocnemius', 'Soleus'], s: [] },
};

const e = (name, sets, reps, rpe, rest) => ({ name, sets, reps: String(reps), rpe, rest });
const d = (day, workoutType, exercises) => ({ day, workoutType, exercises });

const PROGRAMS = [
  {
    name: '8-Week Full Body Hypertrophy',
    description: 'Full body progression with week 5 swap.',
    programType: 'full_body',
    daysPerWeek: 3,
    phases: {
      phase1: [
        d('Full Body #1', 'Full Body', [
          e('Back Squat', 3, 6, 7, '3-4 min'),
          e('Barbell Bench Press', 3, 8, 7, '3-4 min'),
          e('Lat Pulldown', 3, 10, 8, '2-3 min'),
          e('Romanian Deadlift', 3, 10, 7, '2-3 min'),
          e('Assisted Dip', 3, 8, 7, '1-2 min'),
          e('Standing Calf Raise', 3, 10, 8, '1-2 min'),
          e('Dumbbell Supinated Curl', 3, 10, 8, '1-2 min'),
        ]),
        d('Full Body #2', 'Full Body', [
          e('Deadlift', 3, 5, 7, '3-4 min'),
          e('Overhead Press', 3, 8, 8, '3-4 min'),
          e('Chest-Supported T-Bar Row', 3, 12, 8, '2-3 min'),
          e('Leg Extension', 3, 12, 8, '1-2 min'),
          e('Cable Flye', 3, 12, 8, '1-2 min'),
          e('Crunch', 3, 12, 7, '1-2 min'),
          e('Dumbbell Skull Crusher', 3, 12, 8, '1-2 min'),
        ]),
        d('Full Body #3', 'Full Body', [
          e('Dumbbell Walking Lunge', 3, 10, 8, '2-3 min'),
          e('Dumbbell Incline Press', 3, 8, 7, '2-3 min'),
          e('Reverse-Grip Lat Pulldown', 3, 10, 8, '2-3 min'),
          e('Barbell Hip Thrust', 3, 12, 8, '2-3 min'),
          e('Seated Face Pull', 3, 12, 8, '1-2 min'),
          e('Dumbbell Lateral Raise', 3, 10, 8, '1-2 min'),
          e('Lying Leg Curl', 3, 10, 8, '1-2 min'),
        ]),
      ],
      phase2: [
        d('Full Body #1', 'Full Body', [
          e('Back Squat', 3, 8, 8, '3-4 min'),
          e('Dumbbell Seated Shoulder Press', 3, 10, 8, '3-4 min'),
          e('Single-Arm Pulldown', 3, 12, 9, '2-3 min'),
          e('Barbell Hip Thrust', 3, 8, 9, '2-3 min'),
          e('Pec Deck', 3, 15, 9, '1-2 min'),
          e('Reverse Pec Deck', 3, 15, 9, '1-2 min'),
          e('Cable Lateral Raise', 3, 12, 9, '1-2 min'),
        ]),
        d('Full Body #2', 'Full Body', [
          e('Deadlift', 3, 3, 8, '3-4 min'),
          e('Close-Grip Bench Press', 3, 5, 7, '3-4 min'),
          e('Dumbbell Row', 3, 12, 8, '2-3 min'),
          e('Dumbbell Walking Lunge', 3, 12, 8, '1-2 min'),
          e('Assisted Dip', 3, 12, 8, '1-2 min'),
          e('Bicycle Crunch', 3, 10, 7, '1-2 min'),
          e('Single-Arm Cable Curl', 3, 12, 8, '1-2 min'),
        ]),
        d('Full Body #3', 'Full Body', [
          e('Back Squat', 3, 5, 8, '2-3 min'),
          e('Barbell Bench Press', 3, 10, 8, '2-3 min'),
          e('Neutral-Grip Pulldown', 3, 15, 8, '2-3 min'),
          e('Lying Leg Curl', 3, 12, 8, '2-3 min'),
          e('Seated Face Pull', 3, 15, 8, '1-2 min'),
          e('Single-Arm Rope Tricep Extension', 3, 12, 8, '1-2 min'),
          e('Standing Calf Raise', 3, 10, 8, '1-2 min'),
        ]),
      ],
    },
  },
  {
    name: '8-Week Upper/Lower Hypertrophy',
    description: 'Upper/lower progression with week 5 swap.',
    programType: 'upper_lower',
    daysPerWeek: 4,
    phases: {
      phase1: [
        d('Lower Body #1', 'Lower Body', [e('Back Squat', 3, 6, 7, '3-4 min'), e('Romanian Deadlift', 3, 10, 7, '2-3 min'), e('Barbell Hip Thrust', 3, 12, 8, '2-3 min'), e('Leg Extension', 3, 12, 9, '1-2 min'), e('Lying Leg Curl', 3, 12, 9, '1-2 min'), e('Machine Seated Hip Abduction', 3, 6, 7, '1-2 min'), e('Crunch', 3, 12, 7, '1-2 min')]),
        d('Upper Body #1', 'Upper Body', [e('Barbell Bench Press', 3, 5, 7, '3-4 min'), e('Lat Pulldown', 3, 10, 8, '2-3 min'), e('Overhead Press', 3, 10, 7, '3-4 min'), e('Chest-Supported T-Bar Row', 3, 12, 8, '2-3 min'), e('Cable Flye', 3, 12, 8, '1-2 min'), e('Dumbbell Supinated Curl', 3, 10, 8, '1-2 min'), e('Single-Arm Rope Tricep Extension', 3, 12, 8, '1-2 min')]),
        d('Lower Body #2', 'Lower Body', [e('Deadlift', 3, 8, 7, '3-4 min'), e('Dumbbell Walking Lunge', 3, 10, 8, '2-3 min'), e('Single-Leg Leg Extension', 3, 15, 8, '1-2 min'), e('Single-Leg Lying Leg Curl', 3, 15, 8, '1-2 min'), e('Machine Seated Hip Abduction', 3, 15, 9, '1-2 min'), e('Standing Calf Raise', 3, 12, 8, '1-2 min'), e('Plank', 3, '20 sec', 8, '1-2 min')]),
        d('Upper Body #2', 'Upper Body', [e('Dumbbell Incline Press', 3, 8, 8, '2-3 min'), e('Reverse-Grip Lat Pulldown', 3, 8, 8, '2-3 min'), e('Assisted Dip', 3, 10, 7, '2-3 min'), e('Barbell Bent Over Row', 3, 12, 7, '2-3 min'), e('Dumbbell Lateral Raise', 3, 15, 8, '1-2 min'), e('Seated Face Pull', 3, 15, 8, '1-2 min'), e('Hammer Curl', 3, 8, 9, '1-2 min')]),
      ],
      phase2: [
        d('Lower Body #1', 'Lower Body', [e('Deadlift', 3, 5, 8, '3-4 min'), e('Goblet Squat', 3, 12, 8, '2-3 min'), e('Dumbbell Single-Leg Hip Thrust', 3, 10, 9, '2-3 min'), e('Leg Press', 3, 12, 8, '1-2 min'), e('Lying Leg Curl', 3, 15, 9, '1-2 min'), e('Standing Calf Raise', 3, 8, 8, '1-2 min'), e('Bicycle Crunch', 3, 12, 8, '1-2 min')]),
        d('Upper Body #1', 'Upper Body', [e('Barbell Bench Press', 3, 8, 8, '3-4 min'), e('Single-Arm Pulldown', 3, 8, 8, '2-3 min'), e('Dumbbell Seated Shoulder Press', 3, 12, 7, '2-3 min'), e('Dumbbell Row', 3, 12, 8, '2-3 min'), e('Assisted Dip', 3, 6, 8, '1-2 min'), e('Seated Face Pull', 3, 15, 9, '1-2 min'), e('EZ Bar Curl', 3, 12, 9, '1-2 min')]),
        d('Lower Body #2', 'Lower Body', [e('Back Squat', 3, 8, 8, '3-4 min'), e('Barbell Hip Thrust', 3, 8, 8, '2-3 min'), e('Romanian Deadlift', 3, 12, 8, '2-3 min'), e('Seated Leg Curl', 3, 8, 9, '1-2 min'), e('Standing Calf Raise', 3, 6, 9, '1-2 min'), e('Hanging Leg Raise', 3, 6, 8, '1-2 min'), e('Machine Seated Hip Abduction', 3, 20, 9, '1-2 min')]),
        d('Upper Body #2', 'Upper Body', [e('Overhead Press', 3, 6, 8, '3-4 min'), e('Neutral-Grip Pulldown', 3, 6, 8, '3-4 min'), e('Dumbbell Incline Press', 3, 8, 8, '2-3 min'), e('Cable Seated Row', 3, 8, 9, '2-3 min'), e('Cable Lateral Raise', 3, 12, 8, '1-2 min'), e('Reverse Pec Deck', 3, 12, 8, '1-2 min'), e('Single-Arm Cable Curl', 3, 15, 9, '1-2 min')]),
      ],
    },
  },
  {
    name: '8-Week Body Part Split Hypertrophy',
    description: 'Body-part split progression with week 5 swap.',
    programType: 'custom',
    daysPerWeek: 5,
    phases: {
      phase1: [
        d('Chest & Triceps', 'Upper Body', [e('Barbell Bench Press', 3, 6, 7, '3-4 min'), e('Dumbbell Incline Press', 3, 8, 8, '2-3 min'), e('Cable Flye', 3, 12, 8, '1-2 min'), e('Assisted Dip', 3, 10, 7, '1-2 min'), e('Dumbbell Skull Crusher', 3, 12, 8, '1-2 min')]),
        d('Legs & Abs #1', 'Lower Body', [e('Back Squat', 3, 6, 7, '3-4 min'), e('Romanian Deadlift', 3, 8, 7, '2-3 min'), e('Barbell Hip Thrust', 3, 12, 8, '2-3 min'), e('Leg Extension', 3, 12, 8, '1-2 min'), e('Leg Curl', 3, 12, 8, '1-2 min'), e('Standing Calf Raise', 2, 8, 7, '1-2 min'), e('Crunch', 2, 12, 7, '1-2 min')]),
        d('Back & Biceps', 'Upper Body', [e('Reverse-Grip Lat Pulldown', 3, 8, 8, '2-3 min'), e('Cable Seated Row', 3, 10, 8, '2-3 min'), e('Chest-Supported T-Bar Row', 3, 12, 8, '2-3 min'), e('Seated Face Pull', 3, 15, 8, '1-2 min'), e('Dumbbell Supinated Curl', 3, 12, 8, '1-2 min')]),
        d('Legs & Abs #2', 'Lower Body', [e('Deadlift', 3, 5, 7, '3-4 min'), e('Dumbbell Walking Lunge', 3, 10, 8, '2-3 min'), e('Single-Leg Leg Extension', 2, 15, 8, '1-2 min'), e('Single-Leg Lying Leg Curl', 2, 15, 8, '1-2 min'), e('Machine Seated Hip Abduction', 3, 15, 7, '1-2 min'), e('Standing Calf Raise', 2, 12, 8, '1-2 min'), e('Plank', 3, '20 sec', 8, '1-2 min')]),
        d('Shoulders & Arms', 'Upper Body', [e('Overhead Press', 3, 6, 7, '3-4 min'), e('Dumbbell Lateral Raise', 3, 12, 8, '1-2 min'), e('Cable Reverse Fly', 3, 15, 8, '1-2 min'), e('Single-Arm Rope Tricep Extension', 2, 12, 8, '1-2 min'), e('Single-Arm Cable Curl', 2, 12, 8, '1-2 min')]),
      ],
      phase2: [
        d('Chest & Triceps', 'Upper Body', [e('Barbell Bench Press', 3, 8, 8, '3-4 min'), e('Machine Incline Chest Press', 3, 12, 8, '2-3 min'), e('Pec Deck', 3, 12, 8, '1-2 min'), e('Assisted Dip', 3, 6, 8, '1-2 min'), e('Cable Tricep Kickback', 3, 15, 8, '1-2 min')]),
        d('Legs & Abs #1', 'Lower Body', [e('Deadlift', 3, 5, 8, '3-4 min'), e('Goblet Squat', 3, 12, 8, '2-3 min'), e('Dumbbell Single-Leg Hip Thrust', 3, 10, 9, '2-3 min'), e('Leg Press', 3, 12, 8, '1-2 min'), e('Lying Leg Curl', 3, 15, 9, '1-2 min'), e('Standing Calf Raise', 3, 8, 8, '1-2 min'), e('Bicycle Crunch', 3, 12, 8, '1-2 min')]),
        d('Back & Biceps', 'Upper Body', [e('Lat Pulldown', 3, 6, 8, '2-3 min'), e('Dumbbell Row', 3, 12, 8, '2-3 min'), e('Barbell Bent Over Row', 3, 12, 8, '2-3 min'), e('Reverse Pec Deck', 3, 15, 8, '1-2 min'), e('EZ Bar Curl', 3, 15, 8, '1-2 min')]),
        d('Legs & Abs #2', 'Lower Body', [e('Back Squat', 3, 8, 8, '3-4 min'), e('Barbell Hip Thrust', 3, 8, 8, '2-3 min'), e('Romanian Deadlift', 3, 12, 8, '2-3 min'), e('Seated Leg Curl', 3, 8, 9, '1-2 min'), e('Standing Calf Raise', 3, 6, 9, '1-2 min'), e('Hanging Leg Raise', 3, 6, 8, '1-2 min'), e('Machine Seated Hip Abduction', 3, 20, 9, '1-2 min')]),
        d('Shoulders & Arms', 'Upper Body', [e('Dumbbell Seated Shoulder Press', 3, 10, 8, '3-4 min'), e('Cable Lateral Raise', 3, 10, 8, '1-2 min'), e('Bent Over Reverse Dumbbell Flye', 3, 12, 8, '1-2 min'), e('Dumbbell Floor Press', 2, 15, 8, '1-2 min'), e('Hammer Curl', 2, 8, 8, '1-2 min')]),
      ],
    },
  },
];

const canonicalName = (name) => {
  const n = String(name || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  return EXERCISE_NAME_ALIASES[n] || n;
};

const parseRestSeconds = (rest) => {
  const text = String(rest || '').toLowerCase().replace(/[–—]/g, '-').trim();
  const sec = text.match(/^(\d+)\s*sec$/);
  if (sec) return Number(sec[1]);
  const range = text.match(/^(\d+)\s*-\s*(\d+)\s*min$/);
  if (range) return Math.round(((Number(range[1]) + Number(range[2])) / 2) * 60);
  const min = text.match(/^(\d+)\s*min$/);
  if (min) return Number(min[1]) * 60;
  return null;
};

const inferCategory = (name) => (/squat|deadlift|row|press|pulldown|lunge|dip|thrust|leg press/i.test(name) ? 'compound' : 'isolation');
const phaseForWeek = (week) => (week <= 4 ? 'phase1' : 'phase2');

const getSystemIds = async (conn) => {
  const [gyms] = await conn.execute('SELECT id FROM gyms ORDER BY id ASC LIMIT 1');
  const [users] = await conn.execute("SELECT id FROM users WHERE role IN ('coach','gym_owner') ORDER BY FIELD(role,'coach','gym_owner'), id ASC LIMIT 1");
  return { gymId: gyms[0]?.id || null, creatorId: users[0]?.id || null };
};

const upsertProgram = async (conn, p, ids) => {
  const [rows] = await conn.execute('SELECT id FROM programs WHERE name = ? AND is_template = 1 LIMIT 1', [p.name]);
  if (rows.length) {
    const id = rows[0].id;
    await conn.execute(
      `UPDATE programs
       SET gym_id = ?, created_by_user_id = ?, target_user_id = NULL, description = ?, program_type = ?,
           goal = 'hypertrophy', experience_level = 'intermediate', days_per_week = ?, cycle_weeks = 8, is_template = 1, is_active = 1
       WHERE id = ?`,
      [ids.gymId, ids.creatorId, p.description, p.programType, p.daysPerWeek, id],
    );
    return id;
  }
  const [ins] = await conn.execute(
    `INSERT INTO programs
      (gym_id, created_by_user_id, target_user_id, name, description, program_type, goal, experience_level, days_per_week, cycle_weeks, is_template, is_active)
     VALUES (?, ?, NULL, ?, ?, ?, 'hypertrophy', 'intermediate', ?, 8, 1, 1)`,
    [ids.gymId, ids.creatorId, p.name, p.description, p.programType, p.daysPerWeek],
  );
  return ins.insertId;
};

const ensureExercise = async (conn, cache, syncSet, rawName) => {
  const name = canonicalName(rawName);
  if (cache.has(name)) return cache.get(name);

  const [rows] = await conn.execute('SELECT id FROM exercises WHERE name = ? LIMIT 1', [name]);
  let id;
  if (rows.length) {
    id = rows[0].id;
  } else {
    const [ins] = await conn.execute(
      `INSERT INTO exercises (name, category, equipment, difficulty, instructions, video_url, is_active)
       VALUES (?, ?, NULL, 'intermediate', NULL, NULL, 1)`,
      [name, inferCategory(name)],
    );
    id = ins.insertId;
  }
  cache.set(name, id);

  if (!syncSet.has(id)) {
    syncSet.add(id);
    const map = MUSCLE_MAP[name];
    if (map) {
      await conn.execute('DELETE FROM exercise_muscles WHERE exercise_id = ?', [id]);
      for (const muscle of map.p || []) {
        await conn.execute('INSERT INTO exercise_muscles (exercise_id, muscle_group, is_primary, load_factor) VALUES (?, ?, 1, 1.00)', [id, muscle]);
      }
      for (const muscle of map.s || []) {
        await conn.execute('INSERT INTO exercise_muscles (exercise_id, muscle_group, is_primary, load_factor) VALUES (?, ?, 0, 0.50)', [id, muscle]);
      }
    }
  }

  return id;
};

const seedProgram = async (conn, p, ids, shared) => {
  const programId = await upsertProgram(conn, p, ids);
  await conn.execute('DELETE FROM workouts WHERE program_id = ?', [programId]);

  const weekdays = WEEKDAY_BY_DAYS_PER_WEEK[p.daysPerWeek];
  let dayOrder = 0;
  let workouts = 0;
  let workoutExercises = 0;

  for (let week = 1; week <= 8; week += 1) {
    const days = p.phases[phaseForWeek(week)];
    for (let i = 0; i < days.length; i += 1) {
      dayOrder += 1;
      const day = days[i];
      const [workoutIns] = await conn.execute(
        `INSERT INTO workouts (program_id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
        [programId, `Week ${week} - ${day.day}`, day.workoutType, dayOrder, weekdays[i % weekdays.length]],
      );
      workouts += 1;
      const workoutId = workoutIns.insertId;

      for (let idx = 0; idx < day.exercises.length; idx += 1) {
        const ex = day.exercises[idx];
        const exName = canonicalName(ex.name);
        const exerciseId = await ensureExercise(conn, shared.exerciseCache, shared.exerciseMapSynced, exName);
        const map = MUSCLE_MAP[exName];
        const primary = map?.p?.[0] || null;

        await conn.execute(
          `INSERT INTO workout_exercises
            (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, NULL)`,
          [workoutId, exerciseId, idx + 1, exName, primary, ex.sets, ex.reps, parseRestSeconds(ex.rest), ex.rpe],
        );
        workoutExercises += 1;
      }
    }
  }

  return { programId, workouts, workoutExercises };
};

const main = async () => {
  const conn = await pool.getConnection();
  const shared = { exerciseCache: new Map(), exerciseMapSynced: new Set() };

  try {
    await conn.beginTransaction();

    const ids = await getSystemIds(conn);
    if (!ids.gymId) throw new Error('No gym found. Insert at least one row in gyms.');
    if (!ids.creatorId) throw new Error('No coach/gym_owner found in users.');

    const summary = [];
    for (const p of PROGRAMS) {
      const result = await seedProgram(conn, p, ids, shared);
      summary.push({ name: p.name, ...result });
    }

    await conn.commit();
    console.log('Workout plan seed completed.');
    for (const item of summary) {
      console.log(`- ${item.name}: program_id=${item.programId}, workouts=${item.workouts}, workout_exercises=${item.workoutExercises}`);
    }
  } catch (error) {
    await conn.rollback();
    console.error('Workout plan seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
};

main();
