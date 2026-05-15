/**
 * Base URL for the /api/finance proxy.
 *
 * - In dev (vite) and in the web Docker build, this is empty so the
 *   browser uses a relative URL handled by the local proxy
 *   (vite.config.ts in dev, nginx.conf in production).
 * - On Android via Capacitor there is no local proxy. Build with:
 *
 *     VITE_API_BASE=https://tax.yourdomain.com npm run android:build:release
 *
 *   pointing at your deployed Docker instance (which exposes
 *   /api/finance/ via nginx). All fetch URLs prepend this value.
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';
