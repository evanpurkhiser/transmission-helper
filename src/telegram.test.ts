import {describe, expect, it} from 'vitest';

import {ClassificationResult} from './agent';
import {formatTelegramMessage} from './telegram';

describe('formatTelegramMessage', () => {
  it('should format message with series files', () => {
    const torrentName = 'Breaking.Bad.S01.1080p.BluRay';
    const classification: ClassificationResult = {
      description: 'Complete first season of Breaking Bad',
      files: [
        {
          type: 'series',
          seriesTitle: 'Breaking Bad',
          season: 1,
          episode: 1,
          episodeTitle: 'Pilot',
          filePath: 'Breaking.Bad.S01E01.Pilot.1080p.BluRay.mkv',
        },
        {
          type: 'series',
          seriesTitle: 'Breaking Bad',
          season: 1,
          episode: 2,
          episodeTitle: 'Cat in the Bag...',
          filePath: 'Breaking.Bad.S01E02.Cat.in.the.Bag.1080p.BluRay.mkv',
        },
        {
          type: 'series',
          seriesTitle: 'Breaking Bad',
          season: 1,
          episode: 3,
          episodeTitle: "...and the Bag's in the River",
          filePath: 'Breaking.Bad.S01E03.And.the.Bags.in.the.River.1080p.BluRay.mkv',
        },
      ],
    };

    const result = formatTelegramMessage(torrentName, classification);

    expect(result).toBe(
      [
        '📥 Finished torrent download',
        '',
        '**Breaking.Bad.S01.1080p.BluRay**',
        'Complete first season of Breaking Bad',
        '',
        '**TV Series**',
        '',
        'Breaking Bad',
        '  **Season 1** Episode 1..3',
      ].join('\n')
    );
  });

  it('should format message with movie files', () => {
    const torrentName = 'The.Dark.Knight.2008.1080p.BluRay';
    const classification: ClassificationResult = {
      description: 'Christopher Nolan Batman film',
      files: [
        {
          type: 'movie',
          title: 'The Dark Knight',
          filePath: 'The.Dark.Knight.2008.1080p.BluRay.mkv',
        },
      ],
    };

    const result = formatTelegramMessage(torrentName, classification);

    expect(result).toBe(
      [
        '📥 Finished torrent download',
        '',
        '**The.Dark.Knight.2008.1080p.BluRay**',
        'Christopher Nolan Batman film',
        '',
        '**Movies**',
        '',
        'The Dark Knight',
      ].join('\n')
    );
  });

  it('should format message with multiple series and seasons', () => {
    const torrentName = 'Mixed.TV.Pack';
    const classification: ClassificationResult = {
      description: 'Various TV episodes',
      files: [
        {
          type: 'series',
          seriesTitle: 'Breaking Bad',
          season: 1,
          episode: 1,
          episodeTitle: 'Pilot',
          filePath: 'Breaking.Bad.S01E01.mkv',
        },
        {
          type: 'series',
          seriesTitle: 'Breaking Bad',
          season: 2,
          episode: 1,
          episodeTitle: 'Seven Thirty-Seven',
          filePath: 'Breaking.Bad.S02E01.mkv',
        },
        {
          type: 'series',
          seriesTitle: 'Better Call Saul',
          season: 1,
          episode: 1,
          episodeTitle: 'Uno',
          filePath: 'Better.Call.Saul.S01E01.mkv',
        },
      ],
    };

    const result = formatTelegramMessage(torrentName, classification);

    expect(result).toBe(
      [
        '📥 Finished torrent download',
        '',
        '**Mixed.TV.Pack**',
        'Various TV episodes',
        '',
        '**TV Series**',
        '',
        'Breaking Bad',
        '  **Season 1** Episode 1',
        '  **Season 2** Episode 1',
        '',
        'Better Call Saul',
        '  **Season 1** Episode 1',
      ].join('\n')
    );
  });

  it('should format message with mixed movies and series', () => {
    const torrentName = 'Mixed.Content.Pack';
    const classification: ClassificationResult = {
      description: 'Mixed movies and TV content',
      files: [
        {
          type: 'movie',
          title: 'Inception',
          filePath: 'Inception.2010.mkv',
        },
        {
          type: 'series',
          seriesTitle: 'Westworld',
          season: 1,
          episode: 1,
          episodeTitle: 'The Original',
          filePath: 'Westworld.S01E01.mkv',
        },
        {
          type: 'movie',
          title: 'Interstellar',
          filePath: 'Interstellar.2014.mkv',
        },
      ],
    };

    const result = formatTelegramMessage(torrentName, classification);

    expect(result).toBe(
      [
        '📥 Finished torrent download',
        '',
        '**Mixed.Content.Pack**',
        'Mixed movies and TV content',
        '',
        '**TV Series**',
        '',
        'Westworld',
        '  **Season 1** Episode 1',
        '**Movies**',
        '',
        'Inception',
        'Interstellar',
      ].join('\n')
    );
  });

  it('should handle empty files array', () => {
    const torrentName = 'Empty.Torrent';
    const classification: ClassificationResult = {
      description: 'No relevant files found',
      files: [],
    };

    const result = formatTelegramMessage(torrentName, classification);

    expect(result).toBe(
      [
        '📥 Finished torrent download',
        '',
        '**Empty.Torrent**',
        'No relevant files found',
        '',
      ].join('\n')
    );
  });

  it('should group episodes correctly in ranges', () => {
    const torrentName = 'Series.Season.Pack';
    const classification: ClassificationResult = {
      description: 'Complete season with sequential episodes',
      files: [
        {
          type: 'series',
          seriesTitle: 'Game of Thrones',
          season: 1,
          episode: 1,
          episodeTitle: 'Winter Is Coming',
          filePath: 'GoT.S01E01.mkv',
        },
        {
          type: 'series',
          seriesTitle: 'Game of Thrones',
          season: 1,
          episode: 2,
          episodeTitle: 'The Kingsroad',
          filePath: 'GoT.S01E02.mkv',
        },
        {
          type: 'series',
          seriesTitle: 'Game of Thrones',
          season: 1,
          episode: 3,
          episodeTitle: 'Lord Snow',
          filePath: 'GoT.S01E03.mkv',
        },
        {
          type: 'series',
          seriesTitle: 'Game of Thrones',
          season: 1,
          episode: 5,
          episodeTitle: 'The Wolf and the Lion',
          filePath: 'GoT.S01E05.mkv',
        },
      ],
    };

    const result = formatTelegramMessage(torrentName, classification);

    expect(result).toBe(
      [
        '📥 Finished torrent download',
        '',
        '**Series.Season.Pack**',
        'Complete season with sequential episodes',
        '',
        '**TV Series**',
        '',
        'Game of Thrones',
        '  **Season 1** Episode 1..3, 5',
      ].join('\n')
    );
  });
});
