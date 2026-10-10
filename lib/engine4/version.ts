/**
 * The Engine 4 release a consent record names (architecture 6.11, "versions:
 * Engine 4"). It is the version of the rules a setup was judged and sized by:
 * the sizing steps, the offer rows, the eight checks and the Tier-1 blackout.
 *
 * Change it, and say why in the commit, whenever one of those changes the
 * figures or the verdict a trader would see for the same inputs. The shape of a
 * `ValidatedSetup` has its own id (`validated-setup/1`) and does not move this.
 *
 * @module lib/engine4/version
 */

export const ENGINE4_VERSION = '1.0.0';
