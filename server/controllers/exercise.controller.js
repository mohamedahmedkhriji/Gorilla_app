import { getExerciseFallbackMuscleRows } from '../services/exerciseMuscleProfiles.js';
import {
  getSupabaseExerciseMuscles,
  listSupabaseExerciseFilters,
  listSupabaseExercises,
  resolveSupabaseExerciseMusclesByName,
} from '../services/supabaseExerciseCatalogService.js';

const normalizeExerciseLookupName = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCatalogMuscleGroup = (raw) => {
  const value = String(raw || '').trim();
  const key = value.toLowerCase();
  if (!key) return 'Other';
  if (/(chest|pector|pec)/.test(key)) return 'Chest';
  if (/(back|lat|trap|rhomboid|erector)/.test(key)) return 'Back';
  if (/(shoulder|deltoid|delt)/.test(key)) return 'Shoulders';
  if (/(bicep|brachialis)/.test(key)) return 'Biceps';
  if (/(tricep)/.test(key)) return 'Triceps';
  if (/(forearm|wrist|grip)/.test(key)) return 'Forearms';
  if (/(quad|thigh)/.test(key)) return 'Quadriceps';
  if (/(hamstring)/.test(key)) return 'Hamstrings';
  if (/(glute)/.test(key)) return 'Glutes';
  if (/(calf|calves)/.test(key)) return 'Calves';
  if (/(abs|abdom|core|oblique)/.test(key)) return 'Abs';
  return value;
};

const CATALOG_MUSCLE_ROLE_PRIORITY = {
  target: 0,
  primary: 0,
  secondary: 1,
  synergist: 2,
  dynamic_stabilizer: 3,
  stabilizer: 4,
};

const normalizeCatalogMuscleRole = (value) => {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (Object.prototype.hasOwnProperty.call(CATALOG_MUSCLE_ROLE_PRIORITY, key)) {
    return key;
  }
  return key || 'secondary';
};

const toRoundedPercentages = (weights = []) => {
  const values = weights.map((value) => Math.max(0, Number(value) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((value) => (value / total) * 100);
  const floored = raw.map(Math.floor);
  let remainder = 100 - floored.reduce((sum, value) => sum + value, 0);
  raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction)
    .forEach(({ index }) => {
      if (remainder <= 0) return;
      floored[index] += 1;
      remainder -= 1;
    });
  return floored;
};

const getCatalogFallbackBaseMuscle = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;

  if (/(shoulder|deltoid|rear delt|front delt|side delt|lateral deltoid|medial deltoid|posterior deltoid|anterior deltoid|supraspinatus|infraspinatus|teres minor|rotator cuff)/.test(key)) return 'Shoulders';
  if (/(chest|pector|pec|serratus)/.test(key)) return 'Chest';
  if (/(tricep)/.test(key)) return 'Triceps';
  if (/(bicep|brachialis|brachioradialis)/.test(key)) return 'Biceps';
  if (/(forearm|fore arm|avant bra|avant bras|avant-bras|wrist|grip)/.test(key)) return 'Forearms';
  if (/(latissimus|\blats?\b|rhomboid|trap|trapezius|back|erector|spinae|teres major|middle back|upper back|lower back)/.test(key)) return 'Back';
  if (/(adductor|inner thigh)/.test(key)) return 'Adductors';
  if (/(tibialis|tibial|shin)/.test(key)) return 'Tibialis';
  if (/(quad|quadricep|thigh)/.test(key)) return 'Quadriceps';
  if (/(hamstring|abductor)/.test(key)) return 'Hamstrings';
  if (/(glute)/.test(key)) return 'Glutes';
  if (/(calf|calves|claves|mollet|moulet)/.test(key)) return 'Calves';
  if (/(abs|abdom|core|oblique)/.test(key)) return 'Abs';

  const grouped = normalizeCatalogMuscleGroup(value);
  return grouped === 'Other' ? null : grouped;
};

