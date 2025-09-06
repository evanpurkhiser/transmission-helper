import {ofetch} from 'ofetch';

import type {ClassificationResult, MovieFile, TvFile} from './types';

export function formatTelegramMessage(
  torrentName: string,
  classification: ClassificationResult
): string {
  const lines = ['Finished torrent download\n', `**${torrentName}**\n`];

  const tvShows = classification.files.filter(f => f.type === 'tv-show');
  const movies = classification.files.filter(f => f.type === 'movie');

  // Group TV episodes by series and season
  const seriesMap = new Map<string, Map<number, number[]>>();

  for (const show of tvShows) {
    if (!seriesMap.has(show.seriesTitle)) {
      seriesMap.set(show.seriesTitle, new Map());
    }
    const seasons = seriesMap.get(show.seriesTitle)!;
    if (!seasons.has(show.season)) {
      seasons.set(show.season, []);
    }
    seasons.get(show.season)!.push(show.episode);
  }

  // Format TV shows
  for (const [seriesTitle, seasons] of seriesMap) {
    lines.push(`TV Show: ${seriesTitle}\n`);

    for (const [seasonNum, episodes] of seasons) {
      episodes.sort((a, b) => a - b);
      const ranges = consolidateEpisodeRanges(episodes);
      const rangeText = ranges
        .map(range =>
          range.start === range.end ? `${range.start}` : `${range.start} to ${range.end}`
        )
        .join(', ');

      lines.push(`Season ${seasonNum} -> Episode ${rangeText}\n`);
    }
    lines.push('');
  }

  // Format movies
  if (movies.length > 0) {
    lines.push('Movies:\n');
    for (const movie of movies) {
      lines.push(`${movie.title}\n`);
    }
  }

  return lines.join('').trim();
}

function consolidateEpisodeRanges(
  episodes: number[]
): Array<{start: number; end: number}> {
  if (episodes.length === 0) {
    return [];
  }

  const ranges: Array<{start: number; end: number}> = [];
  let start = episodes[0];
  let end = episodes[0];

  for (let i = 1; i < episodes.length; i++) {
    if (episodes[i] === end + 1) {
      end = episodes[i];
    } else {
      ranges.push({start, end});
      start = episodes[i];
      end = episodes[i];
    }
  }

  ranges.push({start, end});
  return ranges;
}

export async function notifyTelegram(text: string) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

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
  } catch {
    console.error('Failed to send telegram notification');
  }

  return null;
}
