/* eslint-env node */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATASET_DIR = path.join(ROOT_DIR, 'dataset');

const FILES = {
  mega: path.join(DATASET_DIR, 'megaGymDataset.csv'),
  gym: path.join(DATASET_DIR, 'gym_exercise_dataset.csv'),
  stretch: path.join(DATASET_DIR, 'stretch_exercise_dataset.csv'),
};

const scrubText = (value) =>
  String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanNullable = (value) => {
  const text = scrubText(value);
  return text ? text : null;
};

const cleanNumber = (value) => {
  if (value == null) return null;
  const text = scrubText(value).replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeName = (value) =>
  scrubText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const csvToObjects = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) return [];

  const header = rows[0].map((h, idx) => {
    const cleaned = scrubText(h);
    return cleaned || `H${idx + 1}`;
  });

  return rows.slice(1).map((r) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = r[i] ?? '';
    }
    return obj;
  });
};

const splitMuscles = (value) => {
  const text = cleanNullable(value);
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(/[,;/|]+/)
        .map((v) => scrubText(v))
        .filter(Boolean),
    ),
  );
};

const ensureAlias = async (conn, exerciseCatalogId, aliasName, source) => {
  const alias = cleanNullable(aliasName);
  if (!alias) return false;
  const aliasNormalized = normalizeName(alias);
  if (!aliasNormalized) return false;

  const [result] = await conn.execute(
    `INSERT IGNORE INTO exercise_aliases (exercise_catalog_id, alias_name, alias_normalized, source)
     VALUES (?, ?, ?, ?)`,
    [exerciseCatalogId, alias, aliasNormalized, source],
  );
  return Number(result.affectedRows || 0) > 0;
};

const upsertMuscle = async (conn, exerciseCatalogId, muscle, role, loadFactor, isPrimary = 0) => {
  const muscleGroup = cleanNullable(muscle);
  if (!muscleGroup) return false;

  const [result] = await conn.execute(
    `INSERT INTO exercise_catalog_muscles (exercise_catalog_id, muscle_group, role, load_factor, is_primary)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       load_factor = GREATEST(load_factor, VALUES(load_factor)),
       is_primary = GREATEST(is_primary, VALUES(is_primary))`,
    [exerciseCatalogId, muscleGroup.slice(0, 64), role, loadFactor, isPrimary ? 1 : 0],
  );
  return Number(result.affectedRows || 0) > 0;
};

const upsertMegaExercise = async (conn, row, index) => {
  const sourceRowKey = cleanNullable(row.H1) || String(index);
  const canonicalName = cleanNullable(row.Title);
  const normalized = normalizeName(canonicalName);
  if (!canonicalName || !normalized) return null;

  const description = cleanNullable(row.Desc);
  const exerciseType = cleanNullable(row.Type);
  const bodyPart = cleanNullable(row.BodyPart);
  const equipment = cleanNullable(row.Equipment);
  const level = cleanNullable(row.Level);
  const rating = cleanNumber(row.Rating);
  const ratingDesc = cleanNullable(row.RatingDesc);
  const isStretch = exerciseType && /stretch/i.test(exerciseType) ? 1 : 0;

  const [result] = await conn.execute(
    `INSERT INTO exercise_catalog
      (source_dataset, source_row_key, canonical_name, normalized_name, description, exercise_type, body_part, equipment, level, rating, rating_desc, is_stretch, is_active)
     VALUES
      ('mega_gym', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
      canonical_name = VALUES(canonical_name),
      normalized_name = VALUES(normalized_name),
      description = COALESCE(VALUES(description), description),
      exercise_type = COALESCE(VALUES(exercise_type), exercise_type),
      body_part = COALESCE(VALUES(body_part), body_part),
      equipment = COALESCE(VALUES(equipment), equipment),
      level = COALESCE(VALUES(level), level),
      rating = COALESCE(VALUES(rating), rating),
      rating_desc = COALESCE(VALUES(rating_desc), rating_desc),
      is_stretch = GREATEST(is_stretch, VALUES(is_stretch)),
      is_active = 1,
      id = LAST_INSERT_ID(id)`,
    [sourceRowKey, canonicalName, normalized, description, exerciseType, bodyPart, equipment, level, rating, ratingDesc, isStretch],
  );

  return Number(result.insertId || 0);
};

