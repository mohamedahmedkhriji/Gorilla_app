import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Heart, Play } from 'lucide-react';
import { api } from '../services/api';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { inferExerciseVideoBodyPart, normalizeExerciseVideoLookup } from '../shared/exerciseVideoManifest.js';
import { listExerciseVideoAssets, resolveExerciseVideo } from '../services/exerciseVideos';
import { getActiveLanguage, getStoredLanguage } from '../services/language';

interface ExerciseLibraryProps {
  onBack: () => void;
  onExerciseClick: (exercise: {name: string, muscle: string, video?: string | null}) => void;
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

const bodyPartToMuscleLabel = (bodyPart?: string | null) => {
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

export function ExerciseLibrary({
  onBack,
  onExerciseClick,
  initialFilter = 'All',
  onFilterChange,
}: ExerciseLibraryProps) {
  const isArabic = getActiveLanguage(getStoredLanguage()) === 'ar';
  const copy = {
    title: isArabic ? 'مكتبة التمارين' : 'Exercise Library',
    buildStronger: (label: string) => (isArabic ? `قوِّ عضلات ${label}` : `Build Stronger ${label}`),
    loadError: isArabic ? 'تعذر تحميل التمارين' : 'Failed to load exercises',
    empty: isArabic ? 'لا توجد فيديوهات لهذه العضلة بعد.' : 'No videos added for this muscle yet.',
  };
  const [selectedFilter, setSelectedFilter] = useState(initialFilter || 'All');
  const [filters, setFilters] = useState<string[]>(['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs']);
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likes, setLikes] = useState<{[key: string]: {count: number, liked: boolean}}>({});
  const bodyPartSkeletons = Array.from({ length: 6 }, (_, index) => `body-part-skeleton-${index}`);
  const exerciseSkeletons = Array.from({ length: 6 }, (_, index) => `exercise-skeleton-${index}`);

  useEffect(() => {
    setSelectedFilter(initialFilter || 'All');
  }, [initialFilter]);

  useEffect(() => {
    onFilterChange?.(selectedFilter);
  }, [onFilterChange, selectedFilter]);

  const getMuscleLabel = (value: string) => {
    if (!isArabic) return value;
    const key = String(value || '').trim().toLowerCase();
    const map: Record<string, string> = {
      abs: 'البطن',
      arms: 'الذراعين',
      arm: 'الذراعين',
      back: 'الظهر',
      biceps: 'العضلة ذات الرأسين',
      bicep: 'العضلة ذات الرأسين',
      chest: 'الصدر',
      legs: 'الأرجل',
      leg: 'الأرجل',
      shoulders: 'الأكتاف',
      shoulder: 'الأكتاف',
      triceps: 'العضلة ثلاثية الرؤوس',
      tricep: 'العضلة ثلاثية الرؤوس',
      general: 'عام',
    };
    return map[key] ?? value;
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
          setSelectedFilter((current) => (filtersData.filters.includes(current) ? current : 'All'));
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
          muscle: toTitleCase(asset.folderName) || bodyPartToMuscleLabel(asset.bodyPart),
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
          muscle: folderByAssetName.get(exercise.videoAssetName) || exercise.muscle,
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
    const normalizeKey = (value: string) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const toCanonicalLabel = (value: string) => {
      const key = normalizeKey(value);
      if (!key) return '';
      if (key === 'shoulder' || key === 'shoulders') return 'Shoulders';
      if (key === 'arm' || key === 'arms') return 'Arms';
      if (key === 'leg' || key === 'legs') return 'Legs';
      if (key === 'ab' || key === 'abs' || key === 'core') return 'Abs';
      if (key === 'bicep' || key === 'biceps') return 'Biceps';
      if (key === 'tricep' || key === 'triceps') return 'Triceps';
      return toTitleCase(value);
    };

    const apiFilters = filters
      .filter((filter) => String(filter).toLowerCase() !== 'all')
      .map((filter) => toCanonicalLabel(filter));

    const merged = [...apiFilters, ...folderFilters.map(toCanonicalLabel)].filter(Boolean);
    const byKey = new Map<string, string>();
    merged.forEach((label) => {
      const key = normalizeKey(label);
      if (!key || byKey.has(key)) return;
      byKey.set(key, label);
    });

    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [filters, folderFilters]);

  useEffect(() => {
    if (selectedFilter === 'All') return;
    if (!visibleMuscleFilters.includes(selectedFilter)) {
      setSelectedFilter('All');
    }
  }, [visibleMuscleFilters, selectedFilter]);

  const filteredExercises = useMemo(() => {
    if (selectedFilter === 'All') return [];
    const normalizedFilter = selectedFilter.trim().toLowerCase();
    return exercisesWithVideo.filter((exercise) => {
      const muscleMatch = String(exercise.muscle || '').trim().toLowerCase() === normalizedFilter;
      const folderMatch = String(exercise.sourceFolder || '').trim().toLowerCase() === normalizedFilter;
      return muscleMatch || folderMatch;
    });
  }, [exercisesWithVideo, selectedFilter]);

  const getCount = (filter: string) => {
    if (filter === 'All') return exercisesWithVideo.length;
    const count = exercisesWithVideo.filter(ex => ex.muscle === filter).length;
    return count > 99 ? '99+' : count;
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={selectedFilter === 'All' ? copy.title : copy.buildStronger(getMuscleLabel(selectedFilter))}
          titleClassName="font-black uppercase tracking-[0.06em]"
          onBack={selectedFilter === 'All' ? onBack : () => setSelectedFilter('All')}
        />
      </div>

      {selectedFilter === 'All' && !loading && (
        <div className="px-4 sm:px-6 mb-6 space-y-3">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {visibleMuscleFilters.map((filter) => {
              const label = getMuscleLabel(filter);
              return (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className="rounded-2xl border border-white/10 bg-card p-3 text-center transition-all hover:border-accent/30 hover:bg-white/[0.03] overflow-hidden"
                >
                  <div className="-mx-3 -mt-1 overflow-hidden">
                    <img
                      src={getBodyPartImage(filter)}
                      alt={label}
                      className="h-28 w-full object-cover sm:h-32"
                    />
                  </div>
                  <div className="-mx-3 mt-1 border-t border-white/10" />
                  <div className="mt-3">
                    <div className="text-sm font-bold text-text-primary">{label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading && selectedFilter === 'All' && (
        <div className="px-4 sm:px-6 mb-6">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {bodyPartSkeletons.map((key) => (
              <div
                key={key}
                className="rounded-2xl border border-white/10 bg-card p-3 animate-pulse overflow-hidden"
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
        <div className="px-4 sm:px-6 grid grid-cols-2 gap-4">
          {exerciseSkeletons.map((key) => (
            <div
              key={key}
              className="surface-card rounded-2xl border border-white/10 overflow-hidden animate-pulse"
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
        <div className="px-4 sm:px-6 text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && selectedFilter !== 'All' && (
        <>
          <div className="px-4 sm:px-6 grid grid-cols-2 gap-4">
            {filteredExercises.map((exercise) => {
              const likeKey = `${exercise.muscle}:${exercise.videoAssetName}`;
              const likeData = likes[likeKey] || { count: 0, liked: false };
              const videoUrl = exercise.videoUrl;

              return (
                <Card
                  key={`${exercise.id}-${exercise.videoAssetName}`}
                  onClick={() => onExerciseClick({ name: exercise.name, muscle: exercise.muscle, video: videoUrl })}
                  className="cursor-pointer overflow-hidden !p-0 transition-colors group hover:border-accent/20"
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-white/5">
                    <video
                      src={videoUrl}
                      className="h-full w-full object-cover"
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
            <div className="px-4 sm:px-6 mt-6">
              <div className="surface-card rounded-2xl border border-white/10 p-5 text-center text-sm text-text-secondary">
                {copy.empty}
              </div>
            </div>
          )}
        </>
      )}
    </div>);

}

