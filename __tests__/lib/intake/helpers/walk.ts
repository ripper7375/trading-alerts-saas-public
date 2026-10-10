/**
 * Walking a packet and changing it at a path, for the tests that break packets one field
 * at a time. The "structured" part of a packet is everything except the interiors of the
 * free-form documents it carries (the sensors' envelopes, the SYN reading, the zones): a
 * missing key INSIDE one of those is the worker's business, not a violation of the contract.
 */

import { INTAKE_VERSION, ROUTING_VERSION, deriveTrace } from '@/lib/intake';

// A packet is taken apart and put together again in these tests; `any` keeps that readable.
export type Any = any;

export const FREE_FORM =
  /^(readings\.sensors\[\d+\]\.envelope|readings\.synthesis\.reading|readings\.synthesis\.zones\[\d+\]|trace\.sensor_statuses)$/;

export interface Node {
  path: string;
  value: unknown;
  parent: unknown;
  key: string | number;
}

function walk(
  value: unknown,
  path: string,
  out: Node[],
  parent: unknown = null,
  key: string | number = ''
): void {
  if (path !== '') out.push({ path, value, parent, key });
  if (FREE_FORM.test(path)) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`, out, value, i));
  } else if (typeof value === 'object' && value !== null) {
    for (const k of Object.keys(value)) {
      walk(
        (value as Record<string, unknown>)[k],
        path === '' ? k : `${path}.${k}`,
        out,
        value,
        k
      );
    }
  }
}

/** Every path of the structured part of a packet: free-form interiors are not entered. */
export function structured(packet: unknown): Node[] {
  const out: Node[] = [];
  walk(packet, '', out);
  return out;
}

/** The objects of the structured part (and the root), by path. */
export function structuredObjects(packet: unknown): string[] {
  const paths = structured(packet)
    .filter(
      ({ value, path }) =>
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !FREE_FORM.test(path)
    )
    .map(({ path }) => path);
  return ['', ...paths];
}

function parts(path: string): string[] {
  return path === '' ? [] : path.replace(/\[(\d+)\]/g, '.$1').split('.');
}

export function at(root: Any, path: string): Any {
  let node = root;
  for (const part of parts(path)) node = node[part];
  return node;
}

/** Set the value at `path` (a missing parent is a test bug, not a case). */
export function setAt(root: Any, path: string, value: unknown): void {
  const all = parts(path);
  const last = all.pop() as string;
  let node = root;
  for (const part of all) node = node[part];
  node[last] = value;
}

export function deleteAt(root: Any, path: string): void {
  const all = parts(path);
  const last = all.pop() as string;
  let node = root;
  for (const part of all) node = node[part];
  delete node[last];
}

/** The trace of a packet put together by hand: made again from what the packet now says. */
export function retrace(packet: Any): Any {
  const { trace: _old, ...body } = packet;
  return {
    ...body,
    trace: deriveTrace(body, {
      intake: INTAKE_VERSION,
      routing: ROUTING_VERSION,
    }),
  };
}
