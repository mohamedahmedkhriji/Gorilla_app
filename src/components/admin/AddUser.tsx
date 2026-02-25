import React, { useState } from 'react';
import { ArrowLeft, UserPlus, X } from 'lucide-react';
import { api } from '../../services/api';

interface AddUserProps {
  onBack: () => void;
}

export const AddUser: React.FC<AddUserProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    setLoading(true);

    try {
      // Get coach data from localStorage
      const coachData = JSON.parse(localStorage.getItem('coach') || '{}');
      const coachId = localStorage.getItem('coachId');
      const gymId = coachData.gym?.[0]; // Get gym ID from coach data

      if (!coachId || !gymId) {
        throw new Error('Coach or gym information not found');
      }

      await api.createUser({
        email: formData.email,
        password: formData.password,
        coach_id: coachId,
        gym_id: gymId
      });
      
      alert(`User account created successfully!\n\nEmail: ${formData.email}\nPassword: ${formData.password}\n\nUser can now login and complete onboarding.\nYou will receive a notification when onboarding is complete.`);
      
      setFormData({ email: '', password: '', confirmPassword: '' });
      onBack();
    } catch (err: any) {
      setError(err.message || 'Failed to create user account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="border-b border-gray-800 p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-4">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">Add New User</h1>
        <p className="text-gray-400 text-sm">Create account for new gym member</p>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-[#242424] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <UserPlus className="text-[#BFFF00]" size={24} />
            <h2 className="text-xl font-semibold">User Account Details</h2>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">User Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="user@email.com"
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Minimum 6 characters"
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Confirm Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                placeholder="Re-enter password"
                className="w-full bg-[#1A1A1A] text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
              />
            </div>

            <div className="bg-[#1A1A1A] p-4 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400">
                ℹ️ After creating the account:
              </p>
              <ul className="text-sm text-gray-400 mt-2 space-y-1 ml-4">
                <li>• User will login with this email and password</li>
                <li>• User will complete onboarding process</li>
                <li>• You will receive notification when onboarding is done</li>
                <li>• User data will be automatically sent to your profile</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#BFFF00] text-black py-3 rounded-lg font-semibold hover:bg-[#a8e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create User Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
