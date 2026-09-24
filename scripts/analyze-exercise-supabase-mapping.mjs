import 'dotenv/config';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import pool from '../server/database.js';
import {
  EXERCISE_VIDEO_MANIFEST,
  normalizeExerciseVideoLookup,
  resolveExerciseVideoManifest,
} from '../src/shared/exerciseVideoManifest.js';

const REPORT_DIR = path.resolve('reports');
const CSV_PATH = path.join(REPORT_DIR, 'exercise-supabase-mapping.csv');
const JSON_PATH = path.join(REPORT_DIR, 'exercise-supabase-mapping.json');

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normalizeIdentity = (value) =>
  normalizeText(value)
    .replace(/\bskull\s*crusher\b/g, 'skull crusher')
    .replace(/\bskullcrusher\b/g, 'skull crusher')
    .replace(/\bkick\s*back\b/g, 'kick back')
    .replace(/\bkickback\b/g, 'kick back')
    .replace(/\bpush\s*down\b/g, 'push down')
    .replace(/\bpushdown\b/g, 'push down')
    .replace(/\bpress\s*down\b/g, 'push down')
    .replace(/\bpressdown\b/g, 'push down')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\bsit\s*up\b/g, 'sit up')
    .replace(/\bsitup\b/g, 'sit up')
    .replace(/\bpull[\s-]*downs?\b/g, 'pulldown')
    .replace(/\bpull[\s-]*ups?\b/g, 'pullup')
    .replace(/\bchin[\s-]*ups?\b/g, 'chinup')
    .replace(/\bpull[\s-]*overs?\b/g, 'pullover')
    .replace(/\bclose[\s-]*grip\b/g, 'close grip')
    .replace(/\bwide[\s-]*grip\b/g, 'wide grip')
    .replace(/\bneutral[\s-]*grip\b/g, 'neutral grip')
    .replace(/\breverse[\s-]*grip\b/g, 'reverse grip')
    .replace(/\bunder[\s-]*hand\b/g, 'underhand')
    .replace(/\bover[\s-]*hand\b/g, 'overhand')
    .replace(/\bone[\s-]*arm\b/g, 'single arm')
    .replace(/\bextensions\b/g, 'extension')
    .replace(/\brows\b/g, 'row')
    .replace(/\bcurls\b/g, 'curl')
    .replace(/\braises\b/g, 'raise')
    .replace(/\bpresses\b/g, 'press')
    .replace(/\bflies\b/g, 'fly')
    .replace(/\bflyes\b/g, 'fly')
    .replace(/\bdeadlifts\b/g, 'deadlift')
    .replace(/\bshrugs\b/g, 'shrug')
    .replace(/\bsquats\b/g, 'squat')
    .replace(/\blunges\b/g, 'lunge')
    .replace(/\bcrunches\b/g, 'crunch')
    .replace(/\btwists\b/g, 'twist')
    .replace(/\bdips\b/g, 'dip')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^\d+\s+day\s+/g, '')
    .replace(/^\d+\s+(back|chest|legs|shoulders|arms|abs)\s+/g, '')
    .replace(/^(am|pm|fyr\d*|acft)\s+/g, '')
    .replace(/\s+gethin variation$/g, '')
    .replace(/\s+variation$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (value) =>
  normalizeIdentity(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const basenameWithoutExtension = (value) => {
  const normalized = String(value || '').replace(/\\/g, '/');
  const base = normalized.split('/').pop() || '';
  return base.replace(/\.[a-z0-9]+$/i, '');
};

const toCategory = (value) => {
  const text = normalizeIdentity(value);
  if (!text) return '';
  if (/(abs|abdom|core|oblique|crunch|sit up|leg raise|plank|twist|mountain climber|dead bug)/.test(text)) return 'abs';
  if (/(back|\blat\b|trap|rhomboid|erector|pulldown|pullup|chinup|row|deadlift|shrug|pullover)/.test(text)) return 'back';
  if (/(chest|pector|\bpec\b|bench press|chest press|incline press|push up|fly|crossover|dip)/.test(text)) return 'chest';
  if (/(shoulder|delt|lateral raise|front raise|rear delt|face pull|overhead press|arnold press)/.test(text)) return 'shoulders';
  if (/(leg|quad|hamstring|glute|calf|thigh|squat|lunge|hip thrust|leg press|leg extension|leg curl)/.test(text)) return 'legs';
  if (/(bicep|tricep|forearm|arm|curl|push down|skull crusher|kick back|french press)/.test(text)) return 'arms';
  return text;
};

const normalizeEquipment = (value) => {
  const text = normalizeIdentity(value);
  if (!text) return '';
  if (/body(?: |-)only|bodyweight|none|no equipment/.test(text)) return 'body only';
  if (/dumbbell/.test(text)) return 'dumbbell';
  if (/barbell|ez bar|olympic/.test(text)) return 'barbell';
  if (/cable|rope/.test(text)) return 'cable';
  if (/machine|lever|smith|sled|press/.test(text)) return 'machine';
  if (/kettlebell/.test(text)) return 'kettlebell';
  if (/band/.test(text)) return 'band';
  if (/medicine ball|med ball/.test(text)) return 'medicine ball';
  if (/suspension|suspended|trx/.test(text)) return 'suspension';
  if (/bench|ball|bosu|foam|roller/.test(text)) return text;
  return text;
};

const areCompatible = (local, supabase) => {
  const localCategory = local.categoryKey;
  const supabaseCategory = supabase.categoryKey;
  const categoryCompatible = !localCategory || !supabaseCategory || localCategory === supabaseCategory;

  const localEquipment = local.equipmentKey;
  const supabaseEquipment = supabase.equipmentKey;
  const equipmentCompatible = !localEquipment || !supabaseEquipment || localEquipment === supabaseEquipment;

  return { categoryCompatible, equipmentCompatible, compatible: categoryCompatible && equipmentCompatible };
};

const scoreNameSimilarity = (left, right) => {
  const leftTokens = new Set(normalizeIdentity(left).split(' ').filter(Boolean));
  const rightTokens = new Set(normalizeIdentity(right).split(' ').filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
};

const csvEscape = (value) => {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const loadLocalExercises = async () => {
  const [rows] = await pool.execute(
    `SELECT
       ec.id,
       ec.source_dataset,
       ec.source_row_key,
       ec.canonical_name,
       ec.normalized_name,
       ec.body_part,
       ec.equipment,
       ec.exercise_type,
       ec.is_stretch,
       GROUP_CONCAT(DISTINCT ea.alias_name ORDER BY ea.alias_name SEPARATOR '|||') AS aliases,
       GROUP_CONCAT(DISTINCT ecm.muscle_group ORDER BY ecm.is_primary DESC, ecm.muscle_group SEPARATOR '|||') AS muscles,
       MAX(CASE WHEN ecm.is_primary = 1 THEN ecm.muscle_group ELSE NULL END) AS primary_muscle
     FROM exercise_catalog ec
     LEFT JOIN exercise_aliases ea ON ea.exercise_catalog_id = ec.id
     LEFT JOIN exercise_catalog_muscles ecm ON ecm.exercise_catalog_id = ec.id
     WHERE ec.is_active = 1
     GROUP BY ec.id
     ORDER BY ec.id`,
  );

  return rows.map((row) => {
    const aliases = String(row.aliases || '').split('|||').map((entry) => entry.trim()).filter(Boolean);
    const muscles = String(row.muscles || '').split('|||').map((entry) => entry.trim()).filter(Boolean);
    const videoLink = resolveExerciseVideoManifest({
      name: row.canonical_name,
      bodyPart: row.body_part,
      muscle: row.primary_muscle,
      targetMuscles: muscles,
    });
    const slug = /^\d+$/.test(String(row.source_row_key || '')) ? slugify(row.canonical_name) : String(row.source_row_key || slugify(row.canonical_name));

    return {
      local_id: Number(row.id),
      name: row.canonical_name,
      slug,
      source_dataset: row.source_dataset,
      body_part: row.body_part || '',
      equipment: row.equipment || '',
      exercise_type: row.exercise_type || '',
      primary_muscle: row.primary_muscle || '',
      muscles,
      aliases,
      linkedVideoAsset: videoLink.matchType === 'alias' ? videoLink.fileName : '',
      linkedVideoMatchType: videoLink.matchType,
      normalizedName: normalizeIdentity(row.canonical_name),
      slugKey: slugify(slug),
      derivedSlugKey: slugify(row.canonical_name),
      categoryKey: toCategory(`${row.body_part || ''} ${row.primary_muscle || ''} ${muscles.join(' ')} ${row.canonical_name}`),
      equipmentKey: normalizeEquipment(row.equipment),
      aliasKeys: aliases.map(normalizeIdentity).filter(Boolean),
    };
  });
};

const loadSupabaseExercises = async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: exercises, error: exerciseError } = await client
    .from('exercises')
    .select('id,name,slug,equipment,is_active')
    .eq('is_active', true)
    .limit(2000);
  if (exerciseError) throw exerciseError;

  const { data: mediaRows, error: mediaError } = await client
    .from('exercise_media')
    .select('id,exercise_id,media_type,audience,storage_bucket,storage_path,access_level,sort_order,is_active')
    .eq('is_active', true)
    .limit(2000);
  if (mediaError) throw mediaError;

  const mediaByExercise = new Map();
  (mediaRows || []).forEach((media) => {
    const key = String(media.exercise_id);
    if (!mediaByExercise.has(key)) mediaByExercise.set(key, []);
    mediaByExercise.get(key).push(media);
  });

  return (exercises || []).map((row) => {
    const media = mediaByExercise.get(String(row.id)) || [];
    const mediaPaths = media.map((entry) => entry.storage_path).filter(Boolean);
    const mediaFilenames = mediaPaths.map(basenameWithoutExtension);
    const categories = [...new Set(mediaPaths.map((entry) => String(entry).split('/')[1]).filter(Boolean))];

    return {
      supabase_id: Number(row.id),
      name: row.name,
      slug: row.slug || slugify(row.name),
      equipment: row.equipment || '',
      categories,
      muscles: [],
      mediaFilenames,
      mediaPaths,
      normalizedName: normalizeIdentity(row.name),
      slugKey: slugify(row.slug || row.name),
      categoryKey: toCategory(`${categories.join(' ')} ${row.name}`),
      equipmentKey: normalizeEquipment(row.equipment),
      mediaKeys: [...mediaFilenames, ...mediaPaths].map(normalizeIdentity).filter(Boolean),
    };
  });
};

const buildIndex = (items, keyName) => {
  const index = new Map();
  items.forEach((item) => {
    const key = item[keyName];
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(item);
  });
  return index;
};

const addCandidate = (map, supabase, method, confidence, reason) => {
  if (!supabase) return;
  const key = String(supabase.supabase_id);
  const current = map.get(key);
  if (!current || confidence > current.confidence) {
    map.set(key, { supabase, method, confidence, reasons: [reason] });
  } else if (current) {
    current.reasons.push(reason);
  }
};

const analyze = async () => {
  const localExercises = await loadLocalExercises();
  const supabaseExercises = await loadSupabaseExercises();

  const supaBySlug = buildIndex(supabaseExercises, 'slugKey');
  const supaByName = buildIndex(supabaseExercises, 'normalizedName');
  const supaByMediaKey = new Map();
  supabaseExercises.forEach((exercise) => {
    exercise.mediaKeys.forEach((key) => {
      if (!supaByMediaKey.has(key)) supaByMediaKey.set(key, []);
      supaByMediaKey.get(key).push(exercise);
    });
  });

  const rows = [];
  const candidateConflicts = [];

  localExercises.forEach((local) => {
    const candidates = new Map();

    (supaBySlug.get(local.derivedSlugKey) || []).forEach((supa) =>
      addCandidate(candidates, supa, 'EXACT_SLUG', 1, 'local derived slug equals Supabase slug'));
    if (local.slugKey && local.slugKey !== local.derivedSlugKey) {
      (supaBySlug.get(local.slugKey) || []).forEach((supa) =>
        addCandidate(candidates, supa, 'EXACT_SLUG', 1, 'local slug equals Supabase slug'));
    }

    (supaByName.get(local.normalizedName) || []).forEach((supa) =>
      addCandidate(candidates, supa, 'EXACT_NAME', 1, 'normalized local name equals normalized Supabase name'));

    local.aliasKeys.forEach((alias) => {
      (supaByName.get(alias) || []).forEach((supa) =>
        addCandidate(candidates, supa, 'ALIAS_MEDIA_MATCH', 0.98, `local alias equals Supabase name: ${alias}`));
      (supaBySlug.get(slugify(alias)) || []).forEach((supa) =>
        addCandidate(candidates, supa, 'ALIAS_MEDIA_MATCH', 0.98, `local alias equals Supabase slug: ${alias}`));
    });

    if (local.linkedVideoAsset) {
      const localVideoKey = normalizeIdentity(basenameWithoutExtension(local.linkedVideoAsset));
      (supaByMediaKey.get(localVideoKey) || []).forEach((supa) =>
        addCandidate(candidates, supa, 'ALIAS_MEDIA_MATCH', 0.99, `local linked video filename equals Supabase media filename: ${local.linkedVideoAsset}`));
    }

    if (!candidates.size) {
      supabaseExercises.forEach((supa) => {
        const nameScore = scoreNameSimilarity(local.name, supa.name);
        const localVideoScore = local.linkedVideoAsset
          ? Math.max(...supa.mediaKeys.map((key) => scoreNameSimilarity(local.linkedVideoAsset, key)), 0)
          : 0;
        const score = Math.max(nameScore, localVideoScore);
        const compatibility = areCompatible(local, supa);
        if (score >= 0.6 && compatibility.compatible) {
          addCandidate(candidates, supa, 'HIGH_CONFIDENCE', Math.min(0.92, score), `context-constrained similarity score ${score.toFixed(2)}`);
        } else if (score >= 0.45 && (compatibility.categoryCompatible || compatibility.equipmentCompatible)) {
          addCandidate(candidates, supa, 'REVIEW', Math.min(0.74, score), `candidate similarity score ${score.toFixed(2)}`);
        }
      });
    }

    const sorted = [...candidates.values()].sort((a, b) => b.confidence - a.confidence || a.supabase.supabase_id - b.supabase.supabase_id);
    const top = sorted[0] || null;
    const sameTopCount = top ? sorted.filter((candidate) => candidate.confidence === top.confidence).length : 0;

    let status = 'UNMATCHED';
    let method = 'UNMATCHED';
    let confidence = 0;
    let reason = 'no deterministic Supabase slug/name/alias/media match';
    let supa = null;

    if (top) {
      supa = top.supabase;
      method = top.method;
      confidence = top.confidence;
      reason = top.reasons.join('; ');
      const compatibility = areCompatible(local, supa);
      if (!compatibility.compatible) {
        status = 'CONFLICT';
        reason += `; incompatible ${compatibility.categoryCompatible ? '' : 'category'} ${compatibility.equipmentCompatible ? '' : 'equipment'}`.trim();
      } else if (sameTopCount > 1) {
        status = 'CONFLICT';
        reason += '; multiple equal-confidence Supabase candidates';
      } else if (method === 'EXACT_SLUG' || method === 'EXACT_NAME' || method === 'ALIAS_MEDIA_MATCH') {
        status = 'VERIFIED';
      } else if (method === 'HIGH_CONFIDENCE') {
        status = 'HIGH_CONFIDENCE';
      } else {
        status = 'REVIEW';
      }
    }

    if (sorted.length > 1) {
      candidateConflicts.push({
        local_id: local.local_id,
        local_name: local.name,
        candidates: sorted.slice(0, 10).map((candidate) => ({
          supabase_id: candidate.supabase.supabase_id,
          supabase_name: candidate.supabase.name,
          method: candidate.method,
          confidence: candidate.confidence,
          reasons: candidate.reasons,
        })),
      });
    }

    rows.push({
      local_id: local.local_id,
      local_name: local.name,
      local_slug: local.slug,
      supabase_id: supa?.supabase_id || '',
      supabase_name: supa?.name || '',
      supabase_slug: supa?.slug || '',
      match_method: method,
      confidence: confidence.toFixed(2),
      local_category: local.body_part || local.categoryKey,
      supabase_category: supa?.categories?.join('|') || supa?.categoryKey || '',
      local_equipment: local.equipment,
      supabase_equipment: supa?.equipment || '',
      local_video_asset: local.linkedVideoAsset,
      supabase_media_path: supa?.mediaPaths?.[0] || '',
      status,
      reason,
      _local: local,
      _supabase: supa,
      _candidateCount: sorted.length,
    });
  });

  const duplicateNames = Object.entries(
    localExercises.reduce((acc, item) => {
      acc[item.name] = (acc[item.name] || 0) + 1;
      return acc;
    }, {}),
  ).filter(([, count]) => count > 1);

  const duplicateNormalizedNames = Object.entries(
    localExercises.reduce((acc, item) => {
      acc[item.normalizedName] = (acc[item.normalizedName] || 0) + 1;
      return acc;
    }, {}),
  ).filter(([, count]) => count > 1);

  const aliasCounts = new Map();
  localExercises.forEach((item) => item.aliasKeys.forEach((alias) => aliasCounts.set(alias, (aliasCounts.get(alias) || 0) + 1)));
  const duplicateAliases = [...aliasCounts.entries()].filter(([, count]) => count > 1);

  const verifiedRows = rows.filter((row) => row.status === 'VERIFIED');
  const verifiedBySupabase = new Map();
  verifiedRows.forEach((row) => {
    const key = String(row.supabase_id);
    if (!verifiedBySupabase.has(key)) verifiedBySupabase.set(key, []);
    verifiedBySupabase.get(key).push(row.local_id);
  });

  const previousExactSlugRows = rows.filter((row) => row.match_method === 'EXACT_SLUG');
  const previousExactSlugValid = previousExactSlugRows.filter((row) => row.status === 'VERIFIED').length;
  const previousExactSlugConflicting = previousExactSlugRows.length - previousExactSlugValid;
  const phase1BReportPath = path.join(REPORT_DIR, 'phase1b-live-supabase-validation.json');
  const phase1BExactSlugIds = fsSync.existsSync(phase1BReportPath)
    ? new Set((JSON.parse(fsSync.readFileSync(phase1BReportPath, 'utf8')).exactSlug || []).map((row) => Number(row.existingId)))
    : new Set();
  const phase1BExactSlugRows = phase1BExactSlugIds.size
    ? rows.filter((row) => phase1BExactSlugIds.has(Number(row.local_id)))
    : [];
  const phase1BExactSlugValid = phase1BExactSlugRows.filter((row) => row.status === 'VERIFIED').length;

  const summary = {
    mysql: {
      totalExerciseCatalogRows: localExercises.length,
      uniqueLocalIds: new Set(localExercises.map((row) => row.local_id)).size,
      uniqueNormalizedNames: new Set(localExercises.map((row) => row.normalizedName)).size,
      duplicateLocalNames: duplicateNames.length,
      duplicateNormalizedNames: duplicateNormalizedNames.length,
      duplicateAliases: duplicateAliases.length,
      sourceDatasets: localExercises.reduce((acc, row) => {
        acc[row.source_dataset] = (acc[row.source_dataset] || 0) + 1;
        return acc;
      }, {}),
    },
    supabase: {
      exercises: supabaseExercises.length,
    },
    matching: {
      EXACT_SLUG: rows.filter((row) => row.status === 'VERIFIED' && row.match_method === 'EXACT_SLUG').length,
      EXACT_NAME: rows.filter((row) => row.status === 'VERIFIED' && row.match_method === 'EXACT_NAME').length,
      ALIAS_MEDIA_MATCH: rows.filter((row) => row.status === 'VERIFIED' && row.match_method === 'ALIAS_MEDIA_MATCH').length,
      HIGH_CONFIDENCE: rows.filter((row) => row.status === 'HIGH_CONFIDENCE').length,
      REVIEW: rows.filter((row) => row.status === 'REVIEW').length,
      UNMATCHED: rows.filter((row) => row.status === 'UNMATCHED').length,
      CONFLICT: rows.filter((row) => row.status === 'CONFLICT').length,
      rawMethodCountsIncludingConflicts: {
        EXACT_SLUG: rows.filter((row) => row.match_method === 'EXACT_SLUG').length,
        EXACT_NAME: rows.filter((row) => row.match_method === 'EXACT_NAME').length,
        ALIAS_MEDIA_MATCH: rows.filter((row) => row.match_method === 'ALIAS_MEDIA_MATCH').length,
      },
    },
    coverage: {
      verifiedLocalRecords: verifiedRows.length,
      verifiedLocalRecordsTotal: rows.length,
      verifiedUniqueLocalExercises: new Set(verifiedRows.map((row) => row._local.normalizedName)).size,
      verifiedUniqueLocalExercisesTotal: new Set(rows.map((row) => row._local.normalizedName)).size,
      supabaseExercisesRepresentedByVerifiedMappings: verifiedBySupabase.size,
    },
    cardinality: {
      oneToOneMappings: [...verifiedBySupabase.values()].filter((locals) => locals.length === 1).length,
      manyLocalToOneSupabase: [...verifiedBySupabase.values()].filter((locals) => locals.length > 1).length,
      oneLocalToManyCandidates: candidateConflicts.length,
    },
    previousExactSlugs: {
      valid: previousExactSlugValid,
      conflicting: previousExactSlugConflicting,
      totalCurrentExactSlugMethodRows: previousExactSlugRows.length,
    },
    phase1BPreviousExactSlugs: {
      total: phase1BExactSlugRows.length,
      valid: phase1BExactSlugValid,
      conflicting: phase1BExactSlugRows.length - phase1BExactSlugValid,
    },
  };

  await fs.mkdir(REPORT_DIR, { recursive: true });

  const csvColumns = [
    'local_id',
    'local_name',
    'local_slug',
    'supabase_id',
    'supabase_name',
    'supabase_slug',
    'match_method',
    'confidence',
    'local_category',
    'supabase_category',
    'local_equipment',
    'supabase_equipment',
    'local_video_asset',
    'supabase_media_path',
    'status',
    'reason',
  ];
  const csv = [
    csvColumns.join(','),
    ...rows.map((row) => csvColumns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n');

  await fs.writeFile(CSV_PATH, `${csv}\n`);
  await fs.writeFile(JSON_PATH, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'Read-only offline mapping analysis. No runtime behavior, UI, Supabase data, local IDs, or exercise names were changed.',
    invalidRuntimeIdMatchingAudit: [
      {
        file: 'server/services/exerciseMediaService.js',
        function: 'resolveSupabaseExercise',
        lines: '169-176',
        issue: 'Explicit ID matching is valid only for true Supabase IDs. Passing MySQL exercise_catalog.id into this field produces false matches because ID spaces are independent.',
      },
      {
        file: 'server/routes.js',
        function: 'GET /api/exercises/catalog',
        lines: '18689-18694',
        issue: 'The route passes row.id from MySQL exercise_catalog into the media service as id. That must not be interpreted as a Supabase exercise ID.',
      },
      {
        file: 'server/routes.js',
        function: 'GET /api/user/:userId/program',
        lines: '13307-13312',
        issue: 'The route passes workout exercise_catalog_id into the media service as id. That must not be interpreted as a Supabase exercise ID.',
      },
    ],
    proposedSchema: {
      table: 'exercise_supabase_map',
      columns: [
        'exercise_catalog_id BIGINT NOT NULL',
        'supabase_exercise_id BIGINT NOT NULL',
        'match_method VARCHAR(64) NOT NULL',
        'confidence DECIMAL(4,2) NOT NULL',
        'verified TINYINT(1) NOT NULL DEFAULT 0',
        'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ],
      constraints: [
        'PRIMARY KEY (exercise_catalog_id, supabase_exercise_id)',
        'INDEX idx_exercise_supabase_map_supabase_id (supabase_exercise_id)',
        'No UNIQUE(supabase_exercise_id): verified analysis can contain many local records for one Supabase exercise.',
      ],
      notCreated: true,
    },
    summary,
    duplicateDetection: {
      duplicateNames,
      duplicateNormalizedNames,
      duplicateAliases,
      oneLocalToManyCandidates: candidateConflicts,
      manyLocalToOneSupabase: [...verifiedBySupabase.entries()]
        .filter(([, locals]) => locals.length > 1)
        .map(([supabase_id, local_ids]) => ({ supabase_id, local_ids })),
    },
    rows: rows.map(({ _local, _supabase, _candidateCount, ...row }) => ({
      ...row,
      candidate_count: _candidateCount,
      local_aliases: _local.aliases,
      local_primary_muscle: _local.primary_muscle,
      local_muscles: _local.muscles,
      supabase_media_filenames: _supabase?.mediaFilenames || [],
    })),
    datasets: {
      mysql: localExercises.map((row) => ({
        local_id: row.local_id,
        name: row.name,
        slug: row.slug,
        body_part: row.body_part,
        equipment: row.equipment,
        primary_muscle: row.primary_muscle,
        aliases: row.aliases,
        linkedVideoAsset: row.linkedVideoAsset,
      })),
      supabase: supabaseExercises.map((row) => ({
        supabase_id: row.supabase_id,
        name: row.name,
        slug: row.slug,
        equipment: row.equipment,
        categories: row.categories,
        muscles: row.muscles,
        mediaFilenames: row.mediaFilenames,
        mediaPaths: row.mediaPaths,
      })),
    },
  }, null, 2)}\n`);

  console.log(JSON.stringify(summary, null, 2));
};

try {
  await analyze();
} finally {
  await pool.end();
}
