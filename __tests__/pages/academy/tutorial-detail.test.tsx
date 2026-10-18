/**
 * @jest-environment node
 *
 * /academy/[id] (Next.js remediation T2-a, ACT-06): the view-count UPDATE runs
 * inside after(), not in the render body.
 *
 * `after` is replaced by a recorder so the test decides when "the response has
 * been sent" and can look at what ran before and after that point.
 */
import { renderToStaticMarkup } from 'react-dom/server';

const afterCallbacks: Array<() => void | Promise<void>> = [];
jest.mock('next/server', () => ({
  __esModule: true,
  after: (cb: () => void | Promise<void>) => {
    afterCallbacks.push(cb);
  },
}));

jest.mock('next/navigation', () => ({
  __esModule: true,
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const mockGetPublished = jest.fn();
const mockIncrement = jest.fn();
const mockRelated = jest.fn();
jest.mock('@/lib/tutorials/service', () => ({
  __esModule: true,
  getPublishedTutorialById: (...a: unknown[]) => mockGetPublished(...a),
  incrementTutorialViewCount: (...a: unknown[]) => mockIncrement(...a),
  getRelatedTutorials: (...a: unknown[]) => mockRelated(...a),
}));

jest.mock('@/lib/i18n/server-locale', () => ({
  __esModule: true,
  getServerLanguage: () => Promise.resolve('en-US'),
}));

import TutorialDetailPage from '@/app/(marketing)/academy/[id]/page';

const tutorial = {
  id: 'tut-1',
  title: 'Reading the chart',
  description: 'How to read it',
  category: 'GETTING_STARTED',
  youtubeVideoId: 'dQw4w9WgXcQ',
  viewCount: 41,
  status: 'ACTIVE',
};

describe('TutorialDetailPage view counting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    afterCallbacks.length = 0;
    mockGetPublished.mockResolvedValue(tutorial);
    mockIncrement.mockResolvedValue(undefined);
    mockRelated.mockResolvedValue([]);
  });

  it('does not write while rendering; the UPDATE waits for after()', async () => {
    await TutorialDetailPage({ params: Promise.resolve({ id: 'tut-1' }) });

    expect(afterCallbacks).toHaveLength(1);
    expect(mockIncrement).not.toHaveBeenCalled();
  });

  it('increments exactly once, for this tutorial, when after() runs', async () => {
    await TutorialDetailPage({ params: Promise.resolve({ id: 'tut-1' }) });

    await afterCallbacks[0]!();

    expect(mockIncrement).toHaveBeenCalledTimes(1);
    expect(mockIncrement).toHaveBeenCalledWith('tut-1');
  });

  it('still shows the count including this view, computed from the row read before the write', async () => {
    const element = await TutorialDetailPage({
      params: Promise.resolve({ id: 'tut-1' }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain('42');
    expect(html).not.toContain('41 ');
  });

  it('registers nothing and writes nothing for an unknown or unpublished tutorial', async () => {
    mockGetPublished.mockResolvedValue(null);

    await expect(
      TutorialDetailPage({ params: Promise.resolve({ id: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(afterCallbacks).toHaveLength(0);
    expect(mockIncrement).not.toHaveBeenCalled();
  });

  it('registers nothing when the route has no id', async () => {
    await expect(
      TutorialDetailPage({
        params: Promise.resolve({} as { id: string }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(afterCallbacks).toHaveLength(0);
    expect(mockGetPublished).not.toHaveBeenCalled();
  });
});
