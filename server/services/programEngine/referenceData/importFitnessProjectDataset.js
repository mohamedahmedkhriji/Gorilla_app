import crypto from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { parseCsvObjects } from './csvParser.js';
import { buildReferencePrograms } from './referenceProgram.js';

const DEFAULT_SOURCE = 'fitness.project/program_summary';

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const sha256 = (value) => crypto
  .createHash('sha256')
  .update(value)
  .digest('hex');

const dedupePrograms = (programs) => {
  const seen = new Set();
  const deduped = [];
  let duplicates = 0;

  programs.forEach((program) => {
    if (seen.has(program.externalId)) {
      duplicates += 1;
      return;
    }
    seen.add(program.externalId);
    deduped.push(program);
  });

  return { programs: deduped, duplicates };
};

export const buildFitnessProjectReferenceArtifact = (csvContent, {
  source = DEFAULT_SOURCE,
  sourceFile = 'Data/program_summary.csv',
} = {}) => {
  const parsed = parseCsvObjects(csvContent);
  const rows = parsed.rows.map((item) => ({
    ...item.record,
    rowNumber: item.rowNumber,
    malformed: item.malformed,
  }));
  const normalized = buildReferencePrograms(rows, [], { source });
  const deduped = dedupePrograms(normalized.programs);

  return {
    metadata: {
      dataset: 'fitness.project',
      source,
      sourceFile,
      importMode: 'offline_local_artifact',
      importedAt: 'offline-import',
      datasetVersion: sha256(csvContent).slice(0, 16),
      contentSha256: sha256(csvContent),
      totalRows: rows.length,
      validRows: normalized.programs.length,
      acceptedRows: deduped.programs.length,
      duplicatePrograms: deduped.duplicates,
      invalidRows: normalized.errors.length,
      malformedCsvRows: parsed.rows.filter((item) => item.malformed).length,
    },
    programs: deduped.programs.map((program) => ({
      externalId: program.externalId,
      source: program.source,
      goal: program.goal,
      level: program.level,
      equipment: program.equipment,
      programLengthWeeks: program.programLengthWeeks,
      averageSessionMinutes: program.averageSessionMinutes,
      totalExercises: program.totalExercises,
      inferredDaysPerWeek: program.inferredDaysPerWeek,
    })),
    errors: normalized.errors.slice(0, 100),
  };
};

export const importFitnessProjectReferenceArtifact = async ({
  inputCsvPath,
  outputJsonPath,
  source = DEFAULT_SOURCE,
  sourceFile = 'Data/program_summary.csv',
} = {}) => {
  if (!inputCsvPath) throw new Error('inputCsvPath is required');
  if (!outputJsonPath) throw new Error('outputJsonPath is required');

  const csvContent = await readFile(inputCsvPath, 'utf8');
  const artifact = buildFitnessProjectReferenceArtifact(csvContent, { source, sourceFile });
  await writeFile(outputJsonPath, stableJson(artifact), 'utf8');
  return artifact;
};

