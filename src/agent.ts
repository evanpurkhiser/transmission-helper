import {Agent, run, tool, webSearchTool} from '@openai/agents';
import {z} from 'zod';

import type {CategoryConfig} from './config';
import {stripCitations} from './text-utils';
import type {TorrentInfo} from './types';

const filePath = z
  .string()
  .describe(
    'The media physical file path (.mkv, .mp4, .avi, etc). Will be used to relocate the file so it MUST be a proper path.',
  );

export interface FileLayoutMovie {
  layout: 'movie';
  category: string;
  title: string;
  filePath: string;
}

export interface FileLayoutSeries {
  layout: 'series';
  category: string;
  seriesTitle: string;
  season: number;
  episode: number;
  episodeTitle: string | null;
  filePath: string;
}

export type ClassifiedFile = FileLayoutMovie | FileLayoutSeries;

export interface ClassificationResult {
  files: ClassifiedFile[];
  description: string;
  icon: string;
}

interface AgentConfig {
  categories: CategoryConfig[];
  /**
   * Returns an existing title within a category directory, if present.
   */
  checkCategoryTitleExists: (args: {
    category: string;
    name: string;
  }) => Promise<string | null>;
  /**
   * Returns a list of existing titles within a category directory.
   */
  listCategoryTitles: (args: {category: string}) => Promise<string[]>;
  /**
   * Extracts the given rar file (path relative to the torrent save directory)
   * and returns a list of extracted files
   */
  unrarFile: (args: {rarFilePath: string}) => Promise<string[]>;
}

function categoryIds(categories: CategoryConfig[]): [string, ...string[]] {
  const [first, ...rest] = categories.map(category => category.id);

  if (!first) {
    throw new Error('At least one category must be configured');
  }

  return [first, ...rest];
}

function categoriesWithLayout(
  categories: CategoryConfig[],
  layout: CategoryConfig['layout'],
) {
  return categories.filter(category => category.layout === layout);
}

function createMovieLayoutSchema(categories: CategoryConfig[]) {
  if (categories.length === 0) {
    return null;
  }

  return z
    .object({
      layout: z.literal('movie'),
      category: z
        .enum(categoryIds(categories))
        .describe('A configured movie organization category for this file.'),
      title: z
        .string()
        .describe('Clean movie title without quality indicators, year, or release info'),
      filePath,
    })
    .strict();
}

function createSeriesLayoutSchema(categories: CategoryConfig[]) {
  if (categories.length === 0) {
    return null;
  }

  return z
    .object({
      layout: z.literal('series'),
      category: z
        .enum(categoryIds(categories))
        .describe('A configured series organization category for this file.'),
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
    })
    .strict();
}

function createClassificationSchema(categories: CategoryConfig[]) {
  const movieSchema = createMovieLayoutSchema(categoriesWithLayout(categories, 'movie'));
  const seriesSchema = createSeriesLayoutSchema(
    categoriesWithLayout(categories, 'series'),
  );

  const fileSchema =
    movieSchema && seriesSchema
      ? z.discriminatedUnion('layout', [movieSchema, seriesSchema])
      : (movieSchema ?? seriesSchema);

  if (!fileSchema) {
    throw new Error('At least one category must be configured');
  }

  return z
    .object({
      files: z.array(fileSchema).describe('List of relevant files within the torrent.'),
      description: z.string().describe('A short description of this torrent'),
      icon: z
        .string()
        .describe(
          'A single emoji representing the media. Try to be specific to the movie or series!',
        ),
    })
    .strict();
}

function formatCategoryExample(example: string) {
  return example
    .trim()
    .split('\n')
    .map(line => `   ${line}`)
    .join('\n');
}

function createInstructions(categories: CategoryConfig[]) {
  if (categories.length === 0) {
    throw new Error('At least one category must be configured');
  }

  const categoryList = categories
    .map(category =>
      [
        ` - ${category.id} (${category.label}, ${category.layout} layout): ${category.prompt}`,
        '',
        '   Examples:',
        category.examples.map(formatCategoryExample).join('\n\n'),
      ].join('\n'),
    )
    .join('\n\n');

  return `
You are an expert on bit torrent "scene" releases, movies, and tv series. You're
especially good at looking at the file list from a torrent, and categorizing
media files.

Preprocessing the file list:

 - If the the torrent contains a .rar archive file use the unrar_file tool to
   extract the archive and receive a list of extracted files. If any of the
   files are considered as media for our final file list, be sure to set the
   filePath as the extracted file, not the source archive.

Configured organization categories:

${categoryList}

Rules for categorization:

 - Every returned file MUST include one of the configured category IDs.

 - The category chooses the destination library path and layout. Use the
   category prompt to decide precedence when more than one category could apply.

 - Use layout "movie" for feature-length films and one-off videos. Use layout
   "series" for episodic media that has seasons and episode numbers. The file
   layout MUST match the configured layout for the selected category.

 - For series first check if the title exists in the selected category so we
   know we're organizing episodes into an existing folder. If it doesn't, you
   should check the list of existing titles in that category to see if you may
   have inferred the series name incorrectly.

 - If you're not ABSOLUTELY sure of the name of the series or movie, use the
   webSearchTool to verify. For example if the movie contains a year in the
   title, it may be a remake of a movie released many years ago, and this version
   of the movie should have the year in the title.

 - Only consider actual video files with common extensions (.mp4, .mkv, .avi,
   etc.) for the final list of files. Files such as ISOs, EXEs, text files,
   .nfo files, archive files, images, subtitles, etc should NEVER appear as a
   'filePath' in the final output list!

 - "ubuntu-22.04.3-desktop-amd64.iso"
   → Ignored (not media)

 - "Sample.mkv"
   → Ignored (sample file)
`.trim();
}

export function createAgent(config: AgentConfig) {
  const category = z.enum(categoryIds(config.categories));

  const checkCategoryTitleExists = tool({
    name: 'check_category_title_exists',
    description:
      'Checks if a title exists on the filesystem for a configured organization category. Returns the existing title name.',
    parameters: z.object({category, name: z.string()}),
    strict: true,
    execute: config.checkCategoryTitleExists,
  });

  const listCategoryTitles = tool({
    name: 'list_category_titles',
    description: 'Lists existing title names for a configured organization category',
    parameters: z.object({category}),
    strict: true,
    execute: config.listCategoryTitles,
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
    model: 'gpt-5-mini',
    instructions: createInstructions(config.categories),
    tools: [checkCategoryTitleExists, listCategoryTitles, unrarFile, webSearchTool()],
    outputType: createClassificationSchema(config.categories),
  });

  async function classifyTorrent(info: TorrentInfo): Promise<ClassificationResult> {
    const torrentContext = `Torrent: ${info.name}\n\nFiles:\n${info.fileNames.join('\n')}`;

    const result = await run(agent, torrentContext);

    if (!result.finalOutput) {
      throw new Error('Agent failed to produce output');
    }

    return {
      ...result.finalOutput,
      description: stripCitations(result.finalOutput.description),
    };
  }

  return {classifyTorrent};
}
