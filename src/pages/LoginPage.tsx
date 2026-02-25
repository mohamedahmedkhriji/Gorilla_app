import React, { useState } from 'react';
import { Dumbbell, Mail, Lock, Eye, EyeOff } from 'lucide-react';

import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(email, password, 'user');
      if (result.error || !result.user) {
        setError(result.error || 'Login failed');
        return;
      }

      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('userId', String(result.user.id));
      localStorage.setItem('appUser', JSON.stringify(result.user));
      localStorage.setItem('appUserId', String(result.user.id));
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Dumbbell size={40} className="text-[#BFFF00]" />
            <h1 className="text-4xl font-black text-white">GORILLA</h1>
          </div>
          <p className="text-gray-400 text-sm">Train Smart. Train Strong.</p>
        </div>

        {/* Login Form */}
        <div className="bg-[#242424] rounded-2xl p-6 md:p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Welcome Back</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-[#1A1A1A] text-white pl-11 pr-4 py-3 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[#1A1A1A] text-white pl-11 pr-11 py-3 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#BFFF00] text-black font-bold py-3 rounded-lg hover:bg-[#a8e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <span className="text-[#BFFF00]">Contact your coach</span>
            </p>
          </div>
        </div>

        {/* Admin Login Link */}
        <div className="text-center mt-4">
          <a
            href="/admin.html"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Admin/Coach Login →
          </a>
        </div>
      </div>
    </div>
  );
};
