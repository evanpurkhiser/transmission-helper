import {parse} from 'yaml';
import {z} from 'zod';

import {readFile} from 'node:fs/promises';

const categorySchema = z
  .object({
    layout: z.enum(['movie', 'series']),
    path: z.string().min(1),
    prompt: z.string().min(1),
    label: z.string().min(1).optional(),
    examples: z.array(z.string().min(1)).min(1),
  })
  .strict();

const categoryRecordSchema = z
  .record(z.string().regex(/^[a-z0-9][a-z0-9_-]*$/i), categorySchema)
  .refine(categories => Object.keys(categories).length > 0, {
    message: 'At least one category must be configured',
  });

const fileConfigSchema = z
  .object({
    openaiApiKey: z.string().min(1).optional(),
    transmission: z
      .object({
        baseUrl: z.string().url().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .strict()
      .optional(),
    telegram: z
      .object({
        token: z.string().min(1).optional(),
        chatId: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    sentryDsn: z.string().optional(),
    moveCompleteDir: z.string().optional(),
    categories: categoryRecordSchema.optional(),
  })
  .strict();

const configSchema = fileConfigSchema.extend({
  openaiApiKey: z.string().min(1),
  transmission: z.object({
    baseUrl: z.string().url(),
    username: z.string().optional(),
    password: z.string().optional(),
  }),
  telegram: z.object({
    token: z.string().min(1),
    chatId: z.string().min(1),
  }),
  categories: categoryRecordSchema,
});

type FileConfig = z.infer<typeof fileConfigSchema>;

export interface CategoryConfig {
  id: string;
  layout: 'movie' | 'series';
  path: string;
  prompt: string;
  label: string;
  examples: string[];
}

export interface Config {
  openaiApiKey: string;
  torrentHash: string;
  transmission: {
    baseUrl: string;
    username?: string;
    password?: string;
  };
  telegram: {
    token: string;
    chatId: string;
  };
  sentryDsn?: string;
  moveCompleteDir?: string;
  categories: CategoryConfig[];
}

function mergeConfig(base: FileConfig, override: FileConfig): FileConfig {
  return {
    ...base,
    ...override,
    transmission: {
      ...base.transmission,
      ...override.transmission,
    },
    telegram: {
      ...base.telegram,
      ...override.telegram,
    },
  };
}

function envConfig(env: Record<string, string | undefined>): FileConfig {
  const config: FileConfig = {};

  if (env.OPENAI_API_KEY) {
    config.openaiApiKey = env.OPENAI_API_KEY;
  }

  const transmission: NonNullable<FileConfig['transmission']> = {};

  if (env.TRANSMISSION_BASE_URL) {
    transmission.baseUrl = env.TRANSMISSION_BASE_URL;
  }

  if (env.TRANSMISSION_USERNAME) {
    transmission.username = env.TRANSMISSION_USERNAME;
  }

  if (env.TRANSMISSION_PASSWORD) {
    transmission.password = env.TRANSMISSION_PASSWORD;
  }

  if (Object.keys(transmission).length > 0) {
    config.transmission = transmission;
  }

  const telegram: NonNullable<FileConfig['telegram']> = {};

  if (env.TELEGRAM_TOKEN) {
    telegram.token = env.TELEGRAM_TOKEN;
  }

  if (env.TELEGRAM_CHAT_ID) {
    telegram.chatId = env.TELEGRAM_CHAT_ID;
  }

  if (Object.keys(telegram).length > 0) {
    config.telegram = telegram;
  }

  if (env.SENTRY_DSN) {
    config.sentryDsn = env.SENTRY_DSN;
  }

  if (env.MOVE_COMPLETE_DIR) {
    config.moveCompleteDir = env.MOVE_COMPLETE_DIR;
  }

  return fileConfigSchema.parse(config);
}

function formatCategoryLabel(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

async function readFileConfig(path: string): Promise<FileConfig> {
  const contents = await readFile(path, 'utf8');
  const parsed = parse(contents) ?? {};

  return fileConfigSchema.parse(parsed);
}

export async function createConfig(
  env: Record<string, string | undefined>,
): Promise<Config> {
  const configPath = z.string().min(1).parse(env.TRANSMISSION_HELPER_CONFIG);
  const fileConfig = await readFileConfig(configPath);
  const merged = mergeConfig(fileConfig, envConfig(env));
  const parsed = configSchema.parse(merged);

  return {
    openaiApiKey: parsed.openaiApiKey,
    torrentHash: z.string().min(1).parse(env.TORRENT_HASH),
    transmission: parsed.transmission,
    telegram: parsed.telegram,
    sentryDsn: parsed.sentryDsn,
    moveCompleteDir: parsed.moveCompleteDir,
    categories: Object.entries(parsed.categories).map(([id, category]) => ({
      id,
      layout: category.layout,
      path: category.path,
      prompt: category.prompt,
      label: category.label ?? formatCategoryLabel(id),
      examples: category.examples,
    })),
  };
}
