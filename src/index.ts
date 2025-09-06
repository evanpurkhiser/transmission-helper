import {Transmission} from '@ctrl/transmission';
import OpenAI from 'openai';

import {classifyFiles} from './prompt';

async function main() {
  const torrentId = process.env.TR_TORRENT_HASH;

  const moviesDir = process.env.MOVIES_DIR;
  const tvShowsDir = process.env.TV_SHOWS_DIR;

  if (!torrentId) {
    console.error('TR_TORRENT_HASH environment variable is required');
    process.exit(1);
  }

  const client = new Transmission({
    baseUrl: process.env.TRANSMISSION_BASE_URL,
    username: process.env.TRANSMISSION_USERNAME,
    password: process.env.TRANSMISSION_PASSWORD,
  });

  const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

  const torrent = await client.getTorrent(torrentId);

  const fileNames = torrent.raw.files.map((file: any) =>
    file.name.split('/').slice(1).join('/')
  );

  const classification = await classifyFiles(openai, {name: torrent.name, fileNames});

  console.log(classification);
}

main();
