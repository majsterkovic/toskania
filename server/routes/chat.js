import { requireSession } from '../auth/session.js';
import { budgetExceeded, recordUsage } from '../db/usage.js';
import { runChatLoop } from '../chat/loop.js';

function sseSend(raw, event, data) {
  raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function registerChatRoute(app, db, { toolRegistry, llmClient, systemPrompt, budgets }) {
  app.post('/api/chat', {
    preHandler: requireSession,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (req) => `session:${req.cookies.session}`,
      },
    },
  }, async (req, reply) => {
    const exceeded = budgetExceeded(db, req.user.id, budgets);
    if (exceeded) {
      reply.code(429);
      return { error: `budget_exceeded_${exceeded}` };
    }

    const conversationId = req.body?.conversation_id ?? 'default';
    const userMessage = req.body?.message ?? '';

    db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'user', ?)")
      .run(req.user.id, conversationId, userMessage);

    const wantsSse = (req.headers.accept ?? '').includes('text/event-stream');

    try {
      if (!wantsSse) {
        const result = await runChatLoop({
          llmClient, toolRegistry, systemPrompt,
          history: req.body?.history ?? [],
          userMessage,
        });
        recordUsage(db, req.user.id, result.usage.prompt_tokens, result.usage.completion_tokens);
        db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)")
          .run(req.user.id, conversationId, result.content);
        req.log.info({ user: req.user.displayName, models: result.models, usage: result.usage }, 'chat completed');
        return { content: result.content, models: result.models };
      }

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      try {
        const result = await runChatLoop({
          llmClient, toolRegistry, systemPrompt,
          history: req.body?.history ?? [],
          userMessage,
          onToolCall: (name) => sseSend(raw, 'status', { tool: name }),
        });
        recordUsage(db, req.user.id, result.usage.prompt_tokens, result.usage.completion_tokens);
        db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)")
          .run(req.user.id, conversationId, result.content);
        req.log.info({ user: req.user.displayName, models: result.models, usage: result.usage }, 'chat completed');
        sseSend(raw, 'content', { content: result.content });
        sseSend(raw, 'done', { usage: result.usage, models: result.models });
      } catch (err) {
        sseSend(raw, 'error', { error: 'assistant_unavailable', detail: err.message });
      }
      raw.end();
      return reply;
    } catch (err) {
      reply.code(502);
      return { error: 'assistant_unavailable', detail: err.message };
    }
  });
}
