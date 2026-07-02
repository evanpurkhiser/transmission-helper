import {afterEach, describe, expect, it} from 'vitest';

import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {createConfig} from './config';

const baseEnv = {
  OPENAI_API_KEY: 'openai-key',
  TORRENT_HASH: 'torrent-hash',
  TRANSMISSION_BASE_URL: 'http://transmission:9091/',
  TELEGRAM_TOKEN: 'telegram-token',
  TELEGRAM_CHAT_ID: 'telegram-chat',
};

describe('createConfig', () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, {recursive: true, force: true});
      tempDir = null;
    }
  });

  it('loads organization categories from yaml', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'transmission-helper-'));
    const configPath = join(tempDir, 'config.yaml');

    await writeFile(
      configPath,
      [
        'categories:',
        '  movies:',
        '    layout: movie',
        '    path: /media/movies',
        '    prompt: Feature-length films',
        '    label: Movie',
        '    examples:',
        '      - |',
        '        "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"',
        '        -> layout: "movie"',
        '           category: "movies"',
        '           title: "The Dark Knight"',
        '           filePath: "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"',
        '  anime:',
        '    layout: series',
        '    path: /media/anime',
        '    prompt: Japanese animation series',
        '    examples:',
        '      - |',
        '        "Frieren.S01E01.1080p.WEB-DL.mkv"',
        '        -> layout: "series"',
        '           category: "anime"',
        '           seriesTitle: "Frieren: Beyond Journey\'s End"',
        '           season: 1',
        '           episode: 1',
        '           filePath: "Frieren.S01E01.1080p.WEB-DL.mkv"',
        'transmission:',
        '  username: user-from-file',
      ].join('\n'),
    );

    const config = await createConfig({
      ...baseEnv,
      TRANSMISSION_HELPER_CONFIG: configPath,
      TRANSMISSION_USERNAME: 'user-from-env',
    });

    expect(config.transmission.username).toBe('user-from-env');
    expect(config.categories).toEqual([
      {
        id: 'movies',
        layout: 'movie',
        path: '/media/movies',
        prompt: 'Feature-length films',
        label: 'Movie',
        examples: [
          [
            '"The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"',
            '-> layout: "movie"',
            '   category: "movies"',
            '   title: "The Dark Knight"',
            '   filePath: "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"\n',
          ].join('\n'),
        ],
      },
      {
        id: 'anime',
        layout: 'series',
        path: '/media/anime',
        prompt: 'Japanese animation series',
        label: 'Anime',
        examples: [
          [
            '"Frieren.S01E01.1080p.WEB-DL.mkv"',
            '-> layout: "series"',
            '   category: "anime"',
            '   seriesTitle: "Frieren: Beyond Journey\'s End"',
            '   season: 1',
            '   episode: 1',
            '   filePath: "Frieren.S01E01.1080p.WEB-DL.mkv"\n',
          ].join('\n'),
        ],
      },
    ]);
  });

  it('requires categories from yaml', async () => {
    await expect(
      createConfig({
        ...baseEnv,
        MOVIES_DIR: '/media/movies',
        TV_SERIES_DIR: '/media/series',
      }),
    ).rejects.toThrowError();
  });

  it('requires category layout', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'transmission-helper-'));
    const configPath = join(tempDir, 'config.yaml');

    await writeFile(
      configPath,
      [
        'categories:',
        '  movies:',
        '    path: /media/movies',
        '    prompt: Feature-length films',
      ].join('\n'),
    );

    await expect(
      createConfig({
        ...baseEnv,
        TRANSMISSION_HELPER_CONFIG: configPath,
      }),
    ).rejects.toThrowError();
  });

  it('requires category examples', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'transmission-helper-'));
    const configPath = join(tempDir, 'config.yaml');

    await writeFile(
      configPath,
      [
        'categories:',
        '  movies:',
        '    layout: movie',
        '    path: /media/movies',
        '    prompt: Feature-length films',
      ].join('\n'),
    );

    await expect(
      createConfig({
        ...baseEnv,
        TRANSMISSION_HELPER_CONFIG: configPath,
      }),
    ).rejects.toThrowError();
  });

  it('requires torrent hash from env', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'transmission-helper-'));
    const configPath = join(tempDir, 'config.yaml');

    await writeFile(
      configPath,
      [
        'categories:',
        '  movies:',
        '    layout: movie',
        '    path: /media/movies',
        '    prompt: Feature-length films',
        '    examples:',
        '      - |',
        '        "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"',
        '        -> layout: "movie"',
        '           category: "movies"',
        '           title: "The Dark Knight"',
        '           filePath: "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"',
      ].join('\n'),
    );

    await expect(
      createConfig({
        ...baseEnv,
        TRANSMISSION_HELPER_CONFIG: configPath,
        TORRENT_HASH: undefined,
      }),
    ).rejects.toThrowError();

    const config = await createConfig({
      ...baseEnv,
      TRANSMISSION_HELPER_CONFIG: configPath,
      TORRENT_HASH: 'env-torrent-hash',
    });

    expect(config.torrentHash).toBe('env-torrent-hash');
  });
});
