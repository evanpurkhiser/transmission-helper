import {captureException} from '@sentry/node';

import {exec} from 'child_process';
import {existsSync} from 'fs';
import {link, mkdir, rename} from 'fs/promises';
import {dirname, extname, join} from 'path';
import {promisify} from 'util';

import {ClassifiedFile} from './agent';
import {Config} from './config';

const execAsync = promisify(exec);

export interface OrganizationResult {
  moved: string[];
  linked: string[];
  exists: string[];
  errors: Array<{filePath: string; error: string}>;
}

export async function organizeFiles(
  torrentPath: string,
  torrentFiles: string,
  files: ClassifiedFile[],
  config: Config
): Promise<OrganizationResult> {
  const result: OrganizationResult = {
    moved: [],
    linked: [],
    exists: [],
    errors: [],
  };

  type Organization = 'linked' | 'moved' | 'exists';

  async function organizeFile(file: ClassifiedFile): Promise<Organization> {
    const fullSourcePath = join(torrentPath, file.filePath);
    let targetPath: string | null = null;

    if (file.type === 'movie') {
      const ext = extname(file.filePath);
      const fileName = `${file.title}${ext}`;
      targetPath = join(config.MOVIES_DIR, fileName);
    }

    if (file.type === 'series') {
      const ext = extname(file.filePath);
      const seasonDir = `Season ${file.season}`;
      const seasonPath = join(config.TV_SERIES_DIR, file.seriesTitle, seasonDir);

      if (!existsSync(seasonPath)) {
        await mkdir(seasonPath, {recursive: true});
      }

      const episodeNum = file.episode.toString().padStart(2, '0');
      const seasonNum = file.season.toString().padStart(2, '0');
      const fileName = `S${seasonNum}E${episodeNum}${ext}`;

      targetPath = join(seasonPath, fileName);
    }

    if (targetPath === null) {
      throw new Error('Invalid file type');
    }

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
  rarFilePath: string
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
