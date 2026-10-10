/**
 * The ids and versions the intake path names in a packet and its trace
 * (architecture chapter 4, build step 6).
 *
 * Three kinds of id live here:
 *  - the SHAPE ids of the contracts (`intake-packet/1` and so on): they move
 *    only when a field's meaning changes, never for a new value of an enum;
 *  - `INTAKE_VERSION`, the release of the intake RULES (the normaliser, the
 *    scope check, the board, the router): change it, and say why in the
 *    commit, whenever one of them changes what a trader's question is routed
 *    to or what the board says for the same inputs;
 *  - `ROUTING_VERSION`, the dispatch matrix (4.5, "routing v1"), which a data
 *    file of part 4 will carry under the same id.
 *
 * @module lib/intake/version
 */

export const INTAKE_PACKET_SCHEMA = 'intake-packet/1';
export const INTAKE_REFUSAL_SCHEMA = 'intake-refusal/1';
export const UNDERSTAND_RESULT_SCHEMA = 'understand-result/1';
export const SENSOR_ROSTER_SCHEMA = 'sensor-roster/1';

export const INTAKE_VERSION = '1.0.0';
export const ROUTING_VERSION = 'routing-v1';
