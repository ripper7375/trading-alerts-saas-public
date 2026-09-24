/**
 * Client-safe pieces of the admin "view as user" mode. The server half
 * (cookie, session and database checks) is lib/admin/user-view-as.ts, which
 * can't be imported into a client component.
 *
 * @module lib/admin/user-view-as-paths
 */

/** Query string the settings pages add to opt a read into view mode. */
export const USER_VIEW_AS_QUERY = 'view_as=user';

/** The only settings paths that render the viewed user's data. */
export const USER_VIEW_AS_PATHS = [
  '/settings/billing',
  '/settings/security',
  '/settings/security/activity',
] as const;

/** Append the view-as opt-in to a URL when `active`. */
export function withViewAsQuery(url: string, active: boolean): string {
  if (!active) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${USER_VIEW_AS_QUERY}`;
}

/** Whether `pathname` is one of the pages that shows the viewed user. */
export function isUserViewAsPath(pathname: string | null): boolean {
  return (USER_VIEW_AS_PATHS as readonly string[]).includes(pathname ?? '');
}
