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
    .map(([season, episodeList]) => `Season ${season} Episode ${episodeList}`);

  const seasonList = items.map(label => `${label}`).join('\n');

  return `📺 ${escapeMarkdown(seriesName)}\n${seasonList}`;
}

function formatMovieFiles(files: MovieFile[]) {
  return files.map(movieFile => `🎬 ${escapeMarkdown(movieFile.title)}`).join('\n');
}

export function formatTorrentResults(options: FormatTorrentResultOptions): string {
  const {torrentName, classification, organized, torrentMoved} = options;
  const lines = [
    '📥 Finished torrent download',
    '',
    `${escapeMarkdown(classification.icon)} *${escapeMarkdown(torrentName)}*\n`,
    `${escapeMarkdown(classification.description)}`,
    '',
  ];

  const series = classification.files.filter(f => f.type === 'series');
  const movies = classification.files.filter(f => f.type === 'movie');

  // Group series together
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

  if (organized.errors || organized.exists || organized.linked) {
    lines.push('');
  }

  if (organized.linked.length > 0) {
    lines.push(`🔗 Linked: ${organized.linked.length} files`);
  }
  if (organized.moved.length > 0) {
    lines.push(`🗂️ Moved: ${organized.linked.length} files`);
  }
  if (organized.exists.length > 0) {
    lines.push(`⚠️ Skipped: ${organized.exists.length} files \\(already exist\\)`);
  }
  if (organized.errors.length > 0) {
    lines.push(`❌ Errors: ${organized.errors.length} files`);
  }

  if (torrentMoved) {
    lines.push('🗄️ Torrent moved to seeding directory');
  } else {
    lines.push('⚠️ Torrent left in download directory');
  }

  return lines.join('\n');
}

export function formatFailedClassification(torrentName: string): string {
  return [
    '📥 Finished torrent download',
    '',
    `*${escapeMarkdown(torrentName)}*`,
    '',
    '⚠️ AI failed to classify the torrent',
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

  try {
    await ofetch(`https://api.telegram.org/bot${token}/sendMessage`, options);
  } catch (error) {
    console.error('Failed to send telegram notification', error.data);
  }

  return null;
}
