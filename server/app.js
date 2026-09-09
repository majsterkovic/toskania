import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import { openDb } from './db/index.js';

export async function buildApp(opts = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  const db = opts.db ?? openDb(opts.dbPath ?? ':memory:');
  app.decorate('db', db);

  await app.register(fastifyCookie, {
    secret: opts.sessionSecret ?? process.env.SESSION_SECRET,
  });
  await app.register(fastifyRateLimit, { global: false });

  if (opts.staticRoot) {
    await app.register(fastifyStatic, { root: opts.staticRoot });
  }

  app.get('/healthz', async () => ({ ok: true }));

  app.addHook('onClose', (instance, done) => {
    db.close();
    done();
  });

  return app;
}
