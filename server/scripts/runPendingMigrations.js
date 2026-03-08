/* eslint-env node */
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../database.js';
import {
  applyTrackedMigration,
  getSortedMigrationFiles,
} from './migrationUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const migrationsDir = path.resolve(__dirname, '..', 'migrations');

const run = async () => {
  const migrationFiles = getSortedMigrationFiles(migrationsDir);
  if (!migrationFiles.length) {
    console.log('No SQL migrations found.');
    return;
  }

  const conn = await pool.getConnection();
  let appliedCount = 0;
  let skippedCount = 0;

  try {
    for (const migrationPath of migrationFiles) {
      const result = await applyTrackedMigration(conn, projectRoot, migrationPath);
      if (result.skipped) {
        skippedCount += 1;
        console.log(`[skip] ${result.filename}`);
      } else {
        appliedCount += 1;
        console.log(`[apply] ${result.filename} (${result.statementsExecuted} statements)`);
      }
    }

    console.log(`Pending migration run complete. Applied: ${appliedCount}, skipped: ${skippedCount}.`);
  } finally {
    conn.release();
  }
};

run()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error.message || String(error));
    try {
      await pool.end();
    } catch {
      // ignore pool shutdown errors
    }
    process.exit(1);
  });
