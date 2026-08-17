import assert from 'node:assert/strict';
import test from 'node:test';
import { renderNotificationTemplate } from './templates.js';
import { didRecoveryCrossThreshold, getSubscriptionReminderDays } from './rules.js';
import { NOTIFICATION_TYPES, TYPE_TO_CATEGORY } from './types.js';
import { NotificationService } from './notificationService.js';

test('all stable notification types have a category and English/French/Arabic templates', () => {
  Object.values(NOTIFICATION_TYPES).forEach((type) => {
    assert.ok(TYPE_TO_CATEGORY[type]);
    ['en', 'fr', 'ar'].forEach((locale) => {
      const rendered = renderNotificationTemplate(type, locale, {
        workoutName: 'Upper Body', muscles: 'Chest', senderName: 'Ahmed', streak: 6,
        challengeName: 'Bench Press', subscriptionType: 'gym', daysRemaining: 3,
        offerName: 'Summer sale', action: 'liked', bookName: 'Strength Basics',
      });
      assert.ok(rendered.title);
      assert.ok(rendered.body);
    });
  });
});

test('unknown locale falls back to English', () => {
  const rendered = renderNotificationTemplate(NOTIFICATION_TYPES.PLAN_UPDATED, 'de');
  assert.equal(rendered.locale, 'en');
  assert.equal(rendered.title, 'Plan updated');
});

test('recovery notification triggers only on a threshold crossing', () => {
  assert.equal(didRecoveryCrossThreshold(87, 92), true);
  assert.equal(didRecoveryCrossThreshold(92, 96), false);
  assert.equal(didRecoveryCrossThreshold(89, 89), false);
});

test('subscription reminder day calculation is stable', () => {
  const now = new Date('2026-08-17T10:00:00Z');
  assert.equal(getSubscriptionReminderDays('2026-08-20T10:00:00Z', now), 3);
  assert.equal(getSubscriptionReminderDays('invalid', now), null);
});

test('shop preference suppresses both persistence and delivery', async () => {
  let queryCount = 0;
  const pool = {
    execute: async () => {
      queryCount += 1;
      return [[{
        id: 4,
        notification_locale: 'en',
        timezone: 'UTC',
        shop: 0,
      }]];
    },
  };
  const service = new NotificationService({ pool, io: null });
  const result = await service.sendNotification({
    userId: 4,
    type: NOTIFICATION_TYPES.SHOP_DISCOUNT,
    variables: { offerName: 'Sale' },
  });
  assert.equal(result.reason, 'preference_disabled');
  assert.equal(queryCount, 1);
});

test('notification idempotency converts duplicate-key errors into a duplicate result', async () => {
  let queryCount = 0;
  const pool = {
    execute: async () => {
      queryCount += 1;
      if (queryCount === 1) {
        return [[{ id: 7, notification_locale: 'en', timezone: 'UTC', training: 1 }]];
      }
      const error = new Error('duplicate');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    },
  };
  const service = new NotificationService({ pool, io: null });
  const result = await service.sendNotification({
    userId: 7,
    type: NOTIFICATION_TYPES.WORKOUT_REMINDER,
    variables: { workoutName: 'Workout' },
    notificationKey: 'WORKOUT_REMINDER:7:2026-08-17',
  });
  assert.equal(result.reason, 'duplicate');
});
