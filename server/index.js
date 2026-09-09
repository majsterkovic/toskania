import trip from '../trip.json' with { type: 'json' };
import distanceMatrix from '../src/distance-matrix.json' with { type: 'json' };
import { buildApp } from './app.js';
import { buildToolRegistry } from './tools/index.js';
import { createLlmClient } from './chat/llmClient.js';

const toolRegistry = buildToolRegistry({ trip, distanceMatrix });

const routerClient = createLlmClient({
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  model: process.env.CHAT_MODEL,
  fallbackModel: process.env.CHAT_MODEL_FALLBACK,
});

const writerClient = createLlmClient({
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  model: process.env.CHAT_MODEL_WRITER ?? process.env.CHAT_MODEL,
  fallbackModel: process.env.CHAT_MODEL_WRITER_FALLBACK ?? process.env.CHAT_MODEL_FALLBACK,
});

const app = await buildApp({
  logger: true,
  dbPath: process.env.DB_PATH ?? '/data/toskania.db',
  staticRoot: new URL('../dist', import.meta.url).pathname,
  toolRegistry,
  trip,
  routerClient,
  writerClient,
});

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
