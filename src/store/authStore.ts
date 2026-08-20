import { create } from 'zustand';
import type { UserRole } from '../lib/database.types';
import { nexus } from '../lib/nexus';
import type { AdminRole } from '../types/admin';
import { adminService } from '../lib/services/admin';

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
  username?: string;
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
  isAdmin: boolean;
  adminRoles: AdminRole[];
  adminUser: any | null;
  adminSessionToken: string | null;
  pendingAdminUser: UserProfile | null;
  tempAdminCode: string | null;
  /** Timestamp of the last role switch (used to debounce syncProfile) */
  _lastRoleSwitchAt: number;
  /** True while setActiveRole is persisting to the backend */
  _isSwitchingRole: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; requireAdmin2FA?: boolean }>;
  signInAdmin: (email: string, password: string) => Promise<{ error: string | null; requireAdmin2FA?: boolean; adminUser?: any }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, metadata?: any) => Promise<{ error: string | null; requireVerification?: boolean }>;
  updateProfile: (updates: Partial<UserProfile>, background?: boolean) => Promise<{ error: string | null }>;
  verifyEmail: (email: string, otp: string, metadata?: any) => Promise<{ error: string | null }>;
  resendVerificationCode: (email: string) => Promise<{ error: string | null }>;
  setActiveRole: (role: UserRole) => Promise<void>;
  verifyAdmin2FA: (otp: string) => Promise<{ error: string | null; usedBackup?: boolean }>;
  cancelAdmin2FA: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
  syncProfile: () => Promise<void>;
}

