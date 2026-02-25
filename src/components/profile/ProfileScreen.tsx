import React, { useState, useEffect } from 'react';
import { User, MapPin, Settings, ChevronRight, Camera } from 'lucide-react';
import { api } from '../../services/api';
interface ProfileScreenProps {
  onNavigate: (screen: 'gym' | 'settings') => void;
}
export function ProfileScreen({ onNavigate }: ProfileScreenProps) {
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{"name":"Moha"}');
  const userName = user.name || 'Moha';
  const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  const parsedUserId = Number(user?.id || 0);
  const userId = localUserId || parsedUserId;
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const createdAt = user?.created_at || user?.createdAt;

  const isValidImageDataUrl = (value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('data:image/') && value.includes(';base64,');

  const memberSinceText = (() => {
    if (!createdAt) return 'Member since -';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return 'Member since -';
    return `Member since ${date.getFullYear()}`;
  })();
  
  useEffect(() => {
    if (!userId) return;

    // Keep user-app storage keys aligned.
    if (!localUserId || localUserId !== userId) {
      localStorage.setItem('appUserId', String(userId));
      localStorage.setItem('userId', String(userId));
    }

    const fetchProfilePicture = async () => {
      try {
        const result = await api.getProfilePicture(userId);
        setProfilePicture(isValidImageDataUrl(result.profilePicture) ? result.profilePicture : null);
      } catch (error) {
        console.error('Failed to load profile picture:', error);
      }
    };
    fetchProfilePicture();
  }, [userId, localUserId]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && userId) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const previousPicture = profilePicture;
        setProfilePicture(base64);
        try {
          await api.updateProfilePicture(userId, base64);
        } catch (error) {
          console.error('Failed to save profile picture:', error);
          setProfilePicture(previousPicture);
          alert(error instanceof Error ? error.message : 'Could not save profile picture to database.');
        }
      };
      reader.readAsDataURL(file);
    } else if (file && !userId) {
      alert('No active user session found. Please log in again.');
    }
  };
  
  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4 pt-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-text-tertiary overflow-hidden">
            {profilePicture ? (
              <button
                type="button"
                className="w-full h-full"
                onClick={() => setIsPreviewOpen(true)}
              >
                <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
              </button>
            ) : (
              <User size={40} />
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-6 h-6 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-accent/80 transition-colors">
            <Camera size={12} className="text-white" />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{userName}</h1>
          <p className="text-text-secondary">{memberSinceText}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-3 text-center border border-white/5">
          <div className="text-xl font-bold text-white">142</div>
          <div className="text-[10px] text-text-secondary uppercase">
            Workouts
          </div>
        </div>
        <div className="bg-card rounded-xl p-3 text-center border border-white/5">
          <div className="text-xl font-bold text-white">12.4t</div>
          <div className="text-[10px] text-text-secondary uppercase">
            Volume
          </div>
        </div>
        <div className="bg-card rounded-xl p-3 text-center border border-white/5">
          <div className="text-xl font-bold text-white">42</div>
          <div className="text-[10px] text-text-secondary uppercase">
            Streak
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => onNavigate('gym')}
          className="w-full bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors">

          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <MapPin size={20} />
            </div>
            <div className="text-left">
              <div className="font-medium text-white">Gym Access</div>
              <div className="text-xs text-text-secondary">
                Iron Paradise Gym
              </div>
            </div>
          </div>
          <ChevronRight size={20} className="text-text-tertiary" />
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className="w-full bg-card rounded-xl p-4 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors">

          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg text-text-secondary">
              <Settings size={20} />
            </div>
            <div className="text-left">
              <div className="font-medium text-white">Settings</div>
              <div className="text-xs text-text-secondary">
                Preferences & Account
              </div>
            </div>
          </div>
          <ChevronRight size={20} className="text-text-tertiary" />
        </button>
      </div>

      {isPreviewOpen && profilePicture && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-sm px-3 py-1 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setIsPreviewOpen(false)}
          >
            Close
          </button>
          <img
            src={profilePicture}
            alt="Profile preview"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>);

}
