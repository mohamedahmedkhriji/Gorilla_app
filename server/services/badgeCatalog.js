/* eslint-env node */

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const pickRarity = (targetValue, hidden = false) => {
  if (hidden) return targetValue >= 3 ? 'legendary' : 'epic';
  const n = Number(targetValue || 0);
  if (n >= 500 || n === 365 || n >= 1000000) return 'legendary';
  if (n >= 100 || n >= 200000) return 'epic';
  if (n >= 10 || n >= 5000) return 'rare';
  return 'common';
};

const pickXpReward = (targetValue, hidden = false) => {
  if (hidden) return 100;
  const rarity = pickRarity(targetValue, false);
  if (rarity === 'legendary') return 120;
  if (rarity === 'epic') return 80;
  if (rarity === 'rare') return 45;
  return 25;
};

const createBadge = ({
  category,
  name,
  description,
  conditionType,
  targetValue = 1,
  operatorSymbol = '>=',
  timeframeType = 'lifetime',
  timeframeDays = null,
  isHidden = false,
  rarity = null,
  xpReward = null,
  pointsReward = 0,
}) => ({
  category,
  name,
  slug: slugify(name),
  description,
  rarity: rarity || pickRarity(targetValue, isHidden),
  isHidden,
  xpReward: xpReward == null ? pickXpReward(targetValue, isHidden) : xpReward,
  pointsReward,
  rules: [{
    conditionType,
    operatorSymbol,
    targetValue,
    timeframeType,
    timeframeDays,
  }],
});

const buildFromList = (category, list, defaults = {}) =>
  list.map((item) => createBadge({
    category,
    name: item.name,
    description: item.description,
    conditionType: item.conditionType,
    targetValue: item.targetValue,
    operatorSymbol: item.operatorSymbol || defaults.operatorSymbol || '>=',
    timeframeType: item.timeframeType || defaults.timeframeType || 'lifetime',
    timeframeDays: item.timeframeDays == null ? (defaults.timeframeDays ?? null) : item.timeframeDays,
    isHidden: !!defaults.isHidden,
    rarity: item.rarity || defaults.rarity || null,
    xpReward: item.xpReward == null ? defaults.xpReward : item.xpReward,
    pointsReward: item.pointsReward == null ? (defaults.pointsReward || 0) : item.pointsReward,
  }));

const workoutCompletionBadges = buildFromList('workout_completion', [
  { name: 'Session One', description: 'Complete 1 workout.', conditionType: 'workouts_completed', targetValue: 1 },
  { name: 'Getting Started', description: 'Complete 2 workouts.', conditionType: 'workouts_completed', targetValue: 2 },
  { name: 'New Routine', description: 'Complete 4 workouts.', conditionType: 'workouts_completed', targetValue: 4 },
  { name: 'First Five', description: 'Complete 5 workouts.', conditionType: 'workouts_completed', targetValue: 5 },
  { name: 'Active Member', description: 'Complete 8 workouts.', conditionType: 'workouts_completed', targetValue: 8 },
  { name: 'Double Digits', description: 'Complete 10 workouts.', conditionType: 'workouts_completed', targetValue: 10 },
  { name: 'Quarter Century', description: 'Complete 25 workouts.', conditionType: 'workouts_completed', targetValue: 25 },
  { name: 'Fifty Strong', description: 'Complete 50 workouts.', conditionType: 'workouts_completed', targetValue: 50 },
  { name: 'Seventy-Five Strong', description: 'Complete 75 workouts.', conditionType: 'workouts_completed', targetValue: 75 },
  { name: 'Century Club', description: 'Complete 100 workouts.', conditionType: 'workouts_completed', targetValue: 100 },
  { name: '150 Club', description: 'Complete 150 workouts.', conditionType: 'workouts_completed', targetValue: 150 },
  { name: '200 Club', description: 'Complete 200 workouts.', conditionType: 'workouts_completed', targetValue: 200 },
  { name: '300 Club', description: 'Complete 300 workouts.', conditionType: 'workouts_completed', targetValue: 300 },
  { name: '400 Club', description: 'Complete 400 workouts.', conditionType: 'workouts_completed', targetValue: 400 },
  { name: '500 Club', description: 'Complete 500 workouts.', conditionType: 'workouts_completed', targetValue: 500 },
  { name: '750 Club', description: 'Complete 750 workouts.', conditionType: 'workouts_completed', targetValue: 750 },
  { name: '1000 Club', description: 'Complete 1,000 workouts.', conditionType: 'workouts_completed', targetValue: 1000 },
  { name: 'Never Settling', description: 'Complete 3 workouts in 3 days.', conditionType: 'workout_days_last_3', targetValue: 3, timeframeType: 'custom', timeframeDays: 3 },
  { name: 'Weekly Finisher', description: 'Complete all planned workouts in 1 week.', conditionType: 'planned_workout_completion_week', targetValue: 1, timeframeType: 'weekly' },
  { name: 'Monthly Finisher', description: 'Complete all planned workouts in 1 month.', conditionType: 'planned_workout_completion_month', targetValue: 1, timeframeType: 'monthly' },
]);

