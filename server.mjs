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

const keepAliveAgent = isHttps
  ? new https.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 })
  : new http.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 });

const inFlight = new Map();
let stopped = false;

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

function streamOriginal(assetId, req, res) {
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
      const headers = {
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
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Bad gateway to Immich');
    } else {
      res.destroy();
    }
  });

  proxyReq.end();
}

async function handleMediaRequest(assetId, rawSize, req, res) {
  if (!assetId || !VALID_ID_RE.test(assetId)) {
    res.statusCode = 400;
    res.end('Invalid or missing asset id');
    return;
  }

  const tier =
    rawSize === 'grid' || rawSize === 'preview' || rawSize === 'original'
      ? rawSize
      : 'thumbnail';

  if (tier === 'original') {
    streamOriginal(assetId, req, res);
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
      /^\/(thumbnail|grid|preview|original)\/([a-zA-Z0-9-]+)\.(webp|jpg|jpeg)$/i
    );
    if (match) {
      const [, tier, assetId] = match;
      void handleMediaRequest(assetId, tier.toLowerCase(), req, res);
      return;
    }
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
    const rawJson = await fs.readFile(path.join(rootDir, 'src/data/trips.json'), 'utf8');
    const parsed = JSON.parse(rawJson);
    const trips = Array.isArray(parsed) ? parsed : [parsed];

    try {
      const tripsDir = path.join(rootDir, 'src/data/trips');
      const entries = await fs.readdir(tripsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const extraRaw = await fs.readFile(path.join(tripsDir, entry.name), 'utf8');
          const extraParsed = JSON.parse(extraRaw);
          if (Array.isArray(extraParsed)) {
            trips.push(...extraParsed);
          } else if (extraParsed && typeof extraParsed === 'object') {
            trips.push(extraParsed);
          }
        }
      }
    } catch {
      // Optional src/data/trips directory may not exist
    }

    const ids = new Set();
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
