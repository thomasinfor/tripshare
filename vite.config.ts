import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type MediaTier = 'thumbnail' | 'grid' | 'preview' | 'original';

const VALID_ID_RE = /^[a-zA-Z0-9-]+$/;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const immichUrl = env.IMMICH_URL || 'http://127.0.0.1:2283';
  const immichKey = env.IMMICH_API_KEY || '';
  const isHttps = immichUrl.startsWith('https:');

  const keepAliveAgent = isHttps
    ? new https.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 })
    : new http.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 });

  const cacheRoot = path.resolve(process.cwd(), '.cache', 'media');
  const inFlight = new Map<string, Promise<{ buffer: Buffer; contentType: string }>>();

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
    tier: Exclude<MediaTier, 'original'>
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

  function streamOriginal(assetId: string, req: http.IncomingMessage, res: http.ServerResponse) {
    const immichReqUrl = new URL(`/api/assets/${assetId}/original`, immichUrl);
    const client = isHttps ? https : http;
    const proxyReq = client.request(
      immichReqUrl,
      {
        method: 'GET',
        agent: keepAliveAgent,
        headers: {
          'x-api-key': immichKey,
          accept: req.headers.accept || '*/*',
        },
      },
      (proxyRes) => {
        const headers: Record<string, string | string[]> = {
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        };
        if (proxyRes.headers['content-length']) {
          headers['Content-Length'] = proxyRes.headers['content-length'];
        }
        if (proxyRes.headers['etag']) {
          headers['ETag'] = proxyRes.headers['etag'];
        }
        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('Immich original proxy error:', err);
      res.statusCode = 502;
      res.end('Bad gateway to Immich');
    });

    proxyReq.end();
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
      rawSize === 'grid' || rawSize === 'preview' || rawSize === 'original'
        ? rawSize
        : 'thumbnail';

    if (tier === 'original') {
      streamOriginal(assetId, req, res);
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
          // CDN-cacheable static-extension path: /media/<tier>/<uuid>.webp
          server.middlewares.use('/media', (req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            const match = urlPath.match(/^\/(thumbnail|grid|preview|original)\/([a-zA-Z0-9-]+)\.(webp|jpg|jpeg)$/i);
            if (!match) {
              next();
              return;
            }
            const [, tier, assetId] = match;
            void handleMediaRequest(assetId, tier.toLowerCase(), req, res);
          });

          // Legacy query-param path: /api/media?id=<uuid>&size=<tier>
          server.middlewares.use('/api/media', (req, res) => {
            const parsedUrl = new URL(req.url || '', 'http://localhost');
            const assetId = parsedUrl.searchParams.get('id');
            const size = parsedUrl.searchParams.get('size');
            void handleMediaRequest(assetId, size, req, res);
          });

          // Gently pre-warm thumbnail + grid disk cache in the background for instant 0.7ms hits
          let stopped = false;
          server.httpServer?.once('close', () => {
            stopped = true;
          });
          setTimeout(async () => {
            try {
              const rawJson = await fs.readFile(
                path.resolve(process.cwd(), 'src/data/trips.json'),
                'utf8'
              );
              const parsed = JSON.parse(rawJson);
              const trips = Array.isArray(parsed) ? parsed : [parsed];
              const ids = new Set<string>();
              for (const t of trips) {
                if (t?.cover_image && VALID_ID_RE.test(t.cover_image)) ids.add(t.cover_image);
                for (const d of t?.itinerary || []) {
                  for (const s of d?.spots || []) {
                    for (const imgId of s?.images || []) {
                      if (VALID_ID_RE.test(imgId)) ids.add(imgId);
                    }
                  }
                }
              }

              const queue = Array.from(ids);
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