const GENERIC_CATALOG_TARGET_NAMES = new Set([
  'Abs',
  'Back',
  'Biceps',
  'Calves',
  'Chest',
  'Forearms',
  'Glutes',
  'Hamstrings',
  'Legs',
  'Quadriceps',
  'Shoulders',
  'Triceps',
]);

const canonicalizeCatalogTargetName = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';

  if (/(lateral deltoid|medial deltoid|side delt)/.test(key)) return 'Side Delts';
  if (/(anterior deltoid|front delt)/.test(key)) return 'Front Delts';
  if (/(posterior deltoid|rear delt)/.test(key)) return 'Rear Delts';
  if (/(deltoid|shoulder|supraspinatus|infraspinatus|teres minor|rotator cuff)/.test(key)) return 'Shoulders';
  if (/(latissimus|\blats?\b)/.test(key)) return 'Lats';
  if (/(trapezius|trap)/.test(key)) return 'Traps';
  if (/(rhomboid)/.test(key)) return 'Rhomboids';
  if (/(erector|spinae|lower back)/.test(key)) return 'Lower Back';
  if (/(upper back|middle back)/.test(key)) return 'Upper Back';
  if (/(clavicular|upper chest|upper pector)/.test(key)) return 'Upper Chest';
  if (/(sternocostal|mid chest|middle chest|mid pector)/.test(key)) return 'Mid Chest';
  if (/(lower chest)/.test(key)) return 'Lower Chest';
  if (/(chest|pector|pec)/.test(key)) return 'Chest';

  return String(value || '').trim();
};

const buildExerciseCatalogFallbackEntries = (fallbackBodyPart = null) => {
  const normalizedBodyPart = String(fallbackBodyPart || '').trim();
  const fallbackBaseMuscle = getCatalogFallbackBaseMuscle(normalizedBodyPart);
  if (!normalizedBodyPart) return [];

  return [{
    name: canonicalizeCatalogTargetName(normalizedBodyPart) || normalizedBodyPart,
    role: 'target',
    loadFactor: 1,
    isPrimary: true,
    baseMuscle: fallbackBaseMuscle,
    order: 0,
  }];
};

const buildExerciseCatalogMuscleEntries = (rows = []) => {
  if (!Array.isArray(rows) || !rows.length) {
    return {
      entries: [],
      fallbackEntries: [],
    };
  }

  const fallbackBodyPart = String(rows[0]?.body_part || '').trim();
  const fallbackBaseMuscle = getCatalogFallbackBaseMuscle(fallbackBodyPart);
  const byMuscle = new Map();

  rows.forEach((row, index) => {
    const rawName = String(row.muscle_group || '').trim();
    const role = normalizeCatalogMuscleRole(row.role);
    if (!rawName || role === 'antagonist') return;

    const loadFactorRaw = Number(row.load_factor || 0);
    const loadFactor = Number.isFinite(loadFactorRaw) && loadFactorRaw > 0 ? loadFactorRaw : 1;
    const displayName = canonicalizeCatalogTargetName(rawName);
    const key = normalizeExerciseLookupName(displayName || rawName) || rawName.toLowerCase();
    const baseMuscle = getCatalogFallbackBaseMuscle(displayName || rawName) || fallbackBaseMuscle;
    const isPrimary = Number(row.is_primary || 0) === 1;
    const current = byMuscle.get(key);

    if (!current) {
      byMuscle.set(key, {
        name: displayName || rawName,
        role,
        loadFactor,
        isPrimary,
        baseMuscle,
        order: index,
      });
      return;
    }

    current.loadFactor += loadFactor;
    current.isPrimary = current.isPrimary || isPrimary;
    if ((CATALOG_MUSCLE_ROLE_PRIORITY[role] ?? 99) < (CATALOG_MUSCLE_ROLE_PRIORITY[current.role] ?? 99)) {
      current.role = role;
    }
    if (!current.baseMuscle && baseMuscle) {
      current.baseMuscle = baseMuscle;
    }
  });

  let entries = Array.from(byMuscle.values());
  if (!entries.length && fallbackBodyPart) {
    entries = buildExerciseCatalogFallbackEntries(fallbackBodyPart);
  }

  return {
    entries,
    fallbackEntries: buildExerciseCatalogFallbackEntries(fallbackBodyPart),
    fallbackBaseMuscle,
  };
};

