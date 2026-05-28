/**
 * Dyte Design System Configuration
 * Implements Agro-green branding and Glassmorphism effects
 */
import { provideDyteDesignSystem } from '@dytesdk/react-ui-kit';

export const DYTE_DESIGN_TOKENS = {
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
 * Injects our global design tokens into the Dyte shadow DOM
 * and applies the custom glassmorphism effects.
 */
export const applyDyteTheme = (element: HTMLElement) => {
  if (!element) return;

  provideDyteDesignSystem(element, {
    theme: 'dark',
    ...DYTE_DESIGN_TOKENS,
  });

  // Inject glassmorphism CSS variables directly to the element's style
  // These will override Dyte's default panel backgrounds
  const styles = {
    '--dyte-overlay-background': 'rgba(15, 23, 42, 0.6)',
    '--dyte-sidebar-background': 'rgba(15, 23, 42, 0.6)',
    '--dyte-control-bar-background': 'rgba(15, 23, 42, 0.8)',
    '--dyte-grid-pagination-background': 'transparent',
    '--dyte-video-background': '#020617',
  };

  Object.entries(styles).forEach(([prop, value]) => {
    element.style.setProperty(prop, value);
  });
};
