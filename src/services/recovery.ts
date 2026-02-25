export interface WorkoutSession {
  muscleGroup: string;
  timestamp: Date;
  intensity: 'low' | 'moderate' | 'high';
  volume: 'low' | 'moderate' | 'high';
  eccentricFocus: boolean;
}

export interface RecoveryFactors {
  sleepHours: number;
  nutritionQuality: 'optimal' | 'suboptimal';
  age: number;
  stressLevel: 'low' | 'moderate' | 'high';
}

export interface MuscleRecovery {
  muscleGroup: string;
  recoveryPercentage: number;
  hoursNeeded: number;
  hoursElapsed: number;
  lastWorked: Date;
}

interface SubMuscleRecovery {
  name: string;
  recoveryPercentage: number;
  hoursNeeded: number;
  hoursElapsed: number;
}

const BASE_RECOVERY_TIMES: Record<string, number> = {
  Chest: 48,
  Back: 48,
  Legs: 72,
  Quads: 72,
  Quadriceps: 72,
  Hamstrings: 72,
  Glutes: 72,
  Shoulders: 48,
  Lats: 48,
  Traps: 48,
  Biceps: 36,
  Triceps: 36,
  Forearms: 24,
  Calves: 36,
  Abs: 24,
  Core: 24,
};

const MUSCLE_GROUPS = {
  Back: { subMuscles: ['Lats', 'Upper Back', 'Lower Back', 'Traps'] },
  Chest: { subMuscles: ['Upper Chest', 'Mid Chest', 'Lower Chest'] },
  Quadriceps: { subMuscles: ['Rectus Femoris', 'Vastus Lateralis', 'Vastus Medialis'] },
  Hamstrings: { subMuscles: ['Biceps Femoris', 'Semitendinosus', 'Semimembranosus'] },
  Calves: { subMuscles: ['Gastrocnemius', 'Soleus'] },
  Shoulders: { subMuscles: ['Front Delts', 'Side Delts', 'Rear Delts'] },
  Biceps: { subMuscles: ['Long Head', 'Short Head'] },
  Triceps: { subMuscles: ['Long Head', 'Lateral Head', 'Medial Head'] },
  Forearms: { subMuscles: ['Flexors', 'Extensors'] },
  Abs: { subMuscles: ['Upper Abs', 'Lower Abs', 'Obliques'] },
} as const;

const INTENSITY_FACTORS = {
  low: 0.7,
  moderate: 1.0,
  high: 1.3,
} as const;

const VOLUME_FACTORS = {
  low: 0.8,
  moderate: 1.0,
  high: 1.2,
} as const;

const ECCENTRIC_FACTOR = 1.15;

const NUTRITION_FACTORS = {
  optimal: 0.9,
  suboptimal: 1.1,
} as const;

const STRESS_FACTORS = {
  low: 0.95,
  moderate: 1.0,
  high: 1.15,
} as const;

function getAgeFactor(age: number): number {
  if (age < 25) return 0.9;
  if (age < 35) return 1.0;
  if (age < 45) return 1.1;
  return 1.2;
}

function getSleepFactor(hours: number): number {
  if (hours >= 8) return 0.9;
  if (hours >= 7) return 1.0;
  if (hours >= 6) return 1.1;
  return 1.2;
}

function normalizeMuscleGroup(muscleGroup: string): string {
  const m = muscleGroup.trim().toLowerCase();
  if (m === 'legs') return 'Legs';
  if (m === 'quads') return 'Quads';
  if (m === 'core') return 'Core';
  if (!m) return 'Chest';
  return muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1).toLowerCase();
}

export class RecoveryCalculator {
  calculateRecoveryTime(session: WorkoutSession, factors: RecoveryFactors): number {
    const normalizedMuscle = normalizeMuscleGroup(session.muscleGroup);
    const baseTime = BASE_RECOVERY_TIMES[normalizedMuscle] ?? 48;

    let totalTime = baseTime;
    totalTime *= INTENSITY_FACTORS[session.intensity] ?? 1;
    totalTime *= VOLUME_FACTORS[session.volume] ?? 1;

    if (session.eccentricFocus) {
      totalTime *= ECCENTRIC_FACTOR;
    }

    totalTime *= getAgeFactor(factors.age);
    totalTime *= getSleepFactor(factors.sleepHours);
    totalTime *= NUTRITION_FACTORS[factors.nutritionQuality] ?? 1;
    totalTime *= STRESS_FACTORS[factors.stressLevel] ?? 1;

    return Number(Math.max(12, totalTime).toFixed(2));
  }

  calculateRecoveryPercentage(session: WorkoutSession, factors: RecoveryFactors): MuscleRecovery {
    const hoursNeeded = this.calculateRecoveryTime(session, factors);
    const hoursElapsed = Math.max(0, (Date.now() - session.timestamp.getTime()) / (1000 * 60 * 60));
    const recoveryPercentage = Math.min(100, (hoursElapsed / hoursNeeded) * 100);

    return {
      muscleGroup: normalizeMuscleGroup(session.muscleGroup),
      recoveryPercentage: Math.round(recoveryPercentage),
      hoursNeeded,
      hoursElapsed: Number(hoursElapsed.toFixed(2)),
      lastWorked: session.timestamp,
    };
  }

  getOverallRecovery(sessions: WorkoutSession[], factors: RecoveryFactors): number {
    if (sessions.length === 0) return 100;

    const recoveries = sessions.map((session) =>
      this.calculateRecoveryPercentage(session, factors).recoveryPercentage,
    );

    return Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length);
  }

  getAllMuscleRecoveries(sessions: WorkoutSession[], factors: RecoveryFactors): MuscleRecovery[] {
    const latestSessions = new Map<string, WorkoutSession>();

    sessions.forEach((session) => {
      const key = normalizeMuscleGroup(session.muscleGroup);
      const existing = latestSessions.get(key);
      if (!existing || session.timestamp > existing.timestamp) {
        latestSessions.set(key, session);
      }
    });

    return Array.from(latestSessions.values()).map((session) => this.calculateRecoveryPercentage(session, factors));
  }

  getSubMuscleRecoveries(muscleGroup: string, session: WorkoutSession, factors: RecoveryFactors): SubMuscleRecovery[] {
    const normalizedMuscle = normalizeMuscleGroup(muscleGroup) as keyof typeof MUSCLE_GROUPS;
    const muscleInfo = MUSCLE_GROUPS[normalizedMuscle];
    if (!muscleInfo) return [];

    const mainRecovery = this.calculateRecoveryPercentage(session, factors);

    return muscleInfo.subMuscles.map((subMuscle) => ({
      name: subMuscle,
      recoveryPercentage: mainRecovery.recoveryPercentage,
      hoursNeeded: mainRecovery.hoursNeeded,
      hoursElapsed: mainRecovery.hoursElapsed,
    }));
  }
}

export const recoveryCalculator = new RecoveryCalculator();
