interface AntiCheatInput {
  romScore: number;
  symmetryScore: number;
  stabilityScore: number;
  controlScore: number;
  topReached: boolean;
  oneSideDominant: boolean;
  repDurationMs: number;
  minimumRepDurationMs: number;
  minimumRomScore: number;
}

export interface AntiCheatResult {
  validRep: boolean;
  reason: string | null;
}

export const antiCheatCheck = ({
  romScore,
  symmetryScore,
  stabilityScore,
  controlScore,
  topReached,
  oneSideDominant,
  repDurationMs,
  minimumRepDurationMs,
  minimumRomScore,
}: AntiCheatInput): AntiCheatResult => {
  if (!topReached) {
    return {
      validRep: false,
      reason: 'Complete the full movement',
    };
  }

  if (romScore < minimumRomScore) {
    return {
      validRep: false,
      reason: 'Increase your range',
    };
  }

  if (repDurationMs < minimumRepDurationMs || controlScore < 55) {
    return {
      validRep: false,
      reason: 'Control the weights',
    };
  }

  if (oneSideDominant || symmetryScore < 58) {
    return {
      validRep: false,
      reason: 'Keep both sides even',
    };
  }

  if (stabilityScore < 58) {
    return {
      validRep: false,
      reason: 'Keep your torso stable',
    };
  }

  return {
    validRep: true,
    reason: null,
  };
};

