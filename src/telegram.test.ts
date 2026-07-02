import {describe, expect, it} from 'vitest';

import type {ClassificationResult} from './agent';
import type {OrganizationResult} from './files';
import {makeFormatHelper} from './telegram';

describe('formatTelegramMessage', () => {
  it('should format message with series files', () => {
    const torrentName = 'Breaking.Bad.S01.1080p.BluRay';
    const classification: ClassificationResult = {
      icon: '🧪',
      description: 'Complete first season of Breaking Bad',
      files: [
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Breaking Bad',
          season: 1,
          episode: 1,
          episodeTitle: 'Pilot',
          filePath: 'Breaking.Bad.S01E01.Pilot.1080p.BluRay.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Breaking Bad',
          season: 1,
          episode: 2,
          episodeTitle: 'Cat in the Bag...',
          filePath: 'Breaking.Bad.S01E02.Cat.in.the.Bag.1080p.BluRay.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Breaking Bad',
          season: 1,
          episode: 3,
          episodeTitle: "...and the Bag's in the River",
          filePath: 'Breaking.Bad.S01E03.And.the.Bags.in.the.River.1080p.BluRay.mkv',
        },
      ],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: ['test1.mkv'],
      exists: [],
      errors: [],
    };

    const helper = makeFormatHelper(torrentName);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: true,
    });

    expect(message).toBe(
      [
        '📥 Torrent organized',
        '*Breaking\\.Bad\\.S01\\.1080p\\.BluRay*',
        '',
        '🧪 Complete first season of Breaking Bad',
        '',
        '📺 Breaking Bad',
        '\\- Season 1 Episode 1→3',
        '',
        '♻️ Linked: 1 files',
        '🗄️ Torrent moved to seeding directory',
      ].join('\n'),
    );
  });

  it('should format message with movie files', () => {
    const torrentName = 'The.Dark.Knight.2008.1080p.BluRay';
    const classification: ClassificationResult = {
      icon: '🦇',
      description: 'Christopher Nolan Batman film',
      files: [
        {
          layout: 'movie',
          category: 'movies',
          title: 'The Dark Knight',
          filePath: 'The.Dark.Knight.2008.1080p.BluRay.mkv',
        },
      ],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: [],
      exists: [],
      errors: [],
    };

    const helper = makeFormatHelper(torrentName);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: false,
    });

    expect(message).toBe(
      [
        '📥 Torrent organized',
        '*The\\.Dark\\.Knight\\.2008\\.1080p\\.BluRay*',
        '',
        '🦇 Christopher Nolan Batman film',
        '',
        '🎬 The Dark Knight',
        '',
        '⚠️ Torrent left in download directory',
      ].join('\n'),
    );
  });

  it('should include configured category labels', () => {
    const torrentName = 'Frieren.S01E01';
    const classification: ClassificationResult = {
      icon: '🪄',
      description: 'Anime episode',
      files: [
        {
          layout: 'series',
          category: 'anime',
          seriesTitle: 'Frieren: Beyond Journeys End',
          season: 1,
          episode: 1,
          episodeTitle: null,
          filePath: 'Frieren.S01E01.mkv',
        },
      ],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: ['Frieren.S01E01.mkv'],
      exists: [],
      errors: [],
    };

    const helper = makeFormatHelper(torrentName, [
      {
        id: 'anime',
        layout: 'series',
        path: '/media/anime',
        prompt: 'Japanese animation series',
        label: 'Anime',
        examples: ['anime example'],
      },
    ]);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: true,
    });

    expect(message).toContain('📺 \\[Anime\\] Frieren: Beyond Journeys End');
  });

  it('should format message with multiple series and seasons', () => {
    const torrentName = 'Mixed.TV.Pack';
    const classification: ClassificationResult = {
      icon: '🧪',
      description: 'Various TV episodes',
      files: [
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Breaking Bad',
          season: 1,
          episode: 1,
          episodeTitle: 'Pilot',
          filePath: 'Breaking.Bad.S01E01.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Breaking Bad',
          season: 2,
          episode: 1,
          episodeTitle: 'Seven Thirty-Seven',
          filePath: 'Breaking.Bad.S02E01.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Better Call Saul',
          season: 1,
          episode: 1,
          episodeTitle: 'Uno',
          filePath: 'Better.Call.Saul.S01E01.mkv',
        },
      ],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: [],
      exists: [],
      errors: [],
    };

    const helper = makeFormatHelper(torrentName);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: false,
    });

    expect(message).toBe(
      [
        '📥 Torrent organized',
        '*Mixed\\.TV\\.Pack*',
        '',
        '🧪 Various TV episodes',
        '',
        '📺 Breaking Bad',
        '\\- Season 1 Episode 1',
        '\\- Season 2 Episode 1',
        '',
        '📺 Better Call Saul',
        '\\- Season 1 Episode 1',
        '',
        '⚠️ Torrent left in download directory',
      ].join('\n'),
    );
  });

  it('should format message with mixed movies and series', () => {
    const torrentName = 'Mixed.Content.Pack';
    const classification: ClassificationResult = {
      icon: '🎥',
      description: 'Mixed movies and TV content',
      files: [
        {
          layout: 'movie',
          category: 'movies',
          title: 'Inception',
          filePath: 'Inception.2010.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Westworld',
          season: 1,
          episode: 1,
          episodeTitle: 'The Original',
          filePath: 'Westworld.S01E01.mkv',
        },
        {
          layout: 'movie',
          category: 'movies',
          title: 'Interstellar',
          filePath: 'Interstellar.2014.mkv',
        },
      ],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: [],
      exists: [],
      errors: [],
    };

    const helper = makeFormatHelper(torrentName);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: false,
    });

    expect(message).toBe(
      [
        '📥 Torrent organized',
        '*Mixed\\.Content\\.Pack*',
        '',
        '🎥 Mixed movies and TV content',
        '',
        '📺 Westworld',
        '\\- Season 1 Episode 1',
        '🎬 Inception',
        '🎬 Interstellar',
        '',
        '⚠️ Torrent left in download directory',
      ].join('\n'),
    );
  });

  it('should handle empty files array', () => {
    const torrentName = 'Empty.Torrent';
    const classification: ClassificationResult = {
      icon: '😶',
      description: 'No relevant files found',
      files: [],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: [],
      exists: [],
      errors: [],
    };

    const helper = makeFormatHelper(torrentName);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: false,
    });

    expect(message).toBe(
      [
        '📥 Torrent organized',
        '*Empty\\.Torrent*',
        '',
        '😶 No relevant files found',
        '',
        '⚠️ Torrent left in download directory',
      ].join('\n'),
    );
  });

  it('should group episodes correctly in ranges', () => {
    const torrentName = 'Series.Season.Pack';
    const classification: ClassificationResult = {
      icon: '👑',
      description: 'Complete season with sequential episodes',
      files: [
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Game of Thrones',
          season: 1,
          episode: 1,
          episodeTitle: 'Winter Is Coming',
          filePath: 'GoT.S01E01.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Game of Thrones',
          season: 1,
          episode: 2,
          episodeTitle: 'The Kingsroad',
          filePath: 'GoT.S01E02.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Game of Thrones',
          season: 1,
          episode: 3,
          episodeTitle: 'Lord Snow',
          filePath: 'GoT.S01E03.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Game of Thrones',
          season: 1,
          episode: 5,
          episodeTitle: 'The Wolf and the Lion',
          filePath: 'GoT.S01E05.mkv',
        },
      ],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: [],
      exists: [],
      errors: [],
    };

    const helper = makeFormatHelper(torrentName);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: false,
    });

    expect(message).toBe(
      [
        '📥 Torrent organized',
        '*Series\\.Season\\.Pack*',
        '',
        '👑 Complete season with sequential episodes',
        '',
        '📺 Game of Thrones',
        '\\- Season 1 Episode 1→3, 5',
        '',
        '⚠️ Torrent left in download directory',
      ].join('\n'),
    );
  });

  it('should sort episodes correctly with double digit numbers', () => {
    const torrentName = 'Series.Full.Season';
    const classification: ClassificationResult = {
      icon: '📝',
      description: 'Season with episodes 1-11 in mixed order',
      files: [
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Test Series',
          season: 2,
          episode: 10,
          episodeTitle: 'Episode 10',
          filePath: 'Test.S02E10.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Test Series',
          season: 2,
          episode: 1,
          episodeTitle: 'Episode 1',
          filePath: 'Test.S02E01.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Test Series',
          season: 2,
          episode: 11,
          episodeTitle: 'Episode 11',
          filePath: 'Test.S02E11.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Test Series',
          season: 2,
          episode: 2,
          episodeTitle: 'Episode 2',
          filePath: 'Test.S02E02.mkv',
        },
        {
          layout: 'series',
          category: 'tv-series',
          seriesTitle: 'Test Series',
          season: 2,
          episode: 9,
          episodeTitle: 'Episode 9',
          filePath: 'Test.S02E09.mkv',
        },
      ],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: [],
      exists: [],
      errors: [],
    };

    const helper = makeFormatHelper(torrentName);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: false,
    });

    expect(message).toBe(
      [
        '📥 Torrent organized',
        '*Series\\.Full\\.Season*',
        '',
        '📝 Season with episodes 1\\-11 in mixed order',
        '',
        '📺 Test Series',
        '\\- Season 2 Episode 1→2, 9→11',
        '',
        '⚠️ Torrent left in download directory',
      ].join('\n'),
    );
  });

  it('should escape markdown in error lines', () => {
    const torrentName = "Frieren - Beyond Journey's End";
    const classification: ClassificationResult = {
      icon: '📺',
      description: 'Series pack',
      files: [],
    };

    const organized: OrganizationResult = {
      moved: [],
      linked: ['S01E01.mkv'],
      exists: [],
      errors: [
        {
          filePath: 'S01E20.mkv',
          error:
            "ENOENT: no such file or directory, rename '/mnt/documents/downloads/torrents-complete/Frieren - Beyond Journey's End/S01E20.mkv' -> '/mnt/documents/multimedia/videos/series/Frieren: Beyond Journey's End/Season 1/S01E20.mkv'",
        },
      ],
    };

    const helper = makeFormatHelper(torrentName);
    const message = helper.formatTorrentResults({
      classification,
      organized,
      torrentMoved: false,
    });

    expect(message).toContain('❌ Errors: 1 files');
    expect(message).toContain(
      "- ENOENT: no such file or directory, rename '/mnt/documents/downloads/torrents\\-complete/Frieren \\- Beyond Journey's End/S01E20\\.mkv' \\-\\> '/mnt/documents/multimedia/videos/series/Frieren: Beyond Journey's End/Season 1/S01E20\\.mkv'",
    );
  });
});