const streakBadges = buildFromList('streak', [
  { name: 'On Fire', description: 'Reach a 2-day streak.', conditionType: 'training_streak_days', targetValue: 2 },
  { name: 'Building Heat', description: 'Reach a 4-day streak.', conditionType: 'training_streak_days', targetValue: 4 },
  { name: 'Locked In', description: 'Reach a 5-day streak.', conditionType: 'training_streak_days', targetValue: 5 },
  { name: 'One Week Strong', description: 'Reach a 7-day streak.', conditionType: 'training_streak_days', targetValue: 7 },
  { name: '10-Day Streak', description: 'Reach a 10-day streak.', conditionType: 'training_streak_days', targetValue: 10 },
  { name: 'Two Week Grind', description: 'Reach a 14-day streak.', conditionType: 'training_streak_days', targetValue: 14 },
  { name: '21-Day Lock', description: 'Reach a 21-day streak.', conditionType: 'training_streak_days', targetValue: 21 },
  { name: '30-Day Discipline', description: 'Reach a 30-day streak.', conditionType: 'training_streak_days', targetValue: 30 },
  { name: '45-Day Focus', description: 'Reach a 45-day streak.', conditionType: 'training_streak_days', targetValue: 45 },
  { name: '60-Day Machine', description: 'Reach a 60-day streak.', conditionType: 'training_streak_days', targetValue: 60 },
  { name: '75-Day Focus', description: 'Reach a 75-day streak.', conditionType: 'training_streak_days', targetValue: 75 },
  { name: '90-Day Iron Mind', description: 'Reach a 90-day streak.', conditionType: 'training_streak_days', targetValue: 90 },
  { name: '120-Day Machine', description: 'Reach a 120-day streak.', conditionType: 'training_streak_days', targetValue: 120 },
  { name: '150-Day Discipline', description: 'Reach a 150-day streak.', conditionType: 'training_streak_days', targetValue: 150 },
  { name: '180-Day Beast', description: 'Reach a 180-day streak.', conditionType: 'training_streak_days', targetValue: 180 },
  { name: '210-Day Crusher', description: 'Reach a 210-day streak.', conditionType: 'training_streak_days', targetValue: 210 },
  { name: '240-Day Monster', description: 'Reach a 240-day streak.', conditionType: 'training_streak_days', targetValue: 240 },
  { name: '300-Day Legend Run', description: 'Reach a 300-day streak.', conditionType: 'training_streak_days', targetValue: 300 },
  { name: 'Full Year Warrior', description: 'Reach a 365-day streak.', conditionType: 'training_streak_days', targetValue: 365 },
  { name: 'Unbreakable', description: 'Never miss a scheduled session for 60 days.', conditionType: 'scheduled_sessions_no_miss_60d', targetValue: 1, timeframeType: 'custom', timeframeDays: 60 },
]);

const strengthPrBadges = buildFromList('strength_pr', [
  { name: 'First Bench PR', description: 'Beat previous bench PR once.', conditionType: 'bench_pr_count', targetValue: 1 },
  { name: 'Bench Climber', description: 'Beat bench PR 3 times.', conditionType: 'bench_pr_count', targetValue: 3 },
  { name: 'Bench Hunter', description: 'Beat bench PR 5 times.', conditionType: 'bench_pr_count', targetValue: 5 },
  { name: 'First Squat PR', description: 'Beat previous squat PR once.', conditionType: 'squat_pr_count', targetValue: 1 },
  { name: 'Squat Climber', description: 'Beat squat PR 3 times.', conditionType: 'squat_pr_count', targetValue: 3 },
  { name: 'Squat Hunter', description: 'Beat squat PR 5 times.', conditionType: 'squat_pr_count', targetValue: 5 },
  { name: 'First Deadlift PR', description: 'Beat previous deadlift PR once.', conditionType: 'deadlift_pr_count', targetValue: 1 },
  { name: 'Deadlift Climber', description: 'Beat deadlift PR 3 times.', conditionType: 'deadlift_pr_count', targetValue: 3 },
  { name: 'Deadlift Hunter', description: 'Beat deadlift PR 5 times.', conditionType: 'deadlift_pr_count', targetValue: 5 },
  { name: 'Triple Threat', description: 'Hit PR in bench, squat, and deadlift.', conditionType: 'triple_big_lift_prs', targetValue: 1 },
  { name: 'Press Progress', description: 'Hit overhead press PR.', conditionType: 'overhead_press_pr_count', targetValue: 1 },
  { name: 'Pull Progress', description: 'Hit weighted pull-up PR.', conditionType: 'weighted_pullup_pr_count', targetValue: 1 },
  { name: 'Leg Press Beast', description: 'Hit leg press PR.', conditionType: 'leg_press_pr_count', targetValue: 1 },
  { name: 'Dumbbell King', description: 'Hit dumbbell press PR.', conditionType: 'dumbbell_press_pr_count', targetValue: 1 },
  { name: 'Lower Body PR Day', description: 'Hit 2 leg PRs in one session.', conditionType: 'lower_body_prs_single_session', targetValue: 2 },
  { name: 'Upper Body PR Day', description: 'Hit 2 upper-body PRs in one session.', conditionType: 'upper_body_prs_single_session', targetValue: 2 },
  { name: 'PR Weekend', description: 'Hit any PR on a weekend.', conditionType: 'weekend_prs', targetValue: 1 },
  { name: 'PR Streak', description: 'Hit a PR in 3 consecutive weeks.', conditionType: 'pr_streak_weeks', targetValue: 3 },
  { name: 'Breakthrough Month', description: 'Hit 5 PRs in one month.', conditionType: 'prs_month', targetValue: 5 },
  { name: 'Record Chaser', description: 'Hit 20 total PRs lifetime.', conditionType: 'prs_lifetime', targetValue: 20 },
]);

