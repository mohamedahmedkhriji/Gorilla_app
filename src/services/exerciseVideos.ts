import genericCardioVideoUrl from '../../assets/intro.mp4';
import cardioManVideoUrl from '../../assets/Workout/body part/cardio/cardio man.mp4';
import cardioWomanVideoUrl from '../../assets/Workout/body part/cardio/cardio woman.mp4';
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
  primaryMedia?: ExerciseRemoteMedia | null;
  media?: ExerciseRemoteMedia[] | null;
  preferredAudience?: string | null;
};

export type ExerciseRemoteMedia = {
  id?: number | string | null;
  mediaType?: 'gif' | 'video' | 'image' | string | null;
  audience?: string | null;
  url?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  accessLevel?: string | null;
  sortOrder?: number | null;
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
  mediaType: 'gif' | 'video' | 'image' | null;
  remoteMedia: ExerciseRemoteMedia | null;
};

const DIRECT_VIDEO_OVERRIDES: Record<string, ExerciseVideoMatch> = {
  'liss cardio': {
    url: genericCardioVideoUrl,
    assetName: 'intro.mp4',
    bodyPart: null,
    matchType: 'alias',
    mediaType: 'video',
    remoteMedia: null,
  },
  'burpee broad jumps': {
    url: 'https://lubnxnffvdnconouixzm.supabase.co/storage/v1/object/public/exercise-previews/video/Hyrox/Burpee%20broad%20jumps%20male.gif',
    assetName: 'Hyrox/Burpee broad jumps male.gif',
    bodyPart: null,
    matchType: 'alias',
    mediaType: 'gif',
    remoteMedia: null,
  },
  'farmer carry': {
    url: 'https://lubnxnffvdnconouixzm.supabase.co/storage/v1/object/public/exercise-previews/video/Hyrox/farmer%20carry%20male.gif',
    assetName: 'Hyrox/farmer carry male.gif',
    bodyPart: null,
    matchType: 'alias',
    mediaType: 'gif',
    remoteMedia: null,
  },
  'sandbag lunges': {
    url: 'https://lubnxnffvdnconouixzm.supabase.co/storage/v1/object/public/exercise-previews/video/Hyrox/Sandbag%20lunges%20male.webp',
    assetName: 'Hyrox/Sandbag lunges male.webp',
    bodyPart: null,
    matchType: 'alias',
    mediaType: 'image',
    remoteMedia: null,
  },
  skierg: {
    url: 'https://lubnxnffvdnconouixzm.supabase.co/storage/v1/object/public/exercise-previews/video/Hyrox/SkiErg.gif',
    assetName: 'Hyrox/SkiErg.gif',
    bodyPart: null,
    matchType: 'alias',
    mediaType: 'gif',
    remoteMedia: null,
  },
  'sled pull light': {
    url: 'https://lubnxnffvdnconouixzm.supabase.co/storage/v1/object/public/exercise-previews/video/Hyrox/Sled%20pull%20light%20male.gif',
    assetName: 'Hyrox/Sled pull light male.gif',
    bodyPart: null,
    matchType: 'alias',
    mediaType: 'gif',
    remoteMedia: null,
  },
  'sled push light': {
    url: 'https://lubnxnffvdnconouixzm.supabase.co/storage/v1/object/public/exercise-previews/video/Hyrox/Sled%20push%20light%20male.gif',
    assetName: 'Hyrox/Sled push light male.gif',
    bodyPart: null,
    matchType: 'alias',
    mediaType: 'gif',
    remoteMedia: null,
  },
  'wall balls': {
    url: 'https://lubnxnffvdnconouixzm.supabase.co/storage/v1/object/public/exercise-previews/video/Hyrox/Wall%20balls%20male.gif',
    assetName: 'Hyrox/Wall balls male.gif',
    bodyPart: null,
    matchType: 'alias',
    mediaType: 'gif',
    remoteMedia: null,
  },
};

const stripMediaAudienceSuffix = (value: string) =>
  value.replace(/\s+(male|man|men|female|woman|women|girl|girls)$/i, '').trim();

const singularizeLookupPhrase = (value: string) =>
  value
    .split(' ')
    .map((token) => {
      if (token.length <= 3 || !token.endsWith('s')) return token;
      if (/(ss|us|is)$/.test(token)) return token;
      return token.slice(0, -1);
    })
    .join(' ')
    .trim();

const resolveDirectVideoOverride = (normalizedName: string) => {
  const withoutAudience = stripMediaAudienceSuffix(normalizedName);
  const candidates = [
    normalizedName,
    withoutAudience,
    singularizeLookupPhrase(normalizedName),
    singularizeLookupPhrase(withoutAudience),
  ];

  return candidates.map((key) => DIRECT_VIDEO_OVERRIDES[key]).find(Boolean) || null;
};

