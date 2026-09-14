/**
 * Shared component barrel.
 *
 * Deliberately narrow. This file used to `export *` from PublicLibraryWrapper
 * (3,000 lines), StudioLayout (which pulls in @cloudflare/realtimekit, 3.5 MB)
 * TrilezaVideoPlayer, CartDrawer and LiveClasses — so any file importing
 * PageHeader from here dragged all of that into its chunk. Twenty-one files do
 * that, which put the whole RealtimeKit bundle on the initial load of every
 * page in the app.
 *
 * Only add re-exports here for small, genuinely shared components. Anything
 * heavy should be imported from its own path, and lazy-loaded where possible.
 */
export * from './LoadingOverlay';
export { default as PageHeader } from './PageHeader';
export { default as Logo } from './Logo';
export { default as FormShell, Field } from './FormShell';
export { default as Modal } from './Modal';
export * from '../video/TrilezaVideoPlayer';
export * from './CartButton';
export * from './CartDrawer';