const volumeBadges = buildFromList('volume', [
  { name: '5K Volume', description: 'Lift 5,000 kg in one session.', conditionType: 'session_volume_kg', targetValue: 5000 },
  { name: '10K Volume', description: 'Lift 10,000 kg in one session.', conditionType: 'session_volume_kg', targetValue: 10000 },
  { name: '15K Volume', description: 'Lift 15,000 kg in one session.', conditionType: 'session_volume_kg', targetValue: 15000 },
  { name: '20K Volume', description: 'Lift 20,000 kg in one session.', conditionType: 'session_volume_kg', targetValue: 20000 },
  { name: '30K Volume', description: 'Lift 30,000 kg in one session.', conditionType: 'session_volume_kg', targetValue: 30000 },
  { name: '40K Volume', description: 'Lift 40,000 kg in one session.', conditionType: 'session_volume_kg', targetValue: 40000 },
  { name: '50K Volume', description: 'Lift 50,000 kg in one session.', conditionType: 'session_volume_kg', targetValue: 50000 },
  { name: '75K Volume', description: 'Lift 75,000 kg in one session.', conditionType: 'session_volume_kg', targetValue: 75000 },
  { name: '100K Volume', description: 'Lift 100,000 kg in one week.', conditionType: 'week_volume_kg', targetValue: 100000 },
  { name: '150K Weekly Volume', description: 'Lift 150,000 kg in one week.', conditionType: 'week_volume_kg', targetValue: 150000 },
  { name: '250K Monthly Volume', description: 'Lift 250,000 kg in one month.', conditionType: 'month_volume_kg', targetValue: 250000 },
  { name: 'Heavy Day', description: 'Average working set above heavy threshold.', conditionType: 'heavy_day_avg_weight', targetValue: 1 },
  { name: 'Volume Chest', description: 'Complete 25 chest sets in one week.', conditionType: 'chest_sets_week', targetValue: 25 },
  { name: 'Volume Back', description: 'Complete 25 back sets in one week.', conditionType: 'back_sets_week', targetValue: 25 },
  { name: 'Volume Legs', description: 'Complete 25 leg sets in one week.', conditionType: 'leg_sets_week', targetValue: 25 },
  { name: 'Volume Shoulders', description: 'Complete 20 shoulder sets in one week.', conditionType: 'shoulder_sets_week', targetValue: 20 },
  { name: 'Volume Arms', description: 'Complete 20 biceps + triceps sets in one week.', conditionType: 'arms_sets_week', targetValue: 20 },
  { name: 'Marathon Lifter', description: 'Do 50 total sets in one session.', conditionType: 'session_sets_count', targetValue: 50 },
  { name: 'Giant Session', description: 'Do 75 total sets in one session.', conditionType: 'session_sets_count', targetValue: 75 },
  { name: 'Lifetime Tonnage', description: 'Lift 1,000,000 kg lifetime.', conditionType: 'lifetime_volume_kg', targetValue: 1000000 },
]);

