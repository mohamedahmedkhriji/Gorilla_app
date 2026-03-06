# RepSet Fitness Platform

RepSet is a full-stack fitness platform with:

- A user training app (onboarding, workout plans, tracking, recovery/progress, nutrition, blog feed)
- A coach/admin portal (client management, plan requests, messaging)
- An Express + MySQL backend with REST APIs and Socket.IO chat

## Deployment

For automated deployment (build checks on PRs + auto-deploy on `main` pushes), see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Tech Stack

- Frontend: React, TypeScript, Vite, TailwindCSS, Framer Motion
- Backend: Node.js, Express, Socket.IO
- Database: MySQL

## Project Structure

- `src/` - User app + admin UI entrypoints
- `server/` - API server, DB access, migrations, services
- `dataset/` - Local CSV datasets used for insights and nutrition logic
- `public/`, `assets/`, `vedio/`, `body part/` - Static media and exercise assets

## Prerequisites

- Node.js 18+
- npm
- MySQL 8+

## Environment Variables

Create or update `.env` in the project root:

```env
VITE_OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE
ANTHROPIC_MODEL=claude-3-7-sonnet-latest

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=gorella_fitness
DB_PORT=3307

PORT=5001
CLIENT_URL=http://localhost:5173
VITE_API_URL=http://localhost:5001/api
```

Notes:

- `ANTHROPIC_API_KEY` enables Claude-based onboarding plan generation.
- `VITE_OPENAI_API_KEY` is used by client-side AI coach utilities.
- `CLIENT_URL` is the allowed frontend origin for backend CORS.
- `VITE_API_URL` is the frontend API base URL.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Initialize database schema (first-time setup):

```bash
# Option A: base schema
mysql -u root -P 3307 < server/init_innodb.sql

# Option B: apply targeted migrations as needed
npm run migrate:sql -- server/migrations/2026-02-26_exercise_catalog_upgrade.sql
npm run migrate:sql -- server/migrations/2026-02-26_program_change_requests.sql
npm run migrate:sql -- server/migrations/2026-02-27_blog_posts_foundation.sql
npm run migrate:sql -- server/migrations/2026-02-27_user_insights_foundation.sql
npm run migrate:sql -- server/migrations/2026-02-27_plan_validation_loop.sql
```

3. Run frontend and backend together:

```bash
npm run start
```

Or run separately:

```bash
npm run dev         # Frontend (Vite)
npm run server      # Backend (Express)
```

## Local URLs

- User app: `http://localhost:5173/`
- Admin/Coach login: `http://localhost:5173/admin.html`
- API server: `http://localhost:5001`
- Health check: `http://localhost:5001/health`

## Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build frontend assets
- `npm run preview` - Preview production frontend build
- `npm run server` - Start backend server
- `npm run dev:server` - Start backend in watch mode
- `npm run start` - Run backend + frontend concurrently
- `npm run lint` - Run ESLint
- `npm run seed:plans` - Seed workout plans
- `npm run backfill:workout-catalog` - Backfill workout set catalog IDs
- `npm run migrate:sql -- <path-to-sql>` - Run a SQL migration file

## Full App Features and Functionality

### User App

- Splash experience with intro video and animated transition into app
- Authentication and role-aware session handling for user accounts
- Multi-step onboarding:
  - Personal profile (age, gender, height, weight)
  - Fitness background and primary goal selection
  - Training availability (days/week, session duration, preferred time)
  - Gym selection and optional body image upload
  - AI analysis/results screen with onboarding plan source tracking
- Program generation and management:
  - Auto-generated personalized plans from onboarding data
  - Optional Claude-generated 8-week onboarding plan when Anthropic is configured
  - Current-week plan view
  - Custom plan builder with exercise catalog autocomplete
  - Save custom plan directly or submit to coach for approval
  - Coach-request plan flow (user requests coach-built plan)
- Home/dashboard features:
  - Today workout card + progress
  - Agenda/program preview
  - Recovery indicator
  - Friends/coaches quick navigation
  - Quick actions (nutrition, education, tools)
- Workout execution:
  - Workout plan/day screens
  - Set-by-set tracker with saved local state
  - Exercise videos
  - Rest timer and post-workout summary flow
  - Workout set logging and daily workout progress sync
- Progress and analytics:
  - Progress dashboard and charts
  - Muscle recovery screen
  - Overload planning recommendations
  - Weekly check-in with health/recovery inputs
  - Bi-weekly report generation
  - Exercise progress history
  - Body measurements and progress photos modules
  - AI insights screen
