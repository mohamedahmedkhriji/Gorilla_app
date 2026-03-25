import express from 'express';
import fs from 'fs/promises';
import process from 'node:process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database.js';
import {
  createAuthToken,
  createSimpleRateLimit,
  getBearerToken,
  getRoleSocketType,
  hashPassword,
  verifyAuthToken,
  verifyPasswordWithUpgrade,
} from './auth.js';
import {
  adaptProgramBiWeekly,
  adaptProgramWeeklyByInsights,
  captureWeeklyValidationSnapshot,
  generatePersonalizedProgram,
  getMonthlyValidationCalibration,
  getUserPlanValidationHistory,
} from './services/planGenerator.js';
import { buildOnboardingInsights, buildUserAnalysisInsights, getDatasetOverview } from './services/fitnessInsights.js';
import {
  getUserInsightsHistory,
  saveOnboardingInsightsForUser,
  saveUserAnalysisInsightsForUser,
} from './services/insightPersistence.js';
import { generateDailyNutritionPlan } from './services/nutritionPlanner.js';
import { resolveExerciseVideoManifest } from '../src/shared/exerciseVideoManifest.js';
import {
  buildCustomProgramPayloadFromClaudePlan,
  generateTwoMonthPlanWithClaude,
  hasAnthropicConfig,
} from './services/claudeCoach.js';
import { processGamificationProgression } from './services/progressionService.js';
import { hasOpenAIConfig, requestOpenAIChatCompletion } from './services/openaiProxy.js';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ONBOARDING_CONFIG_PATH = path.join(__dirname, 'onboarding-config.json');

router.get('/onboarding/config', async (_req, res) => {
  try {
    const raw = await fs.readFile(ONBOARDING_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return res.json(parsed);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return res.status(404).json({ error: 'Onboarding config not found' });
    }
    console.error('Failed to load onboarding config:', error?.message || error);
    return res.status(500).json({ error: 'Failed to load onboarding config' });
  }
});

let profileImageColumnCache;
let workoutSessionColumnsCache;
const authLoginRateLimit = createSimpleRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keySelector: (req) => `${req.ip || 'unknown'}:${String(req.body?.email || '').trim().toLowerCase() || 'anonymous'}`,
});
const authMutationRateLimit = createSimpleRateLimit({ windowMs: 60 * 1000, max: 40 });
const aiRouteRateLimit = createSimpleRateLimit({
  windowMs: 60 * 1000,
  max: 8,
  keySelector: (req) => String(req.authUser?.id || req.ip || 'unknown'),
});
const BI_WEEKLY_CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const BI_WEEKLY_CLAUDE_TIMEOUT_MS = 45_000;
const getBiWeeklyReportOpenAIModel = () => String(
  process.env.OPENAI_BIWEEKLY_REPORT_MODEL
  || process.env.OPENAI_MODEL
  || 'gpt-4o',
).trim() || 'gpt-4o';
const getBiWeeklyReportClaudeModel = () => String(
  process.env.ANTHROPIC_BIWEEKLY_REPORT_MODEL
  || process.env.ANTHROPIC_MODEL
  || 'claude-sonnet-4-6',
).trim() || 'claude-sonnet-4-6';

const ALLOWED_ASSIGNMENT_SOURCES = new Set(['ai', 'coach', 'admin', 'manual']);

const normalizeAssignmentSource = (value, fallback = 'manual') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (ALLOWED_ASSIGNMENT_SOURCES.has(normalized)) return normalized;
  if (normalized === 'template' || normalized === 'onboarding' || normalized === 'user') return 'manual';
  return ALLOWED_ASSIGNMENT_SOURCES.has(String(fallback || '').trim().toLowerCase())
    ? String(fallback).trim().toLowerCase()
    : 'manual';
};

const getBiWeeklyReportOpenAIKey = () => String(process.env.OPENAI_BIWEEKLY_REPORT_API_KEY || '').trim();

const extractJsonObjectFromText = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const candidates = [];
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }
  candidates.push(raw);

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  return null;
};

const normalizeBiWeeklyReportText = (value, fallback, maxLength) => {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return String(fallback || '').trim();
  return normalized.slice(0, maxLength);
};

const normalizeBiWeeklyReportItems = (items, fallbackItems = []) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({
      title: normalizeBiWeeklyReportText(item?.title, '', 48),
      detail: normalizeBiWeeklyReportText(item?.detail, '', 180),
    }))
    .filter((item) => item.title && item.detail)
    .slice(0, 3);

  if (normalized.length) return normalized;

  return (Array.isArray(fallbackItems) ? fallbackItems : [])
    .map((item) => ({
      title: normalizeBiWeeklyReportText(item?.title, '', 48),
      detail: normalizeBiWeeklyReportText(item?.detail, '', 180),
    }))
    .filter((item) => item.title && item.detail)
    .slice(0, 3);
};

const getBiWeeklyReportLanguage = (req) => {
  const raw = String(req.headers['accept-language'] || '').trim().toLowerCase();
  if (/(^|,|\s)ar\b/.test(raw)) return 'ar';
  if (/(^|,|\s)it\b/.test(raw)) return 'it';
  if (/(^|,|\s)de\b/.test(raw)) return 'de';
  return 'en';
};

const getBiWeeklyReportAiUnavailableLegacyNotice = (req) => {
  const language = getBiWeeklyReportLanguage(req);
  if (language === 'ar') {
    return 'OpenAI غير متاح حالياً. يتم عرض التقرير القياسي بدلاً من ذلك.';
  }
  if (language === 'it') {
    return 'L\'AI non e disponibile al momento. Mostriamo invece il report standard.';
  }
  if (language === 'de') {
    return 'KI ist im Moment nicht verfugbar. Stattdessen wird der Standardbericht angezeigt.';
  }
  return 'AI unavailable right now. Showing the standard report instead.';
};

const getBiWeeklyReportAiUnavailableNotice = (req) => {
  return getBiWeeklyReportAiUnavailableLegacyNotice(req);
};

const maybeGenerateOpenAIBiWeeklyReport = async ({
  req,
  periodDays,
  metrics,
  fallbackSummary,
  improvementCandidates,
  nextFocusCandidates,
}) => {
  const biWeeklyOpenAiKey = getBiWeeklyReportOpenAIKey();
  if (!biWeeklyOpenAiKey) return null;

  const language = getBiWeeklyReportLanguage(req);
  const userPromptPayload = {
    language,
    periodDays,
    metrics: {
      consistency: metrics.consistency,
      completedSessions: metrics.completedSessions,
      plannedSessions: metrics.plannedSessions,
      totalVolumeTons: Number((Number(metrics.totalVolume14d || 0) / 1000).toFixed(1)),
      avgRecovery: metrics.avgRecovery,
    },
    improvementCandidates: normalizeBiWeeklyReportItems(improvementCandidates),
    nextFocusCandidates: normalizeBiWeeklyReportItems(nextFocusCandidates),
    fallbackSummary,
  };

  const response = await requestOpenAIChatCompletion({
    apiKey: biWeeklyOpenAiKey,
    model: getBiWeeklyReportOpenAIModel(),
    temperature: 0.3,
    maxTokens: 500,
    messages: [
      {
        role: 'system',
        content: [
          'You are a fitness coach writing a concise bi-weekly progress report for a mobile app.',
          'Return valid JSON only with this exact shape:',
          '{"summary":"string","improvements":[{"title":"string","detail":"string"}],"nextFocus":[{"title":"string","detail":"string"}]}',
          'Use only the data provided.',
          'Do not invent metrics or training events.',
          'Keep the summary to 2-3 short sentences.',
          'Keep titles short and actionable.',
          'Return up to 3 items for improvements and up to 3 items for nextFocus.',
          language === 'ar'
            ? 'Write all user-facing text in Arabic.'
            : language === 'it'
              ? 'Write all user-facing text in Italian.'
              : language === 'de'
                ? 'Write all user-facing text in German.'
                : 'Write all user-facing text in English.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify(userPromptPayload),
      },
    ],
  });

  const parsed = extractJsonObjectFromText(response.content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('OpenAI bi-weekly report returned invalid JSON');
  }

  return {
    summary: normalizeBiWeeklyReportText(parsed.summary, fallbackSummary, 320),
    improvements: normalizeBiWeeklyReportItems(parsed.improvements, improvementCandidates),
    nextFocus: normalizeBiWeeklyReportItems(parsed.nextFocus, nextFocusCandidates),
    aiModel: response.model,
    aiProvider: 'openai',
  };
};

const extractClaudeTextFromResponse = (responsePayload) => {
  const contentBlocks = Array.isArray(responsePayload?.content) ? responsePayload.content : [];
  const text = contentBlocks
    .filter((block) => block?.type === 'text')
    .map((block) => String(block?.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Claude bi-weekly report returned no text content');
  }

  return text;
};

const buildClaudeBiWeeklyErrorDetails = ({ rawBody, parsedBody }) => {
  const parsedMessage = String(parsedBody?.error?.message || parsedBody?.message || '').trim();
  if (parsedMessage) return parsedMessage.slice(0, 300);
  return String(rawBody || 'Unknown Claude API error')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
};

const maybeGenerateClaudeBiWeeklyReport = async ({
  req,
  periodDays,
  metrics,
  fallbackSummary,
  improvementCandidates,
  nextFocusCandidates,
}) => {
  if (!hasAnthropicConfig()) return null;

  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return null;

  const model = getBiWeeklyReportClaudeModel();
  const language = getBiWeeklyReportLanguage(req);
  const userPromptPayload = {
    language,
    periodDays,
    metrics: {
      consistency: metrics.consistency,
      completedSessions: metrics.completedSessions,
      plannedSessions: metrics.plannedSessions,
      totalVolumeTons: Number((Number(metrics.totalVolume14d || 0) / 1000).toFixed(1)),
      avgRecovery: metrics.avgRecovery,
    },
    improvementCandidates: normalizeBiWeeklyReportItems(improvementCandidates),
    nextFocusCandidates: normalizeBiWeeklyReportItems(nextFocusCandidates),
    fallbackSummary,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BI_WEEKLY_CLAUDE_TIMEOUT_MS);

  let response;
  let rawBody = '';
  let parsedResponse = null;

  try {
    response = await fetch(BI_WEEKLY_CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.3,
        system: [
          'You are a fitness coach writing a concise bi-weekly progress report for a mobile app.',
          'Return valid JSON only with this exact shape:',
          '{"summary":"string","improvements":[{"title":"string","detail":"string"}],"nextFocus":[{"title":"string","detail":"string"}]}',
          'Use only the data provided.',
          'Do not invent metrics or training events.',
          'Keep the summary to 2-3 short sentences.',
          'Keep titles short and actionable.',
          'Return up to 3 items for improvements and up to 3 items for nextFocus.',
          language === 'ar'
            ? 'Write all user-facing text in Arabic.'
            : language === 'it'
              ? 'Write all user-facing text in Italian.'
              : language === 'de'
                ? 'Write all user-facing text in German.'
                : 'Write all user-facing text in English.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: JSON.stringify(userPromptPayload),
          },
        ],
      }),
      signal: controller.signal,
    });

    rawBody = await response.text();
    try {
      parsedResponse = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedResponse = null;
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Claude bi-weekly report request timed out');
    }
    throw new Error(error?.message || 'Claude bi-weekly report request failed');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `Claude bi-weekly report failed (${response.status}): ${buildClaudeBiWeeklyErrorDetails({
        rawBody,
        parsedBody: parsedResponse,
      })}`,
    );
  }

  const rawText = extractClaudeTextFromResponse(parsedResponse);
  const parsed = extractJsonObjectFromText(rawText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude bi-weekly report returned invalid JSON');
  }

  return {
    summary: normalizeBiWeeklyReportText(parsed.summary, fallbackSummary, 320),
    improvements: normalizeBiWeeklyReportItems(parsed.improvements, improvementCandidates),
    nextFocus: normalizeBiWeeklyReportItems(parsed.nextFocus, nextFocusCandidates),
    aiModel: String(parsedResponse?.model || model).trim() || model,
    aiProvider: 'claude',
  };
};

const getProfileImageColumn = async () => {
  if (profileImageColumnCache !== undefined) return profileImageColumnCache;

  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('profile_picture', 'profile_photo')`
  );

  const columns = new Set(rows.map((r) => r.COLUMN_NAME || r.column_name));

  if (columns.has('profile_picture')) {
    profileImageColumnCache = 'profile_picture';
  } else if (columns.has('profile_photo')) {
    profileImageColumnCache = 'profile_photo';
  } else {
    profileImageColumnCache = null;
  }

  return profileImageColumnCache;
};

const getProfileImageColumnMaxLength = async (columnName) => {
  const [rows] = await pool.execute(
    `SELECT CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [columnName]
  );

  if (!rows.length) return null;
  return rows[0].CHARACTER_MAXIMUM_LENGTH ?? rows[0].character_maximum_length ?? null;
};

const normalizeUser = (user) => {
  if (!user) return null;
  const safeUser = { ...user };
  delete safeUser.password;
  return safeUser;
};

const getExistingTableColumns = async (conn, tableName, candidateColumns) => {
  const normalizedColumns = [...new Set(
    (Array.isArray(candidateColumns) ? candidateColumns : [])
      .map((columnName) => String(columnName || '').trim())
      .filter(Boolean),
  )];
  if (!normalizedColumns.length) return [];

  const placeholders = normalizedColumns.map(() => '?').join(', ');
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME IN (${placeholders})`,
    [tableName, ...normalizedColumns],
  );

  const existingColumns = new Set(
    rows.map((row) => String(row.COLUMN_NAME || row.column_name || '').trim()).filter(Boolean),
  );
  return normalizedColumns.filter((columnName) => existingColumns.has(columnName));
};

const deleteRowsByMatchingUserColumns = async (conn, tableName, userId, candidateColumns) => {
  const existingColumns = await getExistingTableColumns(conn, tableName, candidateColumns);
  if (!existingColumns.length) return 0;

  const whereClause = existingColumns.map((columnName) => `\`${columnName}\` = ?`).join(' OR ');
  const [result] = await conn.execute(
    `DELETE FROM \`${tableName}\` WHERE ${whereClause}`,
    existingColumns.map(() => userId),
  );

  return Number(result?.affectedRows || 0);
};

const loadIdsByMatchingUserColumns = async (conn, tableName, idColumn, userId, candidateColumns) => {
  const [existingIdColumn] = await getExistingTableColumns(conn, tableName, [idColumn]);
  if (!existingIdColumn) return [];

  const existingColumns = await getExistingTableColumns(conn, tableName, candidateColumns);
  if (!existingColumns.length) return [];

  const whereClause = existingColumns.map((columnName) => `\`${columnName}\` = ?`).join(' OR ');
  const [rows] = await conn.execute(
    `SELECT DISTINCT \`${existingIdColumn}\` AS id
     FROM \`${tableName}\`
     WHERE ${whereClause}`,
    existingColumns.map(() => userId),
  );

  return rows
    .map((row) => Number(row.id || 0))
    .filter((id, index, values) => Number.isFinite(id) && id > 0 && values.indexOf(id) === index);
};

const deleteRowsByIdList = async (conn, tableName, columnName, ids) => {
  const normalizedIds = [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map((value) => Number(value || 0))
      .filter((id) => Number.isFinite(id) && id > 0),
  )];
  if (!normalizedIds.length) return 0;

  const [existingColumn] = await getExistingTableColumns(conn, tableName, [columnName]);
  if (!existingColumn) return 0;

  const placeholders = normalizedIds.map(() => '?').join(', ');
  const [result] = await conn.execute(
    `DELETE FROM \`${tableName}\` WHERE \`${existingColumn}\` IN (${placeholders})`,
    normalizedIds,
  );

  return Number(result?.affectedRows || 0);
};

const loadIdsByForeignKeyValues = async (conn, tableName, idColumn, foreignKeyColumn, ids) => {
  const normalizedIds = [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map((value) => Number(value || 0))
      .filter((id) => Number.isFinite(id) && id > 0),
  )];
  if (!normalizedIds.length) return [];

  const [existingIdColumn] = await getExistingTableColumns(conn, tableName, [idColumn]);
  const [existingForeignKeyColumn] = await getExistingTableColumns(conn, tableName, [foreignKeyColumn]);
  if (!existingIdColumn || !existingForeignKeyColumn) return [];

  const placeholders = normalizedIds.map(() => '?').join(', ');
  const [rows] = await conn.execute(
    `SELECT DISTINCT \`${existingIdColumn}\` AS id
     FROM \`${tableName}\`
     WHERE \`${existingForeignKeyColumn}\` IN (${placeholders})`,
    normalizedIds,
  );

  return rows
    .map((row) => Number(row.id || 0))
    .filter((id, index, values) => Number.isFinite(id) && id > 0 && values.indexOf(id) === index);
};

const hardDeleteUserAccount = async (conn, userId) => {
  const directCleanupTargets = [
    { tableName: 'messages', columns: ['sender_id', 'receiver_id'] },
    { tableName: 'notifications', columns: ['user_id'] },
    { tableName: 'invitations', columns: ['from_user_id', 'to_user_id'] },
    { tableName: 'friendships', columns: ['user_id', 'friend_id', 'initiated_by'] },
    { tableName: 'friend_challenge_sessions', columns: ['sender_user_id', 'receiver_user_id', 'winner_user_id'] },
    { tableName: 'friend_challenge_results', columns: ['participant_a_id', 'participant_b_id', 'submitted_by_user_id', 'winner_user_id', 'loser_user_id'] },
    { tableName: 'program_change_requests', columns: ['user_id', 'proposed_by_user_id'] },
    { tableName: 'program_change_log', columns: ['user_id', 'changed_by_user_id'] },
    { tableName: 'program_assignments', columns: ['user_id'] },
    { tableName: 'recovery_factors', columns: ['user_id'] },
    { tableName: 'workout_sessions', columns: ['user_id'] },
    { tableName: 'muscle_recovery_status', columns: ['user_id'] },
    { tableName: 'recovery_history', columns: ['user_id'] },
    { tableName: 'training_readiness', columns: ['user_id'] },
    { tableName: 'user_notification_settings', columns: ['user_id'] },
    { tableName: 'user_health_snapshots', columns: ['user_id'] },
    { tableName: 'user_insight_scores', columns: ['user_id'] },
    { tableName: 'user_scoring_experiment_assignments', columns: ['user_id'] },
    { tableName: 'plan_adaptations', columns: ['user_id'] },
    { tableName: 'plan_recommendation_outcomes', columns: ['user_id'] },
    { tableName: 'xp_transactions', columns: ['user_id'] },
    { tableName: 'user_xp', columns: ['user_id'] },
    { tableName: 'user_missions', columns: ['user_id'] },
    { tableName: 'user_challenges', columns: ['user_id'] },
    { tableName: 'user_badges', columns: ['user_id'] },
    { tableName: 'user_badge_progress', columns: ['user_id'] },
    { tableName: 'user_achievements', columns: ['user_id'] },
    { tableName: 'user_rewards', columns: ['user_id'] },
    { tableName: 'blog_posts', columns: ['user_id'] },
    { tableName: 'blog_post_likes', columns: ['user_id'] },
    { tableName: 'blog_post_views', columns: ['user_id'] },
    { tableName: 'blog_post_comments', columns: ['user_id'] },
    { tableName: 'blog_post_reactions', columns: ['user_id'] },
    { tableName: 'workout_day_summaries', columns: ['user_id'] },
    { tableName: 'missed_program_days', columns: ['user_id'] },
    { tableName: 'progress_photos', columns: ['user_id'] },
    { tableName: 'body_measurements', columns: ['user_id'] },
  ];

  const ownedProgramIds = await loadIdsByMatchingUserColumns(
    conn,
    'programs',
    'id',
    userId,
    ['target_user_id', 'created_by_user_id', 'user_id'],
  );
  const workoutIds = await loadIdsByForeignKeyValues(conn, 'workouts', 'id', 'program_id', ownedProgramIds);

  await deleteRowsByIdList(conn, 'workout_exercises', 'workout_id', workoutIds);
  await deleteRowsByIdList(conn, 'workouts', 'id', workoutIds);
  await deleteRowsByIdList(conn, 'program_change_requests', 'approved_program_id', ownedProgramIds);
  await deleteRowsByIdList(conn, 'program_change_log', 'old_program_id', ownedProgramIds);
  await deleteRowsByIdList(conn, 'program_change_log', 'new_program_id', ownedProgramIds);
  await deleteRowsByIdList(conn, 'program_assignments', 'program_id', ownedProgramIds);
  await deleteRowsByIdList(conn, 'plan_adaptations', 'program_id', ownedProgramIds);
  await deleteRowsByIdList(conn, 'plan_recommendation_outcomes', 'program_id', ownedProgramIds);
  await deleteRowsByIdList(conn, 'programs', 'id', ownedProgramIds);

  for (const target of directCleanupTargets) {
    await deleteRowsByMatchingUserColumns(conn, target.tableName, userId, target.columns);
  }

  const [result] = await conn.execute(
    "DELETE FROM users WHERE id = ? AND role = 'user' LIMIT 1",
    [userId],
  );

  return Number(result?.affectedRows || 0);
};

const loadResettableUserIdsForActor = async (conn, authUser) => {
  const authRole = String(authUser?.role || '').trim();

  if (authRole === 'coach') {
    const coachId = Number(authUser?.id || 0);
    if (!coachId) return [];

    const [rows] = await conn.execute(
      `SELECT id
       FROM users
       WHERE role = 'user' AND coach_id = ?`,
      [coachId],
    );

    return rows
      .map((row) => Number(row.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  if (authRole === 'gym_owner') {
    const gymId = Number(authUser?.gym_id || 0);
    if (!gymId) return [];

    const [rows] = await conn.execute(
      `SELECT id
       FROM users
       WHERE role = 'user' AND gym_id = ?`,
      [gymId],
    );

    return rows
      .map((row) => Number(row.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  return [];
};

const buildCoachLoginPayload = (user) => ({
  id: Number(user?.id || 0),
  name: String(user?.name || '').trim() || 'Coach',
  gym: user?.gym_id ? [Number(user.gym_id)] : [],
});

const loadAuthenticatedUser = async (req) => {
  if (req.authUser !== undefined) return req.authUser;

  const token = getBearerToken(req.headers || {});
  const decoded = verifyAuthToken(token);
  if (!decoded?.userId) {
    req.authUser = null;
    return req.authUser;
  }

  const [rows] = await pool.execute(
    `SELECT *
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [decoded.userId],
  );

  if (!rows.length) {
    req.authUser = null;
    return req.authUser;
  }

  const user = normalizeUser(rows[0]);
  const normalizedRole = String(user?.role || '').trim();
  if (decoded.role && normalizedRole !== decoded.role) {
    req.authUser = null;
    return req.authUser;
  }

  if (Number(user?.is_active || 0) !== 1) {
    req.authUser = null;
    return req.authUser;
  }

  req.authUser = user;
  return req.authUser;
};

const requireAuth = (...roles) => async (req, res, next) => {
  try {
    const authUser = await loadAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (roles.length && !roles.includes(String(authUser.role || ''))) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }

    return next();
  } catch (error) {
    return res.status(401).json({ error: error?.message || 'Authentication failed' });
  }
};

const getUserAccessContext = async (authUser, targetUserId) => {
  const normalizedTargetUserId = Number(targetUserId || 0);
  if (!authUser || !normalizedTargetUserId) {
    return { allowed: false, targetUser: null };
  }

  const [rows] = await pool.execute(
    `SELECT id, role, coach_id, gym_id, is_active
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [normalizedTargetUserId],
  );

  const targetUser = rows[0] || null;
  if (!targetUser) {
    return { allowed: false, targetUser: null };
  }

  const authUserId = Number(authUser.id || 0);
  const authRole = String(authUser.role || '').trim();
  const sameGym = Number(authUser.gym_id || 0) > 0 && Number(authUser.gym_id || 0) === Number(targetUser.gym_id || 0);
  const assignedCoach = authRole === 'coach' && Number(targetUser.coach_id || 0) === authUserId;

  return {
    allowed: false,
    targetUser,
    self: authUserId === normalizedTargetUserId,
    sameGymOwner: authRole === 'gym_owner' && sameGym,
    assignedCoach,
  };
};

const requireUserAccess = (
  getTargetUserId,
  {
    allowSelf = true,
    allowAssignedCoach = false,
    allowGymOwner = false,
  } = {},
) => async (req, res, next) => {
  try {
    const authUser = await loadAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rawTargetUserId = typeof getTargetUserId === 'function'
      ? getTargetUserId(req)
      : req.params?.[getTargetUserId];
    const targetUserId = Number(rawTargetUserId || 0);
    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const access = await getUserAccessContext(authUser, targetUserId);
    if (!access.targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allowed =
      (allowSelf && access.self)
      || (allowAssignedCoach && access.assignedCoach)
      || (allowGymOwner && access.sameGymOwner);

    if (!allowed) {
      return res.status(403).json({ error: 'You do not have permission to access this user' });
    }

    req.targetUser = access.targetUser;
    return next();
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Authorization failed' });
  }
};

const requireCoachScope = (getCoachId) => async (req, res, next) => {
  try {
    const authUser = await loadAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const requestedCoachId = Number(
      (typeof getCoachId === 'function' ? getCoachId(req) : req.params?.[getCoachId]) || 0,
    );
    if (!requestedCoachId) {
      return res.status(400).json({ error: 'Invalid coach id' });
    }

    const authRole = String(authUser.role || '').trim();
    if (authRole === 'coach' && Number(authUser.id || 0) !== requestedCoachId) {
      return res.status(403).json({ error: 'You do not have permission to access this coach scope' });
    }
    if (!['coach', 'gym_owner'].includes(authRole)) {
      return res.status(403).json({ error: 'You do not have permission to access this coach scope' });
    }

    req.authorizedCoachId = requestedCoachId;
    return next();
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Authorization failed' });
  }
};

const requireConversationAccess = async (req, res, next) => {
  try {
    const authUser = await loadAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = Number(req.params?.userId || 0);
    const coachId = Number(req.params?.coachId || 0);
    if (!userId || !coachId) {
      return res.status(400).json({ error: 'Invalid conversation participant ids' });
    }

    if (String(authUser.role || '') === 'user') {
      if (Number(authUser.id || 0) !== userId || Number(authUser.coach_id || 0) !== coachId) {
        return res.status(403).json({ error: 'You do not have permission to access this conversation' });
      }
      return next();
    }

    if (String(authUser.role || '') === 'coach') {
      if (Number(authUser.id || 0) !== coachId) {
        return res.status(403).json({ error: 'You do not have permission to access this conversation' });
      }

      const [rows] = await pool.execute(
        `SELECT coach_id
         FROM users
         WHERE id = ? AND role = 'user'
         LIMIT 1`,
        [userId],
      );
      if (!rows.length || Number(rows[0].coach_id || 0) !== coachId) {
        return res.status(403).json({ error: 'You do not have permission to access this conversation' });
      }
      return next();
    }

    return res.status(403).json({ error: 'You do not have permission to access this conversation' });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Authorization failed' });
  }
};

const requireNotificationOwner = async (req, res, next) => {
  try {
    const authUser = await loadAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const notificationId = Number(req.params?.notificationId || 0);
    if (!notificationId) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const [rows] = await pool.execute(
      `SELECT user_id
       FROM notifications
       WHERE id = ?
       LIMIT 1`,
      [notificationId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (Number(rows[0].user_id || 0) !== Number(authUser.id || 0)) {
      return res.status(403).json({ error: 'You do not have permission to update this notification' });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Authorization failed' });
  }
};

const toNumber = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toGamificationPayload = (gamification) => (gamification
  ? {
      totalPoints: gamification.totalPoints,
      rank: gamification.rank,
      completedMissions: gamification.completedMissions,
      completedChallenges: gamification.completedChallenges,
    }
  : null);

const runProgressionEventSafely = async (params) => {
  try {
    return await processGamificationProgression(params);
  } catch (error) {
    console.error('Progression event failed:', error?.message || error);
    return null;
  }
};

const getOrderedFriendPair = (userIdA, userIdB) => {
  const a = Number(userIdA || 0);
  const b = Number(userIdB || 0);
  if (!a || !b) return null;
  return a < b ? { userId: a, friendId: b } : { userId: b, friendId: a };
};

const getFriendPairMapKey = (userIdA, userIdB) => {
  const pair = getOrderedFriendPair(userIdA, userIdB);
  if (!pair) return '';
  return `${pair.userId}:${pair.friendId}`;
};

const resolveFriendRelationshipStatus = (friendship, currentUserId) => {
  if (!friendship) return 'none';
  const rawStatus = String(friendship.status || '').trim().toLowerCase();
  if (rawStatus === 'accepted') return 'accepted';
  if (rawStatus === 'pending') {
    return Number(friendship.initiated_by) === Number(currentUserId)
      ? 'outgoing_pending'
      : 'incoming_pending';
  }
  return 'none';
};

const getAcceptedFriendship = async (userIdA, userIdB) => {
  const pair = getOrderedFriendPair(userIdA, userIdB);
  if (!pair) return null;

  const [rows] = await pool.execute(
    `SELECT id, user_id, friend_id, status, initiated_by, accepted_at
     FROM friendships
     WHERE user_id = ? AND friend_id = ?
     LIMIT 1`,
    [pair.userId, pair.friendId],
  );

  const friendship = rows[0] || null;
  if (!friendship) return null;
  return String(friendship.status || '').trim().toLowerCase() === 'accepted'
    ? friendship
    : null;
};

const normalizeChallengeInviteKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const defaultChallengeInviteTitle = (challengeKey) => {
  const normalizedKey = normalizeChallengeInviteKey(challengeKey);
  if (normalizedKey === 'push_up_duel') return 'Push-Up Duel';
  if (normalizedKey === 'squat_rep_race') return 'Squat Rep Race';
  if (normalizedKey === 'bench_press') return 'Bench Press';
  if (normalizedKey === 'deadlift_one') return 'Deadlift One';

  return normalizedKey
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Challenge';
};

const getChallengeInviteStatus = (payload) => {
  const payloadObject = payload && typeof payload === 'object' ? payload : {};
  return String(payloadObject.responseStatus || payloadObject.status || 'pending')
    .trim()
    .toLowerCase();
};

const parseChallengeJson = (rawValue, fallback) => {
  if (!rawValue) return fallback;
  if (typeof rawValue === 'object') return rawValue;
  if (typeof rawValue !== 'string') return fallback;
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const createChallengeSessionClientMatchId = (challengeKey = 'push_up_duel') =>
  `${normalizeChallengeInviteKey(challengeKey) || 'challenge'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const FRIEND_CHALLENGE_STRENGTH_KEYS = new Set(['squat_rep_race', 'bench_press', 'deadlift_one']);

const isStrengthChallengeKey = (challengeKey) =>
  FRIEND_CHALLENGE_STRENGTH_KEYS.has(normalizeChallengeInviteKey(challengeKey));

const createRepChallengeRound = (number = 1) => ({
  number,
  player1: 0,
  player2: 0,
  status: 'player1',
});

const createStrengthChallengeRound = (number = 1) => ({
  number,
  weightKg: 0,
  player1Result: 'pending',
  player2Result: 'pending',
  status: 'player1',
});

const createChallengeSessionRounds = (challengeKey = 'push_up_duel') => ([
  isStrengthChallengeKey(challengeKey)
    ? createStrengthChallengeRound(1)
    : createRepChallengeRound(1),
]);

const normalizeChallengeRoundStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'player2') return 'player2';
  if (normalized === 'complete') return 'complete';
  return 'player1';
};

const normalizeStrengthChallengeResult = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'made') return 'made';
  if (normalized === 'missed') return 'missed';
  return 'pending';
};

const normalizeChallengeRounds = (rawRounds, challengeKey = 'push_up_duel') => {
  if (isStrengthChallengeKey(challengeKey)) {
    if (!Array.isArray(rawRounds) || !rawRounds.length) {
      return createChallengeSessionRounds(challengeKey);
    }

    const normalizedRounds = rawRounds.map((round, index) => {
      const roundObject = round && typeof round === 'object' ? round : {};
      const parsedNumber = Number(roundObject.number);
      const roundNumber = Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : index + 1;
      return {
        number: roundNumber,
        weightKg: Math.max(0, Number.parseFloat(roundObject.weightKg) || 0),
        player1Result: normalizeStrengthChallengeResult(roundObject.player1Result),
        player2Result: normalizeStrengthChallengeResult(roundObject.player2Result),
        status: normalizeChallengeRoundStatus(roundObject.status),
      };
    });

    normalizedRounds.sort((left, right) => left.number - right.number);
    return normalizedRounds;
  }

  if (!Array.isArray(rawRounds) || !rawRounds.length) {
    return createChallengeSessionRounds(challengeKey);
  }

  const normalizedRounds = rawRounds.map((round, index) => {
    const roundObject = round && typeof round === 'object' ? round : {};
    const parsedNumber = Number(roundObject.number);
    const roundNumber = Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : index + 1;
    return {
      number: roundNumber,
      player1: Math.max(0, Number.parseInt(roundObject.player1, 10) || 0),
      player2: Math.max(0, Number.parseInt(roundObject.player2, 10) || 0),
      status: normalizeChallengeRoundStatus(roundObject.status),
    };
  });

  normalizedRounds.sort((left, right) => left.number - right.number);
  return normalizedRounds;
};

const getChallengeSessionActiveRound = (rounds, challengeKey = 'push_up_duel') => {
  const candidateRounds = Array.isArray(rounds) && rounds.length
    ? rounds
    : normalizeChallengeRounds(rounds, challengeKey);
  return candidateRounds[candidateRounds.length - 1];
};

const getChallengeSessionCurrentPlayer = (rounds, challengeKey = 'push_up_duel') => {
  const activeRound = getChallengeSessionActiveRound(rounds, challengeKey);
  return activeRound.status === 'complete' ? 'complete' : activeRound.status;
};

const getChallengeRoundWinner = (round, challengeKey = 'push_up_duel') => {
  if (isStrengthChallengeKey(challengeKey)) {
    if (!round || String(round.status || '').trim().toLowerCase() !== 'complete') return 'tie';
    const player1Result = normalizeStrengthChallengeResult(round.player1Result);
    const player2Result = normalizeStrengthChallengeResult(round.player2Result);
    if (player1Result === 'made' && player2Result === 'missed') return 'player1';
    if (player2Result === 'made' && player1Result === 'missed') return 'player2';
    return 'tie';
  }

  if (!round || round.player1 === round.player2) return 'tie';
  return round.player1 > round.player2 ? 'player1' : 'player2';
};

const FRIEND_CHALLENGE_ROUND_WIN_POINTS = 10;
const FRIEND_CHALLENGE_ROUND_TIE_POINTS = 5;
const FRIEND_CHALLENGE_INVITE_TIMEOUT_MINUTES = 5;
const FRIEND_CHALLENGE_INVITE_TIMEOUT_MS = FRIEND_CHALLENGE_INVITE_TIMEOUT_MINUTES * 60 * 1000;

const hasChallengeInviteExpired = (createdAt) => {
  const timestamp = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return (Date.now() - timestamp) >= FRIEND_CHALLENGE_INVITE_TIMEOUT_MS;
};

const expireFriendChallengeInviteNotification = async (executor, notificationRow) => {
  const payload = safeParseJson(notificationRow?.data, {});
  const payloadObject = payload && typeof payload === 'object' ? payload : {};
  const currentStatus = getChallengeInviteStatus(payloadObject);
  if (currentStatus !== 'pending' || !hasChallengeInviteExpired(notificationRow?.created_at)) {
    return {
      expired: false,
      status: currentStatus,
      sessionId: toNumber(payloadObject.sessionId) || null,
    };
  }

  const notificationId = Number(notificationRow?.id || 0);
  const senderUserId = toNumber(payloadObject.senderUserId);
  const challengeKey = normalizeChallengeInviteKey(payloadObject.challengeKey);
  const challengeTitle = String(payloadObject.challengeTitle || defaultChallengeInviteTitle(challengeKey)).trim() || 'Challenge';
  const sessionId = toNumber(payloadObject.sessionId) || null;
  const actedAt = new Date().toISOString();
  const receiverMessage = `${challengeTitle} expired after ${FRIEND_CHALLENGE_INVITE_TIMEOUT_MINUTES} minutes.`;
  const senderMessage = `Your ${challengeTitle} invite expired after ${FRIEND_CHALLENGE_INVITE_TIMEOUT_MINUTES} minutes without a response.`;
  const updatedPayload = {
    ...payloadObject,
    responseStatus: 'cancelled',
    actedAt,
    cancelledAt: actedAt,
    autoCancelled: true,
    sessionId,
  };

  await executor.execute(
    `UPDATE notifications
     SET message = ?, data = ?
     WHERE id = ?`,
    [receiverMessage, JSON.stringify(updatedPayload), notificationId],
  );

  await executor.execute(
    `UPDATE friend_challenge_sessions
     SET status = 'declined', updated_at = CURRENT_TIMESTAMP
     WHERE invitation_notification_id = ?
       AND status = 'pending'`,
    [notificationId],
  );

  if (senderUserId > 0) {
    const [existingRows] = await executor.execute(
      `SELECT id
       FROM notifications
       WHERE user_id = ?
         AND type = 'friend_challenge_response'
         AND JSON_VALID(data)
         AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.receiverNotificationId')) AS UNSIGNED) = ?
         AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.responseStatus')), '') = 'cancelled'
       LIMIT 1`,
      [senderUserId, notificationId],
    );

    if (!existingRows.length) {
      await executor.execute(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES (?, 'friend_challenge_response', 'Challenge Cancelled', ?, ?)`,
        [
          senderUserId,
          senderMessage,
          JSON.stringify({
            challengeKey,
            challengeTitle,
            responseStatus: 'cancelled',
            receiverNotificationId: notificationId,
            sessionId,
            autoCancelled: true,
            cancelledAt: actedAt,
          }),
        ],
      );
    }
  }

  return {
    expired: true,
    status: 'cancelled',
    sessionId,
    challengeKey,
    challengeTitle,
    senderUserId,
  };
};

const expireStaleFriendChallengeInvitesForUser = async (userId) => {
  const normalizedUserId = toNumber(userId);
  if (!normalizedUserId || normalizedUserId <= 0) return;

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT id, user_id, data, created_at
       FROM notifications
       WHERE type = 'friend_challenge_invite'
         AND JSON_VALID(data)
         AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.responseStatus')), 'pending') = 'pending'
         AND created_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
         AND (
           user_id = ?
           OR CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.senderUserId')) AS UNSIGNED) = ?
         )
       ORDER BY created_at ASC
       LIMIT 50
       FOR UPDATE`,
      [normalizedUserId, normalizedUserId],
    );

    for (const row of rows) {
      await expireFriendChallengeInviteNotification(conn, row);
    }

    await conn.commit();
  } catch (error) {
    if (conn) await conn.rollback();
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const getFriendChallengePointsByRole = (rounds, challengeKey = 'push_up_duel') => {
  const normalizedRounds = normalizeChallengeRounds(rounds, challengeKey);

  if (isStrengthChallengeKey(challengeKey)) {
    const decidingRound = [...normalizedRounds]
      .reverse()
      .find((round) => round.status === 'complete' && getChallengeRoundWinner(round, challengeKey) !== 'tie');

    if (!decidingRound) {
      return { player1: 0, player2: 0 };
    }

    const winner = getChallengeRoundWinner(decidingRound, challengeKey);
    const decidingWeightKg = Number(decidingRound.weightKg || 0);
    const winnerPoints = decidingWeightKg > 100 ? 50 : 20;
    const loserPoints = decidingWeightKg > 100 ? 20 : 10;
    return winner === 'player1'
      ? { player1: winnerPoints, player2: loserPoints }
      : { player1: loserPoints, player2: winnerPoints };
  }

  return normalizedRounds.reduce((totals, round) => {
    if (round.status !== 'complete') return totals;

    const winner = getChallengeRoundWinner(round, challengeKey);
    if (winner === 'player1') {
      totals.player1 += FRIEND_CHALLENGE_ROUND_WIN_POINTS;
      return totals;
    }
    if (winner === 'player2') {
      totals.player2 += FRIEND_CHALLENGE_ROUND_WIN_POINTS;
      return totals;
    }

    totals.player1 += FRIEND_CHALLENGE_ROUND_TIE_POINTS;
    totals.player2 += FRIEND_CHALLENGE_ROUND_TIE_POINTS;
    return totals;
  }, { player1: 0, player2: 0 });
};

const getChallengeSessionWinner = (rounds, challengeKey = 'push_up_duel') => {
  const normalizedRounds = normalizeChallengeRounds(rounds, challengeKey);

  if (isStrengthChallengeKey(challengeKey)) {
    const decidingRound = [...normalizedRounds]
      .reverse()
      .find((round) => round.status === 'complete' && getChallengeRoundWinner(round, challengeKey) !== 'tie');
    return decidingRound ? getChallengeRoundWinner(decidingRound, challengeKey) : null;
  }

  const completedRounds = normalizedRounds.filter((round) => round.status === 'complete');
  if (!completedRounds.length) return null;

  let player1Wins = 0;
  let player2Wins = 0;
  let player1Total = 0;
  let player2Total = 0;

  normalizedRounds.forEach((round) => {
    player1Total += round.player1;
    player2Total += round.player2;
  });

  completedRounds.forEach((round) => {
    const winner = getChallengeRoundWinner(round, challengeKey);
    if (winner === 'player1') player1Wins += 1;
    if (winner === 'player2') player2Wins += 1;
  });

  if (player1Wins > player2Wins) return 'player1';
  if (player2Wins > player1Wins) return 'player2';
  if (player1Total > player2Total) return 'player1';
  if (player2Total > player1Total) return 'player2';
  return null;
};

const getChallengeSessionPlayerRole = (sessionRow, userId) => {
  const normalizedUserId = Number(userId || 0);
  if (normalizedUserId > 0 && normalizedUserId === Number(sessionRow?.sender_user_id || 0)) return 'player1';
  if (normalizedUserId > 0 && normalizedUserId === Number(sessionRow?.receiver_user_id || 0)) return 'player2';
  return null;
};

const buildFriendChallengeSessionResponse = (sessionRow) => {
  const challengeKey = normalizeChallengeInviteKey(sessionRow?.challenge_key) || 'push_up_duel';
  const challengeMode = isStrengthChallengeKey(challengeKey) ? 'weight' : 'reps';
  const rounds = normalizeChallengeRounds(parseChallengeJson(sessionRow?.rounds_json, []), challengeKey);
  const completedRounds = rounds.filter((round) => round.status === 'complete');
  const player1Wins = completedRounds.filter((round) => getChallengeRoundWinner(round, challengeKey) === 'player1').length;
  const player2Wins = completedRounds.filter((round) => getChallengeRoundWinner(round, challengeKey) === 'player2').length;
  const decidingRound = [...completedRounds]
    .reverse()
    .find((round) => getChallengeRoundWinner(round, challengeKey) !== 'tie') || null;

  const totals = challengeMode === 'weight'
    ? {
      player1BestWeightKg: rounds.reduce(
        (max, round) => (round.player1Result === 'made' ? Math.max(max, Number(round.weightKg || 0)) : max),
        0,
      ),
      player2BestWeightKg: rounds.reduce(
        (max, round) => (round.player2Result === 'made' ? Math.max(max, Number(round.weightKg || 0)) : max),
        0,
      ),
      player1MadeRounds: rounds.filter((round) => round.player1Result === 'made').length,
      player2MadeRounds: rounds.filter((round) => round.player2Result === 'made').length,
      player1Wins,
      player2Wins,
      completedRounds: completedRounds.length,
      decidingWeightKg: Number(decidingRound?.weightKg || 0),
    }
    : {
      player1Reps: rounds.reduce((sum, round) => sum + round.player1, 0),
      player2Reps: rounds.reduce((sum, round) => sum + round.player2, 0),
      player1Wins,
      player2Wins,
      completedRounds: completedRounds.length,
    };

  return {
    id: Number(sessionRow?.id || 0),
    challengeKey,
    challengeMode,
    senderUserId: Number(sessionRow?.sender_user_id || 0),
    receiverUserId: Number(sessionRow?.receiver_user_id || 0),
    invitationNotificationId: Number(sessionRow?.invitation_notification_id || 0),
    status: String(sessionRow?.status || 'pending').trim().toLowerCase() || 'pending',
    clientMatchId: String(sessionRow?.client_match_id || '').trim(),
    winnerUserId: Number(sessionRow?.winner_user_id || 0) || null,
    abandonedByUserId: toNumber(parseChallengeJson(sessionRow?.metadata_json, {})?.abandonedByUserId) || null,
    abandonedByUserName: String(parseChallengeJson(sessionRow?.metadata_json, {})?.abandonedByUserName || '').trim() || '',
    abandonedAt: parseChallengeJson(sessionRow?.metadata_json, {})?.abandonedAt || null,
    currentPlayer: getChallengeSessionCurrentPlayer(rounds, challengeKey),
    rounds,
    totals,
    completedAt: sessionRow?.completed_at || null,
    updatedAt: sessionRow?.updated_at || null,
  };
};

const toBooleanFlag = (value, fallback = false) => {
  if (value == null) return fallback;
  const key = String(value).trim().toLowerCase();
  if (!key) return fallback;
  if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(key)) return true;
  if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(key)) return false;
  return fallback;
};

const sanitizeOnboardingFieldForPrompt = (
  value,
  depth = 0,
  options = {},
) => {
  const maxDepth = Number.isFinite(Number(options.maxDepth)) ? Number(options.maxDepth) : 8;
  const maxArrayItems = Number.isFinite(Number(options.maxArrayItems)) ? Number(options.maxArrayItems) : 200;
  const maxObjectEntries = Number.isFinite(Number(options.maxObjectEntries)) ? Number(options.maxObjectEntries) : 300;
  const maxStringLength = Number.isFinite(Number(options.maxStringLength)) ? Number(options.maxStringLength) : 2500;

  if (value == null) return null;
  if (depth > maxDepth) return '[truncated]';

  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayItems)
      .map((item) => sanitizeOnboardingFieldForPrompt(item, depth + 1, options));
  }

  if (typeof value === 'object') {
    const output = {};
    const entries = Object.entries(value).slice(0, maxObjectEntries);
    entries.forEach(([key, entryValue]) => {
      if (String(key) === 'bodyImages') {
        const images = Array.isArray(entryValue) ? entryValue : [];
        output.bodyImages = images.slice(0, 3).map((image, index) => {
          const raw = String(image || '').trim();
          if (!raw) return `image_${index + 1}: empty`;
          const match = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
          if (!match) return `image_${index + 1}: non-data-uri`;
          return `image_${index + 1}: ${String(match[1] || 'image/unknown').toLowerCase()}`;
        });
        return;
      }
      output[key] = sanitizeOnboardingFieldForPrompt(entryValue, depth + 1, options);
    });
    return output;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    return normalized.length > maxStringLength
      ? `${normalized.slice(0, maxStringLength)}...[truncated]`
      : normalized;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
};

const buildClaudeOnboardingFields = (payload = {}, normalized = {}, sanitizeOptions = {}) => {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const topLevelKeys = Object.keys(safePayload).filter((key) => key !== 'userId');
  const sanitizedRaw = sanitizeOnboardingFieldForPrompt(safePayload, 0, sanitizeOptions);
  const rawObject = sanitizedRaw && typeof sanitizedRaw === 'object' ? { ...sanitizedRaw } : {};
  delete rawObject.userId;

  return {
    ...rawObject,
    _normalizedSummary: sanitizeOnboardingFieldForPrompt(normalized, 0, sanitizeOptions),
    _ingestionMeta: {
      topLevelFieldsReceived: topLevelKeys.length,
      includedBodyImages: Array.isArray(rawObject.bodyImages) ? rawObject.bodyImages.length : 0,
    },
  };
};

const TRACKED_MUSCLES = [
  'Chest',
  'Back',
  'Quadriceps',
  'Hamstrings',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Calves',
  'Abs',
];

const BASE_RECOVERY_TIMES = {
  Chest: 48,
  Back: 48,
  Legs: 72,
  Quads: 72,
  Quadriceps: 72,
  Hamstrings: 72,
  Glutes: 72,
  Shoulders: 48,
  Lats: 48,
  Traps: 48,
  Biceps: 36,
  Triceps: 36,
  Forearms: 24,
  Calves: 36,
  Abs: 24,
  Core: 24,
};

const MUSCLE_WEIGHTS = {
  chest: 1.2,
  back: 1.2,
  quadriceps: 1.3,
  hamstrings: 1.2,
  shoulders: 1.0,
  biceps: 0.8,
  triceps: 0.8,
  forearms: 0.6,
  calves: 0.8,
  abs: 0.7,
};

const INTENSITY_FACTORS = {
  low: 0.7,
  moderate: 1.0,
  high: 1.3,
};

const VOLUME_FACTORS = {
  low: 0.8,
  moderate: 1.0,
  high: 1.2,
};

const ECCENTRIC_FACTOR = 1.15;

const NUTRITION_FACTORS = {
  optimal: 0.9,
  suboptimal: 1.1,
};

const STRESS_FACTORS = {
  low: 0.95,
  moderate: 1.0,
  high: 1.15,
};

const getAgeFactor = (age) => {
  if (age == null) return 1.0;
  if (age < 25) return 0.9;
  if (age < 35) return 1.0;
  if (age < 45) return 1.1;
  return 1.2;
};

const getSleepFactor = (hours) => {
  if (hours == null) return 1.0;
  if (hours >= 8) return 0.9;
  if (hours >= 7) return 1.0;
  if (hours >= 6) return 1.1;
  return 1.2;
};

const getProteinFactor = (proteinIntake) => {
  if (proteinIntake == null) return 1.0;
  if (proteinIntake >= 1.6) return 0.95;
  if (proteinIntake >= 1.0) return 1.0;
  return 1.08;
};

const getSupplementFactor = (supplements) => {
  const key = String(supplements || '').trim().toLowerCase();
  if (key === 'full') return 0.93;
  if (key === 'creatine') return 0.97;
  return 1.0;
};

const normalizeRecoveryNutritionQuality = (value, fallback = 'optimal') => {
  const key = String(value || '').trim().toLowerCase();
  return ['optimal', 'suboptimal'].includes(key) ? key : fallback;
};

const normalizeRecoveryStressLevel = (value, fallback = 'low') => {
  const key = String(value || '').trim().toLowerCase();
  return ['low', 'moderate', 'high'].includes(key) ? key : fallback;
};

const normalizeRecoverySupplements = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return ['none', 'creatine', 'full'].includes(key) ? key : 'none';
};

const normalizeRecoveryProteinIntake = (value) => {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (key === 'low') return 0.8;
    if (key === 'medium') return 1.2;
    if (key === 'high') return 1.8;

    const parsed = Number(key);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildRecoveryFactorSnapshot = (raw = {}) => ({
  sleepHours: Number(raw.sleep_hours ?? raw.sleepHours ?? 7) || 7,
  nutritionQuality: normalizeRecoveryNutritionQuality(
    raw.nutrition_quality ?? raw.nutritionQuality,
    'optimal',
  ),
  stressLevel: normalizeRecoveryStressLevel(
    raw.stress_level ?? raw.stressLevel,
    'low',
  ),
  proteinIntake: normalizeRecoveryProteinIntake(
    raw.protein_intake ?? raw.proteinIntake,
  ),
  supplements: normalizeRecoverySupplements(raw.supplements),
});

const getRecoveryFactorMultiplier = ({
  sleepHours = 7,
  nutritionQuality = 'optimal',
  stressLevel = 'moderate',
  proteinIntake = null,
  supplements = 'none',
}) => (
  getSleepFactor(sleepHours)
  * (NUTRITION_FACTORS[nutritionQuality] || 1.0)
  * (STRESS_FACTORS[stressLevel] || 1.0)
  * getProteinFactor(proteinIntake)
  * getSupplementFactor(supplements)
);

const normalizeMuscleName = (muscle = '') => {
  const key = String(muscle).trim().toLowerCase();
  if (!key) return null;

  const map = {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    shoulder: 'Shoulders',
    biceps: 'Biceps',
    bicep: 'Biceps',
    triceps: 'Triceps',
    tricep: 'Triceps',
    forearms: 'Forearms',
    forearm: 'Forearms',
    calves: 'Calves',
    calf: 'Calves',
    abs: 'Abs',
    core: 'Abs',
    quads: 'Quadriceps',
    quadriceps: 'Quadriceps',
    hamstrings: 'Hamstrings',
    hamstring: 'Hamstrings',
    legs: 'Quadriceps',
    lats: 'Back',
    traps: 'Back',
    glutes: 'Hamstrings',
  };

  return map[key] || (muscle.charAt(0).toUpperCase() + muscle.slice(1).toLowerCase());
};

const parseMuscleGroups = (rawValue) => {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) return rawValue;

  if (typeof rawValue === 'string') {
    const text = rawValue.trim();
    if (!text) return [];

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parsed = null;
    }

    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'string') return [parsed];

    return text
      .split(/[,;|]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [rawValue];
};

const normalizeExerciseLookupName = (value = '') =>
  String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeCatalogRecoveryMuscle = (muscle = '') => {
  const key = String(muscle || '').trim().toLowerCase();
  if (!key) return null;

  if (/(chest|pector)/.test(key)) return 'Chest';
  if (/(lat|back|trap|rhomboid|erector|spine|middle back|lower back|upper back)/.test(key)) return 'Back';
  if (/(quad|quadricep|thigh|leg extension|front leg)/.test(key)) return 'Quadriceps';
  if (/(hamstring|glute|adductor|abductor|hip|posterior chain)/.test(key)) return 'Hamstrings';
  if (/(shoulder|delt)/.test(key)) return 'Shoulders';
  if (/(bicep)/.test(key)) return 'Biceps';
  if (/(tricep)/.test(key)) return 'Triceps';
  if (/(forearm|wrist|grip)/.test(key)) return 'Forearms';
  if (/(calf)/.test(key)) return 'Calves';
  if (/(abs|abdom|core|oblique|serratus)/.test(key)) return 'Abs';
  if (/legs?/.test(key)) return 'Quadriceps';

  return normalizeMuscleName(key);
};

const normalizeRecoveryMuscleTargets = (rawValue, maxItems = 3) => {
  const limit = Math.max(1, Number(maxItems || 1));
  const normalized = parseMuscleGroups(rawValue)
    .flatMap((item) => (typeof item === 'string' ? item.split(/[,;|]+/) : [item]))
    .map((item) => normalizeCatalogRecoveryMuscle(item))
    .filter((muscle) => muscle && TRACKED_MUSCLES.includes(muscle));

  return [...new Set(normalized)].slice(0, limit);
};

const buildMuscleGroupSnapshot = ({ catalogBodyPart = null, targetMuscles = [] } = {}) => {
  const fromCatalog = normalizeRecoveryMuscleTargets(catalogBodyPart, 1);
  const fromTargets = normalizeRecoveryMuscleTargets(targetMuscles, 3);
  const combined = [...new Set([...fromCatalog, ...fromTargets])];

  if (combined.length > 1) return JSON.stringify(combined);
  if (combined.length === 1) return combined[0];

  const rawCatalog = String(catalogBodyPart || '').trim();
  return rawCatalog || null;
};

const inferMusclesFromExerciseName = (exerciseName = '') => {
  const name = String(exerciseName).toLowerCase();

  const matches = [];
  if (/bench|chest|fly|push-up|push up/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|lat|pulldown|pullover/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|lunge|split squat|step up/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (/shoulder|overhead press|lateral raise|rear delt/.test(name)) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|dip/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up/.test(name)) matches.push('Abs');

  return [...new Set(matches.map(normalizeMuscleName).filter(Boolean))];
};

const deriveIntensityFromRpe = (rpeValue) => {
  const normalized = Number(rpeValue);
  if (!Number.isFinite(normalized)) return 'moderate';
  if (normalized >= 8) return 'high';
  if (normalized <= 5) return 'low';
  return 'moderate';
};

const deriveVolumeFromSetCount = (setCount) => {
  const count = Number(setCount || 0);
  if (count >= 5) return 'high';
  if (count <= 2) return 'low';
  return 'moderate';
};

const computeCatalogRecoveryLoadMultiplier = (profile = {}, loadFactor = 1) => {
  const systemic = Number(profile.systemicStressScore ?? 1);
  const cns = Number(profile.cnsLoadScore ?? 1);
  const weightedStress = (systemic * 0.65) + (cns * 0.35);
  const raw = weightedStress * Number(loadFactor || 1);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(0.5, Math.min(2.5, Number(raw.toFixed(3))));
};

const resolveCatalogIdsByNormalizedNames = async (normalizedNames = []) => {
  const uniqueNames = [...new Set(normalizedNames.map((name) => String(name || '').trim()).filter(Boolean))];
  const mapping = new Map();
  if (!uniqueNames.length) return mapping;

  // Keep IN queries bounded to avoid oversized statements.
  const chunkSize = 200;
  for (let i = 0; i < uniqueNames.length; i += chunkSize) {
    const chunk = uniqueNames.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT resolved.normalized_name, MIN(resolved.exercise_catalog_id) AS exercise_catalog_id
       FROM (
         SELECT ea.alias_normalized AS normalized_name, ea.exercise_catalog_id
         FROM exercise_aliases ea
         WHERE ea.alias_normalized IN (${placeholders})
         UNION ALL
         SELECT ec.normalized_name AS normalized_name, ec.id AS exercise_catalog_id
         FROM exercise_catalog ec
         WHERE ec.normalized_name IN (${placeholders}) AND ec.is_active = 1
       ) resolved
       GROUP BY resolved.normalized_name`,
      [...chunk, ...chunk],
    );

    rows.forEach((row) => {
      const key = String(row.normalized_name || '').trim();
      const value = Number(row.exercise_catalog_id || 0);
      if (key && value > 0) mapping.set(key, value);
    });
  }

  return mapping;
};

const getCatalogRecoveryContexts = async (catalogIds = []) => {
  const ids = [...new Set(catalogIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  const contexts = new Map();
  if (!ids.length) return contexts;

  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT
       ec.id AS exercise_catalog_id,
       ec.body_part,
       ecm.muscle_group,
       COALESCE(ecm.load_factor, 1) AS load_factor,
       COALESCE(erp.systemic_stress_score, 1) AS systemic_stress_score,
       COALESCE(erp.cns_load_score, 1) AS cns_load_score,
       COALESCE(erp.eccentric_bias_score, 1) AS eccentric_bias_score
     FROM exercise_catalog ec
     LEFT JOIN exercise_catalog_muscles ecm ON ecm.exercise_catalog_id = ec.id
     LEFT JOIN exercise_recovery_profile erp ON erp.exercise_catalog_id = ec.id
     WHERE ec.id IN (${placeholders})`,
    ids,
  );

  rows.forEach((row) => {
    const catalogId = Number(row.exercise_catalog_id || 0);
    if (!catalogId) return;

    if (!contexts.has(catalogId)) {
      contexts.set(catalogId, {
        musclesByName: new Map(),
        profile: {
          systemicStressScore: Number(row.systemic_stress_score || 1),
          cnsLoadScore: Number(row.cns_load_score || 1),
          eccentricBiasScore: Number(row.eccentric_bias_score || 1),
        },
      });
    }

    const context = contexts.get(catalogId);
    const normalizedMuscle = normalizeCatalogRecoveryMuscle(row.muscle_group || row.body_part || '');
    if (!normalizedMuscle) return;

    const currentLoad = context.musclesByName.get(normalizedMuscle) || 0;
    const nextLoad = Math.max(currentLoad, Number(row.load_factor || 1));
    context.musclesByName.set(normalizedMuscle, nextLoad);
  });

  contexts.forEach((context, catalogId) => {
    contexts.set(catalogId, {
      profile: context.profile,
      muscles: Array.from(context.musclesByName.entries()).map(([muscle, loadFactor]) => ({
        muscle,
        loadFactor,
      })),
    });
  });

  return contexts;
};

const calculateRecoveryHours = ({
  muscleGroup,
  intensity = 'moderate',
  volume = 'moderate',
  eccentricFocus = false,
  age = null,
  sleepHours = 7,
  nutritionQuality = 'optimal',
  stressLevel = 'moderate',
  proteinIntake = null,
  supplements = 'none',
  loadMultiplier = 1,
}) => {
  const canonicalMuscle = normalizeMuscleName(muscleGroup) || 'Chest';
  const base = BASE_RECOVERY_TIMES[canonicalMuscle] || 48;

  let hours = base;
  hours *= INTENSITY_FACTORS[intensity] || 1.0;
  hours *= VOLUME_FACTORS[volume] || 1.0;
  if (eccentricFocus) hours *= ECCENTRIC_FACTOR;
  hours *= getAgeFactor(age);
  hours *= getSleepFactor(sleepHours);
  hours *= NUTRITION_FACTORS[nutritionQuality] || 1.0;
  hours *= STRESS_FACTORS[stressLevel] || 1.0;
  hours *= getProteinFactor(proteinIntake);
  hours *= getSupplementFactor(supplements);
  hours *= Number.isFinite(Number(loadMultiplier)) ? Number(loadMultiplier) : 1;

  return Number(Math.max(12, hours).toFixed(2));
};

const calculateDynamicRecovery = (lastWorked, hoursNeeded) => {
  if (!lastWorked || !hoursNeeded) {
    return { hoursElapsed: 0, score: 100 };
  }

  const elapsedHours = Math.max(0, (Date.now() - new Date(lastWorked).getTime()) / (1000 * 60 * 60));
  const score = Math.max(0, Math.min(100, (elapsedHours / Number(hoursNeeded || 1)) * 100));
  return { hoursElapsed: Number(elapsedHours.toFixed(2)), score: Math.round(score) };
};

const computeOverallRecovery = (muscles) => {
  if (!muscles.length) return 100;

  let weightedTotal = 0;
  let totalWeight = 0;

  muscles.forEach((m) => {
    const key = String(normalizeMuscleName(m.name || m.muscle || '') || '').toLowerCase();
    const weight = MUSCLE_WEIGHTS[key] || 1;
    weightedTotal += (Number(m.score) || 0) * weight;
    totalWeight += weight;
  });

  if (!totalWeight) return 100;
  return Math.round(weightedTotal / totalWeight);
};

const formatDateISO = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeGoalEnum = (goal) => {
  const key = String(goal || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

  const map = {
    hypertrophy: 'hypertrophy',
    'muscle gain': 'hypertrophy',
    'build muscle': 'hypertrophy',
    strength: 'strength',
    'fat loss': 'fat_loss',
    'weight loss': 'fat_loss',
    recomposition: 'recomposition',
    endurance: 'endurance',
    'general fitness': 'general_fitness',
  };

  return map[key] || 'general_fitness';
};

const normalizeExperienceEnum = (level) => {
  const key = String(level || '').toLowerCase().trim();
  if (key.startsWith('beg')) return 'beginner';
  if (key.startsWith('int')) return 'intermediate';
  if (key.startsWith('adv')) return 'advanced';
  return null;
};

const normalizeGenderEnum = (gender) => {
  const key = String(gender || '').toLowerCase().trim();
  if (key === 'male' || key === 'm') return 'male';
  if (key === 'female' || key === 'f') return 'female';
  if (key === 'other') return 'other';
  if (key === 'prefer_not_say' || key === 'prefer not say' || key === 'prefer not to say') return 'prefer_not_say';
  return null;
};

const clampWorkoutDays = (days, fallback = 4) => {
  const n = Number(days);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(2, Math.min(6, Math.round(n)));
};

const clampSessionDuration = (minutes, fallback = 60) => {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(30, Math.min(120, Math.round(n)));
};

const getWorkoutSessionColumns = async () => {
  if (workoutSessionColumnsCache) return workoutSessionColumnsCache;

  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'workout_sessions'`,
  );

  workoutSessionColumnsCache = new Set(
    rows
      .map((row) => String(row.COLUMN_NAME || row.column_name || '').trim().toLowerCase())
      .filter(Boolean),
  );
  return workoutSessionColumnsCache;
};

const normalizeSplitPreference = (value) => {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['auto', 'full_body', 'upper_lower', 'push_pull_legs', 'hybrid', 'custom'].includes(key)) {
    return key;
  }
  return 'auto';
};

const normalizeShortText = (value, maxLength = 120, lowerCase = false) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const sliced = raw.slice(0, maxLength);
  return lowerCase ? sliced.toLowerCase() : sliced;
};

const normalizeAthleteIdentity = (value) => {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!key) return null;

  const aliasMap = {
    bodybuilder: 'bodybuilding',
    footballer: 'football',
    fotballer: 'football',
    basketballer: 'basketball',
    handballer: 'handball',
    swimmer: 'swimming',
    'combat_sport': 'combat_sports',
  };
  const normalized = aliasMap[key] || key;
  if (['bodybuilding', 'football', 'basketball', 'handball', 'swimming', 'combat_sports'].includes(normalized)) {
    return normalized;
  }
  return null;
};

const normalizeAthleteIdentityCategory = (value) => {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!key) return null;
  if (key === 'fitness' || key === 'athlete_sports') return key;
  return null;
};

const normalizeSportPracticeYears = (value) => {
  const years = toNumber(value, null);
  if (years == null) return null;
  const clamped = Math.max(0, Math.min(80, years));
  return Math.round(clamped * 100) / 100;
};

const RANK_TIERS = [
  { name: 'Bronze', minPoints: 0 },
  { name: 'Silver', minPoints: 150 },
  { name: 'Gold', minPoints: 400 },
  { name: 'Platinum', minPoints: 800 },
  { name: 'Diamond', minPoints: 1400 },
  { name: 'Elite', minPoints: 2200 },
];
const XP_LEVELS = [
  { levelNumber: 1, levelName: 'Beginner', xpRequired: 0, tier: 1 },
  { levelNumber: 2, levelName: 'Rookie', xpRequired: 100, tier: 2 },
  { levelNumber: 3, levelName: 'Trainee', xpRequired: 250, tier: 3 },
  { levelNumber: 4, levelName: 'Active', xpRequired: 500, tier: 4 },
  { levelNumber: 5, levelName: 'Dedicated', xpRequired: 900, tier: 5 },
  { levelNumber: 6, levelName: 'Challenger', xpRequired: 1500, tier: 6 },
  { levelNumber: 7, levelName: 'Performer', xpRequired: 2300, tier: 7 },
  { levelNumber: 8, levelName: 'Athlete', xpRequired: 3500, tier: 8 },
  { levelNumber: 9, levelName: 'Advanced', xpRequired: 5000, tier: 9 },
  { levelNumber: 10, levelName: 'Pro', xpRequired: 7000, tier: 10 },
  { levelNumber: 11, levelName: 'Elite', xpRequired: 9500, tier: 11 },
  { levelNumber: 12, levelName: 'Master', xpRequired: 12500, tier: 12 },
  { levelNumber: 13, levelName: 'Champion', xpRequired: 16000, tier: 13 },
  { levelNumber: 14, levelName: 'Titan', xpRequired: 21000, tier: 14 },
  { levelNumber: 15, levelName: 'Legend', xpRequired: 28000, tier: 15 },
];
const BLOG_POST_UPLOAD_POINTS = 10;

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const getRankFromPoints = (points = 0) => {
  const normalized = Math.max(0, Math.round(Number(points || 0)));
  const matched = [...RANK_TIERS].reverse().find((tier) => normalized >= tier.minPoints);
  return matched?.name || 'Bronze';
};

const getNextRankInfo = (points = 0) => {
  const normalized = Math.max(0, Math.round(Number(points || 0)));
  const next = RANK_TIERS.find((tier) => normalized < tier.minPoints);
  if (!next) return null;
  return {
    name: next.name,
    minPoints: next.minPoints,
    pointsNeeded: Math.max(0, next.minPoints - normalized),
  };
};

const getStartOfDay = (base = new Date()) => {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (base = new Date()) => {
  const d = new Date(base);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getStartOfWeek = (base = new Date()) => {
  const d = getStartOfDay(base);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
};

const getEndOfWeek = (base = new Date()) => {
  const d = getStartOfWeek(base);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getDailyInstanceKey = (base = new Date()) => formatDateISO(base);
const getWeeklyInstanceKey = (base = new Date()) => `week:${formatDateISO(getStartOfWeek(base))}`;
const getMonthlyInstanceKey = (base = new Date()) => {
  const d = new Date(base);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `month:${d.getFullYear()}-${month}`;
};

const estimateRecoveryScoreFromFactors = ({
  sleepHours = 7,
  nutritionQuality = 'optimal',
  stressLevel = 'moderate',
  proteinIntake = null,
  supplements = 'none',
}) => {
  const sleep = Number(sleepHours || 0);
  const protein = Number(proteinIntake || 0);
  const supplementKey = normalizeRecoverySupplements(supplements);

  const sleepScore = sleep >= 8 ? 40 : sleep >= 7 ? 34 : sleep >= 6 ? 26 : 16;
  const nutritionScore = nutritionQuality === 'optimal' ? 28 : 18;
  const stressScore = stressLevel === 'low' ? 24 : stressLevel === 'moderate' ? 16 : 8;
  const proteinScore = protein >= 1.6 ? 8 : protein >= 1.0 ? 6 : 3;
  const supplementsScore = supplementKey === 'full' ? 4 : supplementKey === 'creatine' ? 2 : 0;

  return clampPercentage(Math.round(sleepScore + nutritionScore + stressScore + proteinScore + supplementsScore));
};

const recalculateRecoveryStatusHoursForFactors = async (userId, previousFactors, nextFactors) => {
  const normalizedUserId = toNumber(userId, 0);
  if (!normalizedUserId) return;

  const previousMultiplier = getRecoveryFactorMultiplier(previousFactors);
  const nextMultiplier = getRecoveryFactorMultiplier(nextFactors);
  if (!Number.isFinite(previousMultiplier) || previousMultiplier <= 0 || !Number.isFinite(nextMultiplier) || nextMultiplier <= 0) {
    return;
  }

  if (Math.abs(previousMultiplier - nextMultiplier) < 0.0001) {
    return;
  }

  const [statusRows] = await pool.execute(
    `SELECT id, hours_needed, last_worked
     FROM muscle_recovery_status
     WHERE user_id = ?`,
    [normalizedUserId],
  );

  if (!Array.isArray(statusRows) || !statusRows.length) {
    return;
  }

  await Promise.all(
    statusRows.map((row) => {
      const currentHoursNeeded = Number(row.hours_needed || 0);
      const baseHoursNeeded = previousMultiplier > 0
        ? currentHoursNeeded / previousMultiplier
        : currentHoursNeeded;
      const nextHoursNeeded = Number(Math.max(12, baseHoursNeeded * nextMultiplier).toFixed(2));
      const dynamic = calculateDynamicRecovery(row.last_worked, nextHoursNeeded);
      const overtrainingRisk = dynamic.score < 30 ? 1 : 0;

      return pool.execute(
        `UPDATE muscle_recovery_status
         SET hours_needed = ?, recovery_percentage = ?, hours_elapsed = ?, overtraining_risk = ?
         WHERE id = ?`,
        [nextHoursNeeded, dynamic.score, dynamic.hoursElapsed, overtrainingRisk, row.id],
      );
    }),
  );
};

const getMetricValue = (metrics, metricKey) => {
  const key = String(metricKey || '').toLowerCase().trim();
  return Math.max(0, Number(metrics?.[key] || 0));
};

const WEEKLY_ACTIVE_MISSION_TARGET = 5;
const MONTHLY_ACTIVE_MISSION_TARGET = 1;

const ensureNotificationSettingsInfrastructure = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_notification_settings (
      user_id INT UNSIGNED PRIMARY KEY,
      coach_messages TINYINT(1) NOT NULL DEFAULT 1,
      rest_timer TINYINT(1) NOT NULL DEFAULT 1,
      mission_challenge TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_notification_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  );
};

const ensureFriendshipInfrastructure = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS friendships (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      friend_id INT UNSIGNED NOT NULL,
      status ENUM('pending','accepted','blocked','declined','removed') NOT NULL DEFAULT 'pending',
      initiated_by INT UNSIGNED NOT NULL,
      accepted_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_friendships_pair (user_id, friend_id),
      KEY idx_friendships_user_status (user_id, status),
      KEY idx_friendships_friend_status (friend_id, status),
      KEY idx_friendships_initiated_by (initiated_by),
      CONSTRAINT fk_friendships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_friendships_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_friendships_initiated_by FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT chk_friendships_not_self CHECK (user_id <> friend_id)
    ) ENGINE=InnoDB`,
  );
};

const ensureFriendChallengeInfrastructure = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS friend_challenge_sessions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      challenge_key VARCHAR(80) NOT NULL,
      sender_user_id INT UNSIGNED NOT NULL,
      receiver_user_id INT UNSIGNED NOT NULL,
      invitation_notification_id BIGINT UNSIGNED NULL,
      status ENUM('pending','active','completed','declined','abandoned') NOT NULL DEFAULT 'pending',
      winner_user_id INT UNSIGNED NULL,
      client_match_id VARCHAR(120) NOT NULL,
      rounds_json JSON NOT NULL,
      metadata_json JSON NULL,
      completed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_friend_challenge_session_match (client_match_id),
      UNIQUE KEY uk_friend_challenge_session_invite (invitation_notification_id),
      KEY idx_friend_challenge_session_sender (sender_user_id, status),
      KEY idx_friend_challenge_session_receiver (receiver_user_id, status),
      CONSTRAINT fk_friend_challenge_session_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_friend_challenge_session_receiver FOREIGN KEY (receiver_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_friend_challenge_session_winner FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB`,
  );

  const [sessionStatusRows] = await pool.execute(
    `SELECT column_type
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'friend_challenge_sessions'
       AND column_name = 'status'
     LIMIT 1`,
  );
  const sessionStatusColumnType = String(sessionStatusRows[0]?.column_type || '').toLowerCase();
  if (sessionStatusColumnType && !sessionStatusColumnType.includes("'abandoned'")) {
    await pool.execute(
      `ALTER TABLE friend_challenge_sessions
       MODIFY COLUMN status ENUM('pending','active','completed','declined','abandoned') NOT NULL DEFAULT 'pending'`,
    );
  }

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS friend_challenge_results (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      challenge_key VARCHAR(80) NOT NULL,
      participant_a_id INT UNSIGNED NOT NULL,
      participant_b_id INT UNSIGNED NOT NULL,
      participant_a_points INT NOT NULL DEFAULT 0,
      participant_b_points INT NOT NULL DEFAULT 0,
      submitted_by_user_id INT UNSIGNED NOT NULL,
      winner_user_id INT UNSIGNED NOT NULL,
      loser_user_id INT UNSIGNED NOT NULL,
      points_reward INT NOT NULL DEFAULT 0,
      client_match_id VARCHAR(120) NOT NULL,
      metadata_json JSON NULL,
      completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_friend_challenge_match (challenge_key, participant_a_id, participant_b_id, client_match_id),
      KEY idx_friend_challenge_winner (winner_user_id, completed_at),
      KEY idx_friend_challenge_loser (loser_user_id, completed_at),
      CONSTRAINT fk_friend_challenge_participant_a FOREIGN KEY (participant_a_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_friend_challenge_participant_b FOREIGN KEY (participant_b_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_friend_challenge_submitted_by FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_friend_challenge_winner FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_friend_challenge_loser FOREIGN KEY (loser_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB`,
  );

  const ensureColumnExists = async (columnName, alterSql) => {
    const [rows] = await pool.execute(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'friend_challenge_results'
         AND column_name = ?
       LIMIT 1`,
      [columnName],
    );

    if (!rows.length) {
      await pool.execute(alterSql);
    }
  };

  await ensureColumnExists(
    'participant_a_points',
    `ALTER TABLE friend_challenge_results
     ADD COLUMN participant_a_points INT NOT NULL DEFAULT 0 AFTER participant_b_id`,
  );
  await ensureColumnExists(
    'participant_b_points',
    `ALTER TABLE friend_challenge_results
     ADD COLUMN participant_b_points INT NOT NULL DEFAULT 0 AFTER participant_a_points`,
  );

  await pool.execute(
    `UPDATE friend_challenge_results
     SET participant_a_points = CASE
           WHEN participant_a_points = 0 AND participant_b_points = 0 AND winner_user_id = participant_a_id THEN points_reward
           ELSE participant_a_points
         END,
         participant_b_points = CASE
           WHEN participant_a_points = 0 AND participant_b_points = 0 AND winner_user_id = participant_b_id THEN points_reward
           ELSE participant_b_points
         END
     WHERE points_reward > 0`,
  );
};

let friendChallengeInfrastructurePromise;
const ensureFriendChallengeInfrastructureOnce = async () => {
  if (!friendChallengeInfrastructurePromise) {
    friendChallengeInfrastructurePromise = ensureFriendChallengeInfrastructure().catch((error) => {
      friendChallengeInfrastructurePromise = null;
      throw error;
    });
  }
  return friendChallengeInfrastructurePromise;
};

const ensureProgramChangeRequestInfrastructure = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS program_change_requests (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      coach_id BIGINT NOT NULL,
      proposed_by_user_id BIGINT NULL,
      plan_name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      cycle_weeks TINYINT NOT NULL,
      selected_days_json JSON NOT NULL,
      weekly_workouts_json JSON NOT NULL,
      request_source ENUM('user_to_coach', 'coach_to_user') NOT NULL DEFAULT 'user_to_coach',
      status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
      review_notes VARCHAR(500) NULL,
      approved_program_id BIGINT NULL,
      reviewed_by BIGINT NULL,
      reviewed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_program_change_requests_coach_status (coach_id, status, created_at),
      INDEX idx_program_change_requests_user_status (user_id, status, created_at),
      INDEX idx_program_change_requests_status_created (status, created_at)
    ) ENGINE=InnoDB`,
  );

  const [sourceColumnRows] = await pool.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'program_change_requests'
       AND column_name = 'request_source'
     LIMIT 1`,
  );
  if (!sourceColumnRows.length) {
    await pool.execute(
      `ALTER TABLE program_change_requests
       ADD COLUMN request_source ENUM('user_to_coach', 'coach_to_user') NOT NULL DEFAULT 'user_to_coach' AFTER weekly_workouts_json`,
    );
  }

  const [proposedByColumnRows] = await pool.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'program_change_requests'
       AND column_name = 'proposed_by_user_id'
     LIMIT 1`,
  );
  if (!proposedByColumnRows.length) {
    await pool.execute(
      `ALTER TABLE program_change_requests
       ADD COLUMN proposed_by_user_id BIGINT NULL AFTER coach_id`,
    );
  }

  await pool.execute(
    `UPDATE program_change_requests
     SET request_source = 'user_to_coach'
     WHERE request_source IS NULL OR request_source = ''`,
  );
};

let programChangeRequestInfrastructurePromise;
const ensureProgramChangeRequestInfrastructureOnce = async () => {
  if (!programChangeRequestInfrastructurePromise) {
    programChangeRequestInfrastructurePromise = ensureProgramChangeRequestInfrastructure().catch((error) => {
      programChangeRequestInfrastructurePromise = null;
      throw error;
    });
  }
  return programChangeRequestInfrastructurePromise;
};

let friendshipInfrastructurePromise;
const ensureFriendshipInfrastructureOnce = async () => {
  if (!friendshipInfrastructurePromise) {
    friendshipInfrastructurePromise = ensureFriendshipInfrastructure().catch((error) => {
      friendshipInfrastructurePromise = null;
      throw error;
    });
  }
  return friendshipInfrastructurePromise;
};

const CHALLENGE_NOTIFICATION_TYPES = [
  'workout_reminder',
  'friend_request',
  'friend_accept',
  'message',
  'mission_complete',
  'program_updated',
  'coach_message',
  'system',
  'account_ban',
  'plan_review_request',
  'plan_coach_request',
  'plan_coach_request_sent',
  'plan_created_by_coach',
  'plan_review_approved',
  'plan_review_rejected',
  'blog_like',
  'blog_comment',
  'friend_challenge_invite',
  'friend_challenge_response',
];

let challengeNotificationTypesPromise;
const ensureChallengeNotificationTypesOnce = async () => {
  if (!challengeNotificationTypesPromise) {
    challengeNotificationTypesPromise = (async () => {
      const [rows] = await pool.execute(
        `SELECT COLUMN_TYPE
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'notifications'
           AND COLUMN_NAME = 'type'
         LIMIT 1`,
      );

      const columnType = String(rows[0]?.COLUMN_TYPE || '');
      const hasInviteType = columnType.includes("'friend_challenge_invite'");
      const hasResponseType = columnType.includes("'friend_challenge_response'");
      if (!hasInviteType || !hasResponseType) {
        const enumList = CHALLENGE_NOTIFICATION_TYPES.map((value) => `'${value}'`).join(', ');
        await pool.execute(
          `ALTER TABLE notifications
           MODIFY COLUMN type ENUM(${enumList}) NOT NULL DEFAULT 'system'`,
        );
      }

      await pool.execute(
        `UPDATE notifications
         SET type = 'friend_challenge_invite'
         WHERE (type = '' OR type = 'system')
           AND title = 'New Challenge'
           AND JSON_VALID(data)
           AND JSON_EXTRACT(data, '$.senderUserId') IS NOT NULL
           AND JSON_EXTRACT(data, '$.challengeKey') IS NOT NULL`,
      );

      await pool.execute(
        `UPDATE notifications
         SET type = 'friend_challenge_response'
         WHERE (type = '' OR type = 'system')
           AND (title = 'Challenge Accepted' OR title = 'Challenge Declined')
           AND JSON_VALID(data)
           AND JSON_EXTRACT(data, '$.receiverNotificationId') IS NOT NULL
           AND JSON_EXTRACT(data, '$.challengeKey') IS NOT NULL`,
      );
    })().catch((error) => {
      challengeNotificationTypesPromise = null;
      throw error;
    });
  }
  return challengeNotificationTypesPromise;
};

const ensureGamificationInfrastructure = async () => {
  const ensureColumnExists = async (tableName, columnName, alterSql) => {
    const [rows] = await pool.execute(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND column_name = ?
       LIMIT 1`,
      [tableName, columnName],
    );

    if (!rows.length) {
      await pool.execute(alterSql);
    }
  };

  const ensureIndexExists = async (tableName, indexName, createSql) => {
    const [rows] = await pool.execute(
      `SELECT 1
       FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND index_name = ?
       LIMIT 1`,
      [tableName, indexName],
    );

    if (!rows.length) {
      await pool.execute(createSql);
    }
  };

  await ensureColumnExists('users', 'total_points', 'ALTER TABLE users ADD COLUMN total_points INT NOT NULL DEFAULT 0');
  await ensureColumnExists('users', 'total_workouts', 'ALTER TABLE users ADD COLUMN total_workouts INT NOT NULL DEFAULT 0');
  await ensureColumnExists('users', 'rank', "ALTER TABLE users ADD COLUMN `rank` VARCHAR(50) NOT NULL DEFAULT 'Bronze'");
  await ensureColumnExists('users', 'total_xp', 'ALTER TABLE users ADD COLUMN total_xp INT NOT NULL DEFAULT 0');
  await ensureColumnExists('users', 'current_level_id', 'ALTER TABLE users ADD COLUMN current_level_id INT NULL');
  await ensureIndexExists('users', 'idx_users_current_level_id', 'CREATE INDEX idx_users_current_level_id ON users (current_level_id)');
  await ensureFriendChallengeInfrastructure();

  await pool.execute(
    `UPDATE users
     SET total_points = COALESCE(total_points, 0),
         total_workouts = COALESCE(total_workouts, 0),
         total_xp = CASE
           WHEN COALESCE(total_xp, 0) > 0 THEN total_xp
           ELSE COALESCE(total_points, 0)
         END,
         \`rank\` = CASE
           WHEN TRIM(COALESCE(\`rank\`, '')) = '' THEN 'Bronze'
           WHEN LOWER(TRIM(\`rank\`)) = 'beginner' THEN 'Bronze'
           ELSE \`rank\`
         END`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS levels (
      id INT PRIMARY KEY AUTO_INCREMENT,
      level_number INT NOT NULL UNIQUE,
      level_name VARCHAR(80) NOT NULL,
      xp_required INT NOT NULL,
      tier INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS xp_transactions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      source_type ENUM(
        'workout',
        'planned_workout',
        'pr',
        'challenge_complete',
        'challenge_win',
        'mission_complete',
        'nutrition',
        'hydration',
        'sleep',
        'progress_photo',
        'share',
        'referral',
        'program_week',
        'program_complete',
        'badge_unlock',
        'achievement_unlock',
        'level_up',
        'manual_adjustment'
      ) NOT NULL,
      source_id BIGINT NULL,
      xp_amount INT NOT NULL,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_xp_transactions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_xp_user_created (user_id, created_at)
    ) ENGINE=InnoDB`
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_xp (
      user_id INT UNSIGNED PRIMARY KEY,
      total_xp INT NOT NULL DEFAULT 0,
      current_level_id INT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_xp_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_xp_level
        FOREIGN KEY (current_level_id) REFERENCES levels(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`
  );

  for (const level of XP_LEVELS) {
    await pool.execute(
      `INSERT INTO levels (level_number, level_name, xp_required, tier)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         level_name = VALUES(level_name),
         xp_required = VALUES(xp_required),
         tier = VALUES(tier)`,
      [level.levelNumber, level.levelName, level.xpRequired, level.tier],
    );
  }

  await pool.execute(
    `INSERT INTO user_xp (user_id, total_xp, current_level_id)
     SELECT u.id,
            GREATEST(COALESCE(u.total_xp, 0), COALESCE(u.total_points, 0)),
            (
              SELECT l.id
              FROM levels l
              WHERE l.xp_required <= GREATEST(COALESCE(u.total_xp, 0), COALESCE(u.total_points, 0))
              ORDER BY l.xp_required DESC, l.id DESC
              LIMIT 1
            )
     FROM users u
     WHERE NOT EXISTS (
       SELECT 1
       FROM user_xp ux
       WHERE ux.user_id = u.id
     )`,
  );

  await pool.execute(
    `UPDATE users u
     JOIN user_xp ux ON ux.user_id = u.id
     SET u.current_level_id = ux.current_level_id
     WHERE u.current_level_id IS NULL`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS missions (
      id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      name VARCHAR(120) NULL,
      description TEXT NULL,
      mission_type ENUM('daily', 'weekly', 'monthly', 'achievement', 'special') NOT NULL,
      category VARCHAR(50) NULL,
      metric_key VARCHAR(100) NULL,
      target_value INT UNSIGNED NOT NULL DEFAULT 1,
      points_reward INT NOT NULL DEFAULT 0,
      xp_reward INT NOT NULL DEFAULT 0,
      reward_id BIGINT NULL,
      badge_icon VARCHAR(100) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      starts_at DATETIME NULL,
      expires_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_missions_active (is_active),
      INDEX idx_missions_type (mission_type),
      INDEX idx_missions_reward (reward_id)
    ) ENGINE=InnoDB`
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_missions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      mission_id INT UNSIGNED NOT NULL,
      assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      instance_key VARCHAR(30) NOT NULL DEFAULT 'default',
      current_progress INT UNSIGNED NOT NULL DEFAULT 0,
      progress_value DECIMAL(12,2) NOT NULL DEFAULT 0,
      baseline_value INT UNSIGNED NOT NULL DEFAULT 0,
      target_value INT UNSIGNED NOT NULL,
      status ENUM('active', 'completed', 'expired') NOT NULL DEFAULT 'active',
      completed_at DATETIME NULL,
      expires_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_missions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_missions_mission FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
      UNIQUE KEY uk_user_missions_unique_instance (user_id, mission_id, instance_key),
      INDEX idx_user_missions_user_status (user_id, status),
      INDEX idx_user_missions_assigned (user_id, assigned_at)
    ) ENGINE=InnoDB`
  );

  await ensureColumnExists(
    'missions',
    'name',
    'ALTER TABLE missions ADD COLUMN name VARCHAR(120) NULL AFTER title',
  );
  await ensureColumnExists(
    'missions',
    'xp_reward',
    'ALTER TABLE missions ADD COLUMN xp_reward INT NOT NULL DEFAULT 0 AFTER points_reward',
  );
  await ensureColumnExists(
    'missions',
    'reward_id',
    'ALTER TABLE missions ADD COLUMN reward_id BIGINT NULL AFTER xp_reward',
  );
  await ensureColumnExists(
    'missions',
    'active',
    'ALTER TABLE missions ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE AFTER reward_id',
  );
  await ensureIndexExists('missions', 'idx_missions_reward', 'CREATE INDEX idx_missions_reward ON missions (reward_id)');
  await pool.execute(
    `UPDATE missions
     SET name = COALESCE(NULLIF(name, ''), title),
         active = CASE
           WHEN is_active = 0 THEN FALSE
           ELSE TRUE
         END`,
  );

  await ensureColumnExists(
    'user_missions',
    'baseline_value',
    'ALTER TABLE user_missions ADD COLUMN baseline_value INT UNSIGNED NOT NULL DEFAULT 0 AFTER current_progress',
  );
  await ensureColumnExists(
    'user_missions',
    'assigned_at',
    'ALTER TABLE user_missions ADD COLUMN assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER mission_id',
  );
  await ensureColumnExists(
    'user_missions',
    'progress_value',
    'ALTER TABLE user_missions ADD COLUMN progress_value DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER current_progress',
  );
  await ensureIndexExists(
    'user_missions',
    'idx_user_missions_assigned',
    'CREATE INDEX idx_user_missions_assigned ON user_missions (user_id, assigned_at)',
  );
  await pool.execute(
    `UPDATE user_missions
     SET assigned_at = COALESCE(assigned_at, created_at),
         progress_value = CASE
           WHEN progress_value > 0 THEN progress_value
           ELSE CAST(current_progress AS DECIMAL(12,2))
         END`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS challenge_templates (
      id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      challenge_type ENUM('daily', 'weekly') NOT NULL,
      category VARCHAR(50) NULL,
      metric_key VARCHAR(100) NOT NULL,
      target_value INT UNSIGNED NOT NULL DEFAULT 1,
      points_reward INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      starts_at DATETIME NULL,
      expires_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_challenge_templates_active_type (is_active, challenge_type)
    ) ENGINE=InnoDB`
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_challenges (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      challenge_template_id INT UNSIGNED NOT NULL,
      instance_key VARCHAR(30) NOT NULL,
      current_progress INT UNSIGNED NOT NULL DEFAULT 0,
      target_value INT UNSIGNED NOT NULL,
      status ENUM('active', 'completed', 'expired') NOT NULL DEFAULT 'active',
      completed_at DATETIME NULL,
      expires_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_challenges_template FOREIGN KEY (challenge_template_id) REFERENCES challenge_templates(id) ON DELETE CASCADE,
      UNIQUE KEY uk_user_challenges_instance (user_id, challenge_template_id, instance_key),
      INDEX idx_user_challenges_user_status (user_id, status)
    ) ENGINE=InnoDB`
  );

  const missionSeeds = [
    {
      title: 'Workout Starter',
      description: 'Complete 5 workout days',
      missionType: 'weekly',
      category: 'workout',
      metricKey: 'workouts_completed',
      targetValue: 5,
      pointsReward: 20,
      badgeIcon: 'flame',
    },
    {
      title: 'Getting Started',
      description: 'Complete 10 workout days',
      missionType: 'weekly',
      category: 'workout',
      metricKey: 'workouts_completed',
      targetValue: 10,
      pointsReward: 50,
      badgeIcon: 'dumbbell',
    },
    {
      title: 'Workout Machine',
      description: 'Complete 20 workout days',
      missionType: 'weekly',
      category: 'workout',
      metricKey: 'workouts_completed',
      targetValue: 20,
      pointsReward: 90,
      badgeIcon: 'zap',
    },
    {
      title: 'Recovery Habit',
      description: 'Log recovery on 5 days',
      missionType: 'weekly',
      category: 'recovery',
      metricKey: 'recovery_logs_total',
      targetValue: 5,
      pointsReward: 25,
      badgeIcon: 'heart',
    },
    {
      title: 'Recovery Master',
      description: 'Log recovery on 12 days',
      missionType: 'weekly',
      category: 'recovery',
      metricKey: 'recovery_logs_total',
      targetValue: 12,
      pointsReward: 55,
      badgeIcon: 'heart-pulse',
    },
    {
      title: 'Streak Starter',
      description: 'Reach a 3-day recovery streak',
      missionType: 'weekly',
      category: 'recovery',
      metricKey: 'recovery_streak_days',
      targetValue: 3,
      pointsReward: 20,
      badgeIcon: 'sparkles',
    },
    {
      title: 'Streak Warrior',
      description: 'Reach a 7-day recovery streak',
      missionType: 'weekly',
      category: 'recovery',
      metricKey: 'recovery_streak_days',
      targetValue: 7,
      pointsReward: 45,
      badgeIcon: 'shield',
    },
    {
      title: 'Consistency King',
      description: 'Train for 30 workout days',
      missionType: 'monthly',
      category: 'streak',
      metricKey: 'training_days',
      targetValue: 30,
      pointsReward: 100,
      badgeIcon: 'crown',
    },
  ];

  for (const seed of missionSeeds) {
    await pool.execute(
      `INSERT INTO missions
         (title, description, mission_type, category, metric_key, target_value, points_reward, badge_icon, is_active)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1
       WHERE NOT EXISTS (
         SELECT 1 FROM missions WHERE title = ?
       )`,
      [
        seed.title,
        seed.description,
        seed.missionType,
        seed.category,
        seed.metricKey,
        seed.targetValue,
        seed.pointsReward,
        seed.badgeIcon,
        seed.title,
      ],
    );
  }

  await pool.execute(
    `UPDATE missions
     SET description = 'Complete 10 workouts', metric_key = 'workouts_completed', target_value = 10
     WHERE title = 'Getting Started'`,
  );

  await pool.execute(
    `UPDATE missions
     SET description = 'Complete 5 workouts', metric_key = 'workouts_completed', target_value = 5
     WHERE title = 'Workout Starter'`,
  );

  await pool.execute(
    `UPDATE missions
     SET description = 'Complete 20 workouts', metric_key = 'workouts_completed', target_value = 20
     WHERE title = 'Workout Machine'`,
  );

  await pool.execute(
    `INSERT INTO challenge_templates (title, description, challenge_type, category, metric_key, target_value, points_reward, is_active)
     SELECT 'Daily Iron Habit', 'Complete at least one workout today', 'daily', 'workout', 'workout_days_today', 1, 15, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM challenge_templates WHERE metric_key = 'workout_days_today' AND challenge_type = 'daily'
     )`
  );

  await pool.execute(
    `INSERT INTO challenge_templates (title, description, challenge_type, category, metric_key, target_value, points_reward, is_active)
     SELECT 'Daily Recovery Check', 'Submit your recovery check-in today', 'daily', 'recovery', 'recovery_logs_today', 1, 10, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM challenge_templates WHERE metric_key = 'recovery_logs_today' AND challenge_type = 'daily'
     )`
  );

  await pool.execute(
    `INSERT INTO challenge_templates (title, description, challenge_type, category, metric_key, target_value, points_reward, is_active)
     SELECT 'Weekly Workout Consistency', 'Train on 4 different days this week', 'weekly', 'workout', 'workout_days_this_week', 4, 45, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM challenge_templates WHERE metric_key = 'workout_days_this_week' AND challenge_type = 'weekly'
     )`
  );

  await pool.execute(
    `INSERT INTO challenge_templates (title, description, challenge_type, category, metric_key, target_value, points_reward, is_active)
     SELECT 'Weekly Recovery Discipline', 'Log recovery on 5 days this week', 'weekly', 'recovery', 'recovery_logs_this_week', 5, 35, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM challenge_templates WHERE metric_key = 'recovery_logs_this_week' AND challenge_type = 'weekly'
     )`
  );
};

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const formatGamificationInitError = (error) => {
  const message = error?.message || String(error);
  const host = String(process.env.DB_HOST || '127.0.0.1').trim() || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const database = String(process.env.DB_NAME || '').trim() || '(unset)';
  const user = String(process.env.DB_USER || '').trim() || '(unset)';

  if (error?.code === 'ECONNREFUSED') {
    return `${message}. MySQL is not reachable at ${host}:${port}; check DB_HOST/DB_PORT and make sure the MySQL service is running.`;
  }

  if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
    return `${message}. MySQL rejected the credentials for DB_USER=${user}; check DB_USER/DB_PASSWORD in .env.`;
  }

  if (error?.code === 'ER_BAD_DB_ERROR') {
    return `${message}. Database "${database}" does not exist; create it or import server/init_innodb.sql.`;
  }

  return message;
};

const initializeGamificationInfrastructureWithRetry = async () => {
  const maxAttempts = Math.max(1, Number.parseInt(process.env.GAMIFICATION_INIT_RETRIES || '3', 10) || 3);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await ensureGamificationInfrastructure();
      return true;
    } catch (error) {
      const message = formatGamificationInitError(error);
      if (attempt >= maxAttempts) {
        console.error('Failed to initialize gamification infrastructure:', message);
        return false;
      }

      console.warn(`Gamification infrastructure init attempt ${attempt}/${maxAttempts} failed:`, message);
      await delay(2000 * attempt);
    }
  }

  return false;
};

const gamificationReady = initializeGamificationInfrastructureWithRetry();

const collectUserGamificationMetrics = async (userId, baseDate = new Date()) => {
  const startOfWeek = formatDateISO(getStartOfWeek(baseDate));
  const endOfWeek = formatDateISO(getEndOfWeek(baseDate));

  const [
    [workoutCompletionRows],
    [trainingDaysRows],
    [workoutTodayRows],
    [workoutWeekRows],
    [recoveryTotalRows],
    [recoveryTodayRows],
    [recoveryWeekRows],
    [recoveryDateRows],
  ] = await Promise.all([
    pool.execute(
      `SELECT COUNT(
          DISTINCT COALESCE(
            CONCAT('session:', session_id),
            CONCAT('day_exercise:', DATE(created_at), '|', LOWER(TRIM(exercise_name)))
          )
        ) AS c
       FROM workout_sets
       WHERE user_id = ? AND completed = 1`,
      [userId],
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS c
       FROM workout_sets
       WHERE user_id = ? AND completed = 1`,
      [userId],
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS c
       FROM workout_sets
       WHERE user_id = ? AND completed = 1 AND DATE(created_at) = CURDATE()`,
      [userId],
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS c
       FROM workout_sets
       WHERE user_id = ? AND completed = 1 AND DATE(created_at) BETWEEN ? AND ?`,
      [userId, startOfWeek, endOfWeek],
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT DATE(recorded_at)) AS c
       FROM recovery_history
       WHERE user_id = ?`,
      [userId],
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT DATE(recorded_at)) AS c
       FROM recovery_history
       WHERE user_id = ? AND DATE(recorded_at) = CURDATE()`,
      [userId],
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT DATE(recorded_at)) AS c
       FROM recovery_history
       WHERE user_id = ? AND DATE(recorded_at) BETWEEN ? AND ?`,
      [userId, startOfWeek, endOfWeek],
    ),
    pool.execute(
      `SELECT DISTINCT DATE(recorded_at) AS log_date
       FROM recovery_history
       WHERE user_id = ?
       ORDER BY log_date DESC
       LIMIT 180`,
      [userId],
    ),
  ]);

  const recoveryDateSet = new Set(
    recoveryDateRows
      .map((row) => row.log_date ? formatDateISO(row.log_date) : null)
      .filter(Boolean),
  );

  let recoveryStreakDays = 0;
  const cursor = getStartOfDay(baseDate);
  for (let i = 0; i < 180; i += 1) {
    const key = formatDateISO(cursor);
    if (!recoveryDateSet.has(key)) break;
    recoveryStreakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const workoutsCompleted = Number(workoutCompletionRows[0]?.c || 0);
  const trainingDays = Number(trainingDaysRows[0]?.c || 0);
  const workoutDaysToday = Number(workoutTodayRows[0]?.c || 0);
  const workoutDaysThisWeek = Number(workoutWeekRows[0]?.c || 0);
  const recoveryLogsTotal = Number(recoveryTotalRows[0]?.c || 0);
  const recoveryLogsToday = Number(recoveryTodayRows[0]?.c || 0);
  const recoveryLogsThisWeek = Number(recoveryWeekRows[0]?.c || 0);

  return {
    workouts_completed: workoutsCompleted,
    training_days: trainingDays,
    workout_days_today: workoutDaysToday,
    workout_days_this_week: workoutDaysThisWeek,
    recovery_logs_total: recoveryLogsTotal,
    recovery_logs_today: recoveryLogsToday,
    recovery_logs_this_week: recoveryLogsThisWeek,
    recovery_streak_days: recoveryStreakDays,
  };
};

const assignWeeklyMissionSlots = async (userId, metrics, now = new Date()) => {
  const currentWeekKey = getWeeklyInstanceKey(now);

  const [userMissionRows] = await pool.execute(
    `SELECT um.mission_id, um.instance_key, um.status
     FROM user_missions um
     JOIN missions m ON m.id = um.mission_id
     WHERE um.user_id = ?
       AND m.mission_type = 'weekly'`,
    [userId],
  );

  const activeRows = userMissionRows.filter((row) => row.status === 'active');
  const hasAnyAssignments = userMissionRows.length > 0;
  const hasAssignmentThisWeek = userMissionRows.some((row) => row.instance_key === currentWeekKey);

  let slotsToFill = 0;
  if (!hasAnyAssignments) {
    slotsToFill = WEEKLY_ACTIVE_MISSION_TARGET;
  } else if (activeRows.length < WEEKLY_ACTIVE_MISSION_TARGET && !hasAssignmentThisWeek) {
    slotsToFill = WEEKLY_ACTIVE_MISSION_TARGET - activeRows.length;
  }

  if (slotsToFill <= 0) return;

  const [missionTemplates] = await pool.execute(
    `SELECT id, category, metric_key, target_value, expires_at
     FROM missions
     WHERE mission_type = 'weekly'
       AND is_active = 1
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (expires_at IS NULL OR expires_at >= NOW())
     ORDER BY id ASC`,
  );

  if (!missionTemplates.length) return;

  const activeMissionIds = new Set(activeRows.map((row) => Number(row.mission_id)));
  let candidates = missionTemplates.filter((mission) => !activeMissionIds.has(Number(mission.id)));
  if (candidates.length < slotsToFill) {
    candidates = missionTemplates;
  }

  const candidateIds = candidates.map((mission) => Number(mission.id));
  const candidatePlaceholders = candidateIds.map(() => '?').join(', ');
  const historyRows = candidateIds.length
    ? (await pool.execute(
      `SELECT
          mission_id,
          COUNT(*) AS assigned_count,
          SUM(
            CASE
              WHEN completed_at IS NOT NULL AND completed_at >= DATE_SUB(?, INTERVAL 30 DAY)
                THEN 1
              ELSE 0
            END
          ) AS recent_completed_count
       FROM user_missions
       WHERE user_id = ? AND mission_id IN (${candidatePlaceholders})
       GROUP BY mission_id`,
      [now, userId, ...candidateIds],
    ))[0]
    : [];

  const historyByMissionId = new Map(
    historyRows.map((row) => [
      Number(row.mission_id || 0),
      {
        assignedCount: Number(row.assigned_count || 0),
        recentCompletedCount: Number(row.recent_completed_count || 0),
      },
    ]),
  );

  const expectedByMetricKey = {
    workouts_completed: Math.max(1, Number(metrics.workout_days_this_week || 0)),
    training_days: Math.max(1, Number(metrics.workout_days_this_week || 0)),
    recovery_logs_total: Math.max(1, Number(metrics.recovery_logs_this_week || 0)),
    recovery_streak_days: Math.max(1, Number(metrics.recovery_streak_days || 1)),
  };

  const personalized = candidates
    .map((mission) => {
      const missionId = Number(mission.id || 0);
      const metricKey = String(mission.metric_key || '').toLowerCase().trim();
      const expected = Math.max(
        1,
        Number(
          expectedByMetricKey[metricKey]
          || Math.max(
            Number(metrics.workout_days_this_week || 0),
            Number(metrics.recovery_logs_this_week || 0),
            1,
          ),
        ),
      );
      const target = Math.max(1, Number(mission.target_value || 1));
      const difficultyScore = Math.abs(target - expected) / expected;
      const history = historyByMissionId.get(missionId) || { assignedCount: 0, recentCompletedCount: 0 };
      let seed = 2166136261;
      const seedInput = `${userId}:${currentWeekKey}:${missionId}`;
      for (let i = 0; i < seedInput.length; i += 1) {
        seed ^= seedInput.charCodeAt(i);
        seed = Math.imul(seed, 16777619);
      }
      const jitter = ((seed >>> 0) % 1000) / 1000;
      return {
        ...mission,
        missionId,
        metricKey,
        category: String(mission.category || '').toLowerCase().trim(),
        score: difficultyScore
          + Math.min(2, history.assignedCount * 0.35)
          + (history.recentCompletedCount > 0 ? 0.5 : 0)
          + jitter * 0.08,
      };
    })
    .sort((a, b) => (a.score - b.score) || (a.missionId - b.missionId));

  const selectedMissions = [];
  const selectedIds = new Set();
  const usedMetricKeys = new Set();
  const usedCategories = new Set();

  for (let index = 0; index < personalized.length; index += 1) {
    const mission = personalized[index];
    if (selectedMissions.length >= slotsToFill) break;
    const remainingCandidates = personalized.length - index;
    const remainingSlots = slotsToFill - selectedMissions.length;
    const metricAlreadyUsed = mission.metricKey && usedMetricKeys.has(mission.metricKey);
    const categoryAlreadyUsed = mission.category && usedCategories.has(mission.category);
    const diversityFlexible = remainingCandidates <= remainingSlots;

    if ((metricAlreadyUsed || categoryAlreadyUsed) && !diversityFlexible) {
      continue;
    }

    selectedMissions.push(mission);
    selectedIds.add(mission.missionId);
    if (mission.metricKey) usedMetricKeys.add(mission.metricKey);
    if (mission.category) usedCategories.add(mission.category);
  }

  if (selectedMissions.length < slotsToFill) {
    for (const mission of personalized) {
      if (selectedMissions.length >= slotsToFill) break;
      if (selectedIds.has(mission.missionId)) continue;
      selectedMissions.push(mission);
      selectedIds.add(mission.missionId);
    }
  }

  for (const mission of selectedMissions) {
    const target = Math.max(1, Number(mission.target_value || 1));
    const baselineValue = Math.floor(getMetricValue(metrics, mission.metric_key));

    await pool.execute(
      `INSERT INTO user_missions
         (user_id, mission_id, instance_key, current_progress, baseline_value, target_value, status, completed_at, expires_at)
       VALUES (?, ?, ?, 0, ?, ?, 'active', NULL, ?)
       ON DUPLICATE KEY UPDATE
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        Number(mission.id),
        currentWeekKey,
        baselineValue,
        target,
        mission.expires_at || null,
      ],
    );
  }
};

const assignMonthlyMissionSlots = async (userId, metrics, now = new Date()) => {
  const currentMonthKey = getMonthlyInstanceKey(now);

  const [userMissionRows] = await pool.execute(
    `SELECT um.mission_id, um.instance_key, um.status
     FROM user_missions um
     JOIN missions m ON m.id = um.mission_id
     WHERE um.user_id = ?
       AND m.mission_type = 'monthly'`,
    [userId],
  );

  const activeRows = userMissionRows.filter((row) => row.status === 'active');
  const hasAnyAssignments = userMissionRows.length > 0;
  const hasAssignmentThisMonth = userMissionRows.some((row) => row.instance_key === currentMonthKey);

  let slotsToFill = 0;
  if (!hasAnyAssignments) {
    slotsToFill = MONTHLY_ACTIVE_MISSION_TARGET;
  } else if (activeRows.length < MONTHLY_ACTIVE_MISSION_TARGET && !hasAssignmentThisMonth) {
    slotsToFill = MONTHLY_ACTIVE_MISSION_TARGET - activeRows.length;
  }

  if (slotsToFill <= 0) return;

  const [missionTemplates] = await pool.execute(
    `SELECT id, category, metric_key, target_value, expires_at
     FROM missions
     WHERE mission_type = 'monthly'
       AND is_active = 1
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (expires_at IS NULL OR expires_at >= NOW())
     ORDER BY id ASC`,
  );

  if (!missionTemplates.length) return;

  const activeMissionIds = new Set(activeRows.map((row) => Number(row.mission_id)));
  let candidates = missionTemplates.filter((mission) => !activeMissionIds.has(Number(mission.id)));
  if (candidates.length < slotsToFill) {
    candidates = missionTemplates;
  }

  const candidateIds = candidates.map((mission) => Number(mission.id));
  const candidatePlaceholders = candidateIds.map(() => '?').join(', ');
  const historyRows = candidateIds.length
    ? (await pool.execute(
      `SELECT
          mission_id,
          COUNT(*) AS assigned_count,
          SUM(
            CASE
              WHEN completed_at IS NOT NULL AND completed_at >= DATE_SUB(?, INTERVAL 90 DAY)
                THEN 1
              ELSE 0
            END
          ) AS recent_completed_count
       FROM user_missions
       WHERE user_id = ? AND mission_id IN (${candidatePlaceholders})
       GROUP BY mission_id`,
      [now, userId, ...candidateIds],
    ))[0]
    : [];

  const historyByMissionId = new Map(
    historyRows.map((row) => [
      Number(row.mission_id || 0),
      {
        assignedCount: Number(row.assigned_count || 0),
        recentCompletedCount: Number(row.recent_completed_count || 0),
      },
    ]),
  );

  const expectedByMetricKey = {
    workouts_completed: Math.max(2, Number(metrics.workout_days_this_week || 0) * 4),
    training_days: Math.max(2, Number(metrics.workout_days_this_week || 0) * 4),
    recovery_logs_total: Math.max(2, Number(metrics.recovery_logs_this_week || 0) * 4),
    recovery_streak_days: Math.max(2, Number(metrics.recovery_streak_days || 1)),
  };

  const personalized = candidates
    .map((mission) => {
      const missionId = Number(mission.id || 0);
      const metricKey = String(mission.metric_key || '').toLowerCase().trim();
      const expected = Math.max(
        1,
        Number(
          expectedByMetricKey[metricKey]
          || Math.max(
            Number(metrics.workout_days_this_week || 0) * 4,
            Number(metrics.recovery_logs_this_week || 0) * 4,
            4,
          ),
        ),
      );
      const target = Math.max(1, Number(mission.target_value || 1));
      const difficultyScore = Math.abs(target - expected) / expected;
      const history = historyByMissionId.get(missionId) || { assignedCount: 0, recentCompletedCount: 0 };
      let seed = 2166136261;
      const seedInput = `${userId}:${currentMonthKey}:${missionId}`;
      for (let i = 0; i < seedInput.length; i += 1) {
        seed ^= seedInput.charCodeAt(i);
        seed = Math.imul(seed, 16777619);
      }
      const jitter = ((seed >>> 0) % 1000) / 1000;
      return {
        ...mission,
        missionId,
        metricKey,
        category: String(mission.category || '').toLowerCase().trim(),
        score: difficultyScore
          + Math.min(2, history.assignedCount * 0.35)
          + (history.recentCompletedCount > 0 ? 0.8 : 0)
          + jitter * 0.08,
      };
    })
    .sort((a, b) => (a.score - b.score) || (a.missionId - b.missionId));

  const selectedMissions = [];
  const selectedIds = new Set();
  const usedMetricKeys = new Set();
  const usedCategories = new Set();

  for (let index = 0; index < personalized.length; index += 1) {
    const mission = personalized[index];
    if (selectedMissions.length >= slotsToFill) break;
    const remainingCandidates = personalized.length - index;
    const remainingSlots = slotsToFill - selectedMissions.length;
    const metricAlreadyUsed = mission.metricKey && usedMetricKeys.has(mission.metricKey);
    const categoryAlreadyUsed = mission.category && usedCategories.has(mission.category);
    const diversityFlexible = remainingCandidates <= remainingSlots;

    if ((metricAlreadyUsed || categoryAlreadyUsed) && !diversityFlexible) {
      continue;
    }

    selectedMissions.push(mission);
    selectedIds.add(mission.missionId);
    if (mission.metricKey) usedMetricKeys.add(mission.metricKey);
    if (mission.category) usedCategories.add(mission.category);
  }

  if (selectedMissions.length < slotsToFill) {
    for (const mission of personalized) {
      if (selectedMissions.length >= slotsToFill) break;
      if (selectedIds.has(mission.missionId)) continue;
      selectedMissions.push(mission);
      selectedIds.add(mission.missionId);
    }
  }

  for (const mission of selectedMissions) {
    const target = Math.max(1, Number(mission.target_value || 1));
    const baselineValue = Math.floor(getMetricValue(metrics, mission.metric_key));

    await pool.execute(
      `INSERT INTO user_missions
         (user_id, mission_id, instance_key, current_progress, baseline_value, target_value, status, completed_at, expires_at)
       VALUES (?, ?, ?, 0, ?, ?, 'active', NULL, ?)
       ON DUPLICATE KEY UPDATE
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        Number(mission.id),
        currentMonthKey,
        baselineValue,
        target,
        mission.expires_at || null,
      ],
    );
  }
};

const syncUserMissionProgress = async (userId, metrics, now = new Date()) => {
  const dailyKey = getDailyInstanceKey(now);
  const weeklyKey = getWeeklyInstanceKey(now);
  const monthlyKey = getMonthlyInstanceKey(now);

  await pool.execute(
    `UPDATE user_missions um
     JOIN missions m ON m.id = um.mission_id
     SET um.status = 'expired',
         um.updated_at = CURRENT_TIMESTAMP
     WHERE um.user_id = ?
       AND um.status = 'active'
       AND (
         (um.expires_at IS NOT NULL AND um.expires_at < ?)
         OR (m.mission_type = 'daily' AND um.instance_key <> ?)
         OR (m.mission_type = 'weekly' AND um.instance_key <> ?)
         OR (m.mission_type = 'monthly' AND um.instance_key <> ?)
       )`,
    [userId, now, dailyKey, weeklyKey, monthlyKey],
  );

  await assignWeeklyMissionSlots(userId, metrics, now);
  await assignMonthlyMissionSlots(userId, metrics, now);

  const [rows] = await pool.execute(
    `SELECT
       um.id AS user_mission_id,
       um.mission_id,
       um.instance_key,
       um.current_progress,
       um.baseline_value,
       um.target_value,
       um.status,
       um.completed_at,
       um.assigned_at,
       um.created_at,
       m.title,
       m.description,
       m.points_reward,
       m.mission_type,
       m.metric_key
     FROM user_missions um
     JOIN missions m ON m.id = um.mission_id
     WHERE um.user_id = ?
     ORDER BY FIELD(um.status, 'active', 'completed', 'expired'), um.created_at DESC, um.id DESC`,
    [userId],
  );

  if (!rows.length) return [];

  const normalized = [];

  for (const row of rows) {
    const target = Math.max(1, Number(row.target_value || 1));
    const baseline = Math.max(0, Number(row.baseline_value || 0));
    const currentMetric = Math.floor(getMetricValue(metrics, row.metric_key));

    const computedProgress = row.status === 'completed'
      ? Math.max(Number(row.current_progress || target), target)
      : Math.max(0, currentMetric - baseline);

    const isExpired = row.status === 'expired';
    const completed = row.status === 'completed' || (!isExpired && computedProgress >= target);
    const status = completed ? 'completed' : isExpired ? 'expired' : 'active';
    const finalProgress = completed
      ? Math.max(target, computedProgress)
      : isExpired
        ? Math.max(0, Number(row.current_progress || 0))
        : computedProgress;
    const completedAt = completed ? (row.completed_at || now) : null;

    const shouldUpdate = Number(row.current_progress || 0) !== finalProgress
      || String(row.status || '') !== status
      || (!!row.completed_at) !== (!!completedAt);

    if (shouldUpdate) {
      await pool.execute(
        `UPDATE user_missions
         SET current_progress = ?,
             status = ?,
             completed_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [finalProgress, status, completedAt, Number(row.user_mission_id)],
      );
    }

    normalized.push({
      id: Number(row.user_mission_id),
      mission_id: Number(row.mission_id),
      instance_key: row.instance_key,
      title: row.title,
      description: row.description,
      points_reward: Number(row.points_reward || 0),
      progress: finalProgress,
      target,
      completed,
      remaining: Math.max(0, target - finalProgress),
      completed_at: completedAt || null,
      status,
      mission_type: row.mission_type,
      metric_key: row.metric_key,
      assigned_at: row.assigned_at || row.created_at,
      created_at: row.created_at,
    });
  }

  return normalized;
};

const syncUserChallengeProgress = async (userId, metrics, now = new Date()) => {
  const dailyKey = getDailyInstanceKey(now);
  const weeklyKey = getWeeklyInstanceKey(now);
  const endOfToday = getEndOfDay(now);
  const endOfThisWeek = getEndOfWeek(now);

  await pool.execute(
    `UPDATE user_challenges uc
     JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
     SET uc.status = 'expired',
         uc.updated_at = CURRENT_TIMESTAMP
     WHERE uc.user_id = ?
       AND uc.status = 'active'
       AND (
         (uc.expires_at IS NOT NULL AND uc.expires_at < ?)
         OR (ct.challenge_type = 'daily' AND uc.instance_key <> ?)
         OR (ct.challenge_type = 'weekly' AND uc.instance_key <> ?)
       )`,
    [userId, now, dailyKey, weeklyKey],
  );

  const [templateRows] = await pool.execute(
    `SELECT id, title, description, challenge_type, category, metric_key, target_value, points_reward, starts_at, expires_at
     FROM challenge_templates
     WHERE is_active = 1
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (expires_at IS NULL OR expires_at >= NOW())
     ORDER BY FIELD(challenge_type, 'daily', 'weekly'), id ASC`,
  );

  if (!templateRows.length) return [];

  const templateIds = templateRows.map((row) => Number(row.id));
  const templatePlaceholders = templateIds.map(() => '?').join(', ');
  const [existingRows] = await pool.execute(
    `SELECT id, challenge_template_id, instance_key, current_progress, target_value, status, completed_at, created_at
     FROM user_challenges
     WHERE user_id = ? AND challenge_template_id IN (${templatePlaceholders})`,
    [userId, ...templateIds],
  );

  const existingByTemplateAndKey = new Map(
    existingRows.map((row) => [`${Number(row.challenge_template_id)}:${row.instance_key}`, row]),
  );

  const normalized = [];

  for (const template of templateRows) {
    const templateId = Number(template.id);
    const challengeType = String(template.challenge_type || '').toLowerCase();
    const instanceKey = challengeType === 'daily'
      ? dailyKey
      : challengeType === 'weekly'
        ? weeklyKey
        : 'default';

    const key = `${templateId}:${instanceKey}`;
    const existing = existingByTemplateAndKey.get(key);
    const target = Math.max(1, Number(template.target_value || 1));
    const progress = Math.floor(getMetricValue(metrics, template.metric_key));
    const isExpired = existing?.status === 'expired';
    const alreadyCompleted = existing?.status === 'completed';
    const completed = alreadyCompleted || (!isExpired && progress >= target);
    const status = completed ? 'completed' : isExpired ? 'expired' : 'active';
    const completedAt = completed ? (existing?.completed_at || now) : null;
    const createdAt = existing?.created_at || now;
    const expiresAt = challengeType === 'daily'
      ? endOfToday
      : challengeType === 'weekly'
        ? endOfThisWeek
        : template.expires_at || null;

    const [challengeUpsertResult] = await pool.execute(
      `INSERT INTO user_challenges
         (user_id, challenge_template_id, instance_key, current_progress, target_value, status, completed_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          current_progress = VALUES(current_progress),
          target_value = VALUES(target_value),
          status = CASE
            WHEN user_challenges.status = 'completed' THEN 'completed'
            ELSE VALUES(status)
         END,
         completed_at = CASE
           WHEN user_challenges.completed_at IS NOT NULL THEN user_challenges.completed_at
           WHEN VALUES(status) = 'completed' THEN VALUES(completed_at)
           ELSE NULL
         END,
         expires_at = VALUES(expires_at),
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        templateId,
        instanceKey,
        progress,
        target,
        status,
        completedAt,
        expiresAt,
      ],
    );
    const userChallengeId = Number(challengeUpsertResult?.insertId || 0);

    normalized.push({
      id: userChallengeId || templateId,
      title: template.title,
      description: template.description,
      challenge_type: challengeType,
      category: template.category || null,
      metric_key: template.metric_key,
      points_reward: Number(template.points_reward || 0),
      instance_key: instanceKey,
      progress,
      target,
      completed,
      remaining: Math.max(0, target - progress),
      completed_at: completedAt || null,
      created_at: createdAt || null,
      status,
    });
  }

  return normalized;
};

const updateUserPointsAndRank = async (userId, metrics) => {
  const [
    [missionPointRows],
    [challengePointRows],
    [friendChallengePointRows],
    [completedMissionRows],
    [completedChallengeRows],
  ] = await Promise.all([
    pool.execute(
      `SELECT COALESCE(SUM(m.points_reward), 0) AS total_points
       FROM user_missions um
       JOIN missions m ON m.id = um.mission_id
       WHERE um.user_id = ? AND um.status = 'completed'`,
      [userId],
    ),
    pool.execute(
      `SELECT COALESCE(SUM(ct.points_reward), 0) AS total_points
       FROM user_challenges uc
       JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
       WHERE uc.user_id = ? AND uc.status = 'completed'`,
      [userId],
    ),
    pool.execute(
      `SELECT COALESCE(SUM(
          CASE
            WHEN participant_a_id = ? THEN participant_a_points
            WHEN participant_b_id = ? THEN participant_b_points
            ELSE 0
          END
        ), 0) AS total_points
       FROM friend_challenge_results
       WHERE participant_a_id = ? OR participant_b_id = ?`,
      [userId, userId, userId, userId],
    ),
    pool.execute(
      `SELECT COUNT(*) AS completed_count
       FROM user_missions
       WHERE user_id = ? AND status = 'completed'`,
      [userId],
    ),
    pool.execute(
      `SELECT COUNT(*) AS completed_count
       FROM user_challenges
       WHERE user_id = ? AND status = 'completed'`,
      [userId],
    ),
  ]);

  const missionPoints = Number(missionPointRows[0]?.total_points || 0);
  const challengePoints = Number(challengePointRows[0]?.total_points || 0);
  const friendChallengePoints = Number(friendChallengePointRows[0]?.total_points || 0);
  let blogPostCount = 0;
  try {
    const [blogRows] = await pool.execute(
      `SELECT COUNT(*) AS total_posts
       FROM blog_posts
       WHERE user_id = ?`,
      [userId],
    );
    blogPostCount = Number(blogRows[0]?.total_posts || 0);
  } catch {
    blogPostCount = 0;
  }
  const blogPoints = Math.max(0, blogPostCount) * BLOG_POST_UPLOAD_POINTS;
  const totalPoints = missionPoints + challengePoints + friendChallengePoints + blogPoints;
  const totalWorkouts = Math.max(0, Math.floor(Number(metrics.training_days || 0)));
  const rank = getRankFromPoints(totalPoints);

  await pool.execute(
    `UPDATE users
     SET total_points = ?, total_workouts = ?, \`rank\` = ?
     WHERE id = ?`,
    [totalPoints, totalWorkouts, rank, userId],
  );

  return {
    totalPoints,
    totalWorkouts,
    rank,
    missionPoints,
    challengePoints,
    friendChallengePoints,
    blogPostCount: Math.max(0, blogPostCount),
    blogPoints,
    completedMissions: Number(completedMissionRows[0]?.completed_count || 0),
    completedChallenges: Number(completedChallengeRows[0]?.completed_count || 0),
    nextRank: getNextRankInfo(totalPoints),
  };
};

const refreshGamificationForUser = async (userId, baseDate = new Date()) => {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;

  await gamificationReady;

  const [userRows] = await pool.execute(
    `SELECT id, role
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [normalizedUserId],
  );

  if (!userRows.length) return null;

  const metrics = await collectUserGamificationMetrics(normalizedUserId, baseDate);
  const missions = await syncUserMissionProgress(normalizedUserId, metrics, baseDate);
  const challenges = await syncUserChallengeProgress(normalizedUserId, metrics, baseDate);
  const summary = await updateUserPointsAndRank(normalizedUserId, metrics);

  return {
    userId: normalizedUserId,
    metrics,
    missions,
    challenges,
    ...summary,
  };
};

const getUserProgressionSnapshot = async (userId) => {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    return {
      totalXp: 0,
      currentLevel: null,
      nextLevel: null,
      unlockedBadges: 0,
      unlockedAchievements: 0,
      availableRewards: 0,
    };
  }

  const [xpRows] = await pool.execute(
    `SELECT
        COALESCE(ux.total_xp, 0) AS total_xp,
        l.id AS level_id,
        l.level_number,
        l.level_name,
        l.xp_required,
        l.tier
     FROM user_xp ux
     LEFT JOIN levels l ON l.id = ux.current_level_id
     WHERE ux.user_id = ?
     LIMIT 1`,
    [normalizedUserId],
  );

  const totalXp = Number(xpRows[0]?.total_xp || 0);
  const currentLevel = xpRows[0]?.level_id
    ? {
        id: Number(xpRows[0].level_id),
        levelNumber: Number(xpRows[0].level_number || 0),
        name: xpRows[0].level_name || '',
        xpRequired: Number(xpRows[0].xp_required || 0),
        tier: Number(xpRows[0].tier || 0),
      }
    : null;

  const [nextLevelRows] = await pool.execute(
    `SELECT id, level_number, level_name, xp_required, tier
     FROM levels
     WHERE xp_required > ?
     ORDER BY xp_required ASC, id ASC
     LIMIT 1`,
    [Math.max(0, totalXp)],
  );

  const nextLevel = nextLevelRows.length
    ? {
        id: Number(nextLevelRows[0].id),
        levelNumber: Number(nextLevelRows[0].level_number || 0),
        name: nextLevelRows[0].level_name || '',
        xpRequired: Number(nextLevelRows[0].xp_required || 0),
        tier: Number(nextLevelRows[0].tier || 0),
      }
    : null;

  const [
    [badgeRows],
    [achievementRows],
    [rewardRows],
  ] = await Promise.all([
    pool.execute(
      `SELECT COUNT(*) AS total
       FROM user_badges
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    pool.execute(
      `SELECT COUNT(*) AS total
       FROM user_achievements
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    pool.execute(
      `SELECT COUNT(*) AS total
       FROM user_rewards
       WHERE user_id = ? AND status = 'available'`,
      [normalizedUserId],
    ),
  ]);

  return {
    totalXp,
    currentLevel,
    nextLevel,
    unlockedBadges: Number(badgeRows[0]?.total || 0),
    unlockedAchievements: Number(achievementRows[0]?.total || 0),
    availableRewards: Number(rewardRows[0]?.total || 0),
  };
};

const getUserProgressionDetails = async (userId, options = {}) => {
  const normalizedUserId = Number(userId);
  const xpTransactionsLimit = Math.min(
    50,
    Math.max(5, Number(options?.xpTransactionsLimit || 20)),
  );

  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    return {
      snapshot: await getUserProgressionSnapshot(0),
      badges: [],
      achievements: [],
      rewards: [],
      xpTransactions: [],
      badgeTotals: { total: 0, unlocked: 0, hidden: 0, hiddenUnlocked: 0 },
      achievementTotals: { total: 0, unlocked: 0 },
      rewardTotals: { total: 0, available: 0, consumed: 0, expired: 0 },
    };
  }

  const snapshot = await getUserProgressionSnapshot(normalizedUserId);

  const [badgeRows] = await pool.execute(
    `SELECT
        b.id,
        b.name,
        b.slug,
        b.description,
        b.rarity,
        b.is_hidden,
        b.xp_reward,
        b.points_reward,
        bc.name AS category_name,
        ub.unlocked_at,
        ub.progress_value,
        ub.is_seen,
        ubp.current_value,
        ubp.target_value,
        ubp.percent_complete
     FROM badges b
     LEFT JOIN badge_categories bc ON bc.id = b.category_id
     LEFT JOIN user_badges ub
       ON ub.badge_id = b.id AND ub.user_id = ?
     LEFT JOIN user_badge_progress ubp
       ON ubp.badge_id = b.id AND ubp.user_id = ?
     WHERE b.active = TRUE
     ORDER BY b.is_hidden ASC, b.id ASC`,
    [normalizedUserId, normalizedUserId],
  );

  const badges = badgeRows.map((row) => {
    const isHidden = !!row.is_hidden;
    const unlocked = !!row.unlocked_at;
    const revealed = !isHidden || unlocked;
    const currentProgress = Number(
      row.current_value != null
        ? row.current_value
        : row.progress_value != null
          ? row.progress_value
          : 0,
    );
    const targetProgress = Number(row.target_value || 0);
    const percentProgress = Number(
      row.percent_complete != null
        ? row.percent_complete
        : unlocked
          ? 100
          : 0,
    );

    return {
      id: Number(row.id),
      slug: revealed ? (row.slug || '') : null,
      category: row.category_name || null,
      name: revealed ? (row.name || 'Badge') : 'Hidden Badge',
      description: revealed ? (row.description || '') : 'Unlock this badge to reveal details.',
      rarity: row.rarity || 'common',
      isHidden,
      revealed,
      unlocked,
      unlockedAt: row.unlocked_at || null,
      isSeen: unlocked ? !!row.is_seen : false,
      xpReward: revealed ? Number(row.xp_reward || 0) : null,
      pointsReward: revealed ? Number(row.points_reward || 0) : null,
      progress: {
        current: Math.max(0, currentProgress),
        target: Math.max(0, targetProgress),
        percent: Math.max(0, Math.min(100, percentProgress)),
      },
    };
  });

  const [achievementRows] = await pool.execute(
    `SELECT
        a.id,
        a.name,
        a.slug,
        a.description,
        a.xp_reward,
        a.reward_id,
        ua.unlocked_at
     FROM achievements a
     LEFT JOIN user_achievements ua
       ON ua.achievement_id = a.id AND ua.user_id = ?
     ORDER BY a.id ASC`,
    [normalizedUserId],
  );

  const achievements = achievementRows.map((row) => ({
    id: Number(row.id),
    name: row.name || 'Achievement',
    slug: row.slug || '',
    description: row.description || '',
    xpReward: Number(row.xp_reward || 0),
    rewardId: row.reward_id == null ? null : Number(row.reward_id),
    unlocked: !!row.unlocked_at,
    unlockedAt: row.unlocked_at || null,
  }));

  const [rewardRows] = await pool.execute(
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
        r.value_json
     FROM user_rewards ur
     JOIN rewards r ON r.id = ur.reward_id
     WHERE ur.user_id = ?
     ORDER BY FIELD(ur.status, 'available', 'consumed', 'expired'), ur.granted_at DESC, ur.id DESC
     LIMIT 200`,
    [normalizedUserId],
  );

  const rewards = rewardRows.map((row) => {
    let value = row.value_json;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = null;
      }
    }
    return {
      userRewardId: Number(row.user_reward_id),
      id: Number(row.reward_id),
      name: row.name || 'Reward',
      rewardType: row.reward_type || 'cosmetic',
      description: row.description || null,
      valueJson: value ?? null,
      sourceType: row.source_type || 'manual',
      sourceId: row.source_id == null ? null : Number(row.source_id),
      status: row.status || 'available',
      grantedAt: row.granted_at || null,
      consumedAt: row.consumed_at || null,
    };
  });

  const [xpRows] = await pool.execute(
    `SELECT
        id,
        source_type,
        source_id,
        xp_amount,
        description,
        created_at
     FROM xp_transactions
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [normalizedUserId, xpTransactionsLimit],
  );

  const xpTransactions = xpRows.map((row) => ({
    id: Number(row.id),
    sourceType: row.source_type || '',
    sourceId: row.source_id == null ? null : Number(row.source_id),
    xpAmount: Number(row.xp_amount || 0),
    description: row.description || null,
    createdAt: row.created_at || null,
  }));

  const badgeTotals = {
    total: badges.length,
    unlocked: badges.filter((badge) => badge.unlocked).length,
    hidden: badges.filter((badge) => badge.isHidden).length,
    hiddenUnlocked: badges.filter((badge) => badge.isHidden && badge.unlocked).length,
  };

  const achievementTotals = {
    total: achievements.length,
    unlocked: achievements.filter((achievement) => achievement.unlocked).length,
  };

  const rewardTotals = {
    total: rewards.length,
    available: rewards.filter((reward) => reward.status === 'available').length,
    consumed: rewards.filter((reward) => reward.status === 'consumed').length,
    expired: rewards.filter((reward) => reward.status === 'expired').length,
  };

  return {
    snapshot,
    badges,
    achievements,
    rewards,
    xpTransactions,
    badgeTotals,
    achievementTotals,
    rewardTotals,
  };
};

const WEEKDAY_BY_DAYS_PER_WEEK = {
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  7: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
};

const PROGRAM_DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const PROGRAM_DAY_SET = new Set(PROGRAM_DAY_ORDER);

const normalizeProgramDayName = (raw) => {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  if (PROGRAM_DAY_SET.has(key)) return key;
  if (key.startsWith('mon')) return 'monday';
  if (key.startsWith('tue')) return 'tuesday';
  if (key.startsWith('wed')) return 'wednesday';
  if (key.startsWith('thu')) return 'thursday';
  if (key.startsWith('fri')) return 'friday';
  if (key.startsWith('sat')) return 'saturday';
  if (key.startsWith('sun')) return 'sunday';
  return null;
};

const normalizeProgramWorkouts = (workouts, daysPerWeek = 4) => {
  const list = Array.isArray(workouts) ? workouts : [];
  if (!list.length) return [];

  const normalizedDaysPerWeek = clampWorkoutDays(daysPerWeek, 4);
  const weekdays = WEEKDAY_BY_DAYS_PER_WEEK[normalizedDaysPerWeek] || WEEKDAY_BY_DAYS_PER_WEEK[4];

  return list.map((workout, index) => {
    const order = Number(workout.day_order || index + 1);
    const withinWeekIndex = ((order - 1) % weekdays.length + weekdays.length) % weekdays.length;
    const fallbackDayName = weekdays[withinWeekIndex];
    const rawDayName = String(workout.day_name || '').toLowerCase().trim();
    const dayName = rawDayName || fallbackDayName;

    return {
      ...workout,
      day_order: order,
      day_name: dayName,
    };
  });
};

const getTodayWorkoutContextForUser = async (conn, userId) => {
  const normalizedUserId = toNumber(userId, 0);
  if (!normalizedUserId) return null;

  const [assignmentRows] = await conn.execute(
    `SELECT pa.id, pa.program_id, pa.start_date, p.days_per_week, p.cycle_weeks
     FROM program_assignments pa
     JOIN programs p ON p.id = pa.program_id
     WHERE pa.user_id = ? AND pa.status = 'active'
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [normalizedUserId],
  );

  const assignment = assignmentRows[0] || null;
  if (!assignment) return null;

  const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
  const workoutsPerWeek = Math.max(1, Number(assignment.days_per_week || 1));
  const currentWeekStartDayOrder = ((currentWeek - 1) * workoutsPerWeek) + 1;
  const currentWeekEndDayOrder = currentWeekStartDayOrder + workoutsPerWeek - 1;

  const [workoutRows] = await conn.execute(
    `SELECT id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes
     FROM workouts
     WHERE program_id = ? AND day_order BETWEEN ? AND ?
     ORDER BY day_order ASC`,
    [assignment.program_id, currentWeekStartDayOrder, currentWeekEndDayOrder],
  );

  const currentWeekWorkouts = normalizeProgramWorkouts(workoutRows, assignment.days_per_week);
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayWorkout = currentWeekWorkouts.find((workout) => workout.day_name === dayName) || null;

  return {
    assignment,
    currentWeek,
    dayName,
    todayWorkout,
    currentWeekWorkouts,
  };
};

const safeParseJson = (rawValue, fallback) => {
  if (rawValue == null) return fallback;
  if (typeof rawValue === 'object') return rawValue;
  if (typeof rawValue !== 'string') return fallback;
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
};

const buildCustomProgramDraft = async (conn, userId, rawPayload = {}) => {
  const [userRows] = await conn.execute(
    `SELECT id, gym_id, coach_id, name, fitness_goal, experience_level
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );
  if (!userRows.length) {
    throw new Error('User not found');
  }

  const cycleWeeks = Math.round(Number(rawPayload.cycleWeeks || 0));
  const weekPlansRaw = Array.isArray(rawPayload.weekPlans) ? rawPayload.weekPlans : [];
  if (!Number.isFinite(cycleWeeks) || cycleWeeks < 6 || cycleWeeks > 16) {
    throw new Error('cycleWeeks must be between 6 and 16');
  }

  const selectedDaysRaw = Array.isArray(rawPayload.selectedDays)
    ? rawPayload.selectedDays
    : Array.isArray(rawPayload.days)
      ? rawPayload.days
      : [];

  const selectedDays = [
    ...new Set(
      selectedDaysRaw
        .map((day) => normalizeProgramDayName(day))
        .filter(Boolean),
    ),
  ];
  if (!selectedDays.length) {
    throw new Error('At least one valid training day is required');
  }

  if (weekPlansRaw.length > 0) {
    const normalizedWeekCount = Math.max(1, Math.min(2, cycleWeeks));
    const normalizedWeekPlans = weekPlansRaw.slice(0, normalizedWeekCount).map((week, index) => {
      const weeklyWorkouts = Array.isArray(week?.weeklyWorkouts)
        ? week.weeklyWorkouts
        : Array.isArray(week?.workouts)
          ? week.workouts
          : [];
      return {
        weekNumber: Math.max(1, Math.min(2, Number(week?.weekNumber || index + 1))),
        weeklyWorkouts,
      };
    });
    const firstWeekWorkouts = Array.isArray(normalizedWeekPlans[0]?.weeklyWorkouts)
      ? normalizedWeekPlans[0].weeklyWorkouts
      : [];
    if (!firstWeekWorkouts.length) {
      throw new Error('Week 1 workout plan is required');
    }
    if (normalizedWeekPlans.length > 1) {
      const secondWeekWorkouts = Array.isArray(normalizedWeekPlans[1]?.weeklyWorkouts)
        ? normalizedWeekPlans[1].weeklyWorkouts
        : [];
      if (!secondWeekWorkouts.length) {
        throw new Error('Week 2 workout plan is required');
      }
    }
    const planNameInput = String(rawPayload.planName || rawPayload.name || '').trim();
    const planName = planNameInput || `Custom ${cycleWeeks}-Week Plan`;
    const description = String(rawPayload.description || '').trim() || `User-customized ${cycleWeeks}-week plan`;

    return {
      user: userRows[0],
      goal: normalizeGoalEnum(userRows[0].fitness_goal),
      experienceLevel: normalizeExperienceEnum(userRows[0].experience_level) || 'intermediate',
      planName,
      description,
      cycleWeeks,
      selectedDays,
      weekPlans: normalizedWeekPlans,
      weeklyWorkouts: firstWeekWorkouts,
    };
  }

  const weeklyWorkoutsRaw = Array.isArray(rawPayload.weeklyWorkouts)
    ? rawPayload.weeklyWorkouts
    : Array.isArray(rawPayload.workouts)
      ? rawPayload.workouts
      : [];
  const workoutTemplateByDay = new Map();
  weeklyWorkoutsRaw.forEach((workout) => {
    const dayName = normalizeProgramDayName(workout?.dayName || workout?.day || workout?.weekday);
    if (!dayName || !selectedDays.includes(dayName)) return;
    workoutTemplateByDay.set(dayName, workout);
  });

  const templatesByDay = new Map();
  const catalogIds = [];

  for (const dayName of selectedDays) {
    const template = workoutTemplateByDay.get(dayName);
    if (!template) {
      throw new Error(`Missing workout template for ${dayName}`);
    }
    const durationRaw = Number(
      template?.estimatedDurationMinutes
      ?? template?.estimated_duration_minutes
      ?? template?.durationMinutes
      ?? 0,
    );
    const estimatedDurationMinutes = Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.max(20, Math.min(180, Math.round(durationRaw)))
      : null;

    const rawExercises = Array.isArray(template.exercises) ? template.exercises : [];
    if (!rawExercises.length) {
      throw new Error(`At least one exercise is required for ${dayName}`);
    }

    const normalizedExercises = [];
    for (let index = 0; index < rawExercises.length; index += 1) {
      const exercise = rawExercises[index];
      const sets = Math.round(Number(exercise?.sets || 0));
      if (!Number.isFinite(sets) || sets < 1 || sets > 10) {
        throw new Error(`Invalid sets on ${dayName} exercise #${index + 1}. Allowed: 1..10.`);
      }

      const reps = String(exercise?.reps || '').trim() || '8-12';
      if (reps.length > 20) {
        throw new Error(`Reps is too long on ${dayName} exercise #${index + 1}.`);
      }

      const restSecondsRaw = Number(exercise?.restSeconds ?? exercise?.rest ?? 90);
      const restSeconds = Number.isFinite(restSecondsRaw)
        ? Math.max(30, Math.min(600, Math.round(restSecondsRaw)))
        : 90;
      const targetWeightRaw = Number(exercise?.targetWeight ?? exercise?.weightKg ?? exercise?.weight ?? 0);
      const targetWeight = Number.isFinite(targetWeightRaw) && targetWeightRaw > 0
        ? Math.max(0, Math.min(1000, Number(targetWeightRaw.toFixed(2))))
        : null;
      const tempoRaw = String(exercise?.tempo || '').trim();
      const tempo = tempoRaw ? tempoRaw.slice(0, 20) : null;
      const rpeTargetRaw = Number(exercise?.rpeTarget ?? exercise?.rpe ?? 0);
      const rpeTarget = Number.isFinite(rpeTargetRaw)
        ? Number(Math.max(5.5, Math.min(10, rpeTargetRaw)).toFixed(1))
        : null;
      const targetMuscles = normalizeRecoveryMuscleTargets(
        exercise?.targetMuscles
        ?? exercise?.muscleTargets
        ?? exercise?.primaryMuscles
        ?? exercise?.muscles
        ?? exercise?.muscleGroup,
        3,
      );

      const exerciseCatalogId = Number(exercise?.exerciseCatalogId || 0) || null;
      const inputName = String(exercise?.exerciseName || exercise?.name || '').trim();
      if (!exerciseCatalogId && !inputName) {
        throw new Error(`Exercise name is required on ${dayName} exercise #${index + 1}.`);
      }
      if (exerciseCatalogId) catalogIds.push(exerciseCatalogId);

      normalizedExercises.push({
        orderIndex: index + 1,
        exerciseCatalogId,
        inputName,
        sets,
        reps,
        restSeconds,
        targetWeight,
        tempo,
        rpeTarget,
        targetMuscles,
        notes: exercise?.notes ? String(exercise.notes).trim() : null,
      });
    }

    templatesByDay.set(dayName, {
      workoutName: String(template?.workoutName || template?.name || dayName).trim() || dayName,
      workoutType: template?.workoutType ? String(template.workoutType).trim() : null,
      estimatedDurationMinutes,
      notes: template?.notes ? String(template.notes).trim() : null,
      exercises: normalizedExercises,
    });
  }

  const catalogById = new Map();
  const uniqueCatalogIds = [...new Set(catalogIds)].filter((id) => Number.isFinite(id) && id > 0);
  if (uniqueCatalogIds.length) {
    const placeholders = uniqueCatalogIds.map(() => '?').join(', ');
    const [catalogRows] = await conn.execute(
      `SELECT id, canonical_name, body_part
       FROM exercise_catalog
       WHERE id IN (${placeholders}) AND is_active = 1`,
      uniqueCatalogIds,
    );
    catalogRows.forEach((row) => {
      catalogById.set(Number(row.id), {
        name: String(row.canonical_name || '').trim(),
        bodyPart: row.body_part ? String(row.body_part).trim() : null,
      });
    });
  }

  for (const dayName of selectedDays) {
    const dayTemplate = templatesByDay.get(dayName);
    for (const exercise of dayTemplate.exercises) {
      if (exercise.exerciseCatalogId && !catalogById.has(Number(exercise.exerciseCatalogId))) {
        throw new Error(`Exercise catalog id ${exercise.exerciseCatalogId} for ${dayName} is invalid or inactive`);
      }
    }
  }

  const user = userRows[0];
  const goal = normalizeGoalEnum(user.fitness_goal);
  const experienceLevel = normalizeExperienceEnum(user.experience_level) || 'intermediate';
  const planNameInput = String(rawPayload.planName || rawPayload.name || '').trim();
  const planName = planNameInput || `Custom ${cycleWeeks}-Week Plan`;
  const description = String(rawPayload.description || '').trim() || `User-customized ${cycleWeeks}-week plan`;
  const weeklyWorkouts = selectedDays.map((dayName) => {
    const dayTemplate = templatesByDay.get(dayName);
    return {
      dayName,
      workoutName: dayTemplate.workoutName,
      workoutType: dayTemplate.workoutType || 'Custom',
      estimatedDurationMinutes: dayTemplate.estimatedDurationMinutes || null,
      notes: dayTemplate.notes || null,
      exercises: dayTemplate.exercises.map((exercise) => ({
        exerciseCatalogId: exercise.exerciseCatalogId || null,
        exerciseName: exercise.inputName || null,
        muscleGroup: exercise.targetMuscles?.[0] || null,
        targetMuscles: Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles : [],
        sets: exercise.sets,
        reps: exercise.reps,
        targetWeight: exercise.targetWeight ?? null,
        restSeconds: exercise.restSeconds,
        tempo: exercise.tempo || null,
        rpeTarget: exercise.rpeTarget ?? null,
        notes: exercise.notes || null,
      })),
    };
  });

  return {
    user,
    goal,
    experienceLevel,
    planName,
    description,
    cycleWeeks,
    selectedDays,
    templatesByDay,
    catalogById,
    weeklyWorkouts,
  };
};

const persistCustomProgramDraft = async (
  conn,
  {
    userId,
    draft,
    assignmentReason = 'user_request',
    assignmentNote = null,
    assignmentSource = 'manual',
    actorUserId = userId,
  },
) => {
  const [programInsert] = await conn.execute(
    `INSERT INTO programs
      (gym_id, created_by_user_id, target_user_id, name, description, program_type, goal, experience_level, days_per_week, cycle_weeks, is_template, is_active)
     VALUES (?, ?, ?, ?, ?, 'custom', ?, ?, ?, ?, 0, 1)`,
    [
      draft.user.gym_id || null,
      actorUserId,
      userId,
      draft.planName.slice(0, 255),
      draft.description,
      draft.goal,
      draft.experienceLevel,
      draft.selectedDays.length,
      draft.cycleWeeks,
    ],
  );
  const programId = Number(programInsert.insertId);

  const usingWeekPlans = Array.isArray(draft.weekPlans) && draft.weekPlans.length > 0;
  if (usingWeekPlans) {
    const buildWeekTemplatesByDay = (weeklyWorkouts) => {
      const templatesByDay = new Map();
      const catalogIds = [];

      weeklyWorkouts.forEach((workout) => {
        const dayName = normalizeProgramDayName(workout?.dayName || workout?.day || workout?.weekday);
        if (!dayName) return;

        const durationRaw = Number(
          workout?.estimatedDurationMinutes
          ?? workout?.estimated_duration_minutes
          ?? workout?.durationMinutes
          ?? 0,
        );
        const estimatedDurationMinutes = Number.isFinite(durationRaw) && durationRaw > 0
          ? Math.max(20, Math.min(180, Math.round(durationRaw)))
          : null;

        const rawExercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
        if (!rawExercises.length) {
          throw new Error(`At least one exercise is required for ${dayName}`);
        }

        const normalizedExercises = [];
        for (let index = 0; index < rawExercises.length; index += 1) {
          const exercise = rawExercises[index];
          const sets = Math.round(Number(exercise?.sets || 0));
          if (!Number.isFinite(sets) || sets < 1 || sets > 10) {
            throw new Error(`Invalid sets on ${dayName} exercise #${index + 1}. Allowed: 1..10.`);
          }

          const reps = String(exercise?.reps || '').trim() || '8-12';
          if (reps.length > 20) {
            throw new Error(`Reps is too long on ${dayName} exercise #${index + 1}.`);
          }

          const restSecondsRaw = Number(exercise?.restSeconds ?? exercise?.rest ?? 90);
          const restSeconds = Number.isFinite(restSecondsRaw)
            ? Math.max(30, Math.min(600, Math.round(restSecondsRaw)))
            : 90;
          const targetWeightRaw = Number(exercise?.targetWeight ?? exercise?.weightKg ?? exercise?.weight ?? 0);
          const targetWeight = Number.isFinite(targetWeightRaw) && targetWeightRaw > 0
            ? Math.max(0, Math.min(1000, Number(targetWeightRaw.toFixed(2))))
            : null;
          const tempoRaw = String(exercise?.tempo || '').trim();
          const tempo = tempoRaw ? tempoRaw.slice(0, 20) : null;
          const rpeTargetRaw = Number(exercise?.rpeTarget ?? exercise?.rpe ?? 0);
          const rpeTarget = Number.isFinite(rpeTargetRaw)
            ? Number(Math.max(5.5, Math.min(10, rpeTargetRaw)).toFixed(1))
            : null;
          const targetMuscles = normalizeRecoveryMuscleTargets(
            exercise?.targetMuscles
            ?? exercise?.muscleTargets
            ?? exercise?.primaryMuscles
            ?? exercise?.muscles
            ?? exercise?.muscleGroup,
            3,
          );

          const exerciseCatalogId = Number(exercise?.exerciseCatalogId || 0) || null;
          const inputName = String(exercise?.exerciseName || exercise?.name || '').trim();
          if (!exerciseCatalogId && !inputName) {
            throw new Error(`Exercise name is required on ${dayName} exercise #${index + 1}.`);
          }
          if (exerciseCatalogId) catalogIds.push(exerciseCatalogId);

          normalizedExercises.push({
            orderIndex: index + 1,
            exerciseCatalogId,
            inputName,
            sets,
            reps,
            restSeconds,
            targetWeight,
            tempo,
            rpeTarget,
            targetMuscles,
            notes: exercise?.notes ? String(exercise.notes).trim() : null,
          });
        }

        templatesByDay.set(dayName, {
          workoutName: String(workout?.workoutName || workout?.name || dayName).trim() || dayName,
          workoutType: workout?.workoutType ? String(workout.workoutType).trim() : null,
          estimatedDurationMinutes,
          notes: workout?.notes ? String(workout.notes).trim() : null,
          exercises: normalizedExercises,
        });
      });

      for (const dayName of draft.selectedDays) {
        if (!templatesByDay.has(dayName)) {
          throw new Error(`Missing workout template for ${dayName}`);
        }
      }

      return { templatesByDay, catalogIds };
    };

    const sourceWeekPlans = Array.isArray(draft.weekPlans) && draft.weekPlans.length > 0
      ? draft.weekPlans
      : [{ weeklyWorkouts: draft.weeklyWorkouts || [] }];
    const weekTemplates = Array.from({ length: draft.cycleWeeks }, (_unused, index) => {
      const sourceWeek = sourceWeekPlans[index % sourceWeekPlans.length] || sourceWeekPlans[sourceWeekPlans.length - 1] || {};
      return {
        weekNumber: index + 1,
        ...buildWeekTemplatesByDay(Array.isArray(sourceWeek?.weeklyWorkouts) ? sourceWeek.weeklyWorkouts : []),
      };
    });

    const uniqueCatalogIds = [...new Set(weekTemplates.flatMap((week) => week.catalogIds))]
      .filter((id) => Number.isFinite(id) && id > 0);
    const catalogById = new Map();
    if (uniqueCatalogIds.length) {
      const placeholders = uniqueCatalogIds.map(() => '?').join(', ');
      const [catalogRows] = await conn.execute(
        `SELECT id, canonical_name, body_part
         FROM exercise_catalog
         WHERE id IN (${placeholders}) AND is_active = 1`,
        uniqueCatalogIds,
      );
      catalogRows.forEach((row) => {
        catalogById.set(Number(row.id), {
          name: String(row.canonical_name || '').trim(),
          bodyPart: row.body_part ? String(row.body_part).trim() : null,
        });
      });
    }

    for (const week of weekTemplates) {
      for (const dayName of draft.selectedDays) {
        const dayTemplate = week.templatesByDay.get(dayName);
        for (const exercise of dayTemplate.exercises) {
          if (exercise.exerciseCatalogId && !catalogById.has(Number(exercise.exerciseCatalogId))) {
            throw new Error(`Exercise catalog id ${exercise.exerciseCatalogId} for ${dayName} is invalid or inactive`);
          }
        }
      }
    }

    let dayOrder = 0;
    for (const week of weekTemplates) {
      for (const dayName of draft.selectedDays) {
        const dayTemplate = week.templatesByDay.get(dayName);
        dayOrder += 1;

        const workoutDisplayName = String(dayTemplate.workoutName || dayName).trim();
        const workoutName = `Week ${week.weekNumber} - ${workoutDisplayName}`;
        const estimatedDurationMinutes = Number.isFinite(Number(dayTemplate.estimatedDurationMinutes || 0))
          && Number(dayTemplate.estimatedDurationMinutes || 0) > 0
          ? Math.max(20, Math.min(180, Math.round(Number(dayTemplate.estimatedDurationMinutes))))
          : Math.max(
            25,
            Math.min(180, Math.round((dayTemplate.exercises.length * 11) + 18)),
          );

        const [workoutInsert] = await conn.execute(
          `INSERT INTO workouts
            (program_id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            programId,
            workoutName.slice(0, 255),
            String(dayTemplate.workoutType || 'Custom').slice(0, 100),
            dayOrder,
            dayName,
            estimatedDurationMinutes,
            dayTemplate.notes,
          ],
        );
        const workoutId = Number(workoutInsert.insertId);

        for (const exercise of dayTemplate.exercises) {
          const catalogMatch = exercise.exerciseCatalogId
            ? catalogById.get(Number(exercise.exerciseCatalogId))
            : null;
          const exerciseName = (catalogMatch?.name || exercise.inputName).slice(0, 255);
          const muscleGroupSnapshot = buildMuscleGroupSnapshot({
            catalogBodyPart: catalogMatch?.bodyPart || null,
            targetMuscles: exercise.targetMuscles,
          });
          const muscleGroupSnapshotValue = muscleGroupSnapshot ? muscleGroupSnapshot.slice(0, 255) : null;

          await conn.execute(
            `INSERT INTO workout_exercises
              (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes)
             VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              workoutId,
              exercise.orderIndex,
              exerciseName,
              muscleGroupSnapshotValue,
              exercise.sets,
              exercise.reps,
              exercise.targetWeight,
              exercise.restSeconds,
              exercise.tempo,
              exercise.rpeTarget,
              exercise.notes,
            ],
          );
        }
      }
    }

    const assignment = await assignProgramToUser(conn, {
      userId,
      programId,
      reason: assignmentReason,
      note: assignmentNote || `User custom plan: ${draft.cycleWeeks} weeks, ${draft.selectedDays.length} days/week`,
      assignmentSource,
    });

    return {
      programId,
      assignment,
      assignedProgram: {
        id: programId,
        name: draft.planName,
        programType: 'custom',
        goal: draft.goal,
        daysPerWeek: draft.selectedDays.length,
        cycleWeeks: draft.cycleWeeks,
      },
    };
  }

  let dayOrder = 0;
  for (let week = 1; week <= draft.cycleWeeks; week += 1) {
    for (const dayName of draft.selectedDays) {
      const dayTemplate = draft.templatesByDay.get(dayName);
      dayOrder += 1;

      const workoutDisplayName = String(dayTemplate.workoutName || dayName).trim();
      const workoutName = `Week ${week} - ${workoutDisplayName}`;
      const estimatedDurationMinutes = Number.isFinite(Number(dayTemplate.estimatedDurationMinutes || 0))
        && Number(dayTemplate.estimatedDurationMinutes || 0) > 0
        ? Math.max(20, Math.min(180, Math.round(Number(dayTemplate.estimatedDurationMinutes))))
        : Math.max(
          25,
          Math.min(180, Math.round((dayTemplate.exercises.length * 11) + 18)),
        );

      const [workoutInsert] = await conn.execute(
        `INSERT INTO workouts
          (program_id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          programId,
          workoutName.slice(0, 255),
          String(dayTemplate.workoutType || 'Custom').slice(0, 100),
          dayOrder,
          dayName,
          estimatedDurationMinutes,
          dayTemplate.notes,
        ],
      );
      const workoutId = Number(workoutInsert.insertId);

      for (const exercise of dayTemplate.exercises) {
        const catalogMatch = exercise.exerciseCatalogId
          ? draft.catalogById.get(Number(exercise.exerciseCatalogId))
          : null;
        const exerciseName = (catalogMatch?.name || exercise.inputName).slice(0, 255);
        const muscleGroupSnapshot = buildMuscleGroupSnapshot({
          catalogBodyPart: catalogMatch?.bodyPart || null,
          targetMuscles: exercise.targetMuscles,
        });
        const muscleGroupSnapshotValue = muscleGroupSnapshot ? muscleGroupSnapshot.slice(0, 255) : null;

        await conn.execute(
          `INSERT INTO workout_exercises
            (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise.orderIndex,
            exerciseName,
            muscleGroupSnapshotValue,
            exercise.sets,
            exercise.reps,
            exercise.targetWeight,
            exercise.restSeconds,
            exercise.tempo,
            exercise.rpeTarget,
            exercise.notes,
          ],
        );
      }
    }
  }

  const assignment = await assignProgramToUser(conn, {
    userId,
    programId,
    reason: assignmentReason,
    note: assignmentNote || `User custom plan: ${draft.cycleWeeks} weeks, ${draft.selectedDays.length} days/week`,
    assignmentSource,
  });

  return {
    programId,
    assignment,
    assignedProgram: {
      id: programId,
      name: draft.planName,
      programType: 'custom',
      goal: draft.goal,
      daysPerWeek: draft.selectedDays.length,
      cycleWeeks: draft.cycleWeeks,
    },
  };
};

const normalizeProgramChangeReasonForStorage = (reason) => {
  const normalized = String(reason || '').trim().toLowerCase();
  if (normalized === 'injury_adjustment') {
    return normalized;
  }
  return 'user_request';
};

const buildProgramChangeLogNote = (note, reason) => {
  const originalReason = String(reason || '').trim().toLowerCase();
  const storedReason = normalizeProgramChangeReasonForStorage(originalReason);
  const baseNote = note == null ? null : String(note);

  if (!originalReason || originalReason === storedReason) {
    return baseNote;
  }

  if (!baseNote) {
    return `source_reason=${originalReason}`;
  }

  return `${baseNote} [source_reason=${originalReason}]`;
};

const assignProgramToUser = async (
  conn,
  {
    userId,
    programId,
    reason = 'user_request',
    note = null,
    assignmentSource = 'ai',
  },
) => {
  const rotationWeeks = 8;
  const storedReason = normalizeProgramChangeReasonForStorage(reason);
  const changeLogNote = buildProgramChangeLogNote(note, reason);
  const startDate = new Date();
  const nextRotationDate = new Date(startDate);
  nextRotationDate.setDate(nextRotationDate.getDate() + rotationWeeks * 7);

  const startDateStr = formatDateISO(startDate);
  const nextRotationDateStr = formatDateISO(nextRotationDate);

  const [activeRows] = await conn.execute(
    `SELECT id, program_id
     FROM program_assignments
     WHERE user_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );

  const active = activeRows[0];
  if (active && Number(active.program_id) === Number(programId)) {
    await conn.execute(
      `UPDATE program_assignments
       SET start_date = ?, next_rotation_date = ?, rotation_weeks = ?, auto_rotate_enabled = 1,
           coach_override_allowed = 1, status = 'active', end_date = NULL, notes = ?
       WHERE id = ?`,
      [startDateStr, nextRotationDateStr, rotationWeeks, note, active.id],
    );
    return { assignmentId: active.id, replacedProgramId: null };
  }

  if (active) {
    await conn.execute(
      `UPDATE program_assignments
       SET status = 'archived', end_date = CURDATE()
       WHERE id = ?`,
      [active.id],
    );
  }

  const [insertResult] = await conn.execute(
    `INSERT INTO program_assignments
      (user_id, program_id, assigned_by_user_id, assignment_source, rotation_weeks, auto_rotate_enabled, coach_override_allowed, start_date, next_rotation_date, status, notes)
     VALUES (?, ?, NULL, ?, ?, 1, 1, ?, ?, 'active', ?)`,
    [
      userId,
      programId,
      normalizeAssignmentSource(assignmentSource),
      rotationWeeks,
      startDateStr,
      nextRotationDateStr,
      note,
    ],
  );

  if (active) {
    await conn.execute(
      `INSERT INTO program_change_log
        (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      [insertResult.insertId, userId, active.program_id, programId, storedReason, changeLogNote],
    );
  }

  return {
    assignmentId: insertResult.insertId,
    replacedProgramId: active ? active.program_id : null,
  };
};

const findTemplateProgramBySplit = async (conn, splitPreference) => {
  const normalized = normalizeSplitPreference(splitPreference);
  const candidates = [];

  if (normalized === 'full_body') {
    candidates.push({ sql: `program_type = 'full_body'` });
  } else if (normalized === 'upper_lower') {
    candidates.push({ sql: `program_type = 'upper_lower'` });
  } else if (normalized === 'push_pull_legs') {
    candidates.push({ sql: `program_type = 'push_pull_legs'` });
    candidates.push({ sql: `program_type = 'custom' AND LOWER(name) LIKE '%body part split%'` });
    candidates.push({ sql: `program_type = 'custom' AND LOWER(name) LIKE '%push%' AND LOWER(name) LIKE '%pull%'` });
  } else if (normalized === 'custom' || normalized === 'hybrid') {
    candidates.push({ sql: `program_type = 'custom'` });
  } else {
    return null;
  }

  for (const candidate of candidates) {
    const [rows] = await conn.execute(
      `SELECT id, gym_id, created_by_user_id, name, description, program_type, goal, experience_level, days_per_week, cycle_weeks
       FROM programs
       WHERE is_template = 1 AND is_active = 1 AND ${candidate.sql}
       ORDER BY id DESC
       LIMIT 1`,
    );
    if (rows.length) {
      return rows[0];
    }
  }

  return null;
};

const buildTemplateExerciseAnchorsForSplit = async (
  conn,
  {
    splitPreference,
    daysPerWeek = 4,
  } = {},
) => {
  const templateProgram = await findTemplateProgramBySplit(conn, splitPreference);
  if (!templateProgram) return [];

  const normalizedDays = Math.max(2, Math.min(6, Number(daysPerWeek || 4)));
  const [rows] = await conn.execute(
    `SELECT
        w.id AS workout_id,
        w.workout_name,
        w.workout_type,
        w.day_order,
        w.day_name,
        we.order_index,
        we.exercise_name_snapshot,
        we.muscle_group_snapshot,
        we.target_sets,
        we.target_reps,
        we.target_weight,
        we.rest_seconds,
        we.tempo,
        we.rpe_target
      FROM workouts w
      LEFT JOIN workout_exercises we ON we.workout_id = w.id
      WHERE w.program_id = ?
      ORDER BY w.day_order ASC, w.id ASC, we.order_index ASC, we.id ASC`,
    [templateProgram.id],
  );

  const byWorkout = new Map();
  rows.forEach((row) => {
    const workoutId = Number(row.workout_id || 0);
    if (!workoutId) return;

    if (!byWorkout.has(workoutId)) {
      byWorkout.set(workoutId, {
        workoutId,
        workoutName: String(row.workout_name || '').trim() || String(row.day_name || 'Workout').trim() || 'Workout',
        workoutType: String(row.workout_type || '').trim() || null,
        dayOrder: Number(row.day_order || 0),
        exercises: [],
      });
    }

    const exerciseName = String(row.exercise_name_snapshot || '').trim();
    if (!exerciseName) return;

    const day = byWorkout.get(workoutId);
    day.exercises.push({
      name: exerciseName,
      targetMuscles: normalizeRecoveryMuscleTargets(row.muscle_group_snapshot, 3),
      sets: Number.isFinite(Number(row.target_sets)) ? Number(row.target_sets) : null,
      reps: row.target_reps ? String(row.target_reps).trim().slice(0, 20) : null,
      targetWeight: Number.isFinite(Number(row.target_weight)) ? Number(row.target_weight) : null,
      restSeconds: Number.isFinite(Number(row.rest_seconds)) ? Number(row.rest_seconds) : null,
      tempo: row.tempo ? String(row.tempo).trim().slice(0, 20) : null,
      rpeTarget: Number.isFinite(Number(row.rpe_target)) ? Number(row.rpe_target) : null,
    });
  });

  const workouts = [...byWorkout.values()]
    .map((workout) => ({
      workoutName: workout.workoutName,
      workoutType: workout.workoutType,
      exercises: workout.exercises.slice(0, 10),
      dayOrder: workout.dayOrder,
    }))
    .filter((workout) => workout.exercises.length > 0)
    .sort((a, b) => a.dayOrder - b.dayOrder);

  if (!workouts.length) return [];

  return workouts.slice(0, normalizedDays).map((workout) => ({
    workoutName: workout.workoutName,
    workoutType: workout.workoutType,
    exercises: workout.exercises,
  }));
};

const cloneTemplateProgramForUser = async (conn, userId, templateProgram) => {
  const templateName = String(templateProgram?.name || '').trim() || 'Template Program';
  const description = String(templateProgram?.description || '').trim();
  const createdAt = new Date().toISOString().slice(0, 10);
  const clonedName = `${templateName} (${createdAt})`;

  const [programInsert] = await conn.execute(
    `INSERT INTO programs
      (gym_id, created_by_user_id, target_user_id, name, description, program_type, goal, experience_level, days_per_week, cycle_weeks, is_template, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    [
      toNumber(templateProgram.gym_id, null),
      toNumber(templateProgram.created_by_user_id, null),
      userId,
      clonedName.slice(0, 255),
      (description ? `${description} (Assigned from template)` : 'Assigned from template').slice(0, 255),
      String(templateProgram.program_type || 'custom').slice(0, 100),
      normalizeGoalEnum(templateProgram.goal),
      normalizeExperienceEnum(templateProgram.experience_level) || 'intermediate',
      Math.max(2, Math.min(6, Number(templateProgram.days_per_week || 4))),
      Math.max(1, Math.min(16, Number(templateProgram.cycle_weeks || 8))),
    ],
  );
  const clonedProgramId = Number(programInsert.insertId || 0);
  if (!clonedProgramId) {
    throw new Error('Failed to clone template program');
  }

  const [templateWorkouts] = await conn.execute(
    `SELECT id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes
     FROM workouts
     WHERE program_id = ?
     ORDER BY day_order ASC, id ASC`,
    [templateProgram.id],
  );

  for (const workout of templateWorkouts) {
    const [workoutInsert] = await conn.execute(
      `INSERT INTO workouts
        (program_id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        clonedProgramId,
        String(workout.workout_name || '').slice(0, 255),
        String(workout.workout_type || '').slice(0, 100),
        Number(workout.day_order || 1),
        String(workout.day_name || '').slice(0, 32),
        Number.isFinite(Number(workout.estimated_duration_minutes))
          ? Number(workout.estimated_duration_minutes)
          : null,
        workout.notes ? String(workout.notes).slice(0, 255) : null,
      ],
    );

    const clonedWorkoutId = Number(workoutInsert.insertId || 0);
    const [exerciseRows] = await conn.execute(
      `SELECT exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps,
              target_weight, rest_seconds, tempo, rpe_target, notes
       FROM workout_exercises
       WHERE workout_id = ?
       ORDER BY order_index ASC, id ASC`,
      [workout.id],
    );

    for (const exercise of exerciseRows) {
      await conn.execute(
        `INSERT INTO workout_exercises
          (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clonedWorkoutId,
          exercise.exercise_id ?? null,
          Number(exercise.order_index || 1),
          exercise.exercise_name_snapshot ? String(exercise.exercise_name_snapshot).slice(0, 255) : null,
          exercise.muscle_group_snapshot ? String(exercise.muscle_group_snapshot).slice(0, 255) : null,
          Number.isFinite(Number(exercise.target_sets)) ? Number(exercise.target_sets) : null,
          exercise.target_reps ? String(exercise.target_reps).slice(0, 50) : null,
          Number.isFinite(Number(exercise.target_weight)) ? Number(exercise.target_weight) : null,
          Number.isFinite(Number(exercise.rest_seconds)) ? Number(exercise.rest_seconds) : null,
          exercise.tempo ? String(exercise.tempo).slice(0, 20) : null,
          Number.isFinite(Number(exercise.rpe_target)) ? Number(exercise.rpe_target) : null,
          exercise.notes ? String(exercise.notes).slice(0, 255) : null,
        ],
      );
    }
  }

  return {
    programId: clonedProgramId,
    name: clonedName,
    programType: String(templateProgram.program_type || 'custom'),
    goal: normalizeGoalEnum(templateProgram.goal),
    daysPerWeek: Math.max(2, Math.min(6, Number(templateProgram.days_per_week || 4))),
    cycleWeeks: Math.max(1, Math.min(16, Number(templateProgram.cycle_weeks || 8))),
  };
};

const assignTemplateProgramFromLibrary = async (
  conn,
  {
    userId,
    splitPreference,
    note = null,
  },
) => {
  const templateProgram = await findTemplateProgramBySplit(conn, splitPreference);
  if (!templateProgram) return null;

  const clonedProgram = await cloneTemplateProgramForUser(conn, userId, templateProgram);
  const assignment = await assignProgramToUser(conn, {
    userId,
    programId: clonedProgram.programId,
    reason: 'user_request',
    note: note || `Assigned from template library: ${normalizeSplitPreference(splitPreference)}`,
    assignmentSource: 'template',
  });

  return {
    assignment,
    assignedProgram: {
      id: clonedProgram.programId,
      name: clonedProgram.name,
      programType: clonedProgram.programType,
      goal: clonedProgram.goal,
      daysPerWeek: clonedProgram.daysPerWeek,
      cycleWeeks: clonedProgram.cycleWeeks,
      templateProgramId: Number(templateProgram.id || 0),
    },
  };
};

const buildCustomPlanAdvice = ({
  draft,
  normalizedGoal,
  normalizedExperience,
  normalizedDays,
  normalizedSessionDuration,
  language = 'en',
}) => {
  const isArabic = String(language || '').trim().toLowerCase() === 'ar';
  const selectedDays = Array.isArray(draft?.selectedDays) ? draft.selectedDays : [];
  const templatesByDay = draft?.templatesByDay instanceof Map ? draft.templatesByDay : new Map();

  let totalExercises = 0;
  selectedDays.forEach((dayName) => {
    const dayTemplate = templatesByDay.get(dayName);
    const dayExercises = Array.isArray(dayTemplate?.exercises) ? dayTemplate.exercises.length : 0;
    totalExercises += dayExercises;
  });

  const daysCount = selectedDays.length || 1;
  const avgExercisesPerDay = Number((totalExercises / daysCount).toFixed(1));
  const recommendations = [];
  const strengths = [];

  if (selectedDays.length >= normalizedDays) {
    strengths.push(
      isArabic
        ? 'عدد أيام تدريبك الأسبوعية يطابق الوقت المتاح لك أو يتجاوزه.'
        : 'Your weekly frequency matches or exceeds your availability target.',
    );
  } else {
    recommendations.push(
      isArabic
        ? 'فكّر في إضافة يوم تدريب إضافي ليتوافق البرنامج مع الوقت المتاح الذي حددته.'
        : 'Consider adding one more training day to match your stated availability.',
    );
  }

  if (avgExercisesPerDay < 4) {
    recommendations.push(
      isArabic
        ? 'أضف تمرينًا أو تمرينين أساسيين في كل جلسة لتحسين حجم التدريب الأسبوعي.'
        : 'Add 1-2 key movements per session to improve total weekly stimulus.',
    );
  } else if (avgExercisesPerDay > 8) {
    recommendations.push(
      isArabic
        ? 'جلساتك مزدحمة نسبيًا؛ قلّل التداخل بين التمارين للحفاظ على جودة الأداء والتعافي.'
        : 'Your sessions are dense; reduce overlap to keep recovery and effort quality high.',
    );
  } else {
    strengths.push(
      isArabic
        ? 'حجم التمارين في كل يوم يبدو متوازنًا ويدعم التقدم بشكل ثابت.'
        : 'Session volume per day looks balanced for steady progression.',
    );
  }

  if (normalizedSessionDuration < 50 && avgExercisesPerDay > 6) {
    recommendations.push(
      isArabic
        ? 'مدة الجلسة التي اخترتها قصيرة نسبيًا؛ قلّل عدد التمارين أو استخدم السوبر سِت.'
        : 'Your session length target is tight; trim exercise count or use supersets.',
    );
  }

  if (normalizedGoal === 'hypertrophy') {
    recommendations.push(
      isArabic
        ? 'حافظ على نطاق 8-15 تكرارًا في التمارين الأساسية وتابع زيادة الأوزان أسبوعيًا.'
        : 'Keep 8-15 rep work on core lifts and track weekly load increases.',
    );
  } else if (normalizedGoal === 'strength') {
    recommendations.push(
      isArabic
        ? 'ابدأ كل يوم بتمرين أساسي رئيسي ضمن تكرارات أقل بين 3 و6.'
        : 'Anchor each day with one primary lift in lower rep ranges (3-6 reps).',
    );
  } else if (normalizedGoal === 'fat_loss') {
    recommendations.push(
      isArabic
        ? 'حافظ على المقاومة التصاعدية واجعل فترات الراحة منضبطة لرفع كثافة الجلسة.'
        : 'Maintain progressive resistance and keep rest periods controlled for density.',
    );
  }

  if ((normalizedExperience || 'intermediate') !== 'advanced') {
    recommendations.push(
      isArabic
        ? 'اجعل جودة الأداء الفني أولوية قبل إضافة حجم أو تعقيد أكبر للخطة.'
        : 'Prioritize exercise technique quality before adding more volume or complexity.',
    );
  }

  return {
    summary: isArabic
      ? 'تم تفعيل خطتك المخصصة. راجع الذكاء الاصطناعي ملفك والجدول الذي اخترته، ثم أنشأ لك هذه النصائح.'
      : 'Your custom plan is active. AI reviewed your profile and selected schedule, then generated advice only.',
    strengths: strengths.slice(0, 3),
    recommendations: [...new Set(recommendations)].slice(0, 5),
    metrics: {
      trainingDays: selectedDays.length,
      totalExercises,
      avgExercisesPerDay,
    },
  };
};

const getCurrentWeek = (startDate, cycleWeeks) => {
  const start = new Date(startDate);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const rawWeek = Math.max(1, Math.floor((now - start) / msPerWeek) + 1);
  const maxWeeks = Math.max(1, Number(cycleWeeks || 1));
  return Math.min(rawWeek, maxWeeks);
};

const computeWorkoutStreak = (dateRows, missedDateRows = []) => {
  const dates = new Set(dateRows.map((r) => formatDateISO(r.workout_date)));
  const missedDates = new Set(missedDateRows.map((r) => formatDateISO(r.missed_date || r.workout_date)));
  if (!dates.size && !missedDates.size) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cursor = new Date(today);
  if (missedDates.has(formatDateISO(cursor))) {
    return 0;
  }

  if (!dates.has(formatDateISO(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (;;) {
    const dateKey = formatDateISO(cursor);
    if (missedDates.has(dateKey)) {
      return streak;
    }
    if (!dates.has(dateKey)) {
      return streak;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
};

const isMissedProgramDaysUnavailableError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const errno = Number(error?.errno || 0);
  const isSchemaError = code === 'ER_NO_SUCH_TABLE'
    || code === 'ER_BAD_FIELD_ERROR'
    || errno === 1146
    || errno === 1054;
  if (!isSchemaError) return false;

  const message = String(error?.sqlMessage || error?.message || '').toLowerCase();
  return message.includes('missed_program_days');
};

const isUsersGamificationColumnError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const errno = Number(error?.errno || 0);
  if (!(code === 'ER_BAD_FIELD_ERROR' || errno === 1054)) return false;

  const message = String(error?.sqlMessage || error?.message || '').toLowerCase();
  if (!message.includes('users')) return false;
  return message.includes('total_points')
    || message.includes('total_workouts')
    || message.includes('rank');
};

const getMissedProgramDayRows = async ({ userId, dateFrom = null, dateTo = null, limit = null } = {}) => {
  const normalizedUserId = toNumber(userId, 0);
  if (!normalizedUserId) return [];

  const where = ['user_id = ?'];
  const params = [normalizedUserId];

  if (dateFrom) {
    where.push('missed_date >= ?');
    params.push(String(dateFrom).slice(0, 10));
  }

  if (dateTo) {
    where.push('missed_date <= ?');
    params.push(String(dateTo).slice(0, 10));
  }

  let sql = `
    SELECT id, program_assignment_id, workout_id, missed_date, workout_name
    FROM missed_program_days
    WHERE ${where.join(' AND ')}
    ORDER BY missed_date DESC
  `;

  if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
    const normalizedLimit = Math.max(1, Math.min(365, Math.round(Number(limit))));
    sql += ` LIMIT ${normalizedLimit}`;
  }

  try {
    const [rows] = await pool.execute(sql, params);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (isMissedProgramDaysUnavailableError(error)) {
      return [];
    }
    throw error;
  }
};

const normalizeCatalogMuscleGroup = (raw) => {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return 'Other';
  if (/(chest|pector)/.test(key)) return 'Chest';
  if (/(back|lat|trap|rhomboid|erector)/.test(key)) return 'Back';
  if (/(quad|hamstring|glute|calf|leg)/.test(key)) return 'Legs';
  if (/(shoulder|delt)/.test(key)) return 'Shoulders';
  if (/(bicep|tricep|forearm|arm)/.test(key)) return 'Arms';
  if (/(abs|abdom|core|oblique)/.test(key)) return 'Abs';
  return 'Other';
};

// =========================
// AUTH
// =========================

router.post('/auth/login', authLoginRateLimit, async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let query = 'SELECT * FROM users WHERE email = ? LIMIT 1';
    const params = [String(email).trim().toLowerCase()];

    // Admin login accepts only coach / gym_owner.
    if (role === 'admin') {
      query = "SELECT * FROM users WHERE email = ? AND role IN ('coach','gym_owner') LIMIT 1";
    } else if (role === 'user') {
      // User login must never allow coach or gym_owner accounts.
      query = "SELECT * FROM users WHERE email = ? AND role = 'user' LIMIT 1";
    }

    const [rows] = await pool.execute(query, params);
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const matchedUser = rows[0];
    const passwordCheck = await verifyPasswordWithUpgrade(password, matchedUser.password);
    if (!passwordCheck.valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (Number(matchedUser.is_active || 0) !== 1) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    if (passwordCheck.needsUpgrade) {
      const upgradedHash = await hashPassword(password);
      await pool.execute('UPDATE users SET password = ? WHERE id = ? LIMIT 1', [upgradedHash, matchedUser.id]);
      matchedUser.password = upgradedHash;
    }

    const user = normalizeUser(matchedUser);
    const token = createAuthToken(user);

    // Coach dashboard reads these keys from localStorage.
    if (user.role === 'coach') {
      return res.json({
        success: true,
        user,
        token,
        coach: buildCoachLoginPayload(user),
      });
    }

    return res.json({ success: true, user, token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/auth/session', requireAuth(), async (req, res) => {
  try {
    const user = await loadAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    return res.json({
      success: true,
      user,
      actorType: getRoleSocketType(user.role),
      coach: user.role === 'coach' ? buildCoachLoginPayload(user) : undefined,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to restore session' });
  }
});

router.post('/auth/register', authMutationRateLimit, requireAuth('coach', 'gym_owner'), async (req, res) => {
  try {
    const actor = req.authUser;
    const { email, password, name, role = 'user', coach_id = null, gym_id = null } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedRole = String(role || 'user').trim().toLowerCase();
    if (!['user', 'coach'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (normalizedRole === 'coach' && String(actor?.role || '') !== 'gym_owner') {
      return res.status(403).json({ error: 'Only gym owners can create coach accounts' });
    }

    const derivedName = name || String(email).split('@')[0] || 'User';
    const hashedPassword = await hashPassword(password);
    const actorRole = String(actor?.role || '');
    const actorId = Number(actor?.id || 0) || null;
    const actorGymId = Number(actor?.gym_id || 0) || null;
    const normalizedCoachId = normalizedRole === 'user'
      ? (actorRole === 'coach' ? actorId : (Number(coach_id || 0) || null))
      : null;
    const normalizedGymId = Number(gym_id || actorGymId || 0) || null;

    if (actorRole === 'coach' && normalizedCoachId !== actorId) {
      return res.status(403).json({ error: 'Coaches can only create users assigned to themselves' });
    }
    if (actorRole === 'gym_owner' && actorGymId && normalizedGymId && normalizedGymId !== actorGymId) {
      return res.status(403).json({ error: 'Gym owners can only create accounts inside their own gym' });
    }

    const [result] = await pool.execute(
      `INSERT INTO users (email, password, name, role, coach_id, gym_id, onboarding_completed, first_login)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
      [String(email).trim().toLowerCase(), hashedPassword, derivedName, normalizedRole, normalizedCoachId, normalizedGymId]
    );

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return res.json({ success: true, user: normalizeUser(rows[0]) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// GYMS / COACHES / USERS
// =========================

router.get('/gyms', requireAuth('gym_owner'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, address, phone, subscription_plan, status, is_active, created_at FROM gyms ORDER BY name'
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/gyms', authMutationRateLimit, requireAuth('gym_owner'), async (req, res) => {
  try {
    const { name, email, password, address = null, phone = null, subscription_plan = 'basic' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const hashedPassword = await hashPassword(password);

    const [result] = await pool.execute(
      `INSERT INTO gyms (name, email, password, address, phone, subscription_plan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, String(email).trim().toLowerCase(), hashedPassword, address, phone, subscription_plan]
    );

    const [rows] = await pool.execute('SELECT * FROM gyms WHERE id = ?', [result.insertId]);
    return res.json({ success: true, gym: rows[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Gym email already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.get('/coaches', requireAuth('user', 'coach', 'gym_owner'), async (_req, res) => {
  try {
    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const [rows] = await pool.query(
      `SELECT id, name, email, gym_id, experience_level, fitness_goal, ${profileImageColumn} AS profile_picture
       FROM users
       WHERE role = 'coach' AND is_active = 1
       ORDER BY name`
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/coaches', authMutationRateLimit, requireAuth('gym_owner'), async (req, res) => {
  try {
    const actor = req.authUser;
    const { name, email, password, gym_id = null } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const actorGymId = Number(actor?.gym_id || 0) || null;
    const normalizedGymId = Number(gym_id || actorGymId || 0) || null;
    if (actorGymId && normalizedGymId && actorGymId !== normalizedGymId) {
      return res.status(403).json({ error: 'Gym owners can only create coaches in their own gym' });
    }

    const hashedPassword = await hashPassword(password);

    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, role, gym_id, onboarding_completed, first_login)
       VALUES (?, ?, ?, 'coach', ?, 1, 0)`,
      [name, String(email).trim().toLowerCase(), hashedPassword, normalizedGymId]
    );

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return res.json({ success: true, coach: normalizeUser(rows[0]) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Coach email already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.get('/users', requireAuth('coach', 'gym_owner'), async (req, res) => {
  try {
    const authUser = req.authUser;
    await pool.execute(
      'UPDATE users SET is_active = 0 WHERE is_active = 1 AND ban_delete_at IS NOT NULL AND ban_delete_at <= NOW()'
    );

    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const filters = ["role = 'user'", 'is_active = 1'];
    const params = [];

    if (String(authUser?.role || '') === 'coach') {
      filters.push('coach_id = ?');
      params.push(Number(authUser.id || 0));
    } else if (String(authUser?.role || '') === 'gym_owner' && Number(authUser?.gym_id || 0) > 0) {
      filters.push('gym_id = ?');
      params.push(Number(authUser.gym_id));
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email, role, gym_id, coach_id, age, ${profileImageColumn} AS profile_picture, total_points, total_workouts, \`rank\`, onboarding_completed
       FROM users
       WHERE ${filters.join(' AND ')}
       ORDER BY created_at DESC`,
      params,
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/users/:userId/exists', requireAuth(), requireUserAccess('userId', { allowSelf: true, allowAssignedCoach: true, allowGymOwner: true }), async (req, res) => {
  try {
    const userId = toPositiveInteger(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const [rows] = await pool.execute(
      `SELECT
          id,
          role,
          is_active,
          CASE
            WHEN banned_until IS NOT NULL AND banned_until >= NOW() THEN 1
            ELSE 0
          END AS is_banned
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      return res.json({ exists: false, active: false });
    }

    const row = rows[0];
    const isActiveUser =
      row.role === 'user' &&
      Number(row.is_active || 0) === 1 &&
      Number(row.is_banned || 0) === 0;

    return res.json({
      exists: true,
      active: isActiveUser,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/users/reset-test-users', authMutationRateLimit, requireAuth('coach', 'gym_owner'), async (req, res) => {
  let conn;
  try {
    const confirmValue = req.body?.confirm;
    const isConfirmed =
      confirmValue === true
      || String(confirmValue || '').trim().toUpperCase() === 'DELETE_TEST_USERS';

    if (!isConfirmed) {
      return res.status(400).json({
        error: 'Confirmation required. Send { "confirm": "DELETE_TEST_USERS" } to continue.',
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const userIds = await loadResettableUserIdsForActor(conn, req.authUser);
    if (!userIds.length) {
      await conn.commit();
      return res.json({
        success: true,
        deletedUsers: 0,
      });
    }

    let deletedUsers = 0;
    for (const userId of userIds) {
      deletedUsers += await hardDeleteUserAccount(conn, userId);
    }

    await conn.commit();
    return res.json({
      success: true,
      deletedUsers,
      requestedUsers: userIds.length,
      scope: String(req.authUser?.role || '').trim() || 'unknown',
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message || 'Failed to reset test users' });
  } finally {
    if (conn) conn.release();
  }
});

router.delete('/users/:userId', requireAuth('coach', 'gym_owner'), requireUserAccess('userId', { allowAssignedCoach: true, allowGymOwner: true, allowSelf: false }), async (req, res) => {
  let conn;
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      "SELECT id FROM users WHERE id = ? AND role = 'user' LIMIT 1",
      [userId],
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedRows = await hardDeleteUserAccount(conn, userId);
    if (!deletedRows) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    await conn.commit();
    return res.json({ success: true });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/users/:userId/ban', authMutationRateLimit, requireAuth('coach', 'gym_owner'), requireUserAccess('userId', { allowAssignedCoach: true, allowGymOwner: true, allowSelf: false }), async (req, res) => {
  try {
    const authUser = req.authUser;
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const days = Number(req.body?.days ?? 14);
    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ error: 'days must be a positive number' });
    }

    const reason = String(req.body?.reason || '').trim() || 'Inappropriate content or comments';
    const actorCoachId = String(authUser?.role || '') === 'coach' ? Number(authUser.id || 0) : null;
    const now = new Date();
    const banUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const banWarningUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const banDeleteAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const banUntilSql = banUntil.toISOString().slice(0, 19).replace('T', ' ');
    const banWarningUntilSql = banWarningUntil.toISOString().slice(0, 19).replace('T', ' ');
    const banDeleteAtSql = banDeleteAt.toISOString().slice(0, 19).replace('T', ' ');

    const [result] = await pool.execute(
      "UPDATE users SET banned_until = ?, ban_reason = ?, ban_created_at = NOW(), ban_delete_at = ? WHERE id = ? AND role = 'user'",
      [banUntilSql, reason, banDeleteAtSql, userId]
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const message = `You are banned from posting blogs and comments for ${days} days. Reason: ${reason}. Please remove any disrespectful blogs within 24 hours or your account will be deleted in 48 hours.`;
    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'account_ban', 'Account restricted', ?, JSON_OBJECT('banUntil', ?, 'banWarningUntil', ?, 'banDeleteAt', ?, 'reason', ?, 'days', ?, 'actorCoachId', ?))`,
      [userId, message, banUntilSql, banWarningUntilSql, banDeleteAtSql, reason, days, actorCoachId]
    );

    return res.json({
      success: true,
      bannedUntil: banUntil.toISOString(),
      banWarningUntil: banWarningUntil.toISOString(),
      banDeleteAt: banDeleteAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/coaches/:coachId/schedule', requireAuth('coach', 'gym_owner'), requireCoachScope('coachId'), async (req, res) => {
  try {
    const coachId = toPositiveInteger(req.params.coachId);
    if (!coachId) {
      return res.status(400).json({ error: 'coachId must be a positive integer' });
    }

    const startDate = toSummaryDate(req.query?.startDate);
    const endDate = toSummaryDate(req.query?.endDate);

    const columns = await getWorkoutSessionColumns();
    const dateColumnCandidates = [
      'scheduled_for',
      'scheduled_at',
      'scheduled_date',
      'session_date',
      'start_time',
      'starts_at',
      'scheduled_on',
      'completed_at',
      'created_at',
    ];
    const timeColumnCandidates = ['scheduled_time', 'session_time', 'start_time', 'starts_at'];
    const workoutNameCandidates = ['workout_name', 'session_name', 'name', 'title'];
    const durationCandidates = ['duration_minutes', 'session_duration_minutes', 'duration'];

    const dateColumn = dateColumnCandidates.find((col) => columns.has(col)) || null;
    if (!dateColumn) {
      return res.status(500).json({ error: 'No session date column found in workout_sessions' });
    }

    const timeColumn = timeColumnCandidates.find((col) => columns.has(col)) || null;
    const workoutNameColumn = workoutNameCandidates.find((col) => columns.has(col)) || null;
    const durationColumn = durationCandidates.find((col) => columns.has(col)) || null;
    const statusColumn = columns.has('status') ? 'status' : null;
    const hasMuscleGroup = columns.has('muscle_group');

    const dateExpr = `DATE(ws.${dateColumn})`;
    const timeExpr = timeColumn ? `TIME(ws.${timeColumn})` : `TIME(ws.${dateColumn})`;
    const selectColumns = [
      'ws.id',
      'ws.user_id',
      'u.name AS client_name',
      `${dateExpr} AS session_date`,
      `${timeExpr} AS session_time`,
    ];

    if (workoutNameColumn) {
      selectColumns.push(`ws.${workoutNameColumn} AS workout_name`);
    }
    if (hasMuscleGroup) {
      selectColumns.push('ws.muscle_group AS muscle_group');
    }
    if (durationColumn) {
      selectColumns.push(`ws.${durationColumn} AS duration_minutes`);
    } else {
      selectColumns.push('NULL AS duration_minutes');
    }
    if (statusColumn) {
      selectColumns.push(`ws.${statusColumn} AS status`);
    } else {
      selectColumns.push('NULL AS status');
    }

    const profileImageColumn = await getProfileImageColumn();
    const avatarSelect = profileImageColumn ? `COALESCE(u.${profileImageColumn}, '') AS avatar_url` : `'' AS avatar_url`;
    selectColumns.push(`${avatarSelect}`);

    const whereParts = ['u.role = "user"', 'u.is_active = 1', '(u.banned_until IS NULL OR u.banned_until < NOW())', 'u.coach_id = ?'];
    const params = [coachId];

    if (startDate && endDate) {
      whereParts.push(`${dateExpr} BETWEEN ? AND ?`);
      params.push(startDate, endDate);
    } else if (startDate) {
      whereParts.push(`${dateExpr} >= ?`);
      params.push(startDate);
    } else if (endDate) {
      whereParts.push(`${dateExpr} <= ?`);
      params.push(endDate);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT ${selectColumns.join(', ')}
       FROM workout_sessions ws
       INNER JOIN users u ON u.id = ws.user_id
       ${whereClause}
       ORDER BY session_date ASC, session_time ASC, ws.id ASC`,
      params,
    );

    return res.json({ sessions: rows });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load coach schedule' });
  }
});

// =========================
// USER ONBOARDING / PROFILE
// =========================

router.post('/user/onboarding', authMutationRateLimit, requireAuth('user'), async (req, res) => {
  let conn;
  try {
    const authUser = req.authUser;
    const {
      userId,
      age,
      gender,
      height,
      weight,
      primaryGoal,
      fitnessGoal,
      workoutDays,
      experienceLevel,
      gymId,
      gym_id,
      equipment,
      availableEquipment,
      equipmentList,
      sessionDuration,
      preferredTime,
      bodyType,
      bodyTypeLabel,
      bodyImages,
      onboardingReason,
      appMotivation,
      appMotivationLabel,
      workoutSplitPreference,
      workoutSplitLabel,
      workoutSplit,
      customPlan,
      aiTrainingFocus,
      aiLimitations,
      aiRecoveryPriority,
      aiEquipmentNotes,
      athleteIdentity,
      athleteIdentityLabel,
      athleteIdentityCategory,
      athleteSubCategoryId,
      athleteSubCategoryLabel,
      athleteSubCategoryGroupId,
      athleteSubCategoryGroupLabel,
      athleteGoal,
      sportPracticeYears,
      experienceLevelSource,
      useClaude,
      disableClaude,
    } = req.body;

    const normalizedUserId = toNumber(userId, toNumber(authUser?.id));
    if (!normalizedUserId) {
      return res.status(400).json({ error: 'Valid userId is required' });
    }
    if (Number(authUser?.id || 0) !== normalizedUserId) {
      return res.status(403).json({ error: 'You do not have permission to complete onboarding for this user' });
    }

    const [userRows] = await pool.execute(
      `SELECT id, gym_id, name
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [normalizedUserId],
    );
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const normalizedAge = toNumber(age, null);
    const normalizedHeight = toNumber(height, null);
    const normalizedWeight = toNumber(weight, null);
    const normalizedGender = normalizeGenderEnum(gender);
    const normalizedExperience = normalizeExperienceEnum(experienceLevel || req.body.experience_level);
    const fitnessGoalText = String(fitnessGoal || req.body.fitness_goal || primaryGoal || '').trim();
    const primaryGoalText = String(primaryGoal || fitnessGoalText || '').trim();
    const normalizedGoal = normalizeGoalEnum(fitnessGoalText || primaryGoalText);
    const normalizedDays = clampWorkoutDays(workoutDays, 4);
    const normalizedGymId = toNumber(gym_id || gymId, userRows[0].gym_id || null);
    const normalizedSessionDuration = clampSessionDuration(sessionDuration, 60);
    const normalizedPreferredTime = String(preferredTime || '').trim().toLowerCase() || null;
    const normalizedBodyType = String(bodyType || bodyTypeLabel || '').trim().toLowerCase() || null;
    const normalizedOnboardingReason = String(
      onboardingReason || appMotivationLabel || appMotivation || '',
    ).trim().slice(0, 160) || null;
    const normalizedSplitPreference = normalizeSplitPreference(workoutSplitPreference || workoutSplit);
    const normalizedSplitLabel = String(workoutSplitLabel || '').trim().slice(0, 80) || null;
    const hasExplicitSplitPreference = normalizedSplitPreference !== 'auto';
    const normalizedAiTrainingFocus = String(aiTrainingFocus || '').trim().toLowerCase().slice(0, 40) || null;
    const normalizedAiLimitations = String(aiLimitations || '').trim().slice(0, 300) || null;
    const normalizedAiRecoveryPriority = String(aiRecoveryPriority || '').trim().toLowerCase().slice(0, 40) || null;
    const normalizedAiEquipmentNotes = String(aiEquipmentNotes || '').trim().slice(0, 240) || null;
    const requestedLanguage = String(req.body?.language || '').trim().toLowerCase();
    const normalizedLanguage =
      requestedLanguage === 'ar'
        ? 'ar'
        : requestedLanguage === 'it'
          ? 'it'
          : requestedLanguage === 'de'
            ? 'de'
          : 'en';
    const normalizedAthleteIdentity = normalizeAthleteIdentity(athleteIdentity || req.body.athlete_identity);
    const normalizedAthleteIdentityLabel = normalizeShortText(
      athleteIdentityLabel || req.body.athlete_identity_label,
      80,
      false,
    );
    const normalizedAthleteIdentityCategory = normalizeAthleteIdentityCategory(
      athleteIdentityCategory || req.body.athlete_identity_category,
    );
    const prefersCardioPlan = normalizedAthleteIdentity === 'cardio';
    const normalizedAthleteSubCategoryId = normalizeShortText(
      athleteSubCategoryId || req.body.athlete_sub_category_id,
      100,
      true,
    );
    const normalizedAthleteSubCategoryLabel = normalizeShortText(
      athleteSubCategoryLabel || req.body.athlete_sub_category_label,
      120,
      false,
    );
    const normalizedAthleteSubCategoryGroupId = normalizeShortText(
      athleteSubCategoryGroupId || req.body.athlete_sub_category_group_id,
      100,
      true,
    );
    const normalizedAthleteSubCategoryGroupLabel = normalizeShortText(
      athleteSubCategoryGroupLabel || req.body.athlete_sub_category_group_label,
      120,
      false,
    );
    const normalizedAthleteGoal = normalizeShortText(
      athleteGoal || req.body.athlete_goal || athleteSubCategoryLabel || req.body.athlete_sub_category_label,
      120,
      false,
    );
    const normalizedSportPracticeYears = normalizeSportPracticeYears(
      sportPracticeYears || req.body.sport_practice_years,
    );
    const normalizedExperienceLevelSource = normalizeShortText(
      experienceLevelSource || req.body.experience_level_source,
      40,
      true,
    );
    const normalizedBodyImages = Array.isArray(bodyImages)
      ? bodyImages.filter((image) => typeof image === 'string').slice(0, 3)
      : [];
    const athleteNeedsPerformanceWork =
      normalizedAthleteIdentityCategory === 'athlete_sports'
      && normalizedAthleteIdentity !== 'bodybuilding';
    const equipmentProfile = equipment || availableEquipment || equipmentList || null;
    const onboardingProfilePayload = buildClaudeOnboardingFields(req.body, {
      userId: normalizedUserId,
      age: normalizedAge,
      gender: normalizedGender,
      heightCm: normalizedHeight,
      weightKg: normalizedWeight,
      goal: prefersCardioPlan ? 'endurance' : normalizedGoal,
      experienceLevel: normalizedExperience || 'intermediate',
      daysPerWeek: normalizedDays,
      sessionDuration: normalizedSessionDuration,
      preferredTime: normalizedPreferredTime,
      bodyType: normalizedBodyType,
      language: normalizedLanguage,
      motivation: normalizedOnboardingReason,
      preferredSplit: normalizedSplitPreference,
      preferredSplitLabel: normalizedSplitLabel,
      trainingFocus: normalizedAiTrainingFocus,
      limitations: normalizedAiLimitations,
      recoveryPriority: normalizedAiRecoveryPriority,
      equipmentNotes: normalizedAiEquipmentNotes,
      athleteIdentity: normalizedAthleteIdentity,
      athleteIdentityLabel: normalizedAthleteIdentityLabel,
      athleteIdentityCategory: normalizedAthleteIdentityCategory,
      athleteSubCategoryId: normalizedAthleteSubCategoryId,
      athleteSubCategoryLabel: normalizedAthleteSubCategoryLabel,
      athleteSubCategoryGroupId: normalizedAthleteSubCategoryGroupId,
      athleteSubCategoryGroupLabel: normalizedAthleteSubCategoryGroupLabel,
      athleteGoal: normalizedAthleteGoal,
      sportPracticeYears: normalizedSportPracticeYears,
      experienceLevelSource: normalizedExperienceLevelSource,
      equipment: equipmentProfile,
      bodyImagesProvided: normalizedBodyImages.length,
    });
    const onboardingProfileJson = JSON.stringify(onboardingProfilePayload);

    const claudeEnabled = hasAnthropicConfig();
    const shouldUseClaude = toBooleanFlag(useClaude, claudeEnabled) && !prefersCardioPlan;
    const shouldDisableClaude = toBooleanFlag(disableClaude, false);
    const templateEligibleSplit = ['full_body', 'upper_lower', 'push_pull_legs', 'hybrid'].includes(normalizedSplitPreference);
    const aiPlanRequested = normalizedSplitPreference !== 'custom' && !prefersCardioPlan;
    const hasCustomPlanPayload = customPlan && typeof customPlan === 'object';
    let claudeExerciseAnchors = [];
    let claudeGeneration = null;
    let warning = null;

    if (hasExplicitSplitPreference && templateEligibleSplit && !prefersCardioPlan) {
      try {
        claudeExerciseAnchors = await buildTemplateExerciseAnchorsForSplit(pool, {
          splitPreference: normalizedSplitPreference,
          daysPerWeek: normalizedDays,
        });
      } catch (anchorError) {
        console.warn('[onboarding] Failed to load template exercise anchors:', anchorError?.message || anchorError);
      }
    }

    if (aiPlanRequested && claudeEnabled && shouldUseClaude && !shouldDisableClaude) {
      try {
        const claudeOnboardingFields = buildClaudeOnboardingFields(req.body, {
          userId: normalizedUserId,
          age: normalizedAge,
          gender: normalizedGender,
          heightCm: normalizedHeight,
          weightKg: normalizedWeight,
          goal: prefersCardioPlan ? 'endurance' : normalizedGoal,
          experienceLevel: normalizedExperience || 'intermediate',
          daysPerWeek: normalizedDays,
          sessionDuration: normalizedSessionDuration,
          preferredTime: normalizedPreferredTime,
          bodyType: normalizedBodyType,
          language: normalizedLanguage,
          motivation: normalizedOnboardingReason,
          preferredSplit: normalizedSplitPreference,
          preferredSplitLabel: normalizedSplitLabel,
          trainingFocus: normalizedAiTrainingFocus,
          limitations: normalizedAiLimitations,
          recoveryPriority: normalizedAiRecoveryPriority,
          equipmentNotes: normalizedAiEquipmentNotes,
          equipment: equipmentProfile,
          bodyImagesProvided: normalizedBodyImages.length,
          claudeRequested: aiPlanRequested,
          lockedExercisePoolDays: claudeExerciseAnchors.length,
          lockedExercisePoolExercises: claudeExerciseAnchors.reduce(
            (sum, day) => sum + (Array.isArray(day?.exercises) ? day.exercises.length : 0),
            0,
          ),
        });

        const claudeProfile = {
          age: normalizedAge,
          gender: normalizedGender,
          heightCm: normalizedHeight,
          weightKg: normalizedWeight,
          goal: prefersCardioPlan ? 'endurance' : normalizedGoal,
          experienceLevel: normalizedExperience || 'intermediate',
          daysPerWeek: normalizedDays,
          sessionDuration: normalizedSessionDuration,
          preferredTime: normalizedPreferredTime,
          bodyType: normalizedBodyType,
          language: normalizedLanguage,
          motivation: normalizedOnboardingReason,
          preferredSplit: normalizedSplitPreference,
          preferredSplitLabel: normalizedSplitLabel,
          trainingFocus: normalizedAiTrainingFocus,
          limitations: normalizedAiLimitations,
          recoveryPriority: normalizedAiRecoveryPriority,
          equipmentNotes: normalizedAiEquipmentNotes,
          equipment: equipmentProfile,
          userName: String(userRows[0]?.name || '').trim() || null,
          exerciseAnchors: claudeExerciseAnchors,
          onboardingFields: claudeOnboardingFields,
        };

        claudeGeneration = await generateTwoMonthPlanWithClaude({
          profile: claudeProfile,
          bodyImages: normalizedBodyImages,
        });
      } catch (claudeError) {
        const rawWarning = claudeError?.message || 'Claude onboarding generation failed';
        if (
          /unexpected end of json input|invalid json|json was incomplete|did not contain a json object|no text content/i.test(rawWarning)
        ) {
          warning = 'Claude returned incomplete JSON. Template generator was used for this run.';
        } else if (
          /cloudflare|502|503|504|temporarily unavailable|gateway|timed out|timeout|rate limit|429/i.test(rawWarning)
        ) {
          warning = 'Claude is temporarily unavailable. Template generator was used for this run.';
        } else {
          warning = rawWarning;
        }
        console.warn('[onboarding] Claude generation failed, fallback to template:', rawWarning);
      }
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE users
       SET age = ?,
           gender = ?,
           height_cm = ?,
           weight_kg = ?,
           primary_goal = ?,
           fitness_goal = ?,
           experience_level = ?,
           athlete_identity = ?,
           athlete_identity_label = ?,
           athlete_identity_category = ?,
           athlete_sub_category_id = ?,
           athlete_sub_category_label = ?,
           athlete_sub_category_group_id = ?,
           athlete_sub_category_group_label = ?,
           athlete_goal = ?,
           sport_practice_years = ?,
           experience_level_source = ?,
           workout_split_preference = ?,
           workout_split_label = ?,
           onboarding_reason = ?,
           ai_training_focus = ?,
           ai_limitations = ?,
           ai_recovery_priority = ?,
           ai_equipment_notes = ?,
           session_duration_minutes = ?,
           preferred_time = ?,
           gym_id = ?,
           onboarding_profile = ?,
           onboarding_completed = 1,
           first_login = 0
       WHERE id = ?`,
      [
        normalizedAge,
        normalizedGender,
        normalizedHeight,
        normalizedWeight,
        primaryGoalText || null,
        fitnessGoalText || null,
        normalizedExperience,
        normalizedAthleteIdentity,
        normalizedAthleteIdentityLabel,
        normalizedAthleteIdentityCategory,
        normalizedAthleteSubCategoryId,
        normalizedAthleteSubCategoryLabel,
        normalizedAthleteSubCategoryGroupId,
        normalizedAthleteSubCategoryGroupLabel,
        normalizedAthleteGoal,
        normalizedSportPracticeYears,
        normalizedExperienceLevelSource,
        normalizedSplitPreference,
        normalizedSplitLabel,
        normalizedOnboardingReason,
        normalizedAiTrainingFocus,
        normalizedAiLimitations,
        normalizedAiRecoveryPriority,
        normalizedAiEquipmentNotes,
        normalizedSessionDuration,
        normalizedPreferredTime,
        normalizedGymId,
        onboardingProfileJson,
        normalizedUserId,
      ],
    );

    await conn.query('SAVEPOINT onboarding_user_profile_saved');

    let assignedProgram = null;
    let assignmentInfo = null;
    let claudePlan = null;
    let customAdvice = null;
    let planSource = 'template';

    try {
      if (!assignedProgram && !assignmentInfo && normalizedSplitPreference === 'custom' && hasCustomPlanPayload && !prefersCardioPlan) {
        let customDraft;
        try {
          customDraft = await buildCustomProgramDraft(conn, normalizedUserId, customPlan);
        } catch (validationError) {
          await conn.rollback();
          const message = validationError?.message || 'Invalid custom plan payload';
          if (message === 'User not found') {
            return res.status(404).json({ error: message });
          }
          return res.status(400).json({ error: message });
        }

        const result = await persistCustomProgramDraft(conn, {
          userId: normalizedUserId,
          draft: customDraft,
          assignmentReason: 'user_request',
          assignmentNote: `Onboarding custom plan: ${customDraft.cycleWeeks} weeks, ${customDraft.selectedDays.length} days/week`,
          assignmentSource: 'manual',
          actorUserId: normalizedUserId,
        });

        assignedProgram = result.assignedProgram;
        assignmentInfo = result.assignment;
        planSource = 'custom_user';
        customAdvice = buildCustomPlanAdvice({
          draft: customDraft,
          language: normalizedLanguage,
          normalizedGoal,
          normalizedExperience: normalizedExperience || 'intermediate',
          normalizedDays,
          normalizedSessionDuration,
        });
      }

      if (!assignedProgram && !assignmentInfo && aiPlanRequested && claudeGeneration) {
        await conn.query('SAVEPOINT onboarding_claude_plan');
        try {
          const customPayload = buildCustomProgramPayloadFromClaudePlan(claudeGeneration.plan, {
            daysPerWeek: normalizedDays,
            cycleWeeks: 8,
            splitPreference: normalizedSplitPreference,
            exerciseAnchors: claudeExerciseAnchors,
          });

          const draft = await buildCustomProgramDraft(conn, normalizedUserId, customPayload);
          const persisted = await persistCustomProgramDraft(conn, {
            userId: normalizedUserId,
            draft,
            assignmentReason: 'user_request',
            assignmentNote: `Claude onboarding plan: goal=${normalizedGoal}, days=${normalizedDays}, level=${normalizedExperience || 'unknown'}${normalizedOnboardingReason ? `, reason=${normalizedOnboardingReason}` : ''}${hasExplicitSplitPreference ? `, split=${normalizedSplitPreference}` : ''}${normalizedAiTrainingFocus ? `, focus=${normalizedAiTrainingFocus}` : ''}${normalizedAiRecoveryPriority ? `, recovery=${normalizedAiRecoveryPriority}` : ''}`,
            assignmentSource: 'ai',
            actorUserId: normalizedUserId,
          });

          assignedProgram = persisted.assignedProgram;
          assignmentInfo = persisted.assignment;
          planSource = 'claude';
          claudePlan = {
            model: claudeGeneration.model,
            usedImages: claudeGeneration.usedImages,
            planName: claudeGeneration.plan.planName,
            summary: claudeGeneration.plan.summary,
            goalMatch: claudeGeneration.plan.goalMatch,
            durationWeeks: claudeGeneration.plan.durationWeeks,
            weeklySchedule: claudeGeneration.plan.weeklySchedule,
            progressionRules: claudeGeneration.plan.progressionRules,
            recoveryRules: claudeGeneration.plan.recoveryRules,
            nutritionGuidance: claudeGeneration.plan.nutritionGuidance,
            checkpoints: claudeGeneration.plan.checkpoints,
          };
        } catch (claudeError) {
          await conn.query('ROLLBACK TO SAVEPOINT onboarding_claude_plan');
          const rawWarning = claudeError?.message || 'Claude onboarding generation failed';
          if (
            /unexpected end of json input|invalid json|json was incomplete|did not contain a json object|no text content/i.test(rawWarning)
          ) {
            warning = 'Claude returned incomplete JSON. Template generator was used for this run.';
          } else if (
            /cloudflare|502|503|504|temporarily unavailable|gateway|timed out|timeout|rate limit|429/i.test(rawWarning)
          ) {
            warning = 'Claude is temporarily unavailable. Template generator was used for this run.';
          } else {
            warning = rawWarning;
          }
          console.warn('[onboarding] Claude generation failed, fallback to template:', rawWarning);
        }
      }

      if (
        !assignedProgram
        && !assignmentInfo
        && hasExplicitSplitPreference
        && templateEligibleSplit
        && !athleteNeedsPerformanceWork
        && !prefersCardioPlan
      ) {
        const templateResult = await assignTemplateProgramFromLibrary(conn, {
          userId: normalizedUserId,
          splitPreference: normalizedSplitPreference,
          note: `Template onboarding plan: goal=${normalizedGoal}, days=${normalizedDays}, level=${normalizedExperience || 'unknown'}${normalizedOnboardingReason ? `, reason=${normalizedOnboardingReason}` : ''}${hasExplicitSplitPreference ? `, split=${normalizedSplitPreference}` : ''}`,
        });
        if (templateResult) {
          assignedProgram = templateResult.assignedProgram;
          assignmentInfo = templateResult.assignment;
          planSource = 'template_library';
        }
      }

      if (!assignedProgram || !assignmentInfo) {
        const generatedProgram = await generatePersonalizedProgram(conn, {
          userId: normalizedUserId,
          gymId: normalizedGymId,
          goal: prefersCardioPlan ? 'endurance' : normalizedGoal,
          experienceLevel: normalizedExperience || 'intermediate',
          daysPerWeek: normalizedDays,
          cycleWeeks: 12,
          splitPreference: normalizedSplitPreference,
          athleteIdentity: normalizedAthleteIdentity,
          athleteIdentityCategory: normalizedAthleteIdentityCategory,
          equipment: equipmentProfile,
          notes: `Generated from onboarding: goal=${normalizedGoal}, days=${normalizedDays}, level=${normalizedExperience || 'unknown'}${normalizedOnboardingReason ? `, reason=${normalizedOnboardingReason}` : ''}${hasExplicitSplitPreference ? `, split=${normalizedSplitPreference}` : ''}${normalizedAiTrainingFocus ? `, focus=${normalizedAiTrainingFocus}` : ''}${normalizedAiRecoveryPriority ? `, recovery=${normalizedAiRecoveryPriority}` : ''}`,
        });

        assignmentInfo = await assignProgramToUser(conn, {
          userId: normalizedUserId,
          programId: generatedProgram.programId,
          reason: 'user_request',
          note: `Auto-generated plan from onboarding: goal=${normalizedGoal}, days=${normalizedDays}, level=${normalizedExperience || 'unknown'}${normalizedOnboardingReason ? `, reason=${normalizedOnboardingReason}` : ''}${hasExplicitSplitPreference ? `, split=${normalizedSplitPreference}` : ''}`,
        });

        assignedProgram = {
          id: generatedProgram.programId,
          name: generatedProgram.name,
          programType: generatedProgram.programType,
          goal: generatedProgram.goal,
          daysPerWeek: generatedProgram.daysPerWeek,
          cycleWeeks: generatedProgram.cycleWeeks,
        };
        planSource = 'template';
      }
    } catch (planError) {
      await conn.query('ROLLBACK TO SAVEPOINT onboarding_user_profile_saved');
      const rawWarning = planError?.message || 'Plan generation failed after onboarding data was saved';
      warning = warning || rawWarning;
      assignedProgram = null;
      assignmentInfo = null;
      claudePlan = null;
      customAdvice = null;
      planSource = 'profile_only';
      console.warn('[onboarding] Plan generation failed after onboarding profile save:', rawWarning);
    }

    await conn.commit();

    const [savedUserRows] = await pool.execute(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [normalizedUserId],
    );
    const savedUser = savedUserRows.length ? normalizeUser(savedUserRows[0]) : null;

    return res.json({
      success: true,
      user: savedUser,
      assignedProgram,
      assignment: assignmentInfo,
      planSource,
      claudePlan,
      customAdvice,
      warning,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to save onboarding and generate plan' });
  } finally {
    if (conn) conn.release();
  }
});

router.use('/user/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }));

router.post('/user/:userId/program/generate-personalized', authMutationRateLimit, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const [userRows] = await conn.execute(
      `SELECT id, gym_id, fitness_goal, experience_level, athlete_identity, athlete_identity_category
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRows[0];
    const goal = normalizeGoalEnum(req.body.goal || user.fitness_goal);
    const level = normalizeExperienceEnum(req.body.experienceLevel || user.experience_level) || 'intermediate';
    const daysPerWeek = clampWorkoutDays(req.body.workoutDays, 4);
    const cycleWeeks = Math.max(8, Math.min(16, Number(req.body.cycleWeeks || 12)));

    const generatedProgram = await generatePersonalizedProgram(conn, {
      userId,
      gymId: user.gym_id || null,
      goal,
      experienceLevel: level,
      daysPerWeek,
      cycleWeeks,
      athleteIdentity: normalizeAthleteIdentity(req.body.athleteIdentity || user.athlete_identity),
      athleteIdentityCategory: normalizeAthleteIdentityCategory(req.body.athleteIdentityCategory || user.athlete_identity_category),
      equipment: req.body.equipment || req.body.availableEquipment || req.body.equipmentList || null,
      notes: `Manual generation request (goal=${goal}, days=${daysPerWeek}, level=${level})`,
    });

    const assignment = await assignProgramToUser(conn, {
      userId,
      programId: generatedProgram.programId,
      reason: 'user_request',
      note: 'Manual personalized generation endpoint',
    });

    await conn.commit();
    return res.json({
      success: true,
      assignedProgram: {
        id: generatedProgram.programId,
        name: generatedProgram.name,
        goal: generatedProgram.goal,
        programType: generatedProgram.programType,
        daysPerWeek: generatedProgram.daysPerWeek,
        cycleWeeks: generatedProgram.cycleWeeks,
      },
      assignment,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to generate personalized program' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/user/:userId/program/custom', authMutationRateLimit, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid userId' });
    }
    let draft;
    try {
      draft = await buildCustomProgramDraft(conn, userId, req.body);
    } catch (validationError) {
      await conn.rollback();
      const message = validationError?.message || 'Invalid custom plan payload';
      if (message === 'User not found') {
        return res.status(404).json({ error: message });
      }
      return res.status(400).json({ error: message });
    }

    const result = await persistCustomProgramDraft(conn, {
      userId,
      draft,
      assignmentReason: 'user_request',
      assignmentNote: `User custom plan: ${draft.cycleWeeks} weeks, ${draft.selectedDays.length} days/week`,
      assignmentSource: 'manual',
    });

    await conn.commit();
    return res.json({
      success: true,
      assignedProgram: result.assignedProgram,
      assignment: result.assignment,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to save custom plan' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/user/:userId/program/custom/request', authMutationRateLimit, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid userId' });
    }

    let draft;
    try {
      draft = await buildCustomProgramDraft(conn, userId, req.body);
    } catch (validationError) {
      await conn.rollback();
      const message = validationError?.message || 'Invalid custom plan payload';
      if (message === 'User not found') {
        return res.status(404).json({ error: message });
      }
      return res.status(400).json({ error: message });
    }

    const coachId = Number(draft.user.coach_id || 0);
    if (!coachId) {
      await conn.rollback();
      return res.status(400).json({ error: 'No coach assigned to this user' });
    }

    const [insertResult] = await conn.execute(
      `INSERT INTO program_change_requests
        (user_id, coach_id, plan_name, description, cycle_weeks, selected_days_json, weekly_workouts_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        coachId,
        draft.planName.slice(0, 255),
        draft.description,
        draft.cycleWeeks,
        JSON.stringify(draft.selectedDays),
        JSON.stringify(draft.weeklyWorkouts),
      ],
    );
    const requestId = Number(insertResult.insertId);

    await conn.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'plan_review_request', 'Plan review request', ?, JSON_OBJECT('requestId', ?, 'userId', ?, 'planName', ?, 'cycleWeeks', ?))`,
      [
        coachId,
        `${draft.user.name || 'User'} sent a custom plan for approval.`,
        requestId,
        userId,
        draft.planName.slice(0, 255),
        draft.cycleWeeks,
      ],
    );

    await conn.commit();
    return res.json({
      success: true,
      request: {
        id: requestId,
        status: 'pending',
        userId,
        coachId,
        planName: draft.planName,
        cycleWeeks: draft.cycleWeeks,
      },
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to submit plan review request' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/user/:userId/coach/:coachId/plan-request', authMutationRateLimit, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const userId = Number(req.params.userId);
    const coachId = Number(req.params.coachId);
    if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(coachId) || coachId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid userId or coachId' });
    }

    const [userRows] = await conn.execute(
      `SELECT id, name, role
       FROM users
       WHERE id = ? AND role = 'user'
       LIMIT 1
       FOR UPDATE`,
      [userId],
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const [coachRows] = await conn.execute(
      `SELECT id, name
       FROM users
       WHERE id = ? AND role = 'coach' AND is_active = 1
       LIMIT 1`,
      [coachId],
    );
    if (!coachRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Coach not found' });
    }

    const userName = String(userRows[0]?.name || 'User').trim() || 'User';
    const coachName = String(coachRows[0]?.name || 'Coach').trim() || 'Coach';

    await conn.execute(
      `UPDATE users
       SET coach_id = ?
       WHERE id = ?`,
      [coachId, userId],
    );

    await conn.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'plan_coach_request', 'New plan request', ?, JSON_OBJECT('userId', ?, 'coachId', ?))`,
      [
        coachId,
        `${userName} requested a personalized plan.`,
        userId,
        coachId,
      ],
    );

    await conn.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'plan_coach_request_sent', 'Request sent', ?, JSON_OBJECT('coachId', ?, 'coachName', ?))`,
      [
        userId,
        `Your request was sent to ${coachName}.`,
        coachId,
        coachName,
      ],
    );

    await conn.commit();
    return res.json({
      success: true,
      userId,
      coachId,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to send plan request' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/coach/:coachId/user/:userId/program/custom', authMutationRateLimit, requireAuth('coach', 'gym_owner'), requireCoachScope('coachId'), requireUserAccess('userId', { allowAssignedCoach: true, allowGymOwner: true }), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const coachId = Number(req.params.coachId);
    const userId = Number(req.params.userId);
    if (!Number.isFinite(coachId) || coachId <= 0 || !Number.isFinite(userId) || userId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid coachId or userId' });
    }

    const [coachRows] = await conn.execute(
      `SELECT id, name
       FROM users
       WHERE id = ? AND role = 'coach' AND is_active = 1
       LIMIT 1`,
      [coachId],
    );
    if (!coachRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Coach not found' });
    }

    await conn.execute(
      `UPDATE users
       SET coach_id = ?
       WHERE id = ? AND role = 'user'`,
      [coachId, userId],
    );

    let draft;
    try {
      draft = await buildCustomProgramDraft(conn, userId, req.body);
    } catch (validationError) {
      await conn.rollback();
      const message = validationError?.message || 'Invalid custom plan payload';
      if (message === 'User not found') {
        return res.status(404).json({ error: message });
      }
      return res.status(400).json({ error: message });
    }

    const result = await persistCustomProgramDraft(conn, {
      userId,
      draft,
      assignmentReason: 'coach_direct_create',
      assignmentNote: `Coach ${coachId} created/updated custom plan`,
      assignmentSource: 'coach',
      actorUserId: coachId,
    });

    await conn.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'plan_created_by_coach', 'New plan from your coach', ?, JSON_OBJECT('coachId', ?, 'programId', ?, 'planName', ?))`,
      [
        userId,
        'Your coach created and activated a new training plan for you.',
        coachId,
        result.programId,
        draft.planName.slice(0, 255),
      ],
    );

    await conn.commit();
    return res.json({
      success: true,
      assignedProgram: result.assignedProgram,
      assignment: result.assignment,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to save coach custom plan' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/coach/:coachId/program-requests', requireAuth('coach', 'gym_owner'), requireCoachScope('coachId'), async (req, res) => {
  try {
    const coachId = Number(req.params.coachId);
    if (!Number.isFinite(coachId) || coachId <= 0) {
      return res.status(400).json({ error: 'Invalid coachId' });
    }

    const status = String(req.query.status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'cancelled']);
    const useStatusFilter = allowedStatuses.has(status);

    const [rows] = await pool.execute(
      `SELECT
         pcr.id,
         pcr.user_id,
         pcr.coach_id,
         pcr.plan_name,
         pcr.description,
         pcr.cycle_weeks,
         pcr.selected_days_json,
         pcr.weekly_workouts_json,
         pcr.status,
         pcr.review_notes,
         pcr.approved_program_id,
         pcr.reviewed_by,
         pcr.reviewed_at,
         pcr.created_at,
         pcr.updated_at,
         u.name AS user_name,
         u.email AS user_email
       FROM program_change_requests pcr
       JOIN users u ON u.id = pcr.user_id
       WHERE pcr.coach_id = ?
         AND (? = 0 OR pcr.status = ?)
       ORDER BY (pcr.status = 'pending') DESC, pcr.created_at DESC
       LIMIT 200`,
      [coachId, useStatusFilter ? 1 : 0, status],
    );

    const requests = rows.map((row) => {
      const selectedDays = safeParseJson(row.selected_days_json, []);
      const weeklyWorkouts = safeParseJson(row.weekly_workouts_json, []);
      return {
        id: Number(row.id),
        userId: Number(row.user_id),
        userName: row.user_name || 'User',
        userEmail: row.user_email || '',
        coachId: Number(row.coach_id),
        planName: row.plan_name || 'Custom Plan',
        description: row.description || '',
        cycleWeeks: Number(row.cycle_weeks || 0),
        selectedDays: Array.isArray(selectedDays) ? selectedDays : [],
        weeklyWorkouts: Array.isArray(weeklyWorkouts) ? weeklyWorkouts : [],
        status: String(row.status || 'pending'),
        reviewNotes: row.review_notes || null,
        approvedProgramId: row.approved_program_id ? Number(row.approved_program_id) : null,
        reviewedBy: row.reviewed_by ? Number(row.reviewed_by) : null,
        reviewedAt: row.reviewed_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return res.json({
      requests,
      pendingCount: requests.filter((request) => request.status === 'pending').length,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to load program requests' });
  }
});

router.post('/coach/:coachId/program-requests/:requestId/approve', authMutationRateLimit, requireAuth('coach', 'gym_owner'), requireCoachScope('coachId'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const coachId = Number(req.params.coachId);
    const requestId = Number(req.params.requestId);
    if (!Number.isFinite(coachId) || coachId <= 0 || !Number.isFinite(requestId) || requestId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid coachId or requestId' });
    }

    const [rows] = await conn.execute(
      `SELECT id, user_id, coach_id, plan_name, description, cycle_weeks, selected_days_json, weekly_workouts_json, status
       FROM program_change_requests
       WHERE id = ? AND coach_id = ?
       LIMIT 1
       FOR UPDATE`,
      [requestId, coachId],
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Program request not found' });
    }

    const request = rows[0];
    if (String(request.status) !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only pending requests can be approved' });
    }

    const selectedDays = safeParseJson(request.selected_days_json, []);
    const weeklyWorkouts = safeParseJson(request.weekly_workouts_json, []);

    const payload = {
      planName: request.plan_name,
      description: request.description,
      cycleWeeks: Number(request.cycle_weeks || 0),
      selectedDays: Array.isArray(selectedDays) ? selectedDays : [],
      weeklyWorkouts: Array.isArray(weeklyWorkouts) ? weeklyWorkouts : [],
    };

    let draft;
    try {
      draft = await buildCustomProgramDraft(conn, Number(request.user_id), payload);
    } catch (validationError) {
      await conn.rollback();
      return res.status(400).json({
        error: validationError?.message || 'Plan request payload is no longer valid. Please ask user to resubmit.',
      });
    }

    const result = await persistCustomProgramDraft(conn, {
      userId: Number(request.user_id),
      draft,
      assignmentReason: 'coach_approved',
      assignmentNote: `Coach approved custom plan request #${requestId}`,
      assignmentSource: 'coach',
    });

    await conn.execute(
      `UPDATE program_change_requests
       SET status = 'approved',
           approved_program_id = ?,
           review_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE id = ?`,
      [result.programId, String(req.body?.reason || '').trim() || null, coachId, requestId],
    );

    await conn.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'plan_review_approved', 'Plan approved', ?, JSON_OBJECT('requestId', ?, 'programId', ?, 'planName', ?))`,
      [
        Number(request.user_id),
        'Your coach approved your custom plan and activated it.',
        requestId,
        result.programId,
        draft.planName.slice(0, 255),
      ],
    );

    await conn.commit();
    return res.json({
      success: true,
      requestId,
      status: 'approved',
      assignedProgram: result.assignedProgram,
      assignment: result.assignment,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to approve program request' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/coach/:coachId/program-requests/:requestId/reject', authMutationRateLimit, requireAuth('coach', 'gym_owner'), requireCoachScope('coachId'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const coachId = Number(req.params.coachId);
    const requestId = Number(req.params.requestId);
    if (!Number.isFinite(coachId) || coachId <= 0 || !Number.isFinite(requestId) || requestId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid coachId or requestId' });
    }

    const [rows] = await conn.execute(
      `SELECT id, user_id, status
       FROM program_change_requests
       WHERE id = ? AND coach_id = ?
       LIMIT 1
       FOR UPDATE`,
      [requestId, coachId],
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Program request not found' });
    }

    const request = rows[0];
    if (String(request.status) !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only pending requests can be rejected' });
    }

    const reviewNotes = String(req.body?.reason || '').trim();
    await conn.execute(
      `UPDATE program_change_requests
       SET status = 'rejected',
           review_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE id = ?`,
      [reviewNotes || null, coachId, requestId],
    );

    await conn.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'plan_review_rejected', 'Plan not approved', ?, JSON_OBJECT('requestId', ?, 'reason', ?))`,
      [
        Number(request.user_id),
        reviewNotes ? `Your coach rejected your plan: ${reviewNotes}` : 'Your coach rejected your custom plan request.',
        requestId,
        reviewNotes || null,
      ],
    );

    await conn.commit();
    return res.json({
      success: true,
      requestId,
      status: 'rejected',
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to reject program request' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/user/:userId/program/adapt-biweekly', authMutationRateLimit, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const result = await adaptProgramBiWeekly(conn, { userId });
    await conn.commit();
    return res.json({ success: true, ...result });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to adapt program bi-weekly' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/user/:userId/program/adapt-weekly', authMutationRateLimit, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const force = ['1', 'true', 'yes'].includes(String(req.body?.force || '').trim().toLowerCase());
    const trigger = String(req.body?.trigger || 'weekly_analysis').trim() || 'weekly_analysis';
    const result = await adaptProgramWeeklyByInsights(conn, { userId, force, trigger });
    await conn.commit();
    return res.json({ success: true, ...result });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error?.message || 'Failed to adapt program weekly' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/user/:userId/plan/validation/snapshot', authMutationRateLimit, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const snapshot = await captureWeeklyValidationSnapshot(conn, {
      userId,
      adaptationId: Number.isFinite(Number(req.body?.adaptationId)) ? Number(req.body.adaptationId) : null,
      assignmentId: Number.isFinite(Number(req.body?.assignmentId)) ? Number(req.body.assignmentId) : null,
      programId: Number.isFinite(Number(req.body?.programId)) ? Number(req.body.programId) : null,
      source: req.body?.source || 'manual',
      periodEnd: req.body?.periodEnd || null,
    });

    await conn.commit();
    return res.json({
      success: true,
      ...snapshot,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error?.message === 'Invalid userId') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || 'Failed to create validation snapshot' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/user/:userId/plan/validation/history', async (req, res) => {
  let conn;
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    conn = await pool.getConnection();
    const limit = Number(req.query?.limit || 24);
    const history = await getUserPlanValidationHistory(conn, { userId, limit });
    return res.json(history);
  } catch (error) {
    if (error?.message === 'Invalid userId') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || 'Failed to load validation history' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/insights/validation/monthly', requireAuth('coach', 'gym_owner'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const months = Number(req.query?.months || 6);
    const summary = await getMonthlyValidationCalibration(conn, { months });
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to load monthly validation summary' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/profile/:userId/picture', requireAuth('user', 'coach', 'gym_owner'), async (req, res) => {
  try {
    const { userId } = req.params;
    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const [rows] = await pool.execute(`SELECT ${profileImageColumn} AS profile_picture FROM users WHERE id = ?`, [userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({ profilePicture: rows[0].profile_picture || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/profile/:userId/details', requireAuth(), requireUserAccess('userId', { allowSelf: true, allowAssignedCoach: true, allowGymOwner: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const [rows] = await pool.execute(
      `SELECT
          id,
          name,
          email,
          age,
          gender,
          height_cm,
          weight_kg,
          primary_goal,
          fitness_goal,
          experience_level,
          athlete_identity,
          athlete_identity_label,
          athlete_identity_category,
          athlete_sub_category_id,
          athlete_sub_category_label,
          athlete_sub_category_group_id,
          athlete_sub_category_group_label,
          athlete_goal,
          sport_practice_years,
          experience_level_source,
          workout_split_preference,
          workout_split_label,
          onboarding_reason,
          ai_training_focus,
          ai_limitations,
          ai_recovery_priority,
          ai_equipment_notes,
          session_duration_minutes,
          preferred_time
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = rows[0];
    return res.json({
      id: Number(row.id),
      name: row.name || '',
      email: row.email || '',
      age: row.age == null ? null : Number(row.age),
      gender: row.gender || null,
      heightCm: row.height_cm == null ? null : Number(row.height_cm),
      weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
      primaryGoal: row.primary_goal || '',
      fitnessGoal: row.fitness_goal || '',
      experienceLevel: row.experience_level || '',
      athleteIdentity: row.athlete_identity || '',
      athleteIdentityLabel: row.athlete_identity_label || '',
      athleteIdentityCategory: row.athlete_identity_category || '',
      athleteSubCategoryId: row.athlete_sub_category_id || '',
      athleteSubCategoryLabel: row.athlete_sub_category_label || '',
      athleteSubCategoryGroupId: row.athlete_sub_category_group_id || '',
      athleteSubCategoryGroupLabel: row.athlete_sub_category_group_label || '',
      athleteGoal: row.athlete_goal || '',
      sportPracticeYears: row.sport_practice_years == null ? null : Number(row.sport_practice_years),
      experienceLevelSource: row.experience_level_source || '',
      workoutSplitPreference: row.workout_split_preference || '',
      workoutSplitLabel: row.workout_split_label || '',
      onboardingReason: row.onboarding_reason || '',
      aiTrainingFocus: row.ai_training_focus || '',
      aiLimitations: row.ai_limitations || '',
      aiRecoveryPriority: row.ai_recovery_priority || '',
      aiEquipmentNotes: row.ai_equipment_notes || '',
      sessionDuration: row.session_duration_minutes == null ? null : Number(row.session_duration_minutes),
      preferredTime: row.preferred_time || '',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/profile/:userId/details', authMutationRateLimit, requireAuth(), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const age = req.body?.age === '' || req.body?.age == null ? null : toNumber(req.body.age, null);
    const gender = normalizeGenderEnum(req.body?.gender);
    const heightCm = req.body?.heightCm === '' || req.body?.heightCm == null ? null : toNumber(req.body.heightCm, null);
    const weightKg = req.body?.weightKg === '' || req.body?.weightKg == null ? null : toNumber(req.body.weightKg, null);
    const primaryGoal = String(req.body?.primaryGoal || '').trim();
    const fitnessGoal = String(req.body?.fitnessGoal || '').trim();
    const experienceLevel = normalizeExperienceEnum(req.body?.experienceLevel);
    const hasSessionDuration = Object.prototype.hasOwnProperty.call(req.body || {}, 'sessionDuration');
    const hasPreferredTime = Object.prototype.hasOwnProperty.call(req.body || {}, 'preferredTime');
    const sessionDuration = req.body?.sessionDuration === '' || req.body?.sessionDuration == null
      ? null
      : clampSessionDuration(req.body.sessionDuration, 60);
    const preferredTimeRaw = String(req.body?.preferredTime || '').trim().toLowerCase();
    const preferredTime = ['morning', 'afternoon', 'evening'].includes(preferredTimeRaw)
      ? preferredTimeRaw
      : null;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (age != null && (age < 10 || age > 100)) {
      return res.status(400).json({ error: 'Age must be between 10 and 100' });
    }
    if (heightCm != null && (heightCm < 100 || heightCm > 260)) {
      return res.status(400).json({ error: 'Height must be between 100 and 260 cm' });
    }
    if (weightKg != null && (weightKg < 25 || weightKg > 350)) {
      return res.status(400).json({ error: 'Weight must be between 25 and 350 kg' });
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET
         name = ?,
         email = ?,
         age = ?,
         gender = ?,
         height_cm = ?,
         weight_kg = ?,
         primary_goal = ?,
         fitness_goal = ?,
         experience_level = ?,
         session_duration_minutes = IF(?, ?, session_duration_minutes),
         preferred_time = IF(?, ?, preferred_time)
       WHERE id = ?`,
      [
        name,
        email,
        age,
        gender,
        heightCm,
        weightKg,
        primaryGoal || null,
        fitnessGoal || null,
        experienceLevel,
        hasSessionDuration ? 1 : 0,
        sessionDuration,
        hasPreferredTime ? 1 : 0,
        preferredTime,
        userId,
      ],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.put('/profile/:userId/password', authMutationRateLimit, requireAuth(), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const oldPassword = String(req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Old password, new password and confirm password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Confirm password does not match new password' });
    }

    const [rows] = await pool.execute(
      `SELECT id, password
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentPassword = String(rows[0].password || '');
    const verification = await verifyPasswordWithUpgrade(oldPassword, currentPassword);
    if (!verification.valid) {
      return res.status(400).json({ error: 'Old password is incorrect' });
    }

    const nextPasswordHash = await hashPassword(newPassword);

    await pool.execute(
      `UPDATE users
       SET password = ?
       WHERE id = ?`,
      [nextPasswordHash, userId],
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/profile/:userId/picture', authMutationRateLimit, requireAuth(), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const { userId } = req.params;
    const { profilePicture } = req.body;
    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const imageValue = profilePicture || null;
    if (imageValue != null && typeof imageValue !== 'string') {
      return res.status(400).json({ error: 'profilePicture must be a base64 data URL string' });
    }

    if (typeof imageValue === 'string' && !imageValue.startsWith('data:image/')) {
      return res.status(400).json({ error: 'profilePicture must start with data:image/' });
    }

    const maxLength = await getProfileImageColumnMaxLength(profileImageColumn);
    if (typeof imageValue === 'string' && maxLength && imageValue.length > maxLength) {
      return res.status(413).json({
        error: `Profile image is too large for DB column '${profileImageColumn}' (length ${imageValue.length}, max ${maxLength}).`,
      });
    }

    const [result] = await pool.execute(`UPDATE users SET ${profileImageColumn} = ? WHERE id = ?`, [imageValue, userId]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify persisted content matches what was sent (detect silent DB truncation).
    if (typeof imageValue === 'string') {
      const [rows] = await pool.execute(
        `SELECT ${profileImageColumn} AS profile_picture FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      const savedValue = rows[0]?.profile_picture || '';
      if (savedValue !== imageValue) {
        return res.status(500).json({
          error: `Profile image was not saved correctly (likely truncated). Increase users.${profileImageColumn} to LONGTEXT.`,
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/profile/:userId/stats', requireAuth(), requireUserAccess('userId', { allowSelf: true, allowAssignedCoach: true, allowGymOwner: true }), async (req, res) => {
  try {
    const { userId } = req.params;

    const [userRows] = await pool.execute(
      `SELECT id, gym_id, total_points
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = userRows[0];
    const gymId = currentUser.gym_id;
    const totalPoints = Number(currentUser.total_points || 0);

    const [rows] = await pool.execute(
      `SELECT
          COUNT(
            DISTINCT COALESCE(
              CASE
                WHEN session_id IS NOT NULL THEN CONCAT('session:', session_id, '|', LOWER(TRIM(exercise_name)))
                ELSE NULL
              END,
              CONCAT('day_exercise:', DATE(created_at), '|', LOWER(TRIM(exercise_name)))
            )
          ) AS completed_exercises,
          MIN(created_at) AS first_completed_at
       FROM workout_sets
       WHERE user_id = ?
         AND (completed = 1 OR completed IS NULL)
         AND NULLIF(TRIM(exercise_name), '') IS NOT NULL`,
      [userId],
    );

    const rankScopeWhere = gymId
      ? `role = 'user' AND is_active = 1 AND gym_id = ?`
      : `role = 'user' AND is_active = 1`;

    const rankParams = gymId
      ? [gymId, totalPoints, totalPoints, currentUser.id]
      : [totalPoints, totalPoints, currentUser.id];

    const membersParams = gymId ? [gymId] : [];

    const [rankRows] = await pool.execute(
      `SELECT
         1 + COUNT(*) AS rank_position
       FROM users
       WHERE ${rankScopeWhere}
         AND (total_points > ? OR (total_points = ? AND id < ?))`,
      rankParams,
    );

    const [membersRows] = await pool.execute(
      `SELECT COUNT(*) AS total_members
       FROM users
       WHERE ${rankScopeWhere}`,
      membersParams,
    );

    const [assignmentRows] = await pool.execute(
      `SELECT pa.id, pa.start_date, p.days_per_week, p.cycle_weeks
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [userId],
    );

    let planDaysLeft = null;
    let planSessionsLeft = 0;
    let planCompletedWorkouts = 0;
    let planPlannedWorkouts = 0;

    if (assignmentRows.length > 0) {
      const assignment = assignmentRows[0];
      const daysPerWeekRaw = Number(assignment.days_per_week || 0);
      const daysPerWeek = daysPerWeekRaw > 0 ? daysPerWeekRaw : 4;
      planPlannedWorkouts = Math.max(0, Number(assignment.cycle_weeks || 0) * daysPerWeek);

      const [completedRows] = await pool.execute(
        `SELECT COUNT(*) AS completed_workouts
         FROM workout_sessions
         WHERE user_id = ? AND program_assignment_id = ? AND status = 'completed'`,
        [userId, assignment.id],
      );

      const [setCompletedRows] = await pool.execute(
        `SELECT COUNT(DISTINCT DATE(created_at)) AS completed_days
         FROM workout_sets
         WHERE user_id = ?
           AND DATE(created_at) BETWEEN ? AND ?`,
        [userId, formatDateISO(new Date(assignment.start_date)), formatDateISO(new Date())],
      );

      const completedFromSessions = Number(completedRows[0]?.completed_workouts || 0);
      const completedFromSets = Number(setCompletedRows[0]?.completed_days || 0);
      planCompletedWorkouts = completedFromSessions > 0 ? completedFromSessions : completedFromSets;
      planSessionsLeft = Math.max(planPlannedWorkouts - planCompletedWorkouts, 0);
      planDaysLeft = planSessionsLeft > 0 ? Math.ceil((planSessionsLeft / daysPerWeek) * 7) : 0;
    }

    const stats = rows[0] || {};
    const completedExercises = Number(stats.completed_exercises || 0);
    const rankPosition = Number(rankRows[0]?.rank_position || 0);
    const totalMembers = Number(membersRows[0]?.total_members || 0);
    const nextRank = getNextRankInfo(totalPoints);
    return res.json({
      completedExercises,
      firstCompletedAt: stats.first_completed_at || null,
      rankPosition,
      totalMembers,
      classification: {
        position: rankPosition || null,
        total: totalMembers,
        scope: gymId ? 'gym' : 'global',
      },
      hasActiveProgram: assignmentRows.length > 0,
      planDaysLeft,
      planSessionsLeft,
      planCompletedWorkouts,
      planPlannedWorkouts,
      totalPoints,
      rank: getRankFromPoints(totalPoints),
      nextRank,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/leaderboard/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const period = String(req.query.period || 'alltime').toLowerCase();
    if (!['monthly', 'alltime'].includes(period)) {
      return res.status(400).json({ error: "Invalid period. Use 'monthly' or 'alltime'" });
    }

    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const [userRows] = await pool.execute(
      `SELECT id, gym_id
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const gymId = userRows[0].gym_id;
    const scopeWhere = gymId
      ? `u.role = 'user' AND u.is_active = 1 AND u.gym_id = ?`
      : `u.role = 'user' AND u.is_active = 1`;
    const scopeParams = gymId ? [gymId] : [];

    let query = '';
    if (period === 'monthly') {
      query = `
        SELECT
          u.id,
          u.name,
          u.gym_id,
          ${profileImageColumn} AS profile_picture,
          COALESCE(monthly_missions.points, 0) + COALESCE(monthly_challenges.points, 0) + COALESCE(monthly_friend_challenges.points, 0) AS points,
          COALESCE(u.total_points, 0) AS total_points
        FROM users u
        LEFT JOIN (
          SELECT um.user_id, SUM(m.points_reward) AS points
          FROM user_missions um
          JOIN missions m ON m.id = um.mission_id
          WHERE um.status = 'completed'
            AND um.completed_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
            AND um.completed_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
          GROUP BY um.user_id
        ) monthly_missions ON monthly_missions.user_id = u.id
        LEFT JOIN (
          SELECT uc.user_id, SUM(ct.points_reward) AS points
          FROM user_challenges uc
          JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
          WHERE uc.status = 'completed'
            AND uc.completed_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
            AND uc.completed_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
          GROUP BY uc.user_id
        ) monthly_challenges ON monthly_challenges.user_id = u.id
        LEFT JOIN (
          SELECT challenge_points.user_id, SUM(challenge_points.points) AS points
          FROM (
            SELECT fcr.participant_a_id AS user_id, fcr.participant_a_points AS points, fcr.completed_at
            FROM friend_challenge_results fcr
            UNION ALL
            SELECT fcr.participant_b_id AS user_id, fcr.participant_b_points AS points, fcr.completed_at
            FROM friend_challenge_results fcr
          ) challenge_points
          WHERE challenge_points.completed_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
            AND challenge_points.completed_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
          GROUP BY challenge_points.user_id
        ) monthly_friend_challenges ON monthly_friend_challenges.user_id = u.id
        WHERE ${scopeWhere}
        ORDER BY points DESC, u.id ASC
      `;
    } else {
      query = `
        SELECT
          u.id,
          u.name,
          u.gym_id,
          ${profileImageColumn} AS profile_picture,
          COALESCE(u.total_points, 0) AS points,
          COALESCE(u.total_points, 0) AS total_points
        FROM users u
        WHERE ${scopeWhere}
        ORDER BY points DESC, u.id ASC
      `;
    }

    const [rows] = await pool.execute(query, scopeParams);

    const leaderboard = rows.map((row, index) => ({
      id: Number(row.id),
      name: row.name || 'User',
      profile_picture: row.profile_picture || null,
      points: Number(row.points || 0),
      total_points: Number(row.total_points || 0),
      rank: index + 1,
    }));

    return res.json({ period, leaderboard });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// FRIENDS / INVITATIONS
// =========================

router.get('/user/:userId/gym-members', async (req, res) => {
  try {
    await ensureFriendshipInfrastructureOnce();

    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const profileImageColumn = await getProfileImageColumn();
    if (!profileImageColumn) {
      return res.status(500).json({ error: 'No profile image column found on users table' });
    }

    const [userRows] = await pool.execute('SELECT id, gym_id FROM users WHERE id = ?', [userId]);
    const user = userRows[0];
    if (!user || !user.gym_id) {
      return res.json({ members: [] });
    }

    const [members] = await pool.execute(
      `SELECT id, name, gym_id, ${profileImageColumn} AS profile_picture, total_points, total_workouts, \`rank\`,
              workout_split_preference, workout_split_label
       FROM users
       WHERE gym_id = ? AND id <> ? AND role = 'user' AND is_active = 1
       ORDER BY total_points DESC`,
      [user.gym_id, userId]
    );

    const memberIds = members
      .map((row) => Number(row.id || 0))
      .filter((id) => Number.isInteger(id) && id > 0);

    const friendshipByPair = new Map();
    if (memberIds.length > 0) {
      const placeholders = memberIds.map(() => '?').join(', ');
      const [friendships] = await pool.execute(
        `SELECT id, user_id, friend_id, status, initiated_by, accepted_at
         FROM friendships
         WHERE (user_id = ? AND friend_id IN (${placeholders}))
            OR (friend_id = ? AND user_id IN (${placeholders}))`,
        [userId, ...memberIds, userId, ...memberIds],
      );

      friendships.forEach((row) => {
        const key = getFriendPairMapKey(row.user_id, row.friend_id);
        if (!key) return;
        friendshipByPair.set(key, row);
      });
    }

    const enrichedMembers = members.map((member) => {
      const key = getFriendPairMapKey(userId, member.id);
      const friendship = key ? friendshipByPair.get(key) : null;
      const friendStatus = resolveFriendRelationshipStatus(friendship, userId);

      return {
        ...member,
        friend_status: friendStatus,
        friendship_id: friendship ? Number(friendship.id || 0) : null,
        can_view_profile: friendStatus === 'accepted',
      };
    });

    return res.json({ members: enrichedMembers });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/user/:userId/recent-activity', async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const [latestSessionRows] = await pool.execute(
      `SELECT
          DATE(created_at) AS workout_day,
          ROUND(
            SUM(
              CASE
                WHEN completed = 1 AND weight IS NOT NULL AND reps IS NOT NULL THEN (weight * reps)
                ELSE 0
              END
            ),
            2
          ) AS total_volume_kg
       FROM workout_sets
       WHERE user_id = ? AND completed = 1
       GROUP BY DATE(created_at)
       ORDER BY workout_day DESC
       LIMIT 1`,
      [userId],
    );

    if (!latestSessionRows.length || !latestSessionRows[0]?.workout_day) {
      return res.json({ activity: null });
    }

    const workoutDay = String(latestSessionRows[0].workout_day).slice(0, 10);

    const [exerciseRows] = await pool.execute(
      `SELECT
          exercise_name,
          ROUND(
            SUM(
              CASE
                WHEN weight IS NOT NULL AND reps IS NOT NULL THEN (weight * reps)
                ELSE 0
              END
            ),
            2
          ) AS exercise_volume_kg
       FROM workout_sets
       WHERE user_id = ? AND completed = 1 AND DATE(created_at) = ?
       GROUP BY exercise_name
       ORDER BY exercise_volume_kg DESC, exercise_name ASC
       LIMIT 1`,
      [userId, workoutDay],
    );

    const topExercise = String(exerciseRows[0]?.exercise_name || 'Workout Session').trim() || 'Workout Session';
    const totalVolumeKg = Number(latestSessionRows[0]?.total_volume_kg || 0);

    return res.json({
      activity: {
        title: topExercise,
        date: workoutDay,
        totalVolumeKg,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/friends/request', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.fromUserId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    await ensureFriendshipInfrastructureOnce();

    const fromUserId = toNumber(req.body?.fromUserId);
    const toUserId = toNumber(req.body?.toUserId);
    if (!fromUserId || fromUserId <= 0 || !toUserId || toUserId <= 0 || fromUserId === toUserId) {
      return res.status(400).json({ error: 'Valid fromUserId and toUserId are required' });
    }

    const orderedPair = getOrderedFriendPair(fromUserId, toUserId);
    if (!orderedPair) {
      return res.status(400).json({ error: 'Invalid friend pair' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [userRows] = await conn.execute(
      `SELECT id, name, gym_id, role, is_active
       FROM users
       WHERE id IN (?, ?)`,
      [fromUserId, toUserId],
    );
    if (userRows.length !== 2) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const sender = userRows.find((row) => Number(row.id) === Number(fromUserId));
    const target = userRows.find((row) => Number(row.id) === Number(toUserId));
    if (!sender || !target) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    if (Number(sender.gym_id || 0) <= 0 || Number(sender.gym_id || 0) !== Number(target.gym_id || 0)) {
      await conn.rollback();
      return res.status(403).json({ error: 'Friend requests are only allowed between members of the same gym' });
    }

    if (String(sender.role || '').toLowerCase() !== 'user' || String(target.role || '').toLowerCase() !== 'user') {
      await conn.rollback();
      return res.status(403).json({ error: 'Friend requests are available for users only' });
    }

    if (!Number(sender.is_active) || !Number(target.is_active)) {
      await conn.rollback();
      return res.status(403).json({ error: 'One of the users is not active' });
    }

    const [existingRows] = await conn.execute(
      `SELECT id, status, initiated_by
       FROM friendships
       WHERE user_id = ? AND friend_id = ?
       LIMIT 1`,
      [orderedPair.userId, orderedPair.friendId],
    );

    const senderName = String(sender.name || 'Someone').trim() || 'Someone';
    let friendshipId = 0;
    let createdOrReopened = false;

    if (existingRows.length) {
      const existing = existingRows[0];
      friendshipId = Number(existing.id || 0);
      const currentStatus = String(existing.status || '').trim().toLowerCase();
      const initiatedBy = Number(existing.initiated_by || 0);

      if (currentStatus === 'accepted') {
        await conn.rollback();
        return res.status(409).json({
          error: 'You are already friends',
          code: 'ALREADY_FRIENDS',
          friendshipId,
          status: 'accepted',
        });
      }

      if (currentStatus === 'pending') {
        if (initiatedBy === fromUserId) {
          await conn.commit();
          return res.json({
            success: true,
            friendshipId,
            status: 'outgoing_pending',
            alreadyPending: true,
          });
        }

        await conn.rollback();
        return res.status(409).json({
          error: 'This user already invited you. Accept or decline their request first.',
          code: 'INCOMING_REQUEST_EXISTS',
          friendshipId,
          status: 'incoming_pending',
        });
      }

      await conn.execute(
        `UPDATE friendships
         SET status = 'pending', initiated_by = ?, accepted_at = NULL
         WHERE id = ?`,
        [fromUserId, friendshipId],
      );
      createdOrReopened = true;
    } else {
      const [insertResult] = await conn.execute(
        `INSERT INTO friendships (user_id, friend_id, status, initiated_by, accepted_at)
         VALUES (?, ?, 'pending', ?, NULL)`,
        [orderedPair.userId, orderedPair.friendId, fromUserId],
      );
      friendshipId = Number(insertResult.insertId || 0);
      createdOrReopened = true;
    }

    if (createdOrReopened && friendshipId > 0) {
      await conn.execute(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES (?, 'friend_request', 'Friend Request', ?, JSON_OBJECT('friendshipId', ?, 'fromUserId', ?, 'requestType', 'friendship'))`,
        [toUserId, `${senderName} sent you a friend request`, friendshipId, fromUserId],
      );
    }

    await conn.commit();
    return res.json({
      success: true,
      friendshipId,
      status: 'outgoing_pending',
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/friends/respond', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    await ensureFriendshipInfrastructureOnce();

    const userId = toNumber(req.body?.userId);
    const friendshipId = toNumber(req.body?.friendshipId);
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!userId || userId <= 0 || !friendshipId || friendshipId <= 0) {
      return res.status(400).json({ error: 'Valid userId and friendshipId are required' });
    }
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: "Action must be 'accept' or 'decline'" });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [friendshipRows] = await conn.execute(
      `SELECT id, user_id, friend_id, status, initiated_by
       FROM friendships
       WHERE id = ?
       LIMIT 1`,
      [friendshipId],
    );
    if (!friendshipRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const friendship = friendshipRows[0];
    const userA = Number(friendship.user_id || 0);
    const userB = Number(friendship.friend_id || 0);
    const initiatedBy = Number(friendship.initiated_by || 0);
    const currentStatus = String(friendship.status || '').trim().toLowerCase();

    if (userId !== userA && userId !== userB) {
      await conn.rollback();
      return res.status(403).json({ error: 'You do not have permission to respond to this friend request' });
    }
    if (userId === initiatedBy) {
      await conn.rollback();
      return res.status(403).json({ error: 'Request sender cannot respond to their own friend request' });
    }
    if (currentStatus !== 'pending') {
      await conn.rollback();
      return res.status(409).json({ error: 'Friend request is no longer pending', status: currentStatus });
    }

    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    if (nextStatus === 'accepted') {
      await conn.execute(
        `UPDATE friendships
         SET status = 'accepted', accepted_at = NOW()
         WHERE id = ?`,
        [friendshipId],
      );
    } else {
      await conn.execute(
        `UPDATE friendships
         SET status = 'declined', accepted_at = NULL
         WHERE id = ?`,
        [friendshipId],
      );
    }

    const [requestNotificationRows] = await conn.execute(
      `SELECT id, data
       FROM notifications
       WHERE user_id = ? AND type = 'friend_request'`,
      [userId],
    );

    for (const notificationRow of requestNotificationRows) {
      const payload = safeParseJson(notificationRow.data, {});
      const payloadObject = payload && typeof payload === 'object' ? payload : {};
      const payloadFriendshipId = toNumber(payloadObject.friendshipId);
      const requestType = String(payloadObject.requestType || '').trim().toLowerCase();
      if (payloadFriendshipId !== friendshipId) continue;
      if (requestType && requestType !== 'friendship') continue;

      const updatedPayload = {
        ...payloadObject,
        friendshipId,
        requestType: requestType || 'friendship',
        responseStatus: nextStatus,
      };

      await conn.execute(
        `UPDATE notifications
         SET data = ?, is_read = 1, read_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(updatedPayload), Number(notificationRow.id || 0)],
      );
    }

    const requestSenderId = initiatedBy;
    const [actorRows] = await conn.execute(
      `SELECT id, name FROM users WHERE id IN (?, ?)`,
      [userId, requestSenderId],
    );
    const actor = actorRows.find((row) => Number(row.id || 0) === userId);
    const actorName = String(actor?.name || 'Someone').trim() || 'Someone';

    if (nextStatus === 'accepted') {
      await conn.execute(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES (?, 'friend_accept', 'Friend Request Accepted', ?, JSON_OBJECT('friendshipId', ?, 'byUserId', ?, 'requestType', 'friendship'))`,
        [requestSenderId, `${actorName} accepted your friend request`, friendshipId, userId],
      );
    }

    await conn.commit();
    return res.json({ success: true, friendshipId, status: nextStatus });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/invitations/send', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.fromUserId, { allowSelf: true }), async (req, res) => {
  try {
    await ensureFriendshipInfrastructureOnce();

    const fromUserId = toNumber(req.body?.fromUserId);
    const toUserId = toNumber(req.body?.toUserId);
    const date = String(req.body?.date || '').trim();
    const time = String(req.body?.time || '').trim();

    if (!fromUserId || !toUserId || !date || !time || fromUserId === toUserId) {
      return res.status(400).json({ error: 'fromUserId, toUserId, date and time are required' });
    }

    const orderedPair = getOrderedFriendPair(fromUserId, toUserId);
    if (!orderedPair) {
      return res.status(400).json({ error: 'Invalid friend pair' });
    }

    const [friendshipRows] = await pool.execute(
      `SELECT status
       FROM friendships
       WHERE user_id = ? AND friend_id = ?
       LIMIT 1`,
      [orderedPair.userId, orderedPair.friendId],
    );
    const friendshipStatus = String(friendshipRows[0]?.status || '').trim().toLowerCase();
    if (friendshipStatus !== 'accepted') {
      return res.status(403).json({ error: 'Session invitations are available only between accepted friends' });
    }

    const [result] = await pool.execute(
      `INSERT INTO invitations (from_user_id, to_user_id, invitation_type, workout_date, workout_time, status)
       VALUES (?, ?, 'workout', ?, ?, 'pending')`,
      [fromUserId, toUserId, date, time]
    );

    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'friend_request', 'Workout Invitation', ?, JSON_OBJECT('invitationId', ?, 'fromUserId', ?, 'date', ?, 'time', ?))`,
      [toUserId, 'You received a workout invitation', result.insertId, fromUserId, date, time]
    );

    return res.json({ success: true, invitationId: result.insertId });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/friend-challenges/invite', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    await ensureFriendshipInfrastructureOnce();
    await ensureChallengeNotificationTypesOnce();
    await ensureFriendChallengeInfrastructureOnce();

    const userId = toNumber(req.body?.userId);
    const friendId = toNumber(req.body?.friendId);
    const challengeKey = normalizeChallengeInviteKey(req.body?.challengeKey);
    const challengeTitleRaw = String(req.body?.challengeTitle || '').trim();
    const challengeTitle = challengeTitleRaw || defaultChallengeInviteTitle(challengeKey);

    if (!userId || userId <= 0 || !friendId || friendId <= 0 || userId === friendId) {
      return res.status(400).json({ error: 'Valid userId and friendId are required' });
    }
    if (!challengeKey) {
      return res.status(400).json({ error: 'challengeKey is required' });
    }

    const friendship = await getAcceptedFriendship(userId, friendId);
    if (!friendship) {
      return res.status(403).json({ error: 'Friend challenges are available only between accepted friends' });
    }

    const [senderRows] = await pool.execute(
      `SELECT id, name
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );
    const senderName = String(senderRows[0]?.name || 'Someone').trim() || 'Someone';

    const [notificationRows] = await pool.execute(
      `SELECT id, data, created_at
       FROM notifications
       WHERE user_id = ?
         AND type = 'friend_challenge_invite'
       ORDER BY created_at DESC
       LIMIT 50`,
      [friendId],
    );

    for (const notificationRow of notificationRows) {
      const payload = safeParseJson(notificationRow.data, {});
      const payloadObject = payload && typeof payload === 'object' ? payload : {};
      if (toNumber(payloadObject.senderUserId) !== userId) continue;
      if (normalizeChallengeInviteKey(payloadObject.challengeKey) !== challengeKey) continue;
      if (getChallengeInviteStatus(payloadObject) !== 'pending') continue;
      if (hasChallengeInviteExpired(notificationRow.created_at)) {
        await expireFriendChallengeInviteNotification(pool, notificationRow);
        continue;
      }

      return res.json({
        success: true,
        alreadyPending: true,
        notificationId: Number(notificationRow.id || 0),
        challengeKey,
        challengeTitle,
      });
    }

    const payload = {
      senderUserId: userId,
      senderName,
      challengeKey,
      challengeTitle,
      responseStatus: 'pending',
      challengeFlow: 'sender_device',
    };

    const [insertResult] = await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES (?, 'friend_challenge_invite', 'New Challenge', ?, ?)`,
      [friendId, `${senderName} challenged you to ${challengeTitle}`, JSON.stringify(payload)],
    );

    return res.json({
      success: true,
      notificationId: Number(insertResult?.insertId || 0),
      challengeKey,
      challengeTitle,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/friend-challenges/respond', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    await ensureChallengeNotificationTypesOnce();
    await ensureFriendChallengeInfrastructureOnce();

    const userId = toNumber(req.body?.userId);
    const notificationId = toNumber(req.body?.notificationId);
    const action = String(req.body?.action || '').trim().toLowerCase();

    if (!userId || userId <= 0 || !notificationId || notificationId <= 0) {
      return res.status(400).json({ error: 'Valid userId and notificationId are required' });
    }
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or decline' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [notificationRows] = await conn.execute(
      `SELECT id, user_id, data, created_at
       FROM notifications
       WHERE id = ?
         AND user_id = ?
         AND type = 'friend_challenge_invite'
       LIMIT 1
       FOR UPDATE`,
      [notificationId, userId],
    );

    if (!notificationRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Challenge invite not found' });
    }

    const payload = safeParseJson(notificationRows[0].data, {});
    const payloadObject = payload && typeof payload === 'object' ? payload : {};
    if (hasChallengeInviteExpired(notificationRows[0].created_at)) {
      const expiredResult = await expireFriendChallengeInviteNotification(conn, notificationRows[0]);
      await conn.commit();
      return res.status(409).json({
        error: 'Challenge invite expired',
        status: expiredResult.status,
        sessionId: expiredResult.sessionId,
      });
    }
    const currentStatus = getChallengeInviteStatus(payloadObject);
    if (currentStatus !== 'pending') {
      await conn.rollback();
      return res.status(409).json({
        error: 'Challenge invite is no longer pending',
        status: currentStatus,
        sessionId: toNumber(payloadObject.sessionId) || null,
      });
    }

    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    const challengeKey = normalizeChallengeInviteKey(payloadObject.challengeKey);
    const challengeTitle = String(payloadObject.challengeTitle || defaultChallengeInviteTitle(payloadObject.challengeKey)).trim() || 'Challenge';
    const senderUserId = toNumber(payloadObject.senderUserId);
    let sessionId = toNumber(payloadObject.sessionId) || null;
    let clientMatchId = String(payloadObject.clientMatchId || '').trim();

    if (nextStatus === 'accepted') {
      const [sessionRows] = await conn.execute(
        `SELECT id, client_match_id
         FROM friend_challenge_sessions
         WHERE invitation_notification_id = ?
         LIMIT 1
         FOR UPDATE`,
        [notificationId],
      );

      if (sessionRows.length) {
        sessionId = Number(sessionRows[0].id || 0) || sessionId;
        clientMatchId = String(sessionRows[0].client_match_id || '').trim() || clientMatchId;
        await conn.execute(
          `UPDATE friend_challenge_sessions
           SET status = 'active', winner_user_id = NULL, completed_at = NULL
           WHERE id = ?`,
          [sessionId],
        );
      } else {
        clientMatchId = clientMatchId || createChallengeSessionClientMatchId(challengeKey);
        const [sessionInsertResult] = await conn.execute(
          `INSERT INTO friend_challenge_sessions
             (challenge_key, sender_user_id, receiver_user_id, invitation_notification_id, status, client_match_id, rounds_json, metadata_json)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
          [
            challengeKey,
            senderUserId,
            userId,
            notificationId,
            clientMatchId,
            JSON.stringify(createChallengeSessionRounds(challengeKey)),
            JSON.stringify({
              createdFrom: 'invite_accept',
              challengeFlow: 'both_devices_turn_based',
            }),
          ],
        );
        sessionId = Number(sessionInsertResult?.insertId || 0) || null;
      }
    }

    const updatedPayload = {
      ...payloadObject,
      responseStatus: nextStatus,
      actedAt: new Date().toISOString(),
      sessionId,
      clientMatchId: clientMatchId || undefined,
    };

    await conn.execute(
      `UPDATE notifications
       SET data = ?, is_read = 1, read_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(updatedPayload), notificationId],
    );

    if (senderUserId) {
      const [actorRows] = await pool.execute(
        `SELECT name
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId],
      );
      const actorName = String(actorRows[0]?.name || 'Someone').trim() || 'Someone';
      const responseTitle = nextStatus === 'accepted' ? 'Challenge Accepted' : 'Challenge Declined';
      const responseMessage = nextStatus === 'accepted'
        ? `${actorName} accepted your ${challengeTitle} challenge`
        : `${actorName} declined your ${challengeTitle} challenge`;
      const responsePayload = {
        challengeKey,
        challengeTitle,
        responseStatus: nextStatus,
        byUserId: userId,
        byUserName: actorName,
        receiverNotificationId: notificationId,
        sessionId,
        clientMatchId: clientMatchId || undefined,
      };

      await conn.execute(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES (?, 'friend_challenge_response', ?, ?, ?)`,
        [senderUserId, responseTitle, responseMessage, JSON.stringify(responsePayload)],
      );
    }

    await conn.commit();

    return res.json({
      success: true,
      notificationId,
      status: nextStatus,
      challengeKey,
      challengeTitle,
      senderUserId,
      senderName: String(payloadObject.senderName || 'Someone').trim() || 'Someone',
      sessionId,
      clientMatchId: clientMatchId || null,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/friend-challenges/session/:sessionId', requireAuth('user'), requireUserAccess((req) => req.query?.userId, { allowSelf: true }), async (req, res) => {
  try {
    await ensureFriendChallengeInfrastructureOnce();

    const userId = toNumber(req.query?.userId);
    const sessionId = toNumber(req.params.sessionId);
    if (!userId || userId <= 0 || !sessionId || sessionId <= 0) {
      return res.status(400).json({ error: 'Valid userId and sessionId are required' });
    }

    const [sessionRows] = await pool.execute(
      `SELECT id, challenge_key, sender_user_id, receiver_user_id, invitation_notification_id, status, winner_user_id, client_match_id, rounds_json, metadata_json, completed_at, updated_at
       FROM friend_challenge_sessions
       WHERE id = ?
       LIMIT 1`,
      [sessionId],
    );

    if (!sessionRows.length) {
      return res.status(404).json({ error: 'Challenge session not found' });
    }

    const sessionRow = sessionRows[0];
    if (!getChallengeSessionPlayerRole(sessionRow, userId)) {
      return res.status(403).json({ error: 'You do not have access to this challenge session' });
    }

    return res.json({
      success: true,
      session: buildFriendChallengeSessionResponse(sessionRow),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/friend-challenges/session/submit-turn', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    await ensureFriendChallengeInfrastructureOnce();

    const userId = toNumber(req.body?.userId);
    const sessionId = toNumber(req.body?.sessionId);
    const reps = Number.parseInt(req.body?.reps, 10);
    if (!userId || userId <= 0 || !sessionId || sessionId <= 0) {
      return res.status(400).json({ error: 'Valid userId and sessionId are required' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [sessionRows] = await conn.execute(
      `SELECT id, challenge_key, sender_user_id, receiver_user_id, invitation_notification_id, status, winner_user_id, client_match_id, rounds_json, metadata_json, completed_at, updated_at
       FROM friend_challenge_sessions
       WHERE id = ?
       FOR UPDATE`,
      [sessionId],
    );

    if (!sessionRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Challenge session not found' });
    }

    const sessionRow = sessionRows[0];
    const challengeKey = normalizeChallengeInviteKey(sessionRow.challenge_key) || 'push_up_duel';
    if (!isStrengthChallengeKey(challengeKey) && (!Number.isInteger(reps) || reps < 0)) {
      await conn.rollback();
      return res.status(400).json({ error: 'reps must be a non-negative integer' });
    }
    const playerRole = getChallengeSessionPlayerRole(sessionRow, userId);
    if (!playerRole) {
      await conn.rollback();
      return res.status(403).json({ error: 'You do not have access to this challenge session' });
    }
    const sessionStatus = String(sessionRow.status || '').trim().toLowerCase();
    if (sessionStatus === 'completed') {
      await conn.rollback();
      return res.status(409).json({ error: 'This challenge is already finished' });
    }
    if (sessionStatus !== 'active') {
      await conn.rollback();
      return res.status(409).json({ error: 'This challenge is no longer active' });
    }

    const rounds = normalizeChallengeRounds(parseChallengeJson(sessionRow.rounds_json, []), challengeKey);
    const activeRound = getChallengeSessionActiveRound(rounds, challengeKey);
    if (!activeRound || activeRound.status === 'complete') {
      await conn.rollback();
      return res.status(409).json({ error: 'The current round is already complete' });
    }
    if (activeRound.status !== playerRole) {
      await conn.rollback();
      return res.status(409).json({ error: 'It is not your turn to count right now' });
    }

    if (isStrengthChallengeKey(challengeKey)) {
      const outcome = normalizeStrengthChallengeResult(req.body?.outcome);
      if (!['made', 'missed'].includes(outcome)) {
        await conn.rollback();
        return res.status(400).json({ error: 'outcome must be made or missed' });
      }

      if (playerRole === 'player1') {
        const weightKg = Math.max(0, Number.parseFloat(req.body?.weightKg) || 0);
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
          await conn.rollback();
          return res.status(400).json({ error: 'weightKg must be greater than 0' });
        }
        activeRound.weightKg = weightKg;
      } else if (!(Number(activeRound.weightKg || 0) > 0)) {
        await conn.rollback();
        return res.status(409).json({ error: 'The challenge sender must set the round weight first' });
      }

      activeRound[playerRole === 'player1' ? 'player1Result' : 'player2Result'] = outcome;
      activeRound.status = playerRole === 'player1' ? 'player2' : 'complete';
    } else {
      activeRound[playerRole] = reps;
      activeRound.status = playerRole === 'player1' ? 'player2' : 'complete';
    }

    await conn.execute(
      `UPDATE friend_challenge_sessions
       SET status = 'active', rounds_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(rounds), sessionId],
    );

    await conn.commit();

    return res.json({
      success: true,
      session: buildFriendChallengeSessionResponse({
        ...sessionRow,
        status: 'active',
        rounds_json: JSON.stringify(rounds),
      }),
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/friend-challenges/session/add-round', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    await ensureFriendChallengeInfrastructureOnce();

    const userId = toNumber(req.body?.userId);
    const sessionId = toNumber(req.body?.sessionId);
    if (!userId || userId <= 0 || !sessionId || sessionId <= 0) {
      return res.status(400).json({ error: 'Valid userId and sessionId are required' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [sessionRows] = await conn.execute(
      `SELECT id, challenge_key, sender_user_id, receiver_user_id, invitation_notification_id, status, winner_user_id, client_match_id, rounds_json, metadata_json, completed_at, updated_at
       FROM friend_challenge_sessions
       WHERE id = ?
       FOR UPDATE`,
      [sessionId],
    );

    if (!sessionRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Challenge session not found' });
    }

    const sessionRow = sessionRows[0];
    const challengeKey = normalizeChallengeInviteKey(sessionRow.challenge_key) || 'push_up_duel';
    if (Number(sessionRow.sender_user_id || 0) !== userId) {
      await conn.rollback();
      return res.status(403).json({ error: 'Only the challenge sender can add a new round' });
    }
    const sessionStatus = String(sessionRow.status || '').trim().toLowerCase();
    if (sessionStatus === 'completed') {
      await conn.rollback();
      return res.status(409).json({ error: 'This challenge is already finished' });
    }
    if (sessionStatus !== 'active') {
      await conn.rollback();
      return res.status(409).json({ error: 'This challenge is no longer active' });
    }

    const rounds = normalizeChallengeRounds(parseChallengeJson(sessionRow.rounds_json, []), challengeKey);
    const activeRound = getChallengeSessionActiveRound(rounds, challengeKey);
    if (!activeRound || activeRound.status !== 'complete') {
      await conn.rollback();
      return res.status(409).json({ error: 'Finish the current round before adding a new one' });
    }

    rounds.push(
      isStrengthChallengeKey(challengeKey)
        ? createStrengthChallengeRound(rounds.length + 1)
        : createRepChallengeRound(rounds.length + 1),
    );

    await conn.execute(
      `UPDATE friend_challenge_sessions
       SET status = 'active', winner_user_id = NULL, completed_at = NULL, rounds_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(rounds), sessionId],
    );

    await conn.commit();

    return res.json({
      success: true,
      session: buildFriendChallengeSessionResponse({
        ...sessionRow,
        status: 'active',
        winner_user_id: null,
        completed_at: null,
        rounds_json: JSON.stringify(rounds),
      }),
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/friend-challenges/session/leave', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    await ensureFriendChallengeInfrastructureOnce();

    const userId = toNumber(req.body?.userId);
    const sessionId = toNumber(req.body?.sessionId);
    if (!userId || userId <= 0 || !sessionId || sessionId <= 0) {
      return res.status(400).json({ error: 'Valid userId and sessionId are required' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [sessionRows] = await conn.execute(
      `SELECT id, challenge_key, sender_user_id, receiver_user_id, invitation_notification_id, status, winner_user_id, client_match_id, rounds_json, metadata_json, completed_at, updated_at
       FROM friend_challenge_sessions
       WHERE id = ?
       FOR UPDATE`,
      [sessionId],
    );

    if (!sessionRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Challenge session not found' });
    }

    const sessionRow = sessionRows[0];
    if (!getChallengeSessionPlayerRole(sessionRow, userId)) {
      await conn.rollback();
      return res.status(403).json({ error: 'You do not have access to this challenge session' });
    }

    const sessionStatus = String(sessionRow.status || '').trim().toLowerCase();
    if (sessionStatus === 'completed') {
      await conn.rollback();
      return res.status(409).json({ error: 'This challenge is already finished' });
    }

    const metadata = parseChallengeJson(sessionRow.metadata_json, {});
    const normalizedMetadata = metadata && typeof metadata === 'object' ? metadata : {};

    if (sessionStatus === 'abandoned') {
      await conn.rollback();
      return res.json({
        success: true,
        alreadyAbandoned: true,
        session: buildFriendChallengeSessionResponse({
          ...sessionRow,
          metadata_json: JSON.stringify(normalizedMetadata),
        }),
      });
    }

    const [actorRows] = await conn.execute(
      `SELECT name
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );
    const actorName = String(actorRows[0]?.name || 'Someone').trim() || 'Someone';
    const abandonedAt = new Date().toISOString();
    const nextMetadata = {
      ...normalizedMetadata,
      abandonedByUserId: userId,
      abandonedByUserName: actorName,
      abandonedAt,
      challengeClosedWithoutWinner: true,
    };

    await conn.execute(
      `UPDATE friend_challenge_sessions
       SET status = 'abandoned',
           winner_user_id = NULL,
           metadata_json = ?,
           completed_at = NOW(),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(nextMetadata), sessionId],
    );

    await conn.commit();

    return res.json({
      success: true,
      session: buildFriendChallengeSessionResponse({
        ...sessionRow,
        status: 'abandoned',
        winner_user_id: null,
        metadata_json: JSON.stringify(nextMetadata),
        completed_at: abandonedAt,
      }),
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/friends/:viewerId/:friendId/plan-preview', requireAuth('user'), requireUserAccess('viewerId', { allowSelf: true }), async (req, res) => {
  try {
    const viewerId = toNumber(req.params.viewerId);
    const friendId = toNumber(req.params.friendId);
    if (!viewerId || viewerId <= 0 || !friendId || friendId <= 0) {
      return res.status(400).json({ error: 'Invalid viewerId or friendId' });
    }

    const friendship = await getAcceptedFriendship(viewerId, friendId);
    if (!friendship) {
      return res.status(403).json({ error: 'Friend plan preview is available only for accepted friends' });
    }

    const [profileRows] = await pool.execute(
      `SELECT
          id,
          name,
          workout_split_preference,
          workout_split_label
       FROM users
       WHERE id = ? AND role = 'user'
       LIMIT 1`,
      [friendId],
    );

    if (!profileRows.length) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    const profile = profileRows[0];

    const [assignmentRows] = await pool.execute(
      `SELECT pa.id, pa.program_id, pa.start_date, pa.next_rotation_date, pa.rotation_weeks,
              p.name, p.program_type, p.goal, p.days_per_week, p.cycle_weeks
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [friendId],
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.json({
        id: null,
        assignmentId: null,
        name: '',
        friendName: profile.name || '',
        currentWeek: 1,
        totalWeeks: 0,
        workouts: [],
        currentWeekWorkouts: [],
        splitPreference: profile.workout_split_preference || '',
        splitLabel: profile.workout_split_label || '',
      });
    }

    const [workoutRows] = await pool.execute(
      `SELECT id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes
       FROM workouts
       WHERE program_id = ?
       ORDER BY day_order ASC`,
      [assignment.program_id],
    );

    const [exerciseRows] = await pool.execute(
      `SELECT
          we.id AS workout_exercise_id,
          we.workout_id,
          we.order_index,
          we.exercise_name_snapshot,
          we.muscle_group_snapshot,
          we.target_sets,
          we.target_reps,
          we.target_weight,
          we.rest_seconds,
          we.tempo,
          we.rpe_target,
          we.notes
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       WHERE w.program_id = ?
       ORDER BY we.workout_id, we.order_index`,
      [assignment.program_id],
    );

    const exercisesByWorkout = new Map();
    exerciseRows.forEach((row) => {
      if (!exercisesByWorkout.has(row.workout_id)) exercisesByWorkout.set(row.workout_id, []);
      exercisesByWorkout.get(row.workout_id).push({
        id: Number(row.workout_exercise_id || 0) || null,
        exerciseName: row.exercise_name_snapshot,
        targetMuscles: parseMuscleGroups(row.muscle_group_snapshot),
        muscleGroup: parseMuscleGroups(row.muscle_group_snapshot)[0] || null,
        sets: row.target_sets,
        reps: row.target_reps,
        targetWeight: row.target_weight,
        rest: row.rest_seconds,
        tempo: row.tempo,
        rpeTarget: row.rpe_target,
        notes: row.notes,
      });
    });

    const workouts = normalizeProgramWorkouts(workoutRows.map((w) => ({
      id: w.id,
      workout_name: w.workout_name,
      workout_type: w.workout_type,
      day_order: w.day_order,
      day_name: w.day_name,
      estimated_duration_minutes: w.estimated_duration_minutes,
      notes: w.notes,
      exercises: JSON.stringify(exercisesByWorkout.get(w.id) || []),
    })), assignment.days_per_week);

    const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
    const workoutsPerWeek = Math.max(1, Number(assignment.days_per_week || 1));
    const currentWeekStartDayOrder = ((currentWeek - 1) * workoutsPerWeek) + 1;
    const currentWeekEndDayOrder = currentWeekStartDayOrder + workoutsPerWeek - 1;

    const currentWeekWorkouts = workouts.filter((w) => {
      const dayOrder = Number(w.day_order || 0);
      return dayOrder >= currentWeekStartDayOrder && dayOrder <= currentWeekEndDayOrder;
    });

    return res.json({
      id: assignment.program_id,
      assignmentId: assignment.id,
      name: assignment.name,
      friendName: profile.name || '',
      programType: assignment.program_type,
      goal: assignment.goal,
      daysPerWeek: Number(assignment.days_per_week || 0),
      currentWeek,
      totalWeeks: assignment.cycle_weeks,
      rotationWeeks: assignment.rotation_weeks,
      nextRotationDate: assignment.next_rotation_date,
      workouts,
      currentWeekWorkouts,
      splitPreference: profile.workout_split_preference || '',
      splitLabel: profile.workout_split_label || '',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/friends/:viewerId/:friendId/challenge-win-stats', requireAuth('user'), requireUserAccess('viewerId', { allowSelf: true }), async (req, res) => {
  try {
    const viewerId = toNumber(req.params.viewerId);
    const friendId = toNumber(req.params.friendId);
    if (!viewerId || viewerId <= 0 || !friendId || friendId <= 0) {
      return res.status(400).json({ error: 'Invalid viewerId or friendId' });
    }

    const friendship = await getAcceptedFriendship(viewerId, friendId);
    if (!friendship) {
      return res.status(403).json({ error: 'Friend challenge stats are available only for accepted friends' });
    }

    const supportedChallengeKeys = ['push_up_duel', 'squat_rep_race', 'bench_press', 'deadlift_one'];
    const stats = {
      push_up_duel: 0,
      squat_rep_race: 0,
      bench_press: 0,
      deadlift_one: 0,
    };

    const [rows] = await pool.execute(
      `SELECT challenge_key, COUNT(*) AS win_count
       FROM friend_challenge_results
       WHERE winner_user_id = ?
         AND challenge_key IN (?, ?, ?, ?)
       GROUP BY challenge_key`,
      [friendId, ...supportedChallengeKeys],
    );

    rows.forEach((row) => {
      const challengeKey = normalizeChallengeInviteKey(row.challenge_key);
      if (!Object.prototype.hasOwnProperty.call(stats, challengeKey)) return;
      stats[challengeKey] = Number(row.win_count || 0);
    });

    return res.json({
      success: true,
      userId: friendId,
      stats,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/friend-challenges/complete', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    await ensureFriendshipInfrastructureOnce();
    await ensureFriendChallengeInfrastructureOnce();
    await gamificationReady;

    const userId = toNumber(req.body?.userId);
    const friendId = toNumber(req.body?.friendId);
    const winnerUserId = toNumber(req.body?.winnerUserId);
    const sessionId = toNumber(req.body?.sessionId);
    const challengeKey = String(req.body?.challengeKey || '').trim().toLowerCase();
    let clientMatchId = String(req.body?.clientMatchId || '').trim();
    let rounds = Array.isArray(req.body?.rounds) ? req.body.rounds : [];

    if (!userId || userId <= 0 || !friendId || friendId <= 0 || userId === friendId) {
      return res.status(400).json({ error: 'Valid userId and friendId are required' });
    }
    if (!winnerUserId || ![userId, friendId].includes(winnerUserId)) {
      return res.status(400).json({ error: 'winnerUserId must match one of the challenge participants' });
    }
    if (challengeKey && !['push_up_duel', 'squat_rep_race', 'bench_press', 'deadlift_one'].includes(challengeKey)) {
      return res.status(400).json({ error: 'Unsupported challenge key' });
    }

    const friendship = await getAcceptedFriendship(userId, friendId);
    if (!friendship) {
      return res.status(403).json({ error: 'Friend challenges are available only between accepted friends' });
    }

    const pair = getOrderedFriendPair(userId, friendId);
    if (!pair) {
      return res.status(400).json({ error: 'Invalid friend pair' });
    }

    let resolvedChallengeKey = challengeKey || 'push_up_duel';

    if (sessionId) {
      const [sessionRows] = await pool.execute(
        `SELECT id, challenge_key, sender_user_id, receiver_user_id, status, winner_user_id, client_match_id, rounds_json
         FROM friend_challenge_sessions
         WHERE id = ?
         LIMIT 1`,
        [sessionId],
      );

      if (!sessionRows.length) {
        return res.status(404).json({ error: 'Challenge session not found' });
      }

      const sessionRow = sessionRows[0];
      if (Number(sessionRow.sender_user_id || 0) !== userId) {
        return res.status(403).json({ error: 'Only the challenge sender can finish this challenge' });
      }
      if (Number(sessionRow.receiver_user_id || 0) !== friendId) {
        return res.status(400).json({ error: 'friendId does not match this challenge session' });
      }
      const sessionStatus = String(sessionRow.status || '').trim().toLowerCase();
      if (sessionStatus === 'abandoned') {
        return res.status(409).json({ error: 'This challenge was cancelled because a player left early' });
      }
      if (sessionStatus !== 'active' && sessionStatus !== 'completed') {
        return res.status(409).json({ error: 'This challenge is no longer active' });
      }

      rounds = normalizeChallengeRounds(parseChallengeJson(sessionRow.rounds_json, []), sessionRow.challenge_key);
      const activeRound = getChallengeSessionActiveRound(rounds, sessionRow.challenge_key);
      if (!activeRound || activeRound.status !== 'complete') {
        return res.status(409).json({ error: 'Finish the current round before ending the challenge' });
      }

      const sessionWinner = getChallengeSessionWinner(rounds, sessionRow.challenge_key);
      if (!sessionWinner) {
        return res.status(409).json({ error: 'This challenge is tied. Add another round to decide the winner.' });
      }

      const expectedWinnerUserId = sessionWinner === 'player1'
        ? Number(sessionRow.sender_user_id || 0)
        : Number(sessionRow.receiver_user_id || 0);
      if (winnerUserId !== expectedWinnerUserId) {
        return res.status(409).json({ error: 'winnerUserId does not match the session winner' });
      }

      clientMatchId = String(sessionRow.client_match_id || '').trim();
      resolvedChallengeKey = normalizeChallengeInviteKey(sessionRow.challenge_key) || 'push_up_duel';
    }

    if (!['push_up_duel', 'squat_rep_race', 'bench_press', 'deadlift_one'].includes(resolvedChallengeKey)) {
      return res.status(400).json({ error: 'Unsupported challenge key' });
    }
    if (!clientMatchId || clientMatchId.length > 120) {
      return res.status(400).json({ error: 'clientMatchId is required' });
    }

    const loserUserId = winnerUserId === userId ? friendId : userId;
    rounds = normalizeChallengeRounds(rounds, resolvedChallengeKey);
    const pointsByRole = getFriendChallengePointsByRole(rounds, resolvedChallengeKey);
    const senderIsParticipantA = pair.userId === userId;
    const participantAPoints = senderIsParticipantA ? pointsByRole.player1 : pointsByRole.player2;
    const participantBPoints = senderIsParticipantA ? pointsByRole.player2 : pointsByRole.player1;
    const totalPointsAwarded = participantAPoints + participantBPoints;
    const decidingRound = [...rounds]
      .reverse()
      .find((round) => round.status === 'complete' && getChallengeRoundWinner(round, resolvedChallengeKey) !== 'tie') || null;
    const metadataJson = JSON.stringify({
      challengeMode: isStrengthChallengeKey(resolvedChallengeKey) ? 'weight' : 'reps',
      rounds,
      decidingWeightKg: Number(decidingRound?.weightKg || 0),
      pointsByUser: {
        [pair.userId]: participantAPoints,
        [pair.friendId]: participantBPoints,
      },
      sessionId: sessionId || null,
      submittedAt: new Date().toISOString(),
    });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existingRows] = await conn.execute(
      `SELECT id, winner_user_id, points_reward, participant_a_points, participant_b_points
       FROM friend_challenge_results
       WHERE challenge_key = ?
         AND participant_a_id = ?
         AND participant_b_id = ?
         AND client_match_id = ?
       LIMIT 1`,
      [resolvedChallengeKey, pair.userId, pair.friendId, clientMatchId],
    );

    if (existingRows.length) {
      if (sessionId) {
        await conn.execute(
          `UPDATE friend_challenge_sessions
           SET status = 'completed', winner_user_id = ?, completed_at = COALESCE(completed_at, NOW())
           WHERE id = ?`,
          [Number(existingRows[0].winner_user_id || 0) || winnerUserId, sessionId],
        );
      }
      await conn.commit();
      return res.json({
        success: true,
        alreadyRecorded: true,
        winnerUserId: Number(existingRows[0].winner_user_id || 0),
        pointsAwarded: Number(existingRows[0].points_reward || 0),
        participantPoints: {
          [pair.userId]: Number(existingRows[0].participant_a_points || 0),
          [pair.friendId]: Number(existingRows[0].participant_b_points || 0),
        },
      });
    }

    await conn.execute(
      `INSERT INTO friend_challenge_results
         (challenge_key, participant_a_id, participant_b_id, participant_a_points, participant_b_points, submitted_by_user_id, winner_user_id, loser_user_id, points_reward, client_match_id, metadata_json, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [resolvedChallengeKey, pair.userId, pair.friendId, participantAPoints, participantBPoints, userId, winnerUserId, loserUserId, totalPointsAwarded, clientMatchId, metadataJson],
    );

    if (sessionId) {
      await conn.execute(
        `UPDATE friend_challenge_sessions
         SET status = 'completed', winner_user_id = ?, completed_at = NOW()
         WHERE id = ?`,
        [winnerUserId, sessionId],
      );
    }

    await conn.commit();

    const participantIds = [pair.userId, pair.friendId];
    const [participantASummary, participantBSummary] = await Promise.all([
      refreshGamificationForUser(pair.userId),
      refreshGamificationForUser(pair.friendId),
    ]);
    const [participantRows] = await pool.execute(
      `SELECT id, COALESCE(total_points, 0) AS total_points, COALESCE(\`rank\`, 'Bronze') AS \`rank\`
       FROM users
       WHERE id IN (?, ?)`,
      participantIds,
    );
    const participantRowMap = new Map(
      participantRows.map((row) => [
        Number(row.id || 0),
        {
          totalPoints: Number(row.total_points || 0),
          rank: String(row.rank || 'Bronze'),
        },
      ]),
    );
    const participantSummaryMap = new Map([
      [pair.userId, participantASummary],
      [pair.friendId, participantBSummary],
    ]);

    const buildParticipantSummary = (participantId, pointsAwarded) => {
      const refreshed = participantSummaryMap.get(participantId);
      const row = participantRowMap.get(participantId) || {};
      return {
        userId: participantId,
        pointsAwarded,
        totalPoints: Number(refreshed?.totalPoints || row.totalPoints || 0),
        rank: String(refreshed?.rank || row.rank || 'Bronze'),
      };
    };

    const winnerSummary = buildParticipantSummary(winnerUserId, winnerUserId === pair.userId ? participantAPoints : participantBPoints);
    const loserSummary = buildParticipantSummary(loserUserId, loserUserId === pair.userId ? participantAPoints : participantBPoints);

    return res.json({
      success: true,
      challengeKey: resolvedChallengeKey,
      winnerUserId,
      loserUserId,
      pointsAwarded: totalPointsAwarded,
      participantPoints: {
        [pair.userId]: participantAPoints,
        [pair.friendId]: participantBPoints,
      },
      winner: winnerSummary,
      loser: loserSummary,
      participants: {
        [pair.userId]: buildParticipantSummary(pair.userId, participantAPoints),
        [pair.friendId]: buildParticipantSummary(pair.friendId, participantBPoints),
      },
    });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

// =========================
// PROGRAMS
// =========================

router.get('/user/:userId/program', async (req, res) => {
  try {
    const { userId } = req.params;

    const [assignmentRows] = await pool.execute(
      `SELECT pa.id, pa.program_id, pa.start_date, pa.next_rotation_date, pa.rotation_weeks,
              p.name, p.program_type, p.goal, p.days_per_week, p.cycle_weeks
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [userId]
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.json({
        id: null,
        name: 'No Program Assigned',
        currentWeek: 1,
        totalWeeks: 0,
        todayWorkout: null,
        workouts: [],
      });
    }

    const [workoutRows] = await pool.execute(
      `SELECT id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes
       FROM workouts
       WHERE program_id = ?
       ORDER BY day_order ASC`,
      [assignment.program_id]
    );

    const [exerciseRows] = await pool.execute(
      `SELECT
          we.id AS workout_exercise_id,
          we.workout_id,
          we.order_index,
          we.exercise_name_snapshot,
          we.muscle_group_snapshot,
          we.target_sets,
          we.target_reps,
          we.target_weight,
          we.rest_seconds,
          we.tempo,
          we.rpe_target,
          we.notes
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       WHERE w.program_id = ?
       ORDER BY we.workout_id, we.order_index`,
      [assignment.program_id]
    );

    const exercisesByWorkout = new Map();
    exerciseRows.forEach((row) => {
      if (!exercisesByWorkout.has(row.workout_id)) exercisesByWorkout.set(row.workout_id, []);
      exercisesByWorkout.get(row.workout_id).push({
        id: Number(row.workout_exercise_id || 0) || null,
        exerciseName: row.exercise_name_snapshot,
        targetMuscles: parseMuscleGroups(row.muscle_group_snapshot),
        muscleGroup: parseMuscleGroups(row.muscle_group_snapshot)[0] || null,
        sets: row.target_sets,
        reps: row.target_reps,
        targetWeight: row.target_weight,
        rest: row.rest_seconds,
        tempo: row.tempo,
        rpeTarget: row.rpe_target,
        notes: row.notes,
      });
    });

    const workouts = normalizeProgramWorkouts(workoutRows.map((w) => ({
      id: w.id,
      workout_name: w.workout_name,
      workout_type: w.workout_type,
      day_order: w.day_order,
      day_name: w.day_name,
      estimated_duration_minutes: w.estimated_duration_minutes,
      notes: w.notes,
      exercises: JSON.stringify(exercisesByWorkout.get(w.id) || []),
    })), assignment.days_per_week);

    const now = new Date();
    const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);

    const workoutsPerWeek = Math.max(1, Number(assignment.days_per_week || 1));
    const currentWeekStartDayOrder = ((currentWeek - 1) * workoutsPerWeek) + 1;
    const currentWeekEndDayOrder = currentWeekStartDayOrder + workoutsPerWeek - 1;

    const currentWeekWorkouts = workouts.filter((w) => {
      const dayOrder = Number(w.day_order || 0);
      return dayOrder >= currentWeekStartDayOrder && dayOrder <= currentWeekEndDayOrder;
    });

    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const missedProgramDayRows = await getMissedProgramDayRows({
      userId,
      dateFrom: formatDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)),
      dateTo: formatDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)),
    });
    const missedDateKeys = new Set(
      missedProgramDayRows.map((row) => formatDateISO(row.missed_date)),
    );
    const todayDateKey = formatDateISO(now);
    const isTodayMissed = missedDateKeys.has(todayDateKey);

    const todayWorkout = !isTodayMissed
      ? currentWeekWorkouts.find((w) => w.day_name === dayName) || null
      : null;
    const todayMissedWorkout = currentWeekWorkouts.find((w) => w.day_name === dayName)
      || null;

    return res.json({
      id: assignment.program_id,
      assignmentId: assignment.id,
      name: assignment.name,
      programType: assignment.program_type,
      goal: assignment.goal,
      daysPerWeek: Number(assignment.days_per_week || 0),
      currentWeek,
      totalWeeks: assignment.cycle_weeks,
      rotationWeeks: assignment.rotation_weeks,
      nextRotationDate: assignment.next_rotation_date,
        todayWorkout: todayWorkout
          ? {
              name: todayWorkout.workout_name,
              workoutType: todayWorkout.workout_type,
              dayName: todayWorkout.day_name,
              estimatedDurationMinutes: todayWorkout.estimated_duration_minutes,
              exercises: JSON.parse(todayWorkout.exercises || '[]'),
            }
          : null,
      missedTodayWorkoutName: isTodayMissed
        ? String(todayMissedWorkout?.workout_name || todayMissedWorkout?.name || '').trim() || null
        : null,
      missedWorkoutDates: Array.from(missedDateKeys),
      workouts,
      currentWeekWorkouts,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/user/:userId/program/today-workout/miss', async (req, res) => {
  try {
    const userId = toNumber(req.params.userId, 0);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const context = await getTodayWorkoutContextForUser(pool, userId);
    if (!context?.assignment) {
      return res.status(404).json({ error: 'No active program found for this user' });
    }

    if (!context?.todayWorkout?.id) {
      return res.status(400).json({ error: 'No scheduled workout found for today' });
    }

    const missedDate = formatDateISO(new Date());
    const workoutName = String(context.todayWorkout.workout_name || context.todayWorkout.name || '').trim() || 'Workout';

    const columns = await getWorkoutSessionColumns();
    const dateColumn = columns.has('completed_at')
      ? 'completed_at'
      : (columns.has('created_at') ? 'created_at' : null);

    if (dateColumn) {
      const [completedRows] = await pool.execute(
        `SELECT id
         FROM workout_sessions
         WHERE user_id = ?
           AND status = 'completed'
           AND DATE(${dateColumn}) = ?
         ORDER BY id DESC
         LIMIT 1`,
        [userId, missedDate],
      );

      if (Array.isArray(completedRows) && completedRows.length > 0) {
        return res.status(400).json({ error: 'Today already has a completed workout session.' });
      }
    }

    const [completedSetRows] = await pool.execute(
      `SELECT id
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND DATE(created_at) = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userId, missedDate],
    );

    if (Array.isArray(completedSetRows) && completedSetRows.length > 0) {
      return res.status(400).json({ error: 'Today already has logged completed sets. Remove them before marking this day as missed.' });
    }

    await pool.execute(
      `INSERT INTO missed_program_days
         (user_id, program_assignment_id, workout_id, missed_date, workout_name, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         program_assignment_id = VALUES(program_assignment_id),
         workout_id = VALUES(workout_id),
         workout_name = VALUES(workout_name),
         notes = VALUES(notes),
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        Number(context.assignment.id || 0) || null,
        Number(context.todayWorkout.id || 0) || null,
        missedDate,
        workoutName,
        'User marked this scheduled workout as missed',
      ],
    );

    const gamification = await refreshGamificationForUser(userId);

    return res.json({
      success: true,
      missedDate,
      workoutName,
      assignmentId: Number(context.assignment.id || 0) || null,
      workoutId: Number(context.todayWorkout.id || 0) || null,
      gamification: toGamificationPayload(gamification),
    });
  } catch (error) {
    if (isMissedProgramDaysUnavailableError(error)) {
      return res.status(503).json({
        error: 'Missed workout tracking schema is not available yet. Run migration 2026-03-10_missed_program_days.sql.',
      });
    }
    return res.status(500).json({ error: error?.message || 'Failed to mark workout day as missed' });
  }
});

router.post('/user/:userId/program/today-workout/exercises', async (req, res) => {
  const userId = toNumber(req.params.userId, 0);
  if (!userId) {
    return res.status(400).json({ error: 'A valid userId is required' });
  }

  const requestedName = String(req.body?.exerciseName || req.body?.name || '').trim();
  if (!requestedName) {
    return res.status(400).json({ error: 'exerciseName is required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const context = await getTodayWorkoutContextForUser(conn, userId);
    if (!context?.todayWorkout?.id) {
      await conn.rollback();
      return res.status(404).json({ error: 'No workout scheduled for today' });
    }

    const workoutId = Number(context.todayWorkout.id || 0);
    const [existingRows] = await conn.execute(
      `SELECT id, exercise_name_snapshot
       FROM workout_exercises
       WHERE workout_id = ?
       ORDER BY order_index ASC, id ASC`,
      [workoutId],
    );

    const normalizedRequestedName = normalizeExerciseLookupName(requestedName);
    const duplicate = existingRows.find((row) =>
      normalizeExerciseLookupName(row.exercise_name_snapshot) === normalizedRequestedName,
    );
    if (duplicate) {
      await conn.rollback();
      return res.status(409).json({ error: 'This exercise is already in today\'s workout' });
    }

    const requestedCatalogId = toNumber(req.body?.exerciseCatalogId ?? req.body?.exercise_catalog_id, null);
    let catalogExercise = null;
    if (requestedCatalogId) {
      const [catalogRows] = await conn.execute(
        `SELECT id, name, body_part
         FROM exercise_catalog
         WHERE id = ?
         LIMIT 1`,
        [requestedCatalogId],
      );
      catalogExercise = catalogRows[0] || null;
    }

    const exerciseName = String(catalogExercise?.name || requestedName).trim().slice(0, 255);
    const requestedTargets = parseMuscleGroups(
      req.body?.targetMuscles ?? req.body?.muscleTargets ?? req.body?.muscles,
    );
    const fallbackTargets = requestedTargets.length
      ? requestedTargets
      : inferMusclesFromExerciseName(exerciseName);
    const muscleGroupSnapshot = buildMuscleGroupSnapshot({
      catalogBodyPart: catalogExercise?.body_part || req.body?.muscleGroup || req.body?.bodyPart || null,
      targetMuscles: fallbackTargets,
    });

    const [orderRows] = await conn.execute(
      `SELECT COALESCE(MAX(order_index), 0) AS max_order
       FROM workout_exercises
       WHERE workout_id = ?`,
      [workoutId],
    );
    const orderIndex = Number(orderRows[0]?.max_order || 0) + 1;

    const sets = Math.max(1, Math.min(10, Math.round(Number(
      req.body?.sets
      ?? req.body?.targetSets
      ?? req.body?.target_sets
      ?? 3,
    ) || 3)));
    const reps = String(
      req.body?.reps
      ?? req.body?.targetReps
      ?? req.body?.target_reps
      ?? '8-12',
    ).trim().slice(0, 50) || '8-12';
    const targetWeight = toNumber(req.body?.targetWeight ?? req.body?.target_weight, null);
    const restSecondsRaw = toNumber(
      req.body?.rest
      ?? req.body?.restSeconds
      ?? req.body?.rest_seconds,
      90,
    );
    const restSeconds = Math.max(0, Number(restSecondsRaw || 0));
    const tempo = req.body?.tempo ? String(req.body.tempo).trim().slice(0, 20) : null;
    const rpeTarget = toNumber(req.body?.rpeTarget ?? req.body?.rpe_target, null);
    const notes = String(req.body?.notes || 'Added for today').trim().slice(0, 255) || 'Added for today';

    const [insertResult] = await conn.execute(
      `INSERT INTO workout_exercises
        (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workoutId,
        orderIndex,
        exerciseName,
        muscleGroupSnapshot ? String(muscleGroupSnapshot).slice(0, 255) : null,
        sets,
        reps,
        targetWeight,
        restSeconds,
        tempo,
        rpeTarget,
        notes,
      ],
    );

    await conn.commit();
    return res.status(201).json({
      exercise: {
        id: Number(insertResult.insertId || 0) || null,
        exerciseName,
        targetMuscles: normalizeRecoveryMuscleTargets(fallbackTargets, 3),
        muscleGroup: normalizeRecoveryMuscleTargets(muscleGroupSnapshot, 1)[0] || null,
        sets,
        reps,
        targetWeight,
        rest: restSeconds,
        tempo,
        rpeTarget,
        notes,
      },
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors.
    }
    return res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

router.delete('/user/:userId/program/today-workout/exercises/:exerciseId', async (req, res) => {
  const userId = toNumber(req.params.userId, 0);
  const exerciseId = toNumber(req.params.exerciseId, 0);
  if (!userId || !exerciseId) {
    return res.status(400).json({ error: 'Valid userId and exerciseId are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const context = await getTodayWorkoutContextForUser(conn, userId);
    if (!context?.todayWorkout?.id) {
      await conn.rollback();
      return res.status(404).json({ error: 'No workout scheduled for today' });
    }

    const workoutId = Number(context.todayWorkout.id || 0);
    const [exerciseRows] = await conn.execute(
      `SELECT id, exercise_name_snapshot
       FROM workout_exercises
       WHERE id = ? AND workout_id = ?
       LIMIT 1`,
      [exerciseId, workoutId],
    );

    const exerciseRow = exerciseRows[0] || null;
    if (!exerciseRow) {
      await conn.rollback();
      return res.status(404).json({ error: 'Exercise not found in today\'s workout' });
    }

    await conn.execute(
      `DELETE FROM workout_exercises
       WHERE id = ?
       LIMIT 1`,
      [exerciseId],
    );

    await conn.commit();
    return res.json({
      success: true,
      removedExercise: {
        id: exerciseId,
        exerciseName: String(exerciseRow.exercise_name_snapshot || '').trim(),
      },
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors.
    }
    return res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

router.get('/user/:userId/program-progress', async (req, res) => {
  try {
    const normalizedUserId = toNumber(req.params.userId, 0);
    if (!normalizedUserId) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const [assignmentRows] = await pool.execute(
      `SELECT pa.id, pa.program_id, pa.start_date, pa.next_rotation_date, pa.rotation_weeks, pa.status,
              p.name, p.program_type, p.goal, p.days_per_week, p.cycle_weeks
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [normalizedUserId],
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      const [volumeAllTimeRows] = await pool.execute(
        `SELECT
            COUNT(*) AS sets_logged_all_time,
            COALESCE(SUM(CASE
              WHEN weight IS NOT NULL AND reps IS NOT NULL THEN (weight * reps)
              ELSE 0
            END), 0) AS volume_load_all_time
         FROM workout_sets
         WHERE user_id = ?`,
        [normalizedUserId],
      );

      return res.json({
        hasActiveProgram: false,
        summary: {
          currentWeek: 1,
          totalWeeks: 0,
          completedWorkouts: 0,
          plannedWorkouts: 0,
          completionRate: 0,
          workoutsCompletedThisWeek: 0,
          workoutsPlannedThisWeek: 0,
          workoutsMissedThisWeek: 0,
          workoutsRemainingThisWeek: 0,
          weeklyCompletionRate: 0,
          workoutStreakDays: 0,
          totalPoints: 0,
          rank: 'Bronze',
          volumeLoadLast30Days: 0,
          setsLoggedLast30Days: 0,
          volumeLoadAllTime: Number(volumeAllTimeRows[0]?.volume_load_all_time || 0),
          setsLoggedAllTime: Number(volumeAllTimeRows[0]?.sets_logged_all_time || 0),
        },
      });
    }

    const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
    let adaptationInfo = null;
    if (currentWeek % 2 === 0) {
      try {
        adaptationInfo = await adaptProgramBiWeekly(pool, { userId: normalizedUserId, trigger: 'auto_progress_poll' });
      } catch {
        adaptationInfo = null;
      }
    }
    const plannedWorkouts = Number(assignment.cycle_weeks || 0) * Number(assignment.days_per_week || 0);
    const workoutsPlannedThisWeek = Number(assignment.days_per_week || 0);

    const weekStart = new Date(assignment.start_date);
    weekStart.setDate(weekStart.getDate() + ((currentWeek - 1) * 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const [completedRows] = await pool.execute(
      `SELECT COUNT(*) AS completed_workouts
       FROM workout_sessions
       WHERE user_id = ? AND program_assignment_id = ? AND status = 'completed'`,
      [normalizedUserId, assignment.id],
    );

    const [weekCompletedRows] = await pool.execute(
      `SELECT COUNT(*) AS completed_week
       FROM workout_sessions
       WHERE user_id = ? AND program_assignment_id = ? AND status = 'completed'
         AND DATE(completed_at) BETWEEN ? AND ?`,
      [normalizedUserId, assignment.id, formatDateISO(weekStart), formatDateISO(weekEnd)],
    );

    const [setCompletedRows] = await pool.execute(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS completed_days
       FROM workout_sets
       WHERE user_id = ?
         AND DATE(created_at) BETWEEN ? AND ?`,
      [normalizedUserId, formatDateISO(new Date(assignment.start_date)), formatDateISO(new Date())],
    );

    const [setWeekCompletedRows] = await pool.execute(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS completed_days_week
       FROM workout_sets
       WHERE user_id = ?
         AND DATE(created_at) BETWEEN ? AND ?`,
      [normalizedUserId, formatDateISO(weekStart), formatDateISO(weekEnd)],
    );

    const [volumeLast30DaysRows] = await pool.execute(
      `SELECT
          COUNT(*) AS sets_logged,
          COALESCE(SUM(CASE
            WHEN weight IS NOT NULL AND reps IS NOT NULL THEN (weight * reps)
            ELSE 0
          END), 0) AS volume_load
       FROM workout_sets
       WHERE user_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [normalizedUserId],
    );

    const [volumeAllTimeRows] = await pool.execute(
      `SELECT
          COUNT(*) AS sets_logged_all_time,
          COALESCE(SUM(CASE
            WHEN weight IS NOT NULL AND reps IS NOT NULL THEN (weight * reps)
            ELSE 0
          END), 0) AS volume_load_all_time
       FROM workout_sets
       WHERE user_id = ?`,
      [normalizedUserId],
    );

    const [streakRows] = await pool.execute(
      `SELECT DISTINCT DATE(completed_at) AS workout_date
       FROM workout_sessions
       WHERE user_id = ? AND status = 'completed'
       ORDER BY workout_date DESC
       LIMIT 60`,
      [normalizedUserId],
    );

    const missedDateRows = await getMissedProgramDayRows({
      userId: normalizedUserId,
      limit: 60,
    });

    const missedWeekRows = await getMissedProgramDayRows({
      userId: normalizedUserId,
      dateFrom: formatDateISO(weekStart),
      dateTo: formatDateISO(weekEnd),
    });

    let userRows = [];
    try {
      const [resolvedUserRows] = await pool.execute(
        `SELECT total_points, total_workouts, \`rank\`
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [normalizedUserId],
      );
      userRows = Array.isArray(resolvedUserRows) ? resolvedUserRows : [];
    } catch (error) {
      if (!isUsersGamificationColumnError(error)) throw error;
      userRows = [];
    }

    const completedFromSessions = Number(completedRows[0]?.completed_workouts || 0);
    const completedWeekFromSessions = Number(weekCompletedRows[0]?.completed_week || 0);
    const completedFromSets = Number(setCompletedRows[0]?.completed_days || 0);
    const completedWeekFromSets = Number(setWeekCompletedRows[0]?.completed_days_week || 0);
    const missedThisWeek = Array.isArray(missedWeekRows) ? missedWeekRows.length : 0;

    const completedWorkouts = completedFromSessions > 0 ? completedFromSessions : completedFromSets;
    const completedThisWeek = completedWeekFromSessions > 0 ? completedWeekFromSessions : completedWeekFromSets;
    const completionRate = plannedWorkouts > 0
      ? Math.round((completedWorkouts / plannedWorkouts) * 100)
      : 0;
    const weeklyCompletionRate = workoutsPlannedThisWeek > 0
      ? Math.round((completedThisWeek / workoutsPlannedThisWeek) * 100)
      : 0;
    const programStartDate = new Date(assignment.start_date);
    programStartDate.setHours(0, 0, 0, 0);
    const totalProgramDays = Math.max(0, Number(assignment.cycle_weeks || 0) * 7);
    const programEndDate = new Date(programStartDate);
    if (totalProgramDays > 0) {
      programEndDate.setDate(programEndDate.getDate() + totalProgramDays - 1);
    }
    programEndDate.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const calendarDaysLeft = totalProgramDays > 0
      ? Math.max(0, Math.floor((programEndDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 0;

    return res.json({
      hasActiveProgram: true,
      program: {
        id: assignment.program_id,
        assignmentId: assignment.id,
        name: assignment.name,
        programType: assignment.program_type,
        goal: assignment.goal,
        daysPerWeek: assignment.days_per_week,
        cycleWeeks: assignment.cycle_weeks,
        startDate: formatDateISO(programStartDate),
        endDate: formatDateISO(programEndDate),
        rotationWeeks: assignment.rotation_weeks,
        nextRotationDate: assignment.next_rotation_date,
      },
      summary: {
        currentWeek,
        totalWeeks: Number(assignment.cycle_weeks || 0),
        completedWorkouts,
        plannedWorkouts,
        completionRate,
        workoutsCompletedThisWeek: completedThisWeek,
        workoutsPlannedThisWeek,
        workoutsMissedThisWeek: missedThisWeek,
        workoutsRemainingThisWeek: Math.max(0, workoutsPlannedThisWeek - completedThisWeek - missedThisWeek),
        weeklyCompletionRate,
        calendarDaysLeft,
        workoutStreakDays: computeWorkoutStreak(streakRows, missedDateRows),
        totalPoints: Number(userRows[0]?.total_points || 0),
        totalWorkouts: Number(userRows[0]?.total_workouts || 0),
        rank: userRows[0]?.rank || 'Bronze',
        volumeLoadLast30Days: Number(volumeLast30DaysRows[0]?.volume_load || 0),
        setsLoggedLast30Days: Number(volumeLast30DaysRows[0]?.sets_logged || 0),
        volumeLoadAllTime: Number(volumeAllTimeRows[0]?.volume_load_all_time || 0),
        setsLoggedAllTime: Number(volumeAllTimeRows[0]?.sets_logged_all_time || 0),
        adaptationInfo,
      },
    });
  } catch (error) {
    console.error('GET /user/:userId/program-progress failed', {
      userId: req.params?.userId || null,
      code: error?.code || null,
      errno: error?.errno || null,
      message: error?.message || null,
      sqlMessage: error?.sqlMessage || null,
      stack: error?.stack || null,
    });
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// RECOVERY
// =========================

const roundMetric = (value, digits = 2) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
};

const createEmptyMuscleLoadMetrics = () => ({
  plannedTodaySetUnits: 0,
  completedTodaySetUnits: 0,
  plannedWeekSetUnits: 0,
  completedWeekSetUnits: 0,
  completedTodayVolume: 0,
  completedWeekVolume: 0,
  lastCompletedAt: null,
});

const createTrackedMuscleLoadMap = () => {
  const map = new Map();
  TRACKED_MUSCLES.forEach((muscleName) => {
    map.set(muscleName, createEmptyMuscleLoadMetrics());
  });
  return map;
};

const upsertMuscleLoadMetrics = (byMuscle, muscleName, patch = {}) => {
  const canonicalMuscle = normalizeMuscleName(muscleName);
  if (!canonicalMuscle || !byMuscle.has(canonicalMuscle)) return;

  const current = byMuscle.get(canonicalMuscle) || createEmptyMuscleLoadMetrics();
  const next = {
    ...current,
    plannedTodaySetUnits: current.plannedTodaySetUnits + Number(patch.plannedTodaySetUnits || 0),
    completedTodaySetUnits: current.completedTodaySetUnits + Number(patch.completedTodaySetUnits || 0),
    plannedWeekSetUnits: current.plannedWeekSetUnits + Number(patch.plannedWeekSetUnits || 0),
    completedWeekSetUnits: current.completedWeekSetUnits + Number(patch.completedWeekSetUnits || 0),
    completedTodayVolume: current.completedTodayVolume + Number(patch.completedTodayVolume || 0),
    completedWeekVolume: current.completedWeekVolume + Number(patch.completedWeekVolume || 0),
    lastCompletedAt: current.lastCompletedAt,
  };

  const nextLastCompletedAt = patch.lastCompletedAt || null;
  if (
    nextLastCompletedAt
    && (!current.lastCompletedAt || new Date(nextLastCompletedAt).getTime() > new Date(current.lastCompletedAt).getTime())
  ) {
    next.lastCompletedAt = nextLastCompletedAt;
  }

  byMuscle.set(canonicalMuscle, next);
};

const resolveMuscleLoadEntries = ({ context, fallbackMuscle, exerciseName }) => {
  const entries = [];

  if (context && Array.isArray(context.muscles)) {
    context.muscles.forEach((entry) => {
      const normalizedMuscle = normalizeCatalogRecoveryMuscle(entry.muscle);
      if (!normalizedMuscle) return;
      const loadFactor = Number(entry.loadFactor || 1);
      entries.push({
        muscle: normalizedMuscle,
        loadFactor: Number.isFinite(loadFactor) && loadFactor > 0 ? loadFactor : 1,
      });
    });
  }

  if (!entries.length) {
    normalizeRecoveryMuscleTargets(fallbackMuscle, 4).forEach((muscle) => {
      entries.push({ muscle, loadFactor: 1 });
    });
  }

  if (!entries.length) {
    inferMusclesFromExerciseName(exerciseName).forEach((muscle) => {
      entries.push({ muscle, loadFactor: 1 });
    });
  }

  const deduped = new Map();
  entries.forEach((entry) => {
    const normalizedMuscle = normalizeMuscleName(entry.muscle);
    if (!normalizedMuscle || !TRACKED_MUSCLES.includes(normalizedMuscle)) return;

    const current = deduped.get(normalizedMuscle);
    if (!current || entry.loadFactor > current.loadFactor) {
      deduped.set(normalizedMuscle, {
        muscle: normalizedMuscle,
        loadFactor: entry.loadFactor,
      });
    }
  });

  return Array.from(deduped.values());
};

const getWeekWindowForAssignment = (assignment) => {
  if (!assignment) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
  const weekStart = new Date(assignment.start_date);
  weekStart.setDate(weekStart.getDate() + ((currentWeek - 1) * 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { start: weekStart, end: weekEnd };
};

const buildRecoveryPlanAndVolumeContext = async (userId) => {
  const normalizedUserId = toNumber(userId);
  const byMuscle = createTrackedMuscleLoadMap();
  const now = new Date();
  const todayKey = formatDateISO(now);
  const todayDayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const [assignmentRows] = await pool.execute(
    `SELECT pa.id, pa.program_id, pa.start_date, p.days_per_week, p.cycle_weeks
     FROM program_assignments pa
     JOIN programs p ON p.id = pa.program_id
     WHERE pa.user_id = ? AND pa.status = 'active'
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [normalizedUserId],
  );

  const assignment = assignmentRows[0] || null;
  const weekWindow = getWeekWindowForAssignment(assignment);
  const weekStartKey = formatDateISO(weekWindow.start);
  const weekEndKey = formatDateISO(weekWindow.end);
  const missedRows = assignment
    ? await getMissedProgramDayRows({
      userId: normalizedUserId,
      dateFrom: weekStartKey,
      dateTo: weekEndKey,
    })
    : [];
  const missedDateKeys = new Set();
  const missedDayNames = new Set();
  missedRows.forEach((row) => {
    const assignmentId = Number(row?.program_assignment_id || 0) || null;
    if (assignmentId && Number(assignment?.id || 0) && assignmentId !== Number(assignment.id)) {
      return;
    }
    const key = formatDateISO(row?.missed_date);
    if (!key) return;
    missedDateKeys.add(key);
    const dayName = new Date(row.missed_date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (dayName) missedDayNames.add(dayName);
  });
  const isTodayMissed = missedDateKeys.has(todayKey);

  const catalogIdByName = new Map();
  const catalogContextById = new Map();

  const resolveCatalogNames = async (normalizedNames = []) => {
    const unresolved = [...new Set(
      normalizedNames
        .map((name) => String(name || '').trim())
        .filter((name) => name && !catalogIdByName.has(name)),
    )];
    if (!unresolved.length) return;

    const resolved = await resolveCatalogIdsByNormalizedNames(unresolved);
    resolved.forEach((catalogId, normalizedName) => {
      if (catalogId) catalogIdByName.set(normalizedName, catalogId);
    });
  };

  const ensureCatalogContexts = async (catalogIds = []) => {
    const missing = [...new Set(
      catalogIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0 && !catalogContextById.has(id)),
    )];
    if (!missing.length) return;

    const contexts = await getCatalogRecoveryContexts(missing);
    contexts.forEach((context, catalogId) => {
      catalogContextById.set(Number(catalogId), context);
    });
  };

  if (assignment) {
    const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
    const workoutsPerWeek = Math.max(1, Number(assignment.days_per_week || 1));
    const currentWeekStartDayOrder = ((currentWeek - 1) * workoutsPerWeek) + 1;
    const currentWeekEndDayOrder = currentWeekStartDayOrder + workoutsPerWeek - 1;

    const [workoutRows] = await pool.execute(
      `SELECT id, day_name
       FROM workouts
       WHERE program_id = ? AND day_order BETWEEN ? AND ?
       ORDER BY day_order ASC`,
      [assignment.program_id, currentWeekStartDayOrder, currentWeekEndDayOrder],
    );

    const workoutIds = workoutRows
      .map((row) => Number(row.id || 0))
      .filter((id) => id > 0);

    if (workoutIds.length) {
      const placeholders = workoutIds.map(() => '?').join(', ');
      const [plannedRows] = await pool.execute(
        `SELECT workout_id, exercise_name_snapshot, muscle_group_snapshot, target_sets
         FROM workout_exercises
         WHERE workout_id IN (${placeholders})`,
        workoutIds,
      );

      const workoutDayById = new Map(
        workoutRows.map((row) => [
          Number(row.id || 0),
          String(row.day_name || '').trim().toLowerCase(),
        ]),
      );

      const plannedNames = plannedRows
        .map((row) => normalizeExerciseLookupName(row.exercise_name_snapshot))
        .filter(Boolean);

      await resolveCatalogNames(plannedNames);
      await ensureCatalogContexts(
        plannedNames
          .map((name) => Number(catalogIdByName.get(name) || 0))
          .filter((id) => id > 0),
      );

      plannedRows.forEach((row) => {
        const targetSets = Number(row.target_sets || 0);
        if (!Number.isFinite(targetSets) || targetSets <= 0) return;

        const normalizedExerciseName = normalizeExerciseLookupName(row.exercise_name_snapshot);
        const catalogId = Number(catalogIdByName.get(normalizedExerciseName) || 0) || null;
        const context = catalogId ? catalogContextById.get(catalogId) : null;
        const entries = resolveMuscleLoadEntries({
          context,
          fallbackMuscle: row.muscle_group_snapshot,
          exerciseName: row.exercise_name_snapshot,
        });
        if (!entries.length) return;

        const totalLoad = entries.reduce((sum, entry) => sum + Number(entry.loadFactor || 1), 0) || entries.length;
        const workoutDayName = workoutDayById.get(Number(row.workout_id || 0)) || '';
        const isTodayWorkout = workoutDayName === todayDayName;
        const isMissedWorkoutDay = missedDayNames.has(workoutDayName);

        entries.forEach((entry) => {
          const normalizedShare = Number(entry.loadFactor || 1) / totalLoad;
          const setUnits = targetSets * normalizedShare;
          upsertMuscleLoadMetrics(byMuscle, entry.muscle, {
            plannedWeekSetUnits: isMissedWorkoutDay ? 0 : setUnits,
            plannedTodaySetUnits: isTodayWorkout && !isTodayMissed ? setUnits : 0,
          });
        });
      });
    }
  }

  const [completedRows] = await pool.execute(
    `SELECT id, exercise_name, exercise_catalog_id, weight, reps, rpe, created_at
     FROM workout_sets
     WHERE user_id = ? AND completed = 1 AND DATE(created_at) BETWEEN ? AND ?`,
    [normalizedUserId, weekStartKey, weekEndKey],
  );

  const completedNames = completedRows
    .filter((row) => !row.exercise_catalog_id)
    .map((row) => normalizeExerciseLookupName(row.exercise_name))
    .filter(Boolean);

  await resolveCatalogNames(completedNames);
  await ensureCatalogContexts(
    completedRows
      .map((row) => Number(row.exercise_catalog_id || catalogIdByName.get(normalizeExerciseLookupName(row.exercise_name)) || 0))
      .filter((id) => id > 0),
  );

  completedRows.forEach((row) => {
    const normalizedExerciseName = normalizeExerciseLookupName(row.exercise_name);
    const catalogId = Number(row.exercise_catalog_id || catalogIdByName.get(normalizedExerciseName) || 0) || null;
    const context = catalogId ? catalogContextById.get(catalogId) : null;
    const entries = resolveMuscleLoadEntries({
      context,
      fallbackMuscle: '',
      exerciseName: row.exercise_name,
    });
    if (!entries.length) return;

    const totalLoad = entries.reduce((sum, entry) => sum + Number(entry.loadFactor || 1), 0) || entries.length;
    const createdDayKey = formatDateISO(row.created_at);
    const isToday = createdDayKey === todayKey;

    const reps = Number(row.reps || 0);
    const weight = Number(row.weight || 0);
    const intensityBand = deriveIntensityFromRpe(row.rpe);
    const intensityMultiplier = intensityBand === 'high' ? 1.2 : intensityBand === 'low' ? 0.85 : 1;
    const baseVolume = (weight > 0 && reps > 0)
      ? (weight * reps)
      : (reps > 0 ? reps : 1);
    const setVolume = baseVolume * intensityMultiplier;

    entries.forEach((entry) => {
      const normalizedShare = Number(entry.loadFactor || 1) / totalLoad;
      upsertMuscleLoadMetrics(byMuscle, entry.muscle, {
        completedWeekSetUnits: normalizedShare,
        completedTodaySetUnits: isToday ? normalizedShare : 0,
        completedWeekVolume: setVolume * normalizedShare,
        completedTodayVolume: isToday ? (setVolume * normalizedShare) : 0,
        lastCompletedAt: row.created_at,
      });
    });
  });

  const aggregate = {
    plannedTodaySetUnits: 0,
    completedTodaySetUnits: 0,
    plannedWeekSetUnits: 0,
    completedWeekSetUnits: 0,
    completedTodayVolume: 0,
    completedWeekVolume: 0,
  };

  byMuscle.forEach((metrics) => {
    aggregate.plannedTodaySetUnits += Number(metrics.plannedTodaySetUnits || 0);
    aggregate.completedTodaySetUnits += Number(metrics.completedTodaySetUnits || 0);
    aggregate.plannedWeekSetUnits += Number(metrics.plannedWeekSetUnits || 0);
    aggregate.completedWeekSetUnits += Number(metrics.completedWeekSetUnits || 0);
    aggregate.completedTodayVolume += Number(metrics.completedTodayVolume || 0);
    aggregate.completedWeekVolume += Number(metrics.completedWeekVolume || 0);
  });

  const toCompletion = (completed, planned) => {
    const safePlanned = Number(planned || 0);
    if (safePlanned <= 0) return 0;
    return Math.round((Number(completed || 0) / safePlanned) * 100);
  };

  return {
    hasActiveProgram: Boolean(assignment),
    weekStart: weekStartKey,
    weekEnd: weekEndKey,
    byMuscle,
    aggregate: {
      ...aggregate,
      todayPlanCompletionPct: toCompletion(aggregate.completedTodaySetUnits, aggregate.plannedTodaySetUnits),
      weekPlanCompletionPct: toCompletion(aggregate.completedWeekSetUnits, aggregate.plannedWeekSetUnits),
    },
  };
};

const rebuildTodayRecoveryStatusFromSets = async (userId) => {
  const normalizedUserId = toNumber(userId);
  if (!normalizedUserId || normalizedUserId <= 0) {
    return { muscles: [] };
  }

  const [setRows] = await pool.execute(
    `SELECT
        id,
        exercise_name,
        exercise_catalog_id,
        COALESCE(rpe, 7) AS rpe,
        created_at
     FROM workout_sets
     WHERE user_id = ? AND DATE(created_at) = CURDATE() AND completed = 1`,
    [normalizedUserId],
  );

  if (!setRows.length) {
    return { muscles: [] };
  }

  const unresolvedNames = [
    ...new Set(
      setRows
        .filter((row) => !row.exercise_catalog_id)
        .map((row) => normalizeExerciseLookupName(row.exercise_name))
        .filter(Boolean),
    ),
  ];
  const catalogIdByName = unresolvedNames.length
    ? await resolveCatalogIdsByNormalizedNames(unresolvedNames)
    : new Map();

  const workoutSetBackfills = [];
  const exercisesByKey = new Map();

  setRows.forEach((row) => {
    const existingCatalogId = toNumber(row.exercise_catalog_id, null);
    const normalizedName = normalizeExerciseLookupName(row.exercise_name);
    const resolvedCatalogId = existingCatalogId || catalogIdByName.get(normalizedName) || null;

    if (!existingCatalogId && resolvedCatalogId && row.id) {
      workoutSetBackfills.push({
        id: Number(row.id),
        catalogId: resolvedCatalogId,
      });
    }

    const key = resolvedCatalogId
      ? `catalog:${resolvedCatalogId}`
      : `name:${normalizedName || String(row.exercise_name || '').toLowerCase()}`;

    if (!exercisesByKey.has(key)) {
      exercisesByKey.set(key, {
        catalogId: resolvedCatalogId,
        setCount: 0,
        totalRpe: 0,
        rpeSamples: 0,
        lastLoggedAt: row.created_at,
      });
    }

    const summary = exercisesByKey.get(key);
    summary.setCount += 1;
    summary.totalRpe += Number(row.rpe || 7);
    summary.rpeSamples += 1;
    if (
      !summary.lastLoggedAt
      || new Date(row.created_at).getTime() > new Date(summary.lastLoggedAt).getTime()
    ) {
      summary.lastLoggedAt = row.created_at;
    }
    summary.catalogId = summary.catalogId || resolvedCatalogId;
  });

  if (workoutSetBackfills.length) {
    await Promise.all(
      workoutSetBackfills.map((entry) => (
        pool.execute(
          'UPDATE workout_sets SET exercise_catalog_id = ? WHERE id = ? AND exercise_catalog_id IS NULL',
          [entry.catalogId, entry.id],
        )
      )),
    );
  }

  const catalogIds = [
    ...new Set(
      Array.from(exercisesByKey.values())
        .map((exercise) => Number(exercise.catalogId || 0))
        .filter((catalogId) => catalogId > 0),
    ),
  ];

  if (!catalogIds.length) {
    return { muscles: [] };
  }

  const recoveryContextByCatalogId = await getCatalogRecoveryContexts(catalogIds);

  const [factorRows] = await pool.execute(
    `SELECT
        u.age,
        rf.sleep_hours,
        rf.nutrition_quality,
        rf.stress_level,
        rf.protein_intake,
        rf.supplements
     FROM users u
     LEFT JOIN recovery_factors rf ON rf.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [normalizedUserId],
  );

  const factors = factorRows[0] || {};
  const byMuscle = new Map();

  exercisesByKey.forEach((exercise) => {
    if (!exercise.catalogId) return;

    const context = recoveryContextByCatalogId.get(Number(exercise.catalogId));
    if (!context || !context.muscles.length) return;

    const avgRpe = exercise.rpeSamples
      ? (exercise.totalRpe / exercise.rpeSamples)
      : 7;
    const inferredIntensity = deriveIntensityFromRpe(avgRpe);
    const inferredVolume = deriveVolumeFromSetCount(exercise.setCount);
    const eccentricFocus = Number(context.profile.eccentricBiasScore || 1) >= 1.05;

    context.muscles.forEach((muscleEntry) => {
      const loadMultiplier = computeCatalogRecoveryLoadMultiplier(
        context.profile,
        muscleEntry.loadFactor,
      );

      const hoursNeeded = calculateRecoveryHours({
        muscleGroup: muscleEntry.muscle,
        intensity: inferredIntensity,
        volume: inferredVolume,
        eccentricFocus,
        age: factors.age ?? null,
        sleepHours: Number(factors.sleep_hours ?? 7),
        nutritionQuality: factors.nutrition_quality || 'optimal',
        stressLevel: factors.stress_level || 'moderate',
        proteinIntake: factors.protein_intake ?? null,
        supplements: factors.supplements || 'none',
        loadMultiplier,
      });

      const existing = byMuscle.get(muscleEntry.muscle);
      if (!existing) {
        byMuscle.set(muscleEntry.muscle, {
          hoursNeeded,
          lastWorked: exercise.lastLoggedAt,
        });
        return;
      }

      byMuscle.set(muscleEntry.muscle, {
        hoursNeeded: Math.max(existing.hoursNeeded, hoursNeeded),
        lastWorked: new Date(exercise.lastLoggedAt).getTime() > new Date(existing.lastWorked).getTime()
          ? exercise.lastLoggedAt
          : existing.lastWorked,
      });
    });
  });

  const updates = [];
  byMuscle.forEach((value, muscle) => {
    updates.push(
      pool.execute(
        `INSERT INTO muscle_recovery_status
           (user_id, muscle_group, recovery_percentage, hours_needed, hours_elapsed, last_worked)
         VALUES (?, ?, 0, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
           recovery_percentage = 0,
           hours_needed = VALUES(hours_needed),
           hours_elapsed = 0,
           last_worked = VALUES(last_worked)`,
        [normalizedUserId, muscle, value.hoursNeeded, value.lastWorked],
      ),
    );
  });

  await Promise.all(updates);

  return {
    muscles: Array.from(byMuscle.entries()).map(([muscle, value]) => ({
      muscle,
      hoursNeeded: value.hoursNeeded,
    })),
  };
};

router.get('/user/:userId/recovery', async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    try {
      await rebuildTodayRecoveryStatusFromSets(userId);
    } catch (syncError) {
      console.error('Recovery sync failed:', syncError);
    }

    const planAndVolume = await buildRecoveryPlanAndVolumeContext(userId);

    const [factorRows] = await pool.execute(
      `SELECT
          u.age,
          rf.sleep_hours,
          rf.nutrition_quality,
          rf.stress_level,
          rf.protein_intake,
          rf.supplements
       FROM users u
       LEFT JOIN recovery_factors rf ON rf.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [Number(userId)],
    );

    const dbFactors = factorRows[0] || {};

    const [statusRows] = await pool.execute(
      `SELECT
          id,
          muscle_group,
          recovery_percentage,
          hours_needed,
          hours_elapsed,
          last_worked,
          overtraining_risk
       FROM muscle_recovery_status
       WHERE user_id = ?`,
      [Number(userId)],
    );

    const latestByMuscle = new Map();
    statusRows.forEach((row) => {
      const muscleName = normalizeMuscleName(row.muscle_group);
      if (!muscleName) return;

      const existing = latestByMuscle.get(muscleName);
      if (!existing || new Date(row.last_worked).getTime() > new Date(existing.last_worked).getTime()) {
        latestByMuscle.set(muscleName, row);
      }
    });

    const computedByMuscle = new Map();
    const updates = [];

    latestByMuscle.forEach((row, muscleName) => {
      const dynamic = calculateDynamicRecovery(row.last_worked, row.hours_needed);
      const overtrainingRisk = dynamic.score < 30 ? 1 : 0;

      computedByMuscle.set(muscleName, {
        muscle: muscleName.toLowerCase(),
        name: muscleName,
        score: dynamic.score,
        lastWorkout: row.last_worked,
        hoursNeeded: Number(row.hours_needed || 0),
        hoursElapsed: dynamic.hoursElapsed,
        overtrainingRisk: !!overtrainingRisk,
      });

      const storedScore = Math.round(Number(row.recovery_percentage || 0));
      const storedHoursElapsed = Number(row.hours_elapsed || 0);
      if (
        storedScore !== dynamic.score ||
        Math.abs(storedHoursElapsed - dynamic.hoursElapsed) > 0.01 ||
        Number(row.overtraining_risk || 0) !== overtrainingRisk
      ) {
        updates.push(
          pool.execute(
            `UPDATE muscle_recovery_status
             SET recovery_percentage = ?, hours_elapsed = ?, overtraining_risk = ?
             WHERE id = ?`,
            [dynamic.score, dynamic.hoursElapsed, overtrainingRisk, row.id],
          ),
        );
      }
    });

    if (updates.length) {
      await Promise.all(updates);
    }

    const recovery = TRACKED_MUSCLES.map((muscleName) => {
      const existing = computedByMuscle.get(muscleName);
      const loadMetrics = planAndVolume.byMuscle.get(muscleName) || createEmptyMuscleLoadMetrics();
      const plannedTodaySetUnits = Number(loadMetrics.plannedTodaySetUnits || 0);
      const completedTodaySetUnits = Number(loadMetrics.completedTodaySetUnits || 0);
      const plannedWeekSetUnits = Number(loadMetrics.plannedWeekSetUnits || 0);
      const completedWeekSetUnits = Number(loadMetrics.completedWeekSetUnits || 0);

      const toCompletion = (completed, planned) => (planned > 0 ? Math.round((completed / planned) * 100) : 0);

      const base = existing
        ? { ...existing }
        : {
            muscle: muscleName.toLowerCase(),
            name: muscleName,
            score: 100,
            lastWorkout: null,
            hoursNeeded: 0,
            hoursElapsed: 0,
            overtrainingRisk: false,
          };

      const hoursNeeded = Number(base.hoursNeeded || 0);
      const hoursElapsed = Number(base.hoursElapsed || 0);

      return {
        ...base,
        lastWorkout: base.lastWorkout || loadMetrics.lastCompletedAt || null,
        hoursNeeded: roundMetric(hoursNeeded),
        hoursElapsed: roundMetric(hoursElapsed),
        hoursRemaining: roundMetric(Math.max(0, hoursNeeded - hoursElapsed)),
        plannedTodaySetUnits: roundMetric(plannedTodaySetUnits),
        completedTodaySetUnits: roundMetric(completedTodaySetUnits),
        todayPlanCompletionPct: toCompletion(completedTodaySetUnits, plannedTodaySetUnits),
        plannedWeekSetUnits: roundMetric(plannedWeekSetUnits),
        completedWeekSetUnits: roundMetric(completedWeekSetUnits),
        weekPlanCompletionPct: toCompletion(completedWeekSetUnits, plannedWeekSetUnits),
        completedTodayVolume: roundMetric(loadMetrics.completedTodayVolume),
        completedWeekVolume: roundMetric(loadMetrics.completedWeekVolume),
      };
    });

    const overallRecovery = computeOverallRecovery(recovery);

    return res.json({
      factors: {
        sleepHours: dbFactors.sleep_hours != null ? String(dbFactors.sleep_hours) : '7',
        proteinIntake: dbFactors.protein_intake != null
          ? (Number(dbFactors.protein_intake) >= 1.6 ? 'high' : Number(dbFactors.protein_intake) >= 1.0 ? 'medium' : 'low')
          : 'medium',
        supplements: dbFactors.supplements || 'none',
        soreness: 3,
        energy: 3,
        nutrition_quality: dbFactors.nutrition_quality || 'optimal',
        stress_level: dbFactors.stress_level || 'low',
      },
      recovery,
      overallRecovery,
      summary: {
        readyMuscles: recovery.filter((m) => m.score >= 90).length,
        almostReadyMuscles: recovery.filter((m) => m.score >= 70 && m.score < 90).length,
        damagedMuscles: recovery.filter((m) => m.score < 70).length,
        planBased: {
          hasActiveProgram: planAndVolume.hasActiveProgram,
          weekStart: planAndVolume.weekStart,
          weekEnd: planAndVolume.weekEnd,
          plannedTodaySetUnits: roundMetric(planAndVolume.aggregate.plannedTodaySetUnits),
          completedTodaySetUnits: roundMetric(planAndVolume.aggregate.completedTodaySetUnits),
          plannedWeekSetUnits: roundMetric(planAndVolume.aggregate.plannedWeekSetUnits),
          completedWeekSetUnits: roundMetric(planAndVolume.aggregate.completedWeekSetUnits),
          completedTodayVolume: roundMetric(planAndVolume.aggregate.completedTodayVolume),
          completedWeekVolume: roundMetric(planAndVolume.aggregate.completedWeekVolume),
          todayPlanCompletionPct: Number(planAndVolume.aggregate.todayPlanCompletionPct || 0),
          weekPlanCompletionPct: Number(planAndVolume.aggregate.weekPlanCompletionPct || 0),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/user/:userId/recovery', async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const {
      sleepHours,
      nutritionQuality,
      nutrition_quality,
      stressLevel,
      stress_level,
      proteinIntake,
      protein_intake,
      supplements,
    } = req.body || {};

    const [existingFactorRows] = await pool.execute(
      `SELECT sleep_hours, nutrition_quality, stress_level, protein_intake, supplements
       FROM recovery_factors
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    const previousFactors = buildRecoveryFactorSnapshot(existingFactorRows[0] || {});
    const normalizedSleepHours = Number(sleepHours || previousFactors.sleepHours || 7) || 7;
    const normalizedProteinIntake = normalizeRecoveryProteinIntake(
      proteinIntake ?? protein_intake,
    );
    const normalizedNutrition = normalizeRecoveryNutritionQuality(
      nutritionQuality ?? nutrition_quality,
      'optimal',
    );
    const normalizedStress = normalizeRecoveryStressLevel(
      stressLevel ?? stress_level,
      'low',
    );
    const normalizedSupplements = normalizeRecoverySupplements(supplements);
    const nextFactors = buildRecoveryFactorSnapshot({
      sleepHours: normalizedSleepHours,
      nutritionQuality: normalizedNutrition,
      stressLevel: normalizedStress,
      proteinIntake: normalizedProteinIntake,
      supplements: normalizedSupplements,
    });

    await pool.execute(
      `INSERT INTO recovery_factors (user_id, sleep_hours, nutrition_quality, stress_level, protein_intake, supplements)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       sleep_hours = VALUES(sleep_hours),
        nutrition_quality = VALUES(nutrition_quality),
        stress_level = VALUES(stress_level),
        protein_intake = VALUES(protein_intake),
        supplements = VALUES(supplements)`,
      [userId, normalizedSleepHours, normalizedNutrition, normalizedStress, normalizedProteinIntake, normalizedSupplements]
    );

    await recalculateRecoveryStatusHoursForFactors(userId, previousFactors, nextFactors);

    const recoveryScore = estimateRecoveryScoreFromFactors({
      sleepHours: normalizedSleepHours,
      nutritionQuality: normalizedNutrition,
      stressLevel: normalizedStress,
      proteinIntake: normalizedProteinIntake,
      supplements: normalizedSupplements,
    });

    const [recoveryInsertResult] = await pool.execute(
      `INSERT INTO recovery_history
          (user_id, overall_recovery_score, sleep_hours, nutrition_quality, stress_level)
        VALUES (?, ?, ?, ?, ?)`,
      [userId, recoveryScore, normalizedSleepHours, normalizedNutrition, normalizedStress],
    );

    try {
      await rebuildTodayRecoveryStatusFromSets(userId);
    } catch (rebuildError) {
      console.error('Recovery rebuild after factor update failed:', rebuildError);
    }

    const gamification = await refreshGamificationForUser(userId);
    const progression = await runProgressionEventSafely({
      userId,
      gamification,
      eventSourceType: 'sleep',
      eventSourceId: toNumber(recoveryInsertResult?.insertId, null),
      eventDescription: 'Recovery check-in completed',
    });

    return res.json({
      success: true,
      recoveryScore,
      gamification: toGamificationPayload(gamification),
      progression,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/user/:userId/recovery/recalculate-today', async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const rebuildResult = await rebuildTodayRecoveryStatusFromSets(userId);

    const gamification = await refreshGamificationForUser(userId);

    return res.json({
      success: true,
      muscles: rebuildResult.muscles,
      gamification: gamification
        ? {
            totalPoints: gamification.totalPoints,
            rank: gamification.rank,
            completedMissions: gamification.completedMissions,
            completedChallenges: gamification.completedChallenges,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/workouts/:workoutId/recovery', async (req, res) => {
  try {
    const workoutId = toNumber(req.params.workoutId);
    const userId = toNumber(req.body.userId);
    if (!workoutId || workoutId <= 0 || !userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid workoutId or userId' });
    }

    const [workoutRows] = await pool.execute(
      'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ? LIMIT 1',
      [workoutId, userId]
    );

    if (!workoutRows.length) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const session = workoutRows[0];

    const [factorRows] = await pool.execute(
      `SELECT
          u.age,
          rf.sleep_hours,
          rf.nutrition_quality,
          rf.stress_level,
          rf.protein_intake,
          rf.supplements
       FROM users u
       LEFT JOIN recovery_factors rf ON rf.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );

    const factors = factorRows[0] || {};

    const sessionMuscles = [
      ...parseMuscleGroups(session.muscle_groups),
      session.muscle_group,
    ];

    const muscles = [...new Set(sessionMuscles.map(normalizeMuscleName).filter(Boolean))];
    const targetMuscles = muscles.length ? muscles : ['Chest'];

    const perMuscle = [];
    for (const muscle of targetMuscles) {
      const recoveryHours = calculateRecoveryHours({
        muscleGroup: muscle,
        intensity: session.intensity || 'moderate',
        volume: session.volume || 'moderate',
        eccentricFocus: !!session.eccentric_focus,
        age: factors.age ?? null,
        sleepHours: Number(factors.sleep_hours ?? 7),
        nutritionQuality: factors.nutrition_quality || 'optimal',
        stressLevel: factors.stress_level || 'moderate',
        proteinIntake: factors.protein_intake ?? null,
        supplements: factors.supplements || 'none',
      });

      await pool.execute(
        `INSERT INTO muscle_recovery_status
           (user_id, muscle_group, recovery_percentage, hours_needed, hours_elapsed, last_worked)
         VALUES (?, ?, 0, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
           recovery_percentage = 0,
           hours_needed = VALUES(hours_needed),
           hours_elapsed = 0,
           last_worked = VALUES(last_worked)`,
        [userId, muscle, recoveryHours, session.completed_at],
      );

      perMuscle.push({ muscle, recoveryHours });
    }

    const gamification = await refreshGamificationForUser(userId);

    return res.json({
      success: true,
      muscles: perMuscle,
      gamification: gamification
        ? {
            totalPoints: gamification.totalPoints,
            rank: gamification.rank,
            completedMissions: gamification.completedMissions,
            completedChallenges: gamification.completedChallenges,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// MESSAGES
// =========================

router.get('/messages/:userId/:coachId', requireAuth('user', 'coach'), requireConversationAccess, async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    const coachId = toNumber(req.params.coachId);

    const [rows] = await pool.execute(
      `SELECT id, sender_id, receiver_id, sender_type, receiver_type, message, is_read, created_at
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`,
      [userId, coachId, coachId, userId]
    );

    const messages = rows.map((m) => ({
      ...m,
      read: !!m.is_read,
    }));

    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/messages/read/:coachId/:userId', authMutationRateLimit, requireAuth('coach'), requireConversationAccess, async (req, res) => {
  try {
    const coachId = toNumber(req.params.coachId);
    const userId = toNumber(req.params.userId);

    await pool.execute(
      `UPDATE messages
       SET is_read = 1, read_at = NOW()
       WHERE sender_id = ? AND receiver_id = ? AND sender_type = 'user' AND receiver_type = 'coach' AND is_read = 0`,
      [userId, coachId]
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/messages/read-user/:userId/:coachId', authMutationRateLimit, requireAuth('user'), requireConversationAccess, async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    const coachId = toNumber(req.params.coachId);

    await pool.execute(
      `UPDATE messages
       SET is_read = 1, read_at = NOW()
       WHERE sender_id = ? AND receiver_id = ? AND sender_type = 'coach' AND receiver_type = 'user' AND is_read = 0`,
      [coachId, userId]
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// NOTIFICATIONS
// =========================

router.get('/notifications/:userId', requireAuth(), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    await ensureChallengeNotificationTypesOnce();
    await ensureFriendChallengeInfrastructureOnce();

    const { userId } = req.params;
    await expireStaleFriendChallengeInvitesForUser(userId);
    const [rows] = await pool.execute(
      `SELECT id, user_id, type, title, message, data, is_read, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    const notifications = rows.map((n) => ({
      ...n,
      unread: !n.is_read,
    }));

    return res.json(notifications);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/notifications/:notificationId/read', authMutationRateLimit, requireAuth(), requireNotificationOwner, async (req, res) => {
  try {
    const { notificationId } = req.params;
    await pool.execute('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?', [notificationId]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/notifications/:userId', authMutationRateLimit, requireAuth(), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const [result] = await pool.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);
    return res.json({
      success: true,
      deletedCount: Number(result?.affectedRows || 0),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/notification-settings/:userId', requireAuth(), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    await ensureNotificationSettingsInfrastructure();
    const [rows] = await pool.execute(
      `SELECT coach_messages, rest_timer, mission_challenge
       FROM user_notification_settings
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      return res.json({
        coachMessages: true,
        restTimer: true,
        missionChallenge: true,
      });
    }

    const row = rows[0];
    return res.json({
      coachMessages: !!row.coach_messages,
      restTimer: !!row.rest_timer,
      missionChallenge: !!row.mission_challenge,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/notification-settings/:userId', authMutationRateLimit, requireAuth(), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    await ensureNotificationSettingsInfrastructure();
    const coachMessages = req.body?.coachMessages === undefined ? true : !!req.body.coachMessages;
    const restTimer = req.body?.restTimer === undefined ? true : !!req.body.restTimer;
    const missionChallenge = req.body?.missionChallenge === undefined ? true : !!req.body.missionChallenge;

    await pool.execute(
      `INSERT INTO user_notification_settings (user_id, coach_messages, rest_timer, mission_challenge)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         coach_messages = VALUES(coach_messages),
         rest_timer = VALUES(rest_timer),
         mission_challenge = VALUES(mission_challenge),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, coachMessages ? 1 : 0, restTimer ? 1 : 0, missionChallenge ? 1 : 0],
    );

    return res.json({ success: true, coachMessages, restTimer, missionChallenge });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// MISSIONS
// =========================

router.get('/missions/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const refreshed = await refreshGamificationForUser(userId);
    const missions = (refreshed?.missions || []).filter((mission) => mission?.status !== 'expired');
    return res.json(missions);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/missions/:userId/history', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    await refreshGamificationForUser(userId);

    const [rows] = await pool.execute(
      `SELECT m.title, m.points_reward, um.completed_at,
              DATE_FORMAT(um.completed_at, '%M %Y') AS period
       FROM user_missions um
       JOIN missions m ON m.id = um.mission_id
       WHERE um.user_id = ? AND um.status = 'completed' AND um.completed_at IS NOT NULL
       ORDER BY um.completed_at DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// CHALLENGES
// =========================

router.get('/challenges/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const refreshed = await refreshGamificationForUser(userId);
    const challenges = refreshed?.challenges || [];
    const visibleChallenges = challenges.filter((challenge) => challenge?.status !== 'expired');

    return res.json({
      daily: visibleChallenges.filter((c) => c.challenge_type === 'daily'),
      weekly: visibleChallenges.filter((c) => c.challenge_type === 'weekly'),
      totals: {
        completed: visibleChallenges.filter((c) => c.completed).length,
        active: visibleChallenges.filter((c) => c.status === 'active').length,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/challenges/:userId/history', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    await refreshGamificationForUser(userId);

    const [rows] = await pool.execute(
      `SELECT
          ct.title,
          ct.challenge_type,
          ct.points_reward,
          uc.instance_key,
          uc.completed_at,
          DATE_FORMAT(uc.completed_at, '%M %Y') AS period
       FROM user_challenges uc
       JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
       WHERE uc.user_id = ? AND uc.status = 'completed' AND uc.completed_at IS NOT NULL
       ORDER BY uc.completed_at DESC`,
      [userId],
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/gamification/:userId/summary', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const refreshed = await refreshGamificationForUser(userId);
    if (!refreshed) {
      return res.status(404).json({ error: 'User not found' });
    }
    const progression = await runProgressionEventSafely({
      userId,
      gamification: refreshed,
    });
    const progressionSnapshot = await getUserProgressionSnapshot(userId);

    return res.json({
      userId: refreshed.userId,
      totalPoints: refreshed.totalPoints,
      missionPoints: refreshed.missionPoints,
      challengePoints: refreshed.challengePoints,
      rank: refreshed.rank,
      nextRank: refreshed.nextRank,
      totalWorkouts: refreshed.totalWorkouts,
      totalXp: progressionSnapshot.totalXp,
      currentLevel: progressionSnapshot.currentLevel,
      nextLevel: progressionSnapshot.nextLevel,
      unlockedBadges: progressionSnapshot.unlockedBadges,
      unlockedAchievements: progressionSnapshot.unlockedAchievements,
      availableRewards: progressionSnapshot.availableRewards,
      completedMissions: refreshed.completedMissions,
      completedChallenges: refreshed.completedChallenges,
      activeMissions: refreshed.missions.filter((m) => m.status === 'active').length,
      activeChallenges: refreshed.challenges.filter((c) => c.status === 'active').length,
      progression,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/gamification/:userId/progression', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const refreshed = await refreshGamificationForUser(userId);
    if (!refreshed) {
      return res.status(404).json({ error: 'User not found' });
    }

    const progression = await runProgressionEventSafely({
      userId,
      gamification: refreshed,
    });

    const xpTransactionsLimit = toNumber(req.query?.txLimit, 20);
    const details = await getUserProgressionDetails(userId, {
      xpTransactionsLimit,
    });

    return res.json({
      userId: refreshed.userId,
      points: {
        total: refreshed.totalPoints,
        mission: refreshed.missionPoints,
        challenge: refreshed.challengePoints,
        blog: refreshed.blogPoints,
      },
      rank: {
        current: refreshed.rank,
        next: refreshed.nextRank,
      },
      xp: {
        total: details.snapshot.totalXp,
        currentLevel: details.snapshot.currentLevel,
        nextLevel: details.snapshot.nextLevel,
      },
      missions: {
        completed: refreshed.completedMissions,
        active: refreshed.missions.filter((m) => m.status === 'active').length,
      },
      challenges: {
        completed: refreshed.completedChallenges,
        active: refreshed.challenges.filter((c) => c.status === 'active').length,
      },
      badges: details.badges,
      badgeTotals: details.badgeTotals,
      achievements: details.achievements,
      achievementTotals: details.achievementTotals,
      rewards: details.rewards,
      rewardTotals: details.rewardTotals,
      xpTransactions: details.xpTransactions,
      progression,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/gamification/:userId/debug-metrics', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.params.userId);
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    await gamificationReady;
    const metrics = await collectUserGamificationMetrics(userId, new Date());
    return res.json({ userId, metrics });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// WORKOUT SETS / HISTORY
// =========================

router.get('/progress/strength/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const requestedWeeks = Number(req.query.weeks || 8);
    const weeks = Math.min(24, Math.max(4, Number.isFinite(requestedWeeks) ? requestedWeeks : 8));

    const [rows] = await pool.execute(
      `SELECT
         agg.yw AS year_week,
         agg.week_start AS week_start,
         ROUND(AVG(agg.best_e1rm), 2) AS avg_e1rm
       FROM (
         SELECT
           YEARWEEK(created_at, 1) AS yw,
           DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY) AS week_start,
           exercise_name,
           MAX(weight * (1 + (reps / 30.0))) AS best_e1rm
         FROM workout_sets
         WHERE user_id = ?
           AND completed = 1
           AND weight IS NOT NULL
           AND weight > 0
           AND reps IS NOT NULL
           AND reps BETWEEN 1 AND 12
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
         GROUP BY YEARWEEK(created_at, 1), DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY), exercise_name
       ) agg
       GROUP BY agg.yw, agg.week_start
       ORDER BY agg.yw ASC`,
      [userId, weeks],
    );

    const series = rows.map((row) => ({
      yearWeek: Number(row.year_week),
      weekStart: row.week_start,
      avgE1RM: Number(row.avg_e1rm || 0),
    }));

    if (!series.length) {
      return res.json({
        weeks: [],
        summary: {
          weeksRequested: weeks,
          baselineAvgE1RM: null,
          currentAvgE1RM: null,
          percentChange: 0,
        },
      });
    }

    const baseline = Number(series[0].avgE1RM || 0);
    const current = Number(series[series.length - 1].avgE1RM || 0);
    const percentChange = baseline > 0
      ? Number((((current - baseline) / baseline) * 100).toFixed(1))
      : 0;

    return res.json({
      weeks: series,
      summary: {
        weeksRequested: weeks,
        baselineAvgE1RM: baseline,
        currentAvgE1RM: current,
        percentChange,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const toStrengthScore = (avgE1rm) => {
  const normalized = Number(avgE1rm || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return 0;
  return Math.max(80, Math.min(320, Math.round((normalized * 2.2) + 40)));
};

const getStrengthTierLabel = (score) => {
  const normalized = Number(score || 0);
  if (normalized >= 280) return 'Elite';
  if (normalized >= 240) return 'Athlete';
  if (normalized >= 200) return 'Advanced';
  if (normalized >= 160) return 'Intermediate';
  return 'Beginner';
};

const normalizeStrengthRange = (value) => {
  const key = String(value || '6months').trim().toLowerCase();
  if (key === 'month') return { key: 'month', days: 30 };
  if (key === 'year') return { key: 'year', days: 365 };
  if (key === 'all' || key === 'alltime' || key === 'all_time') return { key: 'all', days: 0 };
  return { key: '6months', days: 182 };
};

const getHistoryBucketKey = (isoDateValue, rangeKey) => {
  const parsed = new Date(isoDateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  if (rangeKey === 'month') return formatDateISO(parsed);
  parsed.setDate(1);
  return formatDateISO(parsed);
};

const formatStrengthHistoryLabel = (bucketKey, rangeKey) => {
  const parsed = new Date(bucketKey);
  if (Number.isNaN(parsed.getTime())) return bucketKey;

  if (rangeKey === 'month') {
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return parsed.toLocaleDateString('en-US', { month: 'short' });
};

router.get('/progress/strength-score/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const normalizedRange = normalizeStrengthRange(req.query.range);

    let query = `SELECT
      DATE(created_at) AS logged_day,
      exercise_name,
      MAX(weight * (1 + (reps / 30.0))) AS best_e1rm
     FROM workout_sets
     WHERE user_id = ?
       AND completed = 1
       AND weight IS NOT NULL
       AND weight > 0
       AND reps IS NOT NULL
       AND reps BETWEEN 1 AND 20`;
    const params = [userId];

    if (normalizedRange.days > 0) {
      query += ' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
      params.push(normalizedRange.days);
    }

    query += `
      GROUP BY DATE(created_at), exercise_name
      ORDER BY logged_day ASC`;

    const [rows] = await pool.execute(query, params);

    const overallSamples = [];
    const historyBuckets = new Map();
    const muscleBuckets = new Map();

    rows.forEach((row) => {
      const e1rm = Number(row.best_e1rm || 0);
      if (!Number.isFinite(e1rm) || e1rm <= 0) return;

      const muscles = inferMusclesFromExerciseName(row.exercise_name);
      if (!muscles.length) return;

      overallSamples.push(e1rm);

      const historyKey = getHistoryBucketKey(row.logged_day, normalizedRange.key);
      if (historyKey) {
        const entry = historyBuckets.get(historyKey) || { sum: 0, count: 0 };
        entry.sum += e1rm;
        entry.count += 1;
        historyBuckets.set(historyKey, entry);
      }

      const share = e1rm / muscles.length;
      muscles.forEach((muscle) => {
        const existing = muscleBuckets.get(muscle) || { sum: 0, count: 0, best: 0 };
        existing.sum += share;
        existing.count += 1;
        existing.best = Math.max(existing.best, share);
        muscleBuckets.set(muscle, existing);
      });
    });

    const overallAvgE1RM = overallSamples.length
      ? Number((overallSamples.reduce((sum, value) => sum + value, 0) / overallSamples.length).toFixed(2))
      : 0;
    const overallScore = toStrengthScore(overallAvgE1RM);

    const history = Array.from(historyBuckets.entries())
      .map(([bucketKey, value]) => {
        const avgE1rm = value.count > 0 ? value.sum / value.count : 0;
        return {
          bucket: bucketKey,
          label: formatStrengthHistoryLabel(bucketKey, normalizedRange.key),
          avgE1RM: Number(avgE1rm.toFixed(2)),
          score: toStrengthScore(avgE1rm),
        };
      })
      .sort((left, right) => left.bucket.localeCompare(right.bucket));

    const muscles = Array.from(muscleBuckets.entries())
      .map(([name, value]) => {
        const avgE1rm = value.count > 0 ? value.sum / value.count : 0;
        return {
          name,
          avgE1RM: Number(avgE1rm.toFixed(2)),
          bestE1RM: Number(value.best.toFixed(2)),
          score: toStrengthScore(avgE1rm),
          tier: getStrengthTierLabel(toStrengthScore(avgE1rm)),
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);

    const scorePool = [
      overallScore,
      ...history.map((entry) => Number(entry.score || 0)),
      ...muscles.map((entry) => Number(entry.score || 0)),
    ].filter((score) => Number.isFinite(score) && score > 0);
    const rawMinScale = scorePool.length ? Math.min(...scorePool) : 180;
    const rawMaxScale = scorePool.length ? Math.max(...scorePool) : 240;
    let minScale = Math.max(80, Math.floor((rawMinScale - 20) / 10) * 10);
    let maxScale = Math.min(320, Math.ceil((rawMaxScale + 20) / 10) * 10);
    if (maxScale - minScale < 40) {
      maxScale = Math.min(320, minScale + 40);
    }

    return res.json({
      range: normalizedRange.key,
      summary: {
        overallScore,
        overallAvgE1RM,
        level: getStrengthTierLabel(overallScore),
        minScale,
        maxScale,
        samples: overallSamples.length,
      },
      history,
      muscles,
    });
  } catch (error) {
    console.error('GET /progress/strength-score/:userId failed', {
      userId: req.params?.userId || null,
      code: error?.code || null,
      errno: error?.errno || null,
      message: error?.message || null,
      sqlMessage: error?.sqlMessage || null,
      stack: error?.stack || null,
    });
    return res.status(500).json({ error: error.message });
  }
});

router.get('/progress/plan-muscle-distribution/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const [assignmentRows] = await pool.execute(
      `SELECT
          pa.program_id,
          pa.start_date,
          p.days_per_week,
          p.cycle_weeks
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [userId],
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.json({
        source: 'active_program_plan',
        distribution: [],
        totalSetUnits: 0,
      });
    }

    const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
    const daysPerWeek = Math.max(1, Number(assignment.days_per_week || 1));
    const weekStartDayOrder = ((currentWeek - 1) * daysPerWeek) + 1;
    const weekEndDayOrder = weekStartDayOrder + daysPerWeek - 1;

    const [workoutRows] = await pool.execute(
      `SELECT id
       FROM workouts
       WHERE program_id = ? AND day_order BETWEEN ? AND ?
       ORDER BY day_order ASC`,
      [assignment.program_id, weekStartDayOrder, weekEndDayOrder],
    );

    const workoutIds = workoutRows
      .map((row) => Number(row.id || 0))
      .filter((id) => id > 0);

    if (!workoutIds.length) {
      return res.json({
        source: 'active_program_plan',
        currentWeek,
        daysPerWeek,
        distribution: [],
        totalSetUnits: 0,
      });
    }

    const placeholders = workoutIds.map(() => '?').join(', ');
    const [exerciseRows] = await pool.execute(
      `SELECT
          exercise_name_snapshot,
          muscle_group_snapshot,
          target_sets
       FROM workout_exercises
       WHERE workout_id IN (${placeholders})`,
      workoutIds,
    );

    const normalizedNames = exerciseRows
      .map((row) => normalizeExerciseLookupName(row.exercise_name_snapshot))
      .filter(Boolean);

    const catalogIdByName = normalizedNames.length
      ? await resolveCatalogIdsByNormalizedNames(normalizedNames)
      : new Map();

    const catalogIds = [
      ...new Set(
        normalizedNames
          .map((name) => Number(catalogIdByName.get(name) || 0))
          .filter((id) => id > 0),
      ),
    ];
    const contextByCatalogId = catalogIds.length
      ? await getCatalogRecoveryContexts(catalogIds)
      : new Map();

    const byMuscle = new Map();

    exerciseRows.forEach((row) => {
      const targetSets = Number(row.target_sets || 0);
      if (!Number.isFinite(targetSets) || targetSets <= 0) return;

      const normalizedName = normalizeExerciseLookupName(row.exercise_name_snapshot);
      const catalogId = Number(catalogIdByName.get(normalizedName) || 0) || null;
      const context = catalogId ? contextByCatalogId.get(catalogId) : null;

      const entries = resolveMuscleLoadEntries({
        context,
        fallbackMuscle: row.muscle_group_snapshot,
        exerciseName: row.exercise_name_snapshot,
      });
      if (!entries.length) return;

      const totalLoad = entries.reduce((sum, entry) => sum + Number(entry.loadFactor || 1), 0) || entries.length;

      entries.forEach((entry) => {
        const share = (Number(entry.loadFactor || 1) / totalLoad) * targetSets;
        const current = Number(byMuscle.get(entry.muscle) || 0);
        byMuscle.set(entry.muscle, current + share);
      });
    });

    const totalSetUnits = Array.from(byMuscle.values()).reduce((sum, v) => sum + Number(v || 0), 0);

    const distribution = Array.from(byMuscle.entries())
      .map(([muscle, setUnits]) => ({
        muscle,
        setUnits: roundMetric(setUnits),
        percent: totalSetUnits > 0 ? roundMetric((Number(setUnits) / totalSetUnits) * 100, 1) : 0,
      }))
      .sort((a, b) => b.percent - a.percent);

    return res.json({
      source: 'active_program_plan',
      currentWeek,
      daysPerWeek,
      totalSetUnits: roundMetric(totalSetUnits),
      distribution,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/progress/muscle-distribution/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const requestedDays = Number(req.query.days || 30);
    const days = Math.min(365, Math.max(7, Number.isFinite(requestedDays) ? requestedDays : 30));

    const [rows] = await pool.execute(
      `SELECT
         exercise_name,
         COUNT(*) AS set_count,
         COALESCE(SUM(CASE
           WHEN weight IS NOT NULL AND reps IS NOT NULL THEN (weight * reps)
           ELSE 0
         END), 0) AS volume_load
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY exercise_name`,
      [userId, days],
    );

    const byMuscle = new Map();

    rows.forEach((row) => {
      const muscles = inferMusclesFromExerciseName(row.exercise_name);
      if (!muscles.length) return;

      const volumeLoad = Number(row.volume_load || 0);
      const setCount = Number(row.set_count || 0);
      // If no weight/reps are logged, keep a small proxy so the muscle still appears.
      const totalContribution = volumeLoad > 0 ? volumeLoad : (setCount * 100);
      const perMuscleContribution = totalContribution / muscles.length;

      muscles.forEach((muscle) => {
        byMuscle.set(
          muscle,
          Number((byMuscle.get(muscle) || 0) + perMuscleContribution),
        );
      });
    });

    const total = Array.from(byMuscle.values()).reduce((sum, value) => sum + Number(value || 0), 0);

    const distribution = Array.from(byMuscle.entries())
      .map(([muscle, value]) => ({
        muscle,
        value: Number(value.toFixed(2)),
        percent: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.percent - a.percent);

    return res.json({
      distribution,
      summary: {
        days,
        totalValue: Number(total.toFixed(2)),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/progress/bi-weekly-report/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const days = 14;
    const halfDays = 7;

    const [programRows] = await pool.execute(
      `SELECT p.days_per_week
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [userId],
    );

    const daysPerWeek = Number(programRows[0]?.days_per_week || 0);
    const plannedSessions = daysPerWeek > 0 ? Math.max(1, Math.round((daysPerWeek / 7) * days)) : 0;

    const [completedRows] = await pool.execute(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS completed_days
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [userId, days],
    );
    const completedSessions = Number(completedRows[0]?.completed_days || 0);
    const consistency = plannedSessions > 0
      ? Math.max(0, Math.min(100, Math.round((completedSessions / plannedSessions) * 100)))
      : 0;

    const [volumeRows] = await pool.execute(
      `SELECT COALESCE(SUM(CASE
          WHEN weight IS NOT NULL AND reps IS NOT NULL THEN (weight * reps)
          ELSE 0
        END), 0) AS volume_load
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [userId, days],
    );
    const totalVolume14d = Number(volumeRows[0]?.volume_load || 0);

    const [strengthRows] = await pool.execute(
      `SELECT
          exercise_name,
          DATE(created_at) AS logged_day,
          MAX(weight * (1 + (reps / 30.0))) AS best_e1rm
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND weight IS NOT NULL AND weight > 0
         AND reps IS NOT NULL AND reps BETWEEN 1 AND 12
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY exercise_name, DATE(created_at)`,
      [userId, days],
    );

    const cutoff = Date.now() - (halfDays * 24 * 60 * 60 * 1000);
    const byExercise = new Map();

    strengthRows.forEach((row) => {
      const exerciseName = String(row.exercise_name || '').trim();
      if (!exerciseName) return;

      const ts = new Date(row.logged_day).getTime();
      const bucket = ts >= cutoff ? 'current' : 'previous';
      const entry = byExercise.get(exerciseName) || { previous: [], current: [] };
      entry[bucket].push(Number(row.best_e1rm || 0));
      byExercise.set(exerciseName, entry);
    });

    const improvements = [];
    byExercise.forEach((value, exerciseName) => {
      if (!value.previous.length || !value.current.length) return;
      const prevAvg = value.previous.reduce((a, b) => a + b, 0) / value.previous.length;
      const currAvg = value.current.reduce((a, b) => a + b, 0) / value.current.length;
      const deltaKg = Number((currAvg - prevAvg).toFixed(1));
      if (deltaKg <= 0) return;
      improvements.push({
        title: exerciseName,
        detail: `+${deltaKg}kg increase in 1RM estimate`,
        delta: deltaKg,
      });
    });

    improvements.sort((a, b) => b.delta - a.delta);

    const [sleepRows] = await pool.execute(
      `SELECT
          AVG(CASE WHEN recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN sleep_hours END) AS avg_recent_sleep,
          AVG(CASE WHEN recorded_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                    AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                   THEN sleep_hours END) AS avg_previous_sleep
       FROM recovery_history
       WHERE user_id = ?
         AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [halfDays, halfDays, days, userId, days],
    );
    const recentSleep = Number(sleepRows[0]?.avg_recent_sleep || 0);
    const prevSleep = Number(sleepRows[0]?.avg_previous_sleep || 0);
    if (recentSleep > 0 && prevSleep > 0 && recentSleep > prevSleep) {
      improvements.push({
        title: 'Sleep Quality',
        detail: `Avg. ${recentSleep.toFixed(1)}hrs (up from ${prevSleep.toFixed(1)}hrs)`,
        delta: Number((recentSleep - prevSleep).toFixed(1)),
      });
    }

    const [distRows] = await pool.execute(
      `SELECT exercise_name, COUNT(*) AS set_count
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY exercise_name`,
      [userId, days],
    );

    const muscleBuckets = new Map([
      ['Chest', 0],
      ['Back', 0],
      ['Quadriceps', 0],
      ['Hamstrings', 0],
      ['Shoulders', 0],
      ['Arms', 0],
      ['Abs', 0],
    ]);

    distRows.forEach((row) => {
      const muscles = inferMusclesFromExerciseName(row.exercise_name);
      const setCount = Number(row.set_count || 0);
      if (!muscles.length || setCount <= 0) return;
      const share = setCount / muscles.length;
      muscles.forEach((muscle) => {
        const normalized = muscle === 'Biceps' || muscle === 'Triceps' || muscle === 'Forearms'
          ? 'Arms'
          : muscle;
        if (!muscleBuckets.has(normalized)) return;
        muscleBuckets.set(normalized, Number(muscleBuckets.get(normalized) || 0) + share);
      });
    });

    const focusTarget = Array.from(muscleBuckets.entries())
      .sort((a, b) => a[1] - b[1])[0]?.[0] || 'Legs';

    const [statusRows] = await pool.execute(
      `SELECT muscle_group, hours_needed, last_worked
       FROM muscle_recovery_status
       WHERE user_id = ?`,
      [userId],
    );

    let avgRecovery = 100;
    if (statusRows.length) {
      const scores = statusRows.map((row) => calculateDynamicRecovery(row.last_worked, row.hours_needed).score);
      avgRecovery = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    const fallbackSummary = `Consistency ${consistency}% over the last ${days} days. ${
      improvements.length
        ? `Biggest lift gain: ${improvements[0].title} (${improvements[0].detail}).`
        : 'You maintained baseline strength with no major regressions.'
    } Recovery average is ${avgRecovery}%, and total volume logged is ${(totalVolume14d / 1000).toFixed(1)}t.`;

    const nextFocus = [];
    nextFocus.push({
      title: `${focusTarget} Volume`,
      detail: `Increase ${focusTarget.toLowerCase()} training volume by 2-4 working sets next week.`,
    });

    if (consistency < 80) {
      nextFocus.push({
        title: 'Plan Adherence',
        detail: 'Hit all scheduled training days this week to improve momentum and results.',
      });
    }

    if (avgRecovery < 70) {
      nextFocus.push({
        title: 'Recovery',
        detail: 'Prioritize sleep and reduce intensity on fatigued muscle groups for 2-3 days.',
      });
    }

    const fallbackImprovements = improvements.slice(0, 3).map(({ title, detail }) => ({ title, detail }));
    const fallbackNextFocus = nextFocus.slice(0, 3);

    let reportCopy = {
      summary: fallbackSummary,
      improvements: fallbackImprovements,
      nextFocus: fallbackNextFocus,
      aiStatus: 'fallback',
      aiNotice: getBiWeeklyReportAiUnavailableNotice(req),
    };

    try {
      const claudeReport = await maybeGenerateClaudeBiWeeklyReport({
        req,
        periodDays: days,
        metrics: {
          consistency,
          completedSessions,
          plannedSessions,
          totalVolume14d,
          avgRecovery,
        },
        fallbackSummary,
        improvementCandidates: fallbackImprovements,
        nextFocusCandidates: fallbackNextFocus,
      });

      if (claudeReport) {
        reportCopy = {
          ...claudeReport,
          aiStatus: 'generated',
          aiNotice: null,
        };
      }
    } catch (claudeError) {
      console.warn('[bi-weekly-report] Claude generation failed, trying fallback provider:', claudeError?.message || claudeError);
    }

    if (reportCopy.aiStatus !== 'generated') {
      try {
        const openAiReport = await maybeGenerateOpenAIBiWeeklyReport({
          req,
          periodDays: days,
          metrics: {
            consistency,
            completedSessions,
            plannedSessions,
            totalVolume14d,
            avgRecovery,
          },
          fallbackSummary,
          improvementCandidates: fallbackImprovements,
          nextFocusCandidates: fallbackNextFocus,
        });

        if (openAiReport) {
          reportCopy = {
            ...openAiReport,
            aiStatus: 'generated',
            aiNotice: null,
          };
        }
      } catch (openAiError) {
        console.warn('[bi-weekly-report] OpenAI generation failed, using fallback:', openAiError?.message || openAiError);
      }
    }

    return res.json({
      periodDays: days,
      summary: reportCopy.summary,
      metrics: {
        consistency,
        completedSessions,
        plannedSessions,
        totalVolume14d,
        avgRecovery,
      },
      improvements: reportCopy.improvements,
      nextFocus: reportCopy.nextFocus,
      aiStatus: reportCopy.aiStatus || 'fallback',
      aiNotice: reportCopy.aiNotice || null,
      aiProvider: reportCopy.aiProvider || null,
      aiModel: reportCopy.aiModel || null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/progress/overload/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const isRepBasedExercise = (name = '') => {
      const key = String(name).toLowerCase();
      return /pull[\s-]?up|chin[\s-]?up|plank|push[\s-]?up|dip/.test(key);
    };

    const isLowerBodyExercise = (name = '') => {
      const key = String(name).toLowerCase();
      return /squat|deadlift|leg|lunge|hip thrust|glute|hamstring|calf/.test(key);
    };

    const extractTargetRepHint = (rawValue) => {
      const numbers = String(rawValue || '')
        .match(/\d+/g)
        ?.map((chunk) => Number(chunk))
        .filter((n) => Number.isFinite(n) && n > 0) || [];
      if (!numbers.length) return null;
      return Math.max(...numbers);
    };

    const buildRecommendationFromRows = (exerciseName, rows, targetRepHint = null) => {
      if (!Array.isArray(rows) || !rows.length) return null;

      const recentRows = [...rows]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 12);

      const avgRpe = recentRows.reduce((sum, row) => sum + Number(row.rpe || 7), 0) / Math.max(1, recentRows.length);
      const maxWeight = recentRows.reduce((max, row) => Math.max(max, Number(row.weight || 0)), 0);
      const maxReps = recentRows.reduce((max, row) => Math.max(max, Number(row.reps || 0)), 0);

      if (isRepBasedExercise(exerciseName) || maxWeight <= 0) {
        const repIncrease = avgRpe <= 8 ? 1 : 0;
        const currentReps = Math.max(1, Number(maxReps || 0), Number(targetRepHint || 0));
        return {
          name: exerciseName,
          current: `${currentReps} reps`,
          next: repIncrease > 0 ? `+${repIncrease} rep` : '+0 rep',
          direction: 'up',
        };
      }

      const kgIncrease = isLowerBodyExercise(exerciseName) ? 5 : 2.5;
      const canIncrease = avgRpe <= 8.5;
      return {
        name: exerciseName,
        current: `${Number(maxWeight.toFixed(1))}kg`,
        next: canIncrease ? `+${kgIncrease}kg` : '+0kg',
        direction: 'up',
      };
    };

    // Prefer overload recommendations from exercises in the user's active program week.
    const [assignmentRows] = await pool.execute(
      `SELECT
          pa.program_id,
          pa.start_date,
          p.days_per_week,
          p.cycle_weeks
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.user_id = ? AND pa.status = 'active'
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [userId],
    );

    const assignment = assignmentRows[0] || null;
    if (assignment) {
      const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
      const daysPerWeek = Math.max(1, Number(assignment.days_per_week || 1));
      const weekStartDayOrder = ((currentWeek - 1) * daysPerWeek) + 1;
      const weekEndDayOrder = weekStartDayOrder + daysPerWeek - 1;

      const [planRows] = await pool.execute(
        `SELECT
            we.exercise_name_snapshot,
            we.target_reps,
            w.id AS workout_id,
            w.day_order,
            we.order_index
         FROM workout_exercises we
         JOIN workouts w ON w.id = we.workout_id
         WHERE w.program_id = ?
           AND w.day_order BETWEEN ? AND ?
         ORDER BY w.day_order ASC, we.order_index ASC`,
        [assignment.program_id, weekStartDayOrder, weekEndDayOrder],
      );

      const plannedExercisesRaw = planRows
        .map((row) => ({
          name: String(row.exercise_name_snapshot || '').trim(),
          normalizedName: normalizeExerciseLookupName(row.exercise_name_snapshot),
          targetRepHint: extractTargetRepHint(row.target_reps),
          workoutId: Number(row.workout_id || 0),
          dayOrder: Number(row.day_order || 0),
          orderIndex: Number(row.order_index || 0),
        }))
        .filter((row) => row.name && row.normalizedName);

      const plannedByNormalized = new Map();
      plannedExercisesRaw.forEach((exercise) => {
        if (!plannedByNormalized.has(exercise.normalizedName)) {
          plannedByNormalized.set(exercise.normalizedName, exercise);
        }
      });
      const plannedExercises = Array.from(plannedByNormalized.values());

      if (plannedExercises.length) {
        const weekStart = new Date(assignment.start_date);
        weekStart.setDate(weekStart.getDate() + ((currentWeek - 1) * 7));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const [completedThisWeekRows] = await pool.execute(
          `SELECT DISTINCT exercise_name
           FROM workout_sets
           WHERE user_id = ?
             AND completed = 1
             AND DATE(created_at) BETWEEN ? AND ?`,
          [userId, formatDateISO(weekStart), formatDateISO(weekEnd)],
        );

        const completedThisWeekNormalized = new Set(
          (Array.isArray(completedThisWeekRows) ? completedThisWeekRows : [])
            .map((row) => normalizeExerciseLookupName(row.exercise_name))
            .filter(Boolean),
        );

        const missedWeekRows = await getMissedProgramDayRows({
          userId,
          dateFrom: formatDateISO(weekStart),
          dateTo: formatDateISO(weekEnd),
        });
        const missedWorkoutIds = new Set(
          (Array.isArray(missedWeekRows) ? missedWeekRows : [])
            .map((row) => Number(row?.workout_id || 0))
            .filter((id) => Number.isFinite(id) && id > 0),
        );

        const catalogIdByName = await resolveCatalogIdsByNormalizedNames(
          plannedExercises.map((exercise) => exercise.normalizedName),
        );

        const rowsByCatalogId = new Map();
        const rowsByNormalizedName = new Map();

        const [recentRows] = await pool.execute(
          `SELECT exercise_name, exercise_catalog_id, weight, reps, rpe, created_at
           FROM workout_sets
           WHERE user_id = ?
             AND completed = 1
             AND created_at >= DATE_SUB(NOW(), INTERVAL 42 DAY)`,
          [userId],
        );

        recentRows.forEach((row) => {
          const normalizedName = normalizeExerciseLookupName(row.exercise_name);
          if (normalizedName) {
            if (!rowsByNormalizedName.has(normalizedName)) rowsByNormalizedName.set(normalizedName, []);
            rowsByNormalizedName.get(normalizedName).push(row);
          }

          const catalogId = Number(row.exercise_catalog_id || 0);
          if (catalogId > 0) {
            if (!rowsByCatalogId.has(catalogId)) rowsByCatalogId.set(catalogId, []);
            rowsByCatalogId.get(catalogId).push(row);
          }
        });

        const planRecommendations = plannedExercises
          .map((exercise) => {
            const planCatalogId = Number(catalogIdByName.get(exercise.normalizedName) || 0);
            const matchedRows = planCatalogId > 0
              ? (rowsByCatalogId.get(planCatalogId) || rowsByNormalizedName.get(exercise.normalizedName) || [])
              : (rowsByNormalizedName.get(exercise.normalizedName) || []);

            const recommendation = buildRecommendationFromRows(
              exercise.name,
              matchedRows,
              exercise.targetRepHint,
            );
            if (!recommendation) return null;
            return {
              ...recommendation,
              normalizedName: exercise.normalizedName,
              workoutId: exercise.workoutId,
              dayOrder: exercise.dayOrder,
              orderIndex: exercise.orderIndex,
            };
          })
          .filter(Boolean)
          .sort((a, b) => {
            if (a.dayOrder !== b.dayOrder) return a.dayOrder - b.dayOrder;
            return a.orderIndex - b.orderIndex;
          });

        const selectedRecommendations = [];
        const selectedNames = new Set();

        planRecommendations
          .filter((rec) => !rec.next.startsWith('+0'))
          .forEach((rec) => {
            if (selectedRecommendations.length >= 3) return;
            if (completedThisWeekNormalized.has(rec.normalizedName)) return;
            if (rec.workoutId > 0 && missedWorkoutIds.has(rec.workoutId)) return;
            if (selectedNames.has(rec.normalizedName)) return;
            selectedNames.add(rec.normalizedName);
            selectedRecommendations.push({
              name: rec.name,
              current: rec.current,
              next: rec.next,
              direction: rec.direction,
            });
          });

        if (selectedRecommendations.length < 3) {
          const [fallbackRows] = await pool.execute(
            `SELECT
                exercise_name,
                MAX(created_at) AS last_logged_at,
                ROUND(AVG(COALESCE(rpe, 7)), 2) AS avg_rpe,
                MAX(COALESCE(weight, 0)) AS max_weight,
                MAX(COALESCE(reps, 0)) AS max_reps,
                COUNT(*) AS set_count
             FROM workout_sets
             WHERE user_id = ?
               AND completed = 1
               AND created_at >= DATE_SUB(NOW(), INTERVAL 28 DAY)
             GROUP BY exercise_name
             HAVING COUNT(*) >= 2
             ORDER BY MAX(created_at) DESC
             LIMIT 24`,
            [userId],
          );

          const fallbackRecommendations = (Array.isArray(fallbackRows) ? fallbackRows : [])
            .map((row) => {
              const exerciseName = String(row.exercise_name || '').trim();
              const avgRpe = Number(row.avg_rpe || 7);
              const maxWeight = Number(row.max_weight || 0);
              const maxReps = Number(row.max_reps || 0);

              if (isRepBasedExercise(exerciseName) || maxWeight <= 0) {
                const repIncrease = avgRpe <= 8 ? 1 : 0;
                return {
                  name: exerciseName,
                  current: `${Math.max(1, maxReps)} reps`,
                  next: repIncrease > 0 ? `+${repIncrease} rep` : '+0 rep',
                  direction: 'up',
                  normalizedName: normalizeExerciseLookupName(exerciseName),
                };
              }

              const kgIncrease = isLowerBodyExercise(exerciseName) ? 5 : 2.5;
              const canIncrease = avgRpe <= 8.5;
              return {
                name: exerciseName,
                current: `${Number(maxWeight.toFixed(1))}kg`,
                next: canIncrease ? `+${kgIncrease}kg` : '+0kg',
                direction: 'up',
                normalizedName: normalizeExerciseLookupName(exerciseName),
              };
            })
            .filter((rec) => rec && rec.name && rec.normalizedName && !rec.next.startsWith('+0'));

          fallbackRecommendations.forEach((rec) => {
            if (selectedRecommendations.length >= 3) return;
            if (completedThisWeekNormalized.has(rec.normalizedName)) return;
            if (selectedNames.has(rec.normalizedName)) return;
            selectedNames.add(rec.normalizedName);
            selectedRecommendations.push({
              name: rec.name,
              current: rec.current,
              next: rec.next,
              direction: rec.direction,
            });
          });
        }

        const filteredPlanRecommendations = selectedRecommendations.map((rec) => ({
            name: rec.name,
            current: rec.current,
            next: rec.next,
            direction: rec.direction,
          }));

        return res.json({
          recommendations: filteredPlanRecommendations,
          meta: {
            source: 'active_program_plan',
            currentWeek,
            daysPerWeek,
            plannedExercises: plannedExercises.length,
            completedExercisesThisWeek: completedThisWeekNormalized.size,
            missedWorkoutDaysThisWeek: missedWorkoutIds.size,
            sourceDays: 42,
          },
        });
      }
    }

    const [rows] = await pool.execute(
      `SELECT
          exercise_name,
          MAX(created_at) AS last_logged_at,
          ROUND(AVG(COALESCE(rpe, 7)), 2) AS avg_rpe,
          MAX(COALESCE(weight, 0)) AS max_weight,
          MAX(COALESCE(reps, 0)) AS max_reps,
          COUNT(*) AS set_count
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND created_at >= DATE_SUB(NOW(), INTERVAL 28 DAY)
       GROUP BY exercise_name
       HAVING COUNT(*) >= 2
       ORDER BY MAX(created_at) DESC
       LIMIT 12`,
      [userId],
    );

    const recommendations = rows.map((row) => {
      const exerciseName = String(row.exercise_name || '').trim();
      const avgRpe = Number(row.avg_rpe || 7);
      const maxWeight = Number(row.max_weight || 0);
      const maxReps = Number(row.max_reps || 0);

      if (isRepBasedExercise(exerciseName) || maxWeight <= 0) {
        const repIncrease = avgRpe <= 8 ? 1 : 0;
        return {
          name: exerciseName,
          current: `${Math.max(1, maxReps)} reps`,
          next: repIncrease > 0 ? `+${repIncrease} rep` : '+0 rep',
          direction: 'up',
        };
      }

      const kgIncrease = isLowerBodyExercise(exerciseName) ? 5 : 2.5;
      const canIncrease = avgRpe <= 8.5;
      return {
        name: exerciseName,
        current: `${Number(maxWeight.toFixed(1))}kg`,
        next: canIncrease ? `+${kgIncrease}kg` : '+0kg',
        direction: 'up',
      };
    });

    const filtered = recommendations
      .filter((rec) => !rec.next.startsWith('+0'))
      .slice(0, 3);

    return res.json({
      recommendations: filtered,
      meta: {
        sourceDays: 28,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/workout-sets', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const {
      userId,
      sessionId = null,
      workoutExerciseId = null,
      exerciseName,
      exerciseCatalogId = null,
      setNumber,
      weight,
      reps,
      rpe = null,
      duration = null,
      restTime = null,
      completed = true,
      notes = null,
      applyRecovery = false,
    } = req.body;

    const normalizedUserId = toNumber(userId);
    if (!normalizedUserId || !exerciseName || !setNumber) {
      return res.status(400).json({ error: 'userId, exerciseName and setNumber are required' });
    }

    const explicitCatalogId = toNumber(exerciseCatalogId, null);
    const normalizedExerciseName = normalizeExerciseLookupName(exerciseName);
    let resolvedCatalogId = explicitCatalogId && explicitCatalogId > 0 ? explicitCatalogId : null;

    if (!resolvedCatalogId && normalizedExerciseName) {
      const resolvedByName = await resolveCatalogIdsByNormalizedNames([normalizedExerciseName]);
      resolvedCatalogId = resolvedByName.get(normalizedExerciseName) || null;
    }

    await pool.execute(
      `INSERT INTO workout_sets
         (user_id, session_id, workout_exercise_id, exercise_name, exercise_catalog_id, set_number, weight, reps, rpe, duration_seconds, rest_seconds, completed, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         exercise_catalog_id = COALESCE(VALUES(exercise_catalog_id), exercise_catalog_id),
         weight = VALUES(weight),
         reps = VALUES(reps),
         rpe = VALUES(rpe),
         duration_seconds = VALUES(duration_seconds),
         rest_seconds = VALUES(rest_seconds),
         completed = VALUES(completed),
         notes = VALUES(notes),
         created_at = CURRENT_TIMESTAMP`,
      [
        normalizedUserId,
        sessionId,
        workoutExerciseId,
        exerciseName,
        resolvedCatalogId,
        setNumber,
        weight || null,
        reps || null,
        rpe,
        duration,
        restTime,
        completed ? 1 : 0,
        notes,
      ],
    );

    // Optional recovery rebuild (used only when explicitly requested).
    if (completed && applyRecovery === true && resolvedCatalogId) {
      const recoveryContextByCatalogId = await getCatalogRecoveryContexts([resolvedCatalogId]);
      const context = recoveryContextByCatalogId.get(resolvedCatalogId);

      if (context && context.muscles.length) {
        const [factorRows] = await pool.execute(
          `SELECT
              u.age,
              rf.sleep_hours,
              rf.nutrition_quality,
              rf.stress_level,
              rf.protein_intake,
              rf.supplements
           FROM users u
           LEFT JOIN recovery_factors rf ON rf.user_id = u.id
           WHERE u.id = ?
           LIMIT 1`,
          [normalizedUserId],
        );

        const factors = factorRows[0] || {};
        const inferredIntensity = deriveIntensityFromRpe(rpe);
        const inferredVolume = deriveVolumeFromSetCount(setNumber);
        const eccentricFocus = Number(context.profile.eccentricBiasScore || 1) >= 1.05;

        await Promise.all(
          context.muscles.map(async (muscleEntry) => {
            const loadMultiplier = computeCatalogRecoveryLoadMultiplier(
              context.profile,
              muscleEntry.loadFactor,
            );
            const hoursNeeded = calculateRecoveryHours({
              muscleGroup: muscleEntry.muscle,
              intensity: inferredIntensity,
              volume: inferredVolume,
              eccentricFocus,
              age: factors.age ?? null,
              sleepHours: Number(factors.sleep_hours ?? 7),
              nutritionQuality: factors.nutrition_quality || 'optimal',
              stressLevel: factors.stress_level || 'moderate',
              proteinIntake: factors.protein_intake ?? null,
              supplements: factors.supplements || 'none',
              loadMultiplier,
            });

            await pool.execute(
              `INSERT INTO muscle_recovery_status
                 (user_id, muscle_group, recovery_percentage, hours_needed, hours_elapsed, last_worked)
               VALUES (?, ?, 0, ?, 0, NOW())
                ON DUPLICATE KEY UPDATE
                  recovery_percentage = 0,
                  hours_needed = GREATEST(hours_needed, VALUES(hours_needed)),
                  hours_elapsed = 0,
                  last_worked = NOW()`,
              [normalizedUserId, muscleEntry.muscle, hoursNeeded],
            );
          }),
        );
      }
    }

    const gamification = completed
      ? await refreshGamificationForUser(normalizedUserId)
      : null;
    const progression = completed
      ? await runProgressionEventSafely({
          userId: normalizedUserId,
          gamification,
        })
      : null;

    return res.json({
      success: true,
      exerciseCatalogId: resolvedCatalogId || null,
      gamification: toGamificationPayload(gamification),
      progression,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/workout-sets/today/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.execute(
      `SELECT exercise_name, MAX(created_at) AS last_logged_at
       FROM workout_sets
       WHERE user_id = ? AND DATE(created_at) = CURDATE() AND completed = 1
       GROUP BY exercise_name`,
      [userId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/workout-sets/:userId/:exerciseName', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const { userId, exerciseName } = req.params;

    const [rows] = await pool.execute(
      `SELECT id, user_id, session_id, exercise_name, set_number, weight, reps, rpe, duration_seconds, rest_seconds, completed, notes, created_at
       FROM workout_sets
       WHERE user_id = ? AND exercise_name = ?
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId, decodeURIComponent(exerciseName)]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const toSummaryDate = (value) => {
  const candidate = String(value || '').trim();
  if (!candidate) return formatDateISO(new Date());
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateISO(parsed);
};

const parseSummaryJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapWorkoutDaySummaryRow = (row) => ({
  id: Number(row.id || 0),
  userId: Number(row.user_id || 0),
  summaryDate: row.summary_date ? formatDateISO(row.summary_date) : null,
  workoutName: String(row.workout_name || ''),
  durationSeconds: Number(row.duration_seconds || 0),
  estimatedCalories: Number(row.estimated_calories || 0),
  totalVolume: Number(row.total_volume || 0),
  recordsCount: Number(row.records_count || 0),
  muscles: parseSummaryJsonArray(row.muscles_json),
  exercises: parseSummaryJsonArray(row.exercises_json),
  summaryText: String(row.summary_text || '').trim(),
  createdAt: toIsoTimestamp(row.created_at),
  updatedAt: toIsoTimestamp(row.updated_at),
});

const normalizeSessionIntensity = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return ['low', 'moderate', 'high'].includes(key) ? key : 'moderate';
};

const normalizeSessionVolume = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return ['low', 'moderate', 'high'].includes(key) ? key : 'moderate';
};

const extractSummaryMuscles = (payload = {}) => {
  const fromSummaryObjects = Array.isArray(payload.muscles)
    ? payload.muscles.map((entry) => entry?.name)
    : [];
  const fromMuscleGroups = parseMuscleGroups(payload.muscleGroups);
  const fromPrimary = payload.muscleGroup ? [payload.muscleGroup] : [];

  return [...new Set(
    [...fromSummaryObjects, ...fromMuscleGroups, ...fromPrimary]
      .map((value) => normalizeMuscleName(String(value || '')))
      .filter(Boolean),
  )];
};

const resolveActiveProgramAssignmentId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id
     FROM program_assignments
     WHERE user_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  return toNumber(rows[0]?.id, null);
};

const upsertCompletedWorkoutSessionForDay = async (input = {}) => {
  const normalizedUserId = toNumber(input.userId, null);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('userId must be a positive integer');
  }

  const summaryDate = toSummaryDate(input.summaryDate);
  if (!summaryDate) {
    throw new Error('summaryDate is invalid');
  }

  const columns = await getWorkoutSessionColumns();
  if (!columns.size) {
    throw new Error('workout_sessions table is missing');
  }

  const dateColumn = columns.has('completed_at')
    ? 'completed_at'
    : (columns.has('created_at') ? 'created_at' : null);
  if (!dateColumn) {
    throw new Error('workout_sessions table requires completed_at or created_at');
  }

  const workoutName = String(input.workoutName || '').trim();
  const normalizedMuscles = extractSummaryMuscles(input);
  const firstMuscle = normalizedMuscles[0] || 'Chest';
  const durationMinutes = Math.max(0, Math.round(Number(input.durationSeconds || 0) / 60));
  const intensity = normalizeSessionIntensity(input.intensity);
  const volume = normalizeSessionVolume(input.volume);
  const exercises = Array.isArray(input.exercises) ? input.exercises.slice(0, 100) : [];
  const completedAt = `${summaryDate} 23:59:59`;

  let programAssignmentId = toNumber(input.programAssignmentId, null);
  if ((!programAssignmentId || programAssignmentId <= 0) && columns.has('program_assignment_id')) {
    programAssignmentId = await resolveActiveProgramAssignmentId(normalizedUserId);
  }

  const writeEntries = [];
  const pushWrite = (column, value) => {
    if (!columns.has(column)) return;
    if (value === undefined) return;
    writeEntries.push([column, value]);
  };

  pushWrite('status', 'completed');
  pushWrite('completed_at', completedAt);
  pushWrite('program_assignment_id', Number.isInteger(programAssignmentId) && programAssignmentId > 0 ? programAssignmentId : undefined);
  pushWrite('workout_name', workoutName || undefined);
  pushWrite('muscle_groups', JSON.stringify(normalizedMuscles));
  pushWrite('muscle_group', firstMuscle);
  pushWrite('intensity', intensity);
  pushWrite('volume', volume);
  pushWrite('eccentric_focus', toBooleanFlag(input.eccentricFocus, false) ? 1 : 0);
  pushWrite('duration_minutes', durationMinutes);
  pushWrite('exercises', JSON.stringify(exercises));

  let existingSql = `SELECT id FROM workout_sessions WHERE user_id = ? AND DATE(${dateColumn}) = ?`;
  const existingParams = [normalizedUserId, summaryDate];
  if (columns.has('program_assignment_id') && Number.isInteger(programAssignmentId) && programAssignmentId > 0) {
    existingSql += ' AND program_assignment_id = ?';
    existingParams.push(programAssignmentId);
  } else if (columns.has('workout_name') && workoutName) {
    existingSql += ' AND LOWER(TRIM(workout_name)) = ?';
    existingParams.push(workoutName.toLowerCase());
  }
  existingSql += ' ORDER BY id DESC LIMIT 1';

  const [existingRows] = await pool.execute(existingSql, existingParams);
  const existingId = toNumber(existingRows[0]?.id, null);

  if (Number.isInteger(existingId) && existingId > 0) {
    const updateColumns = writeEntries
      .filter(([column]) => column !== 'user_id')
      .map(([column]) => `${column} = ?`);
    const updateValues = writeEntries
      .filter(([column]) => column !== 'user_id')
      .map(([, value]) => value);

    if (columns.has('updated_at')) {
      updateColumns.push('updated_at = CURRENT_TIMESTAMP');
    }

    if (updateColumns.length > 0) {
      await pool.execute(
        `UPDATE workout_sessions SET ${updateColumns.join(', ')} WHERE id = ? LIMIT 1`,
        [...updateValues, existingId],
      );
    }

    return { sessionId: existingId, created: false };
  }

  const insertColumns = ['user_id'];
  const insertValues = [normalizedUserId];

  writeEntries
    .filter(([column]) => column !== 'user_id')
    .forEach(([column, value]) => {
      insertColumns.push(column);
      insertValues.push(value);
    });

  const placeholders = insertColumns.map(() => '?').join(', ');
  const [insertResult] = await pool.execute(
    `INSERT INTO workout_sessions (${insertColumns.join(', ')}) VALUES (${placeholders})`,
    insertValues,
  );

  return {
    sessionId: toNumber(insertResult?.insertId, null),
    created: true,
  };
};

router.post('/workout-sessions/complete-day', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const userId = toNumber(req.body?.userId, null);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const sessionResult = await upsertCompletedWorkoutSessionForDay({
      userId,
      summaryDate: req.body?.summaryDate,
      workoutName: req.body?.workoutName,
      durationSeconds: req.body?.durationSeconds,
      muscles: req.body?.muscles,
      muscleGroups: req.body?.muscleGroups,
      muscleGroup: req.body?.muscleGroup,
      exercises: req.body?.exercises,
      intensity: req.body?.intensity,
      volume: req.body?.volume,
      eccentricFocus: req.body?.eccentricFocus,
      programAssignmentId: req.body?.programAssignmentId,
    });

    const gamification = await refreshGamificationForUser(userId);
    const sourceType = req.body?.programAssignmentId ? 'planned_workout' : 'workout';
    const progression = await runProgressionEventSafely({
      userId,
      gamification,
      eventSourceType: sourceType,
      eventSourceId: sessionResult.sessionId,
      eventDescription: sessionResult.created
        ? 'Workout day completed'
        : 'Workout day completion confirmed',
    });

    return res.json({
      success: true,
      sessionId: sessionResult.sessionId,
      created: sessionResult.created,
      gamification: toGamificationPayload(gamification),
      progression,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to finalize workout session' });
  }
});

router.post('/workout-summaries', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const userId = toPositiveInteger(req.body?.userId);
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const workoutName = String(req.body?.workoutName || '').trim();
    if (!workoutName) {
      return res.status(400).json({ error: 'workoutName is required' });
    }

    const summaryDate = toSummaryDate(req.body?.summaryDate);
    if (!summaryDate) {
      return res.status(400).json({ error: 'summaryDate is invalid' });
    }

    const durationSeconds = Math.max(0, Math.round(Number(req.body?.durationSeconds || 0)));
    const estimatedCalories = Math.max(0, Math.round(Number(req.body?.estimatedCalories || 0)));
    const totalVolume = Number(Number(req.body?.totalVolume || 0).toFixed(2));
    const recordsCount = Math.max(0, Math.round(Number(req.body?.recordsCount || 0)));

    const musclesRaw = Array.isArray(req.body?.muscles) ? req.body.muscles : [];
    const muscles = musclesRaw
      .map((entry) => ({
        name: String(entry?.name || '').trim(),
        score: Math.max(0, Math.min(100, Math.round(Number(entry?.score || 0)))),
      }))
      .filter((entry) => entry.name)
      .slice(0, 12);

    const exercisesRaw = Array.isArray(req.body?.exercises) ? req.body.exercises : [];
    const exercises = exercisesRaw
      .map((exercise) => {
        const name = String(exercise?.name || '').trim();
        if (!name) return null;

        const setsRaw = Array.isArray(exercise?.sets) ? exercise.sets : [];
        const sets = setsRaw
          .map((setRow) => ({
            set: Math.max(1, Math.round(Number(setRow?.set || 1))),
            reps: Math.max(0, Math.round(Number(setRow?.reps || 0))),
            weight: Number(Number(setRow?.weight || 0).toFixed(2)),
          }))
          .slice(0, 20);

        const targetMusclesRaw = Array.isArray(exercise?.targetMuscles) ? exercise.targetMuscles : [];
        const targetMuscles = targetMusclesRaw
          .map((muscle) => String(muscle || '').trim())
          .filter(Boolean)
          .slice(0, 6);

        return {
          name,
          sets,
          totalSets: Math.max(0, Math.round(Number(exercise?.totalSets || sets.length))),
          totalReps: Math.max(0, Math.round(Number(exercise?.totalReps || 0))),
          topWeight: Number(Number(exercise?.topWeight || 0).toFixed(2)),
          volume: Number(Number(exercise?.volume || 0).toFixed(2)),
          targetMuscles,
        };
      })
      .filter(Boolean)
      .slice(0, 40);

    const summaryText = String(req.body?.summaryText || '').trim();

    await pool.execute(
      `INSERT INTO workout_day_summaries
         (user_id, summary_date, workout_name, duration_seconds, estimated_calories, total_volume, records_count, muscles_json, exercises_json, summary_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         workout_name = VALUES(workout_name),
         duration_seconds = VALUES(duration_seconds),
         estimated_calories = VALUES(estimated_calories),
         total_volume = VALUES(total_volume),
         records_count = VALUES(records_count),
         muscles_json = VALUES(muscles_json),
         exercises_json = VALUES(exercises_json),
         summary_text = VALUES(summary_text),
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        summaryDate,
        workoutName,
        durationSeconds,
        estimatedCalories,
        Number.isFinite(totalVolume) ? totalVolume : 0,
        recordsCount,
        JSON.stringify(muscles),
        JSON.stringify(exercises),
        summaryText || null,
      ],
    );

    const [rows] = await pool.execute(
      `SELECT
         id,
         user_id,
         summary_date,
         workout_name,
         duration_seconds,
         estimated_calories,
         total_volume,
         records_count,
         muscles_json,
         exercises_json,
         summary_text,
         created_at,
         updated_at
       FROM workout_day_summaries
       WHERE user_id = ? AND summary_date = ?
       LIMIT 1`,
      [userId, summaryDate],
    );

    const gamification = await refreshGamificationForUser(userId);

    return res.status(201).json({
      summary: rows.length ? mapWorkoutDaySummaryRow(rows[0]) : null,
      gamification: toGamificationPayload(gamification),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to save workout summary' });
  }
});

router.get('/workout-summaries/latest/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toPositiveInteger(req.params?.userId);
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const [rows] = await pool.execute(
      `SELECT
         id,
         user_id,
         summary_date,
         workout_name,
         duration_seconds,
         estimated_calories,
         total_volume,
         records_count,
         muscles_json,
         exercises_json,
         summary_text,
         created_at,
         updated_at
       FROM workout_day_summaries
       WHERE user_id = ?
       ORDER BY summary_date DESC, updated_at DESC, id DESC
       LIMIT 1`,
      [userId],
    );

    return res.json({
      summary: rows.length ? mapWorkoutDaySummaryRow(rows[0]) : null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch latest workout summary' });
  }
});

router.get('/workout-summaries/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = toPositiveInteger(req.params?.userId);
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const limit = Math.min(60, Math.max(1, toPositiveInteger(req.query?.limit) || 20));
    const [rows] = await pool.execute(
      `SELECT
         id,
         user_id,
         summary_date,
         workout_name,
         duration_seconds,
         estimated_calories,
         total_volume,
         records_count,
         muscles_json,
         exercises_json,
         summary_text,
         created_at,
         updated_at
       FROM workout_day_summaries
       WHERE user_id = ?
       ORDER BY summary_date DESC, updated_at DESC, id DESC
       LIMIT ?`,
      [userId, limit],
    );

    return res.json({
      summaries: rows.map(mapWorkoutDaySummaryRow),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch workout summaries' });
  }
});

router.get('/exercises/catalog/filters', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT body_part
       FROM exercise_catalog
       WHERE is_active = 1`,
    );

    const buckets = new Set(['All']);
    rows.forEach((row) => {
      const group = normalizeCatalogMuscleGroup(row.body_part);
      if (group !== 'Other') buckets.add(group);
    });

    const preferredOrder = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs'];
    const filters = preferredOrder.filter((f) => buckets.has(f));
    return res.json({ filters });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/exercises/catalog', async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 200);
    const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 200));
    const filter = String(req.query.filter || 'All').trim();
    const search = String(req.query.search || '').trim().toLowerCase();

    const whereParts = ['ec.is_active = 1'];
    const params = [];

    if (search) {
      whereParts.push('(LOWER(ec.canonical_name) LIKE ? OR LOWER(COALESCE(ec.description, \'\')) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const filterLower = filter.toLowerCase();
    if (filterLower !== 'all') {
      if (filterLower === 'chest') whereParts.push(`LOWER(COALESCE(ec.body_part, '')) REGEXP 'chest|pector'`);
      else if (filterLower === 'back') whereParts.push(`LOWER(COALESCE(ec.body_part, '')) REGEXP 'back|lat|trap|rhomboid|erector'`);
      else if (filterLower === 'legs') whereParts.push(`LOWER(COALESCE(ec.body_part, '')) REGEXP 'quad|hamstring|glute|calf|leg'`);
      else if (filterLower === 'shoulders') whereParts.push(`LOWER(COALESCE(ec.body_part, '')) REGEXP 'shoulder|delt'`);
      else if (filterLower === 'arms') whereParts.push(`LOWER(COALESCE(ec.body_part, '')) REGEXP 'bicep|tricep|forearm|arm'`);
      else if (filterLower === 'abs') whereParts.push(`LOWER(COALESCE(ec.body_part, '')) REGEXP 'abs|abdom|core|oblique'`);
    }

    const [rows] = await pool.query(
      `SELECT
         ec.id,
         ec.canonical_name,
         ec.body_part,
         ec.description,
         ec.equipment,
         ec.level,
         ec.exercise_type
       FROM exercise_catalog ec
       WHERE ${whereParts.join(' AND ')}
       ORDER BY ec.canonical_name ASC
       LIMIT ?`,
      [...params, limit],
    );

    const normalized = rows.map((row) => {
      const videoLink = resolveExerciseVideoManifest({
        name: row.canonical_name,
        bodyPart: row.body_part,
      });

      return {
        id: Number(row.id),
        name: row.canonical_name,
        muscle: normalizeCatalogMuscleGroup(row.body_part),
        bodyPart: row.body_part || null,
        description: row.description || null,
        equipment: row.equipment || null,
        level: row.level || null,
        type: row.exercise_type || null,
        hasLinkedVideo: videoLink.matchType === 'alias',
        linkedVideoAsset: videoLink.fileName || null,
        linkedVideoMatchType: videoLink.matchType,
      };
    });

    return res.json({ exercises: normalized });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const BLOG_CATEGORIES = new Set(['Training', 'Nutrition', 'Recovery', 'Mindset']);
const BLOG_MEDIA_TYPES = new Set(['image', 'video']);
const BLOG_REACTIONS = new Set(['love', 'fire', 'power', 'wow']);

const toPositiveInteger = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
};

const clampBlogLimit = (value, fallback = 20, max = 50) => {
  const parsed = toPositiveInteger(value);
  if (parsed == null) return fallback;
  return Math.min(max, parsed);
};

const isFemaleGender = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'female' || normalized === 'woman' || normalized === 'femme';
};

const normalizeBlogReactionType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!BLOG_REACTIONS.has(normalized)) return null;
  return normalized;
};

const toIsoTimestamp = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const decodeHtmlAttributeValue = (value) =>
  String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&apos;/gi, '\'')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const normalizeBlogMediaUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const srcMatch = raw.match(/<\s*(?:img|video)\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const extracted = srcMatch ? (srcMatch[1] || srcMatch[2] || srcMatch[3] || '') : raw;

  return decodeHtmlAttributeValue(extracted)
    .trim()
    .replace(/^['"]+|['"]+$/g, '');
};

const mapBlogPostRow = (row) => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  authorName: row.author_name || 'User',
  authorGender: row.author_gender || '',
  womenOnly: Number(row.women_only || 0) === 1,
  avatarUrl: row.avatar_url || '',
  latestCommentAvatarUrl: row.latest_comment_avatar_url || '',
  category: row.category || 'Recovery',
  description: row.description || '',
  mediaType: row.media_type || 'image',
  mediaUrl: normalizeBlogMediaUrl(row.media_url),
  mediaAlt: row.media_alt || 'Post media',
  createdAt: toIsoTimestamp(row.created_at),
  metrics: {
    views: Number(row.views_count || 0),
    likes: Number(row.likes_count || 0),
    reactions: {
      love: Number(row.love_count || 0),
      fire: Number(row.fire_count || 0),
      power: Number(row.power_count || 0),
      wow: Number(row.wow_count || 0),
    },
    reactionsTotal: Number(row.reactions_total || row.likes_count || 0),
    comments: Number(row.comments_count || 0),
  },
  likedByMe: Number(row.liked_by_viewer || 0) === 1,
  reactionByMe: normalizeBlogReactionType(row.reaction_by_viewer),
});

const mapBlogCommentRow = (row) => ({
  id: Number(row.id),
  postId: Number(row.post_id),
  userId: Number(row.user_id),
  authorName: row.author_name || 'User',
  avatarUrl: row.avatar_url || '',
  text: row.comment_text || '',
  createdAt: toIsoTimestamp(row.created_at),
});

const getBlogReactionSummary = async (postId, userId = 0) => {
  const [reactionRows] = await pool.execute(
    `SELECT
       SUM(reaction_type = 'love') AS love_count,
       SUM(reaction_type = 'fire') AS fire_count,
       SUM(reaction_type = 'power') AS power_count,
       SUM(reaction_type = 'wow') AS wow_count,
       COUNT(*) AS reaction_count
     FROM blog_post_reactions
     WHERE post_id = ?`,
    [postId],
  );

  const [legacyLikeRows] = await pool.execute(
    `SELECT COUNT(*) AS legacy_like_count
     FROM blog_post_likes
     WHERE post_id = ?`,
    [postId],
  );

  const legacyLikeCount = Number(legacyLikeRows[0]?.legacy_like_count || 0);
  const loveCount = Number(reactionRows[0]?.love_count || 0) + legacyLikeCount;
  const fireCount = Number(reactionRows[0]?.fire_count || 0);
  const powerCount = Number(reactionRows[0]?.power_count || 0);
  const wowCount = Number(reactionRows[0]?.wow_count || 0);
  const total = Number(reactionRows[0]?.reaction_count || 0) + legacyLikeCount;

  let reactionByViewer = null;
  if (userId) {
    const [viewerReactionRows] = await pool.execute(
      `SELECT reaction_type
       FROM blog_post_reactions
       WHERE post_id = ? AND user_id = ?
       LIMIT 1`,
      [postId, userId],
    );
    reactionByViewer = normalizeBlogReactionType(viewerReactionRows[0]?.reaction_type);

    if (!reactionByViewer) {
      const [viewerLikeRows] = await pool.execute(
        `SELECT 1
         FROM blog_post_likes
         WHERE post_id = ? AND user_id = ?
         LIMIT 1`,
        [postId, userId],
      );
      if (viewerLikeRows.length) reactionByViewer = 'love';
    }
  }

  return {
    total,
    loveCount,
    fireCount,
    powerCount,
    wowCount,
    reactionByViewer,
  };
};

const fetchBlogPostById = async (postId, viewerUserId = 0) => {
  const safeViewerUserId = toPositiveInteger(viewerUserId) || 0;
  const profileImageColumn = await getProfileImageColumn();
  const avatarSelect = profileImageColumn ? `COALESCE(u.${profileImageColumn}, '') AS avatar_url` : `'' AS avatar_url`;
  const latestCommentAvatarSelect = profileImageColumn
    ? `(SELECT COALESCE(cu.${profileImageColumn}, '')
        FROM blog_post_comments c2
        INNER JOIN users cu ON cu.id = c2.user_id
        WHERE c2.post_id = bp.id
          AND cu.is_active = 1
          AND (cu.banned_until IS NULL OR cu.banned_until < NOW())
        ORDER BY c2.created_at DESC, c2.id DESC
        LIMIT 1) AS latest_comment_avatar_url`
    : `'' AS latest_comment_avatar_url`;

  const [rows] = await pool.execute(
    `SELECT
       bp.id,
       bp.user_id,
       bp.category,
       bp.description,
       bp.media_type,
       bp.media_url,
       bp.media_alt,
       COALESCE(bp.women_only, 0) AS women_only,
       bp.created_at,
       u.name AS author_name,
       COALESCE(u.gender, '') AS author_gender,
       ${avatarSelect},
       ${latestCommentAvatarSelect},
       COALESCE(r.love_count, 0) + COALESCE(l.legacy_like_count, 0) AS love_count,
       COALESCE(r.fire_count, 0) AS fire_count,
       COALESCE(r.power_count, 0) AS power_count,
       COALESCE(r.wow_count, 0) AS wow_count,
       COALESCE(r.reaction_count, 0) + COALESCE(l.legacy_like_count, 0) AS reactions_total,
       COALESCE(r.reaction_count, 0) + COALESCE(l.legacy_like_count, 0) AS likes_count,
       COALESCE(v.view_count, 0) AS views_count,
       COALESCE(c.comment_count, 0) AS comments_count,
       COALESCE(ur.reaction_type, CASE WHEN ul.user_id IS NULL THEN NULL ELSE 'love' END) AS reaction_by_viewer,
       CASE WHEN ur.user_id IS NULL AND ul.user_id IS NULL THEN 0 ELSE 1 END AS liked_by_viewer
     FROM blog_posts bp
     INNER JOIN users u ON u.id = bp.user_id
     LEFT JOIN (
       SELECT post_id, COUNT(*) AS legacy_like_count
       FROM blog_post_likes
       GROUP BY post_id
     ) l ON l.post_id = bp.id
     LEFT JOIN (
       SELECT
         post_id,
         SUM(reaction_type = 'love') AS love_count,
         SUM(reaction_type = 'fire') AS fire_count,
         SUM(reaction_type = 'power') AS power_count,
         SUM(reaction_type = 'wow') AS wow_count,
         COUNT(*) AS reaction_count
       FROM blog_post_reactions
       GROUP BY post_id
     ) r ON r.post_id = bp.id
     LEFT JOIN (
       SELECT post_id, COUNT(*) AS view_count
       FROM blog_post_views
       GROUP BY post_id
     ) v ON v.post_id = bp.id
     LEFT JOIN (
       SELECT c.post_id, COUNT(*) AS comment_count
       FROM blog_post_comments c
       INNER JOIN users cu ON cu.id = c.user_id
       WHERE cu.is_active = 1
         AND (cu.banned_until IS NULL OR cu.banned_until < NOW())
       GROUP BY c.post_id
     ) c ON c.post_id = bp.id
     LEFT JOIN blog_post_reactions ur
       ON ur.post_id = bp.id
      AND ur.user_id = ?
     LEFT JOIN blog_post_likes ul
       ON ul.post_id = bp.id
      AND ul.user_id = ?
     WHERE bp.id = ?
       AND u.is_active = 1
       AND (u.banned_until IS NULL OR u.banned_until < NOW())
     LIMIT 1`,
    [safeViewerUserId, safeViewerUserId, postId],
  );

  if (!rows.length) return null;
  return mapBlogPostRow(rows[0]);
};

router.get('/blogs', requireAuth('user', 'coach', 'gym_owner'), async (req, res) => {
  try {
    const authUser = req.authUser;
    await pool.execute(
      'UPDATE users SET is_active = 0 WHERE is_active = 1 AND ban_delete_at IS NOT NULL AND ban_delete_at <= NOW()'
    );

    const viewerUserId = Number(authUser?.id || 0) || 0;
    const authorId = toPositiveInteger(req.query.authorId);
    const limit = clampBlogLimit(req.query.limit, 20, 60);
    const cursorId = toPositiveInteger(req.query.cursorId);

    const rawCursorCreatedAt = String(req.query.cursorCreatedAt || '').trim();
    const cursorDate = rawCursorCreatedAt ? new Date(rawCursorCreatedAt) : null;
    const hasValidCursorDate = cursorDate instanceof Date && !Number.isNaN(cursorDate.getTime());
    const cursorCreatedAt = hasValidCursorDate ? cursorDate.toISOString().slice(0, 19).replace('T', ' ') : null;

    const profileImageColumn = await getProfileImageColumn();
    const avatarSelect = profileImageColumn ? `COALESCE(u.${profileImageColumn}, '') AS avatar_url` : `'' AS avatar_url`;
    const latestCommentAvatarSelect = profileImageColumn
      ? `(SELECT COALESCE(cu.${profileImageColumn}, '')
          FROM blog_post_comments c2
          INNER JOIN users cu ON cu.id = c2.user_id
          WHERE c2.post_id = bp.id
            AND cu.is_active = 1
            AND (cu.banned_until IS NULL OR cu.banned_until < NOW())
          ORDER BY c2.created_at DESC, c2.id DESC
          LIMIT 1) AS latest_comment_avatar_url`
      : `'' AS latest_comment_avatar_url`;
    let viewerIsFemale = false;

    if (viewerUserId > 0) {
      const [viewerRows] = await pool.query(
        `SELECT gender
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [viewerUserId],
      );
      viewerIsFemale = isFemaleGender(viewerRows[0]?.gender);
    }

    const params = [viewerUserId, viewerUserId];
    const whereParts = [];

    whereParts.push('u.is_active = 1');
    whereParts.push('(u.banned_until IS NULL OR u.banned_until < NOW())');

    if (!viewerIsFemale) {
      whereParts.push('(COALESCE(bp.women_only, 0) = 0 OR bp.user_id = ?)');
      params.push(viewerUserId);
    }

    if (authorId) {
      whereParts.push('bp.user_id = ?');
      params.push(authorId);
    }

    if (cursorCreatedAt && cursorId) {
      whereParts.push('(bp.created_at < ? OR (bp.created_at = ? AND bp.id < ?))');
      params.push(cursorCreatedAt, cursorCreatedAt, cursorId);
    } else if (cursorCreatedAt) {
      whereParts.push('bp.created_at < ?');
      params.push(cursorCreatedAt);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT
         bp.id,
         bp.user_id,
         bp.category,
         bp.description,
         bp.media_type,
         bp.media_url,
         bp.media_alt,
         COALESCE(bp.women_only, 0) AS women_only,
         bp.created_at,
         u.name AS author_name,
         COALESCE(u.gender, '') AS author_gender,
         ${avatarSelect},
         ${latestCommentAvatarSelect},
         COALESCE(r.love_count, 0) + COALESCE(l.legacy_like_count, 0) AS love_count,
         COALESCE(r.fire_count, 0) AS fire_count,
         COALESCE(r.power_count, 0) AS power_count,
         COALESCE(r.wow_count, 0) AS wow_count,
         COALESCE(r.reaction_count, 0) + COALESCE(l.legacy_like_count, 0) AS reactions_total,
         COALESCE(r.reaction_count, 0) + COALESCE(l.legacy_like_count, 0) AS likes_count,
         COALESCE(v.view_count, 0) AS views_count,
         COALESCE(c.comment_count, 0) AS comments_count,
         COALESCE(ur.reaction_type, CASE WHEN ul.user_id IS NULL THEN NULL ELSE 'love' END) AS reaction_by_viewer,
         CASE WHEN ur.user_id IS NULL AND ul.user_id IS NULL THEN 0 ELSE 1 END AS liked_by_viewer
       FROM blog_posts bp
     INNER JOIN users u ON u.id = bp.user_id
       LEFT JOIN (
         SELECT post_id, COUNT(*) AS legacy_like_count
         FROM blog_post_likes
         GROUP BY post_id
       ) l ON l.post_id = bp.id
       LEFT JOIN (
         SELECT
           post_id,
           SUM(reaction_type = 'love') AS love_count,
           SUM(reaction_type = 'fire') AS fire_count,
           SUM(reaction_type = 'power') AS power_count,
           SUM(reaction_type = 'wow') AS wow_count,
           COUNT(*) AS reaction_count
         FROM blog_post_reactions
         GROUP BY post_id
       ) r ON r.post_id = bp.id
       LEFT JOIN (
         SELECT post_id, COUNT(*) AS view_count
         FROM blog_post_views
         GROUP BY post_id
       ) v ON v.post_id = bp.id
       LEFT JOIN (
         SELECT c.post_id, COUNT(*) AS comment_count
         FROM blog_post_comments c
         INNER JOIN users cu ON cu.id = c.user_id
         WHERE cu.is_active = 1
           AND (cu.banned_until IS NULL OR cu.banned_until < NOW())
         GROUP BY c.post_id
       ) c ON c.post_id = bp.id
       LEFT JOIN blog_post_reactions ur
         ON ur.post_id = bp.id
        AND ur.user_id = ?
       LEFT JOIN blog_post_likes ul
         ON ul.post_id = bp.id
        AND ul.user_id = ?
       ${whereClause}
       ORDER BY bp.created_at DESC, bp.id DESC
       LIMIT ?`,
      [...params, limit],
    );

    const posts = rows.map(mapBlogPostRow);
    const lastPost = posts[posts.length - 1] || null;
    const nextCursor = lastPost
      ? {
          cursorCreatedAt: lastPost.createdAt,
          cursorId: lastPost.id,
        }
      : null;

    return res.json({
      posts,
      nextCursor,
      hasMore: posts.length === limit,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch blogs feed' });
  }
});

router.post('/blogs', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const userId = toPositiveInteger(req.body?.userId);
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const description = String(req.body?.description || '').trim();
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }
    if (description.length > 5000) {
      return res.status(400).json({ error: 'description is too long (max 5000 chars)' });
    }

    const categoryRaw = String(req.body?.category || 'Recovery').trim();
    const category = BLOG_CATEGORIES.has(categoryRaw) ? categoryRaw : 'Recovery';

    const mediaType = String(req.body?.mediaType || '').trim().toLowerCase();
    if (!BLOG_MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be image or video' });
    }

    const mediaUrl = normalizeBlogMediaUrl(req.body?.mediaUrl);
    if (!mediaUrl) {
      return res.status(400).json({ error: 'mediaUrl is required' });
    }
    if (mediaUrl.length > 8000000) {
      return res.status(400).json({ error: 'mediaUrl payload is too large' });
    }

    const mediaAltRaw = String(req.body?.mediaAlt || '').trim();
    const mediaAlt = mediaAltRaw.slice(0, 255) || 'User uploaded media';
    const womenOnly = Boolean(req.body?.womenOnly);

    const [existingUsers] = await pool.execute('SELECT id, gender, banned_until, is_active FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!existingUsers.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (Number(existingUsers[0]?.is_active || 0) === 0) {
      return res.status(403).json({ error: 'Account is inactive' });
    }
    const bannedUntil = existingUsers[0]?.banned_until ? new Date(existingUsers[0].banned_until) : null;
    if (bannedUntil && bannedUntil.getTime() > Date.now()) {
      return res.status(403).json({
        error: `You are banned from posting blogs and comments until ${bannedUntil.toISOString()}.`,
        bannedUntil: bannedUntil.toISOString(),
      });
    }
    if (womenOnly && !isFemaleGender(existingUsers[0]?.gender)) {
      return res.status(403).json({ error: 'Only women can publish women-only posts' });
    }

    const [result] = await pool.execute(
      `INSERT INTO blog_posts (
         user_id,
         category,
         description,
         media_type,
         media_url,
         media_alt,
         women_only
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, category, description, mediaType, mediaUrl, mediaAlt, womenOnly ? 1 : 0],
    );

    const postId = Number(result.insertId);
    const post = await fetchBlogPostById(postId, userId);
    let totalPoints = null;
    let blogPoints = null;
    let blogPostCount = null;

    try {
      const gamification = await refreshGamificationForUser(userId);
      totalPoints = Number(gamification?.totalPoints || 0);
      blogPoints = Number(gamification?.blogPoints || 0);
      blogPostCount = Number(gamification?.blogPostCount || 0);
    } catch {
      const [pointRows] = await pool.execute(
        `SELECT COALESCE(total_points, 0) AS total_points
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId],
      );

      const boostedPoints = Number(pointRows[0]?.total_points || 0) + BLOG_POST_UPLOAD_POINTS;
      const boostedRank = getRankFromPoints(boostedPoints);
      await pool.execute(
        `UPDATE users
         SET total_points = ?, \`rank\` = ?
         WHERE id = ?`,
        [boostedPoints, boostedRank, userId],
      );

      totalPoints = boostedPoints;
    }

    return res.status(201).json({
      post,
      pointsAwarded: BLOG_POST_UPLOAD_POINTS,
      totalPoints,
      blogPoints,
      blogPostCount,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create blog post' });
  }
});

router.put('/blogs/:postId', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    const postId = toPositiveInteger(req.params?.postId);
    const userId = toPositiveInteger(req.body?.userId);

    if (!postId) {
      return res.status(400).json({ error: 'postId must be a positive integer' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, 'description');
    const hasCategory = Object.prototype.hasOwnProperty.call(req.body || {}, 'category');
    const hasMediaAlt = Object.prototype.hasOwnProperty.call(req.body || {}, 'mediaAlt');

    if (!hasDescription && !hasCategory && !hasMediaAlt) {
      return res.status(400).json({ error: 'At least one editable field is required' });
    }

    let description = null;
    if (hasDescription) {
      description = String(req.body?.description || '').trim();
      if (!description) {
        return res.status(400).json({ error: 'description is required' });
      }
      if (description.length > 5000) {
        return res.status(400).json({ error: 'description is too long (max 5000 chars)' });
      }
    }

    let category = null;
    if (hasCategory) {
      const categoryRaw = String(req.body?.category || '').trim();
      if (!BLOG_CATEGORIES.has(categoryRaw)) {
        return res.status(400).json({ error: 'Invalid category value' });
      }
      category = categoryRaw;
    }

    let mediaAlt = null;
    if (hasMediaAlt) {
      const mediaAltRaw = String(req.body?.mediaAlt || '').trim();
      mediaAlt = mediaAltRaw.slice(0, 255) || 'User uploaded media';
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [postRows] = await conn.execute(
      `SELECT id, user_id
       FROM blog_posts
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [postId],
    );

    if (!postRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Post not found' });
    }

    const ownerId = Number(postRows[0]?.user_id || 0);
    if (ownerId !== userId) {
      await conn.rollback();
      return res.status(403).json({ error: 'You can only edit your own post' });
    }

    const updateParts = [];
    const updateParams = [];

    if (description !== null) {
      updateParts.push('description = ?');
      updateParams.push(description);
    }
    if (category !== null) {
      updateParts.push('category = ?');
      updateParams.push(category);
    }
    if (mediaAlt !== null) {
      updateParts.push('media_alt = ?');
      updateParams.push(mediaAlt);
    }

    if (!updateParts.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    await conn.execute(
      `UPDATE blog_posts
       SET ${updateParts.join(', ')}
       WHERE id = ?`,
      [...updateParams, postId],
    );

    await conn.commit();

    const post = await fetchBlogPostById(postId, userId);
    return res.json({ post });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message || 'Failed to update post' });
  } finally {
    if (conn) conn.release();
  }
});

router.delete('/blogs/:postId', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId || req.query?.userId, { allowSelf: true }), async (req, res) => {
  let conn;
  try {
    const postId = toPositiveInteger(req.params?.postId);
    const userId = toPositiveInteger(req.body?.userId || req.query?.userId);

    if (!postId) {
      return res.status(400).json({ error: 'postId must be a positive integer' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [postRows] = await conn.execute(
      `SELECT id, user_id
       FROM blog_posts
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [postId],
    );

    if (!postRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Post not found' });
    }

    const ownerId = Number(postRows[0]?.user_id || 0);
    if (ownerId !== userId) {
      await conn.rollback();
      return res.status(403).json({ error: 'You can only delete your own post' });
    }

    await conn.execute('DELETE FROM blog_post_comments WHERE post_id = ?', [postId]);
    await conn.execute('DELETE FROM blog_post_reactions WHERE post_id = ?', [postId]);
    await conn.execute('DELETE FROM blog_post_likes WHERE post_id = ?', [postId]);
    await conn.execute('DELETE FROM blog_post_views WHERE post_id = ?', [postId]);
    await conn.execute('DELETE FROM blog_posts WHERE id = ?', [postId]);

    await conn.commit();
    return res.json({ success: true, postId });
  } catch (error) {
    if (conn) await conn.rollback();
    return res.status(500).json({ error: error.message || 'Failed to delete post' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/blogs/:postId/like/toggle', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const postId = toPositiveInteger(req.params?.postId);
    const userId = toPositiveInteger(req.body?.userId);
    const mode = String(req.body?.mode || 'toggle').trim().toLowerCase();
    const likeOnly = mode === 'like';

    if (!postId) {
      return res.status(400).json({ error: 'postId must be a positive integer' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }
 
    const [postRows] = await pool.execute(
      `SELECT id, user_id
       FROM blog_posts
       WHERE id = ?
       LIMIT 1`,
      [postId],
    );
    if (!postRows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    let liked = false;
    let createdLike = false;

    const [existingReactionRows] = await pool.execute(
      `SELECT reaction_type
       FROM blog_post_reactions
       WHERE post_id = ? AND user_id = ?
       LIMIT 1`,
      [postId, userId],
    );
    const existingReaction = normalizeBlogReactionType(existingReactionRows[0]?.reaction_type);

    const [existingLikeRows] = await pool.execute(
      `SELECT 1
       FROM blog_post_likes
       WHERE post_id = ? AND user_id = ?
       LIMIT 1`,
      [postId, userId],
    );
    const hasLegacyLike = existingLikeRows.length > 0;

    if (likeOnly) {
      if (existingReaction || hasLegacyLike) {
        liked = true;
      } else {
        await pool.execute(
          `INSERT INTO blog_post_reactions (post_id, user_id, reaction_type)
           VALUES (?, ?, 'love')
           ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type), updated_at = NOW()`,
          [postId, userId],
        );
        await pool.execute(
          `DELETE FROM blog_post_likes
           WHERE post_id = ? AND user_id = ?`,
          [postId, userId],
        );
        liked = true;
        createdLike = true;
      }
    } else if (existingReaction || hasLegacyLike) {
      await pool.execute(
        `DELETE FROM blog_post_reactions
         WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );
      await pool.execute(
        `DELETE FROM blog_post_likes
         WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );
      liked = false;
    } else {
      await pool.execute(
        `INSERT INTO blog_post_reactions (post_id, user_id, reaction_type)
         VALUES (?, ?, 'love')
         ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type), updated_at = NOW()`,
        [postId, userId],
      );
      await pool.execute(
        `DELETE FROM blog_post_likes
         WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );
      liked = true;
      createdLike = true;
    }

    const postOwnerId = Number(postRows[0]?.user_id || 0);
    if (createdLike && postOwnerId && postOwnerId !== userId) {
      try {
        const [actorRows] = await pool.execute(
          `SELECT name
           FROM users
           WHERE id = ?
           LIMIT 1`,
          [userId],
        );
        const actorName = String(actorRows[0]?.name || '').trim() || 'Someone';

        await pool.execute(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES (?, 'blog_like', 'New like on your post', ?, JSON_OBJECT('postId', ?, 'actorUserId', ?, 'event', 'like'))`,
          [postOwnerId, `${actorName} liked your post.`, postId, userId],
        );
      } catch (notifyError) {
        console.warn('Blog like notification insert skipped:', notifyError?.message || notifyError);
      }
    }

    const summary = await getBlogReactionSummary(postId, userId);

    return res.json({
      postId,
      liked,
      likesCount: summary.total,
      reactionsTotal: summary.total,
      reactionType: summary.reactionByViewer,
      reactions: {
        love: summary.loveCount,
        fire: summary.fireCount,
        power: summary.powerCount,
        wow: summary.wowCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update post like' });
  }
});

router.post('/blogs/:postId/reaction', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const postId = toPositiveInteger(req.params?.postId);
    const userId = toPositiveInteger(req.body?.userId);
    const hasReactionType = Object.prototype.hasOwnProperty.call(req.body || {}, 'reactionType');
    const rawReactionType = req.body?.reactionType;
    const reactionType = normalizeBlogReactionType(rawReactionType);

    if (!postId) {
      return res.status(400).json({ error: 'postId must be a positive integer' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }
    if (hasReactionType && rawReactionType != null && String(rawReactionType).trim() && !reactionType) {
      return res.status(400).json({ error: 'reactionType is invalid' });
    }

    const [postRows] = await pool.execute(
      `SELECT id, user_id
       FROM blog_posts
       WHERE id = ?
       LIMIT 1`,
      [postId],
    );
    if (!postRows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [existingReactionRows] = await pool.execute(
      `SELECT reaction_type
       FROM blog_post_reactions
       WHERE post_id = ? AND user_id = ?
       LIMIT 1`,
      [postId, userId],
    );
    const existingReaction = normalizeBlogReactionType(existingReactionRows[0]?.reaction_type);

    let createdReaction = false;
    let finalReaction = reactionType;

    if (!reactionType || reactionType === existingReaction) {
      await pool.execute(
        `DELETE FROM blog_post_reactions
         WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );
      await pool.execute(
        `DELETE FROM blog_post_likes
         WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );
      finalReaction = null;
    } else {
      const [result] = await pool.execute(
        `INSERT INTO blog_post_reactions (post_id, user_id, reaction_type)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type), updated_at = NOW()`,
        [postId, userId, reactionType],
      );
      await pool.execute(
        `DELETE FROM blog_post_likes
         WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );
      createdReaction = Number(result?.affectedRows || 0) > 0 && !existingReaction;
      finalReaction = reactionType;
    }

    const postOwnerId = Number(postRows[0]?.user_id || 0);
    if (createdReaction && postOwnerId && postOwnerId !== userId) {
      try {
        const [actorRows] = await pool.execute(
          `SELECT name
           FROM users
           WHERE id = ?
           LIMIT 1`,
          [userId],
        );
        const actorName = String(actorRows[0]?.name || '').trim() || 'Someone';

        await pool.execute(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES (?, 'blog_like', 'New reaction on your post', ?, JSON_OBJECT('postId', ?, 'actorUserId', ?, 'event', 'reaction', 'reaction', ?))`,
          [postOwnerId, `${actorName} reacted to your post.`, postId, userId, finalReaction || 'love'],
        );
      } catch (notifyError) {
        console.warn('Blog reaction notification insert skipped:', notifyError?.message || notifyError);
      }
    }

    const summary = await getBlogReactionSummary(postId, userId);

    return res.json({
      postId,
      reactionType: summary.reactionByViewer,
      reactionsTotal: summary.total,
      reactions: {
        love: summary.loveCount,
        fire: summary.fireCount,
        power: summary.powerCount,
        wow: summary.wowCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update post reaction' });
  }
});

router.post('/blogs/:postId/view', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const postId = toPositiveInteger(req.params?.postId);
    const userId = toPositiveInteger(req.body?.userId);

    if (!postId) {
      return res.status(400).json({ error: 'postId must be a positive integer' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const [postRows] = await pool.execute('SELECT id FROM blog_posts WHERE id = ? LIMIT 1', [postId]);
    if (!postRows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [insertResult] = await pool.execute(
      `INSERT IGNORE INTO blog_post_views (post_id, user_id, view_date)
       VALUES (?, ?, CURDATE())`,
      [postId, userId],
    );

    const [viewCountRows] = await pool.execute(
      `SELECT COUNT(*) AS views_count
       FROM blog_post_views
       WHERE post_id = ?`,
      [postId],
    );

    return res.json({
      postId,
      viewsCount: Number(viewCountRows[0]?.views_count || 0),
      tracked: Number(insertResult.affectedRows || 0) > 0,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to track post view' });
  }
});

router.get('/blogs/:postId/comments', requireAuth('user', 'coach', 'gym_owner'), async (req, res) => {
  try {
    const postId = toPositiveInteger(req.params?.postId);
    if (!postId) {
      return res.status(400).json({ error: 'postId must be a positive integer' });
    }

    const limit = clampBlogLimit(req.query.limit, 120, 250);
    const profileImageColumn = await getProfileImageColumn();
    const avatarSelect = profileImageColumn ? `COALESCE(u.${profileImageColumn}, '') AS avatar_url` : `'' AS avatar_url`;

    const [rows] = await pool.query(
      `SELECT
         c.id,
         c.post_id,
         c.user_id,
         c.comment_text,
         c.created_at,
         u.name AS author_name,
         ${avatarSelect}
       FROM blog_post_comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
         AND u.is_active = 1
         AND (u.banned_until IS NULL OR u.banned_until < NOW())
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT ?`,
      [postId, limit],
    );

    return res.json({
      postId,
      comments: rows.map(mapBlogCommentRow),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch comments' });
  }
});

router.post('/blogs/:postId/comments', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const postId = toPositiveInteger(req.params?.postId);
    const userId = toPositiveInteger(req.body?.userId);
    const text = String(req.body?.text || '').trim();

    if (!postId) {
      return res.status(400).json({ error: 'postId must be a positive integer' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    if (text.length > 1000) {
      return res.status(400).json({ error: 'Comment is too long (max 1000 chars)' });
    }

    const [userRows] = await pool.execute('SELECT banned_until, is_active FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (Number(userRows[0]?.is_active || 0) === 0) {
      return res.status(403).json({ error: 'Account is inactive' });
    }
    const bannedUntil = userRows[0]?.banned_until ? new Date(userRows[0].banned_until) : null;
    if (bannedUntil && bannedUntil.getTime() > Date.now()) {
      return res.status(403).json({
        error: `You are banned from posting blogs and comments until ${bannedUntil.toISOString()}.`,
        bannedUntil: bannedUntil.toISOString(),
      });
    }

    const [postRows] = await pool.execute(
      `SELECT id, user_id
       FROM blog_posts
       WHERE id = ?
       LIMIT 1`,
      [postId],
    );
    if (!postRows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [insertResult] = await pool.execute(
      `INSERT INTO blog_post_comments (post_id, user_id, comment_text)
       VALUES (?, ?, ?)`,
      [postId, userId, text],
    );

    const insertedCommentId = Number(insertResult.insertId);
    const profileImageColumn = await getProfileImageColumn();
    const avatarSelect = profileImageColumn ? `COALESCE(u.${profileImageColumn}, '') AS avatar_url` : `'' AS avatar_url`;

    const [commentRows] = await pool.execute(
      `SELECT
         c.id,
         c.post_id,
         c.user_id,
         c.comment_text,
         c.created_at,
         u.name AS author_name,
         ${avatarSelect}
       FROM blog_post_comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.id = ?
       LIMIT 1`,
      [insertedCommentId],
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS comments_count
       FROM blog_post_comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
         AND u.is_active = 1
         AND (u.banned_until IS NULL OR u.banned_until < NOW())`,
      [postId],
    );

    const postOwnerId = Number(postRows[0]?.user_id || 0);
    if (postOwnerId && postOwnerId !== userId) {
      try {
        const actorName = String(commentRows[0]?.author_name || '').trim() || 'Someone';
        const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;

        await pool.execute(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES (?, 'blog_comment', 'New comment on your post', ?, JSON_OBJECT('postId', ?, 'commentId', ?, 'actorUserId', ?, 'event', 'comment'))`,
          [postOwnerId, `${actorName} commented: "${preview}"`, postId, insertedCommentId, userId],
        );
      } catch (notifyError) {
        console.warn('Blog comment notification insert skipped:', notifyError?.message || notifyError);
      }
    }

    return res.status(201).json({
      postId,
      comment: commentRows.length ? mapBlogCommentRow(commentRows[0]) : null,
      commentsCount: Number(countRows[0]?.comments_count || 0),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to add comment' });
  }
});

router.post('/ai/chat-completions', authMutationRateLimit, requireAuth('user', 'coach', 'gym_owner'), aiRouteRateLimit, async (req, res) => {
  try {
    if (!hasOpenAIConfig()) {
      return res.status(503).json({ error: 'AI service is not configured' });
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(0, 24) : [];
    if (!messages.length) {
      return res.status(400).json({ error: 'messages are required' });
    }

    const model = String(req.body?.model || 'gpt-4o').trim().slice(0, 80) || 'gpt-4o';
    const temperature = Math.max(0, Math.min(1, Number(req.body?.temperature ?? 0.7)));
    const maxTokens = Math.max(100, Math.min(4000, Math.round(Number(req.body?.maxTokens ?? 2000))));

    const result = await requestOpenAIChatCompletion({
      messages,
      model,
      temperature,
      maxTokens,
    });

    return res.json({
      content: result.content,
      model: result.model,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to call AI service' });
  }
});

router.post('/nutrition/daily-plan', async (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const plan = await generateDailyNutritionPlan(payload);
    return res.json(plan);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to generate daily nutrition plan' });
  }
});

router.get('/insights/datasets/overview', requireAuth('coach', 'gym_owner'), async (req, res) => {
  try {
    const refreshRaw = String(req.query.refresh || '').trim().toLowerCase();
    const forceRefresh = refreshRaw === '1' || refreshRaw === 'true';
    const summary = await getDatasetOverview({ forceRefresh });
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to read dataset overview' });
  }
});

router.post('/insights/onboarding', authMutationRateLimit, requireAuth('user'), async (req, res) => {
  try {
    const result = await buildOnboardingInsights(req.body || {});
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to build onboarding insights' });
  }
});

router.post('/insights/user-analysis', authMutationRateLimit, requireAuth('user'), async (req, res) => {
  try {
    const result = await buildUserAnalysisInsights(req.body || {});
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to build user analysis insights' });
  }
});

router.post('/insights/onboarding/save', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const input = req.body?.input && typeof req.body.input === 'object' ? req.body.input : (req.body || {});
    const insights = await buildOnboardingInsights(input);
    const saved = await saveOnboardingInsightsForUser({
      userId,
      input,
      insights,
      snapshotDate: req.body?.snapshotDate,
      source: req.body?.source || 'onboarding',
      notes: req.body?.notes || null,
      modelVersion: String(req.body?.modelVersion || 'fitness_insights_v1'),
    });

    return res.json({
      success: true,
      ...saved,
      insights,
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Invalid snapshotDate' || error.message === 'Invalid userId') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to save onboarding insights' });
  }
});

router.post('/insights/user-analysis/save', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const input = req.body?.input && typeof req.body.input === 'object' ? req.body.input : (req.body || {});
    const insights = await buildUserAnalysisInsights(input);
    const saved = await saveUserAnalysisInsightsForUser({
      userId,
      input,
      insights,
      snapshotDate: req.body?.snapshotDate,
      source: req.body?.source || 'weekly_checkin',
      notes: req.body?.notes || null,
      modelVersion: String(req.body?.modelVersion || 'fitness_insights_v1'),
    });

    let adaptation = null;
    const autoAdaptPlan = ['1', 'true', 'yes'].includes(String(req.body?.autoAdaptPlan || '').trim().toLowerCase());
    if (autoAdaptPlan) {
      let conn;
      try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        adaptation = await adaptProgramWeeklyByInsights(conn, {
          userId,
          force: false,
          trigger: 'weekly_analysis',
        });
        await conn.commit();
      } catch (adaptError) {
        if (conn) await conn.rollback();
        adaptation = {
          adapted: false,
          error: adaptError?.message || 'Auto adaptation failed',
        };
      } finally {
        if (conn) conn.release();
      }
    }

    return res.json({
      success: true,
      ...saved,
      insights,
      adaptation,
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Invalid snapshotDate' || error.message === 'Invalid userId') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to save user analysis insights' });
  }
});

router.get('/insights/user/:userId/history', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), async (req, res) => {
  try {
    const userId = Number(req.params?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const days = Number(req.query?.days || 90);
    const limit = Number(req.query?.limit || 365);
    const scoreTypes = req.query?.scoreType || req.query?.scoreTypes || '';
    const includeExplanation = ['1', 'true', 'yes'].includes(String(req.query?.includeExplanation || '').trim().toLowerCase());
    const includeRawPayload = ['1', 'true', 'yes'].includes(String(req.query?.includeRawPayload || '').trim().toLowerCase());

    const history = await getUserInsightsHistory({
      userId,
      days,
      limit,
      scoreTypes,
      includeExplanation,
      includeRawPayload,
    });

    return res.json(history);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Invalid userId') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to load insight history' });
  }
});

export default router;
