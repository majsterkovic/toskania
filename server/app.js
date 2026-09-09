import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import { openDb } from './db/index.js';
import { registerGateRoute } from './auth/gate.js';
import { registerWhoRoute } from './auth/who.js';
import { registerChatRoute } from './routes/chat.js';
import { registerMeRoute } from './routes/me.js';

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
  registerGateRoute(app, { passphrase: opts.passphrase ?? process.env.CHAT_PASSPHRASE });
  registerWhoRoute(app, db);
  registerMeRoute(app, db);
  if (opts.toolRegistry && opts.routerClient && opts.writerClient) {
    registerChatRoute(app, db, {
      toolRegistry: opts.toolRegistry,
      trip: opts.trip,
      routerClient: opts.routerClient,
      writerClient: opts.writerClient,
      budgets: opts.budgets ?? {
        perUserLimit: Number(process.env.DAILY_TOKEN_BUDGET_PER_USER ?? 50000),
        globalLimit: Number(process.env.DAILY_TOKEN_BUDGET_GLOBAL ?? 200000),
      },
    });
  }

  app.addHook('onClose', (instance, done) => {
    db.close();
    done();
  });

  return app;
}
