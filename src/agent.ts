import {Agent, run, tool, webSearchTool} from '@openai/agents';
import {z} from 'zod';

import {TorrentInfo} from './types';

const notPartOfTorrent = z
  .boolean()
  .describe('Indicates this file was not part of the torrent contents');

export const movieFileSchema = z
  .object({
    type: z.literal('movie'),
    title: z
      .string()
      .describe('Clean movie title without quality indicators, year, or release info'),
    filePath: z.string().describe('The media file path for the movie'),
    notPartOfTorrent,
  })
  .strict();

export const seriesFileSchema = z
  .object({
    type: z.literal('series'),
    seriesTitle: z
      .string()
      .describe('Clean TV series title without quality indicators or release info'),
    season: z.number().describe('Season number'),
    episode: z.number().describe('Episode number'),
    episodeTitle: z
      .string()
      .nullable()
      .describe('Clean episode title if available, otherwise null'),
    filePath: z.string().describe('The media file path for the episode'),
    notPartOfTorrent,
  })
  .strict();

export const fileSchema = z.discriminatedUnion('type', [
  movieFileSchema,
  seriesFileSchema,
]);

export const classificationSchema = z
  .object({
    files: z.array(fileSchema).describe('List of relevant files within the torrent.'),
    description: z.string().describe('A short description of this torrent'),
    icon: z
      .string()
      .describe(
        'A single emoji representing the media. Be more specific than 🎥, 🎬, or 📺'
      ),
  })
  .strict();

export type ClassificationResult = z.infer<typeof classificationSchema>;
export type SeriesFile = z.infer<typeof seriesFileSchema>;
export type MovieFile = z.infer<typeof movieFileSchema>;
export type ClassifiedFile = z.infer<typeof fileSchema>;

interface AgentConfig {
  /**
   * Returns a TV Series name that already is in the TV Series directory.
   */
  checkTvShowExists: (args: {name: string}) => Promise<string | null>;
  /**
   * Returns a list of all currently existing TV Series
   */
  listExistingTvSeries: () => Promise<string[]>;
  /**
   * Extracts the given rar file (path relative to the torrent save directory)
   * and returns a list of extracted files
   */
  unrarFile: (args: {rarFilePath: string}) => Promise<string[]>;
}

const INSTRUCTIONS = `
Your responsibility is to understand the contents of a downloaded torrent file
and categorize any TV Series Episodes and Movies.

For TV Series you should first check if the name of TV Series exists so we know
we're orgaizing our episodes into an existing folder. If it doesn't you should
check the list of all existing TV Series on my harddrive to see you may have
inferend the name of the Series incorrectly.

If you're not ABSOLUTELY sure of the name of the series or movie, use the
webSearchTool to verify. For example if the movie contains a year in the title,
it may be a remake of a movie released many years ago, and this version of the
movie should have the year in the title.

If the contents of the torrent contains a RAR archive (common in scene rips)
use the unrar_file tool to extract the archive and receive a list of extracted
media files. Take into considration if those files are the actual Movie or TV
Series mdia. Mark them with "notPartOfTorrent: true" in those cases.

Examples:
- "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP" → Movie: "The Dark Knight"
- "Breaking.Bad.S01E01.Pilot.1080p.WEB-DL.x264" → TV: series="Breaking Bad", season=1, episode=1, title="Pilot"
- "ubuntu-22.04.3-desktop-amd64.iso" → Skip (not media)
- "Sample.mkv" → Skip (sample file)

Only consider actual video files with common extensions (.mp4, .mkv, .avi, .mov, etc.).`;

export function createAgent(config: AgentConfig) {
  const checkTvShowExists = tool({
    name: 'check_tv_show_exists',
    description:
      'Checks if a TV Series exists on the filesystem. Returns the existing series name',
    parameters: z.object({name: z.string()}),
    strict: true,
    execute: config.checkTvShowExists,
  });

  const listExistingTvSeries = tool({
    name: 'list_existing_tv_series',
    description: 'Lists existing TV Series series names',
    parameters: z.object({}),
    strict: true,
    execute: config.listExistingTvSeries,
  });

  const unrarFile = tool({
    name: 'unrar_file',
    description: 'Extracts a RAR archive and returns a list of extracted files',
    parameters: z.object({rarFilePath: z.string()}),
    strict: true,
    execute: config.unrarFile,
  });

  const agent = new Agent({
    name: 'Torrent Organizer',
    instructions: INSTRUCTIONS,
    tools: [checkTvShowExists, listExistingTvSeries, unrarFile, webSearchTool()],
    outputType: classificationSchema,
  });

  async function classifyTorrent(info: TorrentInfo) {
    const torrentContext = `Torrent: ${info.name}\n\nFiles:\n${info.fileNames.join('\n')}`;

    const result = await run(agent, torrentContext);

    return result.finalOutput;
  }

  return {classifyTorrent};
}