const mergeCatalogFields = async (conn, exerciseCatalogId, fields) => {
  const params = [
    fields.description,
    fields.exerciseType,
    fields.bodyPart,
    fields.equipment,
    fields.level,
    fields.mechanics,
    fields.forceType,
    fields.utility,
    fields.difficultyTier,
    fields.instructionsPreparation,
    fields.instructionsExecution,
    fields.isStretch ? 1 : 0,
    exerciseCatalogId,
  ];

  await conn.execute(
    `UPDATE exercise_catalog
     SET
       description = COALESCE(description, ?),
       exercise_type = COALESCE(exercise_type, ?),
       body_part = COALESCE(body_part, ?),
       equipment = COALESCE(equipment, ?),
       level = COALESCE(level, ?),
       mechanics = COALESCE(mechanics, ?),
       force_type = COALESCE(force_type, ?),
       utility = COALESCE(utility, ?),
       difficulty_tier = COALESCE(difficulty_tier, ?),
       instructions_preparation = COALESCE(instructions_preparation, ?),
       instructions_execution = COALESCE(instructions_execution, ?),
       is_stretch = GREATEST(is_stretch, ?),
       is_active = 1
     WHERE id = ?`,
    params,
  );
};

const createCatalogExercise = async (conn, sourceDataset, sourceRowKey, canonicalName, fields) => {
  const normalized = normalizeName(canonicalName);
  if (!normalized) return null;

  const [result] = await conn.execute(
    `INSERT INTO exercise_catalog
      (source_dataset, source_row_key, canonical_name, normalized_name, description, exercise_type, body_part, equipment, level, mechanics, force_type, utility, difficulty_tier, instructions_preparation, instructions_execution, is_stretch, is_active)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
      canonical_name = VALUES(canonical_name),
      normalized_name = VALUES(normalized_name),
      description = COALESCE(VALUES(description), description),
      exercise_type = COALESCE(VALUES(exercise_type), exercise_type),
      body_part = COALESCE(VALUES(body_part), body_part),
      equipment = COALESCE(VALUES(equipment), equipment),
      level = COALESCE(VALUES(level), level),
      mechanics = COALESCE(VALUES(mechanics), mechanics),
      force_type = COALESCE(VALUES(force_type), force_type),
      utility = COALESCE(VALUES(utility), utility),
      difficulty_tier = COALESCE(VALUES(difficulty_tier), difficulty_tier),
      instructions_preparation = COALESCE(VALUES(instructions_preparation), instructions_preparation),
      instructions_execution = COALESCE(VALUES(instructions_execution), instructions_execution),
      is_stretch = GREATEST(is_stretch, VALUES(is_stretch)),
      is_active = 1,
      id = LAST_INSERT_ID(id)`,
    [
      sourceDataset,
      sourceRowKey,
      canonicalName,
      normalized,
      fields.description,
      fields.exerciseType,
      fields.bodyPart,
      fields.equipment,
      fields.level,
      fields.mechanics,
      fields.forceType,
      fields.utility,
      fields.difficultyTier,
      fields.instructionsPreparation,
      fields.instructionsExecution,
      fields.isStretch ? 1 : 0,
    ],
  );

  return Number(result.insertId || 0);
};

