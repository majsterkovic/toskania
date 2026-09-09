export function getSessionUser(req, db) {
  const cookie = req.cookies.session;
  if (!cookie) return null;
  const unsigned = req.unsignCookie(cookie);
  if (!unsigned.valid) return null;
  const row = db.prepare(
    `SELECT s.user_id as userId, s.expires_at as expiresAt, u.display_name as displayName
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  ).get(unsigned.value);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  return { id: row.userId, displayName: row.displayName };
}

export async function requireSession(req, reply) {
  const user = getSessionUser(req, req.server.db);
  if (!user) {
    reply.code(401).send({ error: 'session_required' });
    return;
  }
  req.user = user;
}
