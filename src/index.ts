import {Transmission} from '@ctrl/transmission';
import {setDefaultOpenAIKey} from '@openai/agents';
import {init} from '@sentry/node';
import {TelegramBot} from 'typescript-telegram-bot-api';

import {readdir} from 'node:fs/promises';

import {createAgent} from './agent';
import {createConfig} from './config';
import {organizeFiles, unrarFile} from './files';
import {makeFormatHelper} from './telegram';

async function main() {
  const config = await createConfig(process.env);

  init({dsn: config.sentryDsn});
  setDefaultOpenAIKey(config.openaiApiKey);

  const client = new Transmission({
    baseUrl: config.transmission.baseUrl,
    username: config.transmission.username,
    password: config.transmission.password,
  });

  const chat = new TelegramBot({botToken: config.telegram.token});

  const torrentId = config.torrentHash;
  const torrent = await client.getTorrent(torrentId);

  const helper = makeFormatHelper(torrent.name, config.categories);

  const message = await chat.sendMessage({
    text: helper.formatTorrentFinished(),
    chat_id: config.telegram.chatId,
    parse_mode: 'MarkdownV2',
  });

  async function replaceMessage(text: string) {
    await chat.deleteMessage({
      chat_id: config.telegram.chatId,
      message_id: message.message_id,
    });
    return chat.sendMessage({
      chat_id: config.telegram.chatId,
      parse_mode: 'MarkdownV2',
      text,
    });
  }

  const fileNames = torrent.raw.files.map((file: any) => file.name);

  function getCategoryPath(categoryId: string) {
    const category = config.categories.find(category => category.id === categoryId);

    if (!category) {
      throw new Error(`Unknown organization category: ${categoryId}`);
    }

    return category.path;
  }

  async function listCategoryTitles({category}: {category: string}) {
    try {
      return await readdir(getCategoryPath(category));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  async function checkCategoryTitleExists({
    category,
    name,
  }: {
    category: string;
    name: string;
  }) {
    const titles = await listCategoryTitles({category});
    return titles.find(title => title.toLowerCase() === name.toLowerCase()) ?? null;
  }

  const agent = createAgent({
    categories: config.categories,
    listCategoryTitles,
    checkCategoryTitleExists,
    unrarFile: ({rarFilePath}) => unrarFile(torrent.savePath, rarFilePath),
  });

  const classification = await agent.classifyTorrent({
    name: torrent.name,
    fileNames,
  });

  const organized = await organizeFiles(
    torrent.savePath,
    fileNames,
    classification.files,
    config,
  );

  const {moved, linked, exists, errors} = organized;

  // Only move torrents if we successfully organize the torrent
  const moveTorrent =
    [...moved, ...linked].length > 0 && errors.length === 0 && exists.length === 0;
  const moveCompleteDir = config.moveCompleteDir;

  if (moveTorrent && moveCompleteDir) {
    await client.moveTorrent(torrentId, moveCompleteDir);
  }

  const telegramMessage = helper.formatTorrentResults({
    classification,
    organized,
    torrentMoved: moveTorrent && Boolean(moveCompleteDir),
  });

  await replaceMessage(telegramMessage);
}

main();
