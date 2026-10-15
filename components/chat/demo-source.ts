/**
 * Where the Free tier's recorded example comes from (build step 7 part 8; ADR-072, plan decision D19).
 *
 * The recording is a real golden-scenario conversation replayed from storage (`config/reply/demo/`),
 * made from the replies of the language runs once Davin has approved them: build step 7 part 10. Until
 * that exists there is nothing to replay, and this says so by returning null; the panel then shows
 * that the example is not available yet instead of inventing one. The renderer (`demo-replay.tsx`) is
 * tested here on a fixture recording.
 *
 * @module components/chat/demo-source
 */

import type { DemoRecording } from './types';

export function loadDemo(language: string): DemoRecording | null {
  void language;
  return null;
}
