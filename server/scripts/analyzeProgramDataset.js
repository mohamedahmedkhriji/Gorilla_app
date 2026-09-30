#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { analyzeProgramDatasetFiles } from '../services/programEngine/referenceData/analyzeDataset.js';

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    args[arg.slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args['program-summary']) {
    throw new Error('Usage: node server/scripts/analyzeProgramDataset.js --program-summary <path> [--exercise-rows <path>] [--catalog-json <path>] [--out <path>]');
  }

  const canonicalExercises = args['catalog-json']
    ? JSON.parse(await readFile(args['catalog-json'], 'utf8'))
    : [];

  const report = await analyzeProgramDatasetFiles({
    summaryCsvPath: args['program-summary'],
    exerciseCsvPath: args['exercise-rows'] ?? null,
    canonicalExercises,
  });

  const output = JSON.stringify(report, null, 2);
  if (args.out) {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, `${output}\n`, 'utf8');
  } else {
    process.stdout.write(`${output}\n`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
