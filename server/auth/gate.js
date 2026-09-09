const GATE_COOKIE_TTL_SECONDS = 15 * 60;

function cfConnectingIp(req) {
  return req.headers['cf-connecting-ip'] || req.ip;
}

export function registerGateRoute(app, { passphrase }) {
  app.post('/api/auth/gate', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        keyGenerator: cfConnectingIp,
      },
    },
  }, async (req, reply) => {
    const password = (req.body?.password ?? '').trim();
    if (!passphrase || password !== passphrase) {
      reply.code(401);
      return { error: 'wrong_password' };
    }
    reply.setCookie('gate', 'ok', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      signed: true,
      maxAge: GATE_COOKIE_TTL_SECONDS,
    });
    return { ok: true };
  });
}
