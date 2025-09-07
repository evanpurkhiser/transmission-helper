import {existsSync} from 'fs';
import {link, mkdir} from 'fs/promises';
import {extname, join} from 'path';

import {ClassifiedFile} from './agent';
import {config} from './config';

export interface HardLinkResult {
  linked: string[];
  exists: string[];
  errors: Array<{filePath: string; error: string}>;
}

async function linkFile(
  torrentPath: string,
  file: ClassifiedFile
): Promise<'linked' | 'exists'> {
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

  await link(fullSourcePath, targetPath);
  console.log(`Hard linked: ${fullSourcePath} -> ${targetPath}`);

  return 'linked';
}

export async function hardLinkFiles(
  torrentPath: string,
  files: ClassifiedFile[]
): Promise<HardLinkResult> {
  const result: HardLinkResult = {
    linked: [],
    exists: [],
    errors: [],
  };

  for (const file of files) {
    const {filePath} = file;

    try {
      const status = await linkFile(torrentPath, file);
      result[status].push(filePath);
    } catch (error) {
      result.errors.push({filePath, error: String(error)});
      console.error(`Failed to hard link ${join(torrentPath, file.filePath)}:`, error);
    }
  }

  return result;
}
