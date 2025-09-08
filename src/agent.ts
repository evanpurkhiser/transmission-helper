import {Agent, run, tool, webSearchTool} from '@openai/agents';
import {z} from 'zod';

import {TorrentInfo} from './types';

const notPartOfTorrent = z
  .boolean()
  .describe('Indicates this file was not part of the torrent contents');

const filePath = z
  .string()
  .describe(
    'The media physical file path. Will be used to relocate the file so it MUST be a proper path.'
  );

export const movieFileSchema = z
  .object({
    type: z.literal('movie'),
    title: z
      .string()
      .describe('Clean movie title without quality indicators, year, or release info'),
    filePath,
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
    filePath,
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
You are an expert on bit torrent "scene" releases, movies, and tv series. You're
especially good at looking at the file list from a torrent, and categorizing
media files.

Preprocessing the file list:

 - If the the torrent contains a .rar archive file (common in scene rips) use
   the unrar_file tool to extract the archive and receive a list of extracted
   media files. Take those files into considration. If any of the files are
   considered as media for our final file list, be sure to set the filePath as the
   extracted file and mark it as "notPartOfTorrent: true" in those cases.

Rules for categorization:

 - For TV Series you should first check if the name of TV Series exists so we know
   we're orgaizing our episodes into an existing folder. If it doesn't you
   should check the list of all existing TV Series on my harddrive to see you may
   have inferend the name of the Series incorrectly.

 - If you're not ABSOLUTELY sure of the name of the series or movie, use the
   webSearchTool to verify. For example if the movie contains a year in the
   title, it may be a remake of a movie released many years ago, and this version
   of the movie should have the year in the title.

 - Only consider actual video files with common extensions (.mp4, .mkv, .avi,
   .mov, etc.) for the final list of files. Skip things like ISOs, EXEs, text
   files, .nfo files, archive files, images, subtitles, etc.

Examples scenarios:

 - "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"
   → type: "movie",
     title: "The Dark Knight",
     filePath: "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"

 - "Breaking.Bad.S01E01.Pilot.1080p.WEB-DL.x264/S01E01.mkv"
   → type: "series",
     seriesTitle: "Breaking Bad",
     season: 1,
     episode: 1,
     filePath: "Breaking.Bad.S01E01.Pilot.1080p.WEB-DL.x264/S01E01.mkv"

 - "ubuntu-22.04.3-desktop-amd64.iso"
   → Skipped (not media)

 - "Sample.mkv"
   → Skip (sample file)

 - "Toy.Story/Toy.Story.rar"
    → Extract using unrar_file tool
    → Tool returns ["Toy.Story/Toy.Story.mkv"], this list of files is
      considered with the rest of the torrents files
    → type: "movie",
      title: "Toy Story",
      filePath: "Toy.Story/Toy.Story.mkv", (Note this is NOT the .rar file!)
      notPartOfTorrent: true

 - "A.Star.Is.Born.1976.mkv"
    → Web Search "a star is born" to see if the year is an important factor
    → type: "movie",
      title: "A Star Is Born (1976)" (there were multiple remakes with the same name)
`;

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
