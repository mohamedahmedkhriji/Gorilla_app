import { spawn } from 'node:child_process';

const children = new Set();
let shuttingDown = false;

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

run('server');
run('dev');
