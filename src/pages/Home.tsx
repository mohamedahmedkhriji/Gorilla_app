import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WorkoutCard } from '../components/dashboard/WorkoutCard';
import { RecoveryIndicator } from '../components/dashboard/RecoveryIndicator';
import { RankDisplay } from '../components/dashboard/RankDisplay';
import { GhostButton } from '../components/ui/GhostButton';
import { FriendsCard } from '../components/home/FriendsCard';
import { CoachCard } from '../components/home/CoachCard';
import { CalculatorCard } from '../components/home/CalculatorCard';
import { AgendaSection } from '../components/home/AgendaSection';
import { EducationSection } from '../components/home/EducationSection';
import { FriendsList } from './FriendsList';
import { FriendProfile } from './FriendProfile';
import { CoachList } from './CoachList';
import { Messaging } from './Messaging';
import { Calculator } from './Calculator';
import { ExerciseLibrary } from './ExerciseLibrary';
import { BooksLibrary } from './BooksLibrary';
import { ExerciseVideoScreen } from '../components/workout/ExerciseVideoScreen';
import { MuscleRecoveryScreen } from '../components/progress/MuscleRecoveryScreen';
import { RankingsRewardsScreen } from '../components/profile/RankingsRewardsScreen';
import { api } from '../services/api';
interface HomeProps {
  onNavigate: (tab: string) => void;
}
type HomeView =
'main' |
'friends' |
'friendProfile' |
'coachList' |
'chat' |
'calculator' |
'exercises' |
'books' |
'video' |
'recovery' |
'rank' |
'workoutDetail' |
'nutrition';
export function Home({ onNavigate }: HomeProps) {
  const [view, setView] = useState<HomeView>('main');
  const [selectedExercise, setSelectedExercise] = useState<{name: string, muscle: string, video: string} | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<{id: number, name: string} | null>(null);
  const [greeting, setGreeting] = useState('');
  const [overallRecovery, setOverallRecovery] = useState(100);
  const [todayWorkout, setTodayWorkout] = useState('Push Day');
  const [userProgram, setUserProgram] = useState<any>(null);
  const [todayWorkoutData, setTodayWorkoutData] = useState<any>(null);
  const [workoutProgress, setWorkoutProgress] = useState(0);
  const [programProgress, setProgramProgress] = useState<any>(null);

  useEffect(() => {
    // Get user name from localStorage
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{"name":"Moha"}');
    const userName = user.name || 'Moha';
    
    setGreeting(userName);

    // Fetch user program
    const fetchProgram = async () => {
      if (!user.id) {
        setUserProgram({ workouts: [] });
        setTodayWorkout('Rest Day');
        setTodayWorkoutData(null);
        return;
      }

      try {
        const programData = await api.getUserProgram(user.id);
        const weeklyWorkouts = Array.isArray(programData?.currentWeekWorkouts)
          ? programData.currentWeekWorkouts
          : Array.isArray(programData?.workouts)
            ? programData.workouts
            : [];

        setUserProgram({ ...(programData || {}), workouts: weeklyWorkouts });

        if (programData?.todayWorkout?.name) {
          const normalizedToday = {
            workout_name: programData.todayWorkout.name,
            workout_type: programData.todayWorkout.workoutType || '',
            exercises: JSON.stringify(programData.todayWorkout.exercises || []),
          };
          setTodayWorkout(normalizedToday.workout_name);
          setTodayWorkoutData(normalizedToday);
        } else {
          setTodayWorkout('Rest Day');
          setTodayWorkoutData(null);
        }
      } catch (error) {
        console.error('Failed to fetch user program:', error);
        setUserProgram({ workouts: [] });
        setTodayWorkout('Rest Day');
        setTodayWorkoutData(null);
      }
    };
    fetchProgram();

    const fetchProgramProgress = async () => {
      if (!user.id) return;
      try {
        const progress = await api.getProgramProgress(user.id);
        setProgramProgress(progress?.summary || null);
      } catch (error) {
        console.error('Failed to fetch program progress:', error);
      }
    };
    void fetchProgramProgress();

    // Fetch recovery status from API (same data shown on the recovery page)
    const fetchRecovery = async () => {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      if (!user.id) {
        setOverallRecovery(100);
        return;
      }

      try {
        const data = await api.getRecoveryStatus(user.id);
        if (typeof data?.overallRecovery === 'number') {
          setOverallRecovery(Math.round(Math.max(0, Math.min(100, data.overallRecovery))));
          return;
        }

        if (Array.isArray(data?.recovery) && data.recovery.length > 0) {
          const avg = data.recovery.reduce((sum: number, m: any) => sum + (Number(m.score) || 0), 0) / data.recovery.length;
          setOverallRecovery(Math.round(Math.max(0, Math.min(100, avg))));
          return;
        }

        setOverallRecovery(100);
      } catch (error) {
        console.error('Failed to fetch recovery status:', error);
      }
    };
    void fetchRecovery();
    
    const handleRecoveryUpdated = () => {
      void fetchRecovery();
    };
    window.addEventListener('recovery-updated', handleRecoveryUpdated);

    // Check for recovery updates every 2 seconds
    const recoveryInterval = setInterval(() => {
      if (localStorage.getItem('recoveryNeedsUpdate') === 'true') {
        localStorage.removeItem('recoveryNeedsUpdate');
        void fetchRecovery();
      }
    }, 2000);

    // Keep score fresh even without explicit user actions.
    const periodicRecoveryRefresh = setInterval(() => {
      void fetchRecovery();
    }, 60 * 1000);

    const progressRefresh = setInterval(() => {
      void fetchProgramProgress();
    }, 15 * 1000);

    return () => {
      window.removeEventListener('recovery-updated', handleRecoveryUpdated);
      clearInterval(recoveryInterval);
      clearInterval(periodicRecoveryRefresh);
      clearInterval(progressRefresh);
    };
  }, []);

  useEffect(() => {
    if (!todayWorkoutData || todayWorkout === 'Rest Day') {
      if (todayWorkout === 'Rest Day') setWorkoutProgress(0);
      return;
    }

    const normalizeExerciseName = (name: string) => String(name || '').trim().toLowerCase();

    const getLocalCompletedExercises = () => {
      const today = new Date().toDateString();
      const savedDate = localStorage.getItem('workoutDate');
      if (savedDate !== today) return new Set<string>();

      const raw = localStorage.getItem('completedExercises');
      if (!raw) return new Set<string>();

      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set<string>();
        return new Set(parsed.map((name: string) => normalizeExerciseName(name)));
      } catch {
        return new Set<string>();
      }
    };

    const calculateProgress = async () => {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      const userId = user.id;

      let exercises: Array<{ exerciseName?: string; name?: string }> = [];
      try {
        exercises = JSON.parse(todayWorkoutData.exercises || '[]');
      } catch {
        exercises = [];
      }

      if (exercises.length === 0) {
        setWorkoutProgress(0);
        return;
      }

      const plannedNames = Array.from(
        new Set(
          exercises
            .map((ex: any) => normalizeExerciseName(ex.exerciseName || ex.name || ''))
            .filter(Boolean),
        ),
      );

      if (!plannedNames.length) {
        setWorkoutProgress(0);
        return;
      }

      const localCompleted = getLocalCompletedExercises();
      let completedCount = plannedNames.filter((name) => localCompleted.has(name)).length;

      if (!userId) {
        setWorkoutProgress(Math.min(100, Math.round((completedCount / plannedNames.length) * 100)));
        return;
      }

      try {
        const completedSets = await api.getTodayWorkoutProgress(userId);
        const completedFromApi = new Set(
          (Array.isArray(completedSets) ? completedSets : [])
            .map((s: any) => normalizeExerciseName(s.exercise_name || ''))
            .filter(Boolean),
        );
        const apiCompletedCount = plannedNames.filter((name) => completedFromApi.has(name)).length;
        completedCount = Math.max(completedCount, apiCompletedCount);

        const progress = Math.min(100, Math.round((completedCount / plannedNames.length) * 100));
        setWorkoutProgress(progress);
      } catch (error) {
        // If API is unavailable, keep local progress so UI still updates.
        const progress = Math.min(100, Math.round((completedCount / plannedNames.length) * 100));
        setWorkoutProgress(progress);
      }
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 1000);
    return () => clearInterval(interval);
  }, [todayWorkoutData, todayWorkout]);
  if (view === 'nutrition') {
    return (
      <div className="pb-24">
        <button onClick={() => setView('main')} className="text-white mb-4">← Back</button>
        <h2 className="text-2xl font-bold text-white mb-4">My Nutrition</h2>
        <p className="text-text-secondary">Coming soon...</p>
      </div>
    );
  }
  if (view === 'workoutDetail') {
    if (todayWorkout === 'Rest Day') {
      return (
        <div className="flex flex-col items-center justify-center h-screen pb-24">
          <button onClick={() => setView('main')} className="absolute top-6 left-6 text-white">
            ← Back
          </button>
          <div className="text-8xl mb-6">🛏️</div>
          <h2 className="text-3xl font-bold text-white mb-3">Rest Day</h2>
          <p className="text-text-secondary text-lg">Eat well and recover</p>
        </div>
      );
    }
    
    // Get today's workout exercises
    let exercises = [];
    try {
      exercises = JSON.parse(todayWorkoutData?.exercises || '[]');
    } catch {
      exercises = [];
    }
    
    return (
      <div className="pb-24 px-6">
        <button onClick={() => setView('main')} className="text-white mb-4">← Back</button>
        <h2 className="text-2xl font-bold text-white mb-2">{todayWorkout}</h2>
        <p className="text-text-secondary mb-6">{todayWorkoutData?.workout_type}</p>
        
        <div className="space-y-3">
          {exercises.map((ex: any, i: number) => (
            <div key={i} className="bg-card rounded-xl p-4 border border-white/5">
              <h3 className="font-bold text-white mb-2">{ex.exerciseName}</h3>
              <div className="flex gap-4 text-sm text-text-secondary">
                <span>{ex.sets} sets</span>
                <span>{ex.reps} reps</span>
                <span>{ex.rest}s rest</span>
              </div>
              {ex.notes && <p className="text-xs text-text-tertiary mt-2">{ex.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (view === 'friends')
  return (
    <FriendsList
      onBack={() => setView('main')}
      onFriendClick={() => setView('friendProfile')} />);


  if (view === 'friendProfile')
  return <FriendProfile onBack={() => setView('friends')} />;
  if (view === 'coachList')
  return <CoachList onBack={() => setView('main')} onSelectCoach={(id, name) => { setSelectedCoach({id, name}); setView('chat'); }} />;
  if (view === 'chat') return <Messaging onBack={() => setView('coachList')} coachId={selectedCoach?.id} coachName={selectedCoach?.name} />;
  if (view === 'calculator')
  return <Calculator onBack={() => setView('main')} />;
  if (view === 'exercises')
  return (
    <ExerciseLibrary
      onBack={() => setView('main')}
      onExerciseClick={(exercise) => {
        setSelectedExercise(exercise);
        setView('video');
      }} />);


  if (view === 'books') return <BooksLibrary onBack={() => setView('main')} />;
  if (view === 'video')
  return <ExerciseVideoScreen onBack={() => setView('exercises')} exercise={selectedExercise || undefined} />;
  if (view === 'recovery')
  return <MuscleRecoveryScreen onBack={() => setView('main')} />;
  if (view === 'rank')
  return <RankingsRewardsScreen onBack={() => setView('main')} />;
  return (
    <div className="pb-32 pt-6">
      {/* Header Section */}
      <motion.header
        initial={{
          opacity: 0,
          y: -20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          duration: 0.6,
          ease: 'easeOut'
        }}
        className="mb-6 flex items-center justify-between">

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            {greeting}
          </h1>
          <p className="text-text-secondary mt-1 text-sm font-medium">
            Ready to crush your goals today?
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-xl border border-white/5">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="text-xs text-text-secondary">Rank</div>
            <div className="text-sm font-bold text-accent">{programProgress?.rank || 'Bronze'}</div>
          </div>
        </div>
      </motion.header>

      {/* Main Content Grid */}
      <div className="space-y-8">
        {/* Social & Coaching */}
        <div className="grid grid-cols-2 gap-4">
          <FriendsCard onClick={() => setView('friends')} />
          <CoachCard onClick={() => setView('coachList')} />
        </div>

        {/* Today's Workout */}
        <div onClick={() => onNavigate('workout')} className="cursor-pointer">
          <WorkoutCard
            title={todayWorkout}
            duration={todayWorkoutData?.workout_type || ''}
            progress={workoutProgress}
            isRestDay={todayWorkout === 'Rest Day'} />
        </div>

        {/* Rank & Recovery */}
        <div className="grid grid-cols-1 gap-5">
          <div onClick={() => setView('rank')} className="cursor-pointer">
            <RankDisplay points={programProgress?.totalPoints || 0} />
          </div>
          <RecoveryIndicator percentage={overallRecovery} onClick={() => setView('recovery')} />
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            duration: 0.5,
            delay: 0.5
          }}
          className="grid grid-cols-2 gap-4">

          <GhostButton onClick={() => setView('nutrition')}>
            My Nutrition
          </GhostButton>
          <GhostButton onClick={() => onNavigate('progress')}>
            View History
          </GhostButton>
        </motion.div>

        {/* Agenda */}
        <AgendaSection userProgram={userProgram} />

        {/* Education */}
        <EducationSection
          onExercises={() => setView('exercises')}
          onBooks={() => setView('books')} />


        {/* Calculators */}
        <CalculatorCard onClick={() => setView('calculator')} />
      </div>
    </div>);

}
