import React, { useRef, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Play, Pause, AlertTriangle, Info } from 'lucide-react';
interface ExerciseVideoScreenProps {
  onBack: () => void;
  exercise?: {
    name: string;
    muscle: string;
    targetMuscles: string;
    importance: string;
    anatomy: string;
  };
}
export function ExerciseVideoScreen({ onBack, exercise }: ExerciseVideoScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
      <div className="px-6 pt-2">
        <Header title="Technique Guide" onBack={onBack} />
      </div>

      {/* Video Player */}
      <div className="w-full aspect-video bg-card relative mb-6">
        <video
          ref={videoRef}
          controls
          className="w-full h-full object-cover"
          src={exercise?.video || '/Squat.mp4'}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}>
        </video>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {!isPlaying && (
            <div onClick={togglePlay} className="w-16 h-16 rounded-full bg-accent/90 flex items-center justify-center text-black shadow-glow cursor-pointer pointer-events-auto">
              <Play size={24} fill="currentColor" className="ml-1" />
            </div>
          )}
        </div>
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
          <h2 className="text-xl font-bold text-white drop-shadow-md">
            {exercise?.name || 'Barbell Bench Press'}
          </h2>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase border border-white/10">
              {exercise?.muscle || 'Chest'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-24 space-y-6">
        {/* Target Muscles */}
        <Card>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
            Target Muscles
          </h3>
          <p className="text-text-secondary text-sm">
            {exercise?.targetMuscles || 'Pectoralis Major, Anterior Deltoids, Triceps Brachii'}
          </p>
        </Card>

        {/* Importance */}
        <Card>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
            Importance
          </h3>
          <p className="text-text-secondary text-sm">
            {exercise?.importance || 'Essential compound movement for building upper body strength and mass.'}
          </p>
        </Card>

        {/* Anatomy Info */}
        <Card>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
            Anatomy
          </h3>
          <p className="text-text-secondary text-sm">
            {exercise?.anatomy || 'Engages chest muscles through horizontal adduction, shoulders stabilize, triceps extend the elbow.'}
          </p>
        </Card>
      </div>
    </div>);

}