const exerciseCountBadges = buildFromList('exercise_count', [
  { name: 'Push-Up Entry', description: '25 lifetime push-ups.', conditionType: 'pushup_reps_lifetime', targetValue: 25 },
  { name: 'Push-Up Base', description: '100 lifetime push-ups.', conditionType: 'pushup_reps_lifetime', targetValue: 100 },
  { name: 'Push-Up Wall', description: '500 lifetime push-ups.', conditionType: 'pushup_reps_lifetime', targetValue: 500 },
  { name: 'Push-Up Ocean', description: '1,000 lifetime push-ups.', conditionType: 'pushup_reps_lifetime', targetValue: 1000 },
  { name: 'Pull-Up Entry', description: '10 lifetime pull-ups.', conditionType: 'pullup_reps_lifetime', targetValue: 10 },
  { name: 'Pull-Up Base', description: '50 lifetime pull-ups.', conditionType: 'pullup_reps_lifetime', targetValue: 50 },
  { name: 'Pull-Up Wall', description: '100 lifetime pull-ups.', conditionType: 'pullup_reps_lifetime', targetValue: 100 },
  { name: 'Pull-Up Ocean', description: '500 lifetime pull-ups.', conditionType: 'pullup_reps_lifetime', targetValue: 500 },
  { name: 'Squat Entry', description: '100 bodyweight squats lifetime.', conditionType: 'bodyweight_squats_lifetime', targetValue: 100 },
  { name: 'Squat Base', description: '500 bodyweight squats lifetime.', conditionType: 'bodyweight_squats_lifetime', targetValue: 500 },
  { name: 'Squat Wall', description: '1,000 bodyweight squats lifetime.', conditionType: 'bodyweight_squats_lifetime', targetValue: 1000 },
  { name: 'Squat Ocean', description: '5,000 squats lifetime.', conditionType: 'bodyweight_squats_lifetime', targetValue: 5000 },
  { name: 'Dip Entry', description: '25 lifetime dips.', conditionType: 'dip_reps_lifetime', targetValue: 25 },
  { name: 'Dip Base', description: '100 lifetime dips.', conditionType: 'dip_reps_lifetime', targetValue: 100 },
  { name: 'Dip Wall', description: '250 lifetime dips.', conditionType: 'dip_reps_lifetime', targetValue: 250 },
  { name: 'Dip Ocean', description: '500 lifetime dips.', conditionType: 'dip_reps_lifetime', targetValue: 500 },
  { name: 'Core Entry', description: '100 ab reps lifetime.', conditionType: 'core_reps_lifetime', targetValue: 100 },
  { name: 'Core Base', description: '500 ab reps lifetime.', conditionType: 'core_reps_lifetime', targetValue: 500 },
  { name: 'Core Wall', description: '1,000 ab reps lifetime.', conditionType: 'core_reps_lifetime', targetValue: 1000 },
  { name: 'Core Ocean', description: '5,000 ab reps lifetime.', conditionType: 'core_reps_lifetime', targetValue: 5000 },
]);

const timeDurationBadges = buildFromList('time_duration', [
  { name: 'Quick Hit', description: 'Complete a 15-minute workout.', conditionType: 'workout_session_max_minutes', targetValue: 15 },
  { name: '20-Minute Focus', description: 'Complete a 20-minute workout.', conditionType: 'workout_session_max_minutes', targetValue: 20 },
  { name: 'Half Hour Work', description: 'Complete a 30-minute workout.', conditionType: 'workout_session_max_minutes', targetValue: 30 },
  { name: '45-Minute Flow', description: 'Complete a 45-minute workout.', conditionType: 'workout_session_max_minutes', targetValue: 45 },
  { name: 'Full Hour', description: 'Complete a 60-minute workout.', conditionType: 'workout_session_max_minutes', targetValue: 60 },
  { name: '75-Minute Work', description: 'Complete a 75-minute workout.', conditionType: 'workout_session_max_minutes', targetValue: 75 },
  { name: '90-Minute Beast', description: 'Complete a 90-minute workout.', conditionType: 'workout_session_max_minutes', targetValue: 90 },
  { name: '2-Hour Test', description: 'Complete a 120-minute workout.', conditionType: 'workout_session_max_minutes', targetValue: 120 },
  { name: 'Morning Mover', description: 'Train before 6 AM.', conditionType: 'workouts_before_6', targetValue: 1 },
  { name: 'Sunrise Athlete', description: 'Train before 7 AM.', conditionType: 'workouts_before_7', targetValue: 1 },
  { name: 'Lunch Break Lifter', description: 'Train between 12 PM and 2 PM.', conditionType: 'workouts_between_12_14', targetValue: 1 },
  { name: 'Evening Warrior', description: 'Train after 7 PM.', conditionType: 'workouts_after_19', targetValue: 1 },
  { name: 'Night Grinder', description: 'Train after 10 PM.', conditionType: 'workouts_after_22', targetValue: 1 },
  { name: 'Weekend Warrior', description: 'Train on Saturday and Sunday.', conditionType: 'weekend_dual_days', targetValue: 1 },
  { name: 'Double Shift', description: 'Do 2 workouts in one day.', conditionType: 'double_session_days', targetValue: 1 },
  { name: 'Triple Shift', description: 'Do 3 workouts in one day.', conditionType: 'triple_session_days', targetValue: 1 },
  { name: 'No Days Off Week', description: 'Train every day in one week.', conditionType: 'no_days_off_weeks', targetValue: 1 },
  { name: 'Four Weeks Active', description: 'Log at least one session weekly for 4 weeks.', conditionType: 'weeks_with_workout', targetValue: 4 },
  { name: 'Twelve Weeks Active', description: 'Log at least one session weekly for 12 weeks.', conditionType: 'weeks_with_workout', targetValue: 12 },
  { name: 'Year-Round Active', description: 'Log at least one session monthly for 12 months.', conditionType: 'months_with_workout', targetValue: 12 },
]);

