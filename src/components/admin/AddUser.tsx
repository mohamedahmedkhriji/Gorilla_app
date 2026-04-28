import React, { useState } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { api } from '../../services/api';

interface AddUserProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export const AddUser: React.FC<AddUserProps> = ({ onBack, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    isPremium: true
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    setLoading(true);
    setSuccessMessage('');

    try {
      // Get coach data from localStorage
      const coachData = JSON.parse(localStorage.getItem('coach') || '{}');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      const coachId = Number(localStorage.getItem('coachId') || coachData.id || adminUser.id || 0);
      const gymId = Number(coachData.gym?.[0] || adminUser.gym_id || 0); // Get gym ID from coach data

      if (!coachId || !gymId) {
        throw new Error('Coach or gym information not found');
      }

      await api.createUser({
        email: formData.email,
        password: formData.password,
        coach_id: coachId,
        gym_id: gymId,
        is_premium: formData.isPremium
      });

      setSuccessMessage('User account created successfully!');
      setFormData({ email: '', password: '', confirmPassword: '', isPremium: true });
      setTimeout(() => {
        setSuccessMessage('');
        if (onSuccess) {
          onSuccess();
        } else {
          onBack();
        }
      }, 1400);
    } catch (err: any) {
      setError(err.message || 'Failed to create user account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#111827]">
      <div className="border-b border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold">Add New User</h1>
        <p className="text-slate-500 text-sm">Create account for new gym member</p>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3 mb-6">
            <UserPlus className="text-emerald-600" size={24} />
            <h2 className="text-xl font-semibold">User Account Details</h2>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 mb-4 text-sm text-rose-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-500 mb-2">User Email *</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="user@email.com"
                className="w-full bg-white text-[#111827] px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#10b981] outline-none placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-2">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-white text-[#111827] px-4 py-3 pr-12 rounded-2xl border border-slate-200 focus:border-[#10b981] outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-[#111827]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-2">Confirm Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  placeholder="Re-enter password"
                  className="w-full bg-white text-[#111827] px-4 py-3 pr-12 rounded-2xl border border-slate-200 focus:border-[#10b981] outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-[#111827]"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formData.isPremium}
                onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#10b981] focus:ring-[#10b981]"
              />
              <span>
                <span className="block font-semibold text-slate-900">Premium user</span>
                <span className="mt-1 block text-slate-500">Enable premium features for this account.</span>
              </span>
            </label>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <p className="text-sm text-slate-600 font-semibold">Note</p>
              <ul className="text-sm text-slate-600 mt-2 space-y-1">
                <li>- User will login with this email and password</li>
                <li>- User will complete onboarding process</li>
                <li>- Existing users are premium by default</li>
                <li>- You will receive notification when onboarding is done</li>
                <li>- User data will be automatically sent to your profile</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-2xl bg-[#10b981] text-black py-3 font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create User Account'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {(loading || successMessage) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-xl">
            <div className="text-base font-semibold text-slate-900">
              {successMessage ? 'Account Created' : 'Creating Account'}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {successMessage ? 'The user can login now.' : 'Wait a moment!'}
            </div>
            {!successMessage && (
              <div className="mt-4 flex items-center justify-center">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};



