/**
 * The versions the consent record names that belong to the REPORT, not to the
 * engine (`ENGINE4_VERSION` is in `../version.ts`): the fixed template Report 2 is
 * written from and the disclaimer shown with it.
 *
 * Both are DRAFT. Part 7 built the template (`../templates/report2.ts`), which is
 * now where the two strings live, so the version a record names is the version of
 * the template that drew the report; this file re-exports them for the route layer.
 * The disclaimer and consent wording wait for counsel's text (decision D14,
 * ADR-081 makes the safety texts a release gate), and the feature flag stays off
 * until they arrive. They are set on the server and never read from a request: a
 * consent record must say which text the trader was shown, and the trader's
 * browser must not get to choose that. A record keeps the string it was written
 * with (`draft-0` was the placeholder before the template existed).
 *
 * @module lib/engine4/server/versions
 */

export {
  REPORT2_DISCLAIMER_VERSION,
  REPORT2_TEMPLATE_VERSION,
} from '../templates/report2';
