import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const managedLocalDbEnabled = String(process.env.LOCAL_DB_MANAGED || '').trim() === '1';

if (!managedLocalDbEnabled) {
  process.exit(0);
}

const projectRoot = process.cwd();
const isWindows = process.platform === 'win32';

if (!isWindows) {
  console.warn('LOCAL_DB_MANAGED is enabled, but automatic local DB startup is only configured for Windows.');
  process.exit(0);
}

const dbHost = String(process.env.DB_HOST || '127.0.0.1').trim() || '127.0.0.1';
const dbPort = Number(process.env.DB_PORT || 3308);
const dbName = String(process.env.DB_NAME || 'gorella_fitness').trim() || 'gorella_fitness';
const dbUser = String(process.env.DB_USER || 'gorella_app').trim() || 'gorella_app';
const dbPassword = String(process.env.DB_PASSWORD || '').trim();
const localDbRootPassword = String(process.env.LOCAL_DB_ROOT_PASSWORD || '').trim();
const localDbBaseDir = String(process.env.LOCAL_DB_BASEDIR || 'C:\\xampp\\mysql').trim();
const localDbDataDir = path.resolve(
  projectRoot,
  String(process.env.LOCAL_DB_DATA_DIR || '.local/mariadb-data').trim() || '.local/mariadb-data',
);
const localDbStdoutLog = path.resolve(
  projectRoot,
  String(process.env.LOCAL_DB_STDOUT_LOG || '.local/mariadb-stdout.log').trim() || '.local/mariadb-stdout.log',
);
const localDbStderrLog = path.resolve(
  projectRoot,
  String(process.env.LOCAL_DB_STDERR_LOG || '.local/mariadb-stderr.log').trim() || '.local/mariadb-stderr.log',
);
const initSqlPath = path.resolve(projectRoot, 'server', 'init_innodb.sql');

const mysqlInstallDbPath = path.join(localDbBaseDir, 'bin', 'mysql_install_db.exe');
const mysqlClientPath = path.join(localDbBaseDir, 'bin', 'mysql.exe');
const mysqldPath = path.join(localDbBaseDir, 'bin', 'mysqld.exe');

const runCommand = (filePath, args, { input, allowFailure = false, timeout = 120_000 } = {}) => {
  const result = spawnSync(filePath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    input,
    timeout,
    env: process.env,
  });

  if (!allowFailure && result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(details || `Command failed: ${filePath} ${args.join(' ')}`);
  }

  return result;
};

const canQueryAsAppUser = () => {
  const result = runCommand(
    mysqlClientPath,
    [
      '--connect-timeout=5',
      '--protocol=TCP',
      '-h',
      dbHost,
      '-P',
      String(dbPort),
      '-u',
      dbUser,
      `-p${dbPassword}`,
      '-e',
      'SELECT 1;',
    ],
    { allowFailure: true, timeout: 15_000 },
  );

  return result.status === 0;
};

const canQueryAsRootUser = () => {
  const result = runCommand(
    mysqlClientPath,
    [
      '--connect-timeout=5',
      '--protocol=TCP',
      '-h',
      dbHost,
      '-P',
      String(dbPort),
      '-u',
      'root',
      `-p${localDbRootPassword}`,
      '-e',
      'SELECT 1;',
    ],
    { allowFailure: true, timeout: 15_000 },
  );

  return result.status === 0;
};

