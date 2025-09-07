## Transmission Helper

An AI-powered tool that automatically classifies and organizes completed
torrents from Transmission, then hard-links media files to your organized
library structure.

### Quick Start

```bash
docker run -d \
  -v /mnt/documents/:/mnt/documents/ \
  -e TORRENT_HASH="$TR_TORRENT_HASH" \
  -e OPENAI_API_KEY="your_openai_key" \
  -e TRANSMISSION_BASE_URL="http://transmission:9091/" \
  -e MOVIES_DIR="/mnt/documents/multimedia/movies" \
  -e TV_SERIES_DIR="/mnt/documents/multimedia/series" \
  -e TELEGRAM_TOKEN="your_bot_token" \
  -e TELEGRAM_CHAT_ID="your_chat_id" \
  evanpurkhiser/transmission-helper
```

### What It Does

1. **Fetches torrent info** from Transmission using the provided hash
2. **AI Classification** - Uses OpenAI to analyze file names and classify content as movies or TV series
3. **Smart Organization** - Matches TV series against existing library structure
4. **Hard Linking** - Creates hard links to allow continued seeding
5. **Telegram Notifications** - Sends detailed reports of what was processed and linked

### Environment Variables

- `TORRENT_HASH` - Hash of the completed torrent to process. Typically should be set
- `OPENAI_API_KEY` - OpenAI API key for content classification
- `TRANSMISSION_BASE_URL` - URL to Transmission RPC endpoint
- `TRANSMISSION_USERNAME` - (Optional) Transmission auth username
- `TRANSMISSION_PASSWORD` - (Optional) Transmission auth password
- `MOVIES_DIR` - Directory for organized movie files
- `TV_SERIES_DIR` - Directory for organized TV series
- `TELEGRAM_TOKEN` - Telegram bot token for notifications
- `TELEGRAM_CHAT_ID` - Telegram chat ID for notifications
- `TORRENTS_DIR_REMAP` - (Optional) Map host paths to container paths
- `SENTRY_DSN` - (Optional) Sentry DSN for error tracking