const buildRecoveryProfiles = async (conn) => {
  const [rows] = await conn.execute(
    `SELECT id, mechanics, force_type, exercise_type, is_stretch
     FROM exercise_catalog`,
  );

  for (const row of rows) {
    const mechanics = scrubText(row.mechanics || '').toLowerCase();
    const forceType = scrubText(row.force_type || '').toLowerCase();
    const exerciseType = scrubText(row.exercise_type || '').toLowerCase();
    const isStretch = Number(row.is_stretch || 0) === 1;

    let systemic = 1.0;
    let cns = 1.0;
    let eccentric = 1.0;

    if (isStretch || exerciseType.includes('stretch')) {
      systemic = 0.5;
      cns = 0.4;
      eccentric = 0.6;
    } else {
      if (mechanics.includes('compound')) {
        systemic += 0.4;
        cns += 0.4;
      } else if (mechanics.includes('isolated')) {
        systemic += 0.1;
        cns += 0.1;
      }

      if (exerciseType.includes('plyometrics') || exerciseType.includes('olympic') || exerciseType.includes('powerlifting')) {
        systemic += 0.3;
        cns += 0.4;
        eccentric += 0.2;
      }

      if (forceType.includes('pull') || forceType.includes('push')) {
        eccentric += 0.1;
      }
    }

    await conn.execute(
      `INSERT INTO exercise_recovery_profile (exercise_catalog_id, systemic_stress_score, cns_load_score, eccentric_bias_score)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         systemic_stress_score = VALUES(systemic_stress_score),
         cns_load_score = VALUES(cns_load_score),
         eccentric_bias_score = VALUES(eccentric_bias_score)`,
      [row.id, Number(systemic.toFixed(3)), Number(cns.toFixed(3)), Number(eccentric.toFixed(3))],
    );
  }
};

