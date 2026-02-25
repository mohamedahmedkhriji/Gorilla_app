import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Plus, X, Mail, Phone, Building2, Edit, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

interface AllCoachesProps {
  onBack: () => void;
}

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  gym: string;
  totalClients: number;
  status: string;
}

export const AllCoaches: React.FC<AllCoachesProps> = ({ onBack }) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [coachesData, setCoachesData] = useState<Coach[]>([]);
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', gymId: '', password: '' });

  useEffect(() => {
    loadCoaches();
    loadGyms();
  }, []);

  const loadGyms = async () => {
    try {
      const data = await api.getAllGyms();
      console.log('Loaded gyms:', data);
      setGyms(data);
    } catch (error) {
      console.error('Load gyms error:', error);
    }
  };

  const loadCoaches = async () => {
    try {
      const data = await api.getAllCoaches();
      setCoachesData(data as any);
    } catch (error) {
      console.error('Load coaches error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCoach(formData);
      alert('Coach created successfully!');
      setShowAddForm(false);
      setFormData({ name: '', email: '', phone: '', gymId: '', password: '' });
      loadCoaches();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCoach) {
      try {
        await updateCoach(selectedCoach.id, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        });
        alert('Coach updated successfully!');
        setShowEditForm(false);
        setSelectedCoach(null);
        setFormData({ name: '', email: '', phone: '', gymId: '', password: '' });
        loadCoaches();
      } catch (error: any) {
        alert('Error: ' + error.message);
      }
    }
  };

  const handleEdit = (coach: Coach, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCoach(coach);
    setFormData({ name: coach.name, email: coach.email, phone: coach.phone, gymId: '', password: '' });
    setShowEditForm(true);
  };

  const handleDelete = async (coachId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this coach?')) {
      try {
        await deleteCoach(coachId);
        alert('Coach deleted successfully!');
        loadCoaches();
      } catch (error: any) {
        alert('Error: ' + error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">All Coaches</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-[#BFFF00] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#a8e600] transition-colors"
          >
            <Plus size={20} />
            Add Coach
          </button>
          {['week', 'month', 'year'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-4 py-2 rounded-lg capitalize ${
                timeRange === range ? 'bg-[#BFFF00] text-black' : 'bg-[#242424]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#242424] rounded-lg p-6">
          <Users className="text-[#BFFF00] mb-2" size={24} />
          <div className="text-3xl font-bold">{coachesData.length}</div>
          <div className="text-sm text-gray-400">Total Coaches</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <Users className="text-green-500 mb-2" size={24} />
          <div className="text-3xl font-bold">{coachesData.filter(c => c.status === 'Active').length}</div>
          <div className="text-sm text-gray-400">Active Coaches</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <Users className="text-blue-500 mb-2" size={24} />
          <div className="text-3xl font-bold">{coachesData.reduce((sum, c) => sum + (c.totalClients || 0), 0)}</div>
          <div className="text-sm text-gray-400">Total Clients</div>
        </div>
      </div>

      <div className="bg-[#242424] rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Coach List</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading coaches...</div>
        ) : coachesData.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No coaches found. Click "Add Coach" to create one.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Phone</th>
                <th className="text-left py-3 px-4">Clients</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coachesData.map(coach => (
                <tr key={coach.id} className="border-b border-gray-800 hover:bg-[#1A1A1A]">
                  <td className="py-3 px-4 font-semibold">{coach.name}</td>
                  <td className="py-3 px-4 text-gray-400">{coach.email}</td>
                  <td className="py-3 px-4 text-gray-400">{coach.phone}</td>
                  <td className="py-3 px-4">{coach.totalClients || 0}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      coach.status === 'Active' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                    }`}>
                      {coach.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleEdit(coach, e)}
                        className="p-2 bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(coach.id, e)}
                        className="p-2 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-[#242424] rounded-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Add New Coach</h2>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Coach Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Gym *</label>
                <select
                  required
                  value={formData.gymId}
                  onChange={(e) => setFormData({...formData, gymId: e.target.value})}
                  className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                >
                  <option value="">Select a gym</option>
                  {gyms.map(gym => (
                    <option key={gym.id} value={gym.id}>{gym.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Password *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#BFFF00] text-black py-3 rounded-lg font-semibold hover:bg-[#a8e600] transition-colors"
                >
                  Create Coach Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditForm && selectedCoach && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowEditForm(false)}>
          <div className="bg-[#242424] rounded-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Edit Coach</h2>
              <button onClick={() => setShowEditForm(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Coach Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#BFFF00] outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#BFFF00] text-black py-3 rounded-lg font-semibold hover:bg-[#a8e600] transition-colors"
                >
                  Update Coach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
