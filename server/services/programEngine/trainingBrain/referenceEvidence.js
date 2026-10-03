import { REFERENCE_EVIDENCE_SOURCE } from './config/brainConfig.js';

const normalizeText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const equipmentEvidenceKey = ({ constraints, equipmentNotes }) => {
  if (constraints.requiredEquipment.includes('dumbbell') && constraints.excludedEquipment.includes('barbell')) {
    return 'dumbbell_only';
  }
  const key = normalizeText(equipmentNotes);
  if (key.includes('full gym')) return 'full_gym';
  if (key.includes('home')) return 'home';
  return null;
};

const normalizeReferenceProgram = (program = {}) => ({
  source: program.source || REFERENCE_EVIDENCE_SOURCE,
  goal: program.goal || 'unknown',
  level: program.level || program.experience || 'unknown',
  equipment: program.equipment || 'unknown',
  programLengthWeeks: Number.isFinite(Number(program.programLengthWeeks)) ? Number(program.programLengthWeeks) : null,
  averageSessionMinutes: Number.isFinite(Number(program.averageSessionMinutes)) ? Number(program.averageSessionMinutes) : null,
  inferredDaysPerWeek: Number.isFinite(Number(program.inferredDaysPerWeek)) ? Number(program.inferredDaysPerWeek) : null,
});

export const evaluateReferenceEvidence = ({
  profile,
  candidateStrategy,
  referencePrograms = [],
  constraints,
  referenceMetadata = null,
} = {}) => {
  const normalized = (Array.isArray(referencePrograms) ? referencePrograms : []).map(normalizeReferenceProgram);
  const equipmentKey = equipmentEvidenceKey({ constraints, equipmentNotes: profile?.equipmentNotes });
  const source = normalized[0]?.source || REFERENCE_EVIDENCE_SOURCE;

  const goalMatches = normalized.filter((program) => program.goal === profile.goal);
  const levelMatches = goalMatches.filter((program) => program.level === profile.experience);
  const durationMatches = goalMatches.filter((program) =>
    program.averageSessionMinutes != null
    && Math.abs(program.averageSessionMinutes - Number(profile.sessionDurationMinutes)) <= 15);
  const equipmentMatches = equipmentKey
    ? goalMatches.filter((program) => program.equipment === equipmentKey)
    : [];
  const programLengthMatches = goalMatches.filter((program) => program.programLengthWeeks === 8);
  const candidateDaysPerWeek = Number(candidateStrategy?.daysPerWeek ?? profile?.daysPerWeek);
  const inferredDaysMatches = goalMatches.filter((program) => program.inferredDaysPerWeek === candidateDaysPerWeek);

  const matched = goalMatches.filter((program) => {
    if (program.level !== 'unknown' && program.level !== profile.experience) return false;
    if (program.averageSessionMinutes != null && Math.abs(program.averageSessionMinutes - Number(profile.sessionDurationMinutes)) > 15) return false;
    if (equipmentKey && program.equipment !== 'unknown' && program.equipment !== equipmentKey) return false;
    return true;
  });

  let supportLevel = 'none';
  if (matched.length >= 10 && levelMatches.length > 0 && durationMatches.length > 0) supportLevel = 'strong';
  else if (matched.length >= 3) supportLevel = 'moderate';
  else if (matched.length > 0) supportLevel = 'weak';

  return {
    used: normalized.length > 0,
    available: normalized.length > 0,
    dataset: referenceMetadata?.dataset ?? 'fitness.project',
    datasetVersion: referenceMetadata?.datasetVersion ?? null,
    source,
    candidateStrategy: candidateStrategy?.splitId || candidateStrategy?.id || null,
    matchedCount: matched.length,
    supportLevel,
    evidence: {
      availablePrograms: normalized.length,
      goalMatches: goalMatches.length,
      levelMatches: levelMatches.length,
      durationMatches: durationMatches.length,
      equipmentMatches: equipmentMatches.length,
      programLengthMatches: programLengthMatches.length,
      inferredDaysMatches: inferredDaysMatches.length,
      inferredDaysAreLowerConfidence: true,
    },
  };
};
