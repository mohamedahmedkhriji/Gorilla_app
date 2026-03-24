const absImage = new URL('../../assets/body part/abs.png', import.meta.url).href;
const absUpperImage = new URL('../../assets/body part/upper abs.png', import.meta.url).href;
const absLowerImage = new URL('../../assets/body part/lower abs.png', import.meta.url).href;
const absSideImage = new URL('../../assets/body part/side abs.png', import.meta.url).href;
const adductorsImage = new URL('../../assets/body part/Adductors inner lower thigh.png', import.meta.url).href;
const backImage = new URL('../../assets/body part/back.png', import.meta.url).href;
const bicepsImage = new URL('../../assets/body part/biceps.png', import.meta.url).href;
const calvesImage = new URL('../../assets/body part/calves.png', import.meta.url).href;
const chestImage = new URL('../../assets/body part/chest.png', import.meta.url).href;
const forearmsImage = new URL('../../assets/body part/Forearms.png', import.meta.url).href;
const glutesImage = new URL('../../assets/body part/Gluteus butt muscles.png', import.meta.url).href;
const hamstringsImage = new URL('../../assets/body part/hamstring.png', import.meta.url).href;
const quadricepsImage = new URL('../../assets/body part/Quadriceps.png', import.meta.url).href;
const shoulderBackImage = new URL('../../assets/body part/shoulder back.png', import.meta.url).href;
const shouldersImage = new URL('../../assets/body part/shoulder.png', import.meta.url).href;
const tricepsImage = new URL('../../assets/body part/triceps.png', import.meta.url).href;

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

const AR = {
  abs: '\u0627\u0644\u0628\u0637\u0646',
  waist: '\u0627\u0644\u062e\u0635\u0631',
  back: '\u0627\u0644\u0638\u0647\u0631',
  biceps: '\u0627\u0644\u0628\u0627\u064a\u0633\u0628\u0633',
  calves: '\u0627\u0644\u0633\u0645\u0627\u0646\u0629',
  chest: '\u0627\u0644\u0635\u062f\u0631',
  forearms: '\u0627\u0644\u0633\u0627\u0639\u062f',
  glutes: '\u0627\u0644\u0623\u0644\u0648\u064a\u0629',
  hamstrings: '\u0627\u0644\u062e\u0644\u0641\u064a\u0629',
  adductors: '\u0627\u0644\u0645\u0642\u0631\u0628\u0627\u062a',
  quadriceps: '\u0627\u0644\u0631\u0628\u0627\u0639\u064a\u0629',
  legs: '\u0627\u0644\u0623\u0631\u062c\u0644',
  shoulders: '\u0627\u0644\u0623\u0643\u062a\u0627\u0641',
  triceps: '\u0627\u0644\u062a\u0631\u0627\u064a\u0633\u0628\u0633',
} as const;

export const getBodyPartImage = (muscleGroup: unknown) => {
  const key = normalize(muscleGroup);
  if (!key) return chestImage;

  if (
    key.includes('abs')
    || key.includes('core')
    || key.includes('oblique')
    || key.includes('abdom')
    || key.includes(AR.abs)
    || key.includes(AR.waist)
  ) {
    if (key.includes('lower')) return absLowerImage;
    if (key.includes('upper')) return absUpperImage;
    if (key.includes('side') || key.includes('oblique')) return absSideImage;
    return absImage;
  }

  if (
    key.includes('back')
    || key.includes('lat')
    || key.includes('trap')
    || key.includes('rhomboid')
    || key.includes(AR.back)
  ) return backImage;

  if (
    key.includes('bicep')
    || key.includes('brachialis')
    || key === 'arms'
    || key.includes(AR.biceps)
  ) return bicepsImage;

  if (
    key.includes('calf')
    || key.includes('calves')
    || key.includes(AR.calves)
  ) return calvesImage;

  if (
    key.includes('chest')
    || key.includes('pect')
    || key.includes(AR.chest)
  ) return chestImage;

  if (
    key.includes('forearm')
    || key.includes('wrist')
    || key.includes('grip')
    || key.includes(AR.forearms)
  ) return forearmsImage;

  if (key.includes('glute') || key.includes(AR.glutes)) return glutesImage;
  if (key.includes('hamstring') || key.includes(AR.hamstrings)) return hamstringsImage;
  if (key.includes('adductor') || key.includes(AR.adductors)) return adductorsImage;

  if (
    key.includes('quad')
    || key.includes('thigh')
    || key === 'legs'
    || key.includes('leg')
    || key.includes(AR.quadriceps)
    || key.includes(AR.legs)
  ) return quadricepsImage;

  if (key.includes('shoulder') || key.includes('delt')) {
    if (key.includes('rear') || key.includes('back') || key.includes('posterior')) return shoulderBackImage;
    return shouldersImage;
  }

  if (key.includes(AR.shoulders)) {
    if (key.includes(AR.hamstrings)) return shoulderBackImage;
    return shouldersImage;
  }

  if (key.includes('tricep') || key.includes(AR.triceps)) return tricepsImage;

  return chestImage;
};
