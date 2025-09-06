# Transmission Torrent Complete Script Implementation Plan

## Project Structure
```
transmission-notif/
├── index.ts (main script - replace existing empty file)
├── config.ts (configuration management)
├── types.ts (TypeScript type definitions)
├── services/
│   ├── transmission.ts (Transmission API client)
│   ├── openai.ts (OpenAI classification)
│   ├── telegram.ts (Telegram notifications)
│   └── filelink.ts (Hard-linking operations)
├── utils/
│   ├── logger.ts (Logging utilities)
│   └── validation.ts (Validation utilities)
└── package.json (dependencies already added)
```

## Implementation Steps

### 1. Environment & Configuration Setup
- Add missing dependencies: `ofetch` for Telegram API, `fs-extra` for file operations ✅
- Create configuration system for:
  - Transmission connection (host, port, credentials)
  - Directory paths (TV series dir, movies dir)
  - OpenAI API key
  - Telegram bot token & chat ID

### 2. Core Services Implementation

#### Transmission Service (`services/transmission.ts`)
- Initialize @ctrl/transmission client
- Fetch torrent info using `TR_TORRENT_ID` environment variable
- Extract file tree/list with full paths
- Handle connection errors gracefully

#### OpenAI Service (`services/openai.ts`)
- Use structured outputs with JSON schema for classification
- Schema will define: `{ type: "movie" | "tv-show" | "other", files: Array<MovieFile | TvFile> }`
- MovieFile: `{ type: "movie", title: string, filePath: string }`
- TvFile: `{ type: "tv-show", seriesTitle: string, season: number, episode: number, episodeTitle: string, filePath: string }`
- Robust prompt engineering for accurate media classification

#### File Linking Service (`services/filelink.ts`)
- Create hard links for classified files
- TV shows: `[tv-dir]/[clean-series]/Season [n]/S0[n]E0[n].[ext]`
- Movies: `[movies-dir]/[clean-title].[ext]`
- Handle file extension extraction and path sanitization
- Create directories as needed

#### Telegram Service (`services/telegram.ts`)
- Simple HTTP POST to Telegram Bot API using ofetch
- Format summary messages with consolidated episode ranges
- Example: "Nathan For You: Season 1 → Episodes 1-20, Season 2 → Episodes 1-10"
- Include total files moved and any errors

### 3. Main Script Logic (`index.ts`)
1. Read `TR_TORRENT_ID` from environment
2. Connect to Transmission and fetch torrent details
3. Get complete file tree for the torrent
4. Send file list to OpenAI for classification
5. Process each classified file:
   - Create appropriate directory structure
   - Create hard links to target locations
6. Send Telegram notification with summary
7. Handle all errors gracefully with logging

### 4. Type Definitions (`types.ts`)
- Define interfaces for torrent data, classification results, and configuration
- Ensure type safety throughout the application

### 5. Utility Functions
- Path sanitization for cross-platform compatibility
- Episode range consolidation logic
- Text cleaning utilities for titles
- Logging and validation utilities

## Key Features
- **Robust Error Handling**: Graceful failure modes with detailed logging
- **Type Safety**: Full TypeScript implementation
- **Configurable**: Environment-based configuration
- **Extensible**: Modular service-based architecture
- **Efficient**: Hard links instead of copies to save disk space

## Required Environment Variables
```bash
TRANSMISSION_BASE_URL=http://localhost:9091/
TRANSMISSION_PASSWORD=optional
TV_SERIES_DIR=/path/to/tv/series
MOVIES_DIR=/path/to/movies
OPENAI_API_KEY=your_openai_key
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TR_TORRENT_ID=torrent_id_from_transmission
```

## Testing Strategy
- Mock Transmission responses for development
- Test classification accuracy with sample file lists
- Validate file linking operations in sandbox environment
- Test Telegram notification formatting

This plan provides a comprehensive, maintainable solution that meets all requirements while following TypeScript best practices.