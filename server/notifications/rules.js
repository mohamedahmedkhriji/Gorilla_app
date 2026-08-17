export const didRecoveryCrossThreshold = (previous, current, threshold = 90) => (
  Number(previous) < threshold && Number(current) >= threshold
);

export const getSubscriptionReminderDays = (expiresAt, now = new Date()) => {
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime()) || !Number.isFinite(now.getTime())) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
};
