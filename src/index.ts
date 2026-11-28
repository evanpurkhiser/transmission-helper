import {Transmission} from '@ctrl/transmission';
import {setDefaultOpenAIKey} from '@openai/agents';
import {init} from '@sentry/node';
import {TelegramBot} from 'typescript-telegram-bot-api';

import {readdir} from 'node:fs/promises';

import {createAgent} from './agent';
import {createConfig, type CategoryConfig, type Config} from './config';
import {getCompleteWantedFiles, organizeFiles, unrarFile} from './files';
import {makeFormatHelper} from './telegram';

async function startTelegramUpdate(
  chat: TelegramBot,
  chatId: Config['telegram']['chatId'],
  text: string,
) {
  const message = await chat.sendMessage({
    text,
    chat_id: chatId,
    parse_mode: 'MarkdownV2',
  });

  return async (updatedText: string) => {
    await chat.deleteMessage({chat_id: chatId, message_id: message.message_id});
    return chat.sendMessage({
      chat_id: chatId,
      parse_mode: 'MarkdownV2',
      text: updatedText,
    });
  };
}

async function moveOrganizedTorrent(
  client: Transmission,
  torrentId: string,
  {moved, linked, exists, errors}: Awaited<ReturnType<typeof organizeFiles>>,
  destination?: string,
) {
  if (
    !destination ||
    moved.length + linked.length === 0 ||
    errors.length ||
    exists.length
  ) {
    return false;
  }

  await client.moveTorrent(torrentId, destination);
  return true;
}

function categoryLookups(categories: readonly CategoryConfig[]) {
  function getCategoryPath(categoryId: string) {
    const category = categories.find(category => category.id === categoryId);

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

  return {listCategoryTitles, checkCategoryTitleExists};
}

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
  const replaceMessage = await startTelegramUpdate(
    chat,
    config.telegram.chatId,
    helper.formatTorrentFinished(),
  );

  const fileNames = getCompleteWantedFiles(torrent.raw.files, torrent.raw.fileStats);

  if (fileNames.length === 0) {
    await replaceMessage(helper.formatNoCompleteFiles());
    return;
  }

  const agent = createAgent({
    categories: config.categories,
    ...categoryLookups(config.categories),
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

  const torrentMoved = await moveOrganizedTorrent(
    client,
    torrentId,
    organized,
    config.moveCompleteDir,
  );

  const telegramMessage = helper.formatTorrentResults({
    classification,
    organized,
    torrentMoved,
  });

  await replaceMessage(telegramMessage);
}

main();
