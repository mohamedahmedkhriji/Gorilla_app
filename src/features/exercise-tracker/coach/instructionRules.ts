import { COACH_THRESHOLDS } from './coachThresholds';
import type { CoachCandidate, CoachContext, ExerciseType } from './types';

const getLatestRep = (context: CoachContext) => context.session.repHistory.at(-1);

const getRecentCleanRepStreak = (context: CoachContext) => {
  let streak = 0;

  for (let index = context.session.repHistory.length - 1; index >= 0; index -= 1) {
    const record = context.session.repHistory[index];

    if (!record.valid || (record.quality !== 'perfect' && record.quality !== 'good')) {
      break;
    }

    streak += 1;
  }

  return streak;
};

const buildWarningCandidates = (context: CoachContext): CoachCandidate[] => {
  const thresholds = COACH_THRESHOLDS[context.exercise];

  if (context.movement.confidence < thresholds.minimumConfidenceForWarning) {
    return [{
      tier: 'warning',
      message: context.movement.repInProgress ? 'Hold still' : 'Adjust position',
      code: context.movement.repInProgress ? 'warning_hold_still' : 'warning_adjust_position',
      interruptible: true,
      confidence: 0.95,
      expiresInMs: thresholds.warningPersistenceMs,
    }];
  }

  if (context.movement.stablePhase === 'idle') {
    return [{
      tier: 'warning',
      message: 'Center your body',
      code: 'warning_center_body',
      interruptible: true,
      confidence: 0.8,
      expiresInMs: thresholds.warningPersistenceMs,
    }];
  }

  return [];
};

const buildSetupCandidates = (context: CoachContext): CoachCandidate[] => {
  const thresholds = COACH_THRESHOLDS[context.exercise];

  if (context.movement.confidence < thresholds.minimumConfidenceForCorrection) {
    return [];
  }

  if (
    context.movement.stablePhase !== 'setup'
    && !(context.movement.stablePhase === 'ready' && !context.movement.validSetup)
  ) {
    return [];
  }

  if (context.exercise === 'lateralRaise') {
    const lateral = thresholds.lateralRaise;

    if (!lateral) {
      return [];
    }

    if (context.movement.debug.primarySignal > lateral.setupPrimaryMax) {
      return [{
        tier: 'setup',
        message: 'Arms at your sides',
        code: 'setup_lateral_raise_arms_down',
        interruptible: true,
        confidence: 0.82,
        expiresInMs: thresholds.setupPersistenceMs,
      }];
    }

    return [{
      tier: 'setup',
      message: 'Stand tall',
      code: 'setup_lateral_raise_stand_tall',
      interruptible: true,
      confidence: 0.72,
      expiresInMs: thresholds.setupPersistenceMs,
    }];
  }

  const press = thresholds.shoulderPress;

  if (!press) {
    return [];
  }

  if (context.movement.debug.primarySignal > press.setupPrimaryMax) {
    return [{
      tier: 'setup',
      message: 'Start at shoulder level',
      code: 'setup_shoulder_press_start_level',
      interruptible: true,
      confidence: 0.82,
      expiresInMs: thresholds.setupPersistenceMs,
    }];
  }

  return [{
    tier: 'setup',
    message: 'Brace your torso',
    code: 'setup_shoulder_press_brace',
    interruptible: true,
    confidence: 0.72,
    expiresInMs: thresholds.setupPersistenceMs,
  }];
};

