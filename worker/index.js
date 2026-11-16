/* Cycle Map Worker: serves the built dashboard (static files) and two small endpoints for the Refresh button.
   Cloudflare Access sits in front of everything, so only the owner reaches any of it.
   POST /api/refresh -> starts the GitHub build workflow (unless one is already queued or running)
   GET  /api/status  -> state of the latest build run
   Secret GITHUB_TOKEN: fine-grained token with Actions read/write on the cyclemap repo. */
const WF = 'build.yml';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function gh(env, path, init = {}) {
  return fetch('https://api.github.com/repos/' + env.GITHUB_REPO + path, { ...init, headers: {
    authorization: 'Bearer ' + env.GITHUB_TOKEN, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28',
    'user-agent': 'cyclemap-worker', ...(init.body ? { 'content-type': 'application/json' } : {}) } });
}
async function latestRun(env) {
  const r = await gh(env, `/actions/workflows/${WF}/runs?per_page=1`);
  if (!r.ok) throw new Error('GitHub answered ' + r.status);
  const run = (await r.json()).workflow_runs[0];
  return run ? { status: run.status, conclusion: run.conclusion, started: run.run_started_at || run.created_at, updated: run.updated_at, event: run.event } : { status: 'none' };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!env.GITHUB_TOKEN) return json({ error: 'Refresh is not set up yet (missing GITHUB_TOKEN).' }, 503);
    try {
      if (url.pathname === '/api/status' && req.method === 'GET') return json(await latestRun(env));
      if (url.pathname === '/api/refresh' && req.method === 'POST') {
        const origin = req.headers.get('origin');
        if (origin && new URL(origin).host !== url.host) return json({ error: 'Wrong origin' }, 403);
        const cur = await latestRun(env);
        if (cur.status === 'queued' || cur.status === 'in_progress') return json({ state: 'running', run: cur }, 202);
        const r = await gh(env, `/actions/workflows/${WF}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { reason: 'Refresh button' } }) });
        if (r.status !== 204) return json({ error: 'GitHub refused the refresh (' + r.status + ')' }, 502);
        return json({ state: 'started' }, 202);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) { return json({ error: String(e.message || e) }, 502); }
  }
};
