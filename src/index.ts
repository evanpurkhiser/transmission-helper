import {Transmission} from '@ctrl/transmission';
import {setDefaultOpenAIKey} from '@openai/agents';

import {readdir} from 'fs/promises';

import {createAgent} from './agent';
import {config} from './config';
import {formatTelegramMessage, notifyTelegram} from './telegram';

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

  console.log(classification);

  const telegramMessage = formatTelegramMessage(torrent.name, classification);
  await notifyTelegram(telegramMessage);
}

main();
