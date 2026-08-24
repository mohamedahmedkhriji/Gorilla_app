export type BodyMapBody = 'male' | 'female';

export function resolveBodyMapBody(value: unknown): BodyMapBody {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'female' || normalized === 'woman' || normalized === 'f') {
    return 'female';
  }

  return 'male';
}