- Nutrition:
  - Daily nutrition plan generation from profile/program context
  - Meal breakdown, macro targets, hydration targets, and adherence indicators
- Social and community:
  - Friends list and friend profile
  - User-to-user invitation flow
  - Coach messaging with typing indicators and realtime updates
  - Blogs/feed with image or video posts
  - Post edit/delete (owner), hide, like/unlike, view tracking, comments, and share actions
  - My posts management
- Education and utility screens:
  - Exercise library
  - Exercise video library
  - Books library
  - Calculator tools
- Profile and account:
  - Profile picture upload and preview
  - Personal details update
  - Password update
  - Gym access screen
  - Settings (theme + language)
  - Notification center and clear/mark-read actions
  - Notification preference toggles
- Gamification and ranking:
  - Missions and mission history
  - Challenges and challenge history
  - Gamification summary
  - Leaderboard (all-time/monthly)
  - Rank and rewards views
  - Point accumulation from activity/events

### Coach/Admin Portal

- Separate admin/coach login entry (`/admin.html`)
- Role-based admin routing:
  - Coach dashboard
  - Gym owner (super-admin) dashboard
- Coach dashboard functionality:
  - Client roster and quick stats
  - Realtime chat with clients (Socket.IO)
  - Typing indicators and unread tracking
  - Coach profile picture upload/preview
  - Theme toggle (light/dark) for coach UI
  - Program request inbox (approve/reject with notes)
  - Add user flow
  - Notifications integration
- Super-admin dashboard functionality:
  - User/revenue/gym/coaches overview widgets
  - Partner gym table and high-level analytics views
  - Navigation to detailed admin components (growth, revenue, coaches, gyms)

### Backend/API Functionality

- Auth and user provisioning endpoints (login/register, coaches, gyms, users)
- Onboarding save endpoint that updates profile and assigns/generates plans
- Program lifecycle endpoints:
  - Generate personalized plan
  - Save custom plan
  - Submit/approve/reject custom plan change requests
  - Coach-side custom plan assignment
  - Weekly and bi-weekly adaptation endpoints
  - Plan validation snapshots/history and monthly calibration summary
- Recovery engine endpoints:
  - Recovery factor updates
  - Recovery status retrieval
  - Recalculate today's recovery
  - Workout-session to recovery impact updates
- Progress endpoints:
  - Strength progress
  - Muscle distribution (actual and plan)
  - Bi-weekly reports
  - Overload recommendation generation
- Workout tracking endpoints:
  - Save workout sets
  - Fetch exercise workout history
  - Fetch today's completed exercise progress
- Messaging and notifications endpoints:
  - Conversation retrieval
  - Read-state updates for both user and coach contexts
  - Notification list/read/clear
  - Notification settings read/write
- Social/blog endpoints:
  - Feed pagination
  - Create/update/delete posts
  - Like toggle/like-only mode
  - View tracking
  - Comments list/create
- Insights and nutrition endpoints:
  - Dataset overview
  - Onboarding insight generation
  - User analysis insight generation
  - Persisted insight snapshots/scores/history
  - Daily nutrition plan generation
- Profile endpoints:
  - Profile picture get/update
  - Profile details get/update
  - Password update
  - Profile stats
- Gamification endpoints:
  - Missions/challenges retrieval + history
  - Gamification summary/debug
  - Leaderboard retrieval

### Realtime (Socket.IO)

- Room join model per participant type (`user` / `coach`)
- Realtime message delivery to both sender and receiver channels
- Realtime typing/stop-typing events
- Server-side notification creation on message events (based on user notification settings)

### Data and AI/Analytics Services

- MySQL-backed domain model with migration scripts and migration runner
- Exercise catalog infrastructure and backfill/import scripts
- Synthetic dataset-powered insight and nutrition services (`dataset/*.csv`)
- Insight scoring + persistence model for recovery/risk/readiness/confidence trends
- Claude integration for onboarding plan generation with schema-normalized output
- Client-side OpenAI coach utility service for training Q&A/form advice workflows

## Troubleshooting

- If API calls return non-JSON or 404 unexpectedly, restart backend (`npm run server`).
- If chat is not connecting, verify backend is running on port `5001`.
- If onboarding/program generation fails, check DB schema/migrations and `.env` keys.