const buildErrorCandidates = (context: CoachContext): CoachCandidate[] => {
  const thresholds = COACH_THRESHOLDS[context.exercise];

  if (
    context.session.sessionPhase !== 'setActive'
    || !context.movement.repInProgress
    || context.movement.confidence < thresholds.minimumConfidenceForCorrection
  ) {
    return [];
  }

  const candidates: CoachCandidate[] = [];
  const fatigue = context.session.fatigue;

  if (context.exercise === 'lateralRaise') {
    const lateral = thresholds.lateralRaise;

    if (!lateral) {
      return [];
    }

    if (
      (context.movement.stablePhase === 'peak' || context.movement.stablePhase === 'eccentric')
      && context.movement.debug.primarySignal < lateral.lowPeakPrimary
    ) {
      candidates.push({
        tier: 'error',
        message: 'Raise higher',
        code: 'error_lateral_raise_height',
        interruptible: true,
        confidence: 0.9,
        expiresInMs: thresholds.errorPersistenceMs,
      });
    }

    if (Math.abs(context.movement.debug.velocitySignal) > lateral.highVelocitySignal) {
      candidates.push({
        tier: 'error',
        message: 'Control the weights',
        code: 'error_lateral_raise_control',
        interruptible: true,
        confidence: 0.78,
        expiresInMs: thresholds.errorPersistenceMs,
      });
    }

    if (fatigue.detected && fatigue.trend === 'stabilityDrop') {
      candidates.push({
        tier: 'error',
        message: 'Keep torso stable',
        code: 'error_lateral_raise_stability',
        interruptible: true,
        confidence: fatigue.confidence,
        expiresInMs: thresholds.errorPersistenceMs,
      });
    }

    if (fatigue.detected && fatigue.trend === 'symmetryDrop') {
      candidates.push({
        tier: 'error',
        message: 'Keep both arms even',
        code: 'error_lateral_raise_symmetry',
        interruptible: true,
        confidence: fatigue.confidence,
        expiresInMs: thresholds.errorPersistenceMs,
      });
    }
  } else {
    const press = thresholds.shoulderPress;

    if (!press) {
      return [];
    }

    if (
      (context.movement.stablePhase === 'peak' || context.movement.stablePhase === 'eccentric')
      && context.movement.debug.primarySignal < press.lowPeakPrimary
    ) {
      candidates.push({
        tier: 'error',
        message: 'Press higher',
        code: 'error_shoulder_press_height',
        interruptible: true,
        confidence: 0.9,
        expiresInMs: thresholds.errorPersistenceMs,
      });
    }

    if (Math.abs(context.movement.debug.velocitySignal) > press.highVelocitySignal) {
      candidates.push({
        tier: 'error',
        message: 'Control the movement',
        code: 'error_shoulder_press_control',
        interruptible: true,
        confidence: 0.78,
        expiresInMs: thresholds.errorPersistenceMs,
      });
    }

    if (fatigue.detected && fatigue.trend === 'stabilityDrop') {
      candidates.push({
        tier: 'error',
        message: 'Keep torso upright',
        code: 'error_shoulder_press_stability',
        interruptible: true,
        confidence: fatigue.confidence,
        expiresInMs: thresholds.errorPersistenceMs,
      });
    }

    if (fatigue.detected && fatigue.trend === 'symmetryDrop') {
      candidates.push({
        tier: 'error',
        message: 'Keep both sides even',
        code: 'error_shoulder_press_symmetry',
        interruptible: true,
        confidence: fatigue.confidence,
        expiresInMs: thresholds.errorPersistenceMs,
      });
    }
  }

  return candidates;
};

