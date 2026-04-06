import genericCardioVideoUrl from '../../assets/intro.mp4';
import {
  inferExerciseVideoBodyPart,
  normalizeExerciseVideoLookup,
  resolveExerciseVideoBodyPart,
  resolveExerciseVideoManifest,
} from '../shared/exerciseVideoManifest.js';

type ExerciseVideoLookupInput = {
  name?: string | null;
  muscle?: string | null;
  bodyPart?: string | null;
  targetMuscles?: Array<string | null | undefined> | null;
};

type ExerciseVideoAsset = {
  fileName: string;
  normalizedFileName: string;
  simplifiedFileName: string;
  bodyPart: string;
  folderName: string;
  folderTarget: string;
  url: string;
};

export type ExerciseVideoAssetInfo = {
  fileName: string;
  bodyPart: string;
  folderName: string;
  url: string;
};

export type ExerciseVideoMatch = {
  url: string | null;
  assetName: string | null;
  bodyPart: string | null;
  matchType: 'alias' | 'filename' | 'fallback' | 'none';
};

const DIRECT_VIDEO_OVERRIDES: Record<string, ExerciseVideoMatch> = {
  'liss cardio': {
    url: genericCardioVideoUrl,
    assetName: 'intro.mp4',
    bodyPart: null,
    matchType: 'alias',
  },
};