const ensureBinaryExists = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} was not found at ${filePath}.`);
  }
};

const ensureDirectories = () => {
  fs.mkdirSync(path.dirname(localDbStdoutLog), { recursive: true });
  fs.mkdirSync(path.dirname(localDbStderrLog), { recursive: true });
  fs.mkdirSync(localDbDataDir, { recursive: true });
};

const isDataDirectoryInitialized = () => {
  const mysqlSystemDir = path.join(localDbDataDir, 'mysql');
  return fs.existsSync(path.join(mysqlSystemDir, 'global_priv.frm'))
    || fs.existsSync(path.join(mysqlSystemDir, 'db.frm'));
};

const initializeDataDirectory = () => {
  runCommand(mysqlInstallDbPath, [
    `--datadir=${localDbDataDir}`,
    `--password=${localDbRootPassword}`,
    `--port=${dbPort}`,
    '--silent',
  ]);
};

const startManagedDb = () => {
  const child = spawn(
    mysqldPath,
    [
      `--datadir=${localDbDataDir}`,
      `--port=${dbPort}`,
      '--bind-address=127.0.0.1',
      '--console',
    ],
    {
      cwd: projectRoot,
      detached: true,
      stdio: ['ignore', fs.openSync(localDbStdoutLog, 'a'), fs.openSync(localDbStderrLog, 'a')],
      env: process.env,
    },
  );

  child.unref();
};

const waitUntilReady = (predicate, label, timeoutMs = 45_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
  }

  throw new Error(`${label} did not become ready within ${Math.ceil(timeoutMs / 1000)} seconds.`);
};

const bootstrapDatabase = () => {
  const bootstrapSql = [
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}';`,
    `CREATE USER IF NOT EXISTS '${dbUser}'@'127.0.0.1' IDENTIFIED BY '${dbPassword}';`,
    `ALTER USER '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}';`,
    `ALTER USER '${dbUser}'@'127.0.0.1' IDENTIFIED BY '${dbPassword}';`,
    `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost';`,
    `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'127.0.0.1';`,
    'FLUSH PRIVILEGES;',
  ].join('\n');

  runCommand(
    mysqlClientPath,
    [
      '--protocol=TCP',
      '-h',
      dbHost,
      '-P',
      String(dbPort),
      '-u',
      'root',
      `-p${localDbRootPassword}`,
    ],
    { input: bootstrapSql },
  );
};

const schemaHasUsersTable = () => {
  const result = runCommand(
    mysqlClientPath,
    [
      '--batch',
      '--skip-column-names',
      '--protocol=TCP',
      '-h',
      dbHost,
      '-P',
      String(dbPort),
      '-u',
      dbUser,
      `-p${dbPassword}`,
      '-e',
      `SHOW TABLES IN \`${dbName}\` LIKE 'users';`,
    ],
    { allowFailure: true },
  );

  return result.status === 0 && String(result.stdout || '').trim() === 'users';
};

const importBaseSchema = () => {
  const initSql = fs.readFileSync(initSqlPath, 'utf8');
  runCommand(
    mysqlClientPath,
    [
      '--protocol=TCP',
      '-h',
      dbHost,
      '-P',
      String(dbPort),
      '-u',
      'root',
      `-p${localDbRootPassword}`,
    ],
    { input: initSql, timeout: 180_000 },
  );
};

const main = () => {
  if (!dbPassword) {
    throw new Error('LOCAL_DB_MANAGED requires DB_PASSWORD to be set.');
  }

  if (!localDbRootPassword) {
    throw new Error('LOCAL_DB_MANAGED requires LOCAL_DB_ROOT_PASSWORD to be set.');
  }

  ensureBinaryExists(mysqlInstallDbPath, 'mysql_install_db.exe');
  ensureBinaryExists(mysqlClientPath, 'mysql.exe');
  ensureBinaryExists(mysqldPath, 'mysqld.exe');
  ensureDirectories();

  if (!isDataDirectoryInitialized()) {
    initializeDataDirectory();
  }

  if (!canQueryAsRootUser() && !canQueryAsAppUser()) {
    startManagedDb();
    waitUntilReady(canQueryAsRootUser, 'Managed local MariaDB');
  }

  bootstrapDatabase();

  if (!schemaHasUsersTable()) {
    importBaseSchema();
  }
};

try {
  main();
} catch (error) {
  console.error(`Failed to ensure managed local DB: ${error?.message || error}`);
  process.exit(1);
}
