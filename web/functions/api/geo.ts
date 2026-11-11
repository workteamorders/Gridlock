import { handleGeo, type GeoEnv } from '../_lib/geo-core.ts';

interface PagesContext<E> { request: Request; env: E }

export const onRequest = (ctx: PagesContext<GeoEnv>): Response => handleGeo(ctx.request, ctx.env);
