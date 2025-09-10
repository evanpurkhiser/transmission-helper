import {Transmission} from '@ctrl/transmission';
import {setDefaultOpenAIKey} from '@openai/agents';
import {init} from '@sentry/node';
import {TelegramBot} from 'typescript-telegram-bot-api';

import {readdir} from 'fs/promises';

import {createAgent} from './agent';
import {createConfig} from './config';
import {organizeFiles, unrarFile} from './files';
import {makeFormatHelper} from './telegram';

async function main() {
  const config = createConfig(process.env);

  init({dsn: config.SENTRY_DSN});
  setDefaultOpenAIKey(config.OPENAI_API_KEY!);

  const client = new Transmission({
    baseUrl: config.TRANSMISSION_BASE_URL,
    username: config.TRANSMISSION_USERNAME,
    password: config.TRANSMISSION_PASSWORD,
  });

  const chat = new TelegramBot({botToken: config.TELEGRAM_TOKEN});

  const torrentId = config.TORRENT_HASH;
  const torrent = await client.getTorrent(torrentId);

  const helper = makeFormatHelper(torrent.name);

  const message = await chat.sendMessage({
    text: helper.formatTorrentFinished(),
    chat_id: config.TELEGRAM_CHAT_ID,
    parse_mode: 'MarkdownV2',
  });

  async function replaceMessage(text: string) {
    await chat.deleteMessage({
      chat_id: config.TELEGRAM_CHAT_ID,
      message_id: message.message_id,
    });
    return chat.sendMessage({
      chat_id: config.TELEGRAM_CHAT_ID,
      parse_mode: 'MarkdownV2',
      text,
    });
  }

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
    await replaceMessage(helper.formatFailedClassification());
    return;
  }

  const organized = await organizeFiles(
    torrent.savePath,
    fileNames,
    classification.files,
    config
  );

  const {moved, linked, exists, errors} = organized;

  // Only move torrents if we successfully organize the torrent
  const moveTorrent =
    [...moved, ...linked].length > 0 && errors.length === 0 && exists.length === 0;

  if (moveTorrent && !!config.MOVE_COMPLETE_DIR) {
    await client.moveTorrent(torrentId, config.MOVE_COMPLETE_DIR);
  }

  const telegramMessage = helper.formatTorrentResults({
    classification,
    organized,
    torrentMoved: moveTorrent && !!config.MOVE_COMPLETE_DIR,
  });

  await replaceMessage(telegramMessage);
}

main();
