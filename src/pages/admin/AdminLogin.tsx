import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { CoachDashboard } from './CoachDashboard';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { api } from '../../services/api';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { clearStoredAdminSession, getStoredAdminAuthToken, persistStoredAdminSession } from '../../shared/adminAuthStorage';

type UserRole = 'coach' | 'gym_owner' | null;

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = getStoredAdminAuthToken();
      if (!token) {
        if (!cancelled) setRestoringSession(false);
        return;
      }

      try {
        const session = await api.getCurrentSession('admin');
        const sessionUser = session?.user;
        if (!sessionUser || (sessionUser.role !== 'coach' && sessionUser.role !== 'gym_owner')) {
          throw new Error('Invalid admin session');
        }

        persistStoredAdminSession({ user: sessionUser, token });
        localStorage.setItem('adminUserId', String(sessionUser.id));

        if (sessionUser.role === 'coach') {
          const coachPayload = session?.coach || {
            id: sessionUser.id,
            name: sessionUser.name,
            gym: sessionUser.gym_id ? [sessionUser.gym_id] : [],
          };
          localStorage.setItem('coach', JSON.stringify(coachPayload));
          localStorage.setItem('coachId', String(sessionUser.id));
        } else {
          localStorage.removeItem('coach');
          localStorage.removeItem('coachId');
        }

        if (!cancelled) {
          setRole(sessionUser.role as UserRole);
        }
      } catch {
        clearStoredAdminSession();
        if (!cancelled) {
          setRole(null);
        }
      } finally {
        if (!cancelled) {
          setRestoringSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearStoredAdminSession();
    setRole(null);
    setEmail('');
    setPassword('');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(email, password, 'admin');

      if (result.error) {
        if (String(result.error).toLowerCase().includes('invalid credentials')) {
          setError('Invalid admin credentials. Use a Coach or Gym Owner account.');
        } else {
          setError(result.error);
        }
        return;
      }

      // Keep admin auth state separate from end-user app state.
      persistStoredAdminSession({ user: result.user, token: result.token });
      localStorage.setItem('adminUserId', String(result.user.id));
      if (result.user.role === 'coach') {
        const coachPayload = result.coach || {
          id: result.user.id,
          name: result.user.name,
          gym: result.user.gym_id ? [result.user.gym_id] : [],
        };
        localStorage.setItem('coach', JSON.stringify(coachPayload));
        localStorage.setItem('coachId', String(result.user.id));
      } else {
        localStorage.removeItem('coach');
        localStorage.removeItem('coachId');
      }

      if (result.user.role === 'coach') {
        setRole('coach');
      } else if (result.user.role === 'gym_owner') {
        setRole('gym_owner');
      } else {
        setError('Invalid role');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (role === 'coach') {
    return <CoachDashboard onLogout={handleLogout} />;
  }

  if (role === 'gym_owner') {
    return <SuperAdminDashboard onLogout={handleLogout} />;
  }

  if (restoringSession) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] text-white flex items-center justify-center p-4">
        <div className="text-sm text-gray-400">Restoring secure session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-24 h-24">
            <BrandLogo imageClassName="object-contain" />
          </div>
          <h1 className="font-brand text-3xl">RepSet</h1>
          <h2 className="text-xl font-semibold">Admin Portal</h2>
          <p className="text-gray-400 text-sm mt-2">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#242424] rounded-lg p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-[#1A1A1A] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1A1A1A] rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-gray-400 hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#10b981] text-black py-3 rounded-lg font-marker hover:bg-[#10b981]/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-4">
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            User Login {'->'}
          </a>
        </div>
      </div>
    </div>
  );
};