const videoModules = import.meta.glob('../../assets/Workout/body part/**/*.mp4', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const containsWholePhrase = (text: string, phrase: string) => (
  text === phrase
  || text.startsWith(`${phrase} `)
  || text.endsWith(` ${phrase}`)
  || text.includes(` ${phrase} `)
);

const REMOVABLE_LOOKUP_TOKENS = new Set([
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

const tokenizeLookup = (value: string) =>
  String(value || '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const dedupeAdjacentTokens = (tokens: string[]) => {
  const result: string[] = [];
  tokens.forEach((token) => {
    if (result[result.length - 1] === token) return;
    result.push(token);
  });
  return result;
};

const simplifyLookup = (value: string) => {
  const normalized = normalizeExerciseVideoLookup(value);
  const cleanedTokens = dedupeAdjacentTokens(
    tokenizeLookup(normalized).filter((token) => !REMOVABLE_LOOKUP_TOKENS.has(token)),
  );
  return cleanedTokens.join(' ').trim();
};

const inferSpecificVideoTarget = (value: string) => {
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

const resolveInputVideoTarget = ({
  name,
  muscle,
  bodyPart,
  targetMuscles,
}: ExerciseVideoLookupInput) => {
  const normalizedName = normalizeExerciseVideoLookup(name);
  const nameTarget = inferSpecificVideoTarget(String(name || ''));
  const targetMuscleHint = Array.isArray(targetMuscles)
    ? targetMuscles.map((entry) => String(entry || '').trim()).filter(Boolean).join(' ')
    : '';
  const hintTarget =
    inferSpecificVideoTarget(`${targetMuscleHint} ${bodyPart || ''} ${muscle || ''}`)
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

const doesAssetMatchTarget = (
  asset: Pick<ExerciseVideoAsset, 'folderTarget' | 'bodyPart'>,
  target: string,
  broadBodyPart: string,
) => {
  if (target) {
    if (asset.folderTarget) return asset.folderTarget === target;
    if (asset.bodyPart) return asset.bodyPart === broadBodyPart;
  }
  if (broadBodyPart && asset.bodyPart) return asset.bodyPart === broadBodyPart;
  return true;
};

const tokenOverlapRatio = (left: string, right: string) => {
  const leftTokens = [...new Set(tokenizeLookup(left))];
  const rightTokens = [...new Set(tokenizeLookup(right))];
  if (!leftTokens.length || !rightTokens.length) return 0;

  const commonCount = leftTokens.filter((token) => rightTokens.includes(token)).length;
  if (!commonCount) return 0;

  const minLength = Math.min(leftTokens.length, rightTokens.length);
  if (commonCount === 1 && minLength > 1) return 0;

  return commonCount / minLength;
};

const matchesLookup = (exerciseName: string, alias: string) => {
  if (!exerciseName || !alias) return false;
  return (
    containsWholePhrase(exerciseName, alias)
    || containsWholePhrase(alias, exerciseName)
  );
};

const videoAssets: ExerciseVideoAsset[] = Object.entries(videoModules).map(([sourcePath, url]) => {
  const normalizedPath = sourcePath.replace(/\\/g, '/');
  const pathParts = normalizedPath.split('/');
  const fileName = pathParts[pathParts.length - 1] || '';
  const folderName = String(pathParts[pathParts.length - 2] || '').trim();
  const bodyPart = inferExerciseVideoBodyPart(folderName);
  const folderTarget = inferSpecificVideoTarget(folderName);
  return {
    fileName,
    normalizedFileName: normalizeExerciseVideoLookup(fileName),
    simplifiedFileName: simplifyLookup(fileName),
    bodyPart,
    folderName,
    folderTarget,
    url,
  };
});

const findAssetByFileName = (fileName: string) =>
  videoAssets.find((asset) => asset.fileName === fileName) || null;

const toMatch = (
  asset: ExerciseVideoAsset | null,
  matchType: ExerciseVideoMatch['matchType'],
): ExerciseVideoMatch => {
  if (!asset) {
    return {
      url: null,
      assetName: null,
      bodyPart: null,
      matchType: 'none',
    };
  }

  return {
    url: asset.url,
    assetName: asset.fileName,
    bodyPart: asset.bodyPart || null,
    matchType,
  };
};

export const resolveExerciseVideo = ({
  name,
  muscle,
  bodyPart,
  targetMuscles,
}: ExerciseVideoLookupInput): ExerciseVideoMatch => {
  const normalizedName = normalizeExerciseVideoLookup(name);
  const bodyPartKey = resolveExerciseVideoBodyPart({ name, muscle, bodyPart, targetMuscles }) || inferExerciseVideoBodyPart(bodyPart || muscle);
  const specificTarget = resolveInputVideoTarget({ name, muscle, bodyPart, targetMuscles });

  if (!normalizedName) {
    return {
      url: null,
      assetName: null,
      bodyPart: bodyPartKey || null,
      matchType: 'none',
    };
  }

  const directOverride = DIRECT_VIDEO_OVERRIDES[normalizedName];
  if (directOverride) return directOverride;

  const manifestMatch = resolveExerciseVideoManifest({ name, muscle, bodyPart, targetMuscles });
  if (manifestMatch.matchType === 'alias' && manifestMatch.fileName) {
    const aliasAsset = findAssetByFileName(manifestMatch.fileName);
    if (aliasAsset) {
      return toMatch(aliasAsset, 'alias');
    }
  }

  const filenameMatch = videoAssets.find((asset) => {
    if (!doesAssetMatchTarget(asset, specificTarget, bodyPartKey)) return false;
    return matchesLookup(normalizedName, asset.normalizedFileName);
  });
  if (filenameMatch) {
    return toMatch(filenameMatch, 'filename');
  }

  const simplifiedName = simplifyLookup(name || normalizedName);
  if (simplifiedName) {
    const simplifiedPhraseMatch = videoAssets.find((asset) => {
      if (!doesAssetMatchTarget(asset, specificTarget, bodyPartKey)) return false;
      return (
        matchesLookup(simplifiedName, asset.simplifiedFileName)
        || containsWholePhrase(asset.simplifiedFileName, simplifiedName)
      );
    });

    if (simplifiedPhraseMatch) {
      return toMatch(simplifiedPhraseMatch, 'filename');
    }

    const fuzzyCandidates = videoAssets
      .filter((asset) => doesAssetMatchTarget(asset, specificTarget, bodyPartKey))
      .map((asset) => ({
        asset,
        score: tokenOverlapRatio(simplifiedName, asset.simplifiedFileName || asset.normalizedFileName),
      }))
      .filter((entry) => entry.score >= 0.75)
      .sort((left, right) => right.score - left.score);

    if (fuzzyCandidates.length > 0) {
      return toMatch(fuzzyCandidates[0].asset, 'filename');
    }
  }

  if (manifestMatch.matchType === 'fallback' && manifestMatch.fileName) {
    const fallbackAsset = findAssetByFileName(manifestMatch.fileName);
    if (fallbackAsset && doesAssetMatchTarget(fallbackAsset, specificTarget, bodyPartKey)) {
      return toMatch(fallbackAsset, 'fallback');
    }
  }

  return {
    url: null,
    assetName: null,
    bodyPart: bodyPartKey || null,
    matchType: 'none',
  };
};

export const resolveExerciseVideoUrl = (input: ExerciseVideoLookupInput) =>
  resolveExerciseVideo(input).url;

export const listExerciseVideoAssets = (bodyPart?: string | null): ExerciseVideoAssetInfo[] => {
  const bodyPartKey = inferExerciseVideoBodyPart(bodyPart || '');
  return videoAssets
    .filter((asset) => !bodyPartKey || asset.bodyPart === bodyPartKey)
    .map((asset) => ({
      fileName: asset.fileName,
      bodyPart: asset.bodyPart,
      folderName: asset.folderName,
      url: asset.url,
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
};
