/**
 * The two switches of the intake path, and nothing else (decision D16): each is on only when the
 * variable is exactly the text `true`. Off is the default and both are set nowhere.
 *
 * Its own file, apart from `access.ts`, so a page can read a flag without pulling in the session,
 * the database and the knowledge client. `access.ts` re-exports both functions.
 *
 *  - `INTAKE_ENABLED`: the two routes (`/api/intake`, `/api/intake/instant`) answer 404 to
 *    everybody until it is on. **It stays false in production until step 7 meters the quota**
 *    (decision D5 (A); runbook `docs/runbooks/deploy-stack-d-step6.md`).
 *  - `INTAKE_INSTANT_PROMPTS_ENABLED`: the chart's Market Context badges are the Panel C instant
 *    prompts only when it is on (part 10; off, they are the older badges). It is not a second lock
 *    on the route: a badge pressed while the route is off gets the 404 and shows the "not available"
 *    text.
 *
 * @module lib/intake/server/flags
 */

export type Env = Readonly<Record<string, string | undefined>>;

/** The intake routes are off unless this is exactly the text `true`. */
export function isIntakeEnabled(env: Env = process.env): boolean {
  return env['INTAKE_ENABLED'] === 'true';
}

/** The Panel C badges are instant prompts only when this is exactly the text `true` (the UI reads it; part 10). */
export function isInstantPromptsEnabled(env: Env = process.env): boolean {
  return env['INTAKE_INSTANT_PROMPTS_ENABLED'] === 'true';
}
