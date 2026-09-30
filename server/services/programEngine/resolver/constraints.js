const normalize = (value) => String(value ?? '').trim().toLowerCase();

export const parseGenerationConstraints = ({
  equipmentNotes = '',
  injuriesOrMovementsToAvoid = '',
} = {}) => {
  const equipmentText = normalize(equipmentNotes);
  const avoidText = normalize(injuriesOrMovementsToAvoid);

  const requiredEquipment = [];
  const excludedEquipment = [];
  const excludedMovementPatterns = [];
  const rawFlags = [];

  if (/\b(no|without|avoid)\s+barbell\b/.test(equipmentText)) {
    excludedEquipment.push('barbell');
    rawFlags.push('equipment:no_barbell');
  }
  if (/\bdumbbells?\s+only\b|\bonly\s+dumbbells?\b/.test(equipmentText)) {
    requiredEquipment.push('dumbbell');
    excludedEquipment.push('barbell', 'machine', 'cable');
    rawFlags.push('equipment:dumbbell_only');
  }

  if (/\b(avoid|no|without)\s+(overhead\s+press|vertical\s+press|shoulder\s+press)\b/.test(avoidText)) {
    excludedMovementPatterns.push('vertical_press');
    rawFlags.push('avoid:vertical_press');
  }
  if (/\b(avoid|no|without)\s+deadlifts?\b/.test(avoidText)) {
    excludedMovementPatterns.push('deadlift', 'hip_hinge');
    rawFlags.push('avoid:deadlift');
  }
  if (/\b(avoid|no|without)\s+squats?\b/.test(avoidText)) {
    excludedMovementPatterns.push('squat_pattern');
    rawFlags.push('avoid:squat');
  }
  if (/\b(avoid|no|without)\s+(bench\s+press|bench)\b/.test(avoidText)) {
    excludedMovementPatterns.push('bench', 'horizontal_press');
    rawFlags.push('avoid:bench');
  }

  return {
    requiredEquipment: [...new Set(requiredEquipment)],
    excludedEquipment: [...new Set(excludedEquipment)],
    excludedMovementPatterns: [...new Set(excludedMovementPatterns)],
    rawFlags,
    equipmentNotes: String(equipmentNotes ?? ''),
    injuriesOrMovementsToAvoid: String(injuriesOrMovementsToAvoid ?? ''),
  };
};

export const assertNoPowerliftingCompetitionConflict = (goal, constraints) => {
  if (goal !== 'powerlifting') return;
  const excluded = new Set(constraints.excludedMovementPatterns);
  const conflicts = [];
  if (excluded.has('squat_pattern')) conflicts.push('squat');
  if (excluded.has('bench') || excluded.has('horizontal_press')) conflicts.push('bench');
  if (excluded.has('deadlift') || excluded.has('hip_hinge')) conflicts.push('deadlift');
  if (!conflicts.length) return;

  const error = new Error(`Powerlifting cannot be generated when competition movement is explicitly excluded: ${conflicts.join(', ')}`);
  error.name = 'ProgramGenerationConflictError';
  error.code = 'POWERLIFTING_COMPETITION_MOVEMENT_EXCLUDED';
  error.conflicts = conflicts;
  throw error;
};
