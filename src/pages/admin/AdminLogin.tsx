import React, { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { CoachDashboard } from './CoachDashboard';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { api } from '../../services/api';

type UserRole = 'coach' | 'gym_owner' | null;

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const result = await api.login(email, password, 'admin');
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      // Keep admin auth state separate from end-user app state.
      localStorage.setItem('adminUser', JSON.stringify(result.user));
      localStorage.setItem('adminUserId', String(result.user.id));
      if (result.user.role === 'coach') {
        const coachPayload = result.coach || {
          id: result.user.id,
          name: result.user.name,
          gym: result.user.gym_id ? [result.user.gym_id] : []
        };
        localStorage.setItem('coach', JSON.stringify(coachPayload));
        localStorage.setItem('coachId', String(result.user.id));
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
    return <CoachDashboard />;
  }

  if (role === 'gym_owner') {
    return <SuperAdminDashboard />;
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Dumbbell size={32} className="text-[#BFFF00]" />
            <h1 className="text-3xl font-black italic">GORILLA</h1>
          </div>
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-[#1A1A1A] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1A1A1A] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#BFFF00] text-black py-3 rounded-lg font-semibold hover:bg-[#BFFF00]/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="text-center mt-4">
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            User Login →
          </a>
        </div>
      </div>
    </div>
  );
};
