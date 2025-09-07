import {z} from 'zod';

const configSchema = z.object({
  OPENAI_API_KEY: z.string(),
  TORRENT_HASH: z
    .string()
    .describe('Hash of the torrent being processed from Transmission'),
  MOVIES_DIR: z
    .string()
    .describe('Directory path where movie files should be organized into'),
  TV_SERIES_DIR: z
    .string()
    .describe('Directory path where TV show files should be organized into'),
  TRANSMISSION_BASE_URL: z
    .string()
    .url()
    .describe('Base URL for Transmission (e.g. http://localhost:9091/transmission/rpc)'),
  TRANSMISSION_USERNAME: z
    .string()
    .optional()
    .describe('Username for Transmission RPC authentication'),
  TRANSMISSION_PASSWORD: z
    .string()
    .optional()
    .describe('Password for Transmission RPC authentication'),
  TELEGRAM_TOKEN: z.string().describe('Bot token for Telegram notifications'),
  TELEGRAM_CHAT_ID: z.string().describe('Chat ID for sending Telegram notifications'),
});

export const config = configSchema.parse(process.env);
