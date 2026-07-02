import {groupBy} from 'es-toolkit';
import {escapeMarkdown} from 'telegram-escape';

import type {ClassificationResult, FileLayoutMovie, FileLayoutSeries} from './agent';
import type {CategoryConfig} from './config';
import type {OrganizationResult} from './files';

export interface FormatTorrentResultOptions {
  classification: ClassificationResult;
  organized: OrganizationResult;
  torrentMoved: boolean;
}

function stringRange(nums: number[]): string[] {
  const groupedRanges = groupBy(
    nums.map((num, index) => ({num, index})),
    x => x.num - x.index,
  );

  return Object.values(groupedRanges).map(g =>
    g.length === 1 ? String(g[0].num) : `${g[0].num}→${g.at(-1)?.num}`,
  );
}

function formatCategoryTitle(
  categories: Map<string, string>,
  file: FileLayoutMovie | FileLayoutSeries,
  title: string,
) {
  const label = categories.get(file.category);

  return label ? `[${label}] ${title}` : title;
}

function formatSeriesFiles(
  categories: Map<string, string>,
  seriesName: string,
  files: FileLayoutSeries[],
) {
  const seasons = groupBy(files, file => file.season);
  const title = formatCategoryTitle(categories, files[0], seriesName);

  const items = Object.entries(seasons)
    .map(([season, files]) => [
      season,
      stringRange(files.map(file => file.episode).toSorted((a, b) => a - b)).join(', '),
    ])
    .map(([season, episodeList]) =>
      escapeMarkdown(`- Season ${season} Episode ${episodeList}`),
    );

  return `📺 ${escapeMarkdown(title)}\n${items.join('\n')}`;
}

function formatMovieFiles(categories: Map<string, string>, files: FileLayoutMovie[]) {
  return files
    .map(
      movieFile =>
        `🎬 ${escapeMarkdown(formatCategoryTitle(categories, movieFile, movieFile.title))}`,
    )
    .join('\n');
}

export function makeFormatHelper(torrentName: string, categories: CategoryConfig[] = []) {
  const categoryLabels = new Map(
    categories.map(category => [category.id, category.label] as const),
  );

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

    const series = classification.files.filter(f => f.layout === 'series');
    const movies = classification.files.filter(f => f.layout === 'movie');

    const seriesList = Object.values(
      groupBy(series, file => `${file.category}\0${file.seriesTitle}`),
    )
      .map(files => formatSeriesFiles(categoryLabels, files[0].seriesTitle, files))
      .join('\n\n');

    if (seriesList) {
      lines.push(seriesList);
    }

    const movieList = formatMovieFiles(categoryLabels, movies);

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
      lines.push(`❌ Errors: ${errors.length} files`);
      lines.push(...errors.map(i => `- ${escapeMarkdown(i.error)}`));
      lines.push('');
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

  return {
    formatTorrentFinished,
    formatTorrentResults,
  };
}
