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

async function organizeFile(
  torrentPath: string,
  file: ClassifiedFile,
  config: Config
): Promise<'linked' | 'moved' | 'exists'> {
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

  if (file.notPartOfTorrent) {
    rename(fullSourcePath, targetPath);
  }

  await link(fullSourcePath, targetPath);
  console.log(`Hard linked: ${fullSourcePath} -> ${targetPath}`);

  return 'linked';
}

export async function organizeFiles(
  torrentPath: string,
  files: ClassifiedFile[],
  config: Config
): Promise<OrganizationResult> {
  const result: OrganizationResult = {
    moved: [],
    linked: [],
    exists: [],
    errors: [],
  };

  for (const file of files) {
    const {filePath} = file;

    try {
      const status = await organizeFile(torrentPath, file, config);
      result[status].push(filePath);
    } catch (error) {
      result.errors.push({filePath, error: String(error)});
      console.error(`Failed to hard link ${join(torrentPath, file.filePath)}:`, error);
    }
  }

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
    return [];
  }
}
