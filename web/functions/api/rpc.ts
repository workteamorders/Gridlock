import { handleRpc, type RpcEnv } from '../_lib/rpc-core.ts';

interface PagesContext<E> { request: Request; env: E }
const edgeCache = (caches as unknown as { default: Cache }).default;

export const onRequest = (ctx: PagesContext<RpcEnv>): Promise<Response> =>
  handleRpc(ctx.request, ctx.env, {
    fetchImpl: fetch,
    now: () => Date.now(),
    cache: {
      async get(key) {
        const hit = await edgeCache.match(new Request(key));
        return hit ? hit.text() : null;
      },
      async put(key, value, ttl) {
        await edgeCache.put(new Request(key), new Response(value, { headers: { 'cache-control': `max-age=${ttl}` } }));
      },
    },
  });
