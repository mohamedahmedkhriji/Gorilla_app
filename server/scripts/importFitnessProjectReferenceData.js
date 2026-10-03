import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { importFitnessProjectReferenceArtifact } from '../services/programEngine/referenceData/importFitnessProjectDataset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..', '..');

const inputCsvPath = resolve(root, 'server/services/programEngine/referenceData/generated/fitness_project_program_summary.csv');
const outputJsonPath = resolve(root, 'server/services/programEngine/referenceData/generated/fitness_project_reference_artifact.json');

const artifact = await importFitnessProjectReferenceArtifact({
  inputCsvPath,
  outputJsonPath,
});

console.log(JSON.stringify({
  outputJsonPath,
  metadata: artifact.metadata,
}, null, 2));

