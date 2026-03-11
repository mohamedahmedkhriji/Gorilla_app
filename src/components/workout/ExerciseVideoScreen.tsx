import React, { useRef, useState } from 'react';
import { Card } from '../ui/Card';
import { ArrowLeft, Play } from 'lucide-react';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { resolveExerciseVideoUrl } from '../../services/exerciseVideos';

interface ExerciseVideoScreenProps {
  onBack: () => void;
  exercise?: {
    name: string;
    muscle: string;
    video?: string | null;
    targetMuscles?: string;
    importance?: string;
    anatomy?: string;
  };
}

const BACK_LATS_IMAGE = '/assets/Workout/body%20part/back/Lates.png';
const BACK_UPPER_IMAGE = '/assets/Workout/body%20part/back/upper%20back.png';
const BACK_LOWER_IMAGE = '/assets/Workout/body%20part/back/lower%20back.png';

const getDisplayExerciseName = (name?: string) =>
  String(name || 'Barbell Bench Press')
    .trim()
    .replace(/^\d+(?:\.\d+)?\s+/, '')
    .trim();

const normalizeLookup = (value?: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const parseTargetMuscles = (value?: string) =>
  String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const MUSCLE_BAR_COLORS = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-emerald-500',
];

const BACK_MUSCLE_DISTRIBUTION = [
  { name: 'Upper Back', colorClass: MUSCLE_BAR_COLORS[0] },
  { name: 'Lats', colorClass: MUSCLE_BAR_COLORS[1] },
  { name: 'Lower Back', colorClass: MUSCLE_BAR_COLORS[2] },
];

const SEGMENT_COUNT = 10;

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const getActiveSegments = (percent: number) =>
  Math.round((clampPercent(percent) / 100) * SEGMENT_COUNT);

const getSegmentColor = (index: number, isActive: boolean) => {
  const ratio = SEGMENT_COUNT <= 1 ? 0 : index / (SEGMENT_COUNT - 1);
  if (isActive) {
    // Red -> Green progression across active segments
    const hue = ratio * 120;
    const saturation = 90;
    const lightness = 48;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }
  return 'hsl(210 14% 18%)';
};

const getMuscleDistribution = (muscles: string[]) => {
  if (muscles.length === 0) return [];

  if (muscles.length === 1) {
    return [{ name: muscles[0], percent: 100, colorClass: MUSCLE_BAR_COLORS[0] }];
  }

  if (muscles.length === 2) {
    return [
      { name: muscles[0], percent: 60, colorClass: MUSCLE_BAR_COLORS[0] },
      { name: muscles[1], percent: 40, colorClass: MUSCLE_BAR_COLORS[1] },
    ];
  }

  if (muscles.length === 3) {
    return [
      { name: muscles[0], percent: 50, colorClass: MUSCLE_BAR_COLORS[0] },
      { name: muscles[1], percent: 30, colorClass: MUSCLE_BAR_COLORS[1] },
      { name: muscles[2], percent: 20, colorClass: MUSCLE_BAR_COLORS[2] },
    ];
  }

  const preset = [40, 25, 20, 15];
  return muscles.slice(0, 4).map((name, index) => ({
    name,
    percent: preset[index],
    colorClass: MUSCLE_BAR_COLORS[index % MUSCLE_BAR_COLORS.length],
  }));
};

const getBackMuscleDistribution = (exerciseName?: string, videoUrl?: string) => {
  const lookup = normalizeLookup(`${exerciseName || ''} ${videoUrl || ''}`);
  let distribution = [40, 40, 20];

  if (
    lookup.includes('deadlift')
    || lookup.includes('hyperextension')
    || lookup.includes('good morning')
  ) {
    distribution = [30, 15, 55];
  } else if (lookup.includes('pullover')) {
    distribution = [20, 65, 15];
  } else if (lookup.includes('lower lats')) {
    distribution = [20, 50, 30];
  } else if (lookup.includes('upper lats')) {
    distribution = [45, 40, 15];
  } else if (
    lookup.includes('pull up')
    || lookup.includes('pullup')
    || lookup.includes('pull down')
    || lookup.includes('pulldown')
    || lookup.includes('lat pull')
  ) {
    distribution = [30, 55, 15];
  } else if (
    lookup.includes('bent over')
    || lookup.includes('barbell row')
    || lookup.includes('dumbbell row')
  ) {
    distribution = [40, 35, 25];
  } else if (
    lookup.includes('row')
    || lookup.includes('rope pulling')
    || lookup.includes('seated row')
  ) {
    distribution = [45, 40, 15];
  }

  return BACK_MUSCLE_DISTRIBUTION.map((muscle, index) => ({
    ...muscle,
    percent: distribution[index],
  }));
};

