import {groupBy} from 'es-toolkit';
import {escapeMarkdown} from 'telegram-escape';

import {ClassificationResult, MovieFile, SeriesFile} from './agent';
import {OrganizationResult} from './files';

export interface FormatTorrentResultOptions {
  classification: ClassificationResult;
  organized: OrganizationResult;
  torrentMoved: boolean;
}

function stringRange(nums: number[]): string[] {
  const groupedRanges = groupBy(
    nums.map((num, index) => ({num, index})),
    x => x.num - x.index
  );

  return Object.values(groupedRanges).map(g =>
    g.length === 1 ? String(g[0].num) : `${g[0].num}→${g.at(-1)?.num}`
  );
}

function formatSeriesFiles(seriesName: string, files: SeriesFile[]) {
  const seasons = groupBy(files, file => file.season);

  const items = Object.entries(seasons)
    .map(([season, files]) => [
      season,
      stringRange(files.map(file => file.episode).toSorted((a, b) => a - b)).join(', '),
    ])
    .map(([season, episodeList]) =>
      escapeMarkdown(`- Season ${season} Episode ${episodeList}`)
    );

  return `📺 ${escapeMarkdown(seriesName)}\n${items.join('\n')}`;
}

function formatMovieFiles(files: MovieFile[]) {
  return files.map(movieFile => `🎬 ${escapeMarkdown(movieFile.title)}`).join('\n');
}

export function makeFormatHelper(torrentName: string) {
  function formatTorrentFinished(): string {
    return [
      escapeMarkdown('📥 Torrent finished'),
      `*${escapeMarkdown(torrentName)}*`,
      '',
      '🧠 _Using AI to classify and organize_',
    ].join('\n');
  }

  function formatTorrentResults(options: FormatTorrentResultOptions): string {
    const {classification, organized, torrentMoved} = options;
    const lines = [
      escapeMarkdown('📥 Torrent organized'),
      `*${escapeMarkdown(torrentName)}*`,
      '',
      `${escapeMarkdown(classification.icon)} ${escapeMarkdown(classification.description)}`,
      '',
    ];

    const series = classification.files.filter(f => f.type === 'series');
    const movies = classification.files.filter(f => f.type === 'movie');

    const seriesList = Object.entries(groupBy(series, file => file.seriesTitle))
      .map(([seriesName, files]) => formatSeriesFiles(seriesName, files))
      .join('\n\n');

    if (seriesList) {
      lines.push(seriesList);
    }

    const movieList = formatMovieFiles(movies);

    if (movieList) {
      lines.push(movieList);
    }

    lines.push('');

    const {errors, exists, linked, moved} = organized;

    if (linked.length > 0) {
      lines.push(`♻️ Linked: ${linked.length} files`);
    }
    if (moved.length > 0) {
      lines.push(`🗂️ Moved: ${moved.length} files`);
    }
    if (exists.length > 0) {
      lines.push(`⚠️ Skipped: ${exists.length} files \\(already exist\\)`);
    }
    if (errors.length > 0) {
      lines.push(
        `**> ❌ Errors: ${errors.length} files`,
        '>',
        ...errors.map(i => `> - ${i.error}`),
        ''
      );
    }

    if (torrentMoved) {
      lines.push('🗄️ Torrent moved to seeding directory');
    } else {
      lines.push('⚠️ Torrent left in download directory');
    }

    return lines
      .join('\n')
      .replace(/\n\n\n+/, '\n\n')
      .trim();
  }

  function formatFailedClassification(): string {
    return [
      '⚠️ AI failed to classify torrent download',
      `*${escapeMarkdown(torrentName)}*`,
    ].join('\n');
  }

  return {
    formatTorrentFinished,
    formatTorrentResults,
    formatFailedClassification,
  };
}
