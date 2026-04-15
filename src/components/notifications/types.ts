import type { LucideIcon } from 'lucide-react';

export interface AcceptedChallengePayload {
  friendId: number;
  friendName: string;
  challengeKey: string;
  challengeTitle: string;
  challengeSessionId: number;
}

export interface NotificationsScreenProps {
  onBack: () => void;
  onOpenAcceptedChallenge?: (challenge: AcceptedChallengePayload) => void;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
  data?: unknown;
  unread?: boolean;
}

export interface NotificationData extends Record<string, unknown> {
  friendshipId?: unknown;
  requestType?: unknown;
  responseStatus?: unknown;
  challengeTitle?: unknown;
  challengeKey?: unknown;
  senderUserId?: unknown;
  senderName?: unknown;
  sessionId?: unknown;
  receiverNotificationId?: unknown;
  points?: unknown;
  streak?: unknown;
}

export type NotificationType =
  | 'message'
  | 'coach_message'
  | 'coach_session_note'
  | 'friend_request'
  | 'friend_accept'
  | 'plan_review_request'
  | 'plan_coach_request_sent'
  | 'plan_created_by_coach'
  | 'plan_review_approved'
  | 'plan_review_rejected'
  | 'friend_challenge_invite'
  | 'friend_challenge_response'
  | 'mission_completed'
  | 'workout_reminder'
  | 'recovery_alert'
  | 'leaderboard_update'
  | 'challenge_invite'
  | 'system';

export type NotificationActionStatus = 'accepted' | 'declined' | 'cancelled';
export type NotificationActionId = 'accept' | 'decline' | 'open';
export type NotificationBadgeTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export interface NotificationVisual {
  icon: LucideIcon;
  iconClassName: string;
  backgroundClassName: string;
}

export interface NotificationCardAction {
  id: NotificationActionId;
  label: string;
  tone?: Exclude<NotificationBadgeTone, 'success'>;
  disabled?: boolean;
}

export interface NotificationMetaChip {
  label: string;
  tone?: Exclude<NotificationBadgeTone, 'danger'>;
}

export interface NotificationStatusBadge {
  label: string;
  tone?: NotificationBadgeTone;
}

export interface NotificationCardModel {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  timeLabel: string;
  unread: boolean;
  visual: NotificationVisual;
  metadata?: NotificationMetaChip[];
  note?: string;
  statusLabel?: NotificationStatusBadge;
  actions?: NotificationCardAction[];
}
