import {captureException} from '@sentry/node';

import {exec} from 'node:child_process';
import {existsSync} from 'node:fs';
import {link, mkdir, rename} from 'node:fs/promises';
import {dirname, extname, join} from 'node:path';
import {promisify} from 'node:util';

import type {ClassifiedFile} from './agent';
import type {CategoryConfig, Config} from './config';

const execAsync = promisify(exec);

function sanitizeFilename(filename: string): string {
  return (
    filename
      // oxlint-disable-next-line no-control-regex -- intentional null byte strip
      .replaceAll(/[/\\\0]/g, '')
      .replaceAll(/\s+/g, ' ')
      .trim()
  );
}

export interface OrganizationResult {
  moved: string[];
  linked: string[];
  exists: string[];
  errors: Array<{filePath: string; error: string}>;
}

function getCategory(categories: CategoryConfig[], categoryId: string): CategoryConfig {
  const category = categories.find(category => category.id === categoryId);

  if (!category) {
    throw new Error(`Unknown organization category: ${categoryId}`);
  }

  return category;
}

export async function organizeFiles(
  torrentPath: string,
  torrentFiles: string,
  files: ClassifiedFile[],
  config: Config,
): Promise<OrganizationResult> {
  const result: OrganizationResult = {
    moved: [],
    linked: [],
    exists: [],
    errors: [],
  };

  type Organization = 'linked' | 'moved' | 'exists';

  async function getTargetPath(file: ClassifiedFile, category: CategoryConfig) {
    if (file.layout === 'movie') {
      const ext = extname(file.filePath);
      const fileName = `${sanitizeFilename(file.title)}${ext}`;
      return join(category.path, fileName);
    }

    const ext = extname(file.filePath);
    const seasonDir = `Season ${file.season}`;
    const sanitizedSeriesTitle = sanitizeFilename(file.seriesTitle);
    const seasonPath = join(category.path, sanitizedSeriesTitle, seasonDir);

    if (!existsSync(seasonPath)) {
      await mkdir(seasonPath, {recursive: true});
    }

    const episodeNum = file.episode.toString().padStart(2, '0');
    const seasonNum = file.season.toString().padStart(2, '0');
    const fileName = `S${seasonNum}E${episodeNum}${ext}`;

    return join(seasonPath, fileName);
  }

  async function organizeFile(file: ClassifiedFile): Promise<Organization> {
    const fullSourcePath = join(torrentPath, file.filePath);
    const category = getCategory(config.categories, file.category);

    if (file.layout !== category.layout) {
      throw new Error(
        `Category ${category.id} uses ${category.layout} layout, got ${file.layout} layout`,
      );
    }

    const targetPath = await getTargetPath(file, category);

    if (existsSync(targetPath)) {
      console.log(`Skipped (already exists): ${fullSourcePath} -> ${targetPath}`);
      return 'exists';
    }

    // Files not part of the original torrent (such as files extracted from a
    // rar) are moved instead of linked.
    if (!torrentFiles.includes(file.filePath)) {
      await rename(fullSourcePath, targetPath);
      console.log(`Moved file: ${fullSourcePath} -> ${targetPath}`);
      return 'moved';
    }

    await link(fullSourcePath, targetPath);
    console.log(`Hard linked: ${fullSourcePath} -> ${targetPath}`);
    return 'linked';
  }

  async function safeOrganize(file: ClassifiedFile) {
    const {filePath} = file;

    try {
      const status = await organizeFile(file);
      result[status].push(filePath);
    } catch (error) {
      result.errors.push({filePath, error: String(error)});
      console.error(`Failed to hard link ${join(torrentPath, file.filePath)}:`, error);
      captureException(error);
    }
  }

  await Promise.all(files.map(file => safeOrganize(file)));

  return result;
}

export async function unrarFile(
  basePath: string,
  rarFilePath: string,
): Promise<string[]> {
  try {
    const fullRarPath = join(basePath, rarFilePath);
    const extractDir = join(basePath, dirname(rarFilePath));

    // First get the list of files
    const {stdout: listOutput} = await execAsync(`unrar lb "${fullRarPath}"`);

    const fileList = listOutput
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(fileName => join(dirname(rarFilePath), fileName));

    await execAsync(`unrar e -o+ "${fullRarPath}" "${extractDir}/"`);

    return fileList;
  } catch (error) {
    console.error(`Failed to extract RAR file ${rarFilePath}:`, error);
    captureException(error);
    return [];
  }
}
