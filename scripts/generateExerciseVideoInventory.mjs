import fs from 'node:fs';
import path from 'node:path';
import {
  inferExerciseVideoBodyPart,
  normalizeExerciseVideoLookup,
  resolveExerciseVideoBodyPart,
  resolveExerciseVideoManifest,
} from '../src/shared/exerciseVideoManifest.js';

const root = process.cwd();
const datasetPath = path.join(root, 'dataset', 'gym_exercise_dataset.csv');
const assetsRoot = path.join(root, 'assets', 'Workout', 'body part');
const reportPath = path.join(root, 'reports', 'all_missing_videos_list.md');

const parseCsv = (input) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

const clean = (value) => String(value || '')
  .replace(/Â°/g, '°')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s+:/g, ':')
  .replace(/:\s+/g, ': ')
  .trim();

const title = (value) => clean(value).replace(/\b\w/g, (char) => char.toUpperCase());

const walk = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (/\.mp4$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
};

const removableLookupTokens = new Set([
  'single',
  'double',
  'one',
  'two',
  'left',
  'right',
  'unilateral',
  'alternating',
  'alt',
  'arms',
  'arm',
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'smith',
  'rope',
  'bfr',
]);

const tokenizeLookup = (value) => String(value || '')
  .split(/\s+/)
  .map((token) => token.trim())
  .filter(Boolean);

const dedupeAdjacentTokens = (tokens) => {
  const result = [];
  tokens.forEach((token) => {
    if (result[result.length - 1] !== token) result.push(token);
  });
  return result;
};

const simplifyLookup = (value) => dedupeAdjacentTokens(
  tokenizeLookup(normalizeExerciseVideoLookup(value))
    .filter((token) => !removableLookupTokens.has(token)),
).join(' ').trim();

const inferSpecificVideoTarget = (value) => {
  const text = normalizeExerciseVideoLookup(value);
  if (!text) return '';
  if (/(leg curl|lying curl|seated curl|hamstring curl|fst 7 curl|fst7 curl)/.test(text)) return 'legs';
  if (/(romanian deadlift|rdl|stiff leg deadlift)/.test(text)) return 'legs';
  if (/(bicep|biceps|\bcurl\b|preacher|scott|hammer curl|incline curl)/.test(text)) return 'biceps';
  if (/(tricep|triceps|push down|press down|kick back|skull crusher|overhead extension|rope pushdown|french press)/.test(text)) return 'triceps';
  if (/(calf|calves)/.test(text)) return 'calves';
  if (/(abs|abdom|core|oblique|crunch|sit up|leg raise|leg lift|knee raise|plank|twist|vacuum|hollow|v up|vup|dead bug)/.test(text)) return 'abs';
  if (/(shoulder|delt|delts|arnold press|lateral raise|(?:^| )lateral(?: |$)|front raise|rear delt|face pull|shoulder press|overhead press|seated dumbbell press|seated shoulder press)/.test(` ${text} `)) return 'shoulders';
  if (/(back|\blat\b|\blats\b|trap|traps|rhomboid|erector|pulldown|pull up|pullup|chin up|chinup|row|deadlift|shrug|pullover|rack pull)/.test(text)) return 'back';
  if (/(chest|pector|\bpec\b|bench press|chest press|incline press|push up|pushup|fly|crossovers|pec deck|guillotine press|dip|hammer strength press|machine press)/.test(text)) return 'chest';
  if (/(leg press|leg extension|leg curl|leg|quad|quadricep|hamstring|glute|thigh|squat|lunge|hip thrust|split squat|calf raise)/.test(text)) return 'legs';
  return '';
};

const resolveInputVideoTarget = ({ name, muscle, bodyPart }) => {
  const normalizedName = normalizeExerciseVideoLookup(name);
  const nameTarget = inferSpecificVideoTarget(String(name || ''));
  const hintTarget =
    inferSpecificVideoTarget(`${bodyPart || ''} ${muscle || ''}`)
    || inferSpecificVideoTarget(String(muscle || ''))
    || inferSpecificVideoTarget(String(bodyPart || ''));

  if (hintTarget) {
    if (!nameTarget || nameTarget === hintTarget) return hintTarget;
    if (
      hintTarget === 'legs'
      && /(seated curl|lying curl|leg curl|hamstring curl|fst 7 curl|fst7 curl|romanian deadlift|rdl|stiff leg deadlift|deadlift)/.test(normalizedName)
    ) {
      return hintTarget;
    }
    if (!['biceps', 'triceps'].includes(hintTarget) && ['biceps', 'triceps'].includes(nameTarget)) {
      return hintTarget;
    }
  }

  return nameTarget || hintTarget;
};

