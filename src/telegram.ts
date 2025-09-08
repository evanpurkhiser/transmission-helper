import {groupBy} from 'es-toolkit';
import {ofetch} from 'ofetch';
import {escapeMarkdown} from 'telegram-escape';

import {ClassificationResult, MovieFile, SeriesFile} from './agent';
import {Config} from './config';
import {OrganizationResult} from './files';

export interface FormatTorrentResultOptions {
  torrentName: string;
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
    .map(([season, episodeList]) => `- Season ${season} Episode ${episodeList}`);

  return `📺 ${escapeMarkdown(seriesName)}\n${items.join('\n')}`;
}

function formatMovieFiles(files: MovieFile[]) {
  return files.map(movieFile => `🎬 ${escapeMarkdown(movieFile.title)}`).join('\n');
}

export function formatTorrentResults(options: FormatTorrentResultOptions): string {
  const {torrentName, classification, organized, torrentMoved} = options;
  const lines = [
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

  const {errors, exists, linked, moved} = organized;

  if (linked.length > 0) {
    lines.push(`🔗 Linked: ${linked.length} files`);
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

  return lines.join('\n').replace(/\n\n\n+/, '\n\n');
}

export function formatFailedClassification(torrentName: string): string {
  return [
    '⚠️ AI failed to classify the torrent',
    `*${escapeMarkdown(torrentName)}*`,
  ].join('\n');
}

export function formatTorrentFinished(torrentName: string): string {
  return [
    escapeMarkdown('📥 Processing finished torrent...'),
    `*${escapeMarkdown(torrentName)}*`,
  ].join('\n');
}

export async function notifyTelegram(text: string, config: Config) {
  const token = config.TELEGRAM_TOKEN;
  const chatId = config.TELEGRAM_CHAT_ID;

  const data = {
    text,
    chat_id: chatId,
    parse_mode: 'MarkdownV2',
  };

  const options: RequestInit = {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {'content-type': 'application/json'},
  };

  await ofetch(`https://api.telegram.org/bot${token}/sendMessage`, options);
  return null;
}
