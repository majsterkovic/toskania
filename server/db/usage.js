function today() {
  return new Date().toISOString().slice(0, 10);
}

export function getUsageToday(db, userId) {
  const row = db.prepare(
    'SELECT prompt_tokens, completion_tokens, requests FROM usage WHERE user_id = ? AND day = ?'
  ).get(userId, today());
  return row ?? { prompt_tokens: 0, completion_tokens: 0, requests: 0 };
}

export function getGlobalUsageToday(db) {
  const row = db.prepare(
    'SELECT COALESCE(SUM(prompt_tokens), 0) as pt, COALESCE(SUM(completion_tokens), 0) as ct FROM usage WHERE day = ?'
  ).get(today());
  return { prompt_tokens: row.pt, completion_tokens: row.ct };
}

export function recordUsage(db, userId, promptTokens, completionTokens) {
  db.prepare(
    `INSERT INTO usage (user_id, day, prompt_tokens, completion_tokens, requests)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET
       prompt_tokens = prompt_tokens + excluded.prompt_tokens,
       completion_tokens = completion_tokens + excluded.completion_tokens,
       requests = requests + 1`
  ).run(userId, today(), promptTokens, completionTokens);
}

export function budgetExceeded(db, userId, { perUserLimit, globalLimit }) {
  const user = getUsageToday(db, userId);
  if (user.prompt_tokens + user.completion_tokens >= perUserLimit) return 'user';
  const global = getGlobalUsageToday(db);
  if (global.prompt_tokens + global.completion_tokens >= globalLimit) return 'global';
  return null;
}