const recoveryWellnessBadges = buildFromList('recovery_wellness', [
  { name: 'Recovery Aware', description: 'Check recovery status 3 times.', conditionType: 'recovery_logs_total', targetValue: 3 },
  { name: 'Recovery Student', description: 'Check readiness 10 times.', conditionType: 'recovery_logs_total', targetValue: 10 },
  { name: 'Smart Rest', description: 'Skip training when recovery is low.', conditionType: 'smart_rest_decisions', targetValue: 1 },
  { name: 'Comeback Smart', description: 'Return after rest with improved readiness.', conditionType: 'recovery_comeback_improved', targetValue: 1 },
  { name: 'Sleep Tracker Starter', description: 'Log sleep 3 days.', conditionType: 'sleep_logs_total', targetValue: 3 },
  { name: 'Sleep Tracker Builder', description: 'Log sleep 7 days.', conditionType: 'sleep_logs_total', targetValue: 7 },
  { name: 'Sleep Tracker Pro', description: 'Log sleep 30 days.', conditionType: 'sleep_logs_total', targetValue: 30 },
  { name: 'Hydration Starter', description: 'Log water intake 3 days.', conditionType: 'hydration_logs_total', targetValue: 3 },
  { name: 'Hydration Builder', description: 'Log water intake 7 days.', conditionType: 'hydration_logs_total', targetValue: 7 },
  { name: 'Hydration Pro', description: 'Log water intake 30 days.', conditionType: 'hydration_logs_total', targetValue: 30 },
  { name: 'Nutrition Starter', description: 'Log meals 3 days.', conditionType: 'nutrition_logs_total', targetValue: 3 },
  { name: 'Nutrition Builder', description: 'Log meals 7 days.', conditionType: 'nutrition_logs_total', targetValue: 7 },
  { name: 'Nutrition Pro', description: 'Log meals 30 days.', conditionType: 'nutrition_logs_total', targetValue: 30 },
  { name: 'Protein Target', description: 'Hit protein goal 3 days.', conditionType: 'protein_target_days', targetValue: 3 },
  { name: 'Protein Week', description: 'Hit protein goal 7 days.', conditionType: 'protein_target_days', targetValue: 7 },
  { name: 'Recovery Hero', description: 'Finish week with no muscle group overtrained.', conditionType: 'recovery_week_no_overtrained', targetValue: 1 },
  { name: 'Balanced Athlete', description: 'Maintain recovery target while training hard.', conditionType: 'balanced_athlete_weeks', targetValue: 1 },
  { name: 'Deload Disciple', description: 'Complete a planned deload week.', conditionType: 'deload_weeks_completed', targetValue: 1 },
  { name: 'Sleep and Train', description: 'Hit sleep target and workout same day 7 times.', conditionType: 'sleep_and_train_days', targetValue: 7 },
  { name: 'Wellness Master', description: 'Hit sleep, hydration and protein targets in same week.', conditionType: 'wellness_master_weeks', targetValue: 1 },
]);

const cardioConditioningBadges = buildFromList('cardio_conditioning', [
  { name: 'First Run', description: 'Complete first run.', conditionType: 'run_sessions', targetValue: 1 },
  { name: '1K Runner', description: 'Run 1 km in a session.', conditionType: 'run_distance_single_km', targetValue: 1 },
  { name: '3K Runner', description: 'Run 3 km in a session.', conditionType: 'run_distance_single_km', targetValue: 3 },
  { name: '5K Runner', description: 'Run 5 km in a session.', conditionType: 'run_distance_single_km', targetValue: 5 },
  { name: '10K Runner', description: 'Run 10 km in a session.', conditionType: 'run_distance_single_km', targetValue: 10 },
  { name: 'First Ride', description: 'Complete first cycling session.', conditionType: 'cycling_sessions', targetValue: 1 },
  { name: '10K Rider', description: 'Cycle 10 km in a session.', conditionType: 'cycling_distance_single_km', targetValue: 10 },
  { name: '25K Rider', description: 'Cycle 25 km in a session.', conditionType: 'cycling_distance_single_km', targetValue: 25 },
  { name: '50K Rider', description: 'Cycle 50 km in a session.', conditionType: 'cycling_distance_single_km', targetValue: 50 },
  { name: 'First Row', description: 'Complete first rowing session.', conditionType: 'rowing_sessions', targetValue: 1 },
  { name: '500m Rower', description: 'Row 500 m.', conditionType: 'row_distance_single_m', targetValue: 500 },
  { name: '1K Rower', description: 'Row 1,000 m.', conditionType: 'row_distance_single_m', targetValue: 1000 },
  { name: '2K Rower', description: 'Row 2,000 m.', conditionType: 'row_distance_single_m', targetValue: 2000 },
  { name: 'Conditioning Starter', description: 'Complete 5 cardio sessions.', conditionType: 'cardio_sessions_total', targetValue: 5 },
  { name: 'Conditioning Builder', description: 'Complete 20 cardio sessions.', conditionType: 'cardio_sessions_total', targetValue: 20 },
  { name: 'Conditioning Pro', description: 'Complete 50 cardio sessions.', conditionType: 'cardio_sessions_total', targetValue: 50 },
  { name: 'Burpee Fighter', description: 'Do 50 burpees in one session.', conditionType: 'burpees_single_session', targetValue: 50 },
  { name: 'Rope Master', description: 'Do 500 jump rope reps in one session.', conditionType: 'jump_rope_single_session', targetValue: 500 },
  { name: 'Sled Worker', description: 'Complete sled push challenge.', conditionType: 'sled_push_challenges_completed', targetValue: 1 },
  { name: 'Engine Builder', description: 'Burn 2,500 cardio calories lifetime.', conditionType: 'cardio_calories_lifetime', targetValue: 2500 },
]);

