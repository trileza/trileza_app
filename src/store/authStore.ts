import { create } from 'zustand';
import type { UserRole } from '../lib/database.types';
import { nexus } from '../lib/nexus';
import type { AdminRole } from '../types/admin';
import { adminService } from '../lib/services/admin';
import { generateSecureToken } from '../utils/secureRandom';
import { isAdminRecordActive } from '../utils/adminAuth';

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
  mentor_tier?: 'free' | 'pro' | 'institutional' | 'provisional' | 'basic' | 'standard' | 'full' | string;
  verification_data?: any;
  created_at: string;
  username?: string;
  // Extended fields
  surname?: string;
  first_name?: string;
  middle_name?: string;
  phone_number?: string;
  country?: string | null;
  tenant_id?: string;
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
      username: profile.username || (profile.metadata as any)?.username || null,
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

let activeRealtimeUserId: string | null = null;

const setupUserRealtimeListeners = async (userId: string, syncCallback: () => void) => {
  if (!userId || activeRealtimeUserId === userId) return;
  activeRealtimeUserId = userId;

  // Tells the subscription store which user's channel to watch for plan
  // changes made outside this tab.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('trileza:auth-user-ready', { detail: { userId } }));
  }

  try {
    if (!nexus.realtime.isConnected) {
      await nexus.realtime.connect();
    }
    const channel = `user:${userId}`;
    await nexus.realtime.subscribe(channel);
    
    nexus.realtime.on('profile_updated', (payload: any) => {
      console.log('[Auth Realtime] Received profile_updated event:', payload);
      syncCallback();
    });

    nexus.realtime.on('user_suspension_changed', (payload: any) => {
      if (payload?.userId === userId) {
        console.log('[Auth Realtime] Suspension status changed:', payload);
        syncCallback();
      }
    });

    nexus.realtime.on('admin_role_changed', (payload: any) => {
      if (payload?.userId === userId) {
        console.log('[Auth Realtime] Admin role changed:', payload);
        syncCallback();
      }
    });
  } catch (err) {
    console.warn('[Auth Realtime] Could not attach user realtime listener:', err);
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

  // A guardian is a single-purpose account: it only ever sees the parent
  // portal, and cannot switch into a learner or mentor context.
  if (user.role === 'guardian' || storedActiveRole === 'guardian') {
    return 'guardian';
  }

  const isMentorPermitted = 
    user.role === 'mentor' || 
    user.role === 'tutor' || 
    metadata.mentor_onboarded === true || 
    metadata.mentor_application_status === 'approved';

  const isInstitutionalPermitted =
    user.role === 'management' ||
    (user.role as string) === 'tenant_admin' ||
    user.role === 'staff' ||
    user.mentor_tier === 'institutional' ||
    metadata.mentor_tier === 'institutional' ||
    metadata.subscription_tier === 'institutional' ||
    Boolean(user.tenant_id) ||
    Boolean(metadata.tenant_id);

  // Explicit active role selection takes priority if permitted
  // Handle management/institutional roles
  if (storedActiveRole === 'management' || storedActiveRole === 'staff' || 
      storedActiveRole === 'tenant_admin' || storedActiveRole === 'institutional') {
    if (isInstitutionalPermitted) {
      return 'management';
    }
    // Fall back to mentor if they have mentor permissions
    if (isMentorPermitted) {
      return 'mentor';
    }
    return 'mentee';
  }

  if (storedActiveRole === 'mentor' || storedActiveRole === 'tutor') {
    if (isMentorPermitted) {
      return 'mentor';
    }
    return 'mentee';
  }

  if (storedActiveRole === 'mentee') {
    return 'mentee';
  }

  // Default fallback based on role/permissions (no explicit active_role set)
  if (isInstitutionalPermitted) {
    return 'management';
  }
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
      username: profileCol.username || metadataCol.username || directProfile.username || authUser.username || null,
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
            setupUserRealtimeListeners(merged.id, get().syncProfile);
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
          setupUserRealtimeListeners(merged.id, get().syncProfile);
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
          const customFields = metadata.metadata || metadata || {};
          const fullName = metadata.full_name || metadata.fullName || customFields.full_name || data.user.profile?.name;
          const avatarUrl = metadata.avatar_url || customFields.avatar_url;
          const { data: updatedProfile, error: profileError } = await nexus.auth.setProfile({
            full_name: fullName,
            role: metadata.role || customFields.role || 'mentee',
            avatar_url: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
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

      // Plan state is persisted to localStorage, so it outlives the session
      // unless cleared here. Without this a free account signing in on a
      // browser that previously held an Institutional session inherited that
      // tier, with the paid features unlocked, until the network call resolved.
      try {
        const { useSubscriptionStore } = await import('./subscriptionStore');
        useSubscriptionStore.getState().resetSubscription();
      } catch (err) {
        console.error('[Auth] Could not reset plan state on sign-out:', err);
      }
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

        // The same rule the console guard applies. The previous `status === 'active'
        // || !suspended` let a pending or rejected application through to 2FA.
        const approvedAdmin = adminRoles?.find((r: any) => isAdminRecordActive(r));
        if (!approvedAdmin) {
          await nexus.auth.signOut();
          set({ loading: false });
          return { error: 'Unauthorized. You do not have administrative access.' };
        }

        if (approvedAdmin.twofa_bypassed || !approvedAdmin.twofa_enabled) {
          const sessionToken = generateSecureToken();
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

      const sessionToken = generateSecureToken();
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
          const isMentorPermitted = merged.metadata?.mentor_onboarded === true || merged.role === 'mentor' || merged.role === 'tutor' || merged.metadata?.mentor_application_status === 'approved';

          // If the profile in the database was specifically updated to mentor (e.g. from admin approval),
          // or if the user was on pending and just got approved, update activeRole to mentor
          let currentActiveRole = get().activeRole;
          if (isMentorPermitted && (metadata.active_role === 'mentor' || (currentUser.metadata?.mentor_application_status === 'pending' && metadata.mentor_application_status === 'approved'))) {
            currentActiveRole = 'mentor';
          } else if (currentActiveRole === 'mentor' && !isMentorPermitted) {
            currentActiveRole = 'mentee';
          } else if (!currentActiveRole) {
            currentActiveRole = resolveActiveRole(merged) || 'mentee';
          }

          if (merged.metadata) {
            merged.metadata.active_role = currentActiveRole;
          }

          // Compare user changes
          const hasUserChanged = (
            merged.full_name !== currentUser.full_name ||
            merged.avatar_url !== currentUser.avatar_url ||
            merged.role !== currentUser.role ||
            merged.bio !== currentUser.bio ||
            merged.country !== currentUser.country ||
            merged.mentor_tier !== currentUser.mentor_tier ||
            JSON.stringify(merged.metadata) !== JSON.stringify(currentUser.metadata)
          );

          const hasActiveRoleChanged = currentActiveRole !== get().activeRole;

          if (hasUserChanged || hasActiveRoleChanged) {
            console.log('[Sync] Profile updated from database:', merged, 'newActiveRole:', currentActiveRole);
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

      // Plan state is persisted to localStorage, so it outlives the session
      // unless cleared here. Without this a free account signing in on a
      // browser that previously held an Institutional session inherited that
      // tier, with the paid features unlocked, until the network call resolved.
      try {
        const { useSubscriptionStore } = await import('./subscriptionStore');
        useSubscriptionStore.getState().resetSubscription();
      } catch (err) {
        console.error('[Auth] Could not reset plan state on sign-out:', err);
      }

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

