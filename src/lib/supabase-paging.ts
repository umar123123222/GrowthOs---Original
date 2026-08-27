/**
 * Shared pagination helpers to bypass PostgREST's default 1000-row cap.
 * Re-exports the proven fetchAll helper so all admin pages share one implementation.
 */
export { fetchAll } from './fetch-all';
