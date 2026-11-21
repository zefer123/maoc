export function createDependencyChecks(settings, fetcher = (...args) => fetch(...args)) {
  let cached;
  let expires = 0;
  let pending;
  return async function check() {
    if (cached && Date.now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      const targets = {
        market: 'https://api.binance.com/api/v3/ping',
        wikipedia: 'https://en.wikipedia.org/w/api.php?action=query&format=json&meta=siteinfo',
        hackernews: 'https://hn.algolia.com/api/v1/search?query=AI&hitsPerPage=1'
      };
      if (settings.providers.ollamaUrl) {
        targets.ollama = new URL('/api/tags', settings.providers.ollamaUrl).href;
      }
      const results = await Promise.all(Object.entries(targets).map(async ([name, url]) => {
        const started = performance.now();
        try {
          const response = await fetcher(url, { signal: AbortSignal.timeout(3000), redirect: 'error' });
          await response.body?.cancel();
          return [name, { status: response.ok ? 'ok' : 'unavailable', httpStatus: response.status, latencyMs: Math.round(performance.now() - started) }];
        } catch {
          return [name, { status: 'unavailable', latencyMs: Math.round(performance.now() - started) }];
        }
      }));
      cached = { checkedAt: new Date().toISOString(), services: Object.fromEntries(results) };
      expires = Date.now() + 30000;
      return cached;
    })().finally(() => { pending = null; });
    return pending;
  };
}