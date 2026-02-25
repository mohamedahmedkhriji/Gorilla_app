import React, { useState } from 'react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Play, Heart } from 'lucide-react';
interface ExerciseLibraryProps {
  onBack: () => void;
  onExerciseClick: (exercise: {name: string, muscle: string, video: string}) => void;
}
export function ExerciseLibrary({
  onBack,
  onExerciseClick
}: ExerciseLibraryProps) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [likes, setLikes] = useState<{[key: string]: {count: number, liked: boolean}}>({});

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

  const exercises = [
    { name: 'Bench Press', muscle: 'Chest', video: '/vedio/Chest/Bench Press.mp4', likes: 245 },
    { name: 'Chest Fly', muscle: 'Chest', video: '/vedio/Chest/Chest Fly.mp4', likes: 189 },
    { name: 'Dumbbell Bench Press', muscle: 'Chest', video: '/vedio/Chest/Dumbbell Bench Press.mp4', likes: 312 },
    { name: 'Smith Machine', muscle: 'Chest', video: '/vedio/Chest/Smith Machine.mp4', likes: 156 },
    { name: '3 Grips. 3 Targets', muscle: 'Back', video: '/vedio/Back/3 Grips. 3 Targets.mp4', likes: 156 },
    { name: 'All Pull-Ups', muscle: 'Back', video: '/vedio/Back/All Pull-Ups.mp4', likes: 421 },
    { name: 'Barbell Row', muscle: 'Back', video: '/vedio/Back/Barbell Row.mp4', likes: 298 },
    { name: 'Cable Pullover', muscle: 'Back', video: '/vedio/Back/Cable Pullover.mp4', likes: 167 },
    { name: 'Cable Rows', muscle: 'Back', video: '/vedio/Back/Cable Rows.mp4', likes: 203 },
    { name: 'Chest Supported Rows', muscle: 'Back', video: '/vedio/Back/Chest Supported Rows.mp4', likes: 134 },
    { name: 'Doing Rows', muscle: 'Back', video: '/vedio/Back/Doing Rows.mp4', likes: 187 },
    { name: 'Landmine Row', muscle: 'Back', video: '/vedio/Back/Landmine Row.mp4', likes: 178 },
    { name: 'Pull-Up', muscle: 'Back', video: '/vedio/Back/Pull-Up.mp4', likes: 389 },
    { name: 'Right Back Muscles With Dumbbells', muscle: 'Back', video: '/vedio/Back/Right Back Muscles With Dumbbells.mp4', likes: 145 },
    { name: 'Rope Pulling', muscle: 'Back', video: '/vedio/Back/Rope Pulling.mp4', likes: 112 },
    { name: 'Arms', muscle: 'Arms', video: '/vedio/Arms/Arms.mp4', likes: 234 },
    { name: 'Biceps', muscle: 'Arms', video: '/vedio/Arms/Biceps.mp4', likes: 345 },
    { name: 'Bigger Biceps', muscle: 'Arms', video: '/vedio/Arms/Bigger Biceps.mp4', likes: 412 },
    { name: 'Curls', muscle: 'Arms', video: '/vedio/Arms/Curls.mp4', likes: 289 },
    { name: 'Different bicep curls', muscle: 'Arms', video: '/vedio/Arms/Different bicep curls.mp4', likes: 321 },
    { name: 'Forearms', muscle: 'Arms', video: '/vedio/Arms/Forearms.mp4', likes: 198 },
    { name: 'powerful biceps', muscle: 'Arms', video: '/vedio/Arms/powerful biceps.mp4', likes: 267 },
    { name: 'Triceps', muscle: 'Arms', video: '/vedio/Arms/Triceps.mp4', likes: 301 },
  ];

  const filteredExercises = selectedFilter === 'All' 
    ? exercises 
    : exercises.filter(ex => ex.muscle === selectedFilter);

  const getCount = (filter: string) => {
    if (filter === 'All') return exercises.length;
    const count = exercises.filter(ex => ex.muscle === filter).length;
    return count > 99 ? '99+' : count;
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title="Exercise Library" onBack={onBack} />
      </div>

      <div className="px-6 mb-6 flex gap-2 overflow-x-auto pb-2">
        {['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs'].map(
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

      <div className="px-6 grid grid-cols-2 gap-4">
        {filteredExercises.map((ex, i) => {
          const likeData = likes[ex.name] || {count: 0, liked: false};
          const totalLikes = ex.likes + likeData.count;
          return (
          <Card
            key={i}
            onClick={() => onExerciseClick(ex)}
            className="p-3 cursor-pointer hover:border-accent/20 transition-colors group">

            <div className="aspect-video bg-white/5 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
              <video src={ex.video} className="w-full h-full object-cover" />
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