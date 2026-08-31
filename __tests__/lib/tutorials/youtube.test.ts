/**
 * Academy Tutorials YouTube Helper Tests
 */

import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  getYouTubeEmbedUrl,
} from '@/lib/tutorials/youtube';

const VALID_ID = 'dQw4w9WgXcQ';

describe('extractYouTubeVideoId', () => {
  it('parses a standard watch URL', () => {
    expect(
      extractYouTubeVideoId(`https://www.youtube.com/watch?v=${VALID_ID}`)
    ).toBe(VALID_ID);
  });

  it('parses a watch URL with extra query params (timestamp, playlist)', () => {
    expect(
      extractYouTubeVideoId(
        `https://www.youtube.com/watch?v=${VALID_ID}&t=42&list=PL123`
      )
    ).toBe(VALID_ID);
  });

  it('parses a youtu.be short link', () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${VALID_ID}`)).toBe(
      VALID_ID
    );
  });

  it('parses a youtu.be short link with query params', () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${VALID_ID}?t=10`)).toBe(
      VALID_ID
    );
  });

  it('parses an embed URL', () => {
    expect(
      extractYouTubeVideoId(`https://www.youtube.com/embed/${VALID_ID}`)
    ).toBe(VALID_ID);
  });

  it('parses a youtube-nocookie embed URL', () => {
    expect(
      extractYouTubeVideoId(
        `https://www.youtube-nocookie.com/embed/${VALID_ID}`
      )
    ).toBe(VALID_ID);
  });

  it('parses a shorts URL', () => {
    expect(
      extractYouTubeVideoId(`https://www.youtube.com/shorts/${VALID_ID}`)
    ).toBe(VALID_ID);
  });

  it('parses a bare (no www) youtube.com host', () => {
    expect(
      extractYouTubeVideoId(`https://youtube.com/watch?v=${VALID_ID}`)
    ).toBe(VALID_ID);
  });

  it('parses a mobile (m.youtube.com) host', () => {
    expect(
      extractYouTubeVideoId(`https://m.youtube.com/watch?v=${VALID_ID}`)
    ).toBe(VALID_ID);
  });

  it('returns null for a non-YouTube URL', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/123456789')).toBeNull();
  });

  it('returns null for a malformed/non-URL string', () => {
    expect(extractYouTubeVideoId('not a url at all')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractYouTubeVideoId('')).toBeNull();
  });

  it('returns null for a youtube.com URL missing the v param', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch')).toBeNull();
  });

  it('returns null for an ID that is the wrong length', () => {
    expect(extractYouTubeVideoId('https://youtu.be/short')).toBeNull();
  });

  it('returns null for an ID with disallowed characters', () => {
    expect(extractYouTubeVideoId('https://youtu.be/inv@lid!!!!!')).toBeNull();
  });

  it('returns null for a youtube.com URL pointing at an unrelated path', () => {
    expect(
      extractYouTubeVideoId('https://www.youtube.com/channel/UC12345')
    ).toBeNull();
  });
});

describe('getYouTubeThumbnailUrl', () => {
  it('builds the hqdefault thumbnail URL for a given video ID', () => {
    expect(getYouTubeThumbnailUrl(VALID_ID)).toBe(
      `https://i.ytimg.com/vi/${VALID_ID}/hqdefault.jpg`
    );
  });
});

describe('getYouTubeEmbedUrl', () => {
  it('builds a privacy-enhanced (youtube-nocookie.com) embed URL', () => {
    expect(getYouTubeEmbedUrl(VALID_ID)).toBe(
      `https://www.youtube-nocookie.com/embed/${VALID_ID}`
    );
  });
});
