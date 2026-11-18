/**
 * Side-effect-free input checks for the chat gateway: the client address a
 * rate limit is keyed on, and the shape of a `client_message`. Nothing here
 * reads the environment, opens a connection or starts a server, so tests can
 * import it as it is (index.ts and auth.ts cannot be imported that way).
 *
 * Address trust: the server listens on 127.0.0.1 only (docker-compose.yml),
 * and host Nginx sets `X-Real-IP` from the connection it accepted
 * (nginx/chat-api.conf), so that header is the one source of the client
 * address that a client cannot choose. `X-Forwarded-For` is never read.
 */

import net from 'net';
import { CLIENT_MESSAGE_TOPICS, MAX_CLIENT_MESSAGE_LENGTH } from './types';
import type { ClientMessagePayload } from './types';

/** The part of a Socket.IO `Socket` that the address lookup reads. */
export interface HandshakeSource {
  handshake: {
    headers: Record<string, string | string[] | undefined>;
    address?: string;
  };
}

/** The bucket used when no usable address is found at all. */
export const UNKNOWN_CLIENT = 'unknown';

/** The longest textual IPv6 address (with an embedded IPv4 tail) is 45 characters. */
const MAX_IP_TEXT_LENGTH = 45;

type Ipv6Groups = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** The eight 16-bit groups of an address that `net.isIP` has accepted as IPv6. */
function ipv6Groups(address: string): Ipv6Groups | null {
  let text = address;

  // An embedded IPv4 tail ("::ffff:203.0.113.5") stands for the last two groups.
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.').map(Number);
    if (
      octets.length !== 4 ||
      octets.some(
        (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255
      )
    ) {
      return null;
    }
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    const high = ((a << 8) | b).toString(16);
    const low = ((c << 8) | d).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const parse = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const group of part.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
      groups.push(parseInt(group, 16));
    }
    return groups;
  };

  const head = parse(halves[0] ?? '');
  const rest = halves.length === 2 ? parse(halves[1] ?? '') : [];
  if (!head || !rest) return null;

  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [
    ...head,
    ...new Array<number>(Math.max(missing, 0)).fill(0),
    ...rest,
  ];
  return groups.length === 8 ? (groups as Ipv6Groups) : null;
}

/**
 * The key a client address is counted under, or `null` when `raw` is not a
 * literal IP address. IPv4 stays as it is; an IPv4-mapped IPv6 address
 * ("::ffff:a.b.c.d") counts as the IPv4 address; any other IPv6 address counts
 * as its /64 prefix ("2001:db8:1:2::/64"), because a single client can hold a
 * whole /64, so all of its addresses are counted as one client.
 */
export function normalizeClientIp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > MAX_IP_TEXT_LENGTH) return null;
  // A zone id ("fe80::1%eth0") is not something a proxy sends for a client.
  if (value.includes('%')) return null;

  const family = net.isIP(value);
  if (family === 4) return value;
  if (family !== 6) return null;

  const groups = ipv6Groups(value);
  if (!groups) return null;

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0xffff
  ) {
    return `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`;
  }
  return `${[g0, g1, g2, g3].map((group) => group.toString(16)).join(':')}::/64`;
}

/**
 * The rate-limit key for a connecting client: the `X-Real-IP` Nginx set, else
 * the address of the connection itself, else `UNKNOWN_CLIENT`. A value that is
 * not a literal IP address is skipped, so nothing a client can choose becomes
 * a Redis key.
 */
export function getClientIp(socket: HandshakeSource): string {
  const header = socket.handshake.headers['x-real-ip'];
  const fromProxy = normalizeClientIp(
    Array.isArray(header) ? header[0] : header
  );
  if (fromProxy) return fromProxy;
  return normalizeClientIp(socket.handshake.address) ?? UNKNOWN_CLIENT;
}

const CLIENT_MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_TIMESTAMP_LENGTH = 64;

/**
 * Whether `payload` is a well-formed `client_message`: a plain object with a
 * safe `id`, a non-blank `text` of at most MAX_CLIENT_MESSAGE_LENGTH characters
 * (measured as sent, so surrounding whitespace cannot be used to exceed it), an
 * ISO-8601 `timestamp`, and a `topic` that is absent or one of the four chips.
 */
export function isValidClientMessagePayload(
  payload: unknown
): payload is ClientMessagePayload {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  const id = candidate['id'];
  const text = candidate['text'];
  const timestamp = candidate['timestamp'];
  const topic = candidate['topic'];

  if (typeof id !== 'string' || !CLIENT_MESSAGE_ID_PATTERN.test(id))
    return false;

  if (
    typeof text !== 'string' ||
    text.length > MAX_CLIENT_MESSAGE_LENGTH ||
    text.trim().length === 0
  ) {
    return false;
  }

  if (
    typeof timestamp !== 'string' ||
    timestamp.length > MAX_TIMESTAMP_LENGTH ||
    !ISO_TIMESTAMP_PATTERN.test(timestamp) ||
    Number.isNaN(Date.parse(timestamp))
  ) {
    return false;
  }

  if (
    topic !== undefined &&
    !(CLIENT_MESSAGE_TOPICS as readonly unknown[]).includes(topic)
  ) {
    return false;
  }

  return true;
}

/**
 * The contract's four fields and nothing else, so a client cannot park extra
 * data in the queue by adding properties to a valid message.
 */
export function pickClientMessage(
  payload: ClientMessagePayload
): ClientMessagePayload {
  return {
    id: payload.id,
    text: payload.text,
    timestamp: payload.timestamp,
    ...(payload.topic !== undefined ? { topic: payload.topic } : {}),
  };
}

/**
 * The BullMQ job id for a client message: the socket id and the client's own
 * id, so one client reusing an id can only collide with itself. BullMQ rejects
 * a custom id that contains ':' ("Custom Id cannot contain :"), and neither id
 * can contain '.', so '.' keeps the pair unambiguous.
 */
export function chatJobId(socketId: string, clientMessageId: string): string {
  return `${socketId}.${clientMessageId}`;
}
