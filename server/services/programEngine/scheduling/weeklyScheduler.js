const TRAINING_DAY_PLACEMENTS = Object.freeze({
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
});

export const getTrainingDayPlacements = (daysPerWeek) =>
  [...(TRAINING_DAY_PLACEMENTS[daysPerWeek] ?? [])];

export const buildWeekTemplate = ({
  daysPerWeek,
  sessionSequence,
  targetDurationMinutes,
  buildSlots,
}) => {
  const trainingDays = getTrainingDayPlacements(daysPerWeek);
  const sessionByDay = new Map();

  trainingDays.forEach((dayOfWeek, index) => {
    const session = sessionSequence[index % sessionSequence.length];
    sessionByDay.set(dayOfWeek, {
      dayOfWeek,
      type: 'training',
      sessionType: session.sessionType,
      dayPurpose: session.dayPurpose,
      targetDurationMinutes,
      slots: buildSlots(session.sessionType, index),
    });
  });

  return Array.from({ length: 7 }, (_, index) => {
    const dayOfWeek = index + 1;
    return sessionByDay.get(dayOfWeek) ?? {
      dayOfWeek,
      type: 'rest',
    };
  });
};
