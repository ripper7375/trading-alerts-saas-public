/**
 * The two switches of the intake path, and nothing else (decision D16): each is on only when the
 * variable is exactly the text `true`. Off is the default and both are set nowhere.
 *
 * Its own file, apart from `access.ts`, so a page can read a flag without pulling in the session,
 * the database and the knowledge client. `access.ts` re-exports both functions.
 *
 *  - `INTAKE_ENABLED`: the two routes (`/api/intake`, `/api/intake/instant`) answer 404 to
 *    everybody until it is on. Since build step 7 part 7b they are DEV-ONLY tools (decision D8): the
 *    one metered front door is `/api/chat/message`, and these two make the Understand call with no
 *    hold, so they are off in a production build whatever the variable says (`NODE_ENV` is
 *    `production` in every deployed build, previews included).
 *  - `INTAKE_INSTANT_PROMPTS_ENABLED`: the chart's Market Context badges are the Panel C instant
 *    prompts only when it is on (part 10; off, they are the older badges). It is not a second lock
 *    on the route: a badge pressed while the route is off gets the 404 and shows the "not available"
 *    text.
 *
 * @module lib/intake/server/flags
 */

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * The intake routes are off unless this is exactly the text `true`, and they are never on in a
 * production build (decision D8: unmetered, so not for traders; `/api/chat/message` is the front door).
 */
export function isIntakeEnabled(env: Env = process.env): boolean {
  return env['INTAKE_ENABLED'] === 'true' && env['NODE_ENV'] !== 'production';
}

/** The Panel C badges are instant prompts only when this is exactly the text `true` (the UI reads it; part 10). */
export function isInstantPromptsEnabled(env: Env = process.env): boolean {
  return env['INTAKE_INSTANT_PROMPTS_ENABLED'] === 'true';
}
