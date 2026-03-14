USE gorella_fitness;

ALTER TABLE notifications
MODIFY COLUMN type ENUM(
  'workout_reminder',
  'friend_request',
  'friend_accept',
  'message',
  'mission_complete',
  'program_updated',
  'coach_message',
  'system',
  'account_ban',
  'plan_review_request',
  'plan_coach_request',
  'plan_coach_request_sent',
  'plan_created_by_coach',
  'plan_review_approved',
  'plan_review_rejected',
  'blog_like',
  'blog_comment'
) NOT NULL DEFAULT 'system';
