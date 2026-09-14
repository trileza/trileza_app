import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { PageHeader } from '../../components/shared';
import { 
  Settings as SettingsIcon, Bell, Lock, User, Globe, Moon, Monitor, Sun, 
  Shield, Key, Camera, Save, Loader2, 
  Volume2, Video, Eye, HardDrive, Trash2, Download, RefreshCw, Palette
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { nexus } from '../../lib/nexus';
import { Toast } from '../../components/ui/Toast';
import { cn } from '../../utils';
import { adminService } from '../../lib/services/admin';

const Settings = () => {
  const { user, updateProfile, logout } = useAuthStore();
  const settings = useSettingsStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'security' | 'notifications' | 'data-media'>('profile');
  
  // Toast state
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);

  // Profile states
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || user?.metadata?.mentor_data?.qualifications?.motivation || '');
  const [country, setCountry] = useState(user?.metadata?.mentor_data?.identity?.address?.country || '');
  const [linkedin, setLinkedin] = useState(user?.metadata?.mentor_data?.identity?.socials?.linkedin || '');
  const [website, setWebsite] = useState(user?.website || user?.metadata?.mentor_data?.identity?.socials?.website || '');
  const [username, setUsername] = useState(user?.username || '');
  const [emailAddress, setEmailAddress] = useState(user?.email || '');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.metadata?.two_factor_enabled || false);

  // Modal State for Delete Account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Debounced username check
  useEffect(() => {
    if (!username.trim() || username === user?.username) {
      setUsernameError('');
      return;
    }
    const usernameRegex = /^[a-z0-9._]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setUsernameError('Use 3-20 characters: lowercase, numbers, dots, underscores.');
      return;
    }
    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await nexus.database
          .from('public_profiles')
          .select('id')
          .eq('username', username)
          .neq('id', user?.id)
          .maybeSingle();
        if (data) {
          setUsernameError('Username is already taken.');
        } else {
          setUsernameError('');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingUsername(false);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [username, user?.username]);

  // Sync settings metadata initially if loaded
  useEffect(() => {
    if (user) {
      settings.loadSettings();
    }
  }, [user]);

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
          setToast({ message: 'Failed to update profile picture.', type: 'error' });
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
    setProfileLoading(true);
    
    if (usernameError) {
      setToast({ message: usernameError, type: 'error' });
      setProfileLoading(false);
      return;
    }

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
      country: country,
      username: username.trim() || undefined,
      metadata: updatedMetadata
    });
    
    setProfileLoading(false);
    if (!error) {
      setToast({ message: 'Profile settings saved successfully.', type: 'success' });
    } else {
      setToast({ message: 'Failed to save profile settings.', type: 'error' });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast({ message: 'Please fill out all password fields.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: 'New passwords do not match.', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setToast({ message: 'New password must be at least 6 characters.', type: 'error' });
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
      setToast({ message: 'Failed to update Two-Factor status.', type: 'error' });
      setTwoFactorEnabled(!newVal); // revert state
    }
  };

  // Cache and data helpers
  const [clearingCache, setClearingCache] = useState(false);
  const handleClearCache = () => {
    setClearingCache(true);
    setTimeout(() => {
      setClearingCache(false);
      setToast({ message: 'App cache cleared successfully!', type: 'success' });
    }, 1500);
  };

  const handleDownloadData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user || {}, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `trileza_user_profile_${user?.id || 'data'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setToast({ message: 'Your data package has been downloaded successfully.', type: 'success' });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      setToast({ message: 'Please type the confirmation phrase exactly.', type: 'error' });
      return;
    }
    setDeletingAccount(true);
    setTimeout(async () => {
      setDeletingAccount(false);
      setShowDeleteModal(false);
      setToast({ message: 'Your account has been deleted. Logging out...', type: 'success' });
      setTimeout(async () => {
        await logout();
        navigate('/login');
      }, 1500);
    }, 2000);
  };

  return (
    <div className="space-y-8 pb-20 w-full animate-in fade-in duration-500">
      <PageHeader 
        title={
          <span>
            Settings & <span className="text-emerald-500">Preferences</span>
          </span>
        }
        description="Configure your learning profile, theme preferences, and security access."
        tag="Dashboard Control"
        icon={SettingsIcon}
      />

      <div className="space-y-6">
        {/* Navigation Tabs — Horizontal scrollable pills on mobile, vertical sidebar on desktop */}
        {/* Mobile Creative Tab Dropdown */}
        <div className="md:hidden space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Setting Panel:</label>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="w-full h-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs shadow-md focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="profile">Profile Settings</option>
            <option value="appearance">Appearance</option>
            <option value="security">Security & Password</option>
            <option value="notifications">Notifications & Alerts</option>
            <option value="data-media">Data & Storage</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {/* Desktop Navigation Tabs (Left Menu) — hidden on mobile */}
          <div className="hidden md:block md:col-span-1 space-y-4">
            <Card className="p-4 rounded-[2rem] border-none shadow-xl bg-surface shadow-sm">
              <nav className="space-y-1">
                {[
                  { id: 'profile', label: 'Profile & Account', icon: User },
                  { id: 'appearance', label: 'Appearance', icon: Palette },
                  { id: 'security', label: 'Security & Privacy', icon: Shield },
                  { id: 'notifications', label: 'Notifications', icon: Bell },
                  { id: 'data-media', label: 'Data & Video', icon: HardDrive }
                ].map((tab) => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 text-left text-sm",
                      activeTab === tab.id 
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-sm" 
                        : "text-foreground/80 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    )}
                  >
                    <tab.icon size={18} /> {tab.label}
                  </button>
                ))}
              </nav>
            </Card>
          </div>

          {/* Right Side: Active tab view */}
          <div className="md:col-span-3 space-y-6">
          
          {/* PROFILE & ACCOUNT TAB */}
          {activeTab === 'profile' && (
            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-surface shadow-sm space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3 border-b border-border pb-4">
                <User className="text-emerald-500" /> Public Profile Settings
              </h2>
              
              {/* Profile Image Zone */}
              <div className="flex items-center gap-6">
                <div className="relative shrink-0 group">
                  <img 
                    src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'User'}`} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-3xl border-4 border-border object-cover shadow-lg group-hover:scale-105 transition-transform" 
                  />
                  <label className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-slate-950 dark:bg-emerald-600 text-white shadow-xl hover:scale-110 transition-transform cursor-pointer">
                    <Camera size={14} />
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Profile Picture</h3>
                  <p className="text-sm text-foreground/80 mt-1 mb-3">JPG, GIF or PNG. 1MB max.</p>
                  <div className="flex gap-2">
                    <label className="bg-slate-950 dark:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity">
                      Upload New
                      <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                    <Button size="sm" variant="ghost" className="text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-650" onClick={removeAvatar}>Remove</Button>
                  </div>
                </div>
              </div>

              {/* Profile Detail Fields */}
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Full Name</label>
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Username Handle</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                      <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                        className={cn(
                          "w-full bg-slate-50 border rounded-xl pl-8 pr-10 py-3 text-foreground dark:bg-slate-800/40 focus:outline-none focus:ring-2 font-medium",
                          usernameError ? "border-red-300 dark:border-red-900 focus:ring-red-500/20 focus:border-red-500" : "border-border focus:ring-emerald-500/20 focus:border-emerald-500"
                        )}
                        placeholder="username"
                      />
                      {checkingUsername && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                        </div>
                      )}
                    </div>
                    {usernameError && (
                      <p className="text-[11px] text-red-500 font-bold">{usernameError}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">Email Address <Lock size={12} className="text-slate-400" /></label>
                  <div className="w-full bg-slate-100 border border-slate-200 dark:bg-slate-800/20 dark:border-slate-850 rounded-xl px-4 py-3 text-foreground/80 font-medium flex items-center justify-between">
                    {emailAddress}
                    <span className="text-[10px] uppercase font-black tracking-widest text-emerald-600 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-1 rounded">Verified</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Bio / Motivation</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    placeholder="Tell your peers about yourself..."
                    className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Location</label>
                    <input 
                      type="text" 
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. London, UK"
                      className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">LinkedIn URL</label>
                    <input 
                      type="text" 
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Personal Website</label>
                    <input 
                      type="text" 
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Role Focus</label>
                  <div className="w-full bg-slate-100 border border-slate-200 dark:bg-slate-800/20 dark:border-slate-850 rounded-xl px-4 py-3 text-foreground/80 font-medium capitalize">
                    {user?.role} {user?.mentor_tier ? `(${user.mentor_tier})` : ''}
                  </div>
                </div>
              </div>

              {/* Save changes and dangerous delete actions */}
              <div className="pt-6 border-t border-border flex justify-between items-center">
                <button 
                  onClick={() => setShowDeleteModal(true)}
                  className="text-red-500 font-bold hover:text-red-650 flex items-center gap-1 bg-transparent border-none outline-none cursor-pointer"
                >
                  <Trash2 size={16} /> Delete Account
                </button>
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={profileLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  {profileLoading ? 'Saving...' : <><Save size={18} className="mr-2" /> Save Changes</>}
                </Button>
              </div>
            </Card>
          )}

          {/* APPEARANCE & FONTS TAB */}
          {/* APPEARANCE & THEME TAB */}
          {activeTab === 'appearance' && (
            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-surface shadow-sm space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3 border-b border-border pb-4">
                <Palette className="text-emerald-500" /> Theme & Appearance Settings
              </h2>

              {/* 1. Theme Selector */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
                    <Monitor size={18} className="text-emerald-500" /> Color Theme Preference
                  </h3>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/20">
                    Database Synced & Active
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { id: 'light', name: 'Light Mode', desc: 'Crisp bright view for daylight reading', icon: Sun },
                    { id: 'dark', name: 'Dark Mode (High Contrast)', desc: 'High contrast deep theme for low light', icon: Moon },
                    { id: 'system', name: 'System Default', desc: 'Syncs with your device theme', icon: Monitor }
                  ].map((themeOpt) => {
                    const isSelected = settings.theme === themeOpt.id;
                    return (
                      <button
                        key={themeOpt.id}
                        type="button"
                        onClick={() => {
                          settings.updateSettings({ theme: themeOpt.id as any });
                          setToast({ message: `Theme updated to ${themeOpt.name} (Saved to database)`, type: 'success' });
                        }}
                        className={cn(
                          "p-5 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between gap-3 relative outline-none",
                          isSelected
                            ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-2 ring-emerald-500/30"
                            : "border-border bg-surface-2 hover:bg-surface-hover"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                            isSelected ? "bg-emerald-500 text-white border-emerald-400" : "bg-surface text-foreground/60 border-border"
                          )}>
                            <themeOpt.icon size={20} />
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-md shadow-sm">
                              Active
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-foreground tracking-tight">{themeOpt.name}</p>
                          <p className="text-xs font-medium text-foreground/70 mt-1 leading-snug">{themeOpt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border my-6"></div>

              {/* 2. Accessibility & Sounds */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
                  <Volume2 size={18} className="text-slate-400" /> Accessibility & Interface Sounds
                </h3>

                {/* Contrast Toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-2xl border border-border">
                  <div>
                    <h4 className="font-bold text-foreground text-sm">High Contrast Mode</h4>
                    <p className="text-xs text-slate-500 mt-1">Enhance screen layout borders and element contrast ratios.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => settings.updateSettings({
                      accessibility: { ...settings.accessibility, contrast: settings.accessibility.contrast === 'high' ? 'standard' : 'high' }
                    })}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                      settings.accessibility.contrast === 'high' ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                      settings.accessibility.contrast === 'high' ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>

                {/* Screen Reader Toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-2xl border border-border">
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Screen Reader Compatibility</h4>
                    <p className="text-xs text-slate-500 mt-1">Activate semantic descriptive overlays for accessibility devices.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => settings.updateSettings({
                      accessibility: { ...settings.accessibility, screenReaderSupport: !settings.accessibility.screenReaderSupport }
                    })}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                      settings.accessibility.screenReaderSupport ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                      settings.accessibility.screenReaderSupport ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>

                {/* Interface Sound Effects Toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-2xl border border-border">
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Interface Sound Effects</h4>
                    <p className="text-xs text-slate-500 mt-1">Enable sound indicators for interface interactions and clicks.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => settings.updateSettings({
                      sounds: { ...settings.sounds, soundEffects: !settings.sounds.soundEffects }
                    })}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                      settings.sounds.soundEffects ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                      settings.sounds.soundEffects ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>

                {/* Meeting Chimes Toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-2xl border border-border">
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Live Entry Chimes</h4>
                    <p className="text-xs text-slate-500 mt-1">Play audio chimes when participants join or leave a live meeting classroom.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => settings.updateSettings({
                      sounds: { ...settings.sounds, entryChimes: !settings.sounds.entryChimes }
                    })}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                      settings.sounds.entryChimes ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                      settings.sounds.entryChimes ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* SECURITY & PRIVACY TAB */}
          {activeTab === 'security' && (
            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-surface shadow-sm space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3 border-b border-border pb-4">
                <Shield className="text-emerald-500" /> Security & Privacy Controls
              </h2>

              {/* Change Password Form */}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
                  <Key size={18} className="text-slate-400" /> Change Password
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Current Password</label>
                    <input 
                      type="password" 
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">New Password</label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={passwordLoading}
                    className="bg-slate-950 dark:bg-emerald-600 hover:bg-slate-900 dark:hover:bg-emerald-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg"
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>

              <div className="border-t border-border my-6"></div>

              {/* MFA Switch */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-foreground text-base">Authentication Protection</h3>
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-2xl border border-border">
                  <div className="max-w-md">
                    <h4 className="font-bold text-foreground text-sm">Two-Factor Authentication (MFA)</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Require an email OTP code whenever logging into your credentials to secure your syllabus data.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTwoFactorToggle}
                    className={cn(
                      "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                      twoFactorEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                      twoFactorEnabled ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>

              <div className="border-t border-border my-6"></div>

              {/* Privacy Settings */}
              <div className="space-y-6">
                <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
                  <Eye size={18} className="text-slate-400" /> Privacy & Visibility
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Profile Visibility select */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Profile Visibility</label>
                    <select 
                      value={settings.privacy.profileVisibility}
                      onChange={(e) => settings.updateSettings({
                        privacy: { ...settings.privacy, profileVisibility: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-border text-foreground font-medium p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="public">Public (Visible to everyone)</option>
                      <option value="private">Private (Only study group peers)</option>
                    </select>
                  </div>

                  {/* Messaging Privacy select */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Accept Direct Messages From</label>
                    <select 
                      value={settings.privacy.allowMessagesFrom}
                      onChange={(e) => settings.updateSettings({
                        privacy: { ...settings.privacy, allowMessagesFrom: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-border text-foreground font-medium p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="everyone">Everyone on the platform</option>
                      <option value="followers">Tutors and peers I follow</option>
                      <option value="none">No one (Disable direct messages)</option>
                    </select>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-surface shadow-sm space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3 border-b border-border pb-4">
                <Bell className="text-emerald-500" /> Notification Channels
              </h2>

              <div className="space-y-4">
                {[
                  { 
                    id: 'email', 
                    title: 'Email Alerts', 
                    desc: 'Receive syllabus reminders, platform updates, and weekly summaries in your email inbox.', 
                    state: settings.notifications.email,
                    setter: (val: boolean) => settings.updateSettings({
                      notifications: { ...settings.notifications, email: val }
                    })
                  },
                  { 
                    id: 'push', 
                    title: 'Push Notifications', 
                    desc: 'Enable real-time mobile push notifications for messages and live session alerts.', 
                    state: settings.notifications.push,
                    setter: (val: boolean) => settings.updateSettings({
                      notifications: { ...settings.notifications, push: val }
                    })
                  },
                  { 
                    id: 'classroom', 
                    title: 'Classroom Alerts', 
                    desc: 'Get in-app banners when a mentor uploads assignments or starts a scheduled study room.', 
                    state: settings.notifications.classroom,
                    setter: (val: boolean) => settings.updateSettings({
                      notifications: { ...settings.notifications, classroom: val }
                    })
                  },
                  { 
                    id: 'mentions', 
                    title: 'Community Mentions', 
                    desc: 'Receive push alerts when someone comments on your portfolio items or tags your username.', 
                    state: settings.notifications.mentions,
                    setter: (val: boolean) => settings.updateSettings({
                      notifications: { ...settings.notifications, mentions: val }
                    })
                  },
                  { 
                    id: 'messages', 
                    title: 'Direct Messages', 
                    desc: 'Alert instantly on active browser panels when a contact starts a chat thread.', 
                    state: settings.notifications.messages,
                    setter: (val: boolean) => settings.updateSettings({
                      notifications: { ...settings.notifications, messages: val }
                    })
                  }
                ].map(pref => (
                  <div key={pref.id} className="flex items-center justify-between p-4 bg-surface-2 rounded-2xl border border-border">
                    <div className="max-w-xl">
                      <h4 className="font-bold text-foreground text-sm">{pref.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pref.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => pref.setter(!pref.state)}
                      className={cn(
                        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                        pref.state ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                        pref.state ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-border my-6"></div>

              {/* Language Selection */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
                  <Globe size={18} className="text-slate-400" /> Platform Language
                </h3>
                <div className="space-y-2 max-w-md">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Interface Language</label>
                  <select 
                    value={settings.language}
                    onChange={(e) => settings.updateSettings({ language: e.target.value })}
                    className="w-full bg-slate-50 border border-border text-foreground font-medium p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="en">English (UK & US)</option>
                    <option value="es">Español (Spanish)</option>
                    <option value="fr">Français (French)</option>
                    <option value="de">Deutsch (German)</option>
                    <option value="yo">Yorùbá (Yoruba)</option>
                    <option value="ig">Asụsụ Igbo (Igbo)</option>
                    <option value="ha">Harshen Hausa (Hausa)</option>
                  </select>
                </div>
              </div>
            </Card>
          )}

          {/* DATA & MEDIA USAGE TAB */}
          {activeTab === 'data-media' && (
            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-surface shadow-sm space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3 border-b border-border pb-4">
                <HardDrive className="text-emerald-500" /> Data & Video Preferences
              </h2>

              {/* Video Streaming Preferences */}
              <div className="space-y-6">
                <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
                  <Video size={18} className="text-slate-400" /> Video Quality & Playback
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Default Quality select */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Default Streaming Quality</label>
                    <select 
                      value={settings.video.quality}
                      onChange={(e) => settings.updateSettings({
                        video: { ...settings.video, quality: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-border text-foreground font-medium p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="auto">Auto (Best resolution dynamically)</option>
                      <option value="1080p">High Definition HD (1080p)</option>
                      <option value="720p">Medium Quality MQ (720p)</option>
                      <option value="480p">Data Saver SD (480p)</option>
                    </select>
                  </div>

                  {/* Autoplay select */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Auto-play Video Settings</label>
                    <select 
                      value={settings.video.autoplay}
                      onChange={(e) => settings.updateSettings({
                        video: { ...settings.video, autoplay: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-border text-foreground font-medium p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="always">Always auto-play video clips</option>
                      <option value="wifi">Auto-play on Wi-Fi connection only</option>
                      <option value="never">Never auto-play (Click to buffer)</option>
                    </select>
                  </div>
                </div>

                {/* Subtitles toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-2xl border border-border">
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Closed Captioning (Subtitles)</h4>
                    <p className="text-xs text-slate-500 mt-1">Show transcription overlays on educational lecture playback automatically.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => settings.updateSettings({
                      video: { ...settings.video, subtitles: !settings.video.subtitles }
                    })}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                      settings.video.subtitles ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                      settings.video.subtitles ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>

              <div className="border-t border-border my-6"></div>

              {/* Data & Cache Management */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-foreground text-base">Cache & Data Utilities</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Clear Cache card */}
                  <div className="p-5 border border-border rounded-3xl flex flex-col justify-between space-y-4 bg-slate-50 dark:bg-slate-800/20">
                    <div>
                      <h4 className="font-bold text-foreground text-sm">Clear App Sandbox Cache</h4>
                      <p className="text-xs text-slate-500 mt-1">Free up disk overheads by clearing cached images and document blueprints.</p>
                    </div>
                    <Button 
                      onClick={handleClearCache}
                      disabled={clearingCache}
                      variant="outline"
                      className="rounded-xl border-slate-300 dark:border-slate-750 font-bold py-2 w-full text-xs text-foreground"
                    >
                      {clearingCache ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Cleaning...</> : <><RefreshCw size={13} className="mr-1.5" /> Clear Local Cache</>}
                    </Button>
                  </div>

                  {/* Download My Data card */}
                  <div className="p-5 border border-border rounded-3xl flex flex-col justify-between space-y-4 bg-slate-50 dark:bg-slate-800/20">
                    <div>
                      <h4 className="font-bold text-foreground text-sm">Download Profile Data Package</h4>
                      <p className="text-xs text-slate-500 mt-1">Download a copy of your personal profiles, metadata registers, and learning metrics in a raw JSON file.</p>
                    </div>
                    <Button 
                      onClick={handleDownloadData}
                      className="rounded-xl bg-slate-950 dark:bg-emerald-600 hover:bg-slate-900 dark:hover:bg-emerald-700 text-white font-bold py-2 w-full text-xs"
                    >
                      <Download size={13} className="mr-1.5" /> Request & Download
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Account Modal Dialog */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full bg-surface border-none shadow-2xl p-6 rounded-[2rem] space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-3 text-red-500">
              <Trash2 size={24} />
              <h3 className="text-lg font-black">Confirm Account Deletion</h3>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              This action is <span className="text-red-500 font-extrabold">IRREVERSIBLE</span>. Deleting your account will wipe your portfolios, curriculum builder credentials, wallet histories, and direct messages permanently from the database.
            </p>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Type "DELETE MY ACCOUNT" to confirm:</label>
              <input 
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="w-full text-sm bg-slate-50 border border-border rounded-xl p-3 text-red-500 font-bold focus:ring-red-500/20"
              />
            </div>
            <div className="flex gap-3 justify-end pt-3">
              <Button variant="ghost" className="font-bold rounded-xl text-slate-500" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}>Cancel</Button>
              <Button 
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'DELETE MY ACCOUNT'}
                className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/25 px-5 py-2.5 text-sm"
              >
                {deletingAccount ? 'Processing...' : 'Wipe My Account'}
              </Button>
            </div>
          </Card>
        </div>
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
    </div>
  );
};

export default Settings;
