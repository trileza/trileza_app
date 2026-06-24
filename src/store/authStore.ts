import { create } from 'zustand';
import type { UserRole } from '../lib/database.types';
import { nexus } from '../lib/nexus';

// Re-export for backward compatibility with existing imports
export type { UserRole } from '../lib/database.types';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  social_links?: Record<string, string>;
  expertise?: Array<{ id: number; type: string; desc: string; icon: string }>;
  website?: string;
  mentor_tier?: 'provisional' | 'basic' | 'standard' | 'full';
  verification_data?: any;
  created_at: string;
  // Extended fields
  surname?: string;
  first_name?: string;
  middle_name?: string;
  phone_number?: string;
  country?: string | null;
  metadata?: any;
}

/**
 * Helper to ensure a profile record exists in the public.profiles database table.
 */
const ensureProfileInDatabase = async (profile: UserProfile) => {
  if (!profile || !profile.id) return;
  try {
    const { data: existing, error } = await nexus.database
      .from('profiles')
      .select('id')
      .eq('id', profile.id)
      .maybeSingle();

    if (error) {
      console.error('[Auth] Error querying profiles database table:', error);
      return;
    }

    const profileData = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      avatar_url: profile.avatar_url || null,
      mentor_tier: profile.mentor_tier || null,
      country: profile.country || null,
      updated_at: new Date().toISOString()
    };

    if (!existing) {
      console.log('[Auth] Profile record not found in database table. Auto-creating for ID:', profile.id);
      const { error: insertErr } = await nexus.database.from('profiles').insert([profileData]);
      if (insertErr) {
        console.error('[Auth] Error auto-creating profile in database table:', insertErr);
      }
    }
  } catch (err) {
    console.error('[Auth] Exception during profiles database table sync:', err);
  }
};

interface AuthState {
  user: UserProfile | null;
  activeRole: UserRole | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, metadata?: any) => Promise<{ error: string | null; requireVerification?: boolean }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: string | null }>;
  verifyEmail: (email: string, otp: string, metadata?: any) => Promise<{ error: string | null }>;
  resendVerificationCode: (email: string) => Promise<{ error: string | null }>;
  setActiveRole: (role: UserRole) => Promise<void>;
}