const main = async () => {
  Object.entries(FILES).forEach(([key, value]) => {
    if (!fs.existsSync(value)) {
      throw new Error(`Missing dataset file for ${key}: ${value}`);
    }
  });

  const megaRows = csvToObjects(FILES.mega);
  const gymRows = csvToObjects(FILES.gym);
  const stretchRows = csvToObjects(FILES.stretch);

  const conn = await pool.getConnection();
  const stats = {
    megaUpserts: 0,
    catalogCreated: 0,
    aliasesInserted: 0,
    musclesUpserted: 0,
    recoveryProfilesUpserted: 0,
    backfilledWorkoutSets: 0,
  };

  try {
    await conn.beginTransaction();

    const nameToId = new Map();

    for (let i = 0; i < megaRows.length; i += 1) {
      const row = megaRows[i];
      const id = await upsertMegaExercise(conn, row, i + 1);
      if (!id) continue;
      stats.megaUpserts += 1;

      const normalized = normalizeName(row.Title);
      if (normalized && !nameToId.has(normalized)) nameToId.set(normalized, id);

      const inserted = await ensureAlias(conn, id, row.Title, 'mega_gym');
      if (inserted) stats.aliasesInserted += 1;
    }

    for (let i = 0; i < gymRows.length; i += 1) {
      const row = gymRows[i];
      const name = cleanNullable(row['Exercise Name']);
      const normalized = normalizeName(name);
      if (!name || !normalized) continue;

      let exerciseCatalogId = nameToId.get(normalized) || null;
      const fields = {
        description: null,
        exerciseType: null,
        bodyPart: cleanNullable(row.Main_muscle),
        equipment: cleanNullable(row.Equipment),
        level: null,
        mechanics: cleanNullable(row.Mechanics),
        forceType: cleanNullable(row.Force),
        utility: cleanNullable(row.Utility),
        difficultyTier: cleanNumber(row['Difficulty (1-5)']),
        instructionsPreparation: cleanNullable(row.Preparation),
        instructionsExecution: cleanNullable(row.Execution),
        isStretch: 0,
      };

      if (!exerciseCatalogId) {
        exerciseCatalogId = await createCatalogExercise(conn, 'gym_exercise', String(i + 1), name, fields);
        if (!exerciseCatalogId) continue;
        nameToId.set(normalized, exerciseCatalogId);
        stats.catalogCreated += 1;
      } else {
        await mergeCatalogFields(conn, exerciseCatalogId, fields);
      }

      const inserted = await ensureAlias(conn, exerciseCatalogId, name, 'gym_exercise');
      if (inserted) stats.aliasesInserted += 1;

      for (const muscle of splitMuscles(row.Target_Muscles)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'target', 1.0, 1);
        if (changed) stats.musclesUpserted += 1;
      }
      for (const muscle of splitMuscles(row.Main_muscle)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'target', 1.0, 1);
        if (changed) stats.musclesUpserted += 1;
      }
      for (const muscle of splitMuscles(row.Synergist_Muscles)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'synergist', 0.6, 0);
        if (changed) stats.musclesUpserted += 1;
      }
      for (const muscle of splitMuscles(row.Stabilizer_Muscles)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'stabilizer', 0.4, 0);
        if (changed) stats.musclesUpserted += 1;
      }
      for (const muscle of splitMuscles(row.Antagonist_Muscles)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'antagonist', 0.3, 0);
        if (changed) stats.musclesUpserted += 1;
      }
      for (const muscle of splitMuscles(row.Dynamic_Stabilizer_Muscles)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'dynamic_stabilizer', 0.35, 0);
        if (changed) stats.musclesUpserted += 1;
      }
      for (const muscle of splitMuscles(row['Secondary Muscles'])) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'secondary', 0.5, 0);
        if (changed) stats.musclesUpserted += 1;
      }
    }

    for (let i = 0; i < stretchRows.length; i += 1) {
      const row = stretchRows[i];
      const name = cleanNullable(row['Exercise Name']);
      const normalized = normalizeName(name);
      if (!name || !normalized) continue;

      let exerciseCatalogId = nameToId.get(normalized) || null;
      const fields = {
        description: null,
        exerciseType: 'Stretching',
        bodyPart: cleanNullable(row.Main_muscle),
        equipment: cleanNullable(row.Equipment),
        level: null,
        mechanics: null,
        forceType: null,
        utility: null,
        difficultyTier: null,
        instructionsPreparation: cleanNullable(row.Preparation),
        instructionsExecution: cleanNullable(row.Execution),
        isStretch: 1,
      };

      if (!exerciseCatalogId) {
        exerciseCatalogId = await createCatalogExercise(conn, 'stretch_exercise', String(i + 1), name, fields);
        if (!exerciseCatalogId) continue;
        nameToId.set(normalized, exerciseCatalogId);
        stats.catalogCreated += 1;
      } else {
        await mergeCatalogFields(conn, exerciseCatalogId, fields);
      }

      const inserted = await ensureAlias(conn, exerciseCatalogId, name, 'stretch_exercise');
      if (inserted) stats.aliasesInserted += 1;

      for (const muscle of splitMuscles(row.Target_Muscles)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'target', 0.8, 1);
        if (changed) stats.musclesUpserted += 1;
      }
      for (const muscle of splitMuscles(row.Synergist_Muscles)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'synergist', 0.4, 0);
        if (changed) stats.musclesUpserted += 1;
      }
      for (const muscle of splitMuscles(row.Main_muscle)) {
        const changed = await upsertMuscle(conn, exerciseCatalogId, muscle, 'target', 0.8, 1);
        if (changed) stats.musclesUpserted += 1;
      }
    }

    await buildRecoveryProfiles(conn);
    const [recoveryCountRows] = await conn.execute('SELECT COUNT(*) AS c FROM exercise_recovery_profile');
    stats.recoveryProfilesUpserted = Number(recoveryCountRows[0]?.c || 0);

    const [backfill] = await conn.execute(
      `UPDATE workout_sets ws
       JOIN exercise_aliases ea ON LOWER(TRIM(ws.exercise_name)) = ea.alias_normalized
       SET ws.exercise_catalog_id = ea.exercise_catalog_id
       WHERE ws.exercise_catalog_id IS NULL`,
    );
    stats.backfilledWorkoutSets = Number(backfill.affectedRows || 0);

    await conn.commit();

    console.log('Catalog import completed successfully.');
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    await conn.rollback();
    console.error('Catalog import failed:', error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
};

main();
