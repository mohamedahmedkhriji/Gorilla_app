/* eslint-env node */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const splitSqlStatements = (sqlText) => {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sqlText.length; i += 1) {
    const char = sqlText[i];
    const next = sqlText[i + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (char === '-' && next === '-') {
        inLineComment = true;
        i += 1;
        continue;
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        i += 1;
        continue;
      }
    }

    if (char === "'" && !inDouble && !inBacktick) {
      inSingle = !inSingle;
      current += char;
      continue;
    }
    if (char === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
      current += char;
      continue;
    }
    if (char === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
      current += char;
      continue;
    }

    if (char === ';' && !inSingle && !inDouble && !inBacktick) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
};

const run = async () => {
  const migrationArg = process.argv[2];
  if (!migrationArg) {
    throw new Error('Usage: node server/scripts/runMigration.js <relative-or-absolute-sql-file>');
  }

  const migrationPath = path.isAbsolute(migrationArg)
    ? migrationArg
    : path.resolve(__dirname, '..', '..', migrationArg);

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const raw = fs.readFileSync(migrationPath, 'utf8');
  const statements = splitSqlStatements(raw).filter((stmt) => !/^USE\s+/i.test(stmt));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const statement of statements) {
      await conn.query(statement);
    }
    await conn.commit();
    console.log(`Migration applied successfully: ${migrationPath}`);
    console.log(`Executed statements: ${statements.length}`);
  } catch (error) {
    await conn.rollback();
    throw new Error(`Migration failed: ${error.message}`);
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
