import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import sharp from 'sharp';

const gzipAsync = promisify(zlib.gzip);
const VALID_ID_RE = /^[a-zA-Z0-9-]+$/;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const COMPRESSIBLE_RE = /^(text\/|application\/javascript|application\/json|image\/svg\+xml)/;

async function loadEnvFiles(rootDir) {
  for (const filename of ['.env', '.env.local']) {
    const filePath = path.join(rootDir, filename);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    } catch {
      // Optional env file may not exist
    }
  }
}

const rootDir = process.cwd();
await loadEnvFiles(rootDir);

const port = Number(process.env.PORT || 8012);
const host = process.env.HOST || '127.0.0.1';
const immichUrl = process.env.IMMICH_URL || 'http://127.0.0.1:2283';
const immichKey = process.env.IMMICH_API_KEY || '';
const isHttps = immichUrl.startsWith('https:');

const distRoot = path.resolve(rootDir, 'dist');
const cacheRoot = path.resolve(rootDir, '.cache', 'media');
const metaCacheFile = path.join(cacheRoot, 'asset-meta.json');

const keepAliveAgent = isHttps
  ? new https.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 })
  : new http.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 });

const inFlight = new Map();
const assetMetaCache = new Map();
const metaInFlight = new Map();
let metaLoadPromise = null;
let metaSaveTimer = null;
let stopped = false;

