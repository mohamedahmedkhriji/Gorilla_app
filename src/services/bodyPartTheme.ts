const absImage = new URL('../../assets/body part/abs.png', import.meta.url).href;
const absUpperImage = new URL('../../assets/body part/upper abs.png', import.meta.url).href;
const absLowerImage = new URL('../../assets/body part/lower abs.png', import.meta.url).href;
const absSideImage = new URL('../../assets/body part/side abs.png', import.meta.url).href;
const adductorsImage = new URL('../../assets/body part/Adductors inner lower thigh.png', import.meta.url).href;
const backImage = new URL('../../assets/body part/back.png', import.meta.url).href;
const bicepsImage = new URL('../../assets/body part/biceps.png', import.meta.url).href;
const calvesImage = new URL('../../assets/body part/Calves.png', import.meta.url).href;
const chestImage = new URL('../../assets/body part/chest.png', import.meta.url).href;
const forearmsImage = new URL('../../assets/body part/Forearms.png', import.meta.url).href;
const glutesImage = new URL('../../assets/body part/Gluteus butt muscles.png', import.meta.url).href;
const hamstringsImage = new URL('../../assets/body part/hamstring.png', import.meta.url).href;
const quadricepsImage = new URL('../../assets/body part/Quadriceps.png', import.meta.url).href;
const shoulderBackImage = new URL('../../assets/body part/shoulder back.png', import.meta.url).href;
const shouldersImage = new URL('../../assets/body part/shoulder.png', import.meta.url).href;
const tricepsImage = new URL('../../assets/body part/triceps.png', import.meta.url).href;

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

export const getBodyPartImage = (muscleGroup: unknown) => {
  const key = normalize(muscleGroup);
  if (!key) return chestImage;

  if (key.includes('abs') || key.includes('core') || key.includes('oblique') || key.includes('abdom')) {
    if (key.includes('lower')) return absLowerImage;
    if (key.includes('upper')) return absUpperImage;
    if (key.includes('side') || key.includes('oblique')) return absSideImage;
    return absImage;
  }
  if (key.includes('back') || key.includes('lat') || key.includes('trap') || key.includes('rhomboid')) return backImage;
  if (key.includes('bicep') || key.includes('brachialis') || key === 'arms') return bicepsImage;
  if (key.includes('calf')) return calvesImage;
  if (key.includes('chest') || key.includes('pect')) return chestImage;
  if (key.includes('forearm') || key.includes('wrist') || key.includes('grip')) return forearmsImage;
  if (key.includes('glute')) return glutesImage;
  if (key.includes('hamstring')) return hamstringsImage;
  if (key.includes('adductor')) return adductorsImage;
  if (key.includes('quad') || key.includes('thigh') || key === 'legs' || key.includes('leg')) return quadricepsImage;
  if (key.includes('shoulder') || key.includes('delt')) {
    if (key.includes('rear') || key.includes('back') || key.includes('posterior')) return shoulderBackImage;
    return shouldersImage;
  }
  if (key.includes('tricep')) return tricepsImage;

  return chestImage;
};
