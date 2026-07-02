import {afterEach, describe, expect, it, vi} from 'vitest';

import {mkdir, mkdtemp, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import type {Config} from './config';
import {organizeFiles} from './files';

describe('organizeFiles', () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, {recursive: true, force: true});
      tempDir = null;
    }

    vi.restoreAllMocks();
  });

  it('organizes series files into their configured category path', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'transmission-helper-'));

    const torrentPath = join(tempDir, 'torrent');
    const animePath = join(tempDir, 'anime');
    const sourceFile = 'Frieren.S01E01.mkv';
    const targetPath = join(
      animePath,
      'Frieren: Beyond Journeys End',
      'Season 1',
      'S01E01.mkv',
    );

    await mkdir(torrentPath);
    await writeFile(join(torrentPath, sourceFile), 'episode');

    const config: Config = {
      openaiApiKey: 'openai-key',
      torrentHash: 'torrent-hash',
      transmission: {baseUrl: 'http://transmission:9091/'},
      telegram: {token: 'telegram-token', chatId: 'telegram-chat'},
      categories: [
        {
          id: 'anime',
          layout: 'series',
          path: animePath,
          prompt: 'Japanese animation series',
          label: 'Anime',
          examples: ['anime example'],
        },
      ],
    };

    const result = await organizeFiles(
      torrentPath,
      sourceFile,
      [
        {
          layout: 'series',
          category: 'anime',
          seriesTitle: 'Frieren: Beyond Journeys End',
          season: 1,
          episode: 1,
          episodeTitle: null,
          filePath: sourceFile,
        },
      ],
      config,
    );

    expect(result).toEqual({
      moved: [],
      linked: [sourceFile],
      exists: [],
      errors: [],
    });
    expect((await stat(targetPath)).ino).toBe(
      (await stat(join(torrentPath, sourceFile))).ino,
    );
  });

  it('organizes movie files into their configured category path', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'transmission-helper-'));

    const torrentPath = join(tempDir, 'torrent');
    const moviesPath = join(tempDir, 'movies');
    const sourceFile = 'The.Dark.Knight.2008.mkv';
    const targetPath = join(moviesPath, 'The Dark Knight.mkv');

    await mkdir(torrentPath);
    await mkdir(moviesPath);
    await writeFile(join(torrentPath, sourceFile), 'movie');

    const config: Config = {
      openaiApiKey: 'openai-key',
      torrentHash: 'torrent-hash',
      transmission: {baseUrl: 'http://transmission:9091/'},
      telegram: {token: 'telegram-token', chatId: 'telegram-chat'},
      categories: [
        {
          id: 'movies',
          layout: 'movie',
          path: moviesPath,
          prompt: 'Feature-length films',
          label: 'Movie',
          examples: ['movie example'],
        },
      ],
    };

    const result = await organizeFiles(
      torrentPath,
      sourceFile,
      [
        {
          layout: 'movie',
          category: 'movies',
          title: 'The Dark Knight',
          filePath: sourceFile,
        },
      ],
      config,
    );

    expect(result).toEqual({
      moved: [],
      linked: [sourceFile],
      exists: [],
      errors: [],
    });
    expect((await stat(targetPath)).ino).toBe(
      (await stat(join(torrentPath, sourceFile))).ino,
    );
  });

  it('reports an error when file layout does not match category layout', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'transmission-helper-'));

    const torrentPath = join(tempDir, 'torrent');
    const sourceFile = 'Totoro.mkv';

    await mkdir(torrentPath);
    await writeFile(join(torrentPath, sourceFile), 'movie');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const config: Config = {
      openaiApiKey: 'openai-key',
      torrentHash: 'torrent-hash',
      transmission: {baseUrl: 'http://transmission:9091/'},
      telegram: {token: 'telegram-token', chatId: 'telegram-chat'},
      categories: [
        {
          id: 'anime',
          layout: 'series',
          path: join(tempDir, 'anime'),
          prompt: 'Japanese animation series',
          label: 'Anime',
          examples: ['anime example'],
        },
      ],
    };

    const result = await organizeFiles(
      torrentPath,
      sourceFile,
      [
        {
          layout: 'movie',
          category: 'anime',
          title: 'My Neighbor Totoro',
          filePath: sourceFile,
        },
      ],
      config,
    );

    expect(result.moved).toEqual([]);
    expect(result.linked).toEqual([]);
    expect(result.exists).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      filePath: sourceFile,
      error: 'Error: Category anime uses series layout, got movie layout',
    });
  });

  it('reports an error for unknown categories', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'transmission-helper-'));

    const torrentPath = join(tempDir, 'torrent');
    const sourceFile = 'Unknown.mkv';

    await mkdir(torrentPath);
    await writeFile(join(torrentPath, sourceFile), 'movie');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const config: Config = {
      openaiApiKey: 'openai-key',
      torrentHash: 'torrent-hash',
      transmission: {baseUrl: 'http://transmission:9091/'},
      telegram: {token: 'telegram-token', chatId: 'telegram-chat'},
      categories: [
        {
          id: 'movies',
          layout: 'movie',
          path: join(tempDir, 'movies'),
          prompt: 'Feature-length films',
          label: 'Movie',
          examples: ['movie example'],
        },
      ],
    };

    const result = await organizeFiles(
      torrentPath,
      sourceFile,
      [
        {
          layout: 'movie',
          category: 'documentaries',
          title: 'Unknown',
          filePath: sourceFile,
        },
      ],
      config,
    );

    expect(result.moved).toEqual([]);
    expect(result.linked).toEqual([]);
    expect(result.exists).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      filePath: sourceFile,
      error: 'Error: Unknown organization category: documentaries',
    });
  });
});