function parseImmichDurationMs(raw) {
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

function addTripIdsFromSource(parsed, ids) {
  const trips = Array.isArray(parsed) ? parsed : [parsed];
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
}

async function collectTripAssetIds() {
  const ids = new Set();
  const rawJson = await fs.readFile(path.join(rootDir, 'src/data/trips.json'), 'utf8');
  addTripIdsFromSource(JSON.parse(rawJson), ids);

  try {
    const tripsDir = path.join(rootDir, 'src/data/trips');
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

function loadAssetMetaOnce() {
  if (!metaLoadPromise) {
    metaLoadPromise = (async () => {
      try {
        const raw = await fs.readFile(metaCacheFile, 'utf8');
        const parsed = JSON.parse(raw);
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

function scheduleSaveAssetMeta() {
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

function fetchAssetMeta(assetId) {
  const cached = assetMetaCache.get(assetId);
  if (cached) return Promise.resolve(cached);

  const existing = metaInFlight.get(assetId);
  if (existing) return existing;

  const job = new Promise((resolve) => {
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
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const durationMs = parseImmichDurationMs(data?.duration);
            const mime = typeof data?.originalMimeType === 'string' ? data.originalMimeType : undefined;
            const rec = {
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

async function ensureAssetsMeta(assetIds) {
  await loadAssetMetaOnce();
  const missing = Array.from(new Set(assetIds)).filter(
    (id) => VALID_ID_RE.test(id) && !assetMetaCache.has(id)
  );
  if (missing.length === 0) return;

  const queue = [...missing];
  const workerCount = Math.min(16, queue.length);
  const worker = async () => {
    while (!stopped && queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      await fetchAssetMeta(id);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

function fetchImmichBuffer(targetPath) {
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
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
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

async function getOptimizedTier(assetId, tier) {
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

function streamImmichMedia(targetPath, defaultContentType, req, res, fallbackPath) {
  const client = isHttps ? https : http;
  let activeProxyReq = null;
  let clientClosed = false;

  const onResClose = () => {
    clientClosed = true;
    if (!res.writableEnded && activeProxyReq) {
      activeProxyReq.destroy();
    }
  };
  res.on('close', onResClose);

  const forwardHeaders = {
    'x-api-key': immichKey,
    accept: req.headers.accept || '*/*',
  };
  if (req.headers.range) forwardHeaders['range'] = req.headers.range;
  if (req.headers['if-range']) forwardHeaders['if-range'] = req.headers['if-range'];
  if (req.headers['if-none-match']) forwardHeaders['if-none-match'] = req.headers['if-none-match'];

  const sendUpstreamRequest = (upstreamPath, nextFallback) => {
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

        const headers = {
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

async function handleMediaMetaRequest(rawIdsParam, req, res) {
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

    const videos = {};
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

async function handleMediaRequest(assetId, rawSize, req, res) {
  if (!assetId || !VALID_ID_RE.test(assetId)) {
    res.statusCode = 400;
    res.end('Invalid or missing asset id');
    return;
  }

  const tier =
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
  if (req.headers['if-none-match'] === etag) {
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

async function sendStaticFile(filePath, cacheControl, req, res) {
  const rawBuf = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  const shouldGzip =
    COMPRESSIBLE_RE.test(contentType) &&
    rawBuf.length > 1024 &&
    /\bgzip\b/i.test(acceptEncoding);

  const outBuf = shouldGzip ? await gzipAsync(rawBuf) : rawBuf;
  const headers = {
    'Content-Type': contentType,
    'Content-Length': String(outBuf.length),
    'Cache-Control': cacheControl,
  };
  if (shouldGzip) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
  }

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(outBuf);
  }
}

async function handleStaticRequest(pathname, req, res) {
  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  const relativePath = decodedPath.replace(/^\/+/, '');
  const candidate = relativePath
    ? path.resolve(distRoot, relativePath)
    : path.join(distRoot, 'index.html');

  if (candidate !== distRoot && !candidate.startsWith(`${distRoot}${path.sep}`)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(candidate);
    if (stat.isFile()) {
      const isImmutable =
        decodedPath.startsWith('/assets/') || /\.(woff2?|ttf|otf)$/i.test(candidate);
      const cacheControl = isImmutable
        ? 'public, max-age=31536000, immutable'
        : candidate.endsWith(`${path.sep}index.html`)
          ? 'no-cache'
          : 'public, max-age=3600';
      await sendStaticFile(candidate, cacheControl, req, res);
      return;
    }
  } catch {
    // Missing file on disk — fall through to 404 or SPA index.html
  }

  if (path.extname(decodedPath)) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  try {
    await sendStaticFile(path.join(distRoot, 'index.html'), 'no-cache', req, res);
  } catch (err) {
    console.error('Failed to serve dist/index.html:', err);
    res.statusCode = 500;
    res.end('Application bundle missing');
  }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method Not Allowed');
    return;
  }

  const reqUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = reqUrl.pathname;

  if (pathname.startsWith('/media/')) {
    const subPath = pathname.slice('/media'.length);
    const match = subPath.match(
      /^\/(thumbnail|grid|preview|original|video)\/([a-zA-Z0-9-]+)\.(webp|jpg|jpeg|mp4|mov|webm)$/i
    );
    if (match) {
      const [, tier, assetId] = match;
      void handleMediaRequest(assetId, tier.toLowerCase(), req, res);
      return;
    }
  }

  if (pathname === '/api/media-meta') {
    const idsParam = reqUrl.searchParams.get('ids');
    void handleMediaMetaRequest(idsParam, req, res);
    return;
  }

  if (pathname === '/api/media') {
    const assetId = reqUrl.searchParams.get('id');
    const size = reqUrl.searchParams.get('size');
    void handleMediaRequest(assetId, size, req, res);
    return;
  }

  void handleStaticRequest(pathname, req, res);
});

async function prewarmMediaCache() {
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
          // Ignore individual failures during background warm
        }
      }
    };
    await Promise.all([worker(), worker()]);
  } catch {
    // Ignore pre-warm errors
  }
}

let prewarmTimer = null;

server.listen(port, host, () => {
  console.log(`TripShare server listening at http://${host}:${port}`);
  prewarmTimer = setTimeout(() => {
    void prewarmMediaCache();
  }, 1200);
});

function shutdown(signal) {
  stopped = true;
  if (prewarmTimer) {
    clearTimeout(prewarmTimer);
    prewarmTimer = null;
  }
  console.log(`Received ${signal}, closing TripShare server...`);
  server.close(() => {
    keepAliveAgent.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
