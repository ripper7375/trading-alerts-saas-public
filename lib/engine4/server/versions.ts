/**
 * The versions the consent record names that belong to the REPORT, not to the
 * engine (`ENGINE4_VERSION` is in `../version.ts`): the fixed template Report 2 is
 * written from and the disclaimer shown with it.
 *
 * Both are DRAFT. The template and its labels are part 7's; the disclaimer and
 * consent wording wait for counsel's text (decision D14, ADR-081 makes the safety
 * texts a release gate), and the feature flag stays off until they arrive. They are
 * set HERE, on the server, and never read from a request: a consent record must
 * say which text the trader was shown, and the trader's browser must not get to
 * choose that. Part 7 and counsel replace these two strings; the record keeps the
 * string it was written with.
 *
 * @module lib/engine4/server/versions
 */

export const REPORT2_TEMPLATE_VERSION = 'report2-template/draft-0';
export const REPORT2_DISCLAIMER_VERSION = 'disclaimer/draft-0';