const buildCueCandidates = (context: CoachContext): CoachCandidate[] => {
  const thresholds = COACH_THRESHOLDS[context.exercise];

  if (
    context.session.sessionPhase !== 'setActive'
    || !context.movement.repInProgress
    || context.movement.confidence < thresholds.minimumConfidenceForCorrection
  ) {
    return [];
  }

  if (context.exercise === 'lateralRaise') {
    const lateral = thresholds.lateralRaise;

    if (!lateral) {
      return [];
    }

    if (
      context.movement.stablePhase === 'concentric'
      && context.movement.debug.primarySignal >= lateral.cueApproachPeakPrimary
    ) {
      return [{
        tier: 'cue',
        message: 'Hold',
        code: 'cue_lateral_raise_hold',
        interruptible: true,
        confidence: 0.82,
        expiresInMs: thresholds.cuePersistenceMs,
      }];
    }

    if (context.movement.stablePhase === 'concentric') {
      return [{
        tier: 'cue',
        message: 'Lift',
        code: 'cue_lateral_raise_lift',
        interruptible: true,
        confidence: 0.72,
        expiresInMs: thresholds.cuePersistenceMs,
      }];
    }

    if (context.movement.stablePhase === 'peak') {
      return [{
        tier: 'cue',
        message: 'Hold',
        code: 'cue_lateral_raise_hold',
        interruptible: true,
        confidence: 0.84,
        expiresInMs: thresholds.cuePersistenceMs,
      }];
    }

    if (context.movement.stablePhase === 'eccentric') {
      return [{
        tier: 'cue',
        message: 'Lower slowly',
        code: 'cue_lateral_raise_lower',
        interruptible: true,
        confidence: 0.8,
        expiresInMs: thresholds.cuePersistenceMs,
      }];
    }

    return [];
  }

  const press = thresholds.shoulderPress;

  if (!press) {
    return [];
  }

  if (
    context.movement.stablePhase === 'concentric'
    && context.movement.debug.primarySignal >= press.cueApproachPeakPrimary
  ) {
    return [{
      tier: 'cue',
      message: 'Hold overhead',
      code: 'cue_shoulder_press_hold',
      interruptible: true,
      confidence: 0.82,
      expiresInMs: thresholds.cuePersistenceMs,
    }];
  }

  if (context.movement.stablePhase === 'concentric') {
    return [{
      tier: 'cue',
      message: 'Press up',
      code: 'cue_shoulder_press_press',
      interruptible: true,
      confidence: 0.72,
      expiresInMs: thresholds.cuePersistenceMs,
    }];
  }

  if (context.movement.stablePhase === 'peak') {
    return [{
      tier: 'cue',
      message: 'Hold overhead',
      code: 'cue_shoulder_press_hold',
      interruptible: true,
      confidence: 0.84,
      expiresInMs: thresholds.cuePersistenceMs,
    }];
  }

  if (context.movement.stablePhase === 'eccentric') {
    return [{
      tier: 'cue',
      message: 'Lower with control',
      code: 'cue_shoulder_press_lower',
      interruptible: true,
      confidence: 0.8,
      expiresInMs: thresholds.cuePersistenceMs,
    }];
  }

  return [];
};

const buildAffirmationCandidates = (context: CoachContext): CoachCandidate[] => {
  const thresholds = COACH_THRESHOLDS[context.exercise];
  const candidates: CoachCandidate[] = [];
  const latestRep = getLatestRep(context);

  if (
    context.session.repJustLogged
    && latestRep
    && latestRep.valid
    && latestRep.score.overall >= thresholds.affirmationRepOverallMin
  ) {
    candidates.push({
      tier: 'affirmation',
      message: latestRep.score.control >= 90 ? 'Nice control' : 'Good rep',
      code: latestRep.score.control >= 90 ? 'affirmation_nice_control' : 'affirmation_good_rep',
      interruptible: false,
      confidence: 0.9,
      expiresInMs: thresholds.affirmationPersistenceMs,
    });
  }

  if (
    getRecentCleanRepStreak(context) >= thresholds.cleanRepStreakForAffirmation
    && context.session.repJustLogged
  ) {
    candidates.push({
      tier: 'affirmation',
      message: 'Strong rep',
      code: 'affirmation_strong_rep',
      interruptible: false,
      confidence: 0.82,
      expiresInMs: thresholds.affirmationPersistenceMs,
    });
  }

  if (
    context.session.setJustCompleted
    && context.session.currentSetScore
    && context.session.currentSetScore.average.overall >= thresholds.affirmationSetOverallMin
  ) {
    candidates.push({
      tier: 'affirmation',
      message: 'Good set',
      code: 'affirmation_good_set',
      interruptible: false,
      confidence: 0.88,
      expiresInMs: thresholds.affirmationPersistenceMs,
    });
  }

  return candidates;
};

export const buildCoachCandidates = (
  exercise: ExerciseType,
  movement: CoachContext['movement'],
  session: CoachContext['session'],
  timestamp: number,
) => {
  const context: CoachContext = {
    exercise,
    movement,
    session,
    timestamp,
  };

  return [
    ...buildWarningCandidates(context),
    ...buildSetupCandidates(context),
    ...buildErrorCandidates(context),
    ...buildCueCandidates(context),
    ...buildAffirmationCandidates(context),
  ];
};
