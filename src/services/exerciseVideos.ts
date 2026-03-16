import {
  inferExerciseVideoBodyPart,
  normalizeExerciseVideoLookup,
  resolveExerciseVideoManifest,
} from '../shared/exerciseVideoManifest.js';

type ExerciseVideoLookupInput = {
  name?: string | null;
  muscle?: string | null;
  bodyPart?: string | null;
};

type ExerciseVideoAsset = {
  fileName: string;
  normalizedFileName: string;
  simplifiedFileName: string;
  bodyPart: string;
  folderName: string;
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
  return {
    fileName,
    normalizedFileName: normalizeExerciseVideoLookup(fileName),
    simplifiedFileName: simplifyLookup(fileName),
    bodyPart,
    folderName,
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
}: ExerciseVideoLookupInput): ExerciseVideoMatch => {
  const normalizedName = normalizeExerciseVideoLookup(name);
  const bodyPartKey = inferExerciseVideoBodyPart(bodyPart || muscle);

  if (!normalizedName) {
    return {
      url: null,
      assetName: null,
      bodyPart: bodyPartKey || null,
      matchType: 'none',
    };
  }

  const manifestMatch = resolveExerciseVideoManifest({ name, muscle, bodyPart });
  if (manifestMatch.matchType === 'alias' && manifestMatch.fileName) {
    return toMatch(findAssetByFileName(manifestMatch.fileName), 'alias');
  }

  const filenameMatch = videoAssets.find((asset) => {
    if (bodyPartKey && asset.bodyPart && asset.bodyPart !== bodyPartKey) return false;
    return matchesLookup(normalizedName, asset.normalizedFileName);
  });
  if (filenameMatch) {
    return toMatch(filenameMatch, 'filename');
  }

  const simplifiedName = simplifyLookup(name || normalizedName);
  if (simplifiedName) {
    const simplifiedPhraseMatch = videoAssets.find((asset) => {
      if (bodyPartKey && asset.bodyPart && asset.bodyPart !== bodyPartKey) return false;
      return (
        matchesLookup(simplifiedName, asset.simplifiedFileName)
        || containsWholePhrase(asset.simplifiedFileName, simplifiedName)
      );
    });

    if (simplifiedPhraseMatch) {
      return toMatch(simplifiedPhraseMatch, 'filename');
    }

    const fuzzyCandidates = videoAssets
      .filter((asset) => !bodyPartKey || !asset.bodyPart || asset.bodyPart === bodyPartKey)
      .map((asset) => ({
        asset,
        score: tokenOverlapRatio(simplifiedName, asset.simplifiedFileName || asset.normalizedFileName),
      }))
      .filter((entry) => entry.score >= 0.5)
      .sort((left, right) => right.score - left.score);

    if (fuzzyCandidates.length > 0) {
      return toMatch(fuzzyCandidates[0].asset, 'filename');
    }
  }

  if (manifestMatch.matchType === 'fallback' && manifestMatch.fileName) {
    return toMatch(findAssetByFileName(manifestMatch.fileName), 'fallback');
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
