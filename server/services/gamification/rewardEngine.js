/* eslint-env node */

import pool from '../../database.js';
import { REWARD_RARITY_BY_TYPE } from './config.js';

let rewardIdentityInfrastructurePromise = null;

const ensureRewardIdentityInfrastructure = async () => {
  await pool.execute(
    `ALTER TABLE rewards
     ADD COLUMN IF NOT EXISTS rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL DEFAULT 'common' AFTER value_json`,
  );
  await pool.execute(
    `ALTER TABLE rewards
     ADD COLUMN IF NOT EXISTS identity_key VARCHAR(120) NULL AFTER rarity`,
  );
  await pool.execute(
    `ALTER TABLE rewards
     ADD COLUMN IF NOT EXISTS visual_variant VARCHAR(120) NULL AFTER identity_key`,
  );
};

const ensureRewardIdentityInfrastructureOnce = async () => {
  if (!rewardIdentityInfrastructurePromise) {
    rewardIdentityInfrastructurePromise = ensureRewardIdentityInfrastructure().catch((error) => {
      rewardIdentityInfrastructurePromise = null;
      throw error;
    });
  }
  return rewardIdentityInfrastructurePromise;
};

const parseJsonValue = (value) => {
  if (value == null || typeof value === 'object') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const normalizeRewardIdentityEntry = (reward) => {
  if (!reward || typeof reward !== 'object') return null;

  const rewardType = String(reward.rewardType || reward.reward_type || 'cosmetic').trim() || 'cosmetic';
  const valueJson = parseJsonValue(reward.valueJson ?? reward.value_json);
  const fallbackRarity = REWARD_RARITY_BY_TYPE[rewardType] || 'common';
  const rarity = String(reward.rarity || valueJson?.rarity || fallbackRarity).trim() || fallbackRarity;

  return {
    id: Number(reward.id || reward.reward_id || 0),
    userRewardId: reward.userRewardId == null ? null : Number(reward.userRewardId),
    name: String(reward.name || 'Reward').trim() || 'Reward',
    rewardType,
    rarity,
    description: reward.description == null ? null : String(reward.description || '').trim() || null,
    identityKey: String(reward.identityKey || reward.identity_key || valueJson?.identityKey || '').trim() || null,
    visualVariant: String(reward.visualVariant || reward.visual_variant || valueJson?.visualVariant || '').trim() || null,
    source: {
      type: String(reward.sourceType || reward.source_type || 'manual').trim() || 'manual',
      id: reward.sourceId == null && reward.source_id == null ? null : Number(reward.sourceId ?? reward.source_id),
    },
    valueJson,
    status: String(reward.status || 'available').trim() || 'available',
    grantedAt: reward.grantedAt || reward.granted_at || null,
    consumedAt: reward.consumedAt || reward.consumed_at || null,
  };
};

export const normalizeRewardEntries = (rewards = []) =>
  (Array.isArray(rewards) ? rewards : [])
    .map((reward) => normalizeRewardIdentityEntry(reward))
    .filter(Boolean);

export const fetchAvailableRewards = async (userId, limit = 8) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return [];

  await ensureRewardIdentityInfrastructureOnce();

  const [rows] = await pool.execute(
    `SELECT
        ur.id AS user_reward_id,
        ur.source_type,
        ur.source_id,
        ur.granted_at,
        ur.consumed_at,
        ur.status,
        r.id AS reward_id,
        r.reward_type,
        r.name,
        r.description,
        r.value_json,
        r.rarity,
        r.identity_key,
        r.visual_variant
     FROM user_rewards ur
     JOIN rewards r ON r.id = ur.reward_id
     WHERE ur.user_id = ?
       AND ur.status = 'available'
     ORDER BY ur.granted_at DESC, ur.id DESC
     LIMIT ?`,
    [normalizedUserId, Math.max(1, Math.min(20, Number(limit || 8)))],
  );

  return normalizeRewardEntries(rows.map((row) => ({
    userRewardId: Number(row.user_reward_id || 0),
    id: Number(row.reward_id || 0),
    name: row.name,
    rewardType: row.reward_type,
    description: row.description,
    valueJson: row.value_json,
    rarity: row.rarity,
    identityKey: row.identity_key,
    visualVariant: row.visual_variant,
    sourceType: row.source_type,
    sourceId: row.source_id,
    status: row.status,
    grantedAt: row.granted_at,
    consumedAt: row.consumed_at,
  })));
};