const mapCatalogEntriesToTargets = (entries = []) => {
  if (!Array.isArray(entries) || !entries.length) return [];

  const limitedEntries = [...entries].slice(0, 3);
  const percentages = toRoundedPercentages(limitedEntries.map((entry) => entry.loadFactor));

  return limitedEntries.map((entry, index) => ({
    name: entry.name,
    role: entry.role,
    loadFactor: Number(entry.loadFactor.toFixed(3)),
    isPrimary: entry.isPrimary,
    baseMuscle: entry.baseMuscle || null,
    percent: percentages[index] ?? 0,
  }));
};

const buildVisibleCatalogEntries = (entries = [], fallbackEntries = []) => {
  const targets = entries.filter((entry) => entry.isPrimary || entry.role === 'target');
  const secondary = entries.filter((entry) => entry.role === 'secondary');
  const synergists = entries.filter((entry) => entry.role === 'synergist');
  let visible = targets.length ? targets : secondary.length ? secondary : synergists.length ? synergists : entries;

  if (!visible.length && fallbackEntries.length) visible = fallbackEntries;

  const specificBases = new Set(
    visible
      .filter((entry) => entry.baseMuscle && !GENERIC_CATALOG_TARGET_NAMES.has(String(entry.name || '').trim()))
      .map((entry) => entry.baseMuscle),
  );
  const withoutGenericDuplicates = visible.filter((entry) => !(
    entry.baseMuscle
    && specificBases.has(entry.baseMuscle)
    && GENERIC_CATALOG_TARGET_NAMES.has(String(entry.name || '').trim())
  ));
  if (withoutGenericDuplicates.length) visible = withoutGenericDuplicates;

  visible.sort((left, right) =>
    Number(right.isPrimary) - Number(left.isPrimary)
    || right.loadFactor - left.loadFactor
    || (CATALOG_MUSCLE_ROLE_PRIORITY[left.role] ?? 99) - (CATALOG_MUSCLE_ROLE_PRIORITY[right.role] ?? 99)
    || left.order - right.order
    || String(left.name || '').localeCompare(String(right.name || '')));

  return visible;
};

const buildExerciseCatalogMuscleSections = (rows = []) => {
  const { entries, fallbackEntries } = buildExerciseCatalogMuscleEntries(rows);

  const primaryEntries = entries.filter((entry) => entry.isPrimary || entry.role === 'target');
  const secondaryEntries = entries.filter((entry) =>
    !(entry.isPrimary || entry.role === 'target')
    && ['secondary', 'synergist', 'dynamic_stabilizer', 'stabilizer'].includes(entry.role));

  const primaryMuscles = mapCatalogEntriesToTargets(primaryEntries.length ? primaryEntries : fallbackEntries);
  const primaryNames = new Set(primaryMuscles.map((entry) => String(entry.name || '').trim().toLowerCase()));
  const secondaryMuscles = mapCatalogEntriesToTargets(
    secondaryEntries.filter((entry) => !primaryNames.has(String(entry.name || '').trim().toLowerCase())),
  );

  return {
    muscles: mapCatalogEntriesToTargets(buildVisibleCatalogEntries(entries, fallbackEntries)),
    primaryMuscles,
    secondaryMuscles,
  };
};