const resolveWorkoutMuscleImage = (muscleName?: string, muscleGroup?: string) => {
  const normalizedMuscle = normalizeLookup(muscleName);
  const normalizedGroup = normalizeLookup(muscleGroup);

  if (normalizedMuscle.includes('lat')) {
    return BACK_LATS_IMAGE;
  }

  if (normalizedMuscle.includes('lower back') || normalizedMuscle.includes('erector')) {
    return BACK_LOWER_IMAGE;
  }

  if (
    normalizedMuscle.includes('upper back')
    || normalizedMuscle.includes('middle back')
    || normalizedMuscle.includes('back')
    || normalizedMuscle.includes('trap')
    || normalizedMuscle.includes('rhomboid')
    || normalizedGroup.includes('back')
  ) {
    return BACK_UPPER_IMAGE;
  }

  return null;
};

export function ExerciseVideoScreen({ onBack, exercise }: ExerciseVideoScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const displayExerciseName = getDisplayExerciseName(exercise?.name);
  const targetMusclesText = exercise?.targetMuscles || exercise?.muscle || 'General';
  const targetMuscles = parseTargetMuscles(targetMusclesText);
  const resolvedVideoUrl = exercise?.video || resolveExerciseVideoUrl({
    name: exercise?.name,
    muscle: exercise?.muscle,
    bodyPart: exercise?.targetMuscles,
  });
  const isBackExercise = normalizeLookup(exercise?.muscle).includes('back')
    || normalizeLookup(resolvedVideoUrl).includes('body part back');
  const muscleDistribution = isBackExercise
    ? getBackMuscleDistribution(exercise?.name, resolvedVideoUrl)
    : getMuscleDistribution(targetMuscles);

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
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto px-4">
      {/* Video Player */}
      <div className="w-full aspect-video bg-card relative mb-6">
        {resolvedVideoUrl ? (
          <>
            <video
              ref={videoRef}
              controls
              className="w-full h-full object-cover"
              src={resolvedVideoUrl}
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
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 px-6 text-center text-sm font-semibold uppercase tracking-[0.12em] text-text-secondary">
            No linked video yet for this exercise
          </div>
        )}
        <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-md transition-colors hover:border-accent/40"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-xl leading-tight text-white drop-shadow-md">
            {displayExerciseName}
          </h1>
        </div>
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase border border-white/10">
              {exercise?.muscle || 'Chest'}
            </span>
          </div>
        </div>
      </div>

      <div className="pb-24 space-y-6">
          <Card translate="no">
            <h3 className="mb-4 font-medium text-white">Muscle Distribution (Plan Target)</h3>
            <div className="mb-5 grid grid-cols-3 gap-3">
              {muscleDistribution.map((muscle) => (
                <div
                  key={`${muscle.name}-image`}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <img
                    src={resolveWorkoutMuscleImage(muscle.name, exercise?.muscle) || getBodyPartImage(muscle.name)}
                    alt={muscle.name}
                    className="h-24 w-full object-cover"
                  />
                  <div className="border-t border-white/10 px-3 py-2 text-center text-[11px] font-medium text-text-secondary">
                    {muscle.name}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {muscleDistribution.map((muscle) => (
                <div key={muscle.name}>
                  <div className="mb-1 flex justify-between text-xs text-text-secondary">
                    <span>{muscle.name}</span>
                    <span className="font-electrolize">{muscle.percent}%</span>
                  </div>
                  <div className="mt-1 rounded-md border border-white/10 bg-white/[0.02] p-1">
                    <div className="flex h-2 items-center gap-1">
                      {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
                        const isActive = index < getActiveSegments(muscle.percent);
                        return (
                          <div
                            key={`${muscle.name}-segment-${index}`}
                            className="h-full flex-1 rounded-[2px] transition-colors duration-300"
                            style={{ backgroundColor: getSegmentColor(index, isActive) }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

      </div>
    </div>);

}
