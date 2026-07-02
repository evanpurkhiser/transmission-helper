## Transmission Helper

[![Build](https://github.com/evanpurkhiser/transmission-helper/actions/workflows/main.yml/badge.svg)](https://github.com/evanpurkhiser/transmission-helper/actions/workflows/main.yml)

An AI-powered tool that automatically classifies and organizes completed
torrents from Transmission, then hard-links media files to your organized
library structure.

### Quick Start

```bash
docker run -d \
  -v /mnt/documents/:/mnt/documents/ \
  -v ./transmission-helper.yaml:/config/transmission-helper.yaml:ro \
  -e TRANSMISSION_HELPER_CONFIG="/config/transmission-helper.yaml" \
  -e TORRENT_HASH="$TR_TORRENT_HASH" \
  -e OPENAI_API_KEY="your_openai_key" \
  -e TRANSMISSION_BASE_URL="http://transmission:9091/" \
  -e TELEGRAM_TOKEN="your_bot_token" \
  -e TELEGRAM_CHAT_ID="your_chat_id" \
  evanpurkhiser/transmission-helper
```

Example `transmission-helper.yaml`:

```yaml
categories:
  movies:
    layout: movie
    path: /mnt/documents/multimedia/videos/movies
    prompt: Anything that is a feature-length film or otherwise considered a movie.
    label: Movie
    examples:
      - |
        "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"
        -> layout: "movie"
           category: "movies"
           title: "The Dark Knight"
           filePath: "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"
      - |
        "Toy.Story/Toy.Story.rar"
        -> Extract using unrar_file tool
        -> Tool returns ["Toy.Story/Toy.Story.mkv"], this list of files is considered with the rest of the torrent files.
        -> Do NOT include the archive itself as a filePath in the final output.
        -> layout: "movie"
           category: "movies"
           title: "Toy Story"
           filePath: "Toy.Story/Toy.Story.mkv"
      - |
        "A.Star.Is.Born.1976.mkv"
        -> Web Search "a star is born" to see if the year is an important factor.
        -> layout: "movie"
           category: "movies"
           title: "A Star Is Born (1976)"
           filePath: "A.Star.Is.Born.1976.mkv"
  anime:
    layout: series
    path: /mnt/documents/multimedia/videos/anime
    prompt: A Japanese anime series produced and animated in Japan. Supersedes TV series, but anime movies should still use the movies category.
    label: Anime
    examples:
      - |
        "Frieren.S01E01.1080p.WEB-DL.mkv"
        -> layout: "series"
           category: "anime"
           seriesTitle: "Frieren: Beyond Journey's End"
           season: 1
           episode: 1
           filePath: "Frieren.S01E01.1080p.WEB-DL.mkv"
  tv-series:
    layout: series
    path: /mnt/documents/multimedia/videos/series
    prompt: A TV series with seasons and episodes.
    label: TV Series
    examples:
      - |
        "Breaking.Bad.S01E01.Pilot.1080p.WEB-DL.x264/S01E01.mkv"
        -> layout: "series"
           category: "tv-series"
           seriesTitle: "Breaking Bad"
           season: 1
           episode: 1
           filePath: "Breaking.Bad.S01E01.Pilot.1080p.WEB-DL.x264/S01E01.mkv"
```

### What It Does

1. **Fetches torrent info** from Transmission using the provided hash
2. **AI Classification** - Uses OpenAI to analyze file names and classify content into configured categories
3. **Smart Organization** - Matches series against existing category library structures
4. **Hard Linking** - Creates hard links to allow continued seeding
5. **Telegram Notifications** - Sends detailed reports of what was processed and linked

### Environment Variables

- `TRANSMISSION_HELPER_CONFIG` - Path to the YAML configuration file
- `TORRENT_HASH` - Hash of the completed torrent to process. Typically should be set
- `OPENAI_API_KEY` - OpenAI API key for content classification
- `TRANSMISSION_BASE_URL` - URL to Transmission RPC endpoint
- `TRANSMISSION_USERNAME` - (Optional) Transmission auth username
- `TRANSMISSION_PASSWORD` - (Optional) Transmission auth password
- `TELEGRAM_TOKEN` - Telegram bot token for notifications
- `TELEGRAM_CHAT_ID` - Telegram chat ID for notifications
- `TORRENTS_DIR_REMAP` - (Optional) Map host paths to container paths
- `SENTRY_DSN` - (Optional) Sentry DSN for error tracking

### YAML Configuration

The YAML file provides organization categories and can also provide stable
application settings. Values from environment variables override matching YAML
settings, which keeps secrets easy to inject at runtime. `TORRENT_HASH` is always
read from the environment because it is supplied per Transmission completion.

```yaml
openaiApiKey: your_openai_key
transmission:
  baseUrl: http://transmission:9091/
  username: optional_username
  password: optional_password
telegram:
  token: your_bot_token
  chatId: your_chat_id
sentryDsn: optional_sentry_dsn
moveCompleteDir: /mnt/documents/downloads/torrents-seeding

categories:
  movies:
    layout: movie
    path: /mnt/documents/multimedia/videos/movies
    prompt: Anything that is a feature-length film or otherwise considered a movie.
    label: Movie
    examples:
      - |
        "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"
        -> layout: "movie"
           category: "movies"
           title: "The Dark Knight"
           filePath: "The.Dark.Knight.2008.1080p.BluRay.x264-GROUP.mkv"
```

Each category must declare `layout: movie` or `layout: series`. Movie categories are
organized as single files under the category path, while series categories are
organized as `Series Title/Season N/SNNENN.ext`.
Each category also declares `examples` as literal block scalars used verbatim in
the AI classification prompt.
