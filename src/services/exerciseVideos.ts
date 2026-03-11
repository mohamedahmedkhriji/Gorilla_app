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