const socialCommunityBadges = buildFromList('social_community', [
  { name: 'First Friend', description: 'Add first friend.', conditionType: 'friends_total', targetValue: 1 },
  { name: 'Social Start', description: 'Add 3 friends.', conditionType: 'friends_total', targetValue: 3 },
  { name: 'Crew Builder', description: 'Add 5 friends.', conditionType: 'friends_total', targetValue: 5 },
  { name: 'Squad Leader', description: 'Add 10 friends.', conditionType: 'friends_total', targetValue: 10 },
  { name: 'First Share', description: 'Share first workout.', conditionType: 'workout_shares_total', targetValue: 1 },
  { name: 'Content Starter', description: 'Share 5 workouts.', conditionType: 'workout_shares_total', targetValue: 5 },
  { name: 'Content Builder', description: 'Share 10 workouts.', conditionType: 'workout_shares_total', targetValue: 10 },
  { name: 'Challenge Creator', description: 'Create 1 challenge.', conditionType: 'challenges_created_total', targetValue: 1 },
  { name: 'Event Creator', description: 'Create 5 challenges.', conditionType: 'challenges_created_total', targetValue: 5 },
  { name: 'Rival Maker', description: 'Challenge a friend.', conditionType: 'friend_challenges_sent_total', targetValue: 1 },
  { name: 'Friendly Competition', description: 'Join 3 challenges.', conditionType: 'challenges_joined_total', targetValue: 3 },
  { name: 'Community Voice', description: 'Comment on a post.', conditionType: 'community_comments_total', targetValue: 1 },
  { name: 'Community Active', description: 'Leave 10 comments.', conditionType: 'community_comments_total', targetValue: 10 },
  { name: 'First Like', description: 'Receive 1 like.', conditionType: 'likes_received_total', targetValue: 1 },
  { name: 'Popular Lift', description: 'Receive 25 likes total.', conditionType: 'likes_received_total', targetValue: 25 },
  { name: 'Community Rising', description: 'Receive 100 likes total.', conditionType: 'likes_received_total', targetValue: 100 },
  { name: 'Referral One', description: 'Refer 1 user.', conditionType: 'referrals_total', targetValue: 1 },
  { name: 'Referral Three', description: 'Refer 3 users.', conditionType: 'referrals_total', targetValue: 3 },
  { name: 'Referral Ten', description: 'Refer 10 users.', conditionType: 'referrals_total', targetValue: 10 },
  { name: 'RepSet Connector', description: 'Interact with community 30 days.', conditionType: 'community_active_days', targetValue: 30 },
]);

const transformationGoalBadges = buildFromList('transformation_goal', [
  { name: 'Goal Setter', description: 'Set first goal.', conditionType: 'goals_created_total', targetValue: 1 },
  { name: 'Goal Chaser', description: 'Complete first goal.', conditionType: 'goals_completed_total', targetValue: 1 },
  { name: 'Goal Machine', description: 'Complete 3 goals.', conditionType: 'goals_completed_total', targetValue: 3 },
  { name: 'Goal Master', description: 'Complete 10 goals.', conditionType: 'goals_completed_total', targetValue: 10 },
  { name: 'Weight Gain 1', description: 'Gain 1 kg body weight.', conditionType: 'weight_gain_kg', targetValue: 1 },
  { name: 'Weight Gain 3', description: 'Gain 3 kg body weight.', conditionType: 'weight_gain_kg', targetValue: 3 },
  { name: 'Weight Loss 1', description: 'Lose 1 kg body weight.', conditionType: 'weight_loss_kg', targetValue: 1 },
  { name: 'Weight Loss 3', description: 'Lose 3 kg body weight.', conditionType: 'weight_loss_kg', targetValue: 3 },
  { name: 'Weight Loss 5', description: 'Lose 5 kg body weight.', conditionType: 'weight_loss_kg', targetValue: 5 },
  { name: 'Leaner', description: 'Reduce body fat by 1%.', conditionType: 'body_fat_drop_percent', targetValue: 1 },
  { name: 'Sharper', description: 'Reduce body fat by 3%.', conditionType: 'body_fat_drop_percent', targetValue: 3 },
  { name: 'Shredded', description: 'Reduce body fat by 5%.', conditionType: 'body_fat_drop_percent', targetValue: 5 },
  { name: 'Bulk Start', description: 'Gain body weight while increasing strength in 2 lifts.', conditionType: 'bulk_start_condition', targetValue: 1 },
  { name: 'Recomp Start', description: 'Lose fat while holding strength.', conditionType: 'recomp_start_condition', targetValue: 1 },
  { name: 'Photo Starter', description: 'Upload first progress photo.', conditionType: 'progress_photos_total', targetValue: 1 },
  { name: 'Photo Timeline', description: 'Upload 5 progress photos.', conditionType: 'progress_photos_total', targetValue: 5 },
  { name: '30-Day Change', description: 'Maintain plan for 30 days.', conditionType: 'plan_adherence_days', targetValue: 30 },
  { name: '60-Day Change', description: 'Maintain plan for 60 days.', conditionType: 'plan_adherence_days', targetValue: 60 },
  { name: '90-Day Change', description: 'Maintain plan for 90 days.', conditionType: 'plan_adherence_days', targetValue: 90 },
  { name: 'Total Transformation', description: 'Complete a full transformation program.', conditionType: 'transformation_program_completed', targetValue: 1 },
]);

