import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { Card, Button } from '../../components/ui';
import { PageHeader } from '../../components/shared';
import { 
  User, 
  Briefcase, 
  Globe, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  GraduationCap as GradIcon,
  Camera,
  Save
} from 'lucide-react';
import { cn, executeWithAutoRefresh } from '../../utils';

interface ExpertiseItem {
  id: number;
  type: string;
  desc: string;
  icon: string;
}

const EditProfile: React.FC = () => {
  const { user, updateProfile, activeRole } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentRole = activeRole || resolveActiveRole(user) || 'mentee';
  const isMentor = currentRole === 'mentor' || currentRole === 'tutor';

  // Form states
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [website, setWebsite] = useState('');
  const [expertise, setExpertise] = useState<ExpertiseItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize form with current profile data
  useEffect(() => {
    if (user) {
      setName(user.full_name || '');
      setBio(user.bio || '');
      setAvatar(user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`);
      setWebsite((user as any).website || '');
      setExpertise((user as any).expertise || []);
    }
  }, [user]);

  // Image Upload handler to convert file to Base64 data URL
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Image file size must be less than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Expertise List handlers (for Mentors)
  const addExpertise = () => {
    setExpertise(prev => [
      ...prev, 
      { id: Date.now(), type: 'New Role / Achievement', desc: 'Detail your achievements, degree, or professional history.', icon: 'briefcase' }
    ]);
  };

  const removeExpertise = (id: number) => {
    setExpertise(prev => prev.filter(item => item.id !== id));
  };

  const updateExpertiseItem = (id: number, field: keyof ExpertiseItem, value: any) => {
    setExpertise(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Full Name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const updates: any = {
        full_name: name,
        bio: bio,
        avatar_url: avatar
      };

      if (isMentor) {
        updates.website = website;
        updates.expertise = expertise;
      }

      const { error } = await executeWithAutoRefresh(() => updateProfile(updates));
      if (error) {
        setErrorMsg('Failed to update profile: ' + error);
      } else {
        // Go back to the dashboard/profile page
        navigate('/');
      }
    } catch (err: any) {
      setErrorMsg('An unexpected error occurred: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500 font-sans">
      <div className="flex items-center gap-4">
        <Button 
          type="button"
          variant="ghost" 
          className="p-2 gap-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl cursor-pointer" 
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={18} /> Back
        </Button>
      </div>

      <PageHeader 
        title={
          <span>
            Edit <span className="text-emerald-500">Profile</span>
          </span>
        }
        description="Modify your public account information, avatar representation, and expertise credentials."
        tag="Profile Customization"
        icon={User}
      />

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Main Form details */}
        <Card className="lg:col-span-8 p-6 sm:p-8 rounded-[2.5rem] border-none shadow-xl bg-surface space-y-6 animate-in duration-500">
          <div className="space-y-2 border-b border-border pb-4">
            <h3 className="text-lg font-bold text-foreground">General Credentials</h3>
            <p className="text-xs text-secondary-text">These details are shown publicly on your profile page.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-secondary-text ml-1">Full Name</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-secondary-text ml-1">Bio Description</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Introduce yourself to the community..."
                rows={4}
                className="w-full bg-background border border-border rounded-xl p-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none leading-relaxed"
              />
            </div>

            {isMentor && (
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-secondary-text ml-1">Personal Portfolio / Website</label>
                <div className="flex items-center bg-background border border-border rounded-xl px-4 py-3 gap-2">
                  <Globe size={16} className="text-secondary-text" />
                  <input 
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="w-full text-sm text-foreground outline-none bg-transparent font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* MENTOR ONLY: EXPERIENCE & EXPERTISE SECTION */}
          {isMentor && (
            <div className="space-y-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Work History & Accomplishments</h3>
                  <p className="text-xs text-secondary-text">Outline your career journey and credentials.</p>
                </div>
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={addExpertise}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 font-bold text-xs h-9 px-4 cursor-pointer"
                >
                  <Plus size={14} /> Add Role
                </Button>
              </div>

              {expertise.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-2xl">
                  <Briefcase size={36} className="mx-auto text-secondary-text mb-2 stroke-[1.5]" />
                  <p className="text-sm text-secondary-text">No experience items added yet. Click 'Add Role' above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {expertise.map((exp) => (
                    <div 
                      key={exp.id} 
                      className="p-5 rounded-2xl bg-background border border-border flex gap-4 relative animate-in fade-in duration-300"
                    >
                      <div className="flex flex-col gap-2 shrink-0 items-center justify-center">
                        <button
                          type="button"
                          onClick={() => updateExpertiseItem(exp.id, 'icon', exp.icon === 'grad' ? 'briefcase' : 'grad')}
                          className="p-3 bg-surface border border-border rounded-xl text-emerald-600 hover:bg-emerald-50/10 transition-all cursor-pointer"
                          title="Click to toggle icon"
                        >
                          {exp.icon === 'grad' ? <GradIcon size={20} /> : <Briefcase size={20} />}
                        </button>
                      </div>

                      <div className="flex-1 space-y-3 pr-8">
                        <input 
                          type="text"
                          value={exp.type}
                          onChange={(e) => updateExpertiseItem(exp.id, 'type', e.target.value)}
                          placeholder="Title (e.g. Senior Software Engineer)"
                          className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none font-bold focus:ring-1 focus:ring-emerald-500"
                        />
                        <textarea 
                          value={exp.desc}
                          onChange={(e) => updateExpertiseItem(exp.id, 'desc', e.target.value)}
                          placeholder="Describe your achievements and duties..."
                          rows={2}
                          className="w-full bg-surface border border-border rounded-xl p-3 text-sm text-foreground outline-none resize-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeExpertise(exp.id)}
                        className="absolute top-4 right-4 p-2 text-faint-text hover:text-red-500 transition-colors cursor-pointer"
                        title="Delete Role"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* RIGHT COLUMN: Avatar Panel & Submit Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Avatar Settings */}
          <Card className="p-6 rounded-[2.5rem] border-none shadow-xl bg-surface flex flex-col items-center text-center space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-secondary-text border-b border-border pb-2 w-full text-center">Profile Photo</h3>
            
            <div className="relative group w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500/10 shadow-lg bg-background">
              <img 
                src={avatar} 
                className="w-full h-full object-cover" 
                alt="Avatar Preview" 
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-300 cursor-pointer"
              >
                <Camera size={24} />
              </div>
            </div>

            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <Button 
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border-border hover:bg-emerald-50/10 font-bold text-xs h-9 cursor-pointer"
            >
              Select Image File
            </Button>
            <p className="text-[10px] text-faint-text">Max 2MB. Accepted file types: JPEG, PNG, WEBP.</p>
          </Card>

          {/* Form Actions */}
          <Card className="p-6 rounded-[2.5rem] border-none shadow-xl bg-surface space-y-3">
            <Button 
              type="submit"
              disabled={isSaving}
              className="w-full rounded-2xl h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </Button>

            <Button 
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={isSaving}
              className="w-full rounded-2xl h-14 border-border text-secondary-text hover:text-foreground font-bold cursor-pointer"
            >
              Cancel
            </Button>
          </Card>
        </div>
      </form>
    </div>
  );
};

export default EditProfile;