const containsWholePhrase = (text, phrase) => (
  text === phrase
  || text.startsWith(`${phrase} `)
  || text.endsWith(` ${phrase}`)
  || text.includes(` ${phrase} `)
);

const matchesLookup = (exerciseName, alias) => {
  if (!exerciseName || !alias) return false;
  return containsWholePhrase(exerciseName, alias) || containsWholePhrase(alias, exerciseName);
};

const doesAssetMatchTarget = (asset, target, broadBodyPart) => {
  if (target) {
    if (asset.folderTarget) return asset.folderTarget === target;
    if (asset.bodyPart) return asset.bodyPart === broadBodyPart;
  }
  if (broadBodyPart && asset.bodyPart) return asset.bodyPart === broadBodyPart;
  return true;
};

const tokenOverlapRatio = (left, right) => {
  const leftTokens = [...new Set(tokenizeLookup(left))];
  const rightTokens = [...new Set(tokenizeLookup(right))];
  if (!leftTokens.length || !rightTokens.length) return 0;
  const commonCount = leftTokens.filter((token) => rightTokens.includes(token)).length;
  if (!commonCount) return 0;
  const minLength = Math.min(leftTokens.length, rightTokens.length);
  if (commonCount === 1 && minLength > 1) return 0;
  return commonCount / minLength;
};

const videoAssets = walk(assetsRoot).map((filePath) => {
  const fileName = path.basename(filePath);
  const folderName = path.basename(path.dirname(filePath));
  return {
    fileName,
    displayName: clean(fileName.replace(/\.mp4$/i, '')),
    folderName,
    bodyPart: inferExerciseVideoBodyPart(folderName),
    folderTarget: inferSpecificVideoTarget(folderName),
    normalizedFileName: normalizeExerciseVideoLookup(fileName),
    simplifiedFileName: simplifyLookup(fileName),
  };
});

const findAssetByFileName = (fileName) => videoAssets.find((asset) => asset.fileName === fileName) || null;

const resolveExerciseVideoAsset = ({ name, muscle, bodyPart }) => {
  const normalizedName = normalizeExerciseVideoLookup(name);
  const bodyPartKey = resolveExerciseVideoBodyPart({ name, muscle, bodyPart }) || inferExerciseVideoBodyPart(bodyPart || muscle);
  const specificTarget = resolveInputVideoTarget({ name, muscle, bodyPart });

  if (!normalizedName) return null;

  const manifestMatch = resolveExerciseVideoManifest({ name, muscle, bodyPart });
  if (manifestMatch.matchType === 'alias' && manifestMatch.fileName) {
    const aliasAsset = findAssetByFileName(manifestMatch.fileName);
    if (aliasAsset) return aliasAsset;
  }

  const filenameMatch = videoAssets.find((asset) => (
    doesAssetMatchTarget(asset, specificTarget, bodyPartKey)
    && matchesLookup(normalizedName, asset.normalizedFileName)
  ));
  if (filenameMatch) return filenameMatch;

  const simplifiedName = simplifyLookup(name || normalizedName);
  if (simplifiedName) {
    const simplifiedPhraseMatch = videoAssets.find((asset) => (
      doesAssetMatchTarget(asset, specificTarget, bodyPartKey)
      && (
        matchesLookup(simplifiedName, asset.simplifiedFileName)
        || containsWholePhrase(asset.simplifiedFileName, simplifiedName)
      )
    ));
    if (simplifiedPhraseMatch) return simplifiedPhraseMatch;

    const fuzzyCandidates = videoAssets
      .filter((asset) => doesAssetMatchTarget(asset, specificTarget, bodyPartKey))
      .map((asset) => ({
        asset,
        score: tokenOverlapRatio(simplifiedName, asset.simplifiedFileName || asset.normalizedFileName),
      }))
      .filter((entry) => entry.score >= 0.75)
      .sort((left, right) => right.score - left.score);

    if (fuzzyCandidates.length > 0) return fuzzyCandidates[0].asset;
  }

  if (manifestMatch.matchType === 'fallback' && manifestMatch.fileName) {
    const fallbackAsset = findAssetByFileName(manifestMatch.fileName);
    if (fallbackAsset && doesAssetMatchTarget(fallbackAsset, specificTarget, bodyPartKey)) {
      return fallbackAsset;
    }
  }

  return null;
};

