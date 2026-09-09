import crypto from 'node:crypto';

const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60;

function requireGate(req, reply) {
  const cookie = req.cookies.gate;
  if (!cookie) {
    reply.code(401).send({ error: 'gate_required' });
    return false;
  }
  const unsigned = req.unsignCookie(cookie);
  if (!unsigned.valid || unsigned.value !== 'ok') {
    reply.code(401).send({ error: 'gate_required' });
    return false;
  }
  return true;
}

export function registerWhoRoute(app, db) {
  app.get('/api/auth/who', async (req, reply) => {
    if (!requireGate(req, reply)) return;
    const users = db.prepare('SELECT id, display_name FROM users ORDER BY display_name').all();
    return { users };
  });

  app.post('/api/auth/who', async (req, reply) => {
    if (!requireGate(req, reply)) return;
    const { user_id: userId, new_name: newName } = req.body ?? {};

    let user;
    if (userId != null) {
      user = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(userId);
      if (!user) {
        reply.code(400);
        return { error: 'unknown_user_id' };
      }
    } else {
      const trimmed = (newName ?? '').trim();
      if (!trimmed || trimmed.length > 50) {
        reply.code(400);
        return { error: 'invalid_new_name' };
      }
      const existing = db.prepare('SELECT id, display_name FROM users WHERE display_name = ?').get(trimmed);
      if (existing) {
        user = existing;
      } else {
        const info = db.prepare('INSERT INTO users (display_name) VALUES (?)').run(trimmed);
        user = { id: info.lastInsertRowid, display_name: trimmed };
      }
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)')
      .run(sessionId, user.id, expiresAt, req.headers['user-agent'] ?? null);

    reply.setCookie('session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      signed: true,
      maxAge: SESSION_TTL_SECONDS,
    });
    reply.clearCookie('gate', { path: '/' });
    return { ok: true, display_name: user.display_name };
  });
}