const getPreferredCardioVideoUrl = (preferredAudience?: string | null) => (
  normalizeMediaAudience(preferredAudience) === 'female' ? cardioWomanVideoUrl : cardioManVideoUrl
);

const videoModules = import.meta.glob('../../assets/Workout/body part/**/*.mp4', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const categoryVideoModules = import.meta.glob('../../assets/Workout/annanc/**/*.mp4', {
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

const categoryVideoAssets = Object.entries(categoryVideoModules).map(([sourcePath, url]) => {
  const normalizedPath = sourcePath.replace(/\\/g, '/');
  const pathParts = normalizedPath.split('/');
  const fileName = pathParts[pathParts.length - 1] || '';
  const baseName = fileName.replace(/\.[^.]+$/, '');
  return {
    fileName,
    bodyPart: inferExerciseVideoBodyPart(baseName),
    normalizedName: normalizeExerciseVideoLookup(baseName),
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
      mediaType: null,
      remoteMedia: null,
    };
  }

  return {
    url: asset.url,
    assetName: asset.fileName,
    bodyPart: asset.bodyPart || null,
    matchType,
    mediaType: 'video',
    remoteMedia: null,
  };
};

const normalizeRemoteMediaType = (value: unknown): ExerciseVideoMatch['mediaType'] => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'gif' || key === 'video' || key === 'image') return key;
  return null;
};

const normalizeMediaAudience = (value: unknown) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'woman' || key === 'women' || key === 'female' || key === 'girl' || key === 'girls' || key === 'f') return 'female';
  if (key === 'man' || key === 'men' || key === 'male' || key === 'boy' || key === 'boys' || key === 'm') return 'male';
  if (key === 'unisex' || key === 'all' || key === 'both') return 'unisex';
  return '';
};

const remoteMediaPriority = (media: ExerciseRemoteMedia, preferredAudience?: string | null) => {
  const audience = normalizeMediaAudience(preferredAudience);
  const mediaAudience = normalizeMediaAudience(media?.audience) || 'unisex';

  if (audience === 'female') {
    if (mediaAudience === 'female') return 0;
    if (mediaAudience === 'unisex') return 1;
    if (mediaAudience === 'male') return 2;
    return 3;
  }

  if (audience === 'male') {
    if (mediaAudience === 'male') return 0;
    if (mediaAudience === 'unisex') return 1;
    if (mediaAudience === 'female') return 2;
    return 3;
  }

  if (mediaAudience === 'unisex') return 0;
  return 1;
};