const hiddenBadges = buildFromList('hidden', [
  { name: 'Midnight Iron', description: 'Complete workout after midnight.', conditionType: 'midnight_workouts', targetValue: 1 },
  { name: 'Dawn Patrol', description: 'Complete workout before 5 AM.', conditionType: 'workouts_before_5', targetValue: 1 },
  { name: 'Comeback Kid', description: 'Return after 14 days off.', conditionType: 'comeback_workouts', targetValue: 1 },
  { name: 'No Excuses', description: 'Complete workout in under 20 minutes.', conditionType: 'quick_workouts_under_20', targetValue: 1 },
  { name: 'Storm Mode', description: 'Train on a day you almost skipped.', conditionType: 'near_skip_days_trained', targetValue: 1 },
  { name: 'Last Set Hero', description: 'Complete final set when fatigue is high.', conditionType: 'hard_last_set_completions', targetValue: 1 },
  { name: 'Overtime', description: 'Exceed planned workout duration by 20%.', conditionType: 'workout_overtime_sessions', targetValue: 1 },
  { name: 'Perfect Form Day', description: 'Finish session with all sets logged clean form.', conditionType: 'clean_form_sessions', targetValue: 1 },
  { name: 'Silent Killer', description: 'Complete session with no social interaction.', conditionType: 'solo_sessions', targetValue: 1 },
  { name: 'Double Trouble', description: 'Hit 2 PRs in one day.', conditionType: 'double_pr_days', targetValue: 1 },
  { name: 'Triple Trouble', description: 'Hit 3 PRs in one day.', conditionType: 'triple_pr_days', targetValue: 1 },
  { name: 'The Closer', description: 'Finish session with hardest set.', conditionType: 'hardest_set_finish_sessions', targetValue: 1 },
  { name: 'Redemption', description: 'Beat a lift you previously failed.', conditionType: 'redeemed_failed_lifts', targetValue: 1 },
  { name: 'Never Again', description: 'Beat same failed set next session.', conditionType: 'failed_then_beat_next_session', targetValue: 1 },
  { name: 'Heat Check', description: 'Train 3 days in a row after a break.', conditionType: 'post_break_three_day_run', targetValue: 1 },
  { name: 'Sunday Discipline', description: 'Train on Sunday morning.', conditionType: 'sunday_morning_workouts', targetValue: 1 },
  { name: 'Holiday Beast', description: 'Train on a holiday.', conditionType: 'holiday_workouts', targetValue: 1 },
  { name: 'Rainy Day Warrior', description: 'Train during bad weather day.', conditionType: 'bad_weather_workouts', targetValue: 1 },
  { name: 'Ghost Session', description: 'Train without posting anything.', conditionType: 'ghost_sessions', targetValue: 1 },
  { name: 'Crowd Favorite', description: 'Get 20 likes on one workout share.', conditionType: 'workout_share_likes_single_post_20', targetValue: 1 },
  { name: 'Lone Wolf', description: 'Complete 10 solo sessions in a row.', conditionType: 'solo_session_streak_10', targetValue: 1 },
  { name: 'Marathon Week', description: 'Exceed weekly target by 2 sessions.', conditionType: 'weekly_target_plus_two', targetValue: 1 },
  { name: 'Micro Comeback', description: 'Workout within 6 hours after lazy log.', conditionType: 'workout_after_lazy_log_6h', targetValue: 1 },
  { name: 'Alpha Pairing', description: 'Finish push + pull supersets full session.', conditionType: 'full_push_pull_superset_sessions', targetValue: 1 },
  { name: 'Leg Day Survivor', description: 'Brutal leg day plus recovery next day.', conditionType: 'leg_day_plus_recovery_next_day', targetValue: 1 },
  { name: 'Unfinished Business', description: 'Return same day to finish missed exercise.', conditionType: 'same_day_return_finish', targetValue: 1 },
  { name: 'Zero Skip', description: 'Complete every exercise in plan for 30 days.', conditionType: 'zero_skip_days_30', targetValue: 1 },
  { name: 'Tempo Master', description: 'Complete 20 tempo-controlled reps in one session.', conditionType: 'tempo_reps_session_20', targetValue: 1 },
  { name: 'Controlled Chaos', description: 'High volume with no failed set.', conditionType: 'high_volume_no_fail_sessions', targetValue: 1 },
  { name: 'Laser Focus', description: 'No rest longer than plan target in session.', conditionType: 'on_plan_rest_sessions', targetValue: 1 },
  { name: 'Bonus Round', description: 'Add an extra finisher.', conditionType: 'finisher_added_sessions', targetValue: 1 },
  { name: 'PR From Nowhere', description: 'Hit PR after poor readiness.', conditionType: 'pr_after_low_readiness', targetValue: 1 },
  { name: 'Deload Genius', description: 'Better performance after deload.', conditionType: 'post_deload_performance_boost', targetValue: 1 },
  { name: 'Sneaky Strong', description: 'Increase load without noticing PR.', conditionType: 'unnoticed_prs', targetValue: 1 },
], { isHidden: true, rarity: 'epic', xpReward: 100 });

