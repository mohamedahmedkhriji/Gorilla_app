import React from 'react';
import { motion } from 'framer-motion';
import type { NotificationActionId, NotificationCardModel } from './types';

interface NotificationCardProps {
  notification: NotificationCardModel;
  isRtl?: boolean;
  onOpen?: (notificationId: number) => void;
  onAction?: (notificationId: number, actionId: NotificationActionId) => void;
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
}: NotificationCardProps) {
  const isInteractive = typeof onOpen === 'function';
  const { visual } = notification;
  const Icon = visual.icon;

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
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : -1}
      onKeyDown={handleKeyDown}
      onClick={isInteractive ? () => onOpen?.(notification.id) : undefined}
      className={cx(
        'group relative overflow-hidden rounded-[1.6rem] border bg-card/75 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all duration-200 sm:p-5',
        notification.unread
          ? 'border-accent/25 hover:border-accent/35 hover:bg-card'
          : 'border-white/10 hover:border-white/15 hover:bg-card/90',
        isInteractive && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
      )}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        className={cx(
          'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_48%)] opacity-70 transition-opacity duration-200',
          notification.unread && 'group-hover:opacity-100',
        )}
        aria-hidden="true"
      />

      <div className={cx('relative z-10 flex items-start gap-3 sm:gap-4', isRtl && 'flex-row-reverse')}>
        <div className="relative shrink-0">
          <div
            className={cx(
              'flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 sm:h-12 sm:w-12',
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
            <div className="min-w-0 space-y-1 text-right">
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
