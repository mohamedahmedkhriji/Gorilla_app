export const buildProgressionPolicy = (goal) => {
  const shared = {
    1: { phase: 'Introduction / baseline', stress: 'conservative' },
    2: { phase: 'Progress', stress: 'build' },
    3: { phase: 'Progress', stress: 'build' },
    4: { phase: 'Controlled overload', stress: 'overload' },
    5: { phase: 'Fatigue management', stress: 'reduced' },
    6: { phase: 'Build again', stress: 'build' },
    7: { phase: 'Progress', stress: 'build' },
    8: { phase: 'Strong final week / evaluation', stress: 'strong' },
  };

  const rule = goal === 'powerlifting'
    ? 'strength progression via lower reps and RIR/RPE targets; no invented percentages'
    : goal === 'cutting'
      ? 'performance retention with small improvements only when recovery permits'
      : goal === 'fat_loss'
        ? 'resistance maintenance plus gradual cardio workload within safe bounds'
        : goal === 'endurance'
          ? 'gradual aerobic workload progression with controlled hard sessions'
          : 'double progression within rep ranges before future load increases';

  return {
    goal,
    rule,
    weeks: Object.fromEntries(Object.entries(shared).map(([week, value]) => [
      week,
      { weekNumber: Number(week), ...value },
    ])),
  };
};
