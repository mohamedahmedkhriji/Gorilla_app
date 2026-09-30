import { normalizeExerciseName, normalizeMatchKey } from './normalizers.js';

export const buildCatalogIndex = (catalogExercises = []) => {
  const exact = new Map();
  const normalized = new Map();

  catalogExercises.forEach((exercise) => {
    const name = normalizeExerciseName(exercise.name);
    if (!name) return;
    const record = {
      id: exercise.id,
      name,
      slug: exercise.slug ?? null,
    };
    if (!exact.has(name)) exact.set(name, []);
    exact.get(name).push(record);

    const key = normalizeMatchKey(name);
    if (!normalized.has(key)) normalized.set(key, []);
    normalized.get(key).push(record);
  });

  return { exact, normalized };
};

export const matchExerciseName = (externalName, catalogIndex) => {
  const originalName = normalizeExerciseName(externalName);
  const normalizedName = normalizeMatchKey(originalName);

  if (!originalName) {
    return { status: 'UNMAPPED', originalName, normalizedName, candidates: [] };
  }

  const exactCandidates = catalogIndex.exact.get(originalName) ?? [];
  if (exactCandidates.length === 1) {
    return { status: 'EXACT', originalName, normalizedName, match: exactCandidates[0], candidates: exactCandidates };
  }
  if (exactCandidates.length > 1) {
    return { status: 'AMBIGUOUS', originalName, normalizedName, candidates: exactCandidates };
  }

  const normalizedCandidates = catalogIndex.normalized.get(normalizedName) ?? [];
  if (normalizedCandidates.length === 1) {
    return { status: 'NORMALIZED', originalName, normalizedName, match: normalizedCandidates[0], candidates: normalizedCandidates };
  }
  if (normalizedCandidates.length > 1) {
    return { status: 'AMBIGUOUS', originalName, normalizedName, candidates: normalizedCandidates };
  }

  return { status: 'UNMAPPED', originalName, normalizedName, candidates: [] };
};

export const analyzeExerciseMatches = (externalNames = [], catalogExercises = []) => {
  const catalogIndex = buildCatalogIndex(catalogExercises);
  const uniqueNames = [...new Set(externalNames.map(normalizeExerciseName).filter(Boolean))].sort();
  const matches = uniqueNames.map((name) => matchExerciseName(name, catalogIndex));
  const counts = matches.reduce((acc, match) => {
    acc[match.status] += 1;
    return acc;
  }, { EXACT: 0, NORMALIZED: 0, AMBIGUOUS: 0, UNMAPPED: 0 });
  const reliableMatches = counts.EXACT + counts.NORMALIZED;
  const matchPercentage = uniqueNames.length === 0 ? null : Number(((reliableMatches / uniqueNames.length) * 100).toFixed(2));

  return {
    totalUniqueExternalExerciseNames: uniqueNames.length,
    exact: counts.EXACT,
    normalized: counts.NORMALIZED,
    ambiguous: counts.AMBIGUOUS,
    unmapped: counts.UNMAPPED,
    matchPercentage,
    unmappedNames: matches.filter((match) => match.status === 'UNMAPPED').map((match) => match.originalName),
    ambiguousNames: matches
      .filter((match) => match.status === 'AMBIGUOUS')
      .map((match) => ({
        name: match.originalName,
        candidates: match.candidates.map((candidate) => candidate.name),
      })),
    matches,
  };
};
