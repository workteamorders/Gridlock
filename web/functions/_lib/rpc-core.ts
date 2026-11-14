// Read-only JSON-RPC relay core. No imports: runs in Vercel Edge Functions, Cloudflare Pages Functions and in Node tests.
// The upstream URL (which may hold a provider key) exists only in env and is never returned to clients.

export interface RpcEnv {
  UPSTREAM_RPC_URL?: string;
  ALLOWED_ORIGINS?: string; // comma separated, in addition to the site's own origin
  CONTRACT_ADDRESSES?: string; // comma separated project contracts (cars and renderer)
  RATE_LIMIT_PER_MIN?: string;
  MAX_LOG_RANGE?: string;
  CACHE_SECONDS?: string;
}

export interface RpcDeps {
  fetchImpl: typeof fetch;
  now: () => number; // ms
  cache?: { get(key: string): Promise<string | null>; put(key: string, value: string, ttlSeconds: number): Promise<void> };
  /** Where the caller's address comes from. The default trusts Cloudflare's header; on any other host pass the header that host sets itself, never one a client could send. */
  clientIp?: (req: Request) => string;
}

export const ALLOWED_METHODS = [
  'eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_estimateGas', 'eth_gasPrice', 'eth_maxPriorityFeePerGas',
  'eth_feeHistory', 'eth_getBalance', 'eth_getCode', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getLogs',
  'eth_getBlockByNumber',
] as const;
const ALLOWED = new Set<string>(ALLOWED_METHODS);
const HOT_CACHE = new Set<string>(['eth_call', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_chainId']);
const MAX_BODY_BYTES = 16 * 1024;
const MAX_BATCH = 10;

interface RpcRequest { jsonrpc: '2.0'; id: unknown; method: string; params?: unknown[] }

const hits = new Map<string, number[]>(); // per isolate, best effort

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v);
const isAddr = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);

function contracts(env: RpcEnv): string[] {
  return (env.CONTRACT_ADDRESSES ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Returns an error message, or null when the call is allowed. */
export function validateCall(req: RpcRequest, env: RpcEnv): string | null {
  if (req === null || typeof req !== 'object' || req.jsonrpc !== '2.0' || typeof req.method !== 'string') return 'invalid request';
  if (!ALLOWED.has(req.method)) return `method not allowed: ${req.method}`;
  const p = req.params ?? [];
  if (!Array.isArray(p)) return 'params must be an array';
  const list = contracts(env);
  if (req.method === 'eth_call' || req.method === 'eth_estimateGas') {
    const tx = p[0] as Record<string, unknown> | undefined;
    if (!tx || typeof tx !== 'object' || !isAddr(tx.to)) return 'a call needs a "to" address';
    if (list.length > 0 && !list.includes(tx.to.toLowerCase())) return 'calls are limited to the project contracts';
    if (tx.data !== undefined && !isHex(tx.data)) return 'bad data';
    if (typeof tx.data === 'string' && tx.data.length > 4096) return 'call data too large';
  }
  if (req.method === 'eth_getLogs') {
    const f = p[0] as Record<string, unknown> | undefined;
    if (!f || typeof f !== 'object') return 'bad filter';
    if ('blockHash' in f) return 'blockHash filters are not allowed';
    const addrs = Array.isArray(f.address) ? f.address : [f.address];
    if (addrs.length === 0 || !addrs.every((a) => isAddr(a) && list.includes(a.toLowerCase()))) return 'logs are limited to the project contracts';
    if (!isHex(f.fromBlock) || !isHex(f.toBlock)) return 'fromBlock and toBlock must be hex block numbers';
    const range = BigInt(f.toBlock) - BigInt(f.fromBlock);
    const max = BigInt(Number(env.MAX_LOG_RANGE ?? '5000'));
    if (range < 0n || range > max) return `block range must be 0 to ${max}`;
  }
  if (req.method === 'eth_getBalance' || req.method === 'eth_getCode') {
    if (!isAddr(p[0])) return 'bad address';
  }
  if (req.method === 'eth_getTransactionReceipt' || req.method === 'eth_getTransactionByHash') {
    if (typeof p[0] !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(p[0])) return 'bad hash';
  }
  return null;
}

function originAllowed(req: Request, env: RpcEnv): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const own = new URL(req.url).origin;
  const extra = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return origin === own || extra.includes(origin);
}

function rateLimited(ip: string, env: RpcEnv, nowMs: number): boolean {
  const limit = Number(env.RATE_LIMIT_PER_MIN ?? '120');
  const windowStart = nowMs - 60_000;
  const arr = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  arr.push(nowMs);
  hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => t <= windowStart)) hits.delete(k);
  return arr.length > limit;
}

export function resetRateLimits() { hits.clear(); }

async function forward(single: RpcRequest, env: RpcEnv, deps: RpcDeps): Promise<unknown> {
  const upstream = env.UPSTREAM_RPC_URL;
  if (!upstream) return rpcError(single.id, -32000, 'rpc is not configured');
  const ttl = Number(env.CACHE_SECONDS ?? '5');
  const hot = HOT_CACHE.has(single.method) && deps.cache && ttl > 0;
  const key = hot ? `https://rpc-cache.invalid/${single.method}/${JSON.stringify(single.params ?? [])}` : '';
  if (hot && deps.cache) {
    const hit = await deps.cache.get(key);
    if (hit) return { jsonrpc: '2.0', id: single.id, result: JSON.parse(hit) as unknown };
  }
  let res: Response;
  try {
    res = await deps.fetchImpl(upstream, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: single.method, params: single.params ?? [] }) });
  } catch {
    return rpcError(single.id, -32000, 'rpc is busy, try again');
  }
  if (!res.ok) return rpcError(single.id, -32000, res.status === 429 ? 'rpc is busy, try again' : 'rpc upstream error');
  let body: { result?: unknown; error?: { code: number; message: string } };
  try { body = (await res.json()) as typeof body; } catch { return rpcError(single.id, -32000, 'rpc upstream error'); }
  if (body.error) return { jsonrpc: '2.0', id: single.id, error: { code: body.error.code, message: String(body.error.message).slice(0, 300) } };
  if (hot && deps.cache && body.result !== undefined && body.result !== null) await deps.cache.put(key, JSON.stringify(body.result), ttl);
  return { jsonrpc: '2.0', id: single.id, result: body.result };
}

export async function handleRpc(req: Request, env: RpcEnv, deps: RpcDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json(rpcError(null, -32600, 'POST only'), 405);
  if (!originAllowed(req, env)) return json(rpcError(null, -32600, 'origin not allowed'), 403);
  const ip = deps.clientIp ? deps.clientIp(req) : (req.headers.get('cf-connecting-ip') ?? 'unknown');
  if (rateLimited(ip, env, deps.now())) return json(rpcError(null, -32005, 'rate limit exceeded'), 429);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json(rpcError(null, -32600, 'body too large'), 413);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return json(rpcError(null, -32700, 'parse error'), 400); }
  const batch = Array.isArray(parsed);
  const items = (batch ? parsed : [parsed]) as RpcRequest[];
  if (items.length === 0 || items.length > MAX_BATCH) return json(rpcError(null, -32600, `batch must have 1 to ${MAX_BATCH} calls`), 400);
  const out: unknown[] = [];
  for (const item of items) {
    const bad = validateCall(item, env);
    out.push(bad ? rpcError(item?.id, -32601, bad) : await forward(item, env, deps));
  }
  return json(batch ? out : out[0]);
}
