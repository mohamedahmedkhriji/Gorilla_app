const bronzeBadge = new URL('../../assets/Ranking/Bronze.png', import.meta.url).href;
const silverBadge = new URL('../../assets/Ranking/Silver.png', import.meta.url).href;
const goldBadge = new URL('../../assets/Ranking/Gold.png', import.meta.url).href;
const platinumBadge = new URL('../../assets/Ranking/Platinum.png', import.meta.url).href;
const diamondBadge = new URL('../../assets/Ranking/Diamond.png', import.meta.url).href;

export const rankCardIcon = new URL('../../assets/Ranking/rank CARD ICON.png', import.meta.url).href;
export const rankTopScoreIcon = new URL('../../assets/Ranking/TOP SCARE ALL TIME.png', import.meta.url).href;

const normalizeRankName = (value: unknown) => String(value || '').trim().toLowerCase();

export const getRankBadgeImage = (rankName: unknown) => {
  const normalized = normalizeRankName(rankName);
  if (normalized.includes('elite')) return diamondBadge;
  if (normalized.includes('diamond')) return diamondBadge;
  if (normalized.includes('platinum')) return platinumBadge;
  if (normalized.includes('gold')) return goldBadge;
  if (normalized.includes('silver')) return silverBadge;
  return bronzeBadge;
};
