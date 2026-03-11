const normalizeExerciseVideoLookup = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\bpull[\s-]*downs?\b/g, 'pulldown')
    .replace(/\bpull[\s-]*ups?\b/g, 'pullup')
    .replace(/\bchin[\s-]*ups?\b/g, 'chinup')
    .replace(/\bpull[\s-]*overs?\b/g, 'pullover')
    .replace(/\bclose[\s-]*grip\b/g, 'close grip')
    .replace(/\bwide[\s-]*grip\b/g, 'wide grip')
    .replace(/\bneutral[\s-]*grip\b/g, 'neutral grip')
    .replace(/\breverse[\s-]*grip\b/g, 'reverse grip')
    .replace(/\bunder[\s-]*hand\b/g, 'underhand')
    .replace(/\bover[\s-]*hand\b/g, 'overhand')
    .replace(/\bone[\s-]*arm\b/g, 'single arm')
    .replace(/\bbent[\s-]*over\b/g, 'bent over')
    .replace(/\bbehind[\s-]*the[\s-]*head\b/g, 'behind the head')
    .replace(/\bbehind[\s-]*the[\s-]*neck\b/g, 'behind the neck')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^\d+\s+day\s+/g, '')
    .replace(/^\d+\s+(back|chest|legs|shoulders|arms|abs)\s+/g, '')
    .replace(/^(am|pm|fyr\d*|acft)\s+/g, '')
    .replace(/\s+gethin variation$/g, '')
    .replace(/\s+variation$/g, '')
    .trim();

const inferExerciseVideoBodyPart = (value) => {
  const text = normalizeExerciseVideoLookup(value);
  if (!text) return '';
  if (/(back|lat|lats|trap|traps|rhomboid|erector|teres)/.test(text)) return 'back';
  if (/(chest|pector|pec)/.test(text)) return 'chest';
  if (/(leg|quad|hamstring|glute|calf)/.test(text)) return 'legs';
  if (/(shoulder|delt)/.test(text)) return 'shoulders';
  if (/(bicep|tricep|forearm|arm)/.test(text)) return 'arms';
  if (/(abs|abdom|core|oblique)/.test(text)) return 'abs';
  return text;
};

const containsWholePhrase = (text, phrase) => (
  text === phrase
  || text.startsWith(`${phrase} `)
  || text.endsWith(` ${phrase}`)
  || text.includes(` ${phrase} `)
);

const matchesLookup = (exerciseName, alias) => {
  if (!exerciseName || !alias) return false;
  return (
    containsWholePhrase(exerciseName, alias)
    || containsWholePhrase(alias, exerciseName)
  );
};

