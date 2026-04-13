import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Heart, Play } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Header } from '../components/ui/Header';
import { api } from '../services/api';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { listExerciseVideoAssets, resolveExerciseVideo } from '../services/exerciseVideos';
import { AppLanguage, getActiveLanguage, getStoredLanguage, pickLanguage } from '../services/language';
import { inferExerciseVideoBodyPart, normalizeExerciseVideoLookup } from '../shared/exerciseVideoManifest.js';
import { useScreenshotProtection } from '../shared/useScreenshotProtection';

const announcementVideoModules = import.meta.glob('../../assets/Workout/annanc/*.mp4', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const announcementVideosByFilter = Object.entries(announcementVideoModules).reduce<Record<string, string>>((acc, [path, url]) => {
  const fileName = path.split('/').pop() || '';
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const normalizedKey = String(baseName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (normalizedKey) {
    acc[normalizedKey] = url;
  }
  return acc;
}, {});

interface ExerciseLibraryProps {
  onBack: () => void;
  onExerciseClick: (exercise: {
    name: string;
    muscle: string;
    video?: string | null;
    exerciseCatalogId?: number | null;
    targetMuscles?: string[];
    anatomy?: string | string[];
  }) => void;
  initialFilter?: string;
  onFilterChange?: (filter: string) => void;
}

interface CatalogExercise {
  id: number;
  name: string;
  muscle: string;
  bodyPart?: string | null;
  hasLinkedVideo?: boolean;
  linkedVideoAsset?: string | null;
  linkedVideoMatchType?: 'alias' | 'filename' | 'fallback' | 'none' | null;
}

type CatalogExerciseWithVideo = CatalogExercise & {
  videoUrl: string;
  videoAssetName: string;
};

type LibraryExercise = {
  id: number | string;
  name: string;
  muscle: string;
  bodyPart?: string | null;
  sourceFolder?: string | null;
  videoUrl: string;
  videoAssetName: string;
};

const toTitleCase = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const stripExercisePrefix = (value: string) =>
  String(value || '')
    .replace(/^\d+(?:\.\d+)?\s+(?:back|chest|legs|shoulders|arms|abs)\s+/i, '')
    .replace(/^\d+(?:\.\d+)?\s+/, '')
    .trim();

const toFallbackExerciseName = (fileName: string) =>
  String(fileName || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*&\s*/g, ' & ')
    .trim();

const toCanonicalExerciseLibraryMuscle = (value?: string | null) => {
  const key = normalizeFilterKey(String(value || ''));
  if (!key) return '';
  if (key === 'ab' || key === 'abs' || key === 'core') return 'Abs';
  if (key === 'back' || key === 'lat' || key === 'lats' || key === 'trap' || key === 'traps') return 'Back';
  if (key === 'bicep' || key === 'biceps') return 'Biceps';
  if (key === 'tricep' || key === 'triceps') return 'Triceps';
  if (key === 'forearm' || key === 'forearms') return 'Forearms';
  if (key === 'calf' || key === 'calves') return 'Calves';
  if (key === 'chest' || key === 'pec' || key === 'pecs') return 'Chest';
  if (key === 'glute' || key === 'glutes') return 'Glutes';
  if (key === 'hamstring' || key === 'hamstrings') return 'Hamstrings';
  if (key === 'quad' || key === 'quads' || key === 'quadricep' || key === 'quadriceps') return 'Quadriceps';
  if (key === 'adductor' || key === 'adductors') return 'Adductors';
  if (key === 'shoulder' || key === 'shoulders' || key === 'delt' || key === 'delts') return 'Shoulders';
  if (key === 'arm' || key === 'arms') return 'Arms';
  if (key === 'leg' || key === 'legs') return 'Legs';
  return toTitleCase(String(value || ''));
};

const bodyPartToMuscleLabel = (bodyPart?: string | null) => {
  const directLabel = toCanonicalExerciseLibraryMuscle(bodyPart);
  if (directLabel) return directLabel;
  const key = inferExerciseVideoBodyPart(bodyPart || '');
  if (key === 'back') return 'Back';
  if (key === 'chest') return 'Chest';
  if (key === 'legs') return 'Legs';
  if (key === 'shoulders') return 'Shoulders';
  if (key === 'arms') return 'Arms';
  if (key === 'abs') return 'Abs';
  const text = String(bodyPart || '').trim();
  if (!text) return 'General';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const getExerciseAssetScore = (exercise: { name: string; videoAssetName: string }) => {
  const normalizedName = normalizeExerciseVideoLookup(stripExercisePrefix(exercise.name));
  const normalizedAsset = normalizeExerciseVideoLookup(exercise.videoAssetName.replace(/\.[^.]+$/, ''));
  const nameTokens = new Set(normalizedName.split(' ').filter(Boolean));
  const overlap = normalizedAsset
    .split(' ')
    .filter((token) => token && nameTokens.has(token)).length;
  return overlap * 100 - normalizedName.length;
};

const isBetterAssetMatch = (
  candidate: CatalogExerciseWithVideo,
  current: CatalogExerciseWithVideo,
) => getExerciseAssetScore(candidate) > getExerciseAssetScore(current);

const normalizeFilterKey = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const ARM_FILTER_KEYS = new Set(['arm', 'arms']);
const ARM_SUBFILTER_KEYS = new Set(['bicep', 'biceps', 'tricep', 'triceps', 'forearm', 'forearms']);
const LEG_FILTER_KEYS = new Set(['leg', 'legs']);
const LEG_SUBFILTER_KEYS = new Set(['quadricep', 'quadriceps', 'hamstring', 'hamstrings', 'glute', 'glutes', 'calf', 'calves', 'adductor', 'adductors']);

const inferExerciseLibraryMuscle = (value: {
  name?: string | null;
  muscle?: string | null;
  bodyPart?: string | null;
  sourceFolder?: string | null;
  videoAssetName?: string | null;
}) => {
  const sourceFolderLabel = toCanonicalExerciseLibraryMuscle(value.sourceFolder);
  const bodyPartLabel = toCanonicalExerciseLibraryMuscle(value.bodyPart);
  const muscleLabel = toCanonicalExerciseLibraryMuscle(value.muscle);
  const directLabel = sourceFolderLabel || bodyPartLabel || muscleLabel;
  const combinedText = normalizeExerciseVideoLookup([
    value.name,
    value.muscle,
    value.bodyPart,
    value.sourceFolder,
    value.videoAssetName,
  ].filter(Boolean).join(' '));

  if (!combinedText) return 'General';
  if (directLabel && !['Legs', 'Arms'].includes(directLabel)) return directLabel;
  if (/(adductor|inner thigh)/.test(combinedText)) return 'Adductors';
  if (/(calf|calves)/.test(combinedText)) return 'Calves';
  if (/(glute|hip thrust|glute bridge)/.test(combinedText)) return 'Glutes';
  if (/(hamstring|leg curl|lying curl|seated curl|romanian deadlift|\brdl\b|stiff leg deadlift)/.test(combinedText)) return 'Hamstrings';
  if (/(quad|quadricep|leg extension|leg press|hack squat|goblet squat|bulgarian split squat|lunge|step up|squat)/.test(combinedText)) return 'Quadriceps';
  if (/(bicep|biceps|brachialis|\bcurl\b)/.test(combinedText)) return 'Biceps';
  if (/(tricep|triceps|push down|skull crusher|kick back|french press|overhead extension)/.test(combinedText)) return 'Triceps';
  if (/(forearm|wrist|grip)/.test(combinedText)) return 'Forearms';
  if (directLabel) return directLabel;
  return bodyPartToMuscleLabel(value.bodyPart || value.sourceFolder || value.muscle);
};

export function ExerciseLibrary({
  onBack,
  onExerciseClick,
  initialFilter = 'All',
  onFilterChange,
}: ExerciseLibraryProps) {
  useScreenshotProtection();
  const introVideoRef = useRef<HTMLVideoElement>(null);
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage(getStoredLanguage()));
  const copy = pickLanguage(language, {
    en: {
      title: 'Exercise Library',
      pageTitle: 'What do you want to train today?',
      pageSubtitle: 'Select a muscle group to explore exercises.',
      pageHelper: 'Select a muscle group to continue.',
      sectionUpper: 'Upper Body',
      sectionLower: 'Lower Body',
      sectionCore: 'Core',
      sectionOther: 'Other',
      selectedBadge: 'Selected',
      buildStronger: (label: string) => `Build Stronger ${label}`,
      loadError: 'Failed to load exercises',
      empty: 'No videos added for this muscle yet.',
    },
    ar: {
      title: '\u0645\u0643\u062a\u0628\u0629 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646',
      pageTitle: '\u0645\u0627 \u0627\u0644\u0630\u064a \u062a\u0631\u064a\u062f \u062a\u062f\u0631\u064a\u0628\u0647 \u0627\u0644\u064a\u0648\u0645\u061f',
      pageSubtitle: '\u0627\u062e\u062a\u0631 \u0645\u062c\u0645\u0648\u0639\u0629 \u0639\u0636\u0644\u064a\u0629 \u0644\u0627\u0633\u062a\u0639\u0631\u0627\u0636 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646.',
      pageHelper: '\u0627\u062e\u062a\u0631 \u0645\u062c\u0645\u0648\u0639\u0629 \u0639\u0636\u0644\u064a\u0629 \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629.',
      sectionUpper: '\u0627\u0644\u062c\u0632\u0621 \u0627\u0644\u0639\u0644\u0648\u064a',
      sectionLower: '\u0627\u0644\u062c\u0632\u0621 \u0627\u0644\u0633\u0641\u0644\u064a',
      sectionCore: '\u0627\u0644\u062c\u0630\u0639',
      sectionOther: '\u0623\u062e\u0631\u0649',
      selectedBadge: '\u0645\u062e\u062a\u0627\u0631\u0629',
      buildStronger: (label: string) => `\u0642\u0648\u0651\u0650 \u0639\u0636\u0644\u0627\u062a ${label}`,
      loadError: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646',
      empty: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u064a\u062f\u064a\u0648\u0647\u0627\u062a \u0644\u0647\u0630\u0647 \u0627\u0644\u0639\u0636\u0644\u0629 \u0628\u0639\u062f.',
    },
    it: {
      title: 'Libreria Esercizi',
      pageTitle: 'Cosa vuoi allenare oggi?',
      pageSubtitle: 'Seleziona un gruppo muscolare per esplorare gli esercizi.',
      pageHelper: 'Seleziona un gruppo muscolare per continuare.',
      sectionUpper: 'Parte superiore',
      sectionLower: 'Parte inferiore',
      sectionCore: 'Core',
      sectionOther: 'Altro',
      selectedBadge: 'Selezionato',
      buildStronger: (label: string) => `Allena meglio ${label}`,
      loadError: 'Impossibile caricare gli esercizi',
      empty: 'Non ci sono ancora video per questo gruppo muscolare.',
    },
    de: {
      title: 'Ubungsbibliothek',
      pageTitle: 'Was willst du heute trainieren?',
      pageSubtitle: 'Waehle eine Muskelgruppe, um Uebungen zu sehen.',
      pageHelper: 'Waehle eine Muskelgruppe, um fortzufahren.',
      sectionUpper: 'Oberkoerper',
      sectionLower: 'Unterkoerper',
      sectionCore: 'Core',
      sectionOther: 'Weitere',
      selectedBadge: 'Ausgewaehlt',
      buildStronger: (label: string) => `Starkere ${label}`,
      loadError: 'Ubungen konnten nicht geladen werden',
      empty: 'Fur diese Muskelgruppe gibt es noch keine Videos.',
    },
    fr: {
      title: 'Bibliotheque des exercices',
      pageTitle: 'Que veux-tu entrainer aujourd hui ?',
      pageSubtitle: 'Selectionne un groupe musculaire pour explorer les exercices.',
      pageHelper: 'Selectionne un groupe musculaire pour continuer.',
      sectionUpper: 'Haut du corps',
      sectionLower: 'Bas du corps',
      sectionCore: 'Sangle abdominale',
      sectionOther: 'Autres',
      selectedBadge: 'Selectionne',
      buildStronger: (label: string) => `Renforce ${label}`,
      loadError: 'Impossible de charger les exercices',
      empty: 'Aucune video pour ce groupe musculaire pour le moment.',
    },
  });
  const [selectedFilter, setSelectedFilter] = useState(initialFilter || 'All');
  const [lastSelectedFilter, setLastSelectedFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<string[]>(['All', 'Chest', 'Back', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Shoulders', 'Biceps', 'Triceps', 'Abs']);
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likes, setLikes] = useState<{ [key: string]: { count: number; liked: boolean } }>({});
  const [activeIntroFilter, setActiveIntroFilter] = useState<string | null>(null);
  const bodyPartSkeletons = Array.from({ length: 6 }, (_, index) => `body-part-skeleton-${index}`);
  const exerciseSkeletons = Array.from({ length: 6 }, (_, index) => `exercise-skeleton-${index}`);

  useEffect(() => {
    setSelectedFilter(initialFilter || 'All');
  }, [initialFilter]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLanguage(getActiveLanguage(getStoredLanguage()));
    };

    handleLanguageChanged();
    window.addEventListener('app-language-changed', handleLanguageChanged);
    return () => window.removeEventListener('app-language-changed', handleLanguageChanged);
  }, []);

  useEffect(() => {
    onFilterChange?.(selectedFilter);
  }, [onFilterChange, selectedFilter]);

  const getMuscleLabel = (value: string) => {
    const key = String(value || '').trim().toLowerCase();
    const labels = pickLanguage(language, {
      en: {
        abs: 'Abs',
        adductors: 'Adductors',
        arms: 'Arms',
        arm: 'Arms',
        back: 'Back',
        biceps: 'Biceps',
        bicep: 'Biceps',
        calves: 'Calves',
        chest: 'Chest',
        forearms: 'Forearms',
        glutes: 'Glutes',
        hamstrings: 'Hamstrings',
        legs: 'Legs',
        leg: 'Legs',
        quadriceps: 'Quadriceps',
        shoulders: 'Shoulders',
        shoulder: 'Shoulders',
        triceps: 'Triceps',
        tricep: 'Triceps',
        general: 'General',
      },
      ar: {
        abs: '\u0627\u0644\u0628\u0637\u0646',
        adductors: '\u0627\u0644\u0645\u0642\u0631\u0628\u0627\u062a',
        arms: '\u0627\u0644\u0630\u0631\u0627\u0639\u064a\u0646',
        arm: '\u0627\u0644\u0630\u0631\u0627\u0639\u064a\u0646',
        back: '\u0627\u0644\u0638\u0647\u0631',
        biceps: '\u0627\u0644\u0639\u0636\u0644\u0629 \u0630\u0627\u062a \u0627\u0644\u0631\u0623\u0633\u064a\u0646',
        bicep: '\u0627\u0644\u0639\u0636\u0644\u0629 \u0630\u0627\u062a \u0627\u0644\u0631\u0623\u0633\u064a\u0646',
        calves: '\u0627\u0644\u0633\u0645\u0627\u0646\u0629',
        chest: '\u0627\u0644\u0635\u062f\u0631',
        forearms: '\u0627\u0644\u0633\u0627\u0639\u062f',
        glutes: '\u0627\u0644\u0623\u0644\u0648\u064a\u0629',
        hamstrings: '\u0627\u0644\u062e\u0644\u0641\u064a\u0629',
        legs: '\u0627\u0644\u0623\u0631\u062c\u0644',
        leg: '\u0627\u0644\u0623\u0631\u062c\u0644',
        quadriceps: '\u0627\u0644\u0631\u0628\u0627\u0639\u064a\u0629',
        shoulders: '\u0627\u0644\u0623\u0643\u062a\u0627\u0641',
        shoulder: '\u0627\u0644\u0623\u0643\u062a\u0627\u0641',
        triceps: '\u0627\u0644\u0639\u0636\u0644\u0629 \u062b\u0644\u0627\u062b\u064a\u0629 \u0627\u0644\u0631\u0624\u0648\u0633',
        tricep: '\u0627\u0644\u0639\u0636\u0644\u0629 \u062b\u0644\u0627\u062b\u064a\u0629 \u0627\u0644\u0631\u0624\u0648\u0633',
        general: '\u0639\u0627\u0645',
      },
      it: {
        abs: 'Addome',
        adductors: 'Adduttori',
        arms: 'Braccia',
        arm: 'Braccia',
        back: 'Schiena',
        biceps: 'Bicipiti',
        bicep: 'Bicipiti',
        calves: 'Polpacci',
        chest: 'Petto',
        forearms: 'Avambracci',
        glutes: 'Glutei',
        hamstrings: 'Femorali',
        legs: 'Gambe',
        leg: 'Gambe',
        quadriceps: 'Quadricipiti',
        shoulders: 'Spalle',
        shoulder: 'Spalle',
        triceps: 'Tricipiti',
        tricep: 'Tricipiti',
        general: 'Generale',
      },
      de: {
        abs: 'Bauch',
        adductors: 'Adduktoren',
        arms: 'Arme',
        arm: 'Arme',
        back: 'Rucken',
        biceps: 'Bizeps',
        bicep: 'Bizeps',
        calves: 'Waden',
        chest: 'Brust',
        forearms: 'Unterarme',
        glutes: 'Gesaess',
        hamstrings: 'Beinbeuger',
        legs: 'Beine',
        leg: 'Beine',
        quadriceps: 'Quadrizeps',
        shoulders: 'Schultern',
        shoulder: 'Schultern',
        triceps: 'Trizeps',
        tricep: 'Trizeps',
        general: 'Allgemein',
      },
    });
    return labels[key as keyof typeof labels] ?? value;
  };
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [filtersData, catalogData] = await Promise.all([
          api.getExerciseCatalogFilters(),
          api.getExerciseCatalog('All', '', 500),
        ]);

        if (Array.isArray(filtersData?.filters) && filtersData.filters.length) {
          setFilters(filtersData.filters);
        }

        if (Array.isArray(catalogData?.exercises)) {
          setExercises(catalogData.exercises);
        } else {
          setExercises([]);
        }
      } catch (loadError) {
        console.error('Failed to load exercise catalog:', loadError);
        setError(copy.loadError);
        setExercises([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const toggleLike = (exerciseName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikes((prev) => {
      const current = prev[exerciseName] || { count: 0, liked: false };
      return {
        ...prev,
        [exerciseName]: {
          count: current.liked ? current.count - 1 : current.count + 1,
          liked: !current.liked,
        },
      };
    });
  };

  const getIntroVideoForFilter = (filter: string) => {
    const key = normalizeFilterKey(filter);
    return announcementVideosByFilter[key] || null;
  };

  const allVideoAssets = useMemo(
    () => listExerciseVideoAssets(),
    [],
  );

  const folderFilters = useMemo(
    () =>
      Array.from(
        new Set(
          allVideoAssets
            .map((asset) => toTitleCase(asset.folderName))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [allVideoAssets],
  );

  const catalogExercisesWithVideo = useMemo<CatalogExerciseWithVideo[]>(
    () =>
      exercises
        .map((exercise) => {
          const resolvedVideo = resolveExerciseVideo({
            name: exercise.name,
            muscle: exercise.muscle,
            bodyPart: exercise.bodyPart,
          });
          const videoAssetName = resolvedVideo.assetName || exercise.linkedVideoAsset || '';
          if (!resolvedVideo.url || !videoAssetName) return null;
          return {
            ...exercise,
            videoUrl: resolvedVideo.url,
            videoAssetName,
          };
        })
        .filter((exercise): exercise is CatalogExerciseWithVideo => Boolean(exercise)),
    [exercises],
  );

  const dedupedCatalogExercises = useMemo(
    () => {
      const byAsset = new Map<string, CatalogExerciseWithVideo>();
      catalogExercisesWithVideo.forEach((exercise) => {
        const current = byAsset.get(exercise.videoAssetName);
        if (!current || isBetterAssetMatch(exercise, current)) {
          byAsset.set(exercise.videoAssetName, exercise);
        }
      });
      return Array.from(byAsset.values());
    },
    [catalogExercisesWithVideo],
  );

  const fallbackVideoExercises = useMemo<LibraryExercise[]>(
    () => {
      const representedAssets = new Set(dedupedCatalogExercises.map((exercise) => exercise.videoAssetName));
      return allVideoAssets
        .filter((asset) => !representedAssets.has(asset.fileName))
        .map((asset) => ({
          id: `video-${asset.fileName}`,
          name: toFallbackExerciseName(asset.fileName),
          muscle: inferExerciseLibraryMuscle({
            name: asset.fileName,
            bodyPart: asset.bodyPart,
            sourceFolder: asset.folderName,
            videoAssetName: asset.fileName,
          }),
          bodyPart: asset.bodyPart,
          sourceFolder: toTitleCase(asset.folderName),
          videoUrl: asset.url,
          videoAssetName: asset.fileName,
        }));
    },
    [allVideoAssets, dedupedCatalogExercises],
  );

  const exercisesWithVideo = useMemo<LibraryExercise[]>(
    () => {
      const folderByAssetName = new Map(
        allVideoAssets.map((asset) => [asset.fileName, toTitleCase(asset.folderName)]),
      );
      return [
        ...dedupedCatalogExercises.map((exercise) => ({
          id: exercise.id,
          name: toFallbackExerciseName(exercise.videoAssetName),
          muscle: inferExerciseLibraryMuscle({
            name: exercise.name || exercise.videoAssetName,
            muscle: exercise.muscle,
            bodyPart: exercise.bodyPart,
            sourceFolder: folderByAssetName.get(exercise.videoAssetName) || null,
            videoAssetName: exercise.videoAssetName,
          }),
          bodyPart: exercise.bodyPart,
          sourceFolder: folderByAssetName.get(exercise.videoAssetName) || null,
          videoUrl: exercise.videoUrl,
          videoAssetName: exercise.videoAssetName,
        })),
        ...fallbackVideoExercises,
      ];
    },
    [allVideoAssets, dedupedCatalogExercises, fallbackVideoExercises],
  );

  const visibleMuscleFilters = useMemo(() => {
    const toCanonicalLabel = (value: string) => {
      const key = normalizeFilterKey(value);
      if (!key) return '';
      if (key === 'cardio') return '';
      if (key === 'shoulder' || key === 'shoulders') return 'Shoulders';
      if (key === 'arm' || key === 'arms') return 'Arms';
      if (key === 'leg' || key === 'legs') return 'Legs';
      if (key === 'ab' || key === 'abs' || key === 'core') return 'Abs';
      if (key === 'bicep' || key === 'biceps') return 'Biceps';
      if (key === 'tricep' || key === 'triceps') return 'Triceps';
      if (key === 'quad' || key === 'quadricep' || key === 'quadriceps') return 'Quadriceps';
      if (key === 'hamstring' || key === 'hamstrings') return 'Hamstrings';
      if (key === 'glute' || key === 'glutes') return 'Glutes';
      return toTitleCase(value);
    };

    const apiFilters = filters
      .filter((filter) => String(filter).toLowerCase() !== 'all')
      .map((filter) => toCanonicalLabel(filter));
    const exerciseFilters = exercisesWithVideo.map((exercise) => toCanonicalLabel(exercise.muscle));

    const merged = [...apiFilters, ...exerciseFilters, ...folderFilters.map(toCanonicalLabel)].filter(Boolean);
    const byKey = new Map<string, string>();
    merged.forEach((label) => {
      const key = normalizeFilterKey(label);
      if (!key || byKey.has(key)) return;
      byKey.set(key, label);
    });

    const hasSpecificArmFilters = Array.from(byKey.keys()).some((key) => ARM_SUBFILTER_KEYS.has(key));
    if (hasSpecificArmFilters) {
      Array.from(byKey.keys()).forEach((key) => {
        if (ARM_FILTER_KEYS.has(key)) {
          byKey.delete(key);
        }
      });
    }

    const hasSpecificLegFilters = Array.from(byKey.keys()).some((key) => LEG_SUBFILTER_KEYS.has(key));
    if (hasSpecificLegFilters) {
      Array.from(byKey.keys()).forEach((key) => {
        if (LEG_FILTER_KEYS.has(key)) {
          byKey.delete(key);
        }
      });
    }

    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [exercisesWithVideo, filters, folderFilters]);

  const activeIntroVideoUrl = useMemo(
    () => (activeIntroFilter ? getIntroVideoForFilter(activeIntroFilter) : null),
    [activeIntroFilter],
  );

  useEffect(() => {
    if (!activeIntroVideoUrl) return;
    const video = introVideoRef.current;
    if (!video) return;
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }, [activeIntroVideoUrl]);

  const closeIntroPlayer = () => {
    const video = introVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setActiveIntroFilter(null);
    setSelectedFilter('All');
  };

  const completeIntroPlayer = () => {
    const video = introVideoRef.current;
    if (video) {
      video.pause();
    }
    setActiveIntroFilter(null);
  };

  const handleFilterSelect = (filter: string) => {
    setSelectedFilter(filter);
    setLastSelectedFilter(filter);
    const introVideo = getIntroVideoForFilter(filter);
    setActiveIntroFilter(introVideo ? filter : null);
  };

  useEffect(() => {
    if (selectedFilter === 'All') return;
    if (!visibleMuscleFilters.includes(selectedFilter)) {
      setSelectedFilter('All');
    }
  }, [visibleMuscleFilters, selectedFilter]);

  const filteredExercises = useMemo(() => {
    if (selectedFilter === 'All') return [];
    const normalizedFilter = normalizeFilterKey(selectedFilter);
    return exercisesWithVideo.filter((exercise) => {
      const muscleKey = normalizeFilterKey(String(exercise.muscle || ''));
      const folderKey = normalizeFilterKey(String(exercise.sourceFolder || ''));
      if (ARM_FILTER_KEYS.has(normalizedFilter)) {
        return (
          ARM_FILTER_KEYS.has(muscleKey)
          || ARM_FILTER_KEYS.has(folderKey)
          || ARM_SUBFILTER_KEYS.has(muscleKey)
          || ARM_SUBFILTER_KEYS.has(folderKey)
        );
      }
      if (LEG_FILTER_KEYS.has(normalizedFilter)) {
        return (
          LEG_FILTER_KEYS.has(muscleKey)
          || LEG_FILTER_KEYS.has(folderKey)
          || LEG_SUBFILTER_KEYS.has(muscleKey)
          || LEG_SUBFILTER_KEYS.has(folderKey)
        );
      }
      const muscleMatch = muscleKey === normalizedFilter;
      const folderMatch = folderKey === normalizedFilter;
      return muscleMatch || folderMatch;
    });
  }, [exercisesWithVideo, selectedFilter]);

  const isRtl = language === 'ar';
  const groupedMuscleSections = useMemo(() => {
    const upperSet = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'arms']);
    const lowerSet = new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'legs']);
    const coreSet = new Set(['abs', 'core']);
    const groups = {
      upper: [] as string[],
      lower: [] as string[],
      core: [] as string[],
      other: [] as string[],
    };

    visibleMuscleFilters.forEach((filter) => {
      const key = normalizeFilterKey(filter);
      if (coreSet.has(key)) {
        groups.core.push(filter);
        return;
      }
      if (upperSet.has(key)) {
        groups.upper.push(filter);
        return;
      }
      if (lowerSet.has(key)) {
        groups.lower.push(filter);
        return;
      }
      groups.other.push(filter);
    });

    return [
      { id: 'upper', label: copy.sectionUpper, items: groups.upper },
      { id: 'lower', label: copy.sectionLower, items: groups.lower },
      { id: 'core', label: copy.sectionCore, items: groups.core },
      { id: 'other', label: copy.sectionOther, items: groups.other },
    ].filter((section) => section.items.length > 0);
  }, [copy.sectionCore, copy.sectionLower, copy.sectionOther, copy.sectionUpper, visibleMuscleFilters]);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background pb-24">
      <div className="px-4 pt-2 sm:px-6">
        <Header
          title={selectedFilter === 'All' ? copy.title : copy.buildStronger(getMuscleLabel(selectedFilter))}
          titleClassName="font-black uppercase tracking-[0.06em]"
          onBack={selectedFilter === 'All' ? onBack : () => setSelectedFilter('All')}
        />
      </div>

      {selectedFilter === 'All' && !loading && (
        <div className="mb-8 space-y-6 px-4 sm:px-6">
          <div className={isRtl ? 'space-y-2 text-right' : 'space-y-2'}>
            <h2 className="text-[1.65rem] font-electrolize font-bold text-text-primary">
              {copy.pageTitle}
            </h2>
            <p className="text-sm text-text-secondary">{copy.pageSubtitle}</p>
            <p className="text-xs text-text-tertiary">{copy.pageHelper}</p>
          </div>

          {groupedMuscleSections.map((section) => (
            <div key={section.id} className="space-y-3">
              <div className={isRtl ? 'flex items-center gap-3 text-right' : 'flex items-center gap-3'}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {section.label}
                </div>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {section.items.map((filter) => {
                  const label = getMuscleLabel(filter);
                  const isSelected = lastSelectedFilter === filter;
                  return (
                    <button
                      key={filter}
                      onClick={() => handleFilterSelect(filter)}
                      aria-pressed={isSelected}
                      className={[
                        'group relative overflow-hidden rounded-2xl border p-3 transition-all duration-200 focus:outline-none',
                        'focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.98]',
                        isRtl ? 'text-right' : 'text-left',
                        isSelected
                          ? 'border-accent/45 bg-accent/10 shadow-[0_10px_24px_rgba(0,0,0,0.28)]'
                          : 'border-white/10 bg-card/70 hover:border-accent/25 hover:bg-white/[0.03]',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'rounded-xl border p-3',
                          isSelected ? 'border-accent/35 bg-accent/10' : 'border-white/10 bg-black/30',
                        ].join(' ')}
                      >
                        <div className="flex h-20 items-center justify-center sm:h-24">
                          <img
                            src={getBodyPartImage(filter)}
                            alt={label}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className={isSelected ? 'text-sm font-semibold text-text-primary' : 'text-sm font-semibold text-text-secondary'}>
                          {label}
                        </div>
                        {isSelected && (
                          <span className="rounded-full border border-accent/35 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                            {copy.selectedBadge}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && selectedFilter === 'All' && (
        <div className="mb-6 px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {bodyPartSkeletons.map((key) => (
              <div
                key={key}
                className="overflow-hidden rounded-2xl border border-white/10 bg-card p-3 animate-pulse"
              >
                <div className="-mx-3 -mt-1 h-28 w-[calc(100%+1.5rem)] bg-white/5 sm:h-32" />
                <div className="-mx-3 mt-1 border-t border-white/10" />
                <div className="mt-3 h-4 w-3/4 rounded bg-white/10" />
                <div className="mt-2 h-3 w-1/2 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && selectedFilter !== 'All' && (
        <div className="grid grid-cols-2 gap-4 px-4 sm:px-6">
          {exerciseSkeletons.map((key) => (
            <div
              key={key}
              className="surface-card overflow-hidden rounded-2xl border border-white/10 animate-pulse"
            >
              <div className="aspect-[4/3] w-full bg-white/5" />
              <div className="px-3 pb-3 pt-3">
                <div className="h-4 w-4/5 rounded bg-white/10" />
                <div className="mt-2 flex justify-end">
                  <div className="h-3 w-8 rounded bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="px-4 text-sm text-red-400 sm:px-6">{error}</div>
      )}

      {!loading && !error && selectedFilter !== 'All' && (
        <>
          <div className="grid grid-cols-2 gap-4 px-4 sm:px-6">
            {filteredExercises.map((exercise) => {
              const likeKey = `${exercise.muscle}:${exercise.videoAssetName}`;
              const likeData = likes[likeKey] || { count: 0, liked: false };
              const videoUrl = exercise.videoUrl;

              return (
                <Card
                  key={`${exercise.id}-${exercise.videoAssetName}`}
                  onClick={() => onExerciseClick({
                    name: exercise.name,
                    muscle: exercise.muscle,
                    video: videoUrl,
                    exerciseCatalogId: typeof exercise.id === 'number' ? exercise.id : null,
                    targetMuscles: exercise.muscle ? [exercise.muscle] : undefined,
                    anatomy: exercise.muscle || exercise.bodyPart || undefined,
                  })}
                  className="group cursor-pointer overflow-hidden !p-0 transition-colors hover:border-accent/20"
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-white/5">
                    <video
                      src={videoUrl}
                      poster={getBodyPartImage(exercise.muscle || exercise.bodyPart)}
                      className="block h-full w-full bg-black object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors group-hover:bg-accent group-hover:text-black">
                        <Play size={12} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                        {exercise.name}
                      </div>
                      <button
                        onClick={(e) => toggleLike(likeKey, e)}
                        className="flex items-center gap-1"
                      >
                        <Heart
                          size={14}
                          className={likeData.liked ? 'fill-red-500 text-red-500' : 'text-text-secondary'}
                        />
                        <span className="text-[10px] text-text-secondary">{Math.max(0, likeData.count)}</span>
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {filteredExercises.length === 0 && (
            <div className="mt-6 px-4 sm:px-6">
              <div className="surface-card rounded-2xl border border-white/10 p-5 text-center text-sm text-text-secondary">
                {copy.empty}
              </div>
            </div>
          )}
        </>
      )}

      {activeIntroVideoUrl && (
        <div className="fixed inset-0 z-[100] flex min-h-screen flex-col bg-black">
          <div className="absolute left-4 right-4 top-[max(1rem,env(safe-area-inset-top,0px)+0.5rem)] z-10 flex items-center justify-between gap-3">
            <button
              onClick={closeIntroPlayer}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-colors hover:border-accent/40"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onClick={completeIntroPlayer}
              className="rounded-full border border-white/15 bg-black/50 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:border-accent/40"
            >
              Skip
            </button>
          </div>

          <video
            ref={introVideoRef}
            key={activeIntroVideoUrl}
            src={activeIntroVideoUrl}
            className="h-screen w-screen bg-black object-contain"
            autoPlay
            playsInline
            preload="auto"
            onEnded={completeIntroPlayer}
            onError={completeIntroPlayer}
          />
        </div>
      )}
    </div>
  );
}
