import { spawn, spawnSync } from 'node:child_process';

const children = new Set();
let shuttingDown = false;
const backendPort = Number(process.env.PORT || 5001);

const releaseBackendPort = () => {
  if (!Number.isInteger(backendPort) || backendPort <= 0) return;

  if (process.platform === 'win32') {
    const result = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: process.env,
    });

    const output = String(result.stdout || '');
    const pidPattern = new RegExp(`:${backendPort}\\s+.*LISTENING\\s+(\\d+)$`, 'i');
    const pids = [...new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.match(pidPattern)?.[1] || null)
        .filter(Boolean),
    )];

    for (const pid of pids) {
      spawnSync('taskkill', ['/F', '/PID', pid], {
        cwd: process.cwd(),
        stdio: 'ignore',
        env: process.env,
      });
    }
    return;
  }

  spawnSync(
    'sh',
    ['-lc', `lsof -ti tcp:${backendPort} | xargs -r kill -9`],
    {
      cwd: process.cwd(),
      stdio: 'ignore',
      env: process.env,
    },
  );
};

const stopChildren = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(code), 150);
};

const run = (script) => {
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `npm run ${script}`], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
      })
    : spawn('npm', ['run', script], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
      });

  children.add(child);

  child.on('exit', (code, signal) => {
    children.delete(child);

    if (shuttingDown) return;
    if (signal) {
      stopChildren(1);
      return;
    }

    if (typeof code === 'number' && code !== 0) {
      stopChildren(code);
      return;
    }

    if (children.size === 0) {
      process.exit(code ?? 0);
    }
  });

  child.on('error', () => {
    stopChildren(1);
  });
};

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));

releaseBackendPort();
run('dev:server');
run('dev');