const rows = parseCsv(fs.readFileSync(datasetPath, 'utf8'));
const header = rows.shift();
const nameIndex = header.indexOf('Exercise Name');
const muscleIndex = header.indexOf('Main_muscle');

const exercisesByKey = new Map();
for (const row of rows) {
  const name = clean(row[nameIndex]);
  const muscle = clean(row[muscleIndex]);
  if (!name) continue;
  const key = `${normalizeExerciseVideoLookup(name)}|${normalizeExerciseVideoLookup(muscle)}`;
  if (!exercisesByKey.has(key)) {
    exercisesByKey.set(key, { name, muscle });
  }
}

const withVideos = [];
const missingVideos = [];

for (const exercise of exercisesByKey.values()) {
  const bodyPart = resolveExerciseVideoBodyPart({
    name: exercise.name,
    muscle: exercise.muscle,
    bodyPart: exercise.muscle,
  }) || 'other';
  const asset = resolveExerciseVideoAsset({
    name: exercise.name,
    muscle: exercise.muscle,
    bodyPart: exercise.muscle,
  });

  const item = { ...exercise, bodyPart, asset };
  if (asset) withVideos.push(item);
  else missingVideos.push(item);
}

const groupItems = (items) => {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.bodyPart)) groups.set(item.bodyPart, []);
    groups.get(item.bodyPart).push(item);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => left.name.localeCompare(right.name));
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
};

const assetGroups = new Map();
for (const asset of videoAssets) {
  if (!assetGroups.has(asset.folderName)) assetGroups.set(asset.folderName, []);
  assetGroups.get(asset.folderName).push(asset);
}
for (const group of assetGroups.values()) {
  group.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

const lines = [];
lines.push('# Exercise Video Inventory');
lines.push('');
lines.push('- Dataset source: `dataset/gym_exercise_dataset.csv`');
lines.push(`- Dataset exercise names: ${exercisesByKey.size}`);
lines.push(`- Dataset exercises with video already available: ${withVideos.length}`);
lines.push(`- Dataset exercises still to add: ${missingVideos.length}`);
lines.push(`- Uploaded app video files: ${videoAssets.length}`);
lines.push('- Updated: 2026-09-18');
lines.push('');
lines.push('`Already available` lists dataset exercise names that resolve to a video in the app. `Still to add` lists dataset exercise names that do not currently resolve to a video. The uploaded asset list is included at the end as a raw file reference.');
lines.push('');
lines.push(`## Already Available In App (${withVideos.length})`);

for (const [bodyPart, group] of groupItems(withVideos)) {
  lines.push('');
  lines.push(`### ${title(bodyPart)} (${group.length})`);
  lines.push('');
  for (const item of group) {
    lines.push(`- ${item.name} (${item.muscle}) -> ${item.asset.displayName}`);
  }
}

lines.push('');
lines.push(`## Still To Add (${missingVideos.length})`);

for (const [bodyPart, group] of groupItems(missingVideos)) {
  lines.push('');
  lines.push(`### ${title(bodyPart)} (${group.length})`);
  lines.push('');
  for (const item of group) {
    lines.push(`- ${item.name} (${item.muscle})`);
  }
}

lines.push('');
lines.push(`## Uploaded Video Files (${videoAssets.length})`);

for (const [folder, group] of [...assetGroups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  lines.push('');
  lines.push(`### ${title(folder)} (${group.length})`);
  lines.push('');
  for (const item of group) {
    lines.push(`- ${item.displayName}`);
  }
}

lines.push('');

fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');

console.log(`Dataset exercise names: ${exercisesByKey.size}`);
console.log(`Already available: ${withVideos.length}`);
console.log(`Still to add: ${missingVideos.length}`);
console.log(`Uploaded video files: ${videoAssets.length}`);
