import { createStaticCatalogProvider, generateBrainDrivenProgram } from '../services/programEngine/index.js';

const ex = (id, name, {
  slug = null,
  muscle = 'Chest',
  equipment = 'Barbell',
  mechanics = 'compound',
  forceType = 'push',
} = {}) => ({
  id,
  name,
  slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  equipment,
  difficultyLevel: 2,
  mechanics,
  forceType,
  muscle,
  bodyPart: muscle,
  categories: [{ name: muscle, slug: muscle.toLowerCase().replace(/\s+/g, '-') }],
  muscles: [{ name: muscle, muscleGroup: muscle, role: 'primary' }],
  primaryMedia: { mediaType: 'video', audience: 'unisex', url: `https://cdn.test/${id}.mp4` },
});

const catalogProvider = createStaticCatalogProvider([
  ex(1, 'Barbell Bench Press', { muscle: 'Chest', equipment: 'Barbell' }),
  ex(2, 'Incline Dumbbell Press', { muscle: 'Chest', equipment: 'Dumbbell' }),
  ex(3, 'Standing Dumbbell Shoulder Press', { muscle: 'Shoulders', equipment: 'Dumbbell' }),
  ex(4, 'Lat Pulldown', { muscle: 'Back', equipment: 'Cable', forceType: 'pull' }),
  ex(5, 'Seated Cable Row', { muscle: 'Back', equipment: 'Cable', forceType: 'pull' }),
  ex(6, 'Chest Supported Row', { muscle: 'Back', equipment: 'Machine', forceType: 'pull' }),
  ex(7, 'Reverse Pec Deck', { muscle: 'Shoulders', equipment: 'Machine', mechanics: 'isolation' }),
  ex(8, 'Dumbbell Lateral Raise', { muscle: 'Shoulders', equipment: 'Dumbbell', mechanics: 'isolation' }),
  ex(9, 'Barbell Back Squat', { muscle: 'Quadriceps', equipment: 'Barbell' }),
  ex(10, 'Conventional Deadlift', { muscle: 'Hamstrings', equipment: 'Barbell', forceType: 'pull' }),
  ex(11, 'Romanian Deadlift', { muscle: 'Hamstrings', equipment: 'Barbell', forceType: 'pull' }),
  ex(12, 'Dumbbell Romanian Deadlift', { muscle: 'Hamstrings', equipment: 'Dumbbell', forceType: 'pull' }),
  ex(13, 'Bulgarian Split Squat', { muscle: 'Glutes', equipment: 'Dumbbell' }),
  ex(14, 'Leg Extension', { muscle: 'Quadriceps', equipment: 'Machine', mechanics: 'isolation' }),
  ex(15, 'Lying Leg Curl', { muscle: 'Hamstrings', equipment: 'Machine', mechanics: 'isolation' }),
  ex(16, 'Standing Calf Raise', { muscle: 'Calves', equipment: 'Machine', mechanics: 'isolation' }),
  ex(17, 'Cable Crunch', { muscle: 'Abs', equipment: 'Cable', mechanics: 'isolation' }),
  ex(18, 'Dumbbell Curl', { muscle: 'Biceps', equipment: 'Dumbbell', mechanics: 'isolation', forceType: 'pull' }),
  ex(19, 'Triceps Pressdown', { muscle: 'Triceps', equipment: 'Cable', mechanics: 'isolation' }),
  ex(20, 'Cable Fly', { muscle: 'Chest', equipment: 'Cable', mechanics: 'isolation' }),
  ex(21, 'Goblet Squat', { muscle: 'Quadriceps', equipment: 'Dumbbell' }),
  ex(22, 'Dumbbell Bench Press', { muscle: 'Chest', equipment: 'Dumbbell' }),
  ex(23, 'Dumbbell Row', { muscle: 'Back', equipment: 'Dumbbell', forceType: 'pull' }),
  ex(24, 'Plank', { muscle: 'Abs', equipment: 'Bodyweight', mechanics: 'isolation' }),
]);

const result = await generateBrainDrivenProgram({
  gender: 'Man',
  age: 30,
  height: 180,
  weight: 82,
  athleteIdentity: 'Cardio',
  athleteSubCategoryId: 'fat_loss',
  experienceLevel: 'beginner',
  workoutDays: 6,
  sessionDuration: 45,
  aiTrainingFocus: 'Balanced',
  aiRecoveryPriority: 'Balanced',
  aiEquipmentNotes: 'Full gym',
}, {
  catalogProvider,
});

const workouts = result.generatedProgram.weeks
  .reduce((sum, week) => sum + week.days.filter((day) => day.type === 'training').length, 0);

console.log(JSON.stringify({
  goal: 'Fat Loss',
  availableDays: result.trainingStrategy.schedule.availableDaysPerWeek,
  prescribedDays: result.trainingStrategy.schedule.prescribedDaysPerWeek,
  architecture: result.trainingStrategy.architecture.splitStrategy,
  weeks: result.generatedProgram.weeks.length,
  workouts,
  exerciseSource: 'RepSet canonical catalog provider',
  referenceEvidence: {
    available: result.referenceEvidence.available,
    datasetVersion: result.referenceEvidence.datasetVersion,
    matchedCount: result.referenceEvidence.matchedCount,
    supportLevel: result.referenceEvidence.supportLevel,
  },
  validation: result.validation.valid ? 'PASS' : 'FAIL',
}, null, 2));

