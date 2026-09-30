import pool from '../database.js';
import { generateDailyNutritionPlan } from '../services/nutritionPlanner.js';
import {
  NUTRITION_ONBOARDING_VERSION,
  buildNutritionSafetyDecision,
  normalizeNutritionHealthProfile,
} from '../services/nutritionSafetyEngine.js';

export const createNutritionController = ({
  dbPool = pool,
  dailyNutritionPlanGenerator = generateDailyNutritionPlan,
} = {}) => {
  const ensureNutritionV2Tables = async () => {
    await dbPool.execute(`
      CREATE TABLE IF NOT EXISTS nutrition_health_profiles (
        user_id INT PRIMARY KEY,
        conditions_json JSON NULL,
        allergies_json JSON NULL,
        intolerances_json JSON NULL,
        clinician_nutrition_plan TINYINT(1) NULL,
        prefer_not_to_say TINYINT(1) NOT NULL DEFAULT 0,
        no_known_condition TINYINT(1) NOT NULL DEFAULT 0,
        onboarding_version INT NOT NULL DEFAULT 1,
        completed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_nutrition_health_profiles_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbPool.execute(`
      CREATE TABLE IF NOT EXISTS nutrition_hydration_entries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount_ml INT UNSIGNED NOT NULL,
        drink_type VARCHAR(40) NOT NULL DEFAULT 'water',
        logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_nutrition_hydration_user_logged_at (user_id, logged_at),
        CONSTRAINT fk_nutrition_hydration_entries_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  };

  const parseJsonColumn = (value, fallback) => {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      return fallback;
    }
  };

  const mapNutritionHealthProfileRow = (row) => {
    if (!row) {
      return {
        completed: false,
        onboardingVersion: NUTRITION_ONBOARDING_VERSION,
        completedAt: null,
        healthProfile: null,
      };
    }

    const healthProfile = normalizeNutritionHealthProfile({
      conditions: parseJsonColumn(row.conditions_json, {}),
      allergies: parseJsonColumn(row.allergies_json, []),
      intolerances: parseJsonColumn(row.intolerances_json, []),
      clinicianNutritionPlan: row.clinician_nutrition_plan == null ? null : Boolean(row.clinician_nutrition_plan),
      preferNotToSay: Boolean(row.prefer_not_to_say),
      noKnownCondition: Boolean(row.no_known_condition),
      onboardingVersion: Number(row.onboarding_version || NUTRITION_ONBOARDING_VERSION),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    });

    return {
      completed: Boolean(row.completed_at),
      onboardingVersion: Number(row.onboarding_version || NUTRITION_ONBOARDING_VERSION),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      healthProfile,
    };
  };

  const getTodayHydrationSummary = async (userId) => {
    const [rows] = await dbPool.execute(
      `SELECT COALESCE(SUM(amount_ml), 0) AS total_ml, COUNT(*) AS entries_count
       FROM nutrition_hydration_entries
       WHERE user_id = ? AND DATE(logged_at) = CURDATE()`,
      [userId],
    );

    return {
      loggedMl: Number(rows[0]?.total_ml || 0),
      entriesCount: Number(rows[0]?.entries_count || 0),
    };
  };

  const getNutritionProfile = async (req, res) => {
    try {
      await ensureNutritionV2Tables();
      const userId = Number(req.authUser?.id || 0);
      const [rows] = await dbPool.execute(
        `SELECT *
         FROM nutrition_health_profiles
         WHERE user_id = ?
         LIMIT 1`,
        [userId],
      );
      const profile = mapNutritionHealthProfileRow(rows[0] || null);
      const hydration = await getTodayHydrationSummary(userId);

      return res.json({
        ...profile,
        hydration,
        safety: buildNutritionSafetyDecision({ healthProfile: profile.healthProfile || {} }),
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to load nutrition profile' });
    }
  };

  const saveNutritionProfile = async (req, res) => {
    try {
      await ensureNutritionV2Tables();
      const userId = Number(req.authUser?.id || 0);
      const healthProfile = normalizeNutritionHealthProfile(req.body || {});
      const completedAt = new Date(healthProfile.completedAt || new Date()).toISOString().slice(0, 19).replace('T', ' ');
      const clinicianPlan = healthProfile.clinicianNutritionPlan == null ? null : (healthProfile.clinicianNutritionPlan ? 1 : 0);

      await dbPool.execute(
        `INSERT INTO nutrition_health_profiles
          (user_id, conditions_json, allergies_json, intolerances_json, clinician_nutrition_plan, prefer_not_to_say, no_known_condition, onboarding_version, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          conditions_json = VALUES(conditions_json),
          allergies_json = VALUES(allergies_json),
          intolerances_json = VALUES(intolerances_json),
          clinician_nutrition_plan = VALUES(clinician_nutrition_plan),
          prefer_not_to_say = VALUES(prefer_not_to_say),
          no_known_condition = VALUES(no_known_condition),
          onboarding_version = VALUES(onboarding_version),
          completed_at = VALUES(completed_at)`,
        [
          userId,
          JSON.stringify(healthProfile.conditions || {}),
          JSON.stringify(healthProfile.allergies || []),
          JSON.stringify(healthProfile.intolerances || []),
          clinicianPlan,
          healthProfile.preferNotToSay ? 1 : 0,
          healthProfile.noKnownCondition ? 1 : 0,
          NUTRITION_ONBOARDING_VERSION,
          completedAt,
        ],
      );

      return res.json({
        completed: true,
        onboardingVersion: NUTRITION_ONBOARDING_VERSION,
        completedAt: new Date(completedAt).toISOString(),
        healthProfile,
        safety: buildNutritionSafetyDecision({ healthProfile }),
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to save nutrition profile' });
    }
  };

  const addHydration = async (req, res) => {
    try {
      await ensureNutritionV2Tables();
      const userId = Number(req.authUser?.id || 0);
      const amountMl = Math.round(Number(req.body?.amountMl || req.body?.amount_ml || 0));
      const drinkTypeRaw = String(req.body?.drinkType || req.body?.drink_type || 'water').trim().toLowerCase();
      const drinkType = ['water', 'coffee', 'tea', 'milk', 'juice', 'other'].includes(drinkTypeRaw) ? drinkTypeRaw : 'water';

      if (!Number.isFinite(amountMl) || amountMl <= 0) {
        return res.status(400).json({ error: 'Hydration amount must be greater than 0 ml' });
      }
      if (amountMl > 3000) {
        return res.status(400).json({ error: 'Hydration amount is too large for one entry' });
      }

      await dbPool.execute(
        `INSERT INTO nutrition_hydration_entries (user_id, amount_ml, drink_type, logged_at)
         VALUES (?, ?, ?, NOW())`,
        [userId, amountMl, drinkType],
      );

      const hydration = await getTodayHydrationSummary(userId);
      return res.json({
        success: true,
        amountMl,
        drinkType,
        hydration,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to log hydration' });
    }
  };

  const getDailyNutritionPlan = async (req, res) => {
    try {
      const payload = req.body && typeof req.body === 'object' ? req.body : {};
      const [profileRows] = await dbPool.execute(
        `SELECT *
         FROM nutrition_health_profiles
         WHERE user_id = ?
         LIMIT 1`,
        [Number(req.authUser?.id || 0)],
      ).catch(() => [[]]);
      const healthProfile = mapNutritionHealthProfileRow(profileRows[0] || null).healthProfile || {};
      const safety = buildNutritionSafetyDecision({ healthProfile, targets: payload });
      const plan = await dailyNutritionPlanGenerator(payload);
      return res.json({ ...plan, safety });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to generate daily nutrition plan' });
    }
  };

  return {
    addHydration,
    ensureNutritionV2Tables,
    getDailyNutritionPlan,
    getNutritionProfile,
    getTodayHydrationSummary,
    mapNutritionHealthProfileRow,
    parseJsonColumn,
    saveNutritionProfile,
  };
};

const nutritionController = createNutritionController();

export const {
  addHydration,
  getDailyNutritionPlan,
  getNutritionProfile,
  saveNutritionProfile,
} = nutritionController;
