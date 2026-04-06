const normalizeExerciseVideoLookup = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\bskull\s*crusher\b/g, 'skull crusher')
    .replace(/\bskullcrusher\b/g, 'skull crusher')
    .replace(/\bkick\s*back\b/g, 'kick back')
    .replace(/\bkickback\b/g, 'kick back')
    .replace(/\bpush\s*down\b/g, 'push down')
    .replace(/\bpushdown\b/g, 'push down')
    .replace(/\bpress\s*down\b/g, 'push down')
    .replace(/\bpressdown\b/g, 'push down')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\bsit\s*up\b/g, 'sit up')
    .replace(/\bsitup\b/g, 'sit up')
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
    // Normalize common plural variants so newly added file names match dataset entries.
    .replace(/\bextensions\b/g, 'extension')
    .replace(/\brows\b/g, 'row')
    .replace(/\bcurls\b/g, 'curl')
    .replace(/\braises\b/g, 'raise')
    .replace(/\bpresses\b/g, 'press')
    .replace(/\bflies\b/g, 'fly')
    .replace(/\bflyes\b/g, 'fly')
    .replace(/\bdeadlifts\b/g, 'deadlift')
    .replace(/\bshrugs\b/g, 'shrug')
    .replace(/\bsquats\b/g, 'squat')
    .replace(/\blunges\b/g, 'lunge')
    .replace(/\bcrunches\b/g, 'crunch')
    .replace(/\btwists\b/g, 'twist')
    .replace(/\bdips\b/g, 'dip')
    .replace(/\blats\b/g, 'lat')
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
  if (/(abs|abdom|core|oblique|crunch|sit up|leg raise|leg lift|knee raise|plank|twist|vacuum|hollow|v up|vup|dead bug)/.test(text)) return 'abs';
  if (/(shoulder|delt|lateral raise|(?:^| )lateral(?: |$)|front raise|rear delt|face pull|shoulder press|overhead press|arnold press)/.test(` ${text} `)) return 'shoulders';
  if (/(back|\blat\b|\blats\b|trap|traps|rhomboid|erector|teres|pulldown|pullup|chinup|row|deadlift|shrug|pullover|rack pull)/.test(text)) return 'back';
  if (/(chest|pector|\bpec\b|bench press|chest press|incline press|push up|pushup|fly|crossovers|pec deck|guillotine press|dip|hammer strength press|machine press)/.test(text)) return 'chest';
  if (/(leg press|leg extension|leg curl|leg|quad|hamstring|glute|calf|thigh|squat|lunge|hip thrust|split squat)/.test(text)) return 'legs';
  if (/(bicep|tricep|forearm|arm|curl|push down|skull crusher|kick back|french press)/.test(text)) return 'arms';
  return '';
};

const resolveExerciseVideoBodyPart = ({ name, muscle, bodyPart, targetMuscles } = {}) => {
  const normalizedName = normalizeExerciseVideoLookup(name);
  const nameBodyPart = inferExerciseVideoBodyPart(name);
  const targetMuscleHint = Array.isArray(targetMuscles)
    ? targetMuscles.map((entry) => String(entry || '').trim()).filter(Boolean).join(' ')
    : '';
  const hintedBodyPart = inferExerciseVideoBodyPart(`${targetMuscleHint} ${bodyPart || ''} ${muscle || ''}`);

  if (hintedBodyPart) {
    if (!nameBodyPart || nameBodyPart === hintedBodyPart) return hintedBodyPart;

    if (
      hintedBodyPart === 'legs'
      && /(seated curl|lying curl|leg curl|hamstring curl|fst 7 curl|fst7 curl|romanian deadlift|rdl|stiff leg deadlift|deadlift)/.test(normalizedName)
    ) {
      return hintedBodyPart;
    }

    if (hintedBodyPart !== 'arms' && nameBodyPart === 'arms') {
      return hintedBodyPart;
    }
  }

  return nameBodyPart || hintedBodyPart;
};

