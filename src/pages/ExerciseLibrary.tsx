import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Heart, Play } from 'lucide-react';
import { api } from '../services/api';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { resolveExerciseVideoUrl } from '../services/exerciseVideos';

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
}
export function ExerciseLibrary({
  onBack,
  onExerciseClick,
  initialFilter = 'All',
  onFilterChange,
}: ExerciseLibraryProps) {
  const [selectedFilter, setSelectedFilter] = useState(initialFilter || 'All');
  const [filters, setFilters] = useState<string[]>(['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs']);
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likes, setLikes] = useState<{[key: string]: {count: number, liked: boolean}}>({});

  useEffect(() => {
    setSelectedFilter(initialFilter || 'All');
  }, [initialFilter]);

  useEffect(() => {
    onFilterChange?.(selectedFilter);
  }, [onFilterChange, selectedFilter]);

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
        setError('Failed to load exercises');
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

  const muscleFilters = useMemo(
    () => filters.filter((filter) => filter !== 'All'),
    [filters],
  );

  const exercisesWithVideo = useMemo(
    () =>
      exercises.filter((exercise) =>
        Boolean(
          resolveExerciseVideoUrl({
            name: exercise.name,
            muscle: exercise.muscle,
            bodyPart: exercise.bodyPart,
          }),
        ),
      ),
    [exercises],
  );

  const visibleMuscleFilters = useMemo(
    () => muscleFilters.filter((filter) => exercisesWithVideo.some((exercise) => exercise.muscle === filter)),
    [exercisesWithVideo, muscleFilters],
  );

  const filteredExercises = useMemo(() => {
    if (selectedFilter === 'All') return [];
    return exercisesWithVideo.filter((exercise) => exercise.muscle === selectedFilter);
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
          title={selectedFilter === 'All' ? 'Exercise Library' : `${selectedFilter} Exercises`}
          onBack={selectedFilter === 'All' ? onBack : () => setSelectedFilter('All')}
        />
      </div>

      {selectedFilter === 'All' && (
        <div className="px-4 sm:px-6 mb-6 space-y-3">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {visibleMuscleFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className="rounded-2xl border border-white/10 bg-card p-3 text-center transition-all hover:border-accent/30 hover:bg-white/[0.03]"
              >
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                  <img
                    src={getBodyPartImage(filter)}
                    alt={filter}
                    className="h-24 w-full object-cover sm:h-28"
                  />
                </div>
                <div className="mt-3">
                  <div className="text-sm font-bold text-text-primary">
                    {filter}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-secondary">
                    {getCount(filter)} exercises
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="px-4 sm:px-6 text-text-secondary text-sm">Loading exercises...</div>
      )}

      {!loading && error && (
        <div className="px-4 sm:px-6 text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && selectedFilter !== 'All' && (
        <>
          <div className="px-4 sm:px-6 grid grid-cols-2 gap-4">
            {filteredExercises.map((exercise) => {
              const likeData = likes[exercise.name] || { count: 0, liked: false };
              const videoUrl =
                resolveExerciseVideoUrl({
                  name: exercise.name,
                  muscle: exercise.muscle,
                  bodyPart: exercise.bodyPart,
                }) || null;

              return (
                <Card
                  key={exercise.id}
                  onClick={() => onExerciseClick({ name: exercise.name, muscle: exercise.muscle, video: videoUrl })}
                  className="cursor-pointer p-3 transition-colors group hover:border-accent/20"
                >
                  <div className="relative mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-white/5">
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
                  <div className="truncate text-sm font-bold text-white">
                    {exercise.name}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider text-text-secondary">
                      {exercise.muscle}
                    </div>
                    <button
                      onClick={(e) => toggleLike(exercise.name, e)}
                      className="flex items-center gap-1"
                    >
                      <Heart
                        size={14}
                        className={likeData.liked ? 'fill-red-500 text-red-500' : 'text-text-secondary'}
                      />
                      <span className="text-[10px] text-text-secondary">{Math.max(0, likeData.count)}</span>
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>);

}

