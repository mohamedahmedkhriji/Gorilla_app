/* eslint-env node */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const MIGRATIONS_TABLE = 'schema_migrations';

export const splitSqlStatements = (sqlText) => {
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

export const resolveMigrationPath = (projectRoot, migrationArg) => {
  const migrationPath = path.isAbsolute(migrationArg)
    ? migrationArg
    : path.resolve(projectRoot, migrationArg);

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  return migrationPath;
};

export const normalizeProjectPath = (projectRoot, targetPath) =>
  path.relative(projectRoot, targetPath).split(path.sep).join('/');

export const readMigrationFile = (migrationPath) => {
  const raw = fs.readFileSync(migrationPath, 'utf8');
  return {
    raw,
    checksum: crypto.createHash('sha256').update(raw).digest('hex'),
    statements: splitSqlStatements(raw).filter((stmt) => !/^USE\s+/i.test(stmt)),
  };
};

export const ensureSchemaMigrationsTable = async (conn) => {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      statements_executed INT UNSIGNED NOT NULL DEFAULT 0,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_schema_migrations_filename (filename)
    ) ENGINE=InnoDB`,
  );
};

const ALTER_ADD_COLUMN_IF_NOT_EXISTS_RE =
  /^ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+`?([A-Za-z0-9_]+)`?\s+([\s\S]+)$/i;

const ALTER_ADD_INDEX_IF_NOT_EXISTS_RE =
  /^ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s+ADD\s+INDEX\s+IF\s+NOT\s+EXISTS\s+`?([A-Za-z0-9_]+)`?\s+([\s\S]+)$/i;

const hasColumn = async (conn, tableName, columnName) => {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS match_count
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.match_count || 0) > 0;
};

const hasIndex = async (conn, tableName, indexName) => {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS match_count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?`,
    [tableName, indexName],
  );
  return Number(rows[0]?.match_count || 0) > 0;
};

const executeCompatStatement = async (conn, statement) => {
  const addColumnMatch = statement.match(ALTER_ADD_COLUMN_IF_NOT_EXISTS_RE);
  if (addColumnMatch) {
    const [, tableName, columnName] = addColumnMatch;
    if (await hasColumn(conn, tableName, columnName)) {
      return false;
    }

    await conn.query(
      statement.replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i, 'ADD COLUMN'),
    );
    return true;
  }

  const addIndexMatch = statement.match(ALTER_ADD_INDEX_IF_NOT_EXISTS_RE);
  if (addIndexMatch) {
    const [, tableName, indexName] = addIndexMatch;
    if (await hasIndex(conn, tableName, indexName)) {
      return false;
    }

    await conn.query(
      statement.replace(/ADD\s+INDEX\s+IF\s+NOT\s+EXISTS/i, 'ADD INDEX'),
    );
    return true;
  }

  await conn.query(statement);
  return true;
};

export const applyTrackedMigration = async (conn, projectRoot, migrationPath) => {
  const filename = normalizeProjectPath(projectRoot, migrationPath);
  const { checksum, statements } = readMigrationFile(migrationPath);

  await ensureSchemaMigrationsTable(conn);

  const [existingRows] = await conn.query(
    `SELECT checksum, applied_at
     FROM ${MIGRATIONS_TABLE}
     WHERE filename = ?
     LIMIT 1`,
    [filename],
  );

  if (existingRows.length) {
    const existing = existingRows[0];
    if (existing.checksum !== checksum) {
      throw new Error(
        `Tracked migration checksum mismatch for ${filename}. ` +
        'Create a new migration file instead of editing one that already ran.',
      );
    }

    return {
      filename,
      skipped: true,
      statementsExecuted: 0,
      appliedAt: existing.applied_at,
    };
  }

  try {
    await conn.beginTransaction();
    let executedStatements = 0;
    for (const statement of statements) {
      if (await executeCompatStatement(conn, statement)) {
        executedStatements += 1;
      }
    }
    await conn.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum, statements_executed)
       VALUES (?, ?, ?)`,
      [filename, checksum, executedStatements],
    );
    await conn.commit();

    return {
      filename,
      skipped: false,
      statementsExecuted: executedStatements,
    };
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback failures
    }
    throw new Error(`Migration failed for ${filename}: ${error.message}`);
  }
};

export const getSortedMigrationFiles = (migrationsDir) =>
  fs.readdirSync(migrationsDir)
    .filter((entry) => entry.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => path.join(migrationsDir, entry));