const compareRemoteMedia = (left: ExerciseRemoteMedia, right: ExerciseRemoteMedia) => (
  (Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
  || (Number(left.id || 0) - Number(right.id || 0))
);

const resolveRemoteMedia = (
  primaryMedia?: ExerciseRemoteMedia | null,
  media?: ExerciseRemoteMedia[] | null,
  preferredAudience?: string | null,
) => {
  const candidates = [
    primaryMedia,
    ...(Array.isArray(media) ? media : []),
  ].filter(Boolean) as ExerciseRemoteMedia[];
  const remote = candidates
    .filter((entry) => String(entry?.url || '').trim())
    .sort((left, right) => (
      remoteMediaPriority(left, preferredAudience) - remoteMediaPriority(right, preferredAudience)
      || compareRemoteMedia(left, right)
    ))[0];
  if (!remote) return null;
  return {
    url: String(remote.url || '').trim(),
    mediaType: normalizeRemoteMediaType(remote.mediaType) || 'video',
    remoteMedia: remote,
  };
};

const makeCardioMatch = (preferredAudience?: string | null): ExerciseVideoMatch => ({
  url: getPreferredCardioVideoUrl(preferredAudience),
  assetName: normalizeMediaAudience(preferredAudience) === 'female' ? 'cardio woman.mp4' : 'cardio man.mp4',
  bodyPart: 'cardio',
  matchType: 'alias',
  mediaType: 'video',
  remoteMedia: null,
});

const makeLocalAliasMatch = (fileName: string): ExerciseVideoMatch | null => {
  const asset = findAssetByFileName(fileName);
  return asset ? toMatch(asset, 'alias') : null;
};

const resolveHyroxPlanFallback = (
  normalizedName: string,
  preferredAudience?: string | null,
): ExerciseVideoMatch | null => {
  if (!normalizedName) return null;

  if (/\b(run|running|stride|strides|endurance|cooldown|warm up|warm-up)\b|run\/walk|easy walk/.test(normalizedName)) {
    return makeCardioMatch(preferredAudience);
  }

  if (/skierg/.test(normalizedName)) {
    return DIRECT_VIDEO_OVERRIDES.skierg;
  }

  if (/sled/.test(normalizedName)) {
    if (/pull/.test(normalizedName) && !/push/.test(normalizedName)) return DIRECT_VIDEO_OVERRIDES['sled pull light'];
    return DIRECT_VIDEO_OVERRIDES['sled push light'];
  }

  if (/farmer|loaded carry/.test(normalizedName)) return DIRECT_VIDEO_OVERRIDES['farmer carry'];
  if (/burpee broad jump/.test(normalizedName)) return DIRECT_VIDEO_OVERRIDES['burpee broad jumps'];
  if (/sandbag lunge/.test(normalizedName)) return DIRECT_VIDEO_OVERRIDES['sandbag lunges'];
  if (/wall ball/.test(normalizedName)) return DIRECT_VIDEO_OVERRIDES['wall balls'];

  if (/goblet|front squat|back squat|squat pattern|light squat/.test(normalizedName)) {
    return makeLocalAliasMatch('Goblet Squat QUADS.mp4') || makeLocalAliasMatch('Barbell Back Squat.mp4');
  }

  if (/romanian deadlift|deadlift|hinge/.test(normalizedName)) {
    return makeLocalAliasMatch('romanian deadlift.mp4') || makeLocalAliasMatch('Deadlift .mp4');
  }

  if (/bench press|db press|upper push|push up|push-up/.test(normalizedName)) {
    return makeLocalAliasMatch('Bench Press.mp4') || makeLocalAliasMatch('Push-up (Chest).mp4');
  }

  if (/upper pull|pull or row|seated row|cable row|lat pulldown|row variation/.test(normalizedName)) {
    return makeLocalAliasMatch('Cable Back Row 1.mp4') || makeLocalAliasMatch('Front Pulldown (Back).mp4');
  }

  if (/walking lunge|reverse lunge|step up|step-up/.test(normalizedName)) {
    return makeLocalAliasMatch('WALKING LUNGE.mp4') || makeLocalAliasMatch('step up.mp4');
  }

  if (/plank|dead bug/.test(normalizedName)) {
    return makeLocalAliasMatch('Plank .mp4');
  }

  if (normalizedName === 'row' || /ski ?erg or row/.test(normalizedName)) {
    return DIRECT_VIDEO_OVERRIDES.skierg;
  }

  return null;
};

export const resolveExerciseVideo = ({
  name,
  muscle,
  bodyPart,
  targetMuscles,
  primaryMedia,
  media,
  preferredAudience,
}: ExerciseVideoLookupInput): ExerciseVideoMatch => {
  const remoteMedia = resolveRemoteMedia(primaryMedia, media, preferredAudience);
  if (remoteMedia) {
    return {
      url: remoteMedia.url,
      assetName: String(remoteMedia.remoteMedia.storagePath || remoteMedia.remoteMedia.id || '').trim() || null,
      bodyPart: null,
      matchType: 'alias',
      mediaType: remoteMedia.mediaType,
      remoteMedia: remoteMedia.remoteMedia,
    };
  }

  const normalizedName = normalizeExerciseVideoLookup(name);
  const bodyPartKey = resolveExerciseVideoBodyPart({ name, muscle, bodyPart, targetMuscles }) || inferExerciseVideoBodyPart(bodyPart || muscle);
  const specificTarget = resolveInputVideoTarget({ name, muscle, bodyPart, targetMuscles });

  if (!normalizedName) {
    return {
      url: null,
      assetName: null,
      bodyPart: bodyPartKey || null,
      matchType: 'none',
      mediaType: null,
      remoteMedia: null,
    };
  }

  const directOverride = resolveDirectVideoOverride(normalizedName);
  if (directOverride) return directOverride;

  const hyroxFallback = resolveHyroxPlanFallback(normalizedName, preferredAudience);
  if (hyroxFallback) return hyroxFallback;

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
    mediaType: null,
    remoteMedia: null,
  };
};

export const resolveExerciseVideoUrl = (input: ExerciseVideoLookupInput) =>
  resolveExerciseVideo(input).url;

export const resolveExerciseCategoryVideo = (muscle?: string | null) => {
  const bodyPartKey = inferExerciseVideoBodyPart(muscle || '');
  const normalizedName = normalizeExerciseVideoLookup(muscle || '');
  const exactMatch = categoryVideoAssets.find((asset) => (
    normalizedName && matchesLookup(normalizedName, asset.normalizedName)
  ));
  if (exactMatch) return exactMatch;

  return categoryVideoAssets.find((asset) => (
    bodyPartKey && asset.bodyPart === bodyPartKey
  )) || null;
};

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
