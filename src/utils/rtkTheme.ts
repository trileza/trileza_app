/**
 * RealtimeKit design tokens.
 *
 * Applies to any RealtimeKit web component we render. The meeting itself is
 * built from our own components, so this covers the pieces the SDK draws into
 * its own shadow DOM (device pickers, permission prompts) — without it those
 * render in Cloudflare's stock purple, which looks like a different product
 * dropped into the middle of the app.
 *
 * Values mirror the brand tokens in src/index.css. Keep them in step: the
 * shadow DOM cannot see our CSS custom properties, so they have to be repeated
 * here rather than referenced.
 */
import { provideRtkDesignSystem } from '@cloudflare/realtimekit-react-ui';

export const RTK_DESIGN_TOKENS = {
  colors: {
    brand: {
      400: '#43A047', // --color-brand-secondary
      500: '#2E7D32', // --color-brand-primary
      600: '#1B5E20', // --color-brand-primary-hover
    },
    background: {
      1000: '#0A0F0C', // --color-slate-950, the darkest surface
      900: '#161E19',  // --color-slate-900
      800: '#26302A',  // --color-slate-800
    },
    text: '#F8FAFC',
    videoBackground: '#0A0F0C',
  },
  typography: {
    // Outfit is the wordmark face and carries the brand through the meeting.
    fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
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

