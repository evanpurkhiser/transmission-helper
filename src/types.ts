export interface TorrentInfo {
  name: string;
  fileNames: string[];
}

export interface MovieFile {
  type: 'movie';
  title: string;
  filePath: string;
}

export interface TvFile {
  type: 'tv-show';
  seriesTitle: string;
  season: number;
  episode: number;
  episodeTitle: string | null;
  filePath: string;
}

export interface ClassificationResult {
  files: Array<MovieFile | TvFile>;
}
