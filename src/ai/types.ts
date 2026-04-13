export interface AiPlanUserSummary {
  name: string | null;
  goal: string;
  fitnessLevel: string;
  mainProfileCategory: string;
  selectedSubCategory: string | null;
  daysPerWeek: number;
  sessionDurationMinutes: number;
}

export interface AiPlanExercise {
  name: string;
  targetMuscles: string[];
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string;
  tempo?: string | null;
  rpeTarget?: number | null;
}

export interface AiPlanWorkoutDay {
  dayName: string;
  sessionName: string;
  workoutName?: string;
  workoutType?: string;
  focus: string;
  estimatedDurationMinutes: number;
  notes: string;
  exercises: AiPlanExercise[];
}

export interface AiPlanPhase {
  phaseName: string;
  weekRange: {
    start: number;
    end: number;
  };
  objective: string;
  workouts: AiPlanWorkoutDay[];
}

export interface AiPlanWeeklySplit {
  weekRange: {
    start: number;
    end: number;
  };
  splitName: string;
  rationale: string;
  trainingDays: Array<{
    dayName: string;
    sessionName: string;
    focus: string;
    estimatedDurationMinutes: number;
  }>;
}

export interface AiPlanStrategyItem {
  weekRange: {
    start: number;
    end: number;
  } | null;
  title: string;
  details: string;
}

export interface AiTrainingPlan {
  schemaVersion: string;
  provider: string;
  durationWeeks: number;
  generatedAt: string;
  planName: string;
  summary: string;
  goalMatch: string;
  userSummary: AiPlanUserSummary;
  programOverview: string;
  coachingInterpretation: string;
  photoAnalysisSummary: string | null;
  weeklySplit: AiPlanWeeklySplit[];
  workoutsByPhase: AiPlanPhase[];
  progressionStrategy: AiPlanStrategyItem[];
  recoveryStrategy: AiPlanStrategyItem[];
  nutritionGuidance: string[];
  coachNotes: AiPlanStrategyItem[];
  finalCoachMessage: string;
  weeklySchedule: AiPlanWorkoutDay[];
  progressionRules: string[];
  recoveryRules: string[];
  checkpoints: Array<{
    week: number;
    target: string;
  }>;
  model?: string;
  usedImages?: number;
  attemptsUsed?: number;
  requestTimeoutMs?: number;
}

export interface AiPlanGenerationResponse {
  success: boolean;
  user?: Record<string, unknown> | null;
  assignedProgram?: Record<string, unknown> | null;
  assignment?: Record<string, unknown> | null;
  planSource?: string;
  claudePlan?: AiTrainingPlan | null;
  customAdvice?: Record<string, unknown> | null;
  warning?: string | null;
}

export interface AiPlanOnboardingPayload extends Record<string, unknown> {
  name?: string;
  gender?: string;
  age?: number;
  height?: number;
  weight?: number;
  motivation?: string;
  primaryGoal?: string;
  fitnessGoal?: string;
  experienceLevel?: string;
  athleteIdentity?: string;
  athleteIdentityCategory?: string;
  athleteSubCategoryId?: string;
  athleteSubCategoryLabel?: string;
  workoutDays?: number;
  sessionDuration?: number;
  preferredTime?: string;
  bodyType?: string;
  bodyImages?: string[];
  workoutSplitPreference?: string;
  workoutSplitLabel?: string;
  aiTrainingFocus?: string;
  aiRecoveryPriority?: string;
  aiLimitations?: string;
  aiEquipmentNotes?: string;
  useClaude?: boolean;
  disableClaude?: boolean;
}
