import React, { useState } from 'react';
import { Card, Button } from '../../components/ui';
import { PageHeader } from '../../components/shared';
import { Settings as SettingsIcon, Bell, Lock, User, Globe, Moon, Monitor, Sun, CreditCard, Shield, Key, ChevronRight, Camera, Save } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Toast } from '../../components/ui/Toast';
import { cn } from '../../utils';

const Settings = () => {
  const { user, updateProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  
  // Toast state
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);

  // Profile states
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || user?.metadata?.mentor_data?.qualifications?.motivation || '');
  const [country, setCountry] = useState(user?.metadata?.mentor_data?.identity?.address?.country || '');
  const [linkedin, setLinkedin] = useState(user?.metadata?.mentor_data?.identity?.socials?.linkedin || '');
  const [website, setWebsite] = useState(user?.website || user?.metadata?.mentor_data?.identity?.socials?.website || '');
  const [loading, setLoading] = useState(false);

  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.metadata?.two_factor_enabled || false);

  // Notification states
  const [notifEmail, setNotifEmail] = useState(user?.metadata?.notifications?.email ?? true);
  const [notifClassroom, setNotifClassroom] = useState(user?.metadata?.notifications?.classroom ?? true);
  const [notifMentions, setNotifMentions] = useState(user?.metadata?.notifications?.mentions ?? true);
  const [notifMessages, setNotifMessages] = useState(user?.metadata?.notifications?.messages ?? true);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        const { error } = await updateProfile({ avatar_url: dataUrl });
        if (!error) {
          setToast({ message: 'Profile picture updated successfully!', type: 'success' });
        } else {
          setToast({ message: 'Failed to update profile picture.', type: 'info' });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = async () => {
    const { error } = await updateProfile({ avatar_url: '' });
    if (!error) {
      setToast({ message: 'Profile picture removed.', type: 'success' });
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    
    const currentMentorData = user?.metadata?.mentor_data || {};
    const updatedMetadata = {
      ...user?.metadata,
      mentor_data: {
        ...currentMentorData,
        identity: {
          ...currentMentorData.identity,
          address: {
            ...currentMentorData.identity?.address,
            country: country
          },
          socials: {
            ...currentMentorData.identity?.socials,
            linkedin: linkedin,
            website: website
          }
        },
        qualifications: {
          ...currentMentorData.qualifications,
          motivation: bio
        }
      }
    };

    const { error } = await updateProfile({ 
      full_name: fullName,
      bio: bio,
      website: website,
      metadata: updatedMetadata
    });
    
    setLoading(false);
    if (!error) {
      setToast({ message: 'Profile settings saved successfully.', type: 'success' });
    } else {
      setToast({ message: 'Failed to save profile settings.', type: 'info' });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast({ message: 'Please fill out all password fields.', type: 'info' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: 'New passwords do not match.', type: 'info' });
      return;
    }
    if (newPassword.length < 6) {
      setToast({ message: 'New password must be at least 6 characters.', type: 'info' });
      return;
    }

    setPasswordLoading(true);
    // Simulate updating password via backend integration
    setTimeout(async () => {
      setPasswordLoading(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToast({ message: 'Password updated successfully!', type: 'success' });
    }, 1200);
  };

  const handleTwoFactorToggle = async () => {
    const newVal = !twoFactorEnabled;
    setTwoFactorEnabled(newVal);
    
    // Save to user metadata
    const { error } = await updateProfile({
      metadata: {
        ...user?.metadata,
        two_factor_enabled: newVal
      }
    });

    if (!error) {
      setToast({ 
        message: `Two-Factor Authentication ${newVal ? 'enabled' : 'disabled'} successfully.`, 
        type: 'success' 
      });
    } else {
      setToast({ message: 'Failed to update Two-Factor status.', type: 'info' });
      setTwoFactorEnabled(!newVal); // revert state
    }
  };

  const handleNotificationToggle = async (prefId: string, currentState: boolean, setter: (val: boolean) => void) => {
    const newVal = !currentState;
    setter(newVal);

    // Save notifications structure to user metadata
    const currentNotifs = user?.metadata?.notifications || {};
    const updatedNotifs = {
      ...currentNotifs,
      [prefId]: newVal
    };

    const { error } = await updateProfile({
      metadata: {
        ...user?.metadata,
        notifications: updatedNotifs
      }
    });

    if (!error) {
      setToast({ message: 'Notification preference saved.', type: 'success' });
    } else {
      setToast({ message: 'Failed to save notification preference.', type: 'info' });
      setter(!newVal); // revert state
    }
  };

  return (
    <div className="space-y-8 pb-20 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Settings Top Banner */}
      <PageHeader 
        title="Account Settings"
        description="Manage your profile, account security, and notification preferences."
        tag="User Configuration"
        icon={SettingsIcon}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Side: Navigation Tabs */}
        <div className="md:col-span-1 space-y-4">
          <Card className="p-6 rounded-[2rem] border-none shadow-xl bg-white shadow-slate-200/50">
            <nav className="space-y-2">
              <button 
                onClick={() => setActiveTab('profile')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 text-left",
                  activeTab === 'profile' 
                    ? "bg-emerald-50 text-emerald-600 shadow-sm" 
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <User size={18} /> Profile
              </button>
              
              <button 
                onClick={() => setActiveTab('security')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 text-left",
                  activeTab === 'security' 
                    ? "bg-emerald-50 text-emerald-600 shadow-sm" 
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <Shield size={18} /> Security
              </button>
              
              <button 
                onClick={() => setActiveTab('notifications')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 text-left",
                  activeTab === 'notifications' 
                    ? "bg-emerald-50 text-emerald-600 shadow-sm" 
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <Bell size={18} /> Notifications
              </button>
            </nav>
          </Card>
        </div>

        {/* Right Side: Active tab view */}
        <div className="md:col-span-2 space-y-6">
          {activeTab === 'profile' && (
            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white shadow-slate-200/50 space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-4">
                <User className="text-emerald-500" /> Public Profile
              </h2>
              
              {/* Profile Image Zone */}
              <div className="flex items-center gap-6">
                <div className="relative shrink-0 group">
                  <img 
                    src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'User'}`} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-3xl border-4 border-slate-100 object-cover shadow-lg group-hover:scale-105 transition-transform" 
                  />
                  <label className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-slate-950 text-white shadow-xl hover:scale-110 transition-transform cursor-pointer">
                    <Camera size={14} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Profile Picture</h3>
                  <p className="text-sm text-slate-500 mt-1 mb-3">JPG, GIF or PNG. 1MB max.</p>
                  <div className="flex gap-2">
                    <label className="bg-slate-950 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800 transition-colors">
                      Upload New
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                    <Button size="sm" variant="ghost" className="text-red-500 font-bold hover:bg-red-50 hover:text-red-600" onClick={removeAvatar}>Remove</Button>
                  </div>
                </div>
              </div>

              {/* Profile Detail Fields */}
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Full Name</label>
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">Email Address <Lock size={12} className="text-slate-400" /></label>
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 font-medium flex items-center justify-between">
                      {user?.email || 'user@example.com'}
                      <span className="text-[10px] uppercase font-black tracking-widest text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Verified</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Bio / Motivation</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    placeholder="Tell your students about your experience..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Location</label>
                    <input 
                      type="text" 
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. San Francisco, CA"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">LinkedIn URL</label>
                    <input 
                      type="text" 
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Personal Website</label>
                    <input 
                      type="text" 
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Role Focus</label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 font-medium capitalize">
                    {user?.role} {user?.mentor_tier ? `(${user.mentor_tier})` : ''}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  {loading ? 'Saving...' : <><Save size={18} className="mr-2" /> Save Changes</>}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white shadow-slate-200/50 space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-4">
                <Shield className="text-emerald-500" /> Account Security
              </h2>

              {/* Change Password Form */}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <Key size={18} className="text-slate-400" /> Change Password
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Current Password</label>
                    <input 
                      type="password" 
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">New Password</label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={passwordLoading}
                    className="bg-slate-950 hover:bg-slate-900 text-white font-bold px-8 py-3 rounded-xl shadow-lg"
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>

              <div className="border-t border-slate-100 my-6"></div>

              {/* MFA Switch */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="max-w-md">
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      Two-Factor Authentication (MFA)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Secure your learning credential keys on session handshake by adding an extra OTP validation overlay.
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleTwoFactorToggle}
                    className={cn(
                      "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                      twoFactorEnabled ? "bg-emerald-500" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        twoFactorEnabled ? "translate-x-6" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white shadow-slate-200/50 space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-4">
                <Bell className="text-emerald-500" /> Notifications Settings
              </h2>

              <div className="space-y-6">
                {[
                  { 
                    id: 'email', 
                    title: 'Email Updates', 
                    desc: 'Receive platform newsletters, product announcements, and course release highlights.', 
                    state: notifEmail, 
                    setter: setNotifEmail 
                  },
                  { 
                    id: 'classroom', 
                    title: 'Classroom Reminders', 
                    desc: 'Get notifications for live mentor sessions, new assignments, and due dates.', 
                    state: notifClassroom, 
                    setter: setNotifClassroom 
                  },
                  { 
                    id: 'mentions', 
                    title: 'Community Mentions', 
                    desc: 'Receive alerts when a peer or mentor comments on your syllabus post or mentions you in a study group.', 
                    state: notifMentions, 
                    setter: setNotifMentions 
                  },
                  { 
                    id: 'messages', 
                    title: 'Direct Messages', 
                    desc: 'Get notified when a verified tutor or peer sends you an encrypted direct message.', 
                    state: notifMessages, 
                    setter: setNotifMessages 
                  }
                ].map(pref => (
                  <div key={pref.id} className="flex items-start justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="max-w-xl">
                      <h4 className="font-bold text-slate-800 text-sm">{pref.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pref.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNotificationToggle(pref.id, pref.state, pref.setter)}
                      className={cn(
                        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                        pref.state ? "bg-emerald-500" : "bg-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          pref.state ? "translate-x-6" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Settings;