export const resolveActiveRole = (user: UserProfile | null, overrideRole?: UserRole | null): UserRole | null => {
  if (!user) return null;
  const metadata = user.metadata || {};
  const storedActiveRole = overrideRole || metadata.active_role;

  const isMentorPermitted = 
    user.role === 'mentor' || 
    user.role === 'tutor' || 
    metadata.mentor_onboarded === true || 
    metadata.mentor_application_status === 'approved';

  // Explicit active role selection takes priority if permitted
  if (storedActiveRole === 'mentor' || storedActiveRole === 'tutor') {
    if (isMentorPermitted) {
      return 'mentor';
    }
    return 'mentee';
  }

  if (storedActiveRole === 'mentee') {
    return 'mentee';
  }

  // Default fallback based on onboarded status
  if (isMentorPermitted) {
    return 'mentor';
  }
  return 'mentee';
};

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
    isAdmin: false,
    adminRoles: [],
    adminUser: null,
    adminSessionToken: null,
    pendingAdminUser: null,
    tempAdminCode: null,
    _lastRoleSwitchAt: 0,
    _isSwitchingRole: false,

    setUser: (user) => {
      const merged = user ? mergeUser(user, {}) : null;
      set({ 
        user: merged, 
        activeRole: resolveActiveRole(merged),
        loading: false 
      });
    },
    setLoading: (loading) => set({ loading }),

    /**
     * Initialize auth state by checking for an existing InsForge session.
     */
    initialize: async () => {
      try {
        const { data, error } = await nexus.auth.getCurrentUser();
        if (data?.user) {
          const userId = data.user.id;
          const token = sessionStorage.getItem('admin_session_token');

          // Fetch profile, admin check, and session validation concurrently
          const [profileRes, adminRolesRes, sessionDataRes] = await Promise.all([
            nexus.auth.getProfile(userId).catch(() => ({ data: null })),
            adminService.getAdminUsersByUserId(userId).catch(() => ({ data: null })),
            token ? adminService.validateAdminSession(token).catch(() => ({ data: null })) : Promise.resolve({ data: null })
          ]);

          const profile = profileRes?.data;
          const merged = mergeUser(data.user, profile);

          if (merged) {
            // Non-blocking database sync in background
            ensureProfileInDatabase(merged).catch(err => console.error('[Auth] Background sync error:', err));
          }

          let activeAdminUser: any = null;
          if (token && sessionDataRes?.data && (sessionDataRes.data as any).admin_users) {
            activeAdminUser = (sessionDataRes.data as any).admin_users;
          }

          const adminRoles = adminRolesRes?.data || [];
          const approvedRole = (adminRoles as any[])?.find((r: any) => !r.suspended);

          if (activeAdminUser) {
            set({
              user: merged,
              activeRole: resolveActiveRole(merged),
              isAdmin: true,
              adminRoles: activeAdminUser.roles || [],
              adminUser: activeAdminUser,
              adminSessionToken: token,
              loading: false,
              initialized: true
            });
          } else {
            set({
              user: merged,
              activeRole: resolveActiveRole(merged),
              isAdmin: false,
              adminRoles: [],
              adminUser: approvedRole || null,
              adminSessionToken: null,
              loading: false,
              initialized: true
            });
          }
        } else {
          set({ 
            user: null, 
            activeRole: null, 
            isAdmin: false, 
            adminRoles: [], 
            adminUser: null, 
            adminSessionToken: null, 
            loading: false, 
            initialized: true 
          });
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        set({ 
          user: null, 
          activeRole: null, 
          isAdmin: false, 
          adminRoles: [], 
          adminUser: null, 
          adminSessionToken: null, 
          loading: false, 
          initialized: true 
        });
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
          ensureProfileInDatabase(merged).catch(err => console.error('[Auth] Background sync error:', err));
        }
        set({ 
          user: merged, 
          activeRole: resolveActiveRole(merged),
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
      console.log('[AuthStore] signUp action started for:', email);

      try {
        const { data, error } = await nexus.auth.signUp({ 
          email, 
          password, 
          name: fullName 
        });

        console.log('[AuthStore] signUp raw response:', { data, error });

        if (error) {
          // If the user already exists in the auth system, attempt to sign in immediately using their password.
          // This handles cases where they manually cleared database rows but their auth record remained.
          const errMsg = error.message?.toLowerCase() || '';
          if (errMsg.includes('already exists') || errMsg.includes('already registered')) {
            console.log('[AuthStore] User already exists in Auth. Attempting auto-signin recovery / verification check...');
            
            const { data: signInData, error: signInError } = await nexus.auth.signInWithPassword({ email, password });
            console.log('[AuthStore] signInWithPassword response:', { signInData, signInError });
            
            if (!signInError && signInData?.user) {
              // Check if email is verified
              if (signInData.user.emailVerified) {
                const { data: profile } = await nexus.auth.getProfile(signInData.user.id);
                const merged = mergeUser(signInData.user, profile);
                if (merged) {
                  await ensureProfileInDatabase(merged);
                }
                set({ 
                  user: merged, 
                  activeRole: resolveActiveRole(merged),
                  loading: false 
                });
                return { error: null };
              } else {
                // User exists but email is not verified yet. Transition to verification flow.
                console.log('[AuthStore] Existing user email is not verified. Resending verification email...');
                await nexus.auth.resendVerificationEmail({ email });
                set({ loading: false });
                return { error: null, requireVerification: true };
              }
            } else if (signInError) {
              const signinErrMsg = signInError.message?.toLowerCase() || '';
              // If signin fails specifically because verification is required
              if (signinErrMsg.includes('verify') || signinErrMsg.includes('verification') || signinErrMsg.includes('not verified')) {
                console.log('[AuthStore] Signin reports email not verified. Resending verification email...');
                await nexus.auth.resendVerificationEmail({ email });
                set({ loading: false });
                return { error: null, requireVerification: true };
              }
            }
          }

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
            console.error('[AuthStore] Error setting initial profile:', profileError);
            const merged = mergeUser(data.user, { full_name: fullName, role });
            set({ 
              user: merged, 
              activeRole: resolveActiveRole(merged),
              loading: false 
            });
            return { error: null };
          }

          const merged = mergeUser(data.user, profile);
          set({ 
            user: merged, 
            activeRole: resolveActiveRole(merged),
            loading: false 
          });
          return { error: null };
        }

        set({ loading: false });
        return { error: 'Sign up successful, but could not retrieve user data. Please try signing in.' };

      } catch (err: any) {
        console.error('[AuthStore] Exception in signUp action:', err);
        set({ loading: false });
        return { error: err?.message || 'An unexpected error occurred during signup action.' };
      }
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
          activeRole: resolveActiveRole(merged),
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
      const token = get().adminSessionToken;
      if (token) {
        try {
          await adminService.invalidateAdminSession(token);
        } catch (err) {
          console.error('[Auth] Error invalidating admin session:', err);
        }
      }
      sessionStorage.removeItem('admin_session_token');
      sessionStorage.removeItem('admin_2fa_passed');
      await nexus.auth.signOut();
      set({ 
        user: null, 
        activeRole: null, 
        isAdmin: false, 
        adminRoles: [], 
        adminUser: null, 
        adminSessionToken: null, 
        loading: false 
      });
    },

    /**
     * Update the current user's profile in InsForge.
     */
    updateProfile: async (updates: Partial<UserProfile>, background = false) => {
      const currentUser = get().user;
      if (!currentUser) return { error: 'Not authenticated' };

      if (!background) {
        set({ loading: true });
      }
      
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
        if (!background) {
          set({ loading: false });
        }
        return { error: error.message };
      }

      if (data) {
        // Ensure local state preserves optimistic active_role from updates
        const targetActiveRole = updates?.metadata?.active_role || currentUser?.metadata?.active_role || get().activeRole;
        const mergedMetadata = {
          ...currentUser?.metadata,
          ...(data as any)?.metadata,
          ...updates?.metadata,
          ...(targetActiveRole ? { active_role: targetActiveRole } : {})
        };

        const mergedUser = { 
          ...currentUser, 
          ...data,
          ...updates,
          metadata: mergedMetadata
        } as any as UserProfile;

        const resolvedRole = resolveActiveRole(mergedUser);
        set({ 
          user: mergedUser, 
          activeRole: resolvedRole,
          ...(background ? {} : { loading: false })
        });
        return { error: null };
      }

      if (!background) {
        set({ loading: false });
      }
      return { error: null };
    },

    /**
     * Set the currently active role and persist to user metadata.
     */
    setActiveRole: async (role: UserRole) => {
      const currentUser = get().user;
      if (!currentUser) return;
      
      const resolvedRole = resolveActiveRole(currentUser, role) || role;
      const now = Date.now();

      // Optimistically update local active role and metadata immediately (<100ms)
      // Also set switching guard flags to prevent syncProfile from reverting
      set({ 
        activeRole: resolvedRole,
        _isSwitchingRole: true,
        _lastRoleSwitchAt: now,
        user: {
          ...currentUser,
          metadata: {
            ...currentUser.metadata,
            active_role: resolvedRole
          }
        }
      });
      
      // Persist to user metadata in the background, then release the guard
      try {
        await get().updateProfile({
          metadata: {
            ...currentUser.metadata,
            active_role: resolvedRole
          }
        }, true);
      } catch (err) {
        console.error('[Auth] Error persisting active role:', err);
      } finally {
        set({ _isSwitchingRole: false, _lastRoleSwitchAt: Date.now() });
      }
    },

    signInAdmin: async (email: string, password: string) => {
      set({ loading: true });
      const { data, error } = await nexus.auth.signInWithPassword({ email, password });
      
      if (error) {
        set({ loading: false });
        return { error: error.message };
      }

      if (data?.user) {
        const { data: profile } = await nexus.auth.getProfile(data.user.id);
        const merged = mergeUser(data.user, profile);
        if (merged) {
          await ensureProfileInDatabase(merged);
        }

        const { data: adminRoles, error: adminRoleErr } = await adminService.getAdminUsersByUserId(data.user.id);
        if (adminRoleErr) {
          set({ loading: false });
          return { error: 'Error validating admin credentials: ' + adminRoleErr.message };
        }

        const approvedAdmin = adminRoles?.find((r: any) => r.status === 'active' || !r.suspended);
        if (!approvedAdmin) {
          await nexus.auth.signOut();
          set({ loading: false });
          return { error: 'Unauthorized. You do not have administrative access.' };
        }

        if (approvedAdmin.twofa_bypassed || !approvedAdmin.twofa_enabled) {
          const sessionToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
          const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
          
          const { error: sessionErr } = await adminService.createAdminSession(
            approvedAdmin.id,
            sessionToken,
            expiresAt,
            '127.0.0.1',
            navigator.userAgent
          );

          if (sessionErr) {
            set({ loading: false });
            return { error: 'Failed to create administrative session: ' + sessionErr.message };
          }

          sessionStorage.setItem('admin_session_token', sessionToken);
          sessionStorage.setItem('admin_2fa_passed', 'true');

          set({
            user: merged,
            activeRole: resolveActiveRole(merged),
            isAdmin: true,
            adminRoles: approvedAdmin.roles || [],
            adminUser: approvedAdmin,
            adminSessionToken: sessionToken,
            loading: false
          });

          return { error: null, requireAdmin2FA: false, adminUser: approvedAdmin };
        } else {
          const { error: codeErr } = await adminService.generate2FACode(approvedAdmin.id, approvedAdmin.twofa_email);
          if (codeErr) {
            set({ loading: false });
            return { error: 'Failed to generate 2FA verification code: ' + codeErr };
          }

          set({
            user: merged,
            activeRole: resolveActiveRole(merged),
            isAdmin: false,
            adminRoles: [],
            adminUser: approvedAdmin,
            adminSessionToken: null,
            pendingAdminUser: merged,
            loading: false
          });

          return { error: null, requireAdmin2FA: true, adminUser: approvedAdmin };
        }
      }

      set({ loading: false });
      return { error: 'Unknown authentication error. Please try again.' };
    },

    verifyAdmin2FA: async (otp: string) => {
      const adminRec = get().adminUser;
      const pending = get().pendingAdminUser || get().user;
      if (!adminRec || !pending) {
        return { error: 'Session verification expired. Please sign in again.' };
      }

      set({ loading: true });

      const res = await adminService.verify2FACode(adminRec.id, otp);
      if (res.error) {
        set({ loading: false });
        return { error: res.error };
      }

      const sessionToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      
      const { error: sessionErr } = await adminService.createAdminSession(
        adminRec.id,
        sessionToken,
        expiresAt,
        '127.0.0.1',
        navigator.userAgent
      );

      if (sessionErr) {
        set({ loading: false });
        return { error: 'Failed to establish administrative session: ' + sessionErr.message };
      }

      sessionStorage.setItem('admin_session_token', sessionToken);
      sessionStorage.setItem('admin_2fa_passed', 'true');

      const { data: updatedAdmin } = await nexus.database
        .from('admin_users')
        .select('*')
        .eq('id', adminRec.id)
        .single();

      set({
        user: pending,
        activeRole: resolveActiveRole(pending),
        pendingAdminUser: null,
        tempAdminCode: null,
        isAdmin: true,
        adminRoles: updatedAdmin?.roles || adminRec.roles || [],
        adminUser: updatedAdmin || adminRec,
        adminSessionToken: sessionToken,
        loading: false
      });

      return { error: null, usedBackup: res.usedBackup };
    },

    cancelAdmin2FA: async () => {
      set({
        adminUser: null,
        pendingAdminUser: null,
        tempAdminCode: null,
        isAdmin: false,
        adminRoles: [],
        adminSessionToken: null
      });
      await nexus.auth.signOut();
    },

    syncProfile: async () => {
      // Guard: skip sync if a role switch is in progress or happened recently
      // This prevents the 5s polling from overwriting the optimistic activeRole
      // before the backend persist completes.
      if (get()._isSwitchingRole) return;
      if (Date.now() - get()._lastRoleSwitchAt < 6000) return;

      const currentUser = get().user;
      if (!currentUser?.id) return;
      try {
        const { data: profile } = await nexus.database
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profile) {
          const profileData = profile as any;
          const metadata = profileData.metadata || {};
          
          // If suspended, handle logout immediately
          if (metadata.suspended === true) {
            console.log('[Sync] User suspended. Logging out...');
            await get().logout();
            window.location.href = `/login?suspended=true&reason=${encodeURIComponent(metadata.suspension_reason || 'N/A')}`;
            return;
          }

          const merged = mergeUser(currentUser, profileData);
          
          // Preserve local activeRole if valid, or fall back to resolved role
          let currentActiveRole = get().activeRole || resolveActiveRole(merged);
          const isMentorPermitted = merged.metadata?.mentor_onboarded === true || merged.role === 'mentor' || merged.role === 'tutor';

          if (currentActiveRole === 'mentor' && !isMentorPermitted) {
            currentActiveRole = 'mentee';
          }

          if (merged.metadata) {
            merged.metadata.active_role = currentActiveRole;
          }

          // Compare user changes (excluding active_role since it is forced to match)
          const hasUserChanged = (
            merged.full_name !== currentUser.full_name ||
            merged.avatar_url !== currentUser.avatar_url ||
            merged.role !== currentUser.role ||
            merged.bio !== currentUser.bio ||
            merged.country !== currentUser.country ||
            JSON.stringify(merged.metadata) !== JSON.stringify(currentUser.metadata)
          );

          const hasActiveRoleChanged = currentActiveRole !== get().activeRole;

          if (hasUserChanged || hasActiveRoleChanged) {
            console.log('[Sync] Profile updated from database:', merged);
            set({ 
              user: merged, 
              activeRole: currentActiveRole 
            });
          }
        }
      } catch (err) {
        console.error('[Sync] Error synchronizing profile:', err);
      }
    },

    logoutAdmin: async () => {
      set({ loading: true });
      const token = get().adminSessionToken;
      if (token) {
        try {
          await adminService.invalidateAdminSession(token);
        } catch (err) {
          console.error('[Auth] Error invalidating admin session:', err);
        }
      }
      sessionStorage.removeItem('admin_session_token');
      sessionStorage.removeItem('admin_2fa_passed');

      set({
        isAdmin: false,
        adminRoles: [],
        adminUser: null,
        adminSessionToken: null,
        loading: false
      });

      await nexus.auth.signOut();
      set({ user: null, activeRole: null });
    },
};
});

