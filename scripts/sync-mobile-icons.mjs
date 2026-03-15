import { access, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const fileMappings = [
  ['repset_logo.png', 'ic_launcher.png'],
  ['repset_logo_round.png', 'ic_launcher_round.png'],
  ['repset_logo_foreground.png', 'ic_launcher_foreground.png'],
];

const pathExists = async (targetPath) => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const copyPath = async (source, destination) => {
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { force: true });
};

const syncAndroidIcons = async () => {
  const sourceBase = path.join(root, 'assets', 'logo', 'android');
  const targetBase = path.join(root, 'android', 'app', 'src', 'main', 'res');
  const densities = ['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

  for (const density of densities) {
    for (const [sourceName, targetName] of fileMappings) {
      const source = path.join(sourceBase, `mipmap-${density}`, sourceName);
      const destination = path.join(targetBase, `mipmap-${density}`, targetName);
      const exists = await pathExists(source);
      if (!exists) {
        if (sourceName === 'repset_logo_foreground.png') {
          console.log(`[skip] Missing optional foreground icon: mipmap-${density}/${sourceName}`);
          continue;
        }
        throw new Error(`Missing required Android icon file: ${source}`);
      }
      await copyPath(source, destination);
    }
  }

  await copyPath(
    path.join(sourceBase, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
    path.join(targetBase, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
  );
  await copyPath(
    path.join(sourceBase, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'),
    path.join(targetBase, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'),
  );
  await copyPath(
    path.join(sourceBase, 'values', 'ic_launcher_background.xml'),
    path.join(targetBase, 'values', 'ic_launcher_background.xml'),
  );

  console.log('[ok] Android launcher icons synced.');
};

const syncIosIcons = async () => {
  const sourceIconSet = path.join(root, 'assets', 'logo', 'ios', 'AppIcon.appiconset');
  const targetIconSet = path.join(
    root,
    'ios',
    'App',
    'App',
    'Assets.xcassets',
    'AppIcon.appiconset',
  );
  const iosProjectDir = path.join(root, 'ios');
  const hasIosProject = await pathExists(iosProjectDir);
  if (!hasIosProject) {
    console.log('[skip] iOS platform not found. Run: npx cap add ios');
    return;
  }

  const hasSourceIcons = await pathExists(sourceIconSet);
  if (!hasSourceIcons) {
    throw new Error(`Missing iOS source icon set: ${sourceIconSet}`);
  }

  await cp(sourceIconSet, targetIconSet, { recursive: true, force: true });
  console.log('[ok] iOS app icons synced.');
};

await syncAndroidIcons();
await syncIosIcons();
