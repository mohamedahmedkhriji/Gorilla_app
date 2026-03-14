import React, { useState } from 'react';
import { ArrowLeft, Building2, X, Users, DollarSign, Calendar, Plus, Edit, Trash2 } from 'lucide-react';

interface PartnerGymsProps {
  onBack: () => void;
}

interface Gym {
  id: string;
  name: string;
  members: number;
  revenue: number;
  status: string;
  plan: string;
  address: string;
  phone: string;
  email: string;
  joined: string;
}

export const PartnerGyms: React.FC<PartnerGymsProps> = ({ onBack }) => {
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [gymsData, setGymsData] = useState<Gym[]>([
    { id: '1', name: 'Iron Paradise', members: 156, revenue: 4680, status: 'active', plan: 'Premium', address: '123 Main St', phone: '+1234567890', email: 'info@ironparadise.com', joined: '2023-06-15' },
    { id: '2', name: 'Fitness Hub', members: 203, revenue: 6090, status: 'active', plan: 'Premium', address: '456 Oak Ave', phone: '+1234567891', email: 'contact@fitnesshub.com', joined: '2023-08-20' },
    { id: '3', name: 'Elite Gym', members: 89, revenue: 2670, status: 'active', plan: 'Basic', address: '789 Pine Rd', phone: '+1234567892', email: 'hello@elitegym.com', joined: '2023-09-10' },
    { id: '4', name: 'Power House', members: 134, revenue: 4020, status: 'active', plan: 'Premium', address: '321 Elm St', phone: '+1234567893', email: 'info@powerhouse.com', joined: '2023-07-05' },
    { id: '5', name: 'Flex Zone', members: 67, revenue: 2010, status: 'inactive', plan: 'Basic', address: '654 Maple Dr', phone: '+1234567894', email: 'support@flexzone.com', joined: '2023-10-12' }
  ]);
  const gyms = gymsData;

  const handleEdit = (gym: Gym, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGym(gym);
    setFormState({
      name: gym.name,
      fiscalNumber: '',
      creatingDate: gym.joined,
      location: gym.address,
      ownerName: '',
      ownerPhone: gym.phone,
      ownerEmail: gym.email,
      numberOfCoaches: '',
      coachName: '',
      coachPhone: '',
      coachEmail: ''
    });
    setShowEditForm(true);
  };

  const handleDelete = (gymId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this gym? All coaches and members will be removed.')) {
      setGymsData(gymsData.filter(g => g.id !== gymId));
      alert('Gym deleted successfully!');
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGym) {
      setGymsData(gymsData.map(g => 
        g.id === selectedGym.id 
          ? { ...g, name: formState.name, address: formState.location, phone: formState.ownerPhone, email: formState.ownerEmail }
          : g
      ));
      alert('Gym updated successfully!');
      setShowEditForm(false);
      setSelectedGym(null);
      setFormState(formData);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newGym: Gym = {
      id: String(gymsData.length + 1),
      name: formState.name,
      members: 0,
      revenue: 0,
      status: 'active',
      plan: 'Basic',
      address: formState.location,
      phone: formState.ownerPhone,
      email: formState.ownerEmail,
      joined: formState.creatingDate || new Date().toISOString().split('T')[0]
    };
    setGymsData([...gymsData, newGym]);
    alert('Gym created successfully!');
    setShowAddForm(false);
    setFormState(formData);
  };

  const toggleGymStatus = (gymId: string, newStatus: string) => {
    setGymsData(gymsData.map(gym => {
      if (gym.id === gymId) {
        alert(`Gym "${gym.name}" is now ${newStatus}.\n\nAll coaches and members related to this gym are now ${newStatus}.`);
        return { ...gym, status: newStatus };
      }
      return gym;
    }));
  };

  const formData = {
    name: '',
    fiscalNumber: '',
    creatingDate: '',
    location: '',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    numberOfCoaches: '',
    coachName: '',
    coachPhone: '',
    coachEmail: ''
  };

  const [formState, setFormState] = useState(formData);

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Partner Gyms</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-[#10b981] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#a8e600] transition-colors"
          >
            <Plus size={20} />
            Add Gym
          </button>
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
          <Building2 className="text-blue-500 mb-2" size={24} />
          <div className="text-3xl font-bold">23</div>
          <div className="text-sm text-gray-400">Total Gyms</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <Building2 className="text-green-500 mb-2" size={24} />
          <div className="text-3xl font-bold">21</div>
          <div className="text-sm text-gray-400">Active Gyms</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <Building2 className="text-red-500 mb-2" size={24} />
          <div className="text-3xl font-bold">2</div>
          <div className="text-sm text-gray-400">Inactive Gyms</div>
        </div>
      </div>

      <div className="bg-[#242424] rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">All Partner Gyms</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4">Gym Name</th>
              <th className="text-left py-3 px-4">Members</th>
              <th className="text-left py-3 px-4">Revenue</th>
              <th className="text-left py-3 px-4">Plan</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {gyms.map(gym => (
              <tr 
                key={gym.id} 
                onClick={() => setSelectedGym(gym)}
                className="border-b border-gray-800 hover:bg-[#1A1A1A] cursor-pointer"
              >
                <td className="py-3 px-4 font-semibold">{gym.name}</td>
                <td className="py-3 px-4">{gym.members}</td>
                <td className="py-3 px-4">${gym.revenue.toLocaleString()}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    gym.plan === 'Premium' ? 'bg-[#10b981]/20 text-emerald-600' : 'bg-gray-700 text-gray-300'
                  }`}>
                    {gym.plan}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <select
                    value={gym.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleGymStatus(gym.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`px-2 py-1 rounded text-xs cursor-pointer outline-none ${
                      gym.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                    }`}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleEdit(gym, e)}
                      className="p-2 bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(gym.id, e)}
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

      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-[#242424] rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Add New Gym</h2>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Gym Name *</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({...formState, name: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fiscal Number</label>
                  <input
                    type="text"
                    value={formState.fiscalNumber}
                    onChange={(e) => setFormState({...formState, fiscalNumber: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Creating Date</label>
                  <input
                    type="date"
                    value={formState.creatingDate}
                    onChange={(e) => setFormState({...formState, creatingDate: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Location *</label>
                  <input
                    type="text"
                    required
                    value={formState.location}
                    onChange={(e) => setFormState({...formState, location: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">Owner Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Owner Name *</label>
                    <input
                      type="text"
                      required
                      value={formState.ownerName}
                      onChange={(e) => setFormState({...formState, ownerName: e.target.value})}
                      className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Owner Phone *</label>
                    <input
                      type="tel"
                      required
                      value={formState.ownerPhone}
                      onChange={(e) => setFormState({...formState, ownerPhone: e.target.value})}
                      className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm text-gray-400 mb-2">Owner Email *</label>
                  <input
                    type="email"
                    required
                    value={formState.ownerEmail}
                    onChange={(e) => setFormState({...formState, ownerEmail: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">Coach Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Number of Coaches</label>
                    <input
                      type="number"
                      value={formState.numberOfCoaches}
                      onChange={(e) => setFormState({...formState, numberOfCoaches: e.target.value})}
                      className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Coach Name</label>
                    <input
                      type="text"
                      value={formState.coachName}
                      onChange={(e) => setFormState({...formState, coachName: e.target.value})}
                      className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Coach Phone</label>
                    <input
                      type="tel"
                      value={formState.coachPhone}
                      onChange={(e) => setFormState({...formState, coachPhone: e.target.value})}
                      className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Coach Email</label>
                    <input
                      type="email"
                      value={formState.coachEmail}
                      onChange={(e) => setFormState({...formState, coachEmail: e.target.value})}
                      className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                    />
                  </div>
                </div>
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
                  className="flex-1 bg-[#10b981] text-black py-3 rounded-lg font-semibold hover:bg-[#a8e600] transition-colors"
                >
                  Create Gym Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditForm && selectedGym && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowEditForm(false)}>
          <div className="bg-[#242424] rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Edit Gym</h2>
              <button onClick={() => setShowEditForm(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Gym Name *</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({...formState, name: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Location *</label>
                  <input
                    type="text"
                    required
                    value={formState.location}
                    onChange={(e) => setFormState({...formState, location: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formState.ownerPhone}
                    onChange={(e) => setFormState({...formState, ownerPhone: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={formState.ownerEmail}
                    onChange={(e) => setFormState({...formState, ownerEmail: e.target.value})}
                    className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-[#10b981] outline-none"
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
                  className="flex-1 bg-[#10b981] text-black py-3 rounded-lg font-semibold hover:bg-[#a8e600] transition-colors"
                >
                  Update Gym
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedGym && !showEditForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedGym(null)}>
          <div className="bg-[#242424] rounded-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{selectedGym.name}</h2>
              <button onClick={() => setSelectedGym(null)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#1A1A1A] p-4 rounded-lg">
                <Users className="text-emerald-600 mb-2" size={20} />
                <div className="text-2xl font-bold">{selectedGym.members}</div>
                <div className="text-sm text-gray-400">Total Members</div>
              </div>
              <div className="bg-[#1A1A1A] p-4 rounded-lg">
                <DollarSign className="text-green-500 mb-2" size={20} />
                <div className="text-2xl font-bold">${selectedGym.revenue.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Monthly Revenue</div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Plan:</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  selectedGym.plan === 'Premium' ? 'bg-[#10b981]/20 text-emerald-600' : 'bg-gray-700 text-gray-300'
                }`}>
                  {selectedGym.plan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  selectedGym.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                }`}>
                  {selectedGym.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Address:</span>
                <span className="text-white">{selectedGym.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phone:</span>
                <span className="text-white">{selectedGym.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="text-white">{selectedGym.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Joined:</span>
                <span className="text-white">{selectedGym.joined}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

