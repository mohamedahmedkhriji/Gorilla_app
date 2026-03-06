const hooks = [
  { name: 'frontend', url: process.env.FRONTEND_DEPLOY_HOOK_URL },
  { name: 'backend', url: process.env.BACKEND_DEPLOY_HOOK_URL },
].filter((hook) => Boolean(hook.url));

if (!hooks.length) {
  console.error(
    'No deploy hooks configured. Set FRONTEND_DEPLOY_HOOK_URL and/or BACKEND_DEPLOY_HOOK_URL.',
  );
  process.exit(1);
}

let failed = false;

for (const hook of hooks) {
  try {
    const response = await fetch(hook.url, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    console.log(`[ok] Triggered ${hook.name} deploy hook.`);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] Failed to trigger ${hook.name} deploy hook: ${message}`);
  }
}

if (failed) {
  process.exit(1);
}
