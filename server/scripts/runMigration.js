/* eslint-env node */
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../database.js';
import {
  applyTrackedMigration,
  resolveMigrationPath,
} from './migrationUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const run = async () => {
  const migrationArg = process.argv[2];
  if (!migrationArg) {
    throw new Error('Usage: node server/scripts/runMigration.js <relative-or-absolute-sql-file>');
  }

  const migrationPath = resolveMigrationPath(projectRoot, migrationArg);

  const conn = await pool.getConnection();
  try {
    const result = await applyTrackedMigration(conn, projectRoot, migrationPath);
    if (result.skipped) {
      console.log(`Migration already tracked: ${result.filename}`);
      return;
    }

    console.log(`Migration applied successfully: ${result.filename}`);
    console.log(`Executed statements: ${result.statementsExecuted}`);
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
