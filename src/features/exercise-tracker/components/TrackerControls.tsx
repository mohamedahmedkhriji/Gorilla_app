import React, { memo } from 'react';
import { Pause, Play, RotateCcw, StopCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { SetStatus } from '../types/tracking';

interface TrackerControlsProps {
  status: SetStatus;
  canStart: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onFinish: () => void;
}

export const TrackerControls = memo(function TrackerControls({
  status,
  canStart,
  onStart,
  onPause,
  onResume,
  onReset,
  onFinish,
}: TrackerControlsProps) {
  const primaryAction = status === 'active'
    ? {
      label: 'Pause',
      icon: Pause,
      action: onPause,
      variant: 'secondary' as const,
      disabled: false,
    }
    : status === 'paused'
      ? {
        label: 'Start',
        icon: Play,
        action: onResume,
        variant: 'primary' as const,
        disabled: false,
      }
      : {
        label: 'Start',
        icon: Play,
        action: onStart,
        variant: 'primary' as const,
        disabled: !canStart,
      };

  const PrimaryIcon = primaryAction.icon;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant={primaryAction.variant}
        onClick={primaryAction.action}
        disabled={primaryAction.disabled}
      >
        <PrimaryIcon size={18} />
        <span>{primaryAction.label}</span>
      </Button>

      <Button type="button" variant="ghost" onClick={onReset}>
        <RotateCcw size={18} />
        <span>Reset</span>
      </Button>

      <Button
        type="button"
        variant="secondary"
        onClick={onFinish}
        disabled={status === 'idle' || status === 'finished'}
        className="col-span-2"
      >
        <StopCircle size={18} />
        <span>Finish</span>
      </Button>
    </div>
  );
});

