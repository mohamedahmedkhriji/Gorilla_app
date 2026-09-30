export const MOVEMENT_MAPPING = Object.freeze({
  horizontal_press: {
    primaryMuscles: ['chest'],
    include: ['press', 'push-up', 'push up'],
    exclude: ['incline', 'shoulder', 'overhead', 'fly', 'flye'],
  },
  incline_press: {
    primaryMuscles: ['chest'],
    include: ['incline', 'press'],
    exclude: ['fly', 'flye'],
  },
  vertical_press: {
    primaryMuscles: ['shoulders'],
    include: ['shoulder press', 'overhead press', 'military press', 'arnold press'],
    exclude: ['lateral raise', 'front raise'],
  },
  vertical_pull: {
    primaryMuscles: ['back'],
    include: ['pull-up', 'pull up', 'pulldown', 'pull down', 'chin-up', 'chin up'],
    exclude: ['row'],
  },
  horizontal_pull: {
    primaryMuscles: ['back', 'upper_back'],
    include: ['row'],
    exclude: ['pulldown', 'pull-up', 'pull up'],
  },
  upper_back: {
    primaryMuscles: ['back', 'upper_back'],
    include: ['row', 'face pull', 'shrug'],
    exclude: [],
  },
  rear_delt: {
    primaryMuscles: ['shoulders'],
    include: ['rear delt', 'reverse fly', 'face pull'],
    exclude: [],
  },
  squat_pattern: {
    primaryMuscles: ['quadriceps', 'glutes'],
    include: ['squat', 'leg press'],
    exclude: ['split squat'],
    competitionInclude: ['squat'],
  },
  bench: {
    primaryMuscles: ['chest'],
    include: ['bench press'],
    exclude: ['fly', 'flye', 'push-up', 'push up'],
    competitionInclude: ['bench press'],
  },
  deadlift: {
    primaryMuscles: ['hamstrings', 'glutes'],
    include: ['deadlift'],
    exclude: ['curl', 'extension'],
    competitionInclude: ['deadlift'],
  },
  hip_hinge: {
    primaryMuscles: ['hamstrings', 'glutes'],
    include: ['deadlift', 'rdl', 'romanian deadlift', 'hip thrust', 'back extension'],
    exclude: ['leg curl'],
  },
  hip_hinge_accessory: {
    primaryMuscles: ['hamstrings', 'glutes'],
    include: ['romanian deadlift', 'rdl', 'hip thrust', 'back extension'],
    exclude: [],
  },
  single_leg: {
    primaryMuscles: ['glutes', 'quadriceps'],
    include: ['lunge', 'split squat', 'step-up', 'step up'],
    exclude: [],
  },
  quad_accessory: {
    primaryMuscles: ['quadriceps'],
    include: ['leg extension', 'leg press', 'hack squat'],
    exclude: [],
  },
  hamstring_accessory: {
    primaryMuscles: ['hamstrings'],
    include: ['leg curl', 'hamstring curl'],
    exclude: [],
  },
  chest_isolation: {
    primaryMuscles: ['chest'],
    include: ['fly', 'flye', 'pec deck', 'crossover'],
    exclude: ['press'],
  },
  shoulder: {
    primaryMuscles: ['shoulders'],
    include: ['shoulder press', 'lateral raise', 'front raise'],
    exclude: [],
  },
  lateral_delt: {
    primaryMuscles: ['shoulders'],
    include: ['lateral raise', 'side delt'],
    exclude: ['front raise', 'rear delt'],
  },
  triceps: {
    primaryMuscles: ['triceps'],
    include: ['triceps', 'skullcrusher', 'pressdown', 'pushdown'],
    exclude: [],
  },
  biceps: {
    primaryMuscles: ['biceps'],
    include: ['curl'],
    exclude: ['leg curl'],
  },
  calves: {
    primaryMuscles: ['calves'],
    include: ['calf', 'calves'],
    exclude: [],
  },
  core: {
    primaryMuscles: ['core'],
    include: ['crunch', 'plank', 'leg raise', 'sit-up', 'sit up', 'russian twist'],
    exclude: [],
  },
  resistance_circuit: {
    primaryMuscles: ['full_body'],
    include: [],
    exclude: [],
  },
});