const matchesLookup = (exerciseName, alias) => {
  if (!exerciseName || !alias) return false;
  return exerciseName === alias;
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
  {
    bodyPart: 'back',
    fileName: 'Pull-Up .mp4',
    priority: 94,
    aliases: [
      'pull up',
      'pullup',
      'chin up',
      'chinup',
      'assisted pull up',
      'assisted pullup',
      'neutral grip pull up',
      'wide grip pull up',
      'close grip pull up',
      'weighted pull up',
      'weighted pullup',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Rear Delt Fly.mp4',
    priority: 90,
    aliases: [
      'rear delt fly',
      'rear deltoid fly',
      'reverse fly',
      'reverse pec deck',
      'rear delt raise',
      'bent over rear delt fly',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'traps.mp4',
    priority: 88,
    aliases: [
      'trap',
      'traps',
      'barbell shrug',
      'dumbbell shrug',
      'shrug',
      'upright row',
      'rack pull',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Back Extensions .mp4',
    priority: 93,
    aliases: [
      'back extension',
      'back extensions',
      'hyperextension',
      'roman chair extension',
      'lower back extension',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Landmine Row.mp4',
    priority: 89,
    aliases: [
      'landmine row',
      'single arm landmine row',
      'meadows row',
    ],
  },
].map((entry) => ({
  ...entry,
  normalizedAliases: entry.aliases.map((alias) => normalizeExerciseVideoLookup(alias)),
}));

const CHEST_VIDEO_MANIFEST = [
  {
    bodyPart: 'chest',
    fileName: 'bech press upper smith machine.mp4',
    priority: 98,
    aliases: [
      'incline smith machine press',
      'smith machine incline press',
      'incline machine press',
      'incline upper chest press',
      'upper chest machine press',
      'upper smith machine press',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'incline bench press dumbbell.mp4',
    priority: 97,
    aliases: [
      'incline dumbbell press',
      'incline dumbbell bench press',
      'incline bench press dumbbell',
      'incline db press',
      'incline db bench press',
      'upper chest dumbbell press',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Incline Smith Press.mp4',
    priority: 96,
    aliases: [
      'incline smith press',
      'smith incline press',
      'upper smith press',
      'incline barbell press',
      'barbell incline press',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Incline Fly upper chest .mp4',
    priority: 95,
    aliases: [
      'incline upper chest fly',
      'incline fly upper chest',
      'upper chest incline fly',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Incline Fly  lower chest .mp4',
    priority: 95,
    aliases: [
      'incline lower chest fly',
      'incline fly lower chest',
      'lower chest incline fly',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Incline Fly chest .mp4',
    priority: 94,
    aliases: [
      'incline fly',
      'incline chest fly',
      'incline pec fly',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Low-to-High Cable Fly.mp4',
    priority: 93,
    aliases: [
      'low to high cable fly',
      'low cable fly',
      'low cable flyes',
      'upper chest cable fly',
      'upper chest cable flyes',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Cable Fly.mp4',
    priority: 92,
    aliases: [
      'cable fly',
      'cable flyes',
      'fst 7 cable fly',
      'fst 7 cable flyes',
      'fst-7 cable fly',
      'fst-7 cable flyes',
    ],
  },
].map((entry) => ({
  ...entry,
  normalizedAliases: entry.aliases.map((alias) => normalizeExerciseVideoLookup(alias)),
}));

const ABS_VIDEO_MANIFEST = [
  {
    bodyPart: 'abs',
    fileName: 'leg raises.mp4',
    priority: 96,
    aliases: [
      'leg raise',
      'leg raises',
      'hanging leg raise',
      'hanging leg raises',
      'captains chair leg raise',
      'captain s chair leg raise',
      'lying leg raise',
      'lying leg raises',
      'reverse leg raise',
    ],
  },
  {
    bodyPart: 'abs',
    fileName: 'Weighted Leg Lift on Elbows (Dumbbell Between Feet).mp4',
    priority: 95,
    aliases: [
      'weighted leg lift',
      'weighted leg raise',
      'weighted hanging leg raise',
      'weighted hanging leg raises',
      'hanging knee raise',
      'hanging knee raises',
      'knee raise',
      'knee raises',
    ],
  },
  {
    bodyPart: 'abs',
    fileName: 'Cable Crunch (Kneeling).mp4',
    priority: 94,
    aliases: [
      'cable crunch',
      'kneeling cable crunch',
      'rope crunch',
      'standing cable crunch',
    ],
  },
  {
    bodyPart: 'abs',
    fileName: 'crunch reach.mp4',
    priority: 92,
    aliases: [
      'crunch reach',
      'reach crunch',
    ],
  },
  {
    bodyPart: 'abs',
    fileName: 'russian twists.mp4',
    priority: 91,
    aliases: [
      'russian twist',
      'russian twists',
    ],
  },
  {
    bodyPart: 'abs',
    fileName: 'side crunches.mp4',
    priority: 90,
    aliases: [
      'side crunch',
      'side crunches',
      'oblique crunch',
      'oblique crunches',
      'bicycle crunch',
      'bicycle crunches',
    ],
  },
  {
    bodyPart: 'abs',
    fileName: 'sit-up.mp4',
    priority: 89,
    aliases: [
      'sit up',
      'sit ups',
      'crunch',
      'crunches',
      'sit up hold',
    ],
  },
  {
    bodyPart: 'abs',
    fileName: 'Plank .mp4',
    priority: 88,
    aliases: [
      'plank',
      'front plank',
      'elbow plank',
      'forearm plank',
    ],
  },
].map((entry) => ({
  ...entry,
  normalizedAliases: entry.aliases.map((alias) => normalizeExerciseVideoLookup(alias)),
}));

const TEMPLATE_VIDEO_MANIFEST = [
  {
    bodyPart: 'abs',
    fileName: 'Plank .mp4',
    priority: 99,
    aliases: [
      'abs circuit',
      'vacuum',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Front Pulldown (Back).mp4',
    priority: 99,
    aliases: [
      'single arm pulldown',
      'single arm lat pulldown',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Cable Row Grip Mid Lats & Lower Lats.mp4',
    priority: 98,
    aliases: [
      'machine row',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Cable Pullover.mp4',
    priority: 98,
    aliases: [
      'fst 7 machine pullover',
      'fst-7 machine pullover',
      'fst 7 straight arm',
      'fst-7 straight arm',
    ],
  },
  {
    bodyPart: 'back',
    fileName: 'Deadlift .mp4',
    priority: 97,
    aliases: [
      'rack pull',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'incline bench press dumbbell.mp4',
    priority: 99,
    aliases: [
      'incline db',
      'incline db press',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Smith Machine Flat Bench Press.mp4',
    priority: 98,
    aliases: [
      'machine chest press',
      'machine press',
      'hammer strength press',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Pec Deck.mp4',
    priority: 98,
    aliases: [
      'chest fly machine',
      'fst 7 pec deck',
      'fst-7 pec deck',
    ],
  },
  {
    bodyPart: 'chest',
    fileName: 'Dips.mp4',
    priority: 97,
    aliases: [
      'weighted dips',
    ],
  },
  {
    bodyPart: 'shoulders',
    fileName: 'Cable Lateral Raise.mp4',
    priority: 99,
    aliases: [
      'cable lateral',
      'cable lateral raise',
      'fst 7 cable lateral',
      'fst-7 cable lateral',
    ],
  },
  {
    bodyPart: 'shoulders',
    fileName: 'DB LATERAL RAISE.mp4',
    priority: 98,
    aliases: [
      'lateral raise',
      'side lateral raise',
      'fst 7 lateral',
      'fst-7 lateral',
      'lateral raise dropset',
    ],
  },
  {
    bodyPart: 'shoulders',
    fileName: 'DUMBBELL PRESS.mp4',
    priority: 97,
    aliases: [
      'seated db press',
    ],
  },
  {
    bodyPart: 'shoulders',
    fileName: 'Seated Machine Shoulder Press.mp4',
    priority: 97,
    aliases: [
      'machine shoulder press',
      'seated shoulder press',
    ],
  },
  {
    bodyPart: 'shoulders',
    fileName: 'Rear Delt.mp4',
    priority: 97,
    aliases: [
      'rear delt',
      'rear delt machine',
    ],
  },
  {
    bodyPart: 'shoulders',
    fileName: 'Seated Face Pull.mp4',
    priority: 96,
    aliases: [
      'face pull',
    ],
  },
  {
    bodyPart: 'legs',
    fileName: 'Hack Squat QUADS.mp4',
    priority: 99,
    aliases: [
      'hack squat',
    ],
  },
  {
    bodyPart: 'legs',
    fileName: 'Barbell Hip Thrust.mp4',
    priority: 98,
    aliases: [
      'hip thrust',
    ],
  },
  {
    bodyPart: 'legs',
    fileName: 'Leg Extension toes up.mp4',
    priority: 98,
    aliases: [
      'leg extension',
      'fst 7 extension',
      'fst-7 extension',
    ],
  },
  {
    bodyPart: 'legs',
    fileName: 'Leg Press (Feet Shoulder-Width).mp4',
    priority: 98,
    aliases: [
      'leg press',
    ],
  },
  {
    bodyPart: 'legs',
    fileName: 'Lying Leg Curl Machine.mp4',
    priority: 97,
    aliases: [
      'lying curl',
      'lying leg curl',
      'seated curl',
      'seated leg curl',
      'fst 7 curl',
      'fst-7 curl',
      'fst 7 leg curl',
      'fst-7 leg curl',
    ],
  },
  {
    bodyPart: 'legs',
    fileName: 'Standing Calf Raise (Calves).mp4',
    priority: 96,
    aliases: [
      'seated calf raise',
    ],
  },
  {
    bodyPart: 'legs',
    fileName: 'WALKING LUNGE.mp4',
    priority: 96,
    aliases: [
      'walking lunge',
      'walking lunges',
    ],
  },
  {
    bodyPart: 'legs',
    fileName: 'Barbell Back Squat.mp4',
    priority: 96,
    aliases: [
      'back squat',
      'front squat',
    ],
  },
  {
    bodyPart: 'arms',
    fileName: 'EZ Bar Curl.mp4',
    priority: 98,
    aliases: [
      'ez curl',
      'fst 7 curl',
      'fst-7 curl',
    ],
  },
  {
    bodyPart: 'arms',
    fileName: 'Hammer Curl.mp4',
    priority: 97,
    aliases: [
      'hammer curl',
    ],
  },
  {
    bodyPart: 'arms',
    fileName: 'Incline Curl.mp4',
    priority: 97,
    aliases: [
      'incline db curl',
    ],
  },
  {
    bodyPart: 'arms',
    fileName: 'Standard Cable Curl.mp4',
    priority: 96,
    aliases: [
      'cable curl pushdown superset',
      'cable curl and pushdown superset',
    ],
  },
  {
    bodyPart: 'arms',
    fileName: 'Triceps Pressdown (Rope).mp4',
    priority: 96,
    aliases: [
      'rope pushdown',
      'triceps rope',
      'fst 7 rope pushdown',
      'fst-7 rope pushdown',
    ],
  },
].map((entry) => ({
  ...entry,
  normalizedAliases: entry.aliases.map((alias) => normalizeExerciseVideoLookup(alias)),
}));

const EXERCISE_VIDEO_MANIFEST = [
  ...BACK_VIDEO_MANIFEST,
  ...CHEST_VIDEO_MANIFEST,
  ...ABS_VIDEO_MANIFEST,
  ...TEMPLATE_VIDEO_MANIFEST,
];

const resolveBackVideoFallback = (normalizedName) => {
  if (normalizedName.includes('deadlift')) {
    return { fileName: 'Deadlift .mp4', bodyPart: 'back', matchType: 'fallback', priority: 40 };
  }

  if (
    normalizedName.includes('back extension')
    || normalizedName.includes('hyperextension')
    || normalizedName.includes('roman chair extension')
    || normalizedName.includes('lower back extension')
  ) {
    return { fileName: 'Back Extensions .mp4', bodyPart: 'back', matchType: 'fallback', priority: 38 };
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

const resolveChestVideoFallback = (normalizedName) => {
  if (
    normalizedName.includes('incline')
    && normalizedName.includes('dumbbell')
    && normalizedName.includes('press')
  ) {
    return { fileName: 'incline bench press dumbbell.mp4', bodyPart: 'chest', matchType: 'fallback', priority: 44 };
  }

  if (
    normalizedName.includes('incline')
    && normalizedName.includes('smith')
    && normalizedName.includes('machine')
    && normalizedName.includes('press')
  ) {
    return { fileName: 'bech press upper smith machine.mp4', bodyPart: 'chest', matchType: 'fallback', priority: 43 };
  }

  if (
    normalizedName.includes('incline')
    && normalizedName.includes('smith')
    && normalizedName.includes('press')
  ) {
    return { fileName: 'Incline Smith Press.mp4', bodyPart: 'chest', matchType: 'fallback', priority: 42 };
  }

  if (
    normalizedName.includes('incline')
    && normalizedName.includes('machine')
    && normalizedName.includes('press')
  ) {
    return { fileName: 'bech press upper smith machine.mp4', bodyPart: 'chest', matchType: 'fallback', priority: 41 };
  }

  if (
    normalizedName.includes('incline')
    && normalizedName.includes('barbell')
    && normalizedName.includes('press')
  ) {
    return { fileName: 'Incline Smith Press.mp4', bodyPart: 'chest', matchType: 'fallback', priority: 40 };
  }

  if (
    normalizedName.includes('incline')
    && normalizedName.includes('upper')
    && normalizedName.includes('chest')
    && normalizedName.includes('press')
  ) {
    return { fileName: 'bech press upper smith machine.mp4', bodyPart: 'chest', matchType: 'fallback', priority: 40 };
  }

  if (normalizedName.includes('incline') && normalizedName.includes('fly')) {
    if (normalizedName.includes('upper')) {
      return { fileName: 'Incline Fly upper chest .mp4', bodyPart: 'chest', matchType: 'fallback', priority: 41 };
    }
    if (normalizedName.includes('lower')) {
      return { fileName: 'Incline Fly  lower chest .mp4', bodyPart: 'chest', matchType: 'fallback', priority: 41 };
    }
    return { fileName: 'Incline Fly chest .mp4', bodyPart: 'chest', matchType: 'fallback', priority: 40 };
  }

  if (
    (normalizedName.includes('low') || normalizedName.includes('upper'))
    && normalizedName.includes('fly')
  ) {
    return { fileName: 'Low-to-High Cable Fly.mp4', bodyPart: 'chest', matchType: 'fallback', priority: 40 };
  }

  if (normalizedName.includes('fly')) {
    return { fileName: 'Cable Fly.mp4', bodyPart: 'chest', matchType: 'fallback', priority: 38 };
  }

  return {
    fileName: null,
    bodyPart: 'chest',
    matchType: 'none',
    priority: 0,
  };
};

const resolveAbsVideoFallback = (normalizedName) => {
  if (normalizedName.includes('vacuum')) {
    return { fileName: 'Plank .mp4', bodyPart: 'abs', matchType: 'fallback', priority: 46 };
  }

  if (
    normalizedName.includes('weighted')
    && (normalizedName.includes('leg raise') || normalizedName.includes('leg lift') || normalizedName.includes('knee raise'))
  ) {
    return { fileName: 'Weighted Leg Lift on Elbows (Dumbbell Between Feet).mp4', bodyPart: 'abs', matchType: 'fallback', priority: 45 };
  }

  if (
    normalizedName.includes('leg raise')
    || normalizedName.includes('leg lift')
    || normalizedName.includes('knee raise')
  ) {
    return { fileName: 'leg raises.mp4', bodyPart: 'abs', matchType: 'fallback', priority: 44 };
  }

  if (
    normalizedName.includes('cable')
    && normalizedName.includes('crunch')
  ) {
    return { fileName: 'Cable Crunch (Kneeling).mp4', bodyPart: 'abs', matchType: 'fallback', priority: 43 };
  }

  if (
    normalizedName.includes('russian')
    || normalizedName.includes('twist')
  ) {
    return { fileName: 'russian twists.mp4', bodyPart: 'abs', matchType: 'fallback', priority: 42 };
  }

  if (
    normalizedName.includes('oblique')
    || normalizedName.includes('side crunch')
    || normalizedName.includes('bicycle')
  ) {
    return { fileName: 'side crunches.mp4', bodyPart: 'abs', matchType: 'fallback', priority: 41 };
  }

  if (
    normalizedName.includes('crunch reach')
    || (normalizedName.includes('crunch') && normalizedName.includes('reach'))
  ) {
    return { fileName: 'crunch reach.mp4', bodyPart: 'abs', matchType: 'fallback', priority: 40 };
  }

  if (
    normalizedName.includes('plank')
    || normalizedName.includes('hollow')
  ) {
    return { fileName: 'Plank .mp4', bodyPart: 'abs', matchType: 'fallback', priority: 39 };
  }

  if (
    normalizedName.includes('sit up')
    || normalizedName.includes('crunch')
  ) {
    return { fileName: 'sit-up.mp4', bodyPart: 'abs', matchType: 'fallback', priority: 38 };
  }

  return {
    fileName: null,
    bodyPart: 'abs',
    matchType: 'none',
    priority: 0,
  };
};

const resolveExerciseVideoManifest = ({ name, muscle, bodyPart, targetMuscles } = {}) => {
  const normalizedName = normalizeExerciseVideoLookup(name);
  const bodyPartKey = resolveExerciseVideoBodyPart({ name, muscle, bodyPart, targetMuscles });

  if (!normalizedName) {
    return {
      fileName: null,
      bodyPart: bodyPartKey || null,
      matchType: 'none',
      priority: 0,
    };
  }

  const aliasRule = (
    EXERCISE_VIDEO_MANIFEST.find((rule) =>
      rule.bodyPart === bodyPartKey && rule.normalizedAliases.some((alias) => matchesLookup(normalizedName, alias)))
    || EXERCISE_VIDEO_MANIFEST.find((rule) => rule.normalizedAliases.some((alias) => matchesLookup(normalizedName, alias)))
  );

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

  if (bodyPartKey === 'chest') {
    return resolveChestVideoFallback(normalizedName);
  }

  if (bodyPartKey === 'abs') {
    return resolveAbsVideoFallback(normalizedName);
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
  ABS_VIDEO_MANIFEST,
  BACK_VIDEO_MANIFEST,
  CHEST_VIDEO_MANIFEST,
  EXERCISE_VIDEO_MANIFEST,
  hasExactExerciseVideoLink,
  inferExerciseVideoBodyPart,
  resolveExerciseVideoBodyPart,
  normalizeExerciseVideoLookup,
  resolveExerciseVideoManifest,
};
