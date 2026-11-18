import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type MediaTier = 'thumbnail' | 'grid' | 'preview' | 'original' | 'video';

interface AssetMetaRecord {
  type: 'IMAGE' | 'VIDEO';
  durationMs?: number;
  mime?: string;
}

const VALID_ID_RE = /^[a-zA-Z0-9-]+$/;

function parseImmichDurationMs(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : undefined;
  }
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return undefined;
  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else {
    return undefined;
  }
  return seconds > 0 ? Math.round(seconds * 1000) : undefined;
}

function addTripIdsFromSource(parsed: unknown, ids: Set<string>): void {
  const trips = Array.isArray(parsed) ? parsed : [parsed];
  for (const t of trips) {
    if (!t || typeof t !== 'object') continue;
    const trip = t as {
      cover_image?: string;
      itinerary?: Array<{ spots?: Array<{ images?: string[] }> }>;
    };
    if (trip.cover_image && VALID_ID_RE.test(trip.cover_image)) {
      ids.add(trip.cover_image);
    }
    for (const d of trip.itinerary || []) {
      for (const s of d?.spots || []) {
        for (const imgId of s?.images || []) {
          if (VALID_ID_RE.test(imgId)) ids.add(imgId);
        }
      }
    }
  }
}

async function collectTripAssetIds(): Promise<string[]> {
  const ids = new Set<string>();
  const rawJson = await fs.readFile(path.resolve(process.cwd(), 'src/data/trips.json'), 'utf8');
  addTripIdsFromSource(JSON.parse(rawJson), ids);

  try {
    const tripsDir = path.resolve(process.cwd(), 'src/data/trips');
    const entries = await fs.readdir(tripsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const extraRaw = await fs.readFile(path.join(tripsDir, entry.name), 'utf8');
        addTripIdsFromSource(JSON.parse(extraRaw), ids);
      }
    }
  } catch {
    // Optional src/data/trips directory may not exist
  }
  return Array.from(ids);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const immichUrl = env.IMMICH_URL || 'http://127.0.0.1:2283';
  const immichKey = env.IMMICH_API_KEY || '';
  const isHttps = immichUrl.startsWith('https:');

  const keepAliveAgent = isHttps
    ? new https.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 })
    : new http.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 });

  const cacheRoot = path.resolve(process.cwd(), '.cache', 'media');
  const metaCacheFile = path.join(cacheRoot, 'asset-meta.json');
  const inFlight = new Map<string, Promise<{ buffer: Buffer; contentType: string }>>();
  const assetMetaCache = new Map<string, AssetMetaRecord>();
  const metaInFlight = new Map<string, Promise<AssetMetaRecord | null>>();
  let metaLoadPromise: Promise<void> | null = null;
  let metaSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function loadAssetMetaOnce(): Promise<void> {
    if (!metaLoadPromise) {
      metaLoadPromise = (async () => {
        try {
          const raw = await fs.readFile(metaCacheFile, 'utf8');
          const parsed = JSON.parse(raw) as Record<string, AssetMetaRecord>;
          if (parsed && typeof parsed === 'object') {
            for (const [id, rec] of Object.entries(parsed)) {
              if (VALID_ID_RE.test(id) && rec && (rec.type === 'IMAGE' || rec.type === 'VIDEO')) {
                assetMetaCache.set(id, rec);
              }
            }
          }
        } catch {
          // Cache file may not exist yet
        }
      })();
    }
    return metaLoadPromise;
  }

  function scheduleSaveAssetMeta(): void {
    if (metaSaveTimer !== null) {
      clearTimeout(metaSaveTimer);
    }
    metaSaveTimer = setTimeout(async () => {
      metaSaveTimer = null;
      try {
        await fs.mkdir(cacheRoot, { recursive: true });
        const payload = JSON.stringify(Object.fromEntries(assetMetaCache.entries()));
        const tmpFile = `${metaCacheFile}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(tmpFile, payload, 'utf8');
        await fs.rename(tmpFile, metaCacheFile);
      } catch {
        // Ignore metadata disk cache write errors
      }
    }, 400);
    metaSaveTimer.unref?.();
  }

  function fetchAssetMeta(assetId: string): Promise<AssetMetaRecord | null> {
    const cached = assetMetaCache.get(assetId);
    if (cached) return Promise.resolve(cached);

    const existing = metaInFlight.get(assetId);
    if (existing) return existing;

    const job = new Promise<AssetMetaRecord | null>((resolve) => {
      const url = new URL(`/api/assets/${assetId}`, immichUrl);
      const client = isHttps ? https : http;
      const req = client.request(
        url,
        {
          method: 'GET',
          agent: keepAliveAgent,
          headers: {
            'x-api-key': immichKey,
            accept: 'application/json',
          },
        },
        (res) => {
          if (!res.statusCode || res.statusCode >= 400) {
            res.resume();
            resolve(null);
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            try {
              const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const durationMs = parseImmichDurationMs(data?.duration);
              const mime = typeof data?.originalMimeType === 'string' ? data.originalMimeType : undefined;
              const rec: AssetMetaRecord = {
                type: data?.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
                ...(durationMs !== undefined ? { durationMs } : {}),
                ...(mime ? { mime } : {}),
              };
              assetMetaCache.set(assetId, rec);
              scheduleSaveAssetMeta();
              resolve(rec);
            } catch {
              resolve(null);
            }
          });
        }
      );
      req.on('error', () => resolve(null));
      req.end();
    }).finally(() => {
      metaInFlight.delete(assetId);
    });

    metaInFlight.set(assetId, job);
    return job;
  }

  async function ensureAssetsMeta(assetIds: string[]): Promise<void> {
    await loadAssetMetaOnce();
    const missing = Array.from(new Set(assetIds)).filter(
      (id) => VALID_ID_RE.test(id) && !assetMetaCache.has(id)
    );
    if (missing.length === 0) return;

    const queue = [...missing];
    const workerCount = Math.min(16, queue.length);
    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        if (!id) break;
        await fetchAssetMeta(id);
      }
    };
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  function fetchImmichBuffer(targetPath: string): Promise<{ buffer: Buffer; contentType: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(targetPath, immichUrl);
      const client = isHttps ? https : http;
      const req = client.request(
        url,
        {
          method: 'GET',
          agent: keepAliveAgent,
          headers: {
            'x-api-key': immichKey,
            accept: 'image/webp,image/*,*/*',
          },
        },
        (res) => {
          if (!res.statusCode || res.statusCode >= 400) {
            res.resume();
            reject(new Error(`Immich HTTP ${res.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              buffer: Buffer.concat(chunks),
              contentType: res.headers['content-type'] || 'image/jpeg',
            });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  async function getOptimizedTier(
    assetId: string,
    tier: 'thumbnail' | 'grid' | 'preview'
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const cacheDir = path.join(cacheRoot, tier);
    const cacheFile = path.join(cacheDir, `${assetId}.webp`);

    try {
      const cached = await fs.readFile(cacheFile);
      return { buffer: cached, contentType: 'image/webp' };
    } catch {
      // Cache miss — generate below
    }

    const key = `${tier}:${assetId}`;
    const existing = inFlight.get(key);
    if (existing) return existing;

    const job = (async () => {
      const immichPath =
        tier === 'thumbnail'
          ? `/api/assets/${assetId}/thumbnail`
          : `/api/assets/${assetId}/thumbnail?size=preview`;

      const { buffer: rawBuf, contentType } = await fetchImmichBuffer(immichPath);

      let outBuf = rawBuf;
      let outType = contentType;

      if (tier === 'grid') {
        try {
          outBuf = await sharp(rawBuf)
            .rotate()
            .resize({ width: 660, withoutEnlargement: true })
            .webp({ quality: 75, effort: 4 })
            .toBuffer();
          outType = 'image/webp';
        } catch {
          // Fallback to raw buffer if format cannot be transcoded
        }
      } else if (tier === 'preview') {
        try {
          outBuf = await sharp(rawBuf)
            .rotate()
            .resize({ width: 1360, withoutEnlargement: true })
            .webp({ quality: 78, effort: 4 })
            .toBuffer();
          outType = 'image/webp';
        } catch {
          // Fallback to raw buffer
        }
      }

      if (outType === 'image/webp') {
        try {
          await fs.mkdir(cacheDir, { recursive: true });
          const tmpFile = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
          await fs.writeFile(tmpFile, outBuf);
          await fs.rename(tmpFile, cacheFile);
        } catch {
          // Ignore disk cache write errors
        }
      }

      return { buffer: outBuf, contentType: outType };
    })();

    inFlight.set(key, job);
    try {
      return await job;
    } finally {
      inFlight.delete(key);
    }
  }

  function streamImmichMedia(
    targetPath: string,
    defaultContentType: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    fallbackPath?: string
  ) {
    const client = isHttps ? https : http;
    let activeProxyReq: http.ClientRequest | null = null;
    let clientClosed = false;

    const onResClose = () => {
      clientClosed = true;
      if (!res.writableEnded && activeProxyReq) {
        activeProxyReq.destroy();
      }
    };
    res.on('close', onResClose);

    const forwardHeaders: Record<string, string | string[]> = {
      'x-api-key': immichKey,
      accept: req.headers.accept || '*/*',
    };
    if (req.headers.range) forwardHeaders['range'] = req.headers.range;
    if (req.headers['if-range']) forwardHeaders['if-range'] = req.headers['if-range'];
    if (req.headers['if-none-match']) forwardHeaders['if-none-match'] = req.headers['if-none-match'];

    const sendUpstreamRequest = (upstreamPath: string, nextFallback?: string) => {
      const immichReqUrl = new URL(upstreamPath, immichUrl);
      const proxyReq = client.request(
        immichReqUrl,
        {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          agent: keepAliveAgent,
          headers: forwardHeaders,
        },
        (proxyRes) => {
          if (proxyRes.statusCode === 404 && nextFallback) {
            proxyRes.resume();
            if (!clientClosed) {
              sendUpstreamRequest(nextFallback);
            }
            return;
          }

          const headers: Record<string, string | string[]> = {
            'Content-Type': proxyRes.headers['content-type'] || defaultContentType,
            'Accept-Ranges': proxyRes.headers['accept-ranges'] || 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
          };
          if (proxyRes.headers['content-length']) {
            headers['Content-Length'] = proxyRes.headers['content-length'];
          }
          if (proxyRes.headers['content-range']) {
            headers['Content-Range'] = proxyRes.headers['content-range'];
          }
          if (proxyRes.headers['etag']) {
            headers['ETag'] = proxyRes.headers['etag'];
          }

          res.writeHead(proxyRes.statusCode || 200, headers);
          if (req.method === 'HEAD') {
            proxyRes.resume();
            res.end();
          } else {
            proxyRes.pipe(res);
          }
        }
      );

      activeProxyReq = proxyReq;
      proxyReq.on('error', (err) => {
        if (clientClosed) return;
        console.error('Immich media proxy error:', err);
        if (!res.headersSent) {
          res.statusCode = 502;
          res.end('Bad gateway to Immich');
        } else {
          res.destroy();
        }
      });

      proxyReq.end();
    };

    sendUpstreamRequest(targetPath, fallbackPath);
  }

  async function handleMediaMetaRequest(
    rawIdsParam: string | null,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    try {
      const targetIds = rawIdsParam
        ? Array.from(
            new Set(
              rawIdsParam
                .split(',')
                .map((s) => s.trim())
                .filter((s) => VALID_ID_RE.test(s))
            )
          ).slice(0, 2000)
        : await collectTripAssetIds();

      await ensureAssetsMeta(targetIds);

      const videos: Record<string, { durationMs?: number; mime?: string }> = {};
      for (const id of targetIds) {
        const rec = assetMetaCache.get(id);
        if (rec?.type === 'VIDEO') {
          videos[id] = {
            ...(rec.durationMs !== undefined ? { durationMs: rec.durationMs } : {}),
            ...(rec.mime ? { mime: rec.mime } : {}),
          };
        }
      }

      const body = JSON.stringify({ videos });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': String(Buffer.byteLength(body)),
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(body);
      }
    } catch (err) {
      console.error('Media meta error:', err);
      res.statusCode = 500;
      res.end('Failed to load media metadata');
    }
  }

  async function handleMediaRequest(
    assetId: string | null,
    rawSize: string | null,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    if (!assetId || !VALID_ID_RE.test(assetId)) {
      res.statusCode = 400;
      res.end('Invalid or missing asset id');
      return;
    }

    const tier: MediaTier =
      rawSize === 'grid' || rawSize === 'preview' || rawSize === 'original' || rawSize === 'video'
        ? rawSize
        : 'thumbnail';

    if (tier === 'video') {
      streamImmichMedia(
        `/api/assets/${assetId}/video/playback`,
        'video/mp4',
        req,
        res,
        `/api/assets/${assetId}/original`
      );
      return;
    }

    if (tier === 'original') {
      streamImmichMedia(`/api/assets/${assetId}/original`, 'application/octet-stream', req, res);
      return;
    }

    const etag = `"${tier}-${assetId}-v1"`;
    if (req.headers['if-none-normalize'] === etag || req.headers['if-none-match'] === etag) {
      res.writeHead(304, {
        ETag: etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      });
      res.end();
      return;
    }

    try {
      const { buffer, contentType } = await getOptimizedTier(assetId, tier);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        ETag: etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(buffer);
      }
    } catch (err) {
      console.error(`Media relay error (${tier} ${assetId}):`, err);
      res.statusCode = 404;
      res.end('Media not found');
    }
  }

  return {
    plugins: [
      react(),
      {
        name: 'immich-relay',
        configureServer(server) {
          // CDN-cacheable static-extension path: /media/<tier>/<uuid>.(webp|jpg|mp4|...)
          server.middlewares.use('/media', (req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            const match = urlPath.match(
              /^\/(thumbnail|grid|preview|original|video)\/([a-zA-Z0-9-]+)\.(webp|jpg|jpeg|mp4|mov|webm)$/i
            );
            if (!match) {
              next();
              return;
            }
            const [, tier, assetId] = match;
            void handleMediaRequest(assetId, tier.toLowerCase(), req, res);
          });

          // Asset type & video duration metadata lookup
          server.middlewares.use('/api/media-meta', (req, res) => {
            const parsedUrl = new URL(req.url || '', 'http://localhost');
            void handleMediaMetaRequest(parsedUrl.searchParams.get('ids'), req, res);
          });

          // Legacy query-param path: /api/media?id=<uuid>&size=<tier>
          server.middlewares.use('/api/media', (req, res) => {
            const parsedUrl = new URL(req.url || '', 'http://localhost');
            const assetId = parsedUrl.searchParams.get('id');
            const size = parsedUrl.searchParams.get('size');
            void handleMediaRequest(assetId, size, req, res);
          });

          // Gently pre-warm asset metadata + thumbnail/grid disk cache in the background
          let stopped = false;
          server.httpServer?.once('close', () => {
            stopped = true;
          });
          setTimeout(async () => {
            try {
              const queue = await collectTripAssetIds();
              await ensureAssetsMeta(queue);
              if (stopped) return;

              const worker = async () => {
                while (!stopped && queue.length > 0) {
                  const id = queue.shift();
                  if (!id) break;
                  try {
                    await getOptimizedTier(id, 'thumbnail');
                    if (stopped) break;
                    await getOptimizedTier(id, 'grid');
                  } catch {
                    // Ignore missing/unreachable individual asset during background warm
                  }
                }
              };
              await Promise.all([worker(), worker()]);
            } catch {
              // Ignore pre-warm errors
            }
          }, 1200);
        },
      },
    ],
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
      fs: {
        allow: ['..'],
      },
    },
  };
});
