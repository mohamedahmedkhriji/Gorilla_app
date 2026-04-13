/* eslint-env node */

import pool from '../../database.js';
import { GAMIFICATION_CONFIG, clamp } from './config.js';

let missionChainInfrastructurePromise = null;

const ensureMissionChainInfrastructure = async () => {
  await pool.execute(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS chain_id VARCHAR(80) NULL AFTER metric_key`);
  await pool.execute(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS chain_step INT NULL AFTER chain_id`);
  await pool.execute(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS chain_length INT NULL AFTER chain_step`);
  await pool.execute(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS chain_bonus_xp INT NOT NULL DEFAULT 0 AFTER chain_length`);
  await pool.execute(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS chain_bonus_points INT NOT NULL DEFAULT 0 AFTER chain_bonus_xp`);
  await pool.execute(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS unlock_level INT NULL AFTER chain_bonus_points`);
  await pool.execute(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS unlock_rank VARCHAR(50) NULL AFTER unlock_level`);
};

const ensureMissionChainInfrastructureOnce = async () => {
  if (!missionChainInfrastructurePromise) {
    missionChainInfrastructurePromise = ensureMissionChainInfrastructure().catch((error) => {
      missionChainInfrastructurePromise = null;
      throw error;
    });
  }
  return missionChainInfrastructurePromise;
};

export const enrichMissionCollection = async (missions = []) => {
  const missionList = Array.isArray(missions) ? missions : [];
  const missionIds = [...new Set(
    missionList
      .map((mission) => Number(mission?.mission_id || mission?.id || 0))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];

  if (!missionIds.length) return missionList;

  await ensureMissionChainInfrastructureOnce();

  const placeholders = missionIds.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT
        id,
        chain_id,
        chain_step,
        chain_length,
        chain_bonus_xp,
        chain_bonus_points,
        unlock_level,
        unlock_rank
     FROM missions
     WHERE id IN (${placeholders})`,
    missionIds,
  );

  const missionMetaById = new Map(
    rows.map((row) => [
      Number(row.id),
      {
        chainId: row.chain_id || null,
        chainStep: row.chain_step == null ? null : Number(row.chain_step),
        chainLength: row.chain_length == null ? null : Number(row.chain_length),
        chainBonusXp: Number(row.chain_bonus_xp || 0),
        chainBonusPoints: Number(row.chain_bonus_points || 0),
        unlockLevel: row.unlock_level == null ? null : Number(row.unlock_level),
        unlockRank: row.unlock_rank || null,
      },
    ]),
  );

  return missionList.map((mission) => {
    const missionId = Number(mission?.mission_id || mission?.id || 0);
    const meta = missionMetaById.get(missionId) || null;
    const progress = Math.max(0, Number(mission?.progress || 0));
    const target = Math.max(1, Number(mission?.target || 1));
    const percentComplete = clamp((progress / target) * 100, 0, 100);

    return {
      ...mission,
      percentComplete,
      nearCompletion: percentComplete >= GAMIFICATION_CONFIG.nearCompletion.missionPercent,
      urgentCompletion: percentComplete >= GAMIFICATION_CONFIG.nearCompletion.missionUrgentPercent,
      chain: meta?.chainId
        ? {
            chainId: meta.chainId,
            step: meta.chainStep || 1,
            length: meta.chainLength || 1,
            bonusXp: meta.chainBonusXp || GAMIFICATION_CONFIG.missionChains.defaultBonusXp,
            bonusPoints: meta.chainBonusPoints || GAMIFICATION_CONFIG.missionChains.defaultBonusPoints,
          }
        : null,
      unlock: meta
        ? {
            level: meta.unlockLevel,
            rank: meta.unlockRank,
          }
        : null,
    };
  });
};

export const buildMissionChains = (missions = []) => {
  const chainMap = new Map();

  for (const mission of Array.isArray(missions) ? missions : []) {
    const chainId = mission?.chain?.chainId || null;
    if (!chainId) continue;

    const existing = chainMap.get(chainId) || {
      chainId,
      length: Math.max(1, Number(mission?.chain?.length || 1)),
      completedSteps: 0,
      currentStep: null,
      missions: [],
      bonusXp: Number(mission?.chain?.bonusXp || GAMIFICATION_CONFIG.missionChains.defaultBonusXp),
      bonusPoints: Number(mission?.chain?.bonusPoints || GAMIFICATION_CONFIG.missionChains.defaultBonusPoints),
    };

    existing.missions.push(mission);
    if (mission?.completed) existing.completedSteps += 1;
    if (!mission?.completed && existing.currentStep == null) {
      existing.currentStep = Math.max(1, Number(mission?.chain?.step || 1));
    }

    chainMap.set(chainId, existing);
  }

  return Array.from(chainMap.values())
    .map((chain) => ({
      chainId: chain.chainId,
      length: chain.length,
      completedSteps: chain.completedSteps,
      currentStep: chain.currentStep || Math.min(chain.length, chain.completedSteps + 1),
      percentComplete: clamp((chain.completedSteps / Math.max(1, chain.length)) * 100, 0, 100),
      bonusXp: chain.bonusXp,
      bonusPoints: chain.bonusPoints,
      completed: chain.completedSteps >= chain.length,
      missions: chain.missions.sort((a, b) => Number(a?.chain?.step || 0) - Number(b?.chain?.step || 0)),
    }))
    .sort((a, b) => Number(b.percentComplete || 0) - Number(a.percentComplete || 0));
};