// ─── Auth Store ───────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => {
  /**
   * Helper to merge user data from different sources into a flat UserProfile.
   * Handles nested 'profile' and 'metadata' columns from InsForge DB.
   */
  const mergeUser = (authUser: any, profileData: any): UserProfile => {
    if (!authUser) return null as any;

    // Handle case where profileData is the whole row (contains .profile and .metadata)
    const profileCol = profileData?.profile || {};
    const metadataCol = profileData?.metadata || {};
    
    // Sometimes profileData is the direct profile object (from setProfile)
    const directProfile = profileData && !profileData.profile ? profileData : {};

    const merged = {
      ...authUser,
      ...profileCol,
      ...metadataCol,
      ...directProfile,
      // Priority mapping for critical fields
      id: authUser.id || profileData?.id,
      email: authUser.email || profileData?.email,
      full_name: profileCol.full_name || metadataCol.fullName || directProfile.full_name || authUser.name || authUser.full_name || 'Expert',
      role: (profileCol.role || metadataCol.role || directProfile.role || authUser.role || 'unassigned').toLowerCase(),
      country: profileData?.country || profileCol?.country || directProfile?.country || metadataCol?.mentor_data?.identity?.address?.country || null
    };

    return merged as UserProfile;
  };

  return {
    user: null,
    activeRole: null,
    loading: true,
    initialized: false,

    setUser: (user) => {
      const merged = user ? mergeUser(user, {}) : null;
      set({ 
        user: merged, 
        activeRole: merged ? (merged.metadata?.active_role || merged.role) : null,
        loading: false 
      });
    },
    setLoading: (loading) => set({ loading }),

    /**
     * Initialize auth state by checking for an existing InsForge session.
     */
    initialize: async () => {
      // Don't re-initialize if already done
      try {
        const { data, error } = await nexus.auth.getCurrentUser();
        if (data?.user) {
          // Fetch full profile from InsForge
          const { data: profile } = await nexus.auth.getProfile(data.user.id);
          const merged = mergeUser(data.user, profile);
          if (merged) {
            await ensureProfileInDatabase(merged);
          }
          set({ 
            user: merged, 
            activeRole: merged ? (merged.metadata?.active_role || merged.role) : null,
            loading: false, 
            initialized: true 
          });
        } else {
          set({ user: null, activeRole: null, loading: false, initialized: true });
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        set({ user: null, activeRole: null, loading: false, initialized: true });
      }
    },

    /**
     * Sign in with email and password via InsForge.
     */
    signIn: async (email: string, password: string) => {
      set({ loading: true });

      const { data, error } = await nexus.auth.signInWithPassword({ email, password });
      
      if (error) {
        set({ loading: false });
        return { error: error.message };
      }

      if (data?.user) {
        // Fetch full profile after successful sign-in
        const { data: profile } = await nexus.auth.getProfile(data.user.id);
        const merged = mergeUser(data.user, profile);
        if (merged) {
          await ensureProfileInDatabase(merged);
        }
        set({ 
          user: merged, 
          activeRole: merged ? (merged.metadata?.active_role || merged.role) : null,
          loading: false 
        });
        return { error: null };
      }

      set({ loading: false });
      return { error: 'Unknown error during sign in. Please try again.' };
    },

    /**
     * Sign up a new user via InsForge.
     */
    signUp: async (email: string, password: string, fullName: string, role: UserRole, metadata?: any) => {
      set({ loading: true });

      const { data, error } = await nexus.auth.signUp({ 
        email, 
        password, 
        name: fullName 
      });

      if (error) {
        set({ loading: false });
        return { error: error.message };
      }

      if (data?.requireEmailVerification) {
        set({ loading: false });
        return { error: null, requireVerification: true };
      }

      if (data?.user) {
        // Set initial profile data in InsForge
        const { data: profile, error: profileError } = await nexus.auth.setProfile({
          full_name: fullName,
          role: role,
          avatar_url: metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
          created_at: new Date().toISOString(),
          ...metadata
        });

        if (profileError) {
          console.error('[Auth] Error setting initial profile:', profileError);
          const merged = mergeUser(data.user, { full_name: fullName, role });
          set({ 
            user: merged, 
            activeRole: merged ? (merged.metadata?.active_role || merged.role) : null,
            loading: false 
          });
          return { error: null };
        }

        const merged = mergeUser(data.user, profile);
        set({ 
          user: merged, 
          activeRole: merged ? (merged.metadata?.active_role || merged.role) : null,
          loading: false 
        });
        return { error: null };
      }

      set({ loading: false });
      return { error: 'Sign up successful, but could not retrieve user data. Please try signing in.' };
    },

    /**
     * Verify email with 6-digit code via InsForge.
     */
    verifyEmail: async (email: string, otp: string, metadata?: any) => {
      set({ loading: true });
      const { data, error } = await nexus.auth.verifyEmail({ email, otp });

      if (error) {
        set({ loading: false });
        return { error: error.message };
      }

      if (data?.user) {
        let finalProfile = {};
        
        // If metadata is provided (from registration flow), set the profile immediately
        if (metadata) {
          const customFields = metadata.metadata || {};
          const { data: updatedProfile, error: profileError } = await nexus.auth.setProfile({
            full_name: metadata.fullName || data.user.profile?.name,
            role: metadata.role,
            avatar_url: customFields.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
            created_at: new Date().toISOString(),
            ...customFields
          });
          
          if (profileError) {
            console.error('[Auth] Error setting profile during verification:', profileError);
          } else if (updatedProfile) {
            finalProfile = updatedProfile;
          }
        }

        // Fetch full profile to ensure we have everything (including server-side defaults)
        const { data: profile } = await nexus.auth.getProfile(data.user.id);
        
        // Merge results using the helper to handle nesting
        const merged = mergeUser(data.user, { ...finalProfile, ...profile });
        if (merged) {
          await ensureProfileInDatabase(merged);
        }
        set({ 
          user: merged, 
          activeRole: merged ? (merged.metadata?.active_role || merged.role) : null,
          loading: false 
        });
        return { error: null };
      }

      set({ loading: false });
      return { error: 'Verification successful, but could not retrieve user data.' };
    },

    /**
     * Resend the verification code via InsForge.
     */
    resendVerificationCode: async (email: string) => {
      set({ loading: true });
      const { data, error } = await nexus.auth.resendVerificationEmail({ email });
      set({ loading: false });

      if (error) return { error: error.message };
      return { error: null };
    },

    /**
     * Sign out the current user via InsForge.
     */
    logout: async () => {
      set({ loading: true });
      await nexus.auth.signOut();
      set({ user: null, activeRole: null, loading: false });
    },

    /**
     * Update the current user's profile in InsForge.
     */
    updateProfile: async (updates: Partial<UserProfile>) => {
      const currentUser = get().user;
      if (!currentUser) return { error: 'Not authenticated' };

      set({ loading: true });
      
      // Update via auth client
      const { data, error } = await nexus.auth.setProfile(updates);
      
      // Explicitly sync with profiles database table
      try {
        const { id, email, created_at, ...dbUpdates } = updates as any;
        if (Object.keys(dbUpdates).length > 0) {
          await ensureProfileInDatabase(currentUser);
          await nexus.database.from('profiles').update(dbUpdates).eq('id', currentUser.id);
        }
      } catch (dbErr) {
        console.error('[Auth] Failed to sync profile to database table:', dbErr);
      }

      if (error) {
        set({ loading: false });
        return { error: error.message };
      }

      if (data) {
        // Ensure the local state is updated with both the previous data and the new updates
        const mergedUser = { 
          ...currentUser, 
          ...data,
          // Explicitly merge updates as well in case 'data' from server is partial
          ...updates 
        } as any as UserProfile;
        set({ 
          user: mergedUser, 
          activeRole: mergedUser ? (mergedUser.metadata?.active_role || mergedUser.role) : null,
          loading: false 
        });
      } else {
        // Even if no data returned, update local state with requested updates for immediate feedback
        const mergedUser = { ...currentUser, ...updates } as any as UserProfile;
        set({ 
          user: mergedUser, 
          activeRole: mergedUser ? (mergedUser.metadata?.active_role || mergedUser.role) : null,
          loading: false 
        });
      }
      
      return { error: null };
    },

    /**
     * Set the currently active role and persist to user metadata.
     */
    setActiveRole: async (role: UserRole) => {
      const currentUser = get().user;
      if (!currentUser) return;
      
      set({ activeRole: role });
      
      // Persist to user metadata
      await get().updateProfile({
        metadata: {
          ...currentUser.metadata,
          active_role: role
        }
      });
    },
};
});