const hasSpecificCatalogTargets = (entries = []) =>
  Array.isArray(entries) && entries.some((entry) => {
    const name = String(entry?.name || '').trim();
    return name && !GENERIC_CATALOG_TARGET_NAMES.has(name);
  });

const FRAGMENTED_CATALOG_TARGET_NAMES = new Set([
  'anterior',
  'posterior',
  'lateral',
  'medial',
  'upper',
  'lower',
  'middle',
  'inferior digitations',
]);

const UNFRIENDLY_CATALOG_TARGET_PATTERNS = [
  /\bthighs\b/i,
  /\bgastrocnemius\b/i,
  /\bsoleus\b/i,
  /\bgracilis\b/i,
  /\bpopliteus\b/i,
  /\bbiceps femoris\b/i,
  /\bsemitendinosus\b/i,
  /\bsemimembranosus\b/i,
  /\brectus femoris\b/i,
  /\bvastus (lateralis|medialis|intermedius)\b/i,
  /\b(?:long|short)\s+head\s+biceps\b/i,
  /\b(?:long|lateral|medial)\s+head\s+triceps\b/i,
];

const hasFragmentedCatalogTargets = (entries = []) =>
  Array.isArray(entries) && entries.some((entry) => {
    const name = String(entry?.name || '').trim().toLowerCase();
    if (!name) return false;
    return FRAGMENTED_CATALOG_TARGET_NAMES.has(name)
      || /\b(?:long|short)\s+head\s+biceps\b/.test(name)
      || /\b(?:long|lateral|medial)\s+head\s+triceps\b/.test(name);
  });

const hasUnfriendlyCatalogTargets = (entries = []) =>
  Array.isArray(entries) && entries.some((entry) => {
    const name = String(entry?.name || '').trim();
    return name && UNFRIENDLY_CATALOG_TARGET_PATTERNS.some((pattern) => pattern.test(name));
  });

const hasGenericDuplicateBases = (entries = []) => {
  const specificBases = new Set(
    (Array.isArray(entries) ? entries : [])
      .filter((entry) => {
        const name = String(entry?.name || '').trim();
        return name && !GENERIC_CATALOG_TARGET_NAMES.has(name);
      })
      .map((entry) => String(entry?.baseMuscle || '').trim())
      .filter(Boolean),
  );

  return (Array.isArray(entries) ? entries : []).some((entry) => {
    const name = String(entry?.name || '').trim();
    const baseMuscle = String(entry?.baseMuscle || '').trim();
    return name && GENERIC_CATALOG_TARGET_NAMES.has(name) && baseMuscle && specificBases.has(baseMuscle);
  });
};

const getMuscleSectionQualityScore = (entries = []) => {
  if (!Array.isArray(entries) || !entries.length) return Number.NEGATIVE_INFINITY;

  let score = 0;
  entries.forEach((entry, index) => {
    const name = String(entry?.name || '').trim();
    if (!name) return;

    if (GENERIC_CATALOG_TARGET_NAMES.has(name)) {
      score += 1;
    } else if (UNFRIENDLY_CATALOG_TARGET_PATTERNS.some((pattern) => pattern.test(name))) {
      score -= 1;
    } else {
      score += 3;
    }

    if (entry?.isPrimary || entry?.role === 'target') {
      score += 1;
    } else if (entry?.role === 'secondary') {
      score += 0.5;
    }

    score += Math.max(0, 2 - index) * 0.1;
  });

  if (hasFragmentedCatalogTargets(entries)) score -= 3;
  if (hasGenericDuplicateBases(entries)) score -= 3;
  if (hasUnfriendlyCatalogTargets(entries)) score -= 3;

  return score;
};

