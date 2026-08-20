import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    push: boolean;
    email: boolean;
    classroom: boolean;
    mentions: boolean;
    messages: boolean;
  };
  language: string;
  privacy: {
    profileVisibility: 'public' | 'private';
    allowMessagesFrom: 'everyone' | 'followers' | 'none';
  };
  reading: {
    fontSize: 'sm' | 'md' | 'lg' | 'xl';
    fontStyle: 'sans' | 'serif' | 'dyslexic';
    readingMode: 'default' | 'comfortable' | 'compact';
  };
  video: {
    quality: 'auto' | '1080p' | '720p' | '480p';
    autoplay: 'always' | 'wifi' | 'never';
    subtitles: boolean;
  };
  sounds: {
    soundEffects: boolean;
    entryChimes: boolean;
  };
  accessibility: {
    contrast: 'standard' | 'high';
    screenReaderSupport: boolean;
  };
  dataUsage: {
    autoplayWifiOnly: boolean;
  };

  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  updateSettings: (updates: Partial<Omit<SettingsState, 'updateSetting' | 'updateSettings' | 'loadSettings' | 'applySettings'>>) => Promise<void>;
  loadSettings: () => void;
  applySettings: () => void;
}

const DEFAULT_SETTINGS = {
  theme: 'system' as const,
  notifications: {
    push: true,
    email: true,
    classroom: true,
    mentions: true,
    messages: true,
  },
  language: 'en',
  privacy: {
    profileVisibility: 'public' as const,
    allowMessagesFrom: 'everyone' as const,
  },
  reading: {
    fontSize: 'md' as const,
    fontStyle: 'sans' as const,
    readingMode: 'default' as const,
  },
  video: {
    quality: 'auto' as const,
    autoplay: 'always' as const,
    subtitles: false,
  },
  sounds: {
    soundEffects: true,
    entryChimes: true,
  },
  accessibility: {
    contrast: 'high' as const,
    screenReaderSupport: false,
  },
  dataUsage: {
    autoplayWifiOnly: false,
  },
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,

  updateSetting: (key, value) => {
    get().updateSettings({ [key]: value } as any);
  },

  updateSettings: async (updates) => {
    // 1. Update store state
    set(updates as any);
    
    // 2. Persist critical values to localStorage for pre-auth load
    if (updates.theme !== undefined) {
      localStorage.setItem('trileza-theme', updates.theme);
    }
    if (updates.language !== undefined) {
      localStorage.setItem('trileza-lang', updates.language);
    }
    if (updates.accessibility?.contrast !== undefined) {
      localStorage.setItem('trileza-contrast', updates.accessibility.contrast);
    }

    // Apply the visual settings immediately
    get().applySettings();

    // 3. Sync to backend user profile metadata if authenticated
    const authStore = useAuthStore.getState();
    if (authStore.user) {
      const currentMetadata = authStore.user.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        settings: {
          ...(currentMetadata.settings || {}),
          ...updates,
        },
        // Backwards compatibility sync for existing root-level notification flags
        notifications: {
          ...(currentMetadata.notifications || {}),
          ...(updates.notifications || {}),
        }
      };

      await authStore.updateProfile({
        metadata: updatedMetadata
      });
    }
  },

  loadSettings: () => {
    // 1. Load from localStorage first (pre-auth values)
    const localTheme = localStorage.getItem('trileza-theme') as 'light' | 'dark' | 'system' | null;
    const localLang = localStorage.getItem('trileza-lang');
    const localContrast = localStorage.getItem('trileza-contrast') as 'standard' | 'high' | null;

    let settingsToSet: any = {};
    if (localTheme) settingsToSet.theme = localTheme;
    if (localLang) settingsToSet.language = localLang;
    if (localContrast) {
      settingsToSet.accessibility = {
        ...get().accessibility,
        contrast: localContrast
      };
    }

    // 2. Merge with user metadata settings if user is loaded
    const authStore = useAuthStore.getState();
    if (authStore.user?.metadata?.settings) {
      const metaSettings = authStore.user.metadata.settings;
      settingsToSet = {
        ...settingsToSet,
        ...metaSettings,
        // Deep merge nested fields to avoid wiping defaults
        notifications: {
          ...DEFAULT_SETTINGS.notifications,
          ...(settingsToSet.notifications || {}),
          ...(metaSettings.notifications || {})
        },
        privacy: {
          ...DEFAULT_SETTINGS.privacy,
          ...(settingsToSet.privacy || {}),
          ...(metaSettings.privacy || {})
        },
        reading: {
          ...DEFAULT_SETTINGS.reading,
          ...(settingsToSet.reading || {}),
          ...(metaSettings.reading || {})
        },
        video: {
          ...DEFAULT_SETTINGS.video,
          ...(settingsToSet.video || {}),
          ...(metaSettings.video || {})
        },
        sounds: {
          ...DEFAULT_SETTINGS.sounds,
          ...(settingsToSet.sounds || {}),
          ...(metaSettings.sounds || {})
        },
        accessibility: {
          ...DEFAULT_SETTINGS.accessibility,
          ...(settingsToSet.accessibility || {}),
          ...(metaSettings.accessibility || {})
        },
        dataUsage: {
          ...DEFAULT_SETTINGS.dataUsage,
          ...(settingsToSet.dataUsage || {}),
          ...(metaSettings.dataUsage || {})
        }
      };
    } else if (authStore.user?.metadata?.notifications) {
      // Legacy notification sync if settings object doesn't exist yet
      settingsToSet.notifications = {
        ...DEFAULT_SETTINGS.notifications,
        ...authStore.user.metadata.notifications
      };
    }

    set(settingsToSet);
    get().applySettings();
  },

  applySettings: () => {
    const { theme, reading, accessibility } = get();

    // 1. Apply Theme
    const isDark = 
      theme === 'dark' || 
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }

    // 2. Apply Accessibility Contrast (High Contrast default for dark mode)
    if (accessibility.contrast === 'high' || isDark) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    // 3. Apply Reading font size to body
    document.body.classList.remove('reading-size-sm', 'reading-size-md', 'reading-size-lg', 'reading-size-xl');
    document.body.classList.add(`reading-size-${reading.fontSize}`);

    // 4. Apply Reading font family to body
    document.body.classList.remove('font-sans', 'font-serif', 'font-dyslexic');
    if (reading.fontStyle === 'dyslexic') {
      document.body.classList.add('font-dyslexic');
    } else if (reading.fontStyle === 'serif') {
      document.body.classList.add('font-serif');
    } else {
      document.body.classList.add('font-sans');
    }
  }
}));
