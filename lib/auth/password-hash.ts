/**
 * The bcrypt costs of new hashes (CODE-13).
 *
 * The cost is stored inside each hash, so changing it only affects the hashes written from now
 * on: a hash written at another cost keeps verifying, and a password is re-hashed at the current
 * cost the next time it is set. `operation-service/src/auth/password-hash.const.ts` holds the
 * same values; keep the two equal.
 */

/** A password. About 390 ms a hash in `bcryptjs`. */
export const BCRYPT_COST = 12;

/**
 * A 2FA backup code. Ten are hashed in a row, so cost 12 would make enabling 2FA (and
 * regenerating the codes) take about 4 s. About 100 ms a hash.
 */
export const BACKUP_CODE_BCRYPT_COST = 10;
