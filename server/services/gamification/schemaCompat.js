/* eslint-env node */

import pool from '../../database.js';

export const ensureColumnExists = async (tableName, columnName, alterSql) => {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName],
  );

  if (!rows.length) {
    await pool.execute(alterSql);
  }
};
