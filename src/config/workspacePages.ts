export type WorkspaceRole = 'user' | 'coach' | 'admin';
export type WorkspaceSurface = 'mobile' | 'web';
export type WorkspaceStatus = 'ready' | 'partial' | 'planned';

export interface WorkspacePage {
  id: string;
  role: WorkspaceRole;
  surface: WorkspaceSurface;
  title: string;
  description: string;
  status: WorkspaceStatus;
  implementation?: string;
}

const workspacePagesByRole: Record<WorkspaceRole, WorkspacePage[]> = {
  user: [
    {
      id: 'onboarding',
      role: 'user',
      surface: 'mobile',
      title: 'Onboarding',
      description: 'Multi-step setup for profile, goals, gym access, and AI onboarding plan generation.',
      status: 'ready',
      implementation: 'Onboarding page and onboarding screen flow',
    },
    {
      id: 'home-dashboard',
      role: 'user',
      surface: 'mobile',
      title: 'Home Dashboard',
      description: 'Primary mobile dashboard with recovery, workout progress, coaches, and quick actions.',
      status: 'ready',
      implementation: 'Home page',
    },
    {
      id: 'workout-plan',
      role: 'user',
      surface: 'mobile',
      title: 'Workout Plan',
      description: 'Today plan view with exercise list, completion state, and daily program details.',
      status: 'ready',
      implementation: 'WorkoutPlanScreen',
    },
    {
      id: 'workout-session',
      role: 'user',
      surface: 'mobile',
      title: 'Workout Session',
      description: 'Set logging, rest tracking, and exercise video support during active workouts.',
      status: 'ready',
      implementation: 'TrackerScreen and LiveWorkoutScreen',
    },
    {
      id: 'workout-summary',
      role: 'user',
      surface: 'mobile',
      title: 'Workout Summary',
      description: 'Post-session summary and completion flow after live workout execution.',
      status: 'ready',
      implementation: 'PostWorkoutSummary',
    },
    {
      id: 'recovery',
      role: 'user',
      surface: 'mobile',
      title: 'Recovery',
      description: 'Recovery breakdown with muscle status, readiness, and progress-linked feedback.',
      status: 'ready',
      implementation: 'MuscleRecoveryScreen',
    },
    {
      id: 'missions-rank',
      role: 'user',
      surface: 'mobile',
      title: 'Missions & Rank',
      description: 'Gamification area for missions, points, rewards, and rank progression.',
      status: 'partial',
      implementation: 'RankingsRewardsScreen and missions service',
    },
    {
      id: 'profile',
      role: 'user',
      surface: 'mobile',
      title: 'Profile',
      description: 'Account hub for settings, gym access, posts, and current-week plan shortcuts.',
      status: 'ready',
      implementation: 'Profile page and profile screens',
    },
    {
      id: 'statistics',
      role: 'user',
      surface: 'mobile',
      title: 'Statistics',
      description: 'Progress analytics with reports, measurements, check-ins, and AI insights.',
      status: 'ready',
      implementation: 'Progress page and ProgressDashboard',
    },
  ],
  coach: [
    {
      id: 'coach-dashboard',
      role: 'coach',
      surface: 'web',
      title: 'Coach Dashboard',
      description: 'Main coach workspace with roster overview, chat, notifications, and plan request counts.',
      status: 'ready',
      implementation: 'CoachDashboard',
    },
    {
      id: 'athletes-list',
      role: 'coach',
      surface: 'web',
      title: 'Athletes List',
      description: 'Roster directory with search, level filters, and athlete cards.',
      status: 'ready',
      implementation: 'ClientsListScreen',
    },
    {
      id: 'athlete-profile',
      role: 'coach',
      surface: 'web',
      title: 'Athlete Profile',
      description: 'Coach-facing athlete profile opened from the roster with rank and profile details.',
      status: 'ready',
      implementation: 'CustomerProfileModal via ClientsListScreen',
    },
    {
      id: 'program-builder',
      role: 'coach',
      surface: 'web',
      title: 'Program Builder',
      description: 'Coach workflow for reviewing or shaping athlete programs from the web panel.',
      status: 'partial',
      implementation: 'Plan request review flow',
    },
    {
      id: 'messaging',
      role: 'coach',
      surface: 'web',
      title: 'Messaging',
      description: 'Realtime athlete messaging with typing indicators and unread tracking.',
      status: 'ready',
      implementation: 'Embedded coach dashboard chat',
    },
    {
      id: 'progress-analytics',
      role: 'coach',
      surface: 'web',
      title: 'Progress Analytics',
      description: 'Coach-side athlete activity and performance overview from the panel.',
      status: 'partial',
      implementation: 'TodaysActivity and dashboard metrics',
    },
  ],
  admin: [
    {
      id: 'admin-dashboard',
      role: 'admin',
      surface: 'web',
      title: 'Admin Dashboard',
      description: 'Top-level platform overview for revenue, gyms, growth, and coach operations.',
      status: 'ready',
      implementation: 'SuperAdminDashboard',
    },
    {
      id: 'users-management',
      role: 'admin',
      surface: 'web',
      title: 'Users Management',
      description: 'Admin area for user metrics and account visibility.',
      status: 'partial',
      implementation: 'TotalUsers',
    },
    {
      id: 'coaches-management',
      role: 'admin',
      surface: 'web',
      title: 'Coaches Management',
      description: 'Coach CRUD area with roster, assignments, and gym linkage.',
      status: 'ready',
      implementation: 'AllCoaches',
    },
    {
      id: 'exercises-management',
      role: 'admin',
      surface: 'web',
      title: 'Exercises Management',
      description: 'Platform exercise catalog administration for training content and metadata.',
      status: 'planned',
    },
    {
      id: 'missions-management',
      role: 'admin',
      surface: 'web',
      title: 'Missions Management',
      description: 'Mission and challenge administration for gamification campaigns.',
      status: 'planned',
    },
    {
      id: 'rank-system',
      role: 'admin',
      surface: 'web',
      title: 'Rank System',
      description: 'Rules, thresholds, and progression controls for the rank ladder.',
      status: 'planned',
    },
    {
      id: 'subscription-management',
      role: 'admin',
      surface: 'web',
      title: 'Subscription Management',
      description: 'Subscription plan monitoring, pricing oversight, and platform revenue health.',
      status: 'partial',
      implementation: 'TotalRevenue and RevenueBreakdown',
    },
  ],
};

export const getWorkspacePages = (role: WorkspaceRole) => workspacePagesByRole[role];

export const getWorkspacePage = (role: WorkspaceRole, id: string) =>
  workspacePagesByRole[role].find((page) => page.id === id);