const BACK_VIDEO_MANIFEST = [
  {
    bodyPart: 'back',
    fileName: 'Deadlift .mp4',
    priority: 95,
    aliases: ['deadlift', 'deadlifts', 'barbell deadlift', 'conventional deadlift'],
  },
  {
    bodyPart: 'back',
    fileName: 'Cable Pullover.mp4',
    priority: 92,
    aliases: [
      'pullover',
      'cable pullover',
      'bent over pullover',
      'straight arm pulldown',
      'straight arm pull down',
      'straight arm lat pulldown',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'pulldown Entire Lats.mp4',
    priority: 90,
    aliases: [
      'lat pulldown',
      'pulldown',
      'front pulldown',
      'pull up',
      'pullup',
      'chin up',
      'chinup',
      'pullup chinup',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'pulldown Upper Lats.mp4',
    priority: 91,
    aliases: [
      'wide grip lat pulldown',
      'wide grip pulldown',
      'upper lat pulldown',
      'front pulldown wide grip',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'pulldown Lower Lats 1.mp4',
    priority: 91,
    aliases: [
      'close grip lat pulldown',
      'close grip pulldown',
      'underhand pulldown',
      'parallel grip pulldown',
      'neutral grip pulldown',
      'parallel close grip pull up',
      'close grip pull up',
      'lower lat pulldown',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Cable Row Grip Mid Lats.mp4',
    priority: 89,
    aliases: [
      'seated row',
      'seated cable row',
      'cable row',
      'low row',
      'seated rows',
      'underhand seated row',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Cable Row Grip Mid Lats & Lower Lats.mp4',
    priority: 88,
    aliases: [
      'seated wide grip row',
      'wide grip row',
      'high row',
      'straight back seated high row',
      'chest supported row',
      'incline row',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Cable Back Row 1.mp4',
    priority: 90,
    aliases: [
      'bent over row',
      'bent over barbell row',
      'barbell row',
      'pendlay row',
      't bar row',
      'dumbbell row',
      'single arm dumbbell row',
      'one arm row',
      'one arm bent over row',
      'bent over row underhand',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Rope Pulling Mid Lats & Lower Lats.mp4',
    priority: 84,
    aliases: ['rope row', 'rope pulldown', 'rope pulling'],
  },
].map((entry) => ({
  ...entry,
  normalizedAliases: entry.aliases.map((alias) => normalizeExerciseVideoLookup(alias)),
}));

const resolveBackVideoFallback = (normalizedName) => {
  if (normalizedName.includes('deadlift')) {
    return { fileName: 'Deadlift .mp4', bodyPart: 'back', matchType: 'fallback', priority: 40 };
  }

  if (normalizedName.includes('pullover')) {
    return { fileName: 'Cable Pullover.mp4', bodyPart: 'back', matchType: 'fallback', priority: 40 };
  }

  if (normalizedName.includes('pulldown') || normalizedName.includes('pull up') || normalizedName.includes('pullup') || normalizedName.includes('chin up') || normalizedName.includes('chinup')) {
    if (normalizedName.includes('wide') || normalizedName.includes('upper')) {
      return { fileName: 'pulldown Upper Lats.mp4', bodyPart: 'back', matchType: 'fallback', priority: 35 };
    }
    if (normalizedName.includes('close') || normalizedName.includes('neutral') || normalizedName.includes('parallel') || normalizedName.includes('underhand') || normalizedName.includes('lower')) {
      return { fileName: 'pulldown Lower Lats 1.mp4', bodyPart: 'back', matchType: 'fallback', priority: 35 };
    }
    return { fileName: 'pulldown Entire Lats.mp4', bodyPart: 'back', matchType: 'fallback', priority: 35 };
  }

  if (normalizedName.includes('row')) {
    if (normalizedName.includes('bent') || normalizedName.includes('barbell') || normalizedName.includes('pendlay') || normalizedName.includes('dumbbell') || normalizedName.includes('one arm')) {
      return { fileName: 'Cable Back Row 1.mp4', bodyPart: 'back', matchType: 'fallback', priority: 30 };
    }
    if (normalizedName.includes('wide') || normalizedName.includes('high') || normalizedName.includes('chest supported') || normalizedName.includes('incline')) {
      return { fileName: 'Cable Row Grip Mid Lats & Lower Lats.mp4', bodyPart: 'back', matchType: 'fallback', priority: 30 };
    }
    return { fileName: 'Cable Row Grip Mid Lats.mp4', bodyPart: 'back', matchType: 'fallback', priority: 30 };
  }

  return {
    fileName: null,
    bodyPart: 'back',
    matchType: 'none',
    priority: 0,
  };
};

const resolveExerciseVideoManifest = ({ name, muscle, bodyPart } = {}) => {
  const normalizedName = normalizeExerciseVideoLookup(name);
  const bodyPartKey = inferExerciseVideoBodyPart(bodyPart || muscle);

  if (!normalizedName) {
    return {
      fileName: null,
      bodyPart: bodyPartKey || null,
      matchType: 'none',
      priority: 0,
    };
  }

  const aliasRule = BACK_VIDEO_MANIFEST.find((rule) => {
    if (rule.bodyPart && bodyPartKey && rule.bodyPart !== bodyPartKey) return false;
    return rule.normalizedAliases.some((alias) => matchesLookup(normalizedName, alias));
  });

  if (aliasRule) {
    return {
      fileName: aliasRule.fileName,
      bodyPart: aliasRule.bodyPart,
      matchType: 'alias',
      priority: aliasRule.priority || 0,
    };
  }

  if (bodyPartKey === 'back') {
    return resolveBackVideoFallback(normalizedName);
  }

  return {
    fileName: null,
    bodyPart: bodyPartKey || null,
    matchType: 'none',
    priority: 0,
  };
};

const hasExactExerciseVideoLink = (input) => resolveExerciseVideoManifest(input).matchType === 'alias';

export {
  BACK_VIDEO_MANIFEST,
  hasExactExerciseVideoLink,
  inferExerciseVideoBodyPart,
  normalizeExerciseVideoLookup,
  resolveExerciseVideoManifest,
};
