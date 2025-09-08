import {Transmission} from '@ctrl/transmission';
import {setDefaultOpenAIKey} from '@openai/agents';
import {init} from '@sentry/node';

import {readdir} from 'fs/promises';

import {createAgent} from './agent';
import {createConfig} from './config';
import {organizeFiles, unrarFile} from './files';
import {
  formatFailedClassification,
  formatTorrentResults,
  notifyTelegram,
} from './telegram';

async function main() {
  const config = createConfig(process.env);

  init({dsn: config.SENTRY_DSN});
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
    const series = await listExistingTvSeries();
    return series.find(s => s.toLowerCase() === name.toLowerCase()) ?? null;
  }

  const agent = createAgent({
    listExistingTvSeries,
    checkTvShowExists,
    unrarFile: ({rarFilePath}) => unrarFile(torrent.savePath, rarFilePath),
  });

  const classification = await agent.classifyTorrent({
    name: torrent.name,
    fileNames,
  });

  if (classification === undefined) {
    await notifyTelegram(formatFailedClassification(torrent.name), config);
    return;
  }

  const organized = await organizeFiles(torrent.savePath, classification.files, config);

  const moveTorrent =
    organized.errors.length === 0 &&
    organized.linked.length + organized.exists.length > 0;

  if (moveTorrent && !!config.MOVE_COMPLETE_DIR) {
    await client.moveTorrent(torrentId, config.MOVE_COMPLETE_DIR);
  }

  const telegramMessage = formatTorrentResults({
    torrentName: torrent.name,
    classification,
    organized,
    torrentMoved: moveTorrent && !!config.MOVE_COMPLETE_DIR,
  });
  await notifyTelegram(telegramMessage, config);
}

main();
