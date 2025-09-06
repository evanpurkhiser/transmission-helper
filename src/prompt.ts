import {Agent, tool} from '@openai/agents';
import OpenAI from 'openai';
import z from 'zod';

import type {ClassificationResult, MovieFile, TorrentInfo, TvFile} from './types';

const MOVIE_FILE_PROPERTIES = {
  type: {
    description: 'The type of media file',
    type: 'string',
    enum: ['movie'],
  },
  title: {
    description: 'Clean movie title without quality indicators, year, or release info',
    type: 'string',
  },
  filePath: {
    description: 'The original file path from the torrent',
    type: 'string',
  },
} as const satisfies Record<keyof MovieFile, any>;

const TV_FILE_PROPERTIES = {
  type: {
    description: 'The type of media file',
    type: 'string',
    enum: ['tv-show'],
  },
  seriesTitle: {
    description: 'Clean TV series title without quality indicators or release info',
    type: 'string',
  },
  season: {
    description: 'Season number',
    type: 'number',
  },
  episode: {
    description: 'Episode number',
    type: 'number',
  },
  episodeTitle: {
    description: 'Clean episode title if available, otherwise null',
    type: ['string', 'null'],
  },
  filePath: {
    description: 'The original file path from the torrent',
    type: 'string',
  },
} as const satisfies Record<keyof TvFile, any>;

export const CLASSIFICATION_SCHEMA = {
  type: 'json_schema',
  name: 'file_classification',
  schema: {
    $defs: {
      MovieFile: {
        type: 'object',
        properties: MOVIE_FILE_PROPERTIES,
        required: Object.keys(MOVIE_FILE_PROPERTIES),
        additionalProperties: false,
      },
      TvFile: {
        type: 'object',
        properties: TV_FILE_PROPERTIES,
        required: Object.keys(TV_FILE_PROPERTIES),
        additionalProperties: false,
      },
    },
    type: 'object',
    properties: {
      files: {
        type: 'array',
        description: 'List of relevant files within the torrent.',
        items: {
          anyOf: [{$ref: '#/$defs/MovieFile'}, {$ref: '#/$defs/TvFile'}],
        },
      },
    },
    required: ['files'],
    additionalProperties: false,
  },
} as const;

export const CLASSIFICATION_PROMPT = `
Analyze the following torrent files and identify any movies or TV show
episodes. Only include video files that are clearly movies or TV episodes -
ignore non-media files, samples, extras, or anything that isn't a main video
file.

Examples:
- "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP" → Movie: "The Dark Knight"
- "Breaking.Bad.S01E01.Pilot.1080p.WEB-DL.x264" → TV: series="Breaking Bad", season=1, episode=1, title="Pilot"
- "ubuntu-22.04.3-desktop-amd64.iso" → Skip (not media)
- "Sample.mkv" → Skip (sample file)

If the torrent contains no movies or TV episodes (like software, music,
books, etc.), return an empty files array.

Only consider actual video files with common extensions (.mp4, .mkv, .avi, .mov, etc.).`;

async function existingTvShows(): Promise<string[]> {
  return ['The Studio', 'Cowboy Bebop'];
}

const checkTvShowExists = tool({
  name: 'check_tv_show_exists',
  description: 'Checks if a TV Show exists on the filesystem',
  parameters: z.string(),
  execute: async (): Promise<string | null> => null,
});

export async function classifyFiles(
  client: OpenAI,
  torrentInfo: TorrentInfo
): Promise<ClassificationResult> {
  const torrentContext = `Torrent: ${torrentInfo.name}\n\nFiles:\n${torrentInfo.fileNames.join('\n')}`;

  const response = await client.responses.create({
    model: 'o4-mini',
    text: {format: CLASSIFICATION_SCHEMA},
    input: [
      {
        role: 'system',
        content: CLASSIFICATION_PROMPT,
      },
      {
        role: 'user',
        content: torrentContext,
      },
    ],
  });

  return JSON.parse(response.output_text);
}
