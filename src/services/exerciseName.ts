export const stripExercisePrefix = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return trimmed;
  const next = trimmed.replace(
    /^(?:\/\d+|\d+(?:\.\d+)?)(?:\s*[-x×/._\u2010\u2011\u2012\u2013\u2014\u2212]*\s*)?/i,
    '',
  ).trim();
  return next || trimmed;
};
