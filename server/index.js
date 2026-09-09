import { buildApp } from './app.js';

const app = await buildApp({
  logger: true,
  dbPath: process.env.DB_PATH ?? '/data/toskania.db',
  staticRoot: new URL('../dist', import.meta.url).pathname,
});

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
