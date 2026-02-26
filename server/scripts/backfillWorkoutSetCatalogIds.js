/* eslint-env node */
import pool from '../database.js';

const normalizeExerciseLookupName = (value = '') =>
  String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const resolveCatalogIdsByNormalizedNames = async (conn, normalizedNames = []) => {
  const uniqueNames = [...new Set(normalizedNames.map((name) => String(name || '').trim()).filter(Boolean))];
  const mapping = new Map();
  if (!uniqueNames.length) return mapping;

  const chunkSize = 200;
  for (let i = 0; i < uniqueNames.length; i += chunkSize) {
    const chunk = uniqueNames.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(', ');
    const [rows] = await conn.execute(
      `SELECT resolved.normalized_name, MIN(resolved.exercise_catalog_id) AS exercise_catalog_id
       FROM (
         SELECT ea.alias_normalized AS normalized_name, ea.exercise_catalog_id
         FROM exercise_aliases ea
         WHERE ea.alias_normalized IN (${placeholders})
         UNION ALL
         SELECT ec.normalized_name AS normalized_name, ec.id AS exercise_catalog_id
         FROM exercise_catalog ec
         WHERE ec.normalized_name IN (${placeholders}) AND ec.is_active = 1
       ) resolved
       GROUP BY resolved.normalized_name`,
      [...chunk, ...chunk],
    );

    rows.forEach((row) => {
      const key = String(row.normalized_name || '').trim();
      const catalogId = Number(row.exercise_catalog_id || 0);
      if (key && catalogId > 0) mapping.set(key, catalogId);
    });
  }

  return mapping;
};

const run = async () => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [rows] = await conn.execute(
      `SELECT id, exercise_name
       FROM workout_sets
       WHERE exercise_catalog_id IS NULL`,
    );

    if (!rows.length) {
      console.log('No workout_sets rows need backfill.');
      return;
    }

    const normalizedById = new Map();
    rows.forEach((row) => {
      const normalized = normalizeExerciseLookupName(row.exercise_name);
      if (normalized) normalizedById.set(Number(row.id), normalized);
    });

    const mapping = await resolveCatalogIdsByNormalizedNames(
      conn,
      Array.from(normalizedById.values()),
    );

    const updates = [];
    normalizedById.forEach((normalizedName, rowId) => {
      const catalogId = mapping.get(normalizedName);
      if (catalogId) {
        updates.push({ rowId, catalogId });
      }
    });

    if (!updates.length) {
      console.log(`No catalog matches found for ${rows.length} rows.`);
      return;
    }

    await conn.beginTransaction();
    for (const update of updates) {
      await conn.execute(
        'UPDATE workout_sets SET exercise_catalog_id = ? WHERE id = ? AND exercise_catalog_id IS NULL',
        [update.catalogId, update.rowId],
      );
    }
    await conn.commit();

    console.log(`Backfill completed. Updated ${updates.length} workout_sets rows.`);
    console.log(`Unmatched rows: ${Math.max(0, rows.length - updates.length)}`);
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
};

run();
