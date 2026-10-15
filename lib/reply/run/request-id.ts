/**
 * The server's id of a request (build step 7 part 7a; plan part 7, "idempotency").
 *
 * The client sends one `client_request_id` per button press or sent message; the server's
 * `request_id` is a keyed function of the trader and that id:
 *
 *     request_id = SHA-256("reply-request/1" LF user_id LF client_request_id)   (64 hex characters)
 *
 * So the SAME trader sending the SAME client id again gets the SAME request id, and that is the
 * key of the reservation in the quota ledger, of the stored messages and of the trace row: a
 * double click or a retry finds its own hold and its own stored reply, and is charged once.
 * Two traders can never collide on it (the user id is in the digest), a client id taken from
 * somebody else's traffic is another request id for this trader, and the id reveals neither
 * the user id nor the client id.
 *
 * Pure.
 *
 * @module lib/reply/run/request-id
 */

import { sha256Hex } from '../contracts/intake';

/** What a client id may look like: the pattern of the `client_request_id` column. */
export const CLIENT_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function requestIdOf(
  userId: string,
  clientRequestId: string
): Promise<string> {
  return sha256Hex(`reply-request/1\n${userId}\n${clientRequestId}`);
}
