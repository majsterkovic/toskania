import { requireSession } from '../auth/session.js';
import { getUsageToday } from '../db/usage.js';

export function registerMeRoute(app, db) {
  app.get('/api/me', { preHandler: requireSession }, async (req) => {
    const usage = getUsageToday(db, req.user.id);
    return { display_name: req.user.displayName, usage };
  });
}
