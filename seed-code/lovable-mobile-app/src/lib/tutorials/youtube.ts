/**
 * YouTube URL Helpers (mobile reference)
 *
 * Mirrors lib/tutorials/youtube.ts from the monolith exactly -- pure, no-I/O
 * helpers for the Academy tutorials feature: parse a YouTube URL down to
 * its 11-character video ID, then derive thumbnail/embed URLs from that ID.
 *
 * @module lib/tutorials/youtube
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts an 11-character YouTube video ID from any of the URL shapes
 * YouTube itself hands out: `watch?v=`, `youtu.be/`, `embed/`, `shorts/`.
 * Returns `null` for anything that isn't a recognizable YouTube URL or
 * doesn't resolve to a validly-shaped ID.
 */
export function extractYouTubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (
    host !== 'youtube.com' &&
    host !== 'youtu.be' &&
    host !== 'youtube-nocookie.com'
  ) {
    return null;
  }

  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = parsed.pathname.slice(1).split('/')[0] ?? null;
  } else if (parsed.pathname === '/watch') {
    candidate = parsed.searchParams.get('v');
  } else {
    const match = parsed.pathname.match(/^\/(embed|shorts)\/([^/]+)/);
    if (match) {
      candidate = match[2] ?? null;
    }
  }

  if (!candidate || !VIDEO_ID_PATTERN.test(candidate)) {
    return null;
  }

  return candidate;
}

/** Always-available thumbnail size (480x360) -- unlike `maxresdefault`, this never 404s. */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Privacy-enhanced embed domain -- functionally identical to youtube.com, no cookie tracking. */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