const hiddenBadgesPart2 = buildFromList('hidden', [
  { name: 'Respect the Rest', description: 'Skip ego lift due to recovery warning.', conditionType: 'ego_lift_skips_from_recovery', targetValue: 1 },
  { name: 'Technician', description: 'Same weight with better form.', conditionType: 'same_load_better_form_sessions', targetValue: 1 },
  { name: 'Deep Squat Society', description: 'Complete full-depth squat session.', conditionType: 'full_depth_squat_sessions', targetValue: 1 },
  { name: 'Full ROM Club', description: 'Full ROM on every rep in session.', conditionType: 'full_rom_sessions', targetValue: 1 },
  { name: 'Grip Monster', description: 'Hard pulling session without straps.', conditionType: 'hard_pull_no_straps_sessions', targetValue: 1 },
  { name: 'Core of Steel', description: 'Plank after every workout for 7 sessions.', conditionType: 'plank_after_workout_7', targetValue: 1 },
  { name: 'Consistency in Chaos', description: 'Keep streak during travel week.', conditionType: 'travel_week_streak', targetValue: 1 },
  { name: 'Backpack Gym', description: 'Complete workout with minimal equipment.', conditionType: 'minimal_equipment_workouts', targetValue: 1 },
  { name: 'Hotel Warrior', description: 'Complete travel workout.', conditionType: 'hotel_workouts', targetValue: 1 },
  { name: 'Quick Recovery', description: 'Train muscle again only when fully recovered.', conditionType: 'retrain_fully_recovered_only', targetValue: 1 },
  { name: 'Coachs Dream', description: 'Hit all targets for sets, reps, and tempo in one session.', conditionType: 'perfect_target_sessions', targetValue: 1 },
  { name: 'Unplanned Greatness', description: 'Complete workout not originally scheduled.', conditionType: 'unscheduled_workouts_completed', targetValue: 1 },
  { name: 'Finish Strong', description: 'Last exercise is strongest in session.', conditionType: 'strongest_last_exercise_sessions', targetValue: 1 },
  { name: 'Second Wind', description: 'Improve in second half of session.', conditionType: 'better_second_half_sessions', targetValue: 1 },
  { name: 'Mental Victory', description: 'Complete session after low motivation log.', conditionType: 'low_motivation_completed_sessions', targetValue: 1 },
  { name: 'Legend Is Born', description: 'Unlock 10 hidden badges.', conditionType: 'hidden_badges_unlocked', targetValue: 10 },
], { isHidden: true, rarity: 'epic', xpReward: 100 });

export const BADGE_CATEGORIES = [
  ['workout_completion', 'Workout completion milestones and consistency of execution.'],
  ['streak', 'Consecutive-day discipline and attendance momentum.'],
  ['strength_pr', 'Performance and PR progression badges.'],
  ['volume', 'Load, tonnage, and set-volume milestones.'],
  ['exercise_count', 'Exercise repetition and movement-count milestones.'],
  ['time_duration', 'Training-time and schedule timing consistency.'],
  ['recovery_wellness', 'Recovery, sleep, hydration, and readiness habits.'],
  ['cardio_conditioning', 'Cardio distance, sessions, and conditioning effort.'],
  ['social_community', 'Community engagement and social growth.'],
  ['transformation_goal', 'Goal completion and physical transformation milestones.'],
  ['hidden', 'Secret badges unlocked by rare behaviors.'],
];

export const BADGE_SEEDS = [
  ...workoutCompletionBadges,
  ...streakBadges,
  ...strengthPrBadges,
  ...volumeBadges,
  ...exerciseCountBadges,
  ...timeDurationBadges,
  ...recoveryWellnessBadges,
  ...cardioConditioningBadges,
  ...socialCommunityBadges,
  ...transformationGoalBadges,
  ...hiddenBadges,
  ...hiddenBadgesPart2,
];
