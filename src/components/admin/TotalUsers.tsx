import React, { useState } from 'react';
import { ArrowLeft, Users, TrendingUp, Edit, Trash2, Plus, X } from 'lucide-react';

interface TotalUsersProps {
  onBack: () => void;
}

export const TotalUsers: React.FC<TotalUsersProps> = ({ onBack }) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [usersData, setUsersData] = useState([
    { id: '1', name: 'Alex Johnson', email: 'alex@email.com', joined: '2024-01-15', status: 'active', workouts: 45, subscriptionEnd: '2025-01-15' },
    { id: '2', name: 'Sarah Smith', email: 'sarah@email.com', joined: '2024-01-10', status: 'active', workouts: 38, subscriptionEnd: '2025-02-10' },
    { id: '3', name: 'Mike Brown', email: 'mike@email.com', joined: '2024-01-08', status: 'active', workouts: 52, subscriptionEnd: '2024-01-01' },
    { id: '4', name: 'Emma Davis', email: 'emma@email.com', joined: '2024-01-05', status: 'inactive', workouts: 12, subscriptionEnd: '2024-01-01' },
    { id: '5', name: 'John Wilson', email: 'john@email.com', joined: '2023-12-20', status: 'active', workouts: 67, subscriptionEnd: '2025-03-20' }
  ]);
  const [formData, setFormData] = useState({ name: '', email: '', status: 'active' });

  React.useEffect(() => {
    const checkSubscriptions = () => {
      const today = new Date();
      setUsersData(prevUsers => 
        prevUsers.map(user => {
          const subEnd = new Date(user.subscriptionEnd);
          if (subEnd < today && user.status === 'active') {
            return { ...user, status: 'inactive' };
          }
          return user;
        })
      );
    };
    checkSubscriptions();
    const interval = setInterval(checkSubscriptions, 86400000);
    return () => clearInterval(interval);
  }, []);

  const users = usersData;

  const handleEdit = (user: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUser(user);
    setFormData({ name: user.name, email: user.email, status: user.status });
    setShowEditForm(true);
  };

  const handleDelete = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this user? All data will be removed.')) {
      setUsersData(usersData.filter(u => u.id !== userId));
      alert('User deleted successfully!');
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      setUsersData(usersData.map(u => 
        u.id === selectedUser.id 
          ? { ...u, name: formData.name, email: formData.email, status: formData.status }
          : u
      ));
      alert('User updated successfully!');
      setShowEditForm(false);
      setSelectedUser(null);
      setFormData({ name: '', email: '', status: 'active' });
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Total Users</h1>
        <div className="flex gap-2">
          {['week', 'month', 'year'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-4 py-2 rounded-lg capitalize ${
                timeRange === range ? 'bg-[#10b981] text-black' : 'bg-[#242424]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#242424] rounded-lg p-6">
          <Users className="text-emerald-600 mb-2" size={24} />
          <div className="text-3xl font-bold">1,247</div>
          <div className="text-sm text-gray-400">Total Users</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-green-500 mb-2" size={24} />
          <div className="text-3xl font-bold">892</div>
          <div className="text-sm text-gray-400">Active Users</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <Users className="text-red-500 mb-2" size={24} />
          <div className="text-3xl font-bold">355</div>
          <div className="text-sm text-gray-400">Inactive Users</div>
        </div>
      </div>

      <div className="bg-[#242424] rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">User List</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Joined</th>
              <th className="text-left py-3 px-4">Workouts</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-800 hover:bg-[#1A1A1A]">
                <td className="py-3 px-4 font-semibold">{user.name}</td>
                <td className="py-3 px-4 text-gray-400">{user.email}</td>
                <td className="py-3 px-4 text-gray-400">{user.joined}</td>
                <td className="py-3 px-4">{user.workouts}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleEdit(user, e)}
                      className="p-2 bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(user.id, e)}
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
      </div>

      {showEditForm && selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowEditForm(false)}>
          <div className="bg-[#242424] rounded-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Edit User</h2>
              <button onClick={() => setShowEditForm(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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
                  className="flex-1 bg-[#10b981] text-black py-3 rounded-lg font-semibold hover:bg-[#a8e600] transition-colors"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

