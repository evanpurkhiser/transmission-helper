import {Transmission} from '@ctrl/transmission';
import {setDefaultOpenAIKey} from '@openai/agents';
import {init} from '@sentry/node';

import {readdir} from 'fs/promises';

import {createAgent} from './agent';
import {config} from './config';
import {hardLinkFiles} from './files';
import {
  formatFailedClassification,
  formatTorrentResults,
  notifyTelegram,
} from './telegram';

init({dsn: config.SENTRY_DSN});

async function main() {
  setDefaultOpenAIKey(config.OPENAI_API_KEY!);

  const client = new Transmission({
    baseUrl: config.TRANSMISSION_BASE_URL,
    username: config.TRANSMISSION_USERNAME,
    password: config.TRANSMISSION_PASSWORD,
  });

  const torrentId = config.TORRENT_HASH;
  const torrent = await client.getTorrent(torrentId);

  const fileNames = torrent.raw.files.map((file: any) => file.name);

  function listExistingTvSeries() {
    return readdir(config.TV_SERIES_DIR);
  }

  async function checkTvShowExists({name}: {name: string}) {
    const existingSeries = await listExistingTvSeries();
    return (
      existingSeries.find(series => series.toLowerCase() === name.toLowerCase()) ?? null
    );
  }

  const agent = createAgent({
    listExistingTvSeries,
    checkTvShowExists,
  });

  const classification = await agent.classifyTorrent({
    name: torrent.name,
    fileNames,
  });

  if (classification === undefined) {
    await notifyTelegram(formatFailedClassification(torrent.name));
    return;
  }

  const linkResults = await hardLinkFiles(torrent.savePath, classification.files);

  const moveTorrent =
    linkResults.errors.length === 0 &&
    linkResults.linked.length + linkResults.exists.length > 0;

  if (moveTorrent && !!config.MOVE_COMPLETE_DIR) {
    await client.moveTorrent(torrentId, config.MOVE_COMPLETE_DIR);
  }

  const telegramMessage = formatTorrentResults({
    torrentName: torrent.name,
    classification,
    linkResults,
    wasMoved: moveTorrent && !!config.MOVE_COMPLETE_DIR,
  });
  await notifyTelegram(telegramMessage);
}

main();
