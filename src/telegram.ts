import {groupBy} from 'es-toolkit';
import {ofetch} from 'ofetch';
import {escapeMarkdown} from 'telegram-escape';

import {ClassificationResult, MovieFile, SeriesFile} from './agent';
import {config} from './config';

function stringifyRanges(nums: number[]): string[] {
  const groupedRanges = groupBy(
    nums.map((num, index) => ({num, index})),
    x => x.num - x.index
  );

  return Object.values(groupedRanges).map(g =>
    g.length === 1 ? String(g[0].num) : escapeMarkdown(`${g[0].num}..${g.at(-1)?.num}`)
  );
}

function formatSeriesFiles(seriesName: string, files: SeriesFile[]) {
  const seasons = groupBy(files, file => file.season);

  const items = Object.entries(seasons)
    .map(([season, files]) => [
      season,
      stringifyRanges(files.map(file => file.episode).toSorted()).join(', '),
    ])
    .map(([season, episodeList]) => `Season ${season} Episode ${episodeList}`);

  const seasonList = items.map(label => `${escapeMarkdown('-')} ${label}`).join('\n');

  return `📺 ${seriesName}\n${seasonList}`;
}

function formatMovieFiles(files: MovieFile[]) {
  return files.map(movieFile => `🎬 ${movieFile.title}`).join('\n');
}

export function formatTelegramMessage(
  torrentName: string,
  classification: ClassificationResult
): string {
  const lines = [
    '📥 Finished torrent download',
    '',
    `*${escapeMarkdown(torrentName)}*\n${escapeMarkdown(classification.description)}`,
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

  return lines.join('\n');
}

export async function notifyTelegram(text: string) {
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
