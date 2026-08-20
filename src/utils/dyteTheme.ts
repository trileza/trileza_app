/**
 * RealtimeKit Design System Configuration
 * Implements Agro-green branding and Glassmorphism effects
 */
import { provideRtkDesignSystem } from '@cloudflare/realtimekit-react-ui';

export const RTK_DESIGN_TOKENS = {
  colors: {
    brand: {
      500: '#2E7D32', // Agro-green
      600: '#1B5E20',
      400: '#4CAF50',
    },
    background: {
      1000: '#334155', // Slate-grey surface
      900: '#1E293B',
      800: '#0F172A',
    },
    text: '#F8FAFC',
    videoBackground: '#020617',
  },
  typography: {
    fontFamily: '"Inter", "Geist", system-ui, sans-serif',
  },
  borderRadius: 'extra-rounded' as const,
};

/**
 * Injects our global design tokens into the RealtimeKit shadow DOM
 * and applies the custom glassmorphism effects.
 */
export const applyRtkTheme = (element: HTMLElement) => {
  if (!element) return;

  provideRtkDesignSystem(element, {
    theme: 'dark',
    ...RTK_DESIGN_TOKENS,
  });

  // Inject glassmorphism CSS variables directly to the element's style
  const styles = {
    '--rtk-overlay-background': 'rgba(15, 23, 42, 0.6)',
    '--rtk-sidebar-background': 'rgba(15, 23, 42, 0.6)',
    '--rtk-control-bar-background': 'rgba(15, 23, 42, 0.8)',
    '--rtk-grid-pagination-background': 'transparent',
    '--rtk-video-background': '#020617',
  };

  Object.entries(styles).forEach(([prop, value]) => {
    element.style.setProperty(prop, value);
  });
};

// Maintain compatibility alias
export const applyDyteTheme = applyRtkTheme;

