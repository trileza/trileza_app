import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Network, type ConnectionStatus } from '@capacitor/network';
import { useEffect, useState } from 'react';

/**
 * Check if the app is currently running inside a native mobile container (iOS / Android)
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get current running platform ('ios' | 'android' | 'web')
 */
export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};

/**
 * Synchronize Native Status Bar background and icon contrast with app theme
 */
export const setNativeStatusBar = async (isDark: boolean): Promise<void> => {
  if (!isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({
      style: isDark ? Style.Dark : Style.Light
    });
    await StatusBar.setBackgroundColor({
      color: isDark ? '#0A0E0D' : '#FFFFFF'
    });
  } catch (err) {
    console.warn('[Capacitor] StatusBar update failed:', err);
  }
};

/**
 * Initialize Capacitor native plugins on startup (hide splash screen, set initial status bar)
 */
export const initCapacitorNative = async (): Promise<void> => {
  if (!isNativePlatform()) return;

  try {
    // Prevent status bar overlaying webview content
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Hide splash screen after web app renders
    await SplashScreen.hide();
  } catch (err) {
    console.warn('[Capacitor] initCapacitorNative failed:', err);
  }
};

/**
 * Register Android hardware back button listener
 */
export const registerAndroidBackButton = (onBack: () => void): () => void => {
  if (!isNativePlatform() || getPlatform() !== 'android') {
    return () => {};
  }

  const listenerPromise = CapApp.addListener('backButton', (event) => {
    if (!event.canGoBack) {
      CapApp.minimizeApp();
    } else {
      onBack();
    }
  });

  return () => {
    listenerPromise.then((handle) => handle.remove());
  };
};

/**
 * Hook to listen to network online/offline status
 */
export const useNetworkStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: true,
    connectionType: 'unknown'
  });

  useEffect(() => {
    if (!isNativePlatform()) return;

    let handler: any;

    const setupListener = async () => {
      const current = await Network.getStatus();
      setStatus(current);

      handler = await Network.addListener('networkStatusChange', (netStatus) => {
        setStatus(netStatus);
      });
    };

    setupListener();

    return () => {
      if (handler) {
        handler.remove();
      }
    };
  }, []);

  return status;
};

/**
 * Capacitor Preferences Storage Adapter (Native key-value persistence with web localStorage fallback)
 */
export const nativeStorage = {
  async get(key: string): Promise<string | null> {
    if (isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (isNativePlatform()) {
      await Preferences.set({ key, value });
    }
    localStorage.setItem(key, value);
  },

  async remove(key: string): Promise<void> {
    if (isNativePlatform()) {
      await Preferences.remove({ key });
    }
    localStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    if (isNativePlatform()) {
      await Preferences.clear();
    }
    localStorage.clear();
  }
};

/**
 * Native Photo / Image Picker with web fallback
 */
export const captureOrPickImage = async (
  source: 'camera' | 'photos' = 'photos'
): Promise<string | null> => {
  if (!isNativePlatform()) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }

  try {
    const image = await Camera.getPhoto({
      quality: 85,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos
    });
    return image.dataUrl || null;
  } catch (err) {
    console.warn('[Capacitor] Camera/Photos cancelled or failed:', err);
    return null;
  }
};
