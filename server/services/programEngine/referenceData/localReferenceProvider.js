import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const DEFAULT_REFERENCE_ARTIFACT_PATH = resolve(
  __dirname,
  'generated',
  'fitness_project_reference_artifact.json',
);

const bucketDuration = (minutes) => {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return 'unknown';
  if (value <= 37) return 30;
  if (value <= 52) return 45;
  if (value <= 75) return 60;
  return 90;
};

const addToIndex = (index, key, program) => {
  const safeKey = key || 'unknown';
  if (!index[safeKey]) index[safeKey] = [];
  index[safeKey].push(program);
};

export const buildReferenceIndexes = (programs = []) => {
  const byGoal = {};
  const byGoalLevel = {};
  const byGoalLevelDuration = {};
  const byGoalEquipment = {};

  programs.forEach((program) => {
    addToIndex(byGoal, program.goal, program);
    addToIndex(byGoalLevel, `${program.goal}:${program.level}`, program);
    addToIndex(byGoalLevelDuration, `${program.goal}:${program.level}:${bucketDuration(program.averageSessionMinutes)}`, program);
    addToIndex(byGoalEquipment, `${program.goal}:${program.equipment}`, program);
  });

  return {
    byGoal,
    byGoalLevel,
    byGoalLevelDuration,
    byGoalEquipment,
  };
};

export const loadLocalReferenceArtifact = async ({
  artifactPath = DEFAULT_REFERENCE_ARTIFACT_PATH,
} = {}) => {
  const content = await readFile(artifactPath, 'utf8');
  const artifact = JSON.parse(content);
  const programs = Array.isArray(artifact.programs) ? artifact.programs : [];
  return {
    ...artifact,
    indexes: buildReferenceIndexes(programs),
  };
};

export const loadLocalReferencePrograms = async (options = {}) => {
  const artifact = await loadLocalReferenceArtifact(options);
  return {
    metadata: artifact.metadata,
    programs: artifact.programs,
    indexes: artifact.indexes,
  };
};

