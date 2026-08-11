import React from 'react';
import { motion } from 'framer-motion';
import type { NotificationActionId, NotificationCardModel } from './types';

interface NotificationCardProps {
  notification: NotificationCardModel;
  isRtl?: boolean;
  onOpen?: (notificationId: number) => void;
  onAction?: (notificationId: number, actionId: NotificationActionId) => void;
  onDismiss?: (notificationId: number) => void;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const toneClassName: Record<NonNullable<NotificationCardModel['statusLabel']>['tone'], string> = {
  accent: 'border-accent/20 bg-accent/10 text-accent',
  success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
  danger: 'border-rose-400/20 bg-rose-500/10 text-rose-200',
  neutral: 'border-white/10 bg-white/5 text-text-secondary',
};

const chipToneClassName = {
  accent: 'border-accent/20 bg-accent/10 text-accent',
  success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
  neutral: 'border-white/10 bg-white/5 text-text-secondary',
};

const actionToneClassName = {
  primary: 'border-accent/30 bg-accent text-black hover:bg-[#aee600] focus-visible:ring-accent/40',
  secondary: 'border-white/10 bg-white/5 text-text-primary hover:bg-white/10 focus-visible:ring-white/20',
  danger: 'border-rose-500/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15 focus-visible:ring-rose-500/30',
  neutral: 'border-white/10 bg-white/5 text-text-primary hover:bg-white/10 focus-visible:ring-white/20',
};

export function NotificationCard({
  notification,
  isRtl = false,
  onOpen,
  onAction,
  onDismiss,
}: NotificationCardProps) {
  const isInteractive = typeof onOpen === 'function';
  const { visual } = notification;
  const Icon = visual.icon;
  const gradientId = `notification-grad-${notification.id}`;

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = (event) => {
    if (!isInteractive) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen?.(notification.id);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: -120, right: 0 }}
      dragElastic={{ left: 0.18, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -88 || info.velocity.x < -650) {
          onDismiss?.(notification.id);
        }
      }}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : -1}
      onKeyDown={handleKeyDown}
      onClick={isInteractive ? () => onOpen?.(notification.id) : undefined}
      className={cx(
        'group relative overflow-hidden rounded-[1.6rem] p-0 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all duration-300 active:scale-[0.985] sm:rounded-[1.8rem]',
        notification.unread
          ? 'hover:-translate-y-1'
          : 'opacity-90 hover:-translate-y-1 hover:opacity-100',
        isInteractive && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
      )}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 380 104"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
        </defs>
        <path
          d="M 0,28 C 0,0 0,0 30,0 L 350,0 C 380,0 380,0 380,28 L 380,76 C 380,104 380,104 350,104 L 30,104 C 0,104 0,104 0,76 Z"
          fill={`url(#${gradientId})`}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          className="transition-all duration-300 group-hover:[stroke:rgba(255,255,255,0.25)]"
        />
      </svg>

      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))]"
        aria-hidden="true"
      />

      <div className={cx('relative z-10 flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5', isRtl && 'flex-row-reverse')}>
        <div className="relative shrink-0">
          <div
            className={cx(
              'flex h-10 w-10 items-center justify-center rounded-[1.1rem] border border-white/15 bg-white/[0.08] shadow-inner backdrop-blur-md sm:h-11 sm:w-11',
              visual.backgroundClassName,
            )}
          >
            <Icon size={19} className={visual.iconClassName} />
          </div>
          {notification.unread && (
            <span
              className={cx(
                'absolute top-0 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-background',
                isRtl ? 'left-0' : 'right-0',
              )}
              aria-label="Unread notification"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className={cx('flex items-start justify-between gap-3', isRtl && 'flex-row-reverse')}>
            <div className={cx('min-w-0 space-y-1', isRtl ? 'text-right' : 'text-left')}>
              <h3 className="break-words text-sm font-semibold leading-6 text-white [overflow-wrap:anywhere] sm:text-[0.95rem]">
                {notification.title}
              </h3>
              {notification.metadata?.length ? (
                <div className={cx('flex flex-wrap gap-2', isRtl && 'justify-end')}>
                  {notification.metadata.map((item) => (
                    <span
                      key={`${notification.id}-${item.label}`}
                      className={cx(
                        'rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]',
                        chipToneClassName[item.tone || 'neutral'],
                      )}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={cx('shrink-0 pt-0.5 text-[11px] text-text-tertiary', isRtl ? 'text-left' : 'text-right')}>
              {notification.timeLabel}
            </div>
          </div>

          <p className="mt-2 break-words text-sm leading-6 text-text-secondary [overflow-wrap:anywhere]">
            {notification.message}
          </p>

          {notification.note ? (
            <p className="mt-2 text-[11px] leading-5 text-text-tertiary">
              {notification.note}
            </p>
          ) : null}

          {notification.statusLabel ? (
            <div className={cx('mt-3 flex', isRtl ? 'justify-end' : 'justify-start')}>
              <span
                className={cx(
                  'rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]',
                  toneClassName[notification.statusLabel.tone || 'neutral'],
                )}
              >
                {notification.statusLabel.label}
              </span>
            </div>
          ) : null}

          {notification.actions?.length ? (
            <div className={cx('mt-4 flex gap-2', isRtl && 'flex-row-reverse')}>
              {notification.actions.map((action) => (
                <button
                  key={`${notification.id}-${action.id}`}
                  type="button"
                  disabled={action.disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction?.(notification.id, action.id);
                  }}
                  className={cx(
                    'inline-flex min-h-10 items-center justify-center rounded-2xl border px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
                    actionToneClassName[action.tone || 'secondary'],
                    action.id === 'accept' ? 'flex-1' : 'min-w-[6.75rem]',
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}