const chooseMuscleSection = (catalogEntries = [], fallbackEntries = []) => {
  if (!fallbackEntries.length) return catalogEntries;
  if (!catalogEntries.length) return fallbackEntries;

  const catalogSpecific = hasSpecificCatalogTargets(catalogEntries);
  const fallbackSpecific = hasSpecificCatalogTargets(fallbackEntries);
  if (
    hasFragmentedCatalogTargets(catalogEntries)
    || hasGenericDuplicateBases(catalogEntries)
    || hasUnfriendlyCatalogTargets(catalogEntries)
  ) {
    return fallbackEntries;
  }
  if (!catalogSpecific && (fallbackSpecific || fallbackEntries.length > catalogEntries.length)) {
    return fallbackEntries;
  }
  if (!catalogSpecific && !fallbackSpecific && fallbackEntries.length > catalogEntries.length) {
    return fallbackEntries;
  }

  if (getMuscleSectionQualityScore(fallbackEntries) > getMuscleSectionQualityScore(catalogEntries)) {
    return fallbackEntries;
  }

  return catalogEntries;
};

const buildExerciseCatalogResponse = ({
  rows = [],
  fallbackRows = [],
} = {}) => {
  const catalogSections = buildExerciseCatalogMuscleSections(rows);
  const fallbackSections = buildExerciseCatalogMuscleSections(fallbackRows);
  const primaryMuscles = chooseMuscleSection(catalogSections.primaryMuscles, fallbackSections.primaryMuscles);
  const secondaryMuscles = chooseMuscleSection(catalogSections.secondaryMuscles, fallbackSections.secondaryMuscles)
    .filter((entry) =>
      !primaryMuscles.some((primary) =>
        String(primary?.name || '').trim().toLowerCase() === String(entry?.name || '').trim().toLowerCase()));
  const muscles = primaryMuscles.length
    ? primaryMuscles
    : chooseMuscleSection(catalogSections.muscles, fallbackSections.muscles);

  return {
    muscles,
    primaryMuscles,
    secondaryMuscles,
  };
};

export const listExerciseFilters = async (_req, res) => {
  try {
    const result = await listSupabaseExerciseFilters();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const resolveExerciseMusclesByName = async (req, res) => {
  try {
    const requestedName = String(req.query.name || '').trim();
    const requestedMuscle = String(req.query.muscle || '').trim();
    if (!requestedName) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    const supabaseResult = await resolveSupabaseExerciseMusclesByName({
      name: requestedName,
      muscleHint: requestedMuscle,
    });
    if (supabaseResult) {
      return res.json(supabaseResult);
    }

    const fallbackRows = getExerciseFallbackMuscleRows({
      name: requestedName,
      bodyPart: requestedMuscle || null,
      muscleHint: requestedMuscle || null,
    });
    const genericFallbackRows = fallbackRows.length
      ? fallbackRows
      : (requestedMuscle
        ? [{
            body_part: requestedMuscle,
            muscle_group: requestedMuscle,
            role: 'target',
            load_factor: 1,
            is_primary: 1,
          }]
        : []);

    if (genericFallbackRows.length) {
      return res.json({
        exercise: {
          id: 0,
          name: requestedName,
          bodyPart: requestedMuscle || null,
        },
        ...buildExerciseCatalogResponse({
          rows: [],
          fallbackRows: genericFallbackRows,
        }),
      });
    }

    return res.status(404).json({ error: 'Exercise catalog entry not found' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getExerciseMuscles = async (req, res) => {
  try {
    const exerciseId = Number(req.params.exerciseId || 0);
    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({ error: 'Invalid exercise catalog id' });
    }

    const result = await getSupabaseExerciseMuscles(exerciseId);
    if (!result) {
      return res.status(404).json({ error: 'Exercise catalog entry not found' });
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const listExercises = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 200);
    const limit = Math.min(1000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 1000));
    const offsetRaw = Number(req.query.offset || 0);
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
    const filter = String(req.query.filter || 'All').trim();
    const search = String(req.query.search || '').trim();
    const gender = String(req.query.gender || req.query.audience || '').trim();

    const result = await listSupabaseExercises({
      filter,
      search,
      limit,
      offset,
      gender,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
