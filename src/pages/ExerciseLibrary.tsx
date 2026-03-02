import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Play, Heart, Search } from 'lucide-react';
import { api } from '../services/api';
interface ExerciseLibraryProps {
  onBack: () => void;
  onExerciseClick: (exercise: {name: string, muscle: string, video: string}) => void;
}
interface CatalogExercise {
  id: number;
  name: string;
  muscle: string;
  bodyPart?: string | null;
}
export function ExerciseLibrary({
  onBack,
  onExerciseClick
}: ExerciseLibraryProps) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<string[]>(['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs']);
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likes, setLikes] = useState<{[key: string]: {count: number, liked: boolean}}>({});

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
    setLikes(prev => {
      const current = prev[exerciseName] || {count: 0, liked: false};
      return {
        ...prev,
        [exerciseName]: {
          count: current.liked ? current.count - 1 : current.count + 1,
          liked: !current.liked
        }
      };
    });
  };

  const filteredExercises = useMemo(
    () => {
      const byFilter = selectedFilter === 'All'
        ? exercises
        : exercises.filter((ex) => ex.muscle === selectedFilter);

      const q = searchQuery.trim().toLowerCase();
      if (!q) return byFilter;
      return byFilter.filter((ex) => ex.name.toLowerCase().includes(q));
    },
    [exercises, selectedFilter, searchQuery],
  );

  const getCount = (filter: string) => {
    if (filter === 'All') return exercises.length;
    const count = exercises.filter(ex => ex.muscle === filter).length;
    return count > 99 ? '99+' : count;
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Exercise Library" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercise name..."
            className="w-full bg-card border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
          />
        </div>
      </div>

      <div className="px-4 sm:px-6 mb-6 flex gap-2 overflow-x-auto pb-2">
        {filters.map(
          (filter) =>
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`
              px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap
              ${selectedFilter === filter ? 'bg-accent text-black' : 'bg-card border border-white/10 text-text-secondary'}
            `}>

              {filter} ({getCount(filter)})
            </button>

        )}
      </div>

      {loading && (
        <div className="px-4 sm:px-6 text-text-secondary text-sm">Loading exercises...</div>
      )}

      {!loading && error && (
        <div className="px-4 sm:px-6 text-red-400 text-sm">{error}</div>
      )}

      <div className="px-4 sm:px-6 grid grid-cols-2 gap-4">
        {!loading && !error && filteredExercises.map((ex, i) => {
          const likeData = likes[ex.name] || {count: 0, liked: false};
          const totalLikes = Math.max(0, likeData.count);
          return (
          <Card
            key={i}
            onClick={() => onExerciseClick({ name: ex.name, muscle: ex.muscle, video: '/Squat.mp4' })}
            className="p-3 cursor-pointer hover:border-accent/20 transition-colors group">

            <div className="aspect-video bg-white/5 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
              <video src="/Squat.mp4" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white group-hover:bg-accent group-hover:text-black transition-colors">
                  <Play size={12} fill="currentColor" />
                </div>
              </div>
            </div>
            <div className="font-bold text-white text-sm truncate">
              {ex.name}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                {ex.muscle}
              </div>
              <button
                onClick={(e) => toggleLike(ex.name, e)}
                className="flex items-center gap-1">
                <Heart
                  size={14}
                  className={likeData.liked ? 'text-red-500 fill-red-500' : 'text-text-secondary'}
                />
                <span className="text-[10px] text-text-secondary">{totalLikes}</span>
              </button>
            </div>
          </Card>
        )})}
      </div>
    </div>);

}

