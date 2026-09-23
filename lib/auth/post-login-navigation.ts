/**
 * Post-login navigation — a FULL page load, never a client-side route push.
 *
 * next-auth/react 4.x's `SessionProvider` holds the session it fetched when
 * the page first loaded. A standalone `getSession()` call notifies OTHER
 * tabs only (its broadcast rides the `storage` event, which never fires in
 * the tab that wrote it), so after signing in on /login and then
 * `router.push('/dashboard')`, the new page kept the pre-login `null`
 * session: the header fell back to "Trader" / "Trader Account" and hid the
 * ADMIN-only "Admin Control" item until the user refreshed or refocused the
 * tab. A full navigation makes the destination page start with a fresh
 * provider that reads the new session cookie.
 *
 * Kept as its own module so tests can assert the destination without jsdom's
 * unimplemented navigation.
 *
 * @module lib/auth/post-login-navigation
 */

export function navigateAfterLogin(destination: string): void {
  window.location.assign(destination);
}
