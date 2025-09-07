import {Transmission} from '@ctrl/transmission';
import {setDefaultOpenAIKey} from '@openai/agents';
import {init} from '@sentry/node';

import {readdir} from 'fs/promises';
import {join} from 'path';

import {createAgent} from './agent';
import {config} from './config';
import {hardLinkFiles} from './files';
import {
  formatFailedClassification,
  formatHardLinkResults,
  formatTorrentClassification,
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

  const torrent = await client.getTorrent(config.TORRENT_HASH);

  const fileNames = torrent.raw.files.map((file: any) =>
    file.name.split('/').slice(1).join('/')
  );

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

  const torrentDir = join(torrent.savePath, torrent.raw.files[0].name.split('/')[0]);

  const linkResults = await hardLinkFiles(torrentDir, classification.files);
  console.log('Link results:', linkResults);

  const telegramMessage = formatTorrentClassification(torrent.name, classification);
  await notifyTelegram(telegramMessage);

  const linkMessage = formatHardLinkResults(linkResults);
  await notifyTelegram(linkMessage);
}

main();
