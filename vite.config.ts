import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'node:http';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const immichUrl = env.IMMICH_URL || 'http://127.0.0.1:2283';
  const immichKey = env.IMMICH_API_KEY || '';

  return {
    plugins: [
      react(),
      {
        name: 'immich-relay',
        configureServer(server) {
          server.middlewares.use('/api/media', (req, res) => {
            const parsedUrl = new URL(req.url || '', 'http://localhost');
            const assetId = parsedUrl.searchParams.get('id');
            const size = parsedUrl.searchParams.get('size'); // 'thumbnail' | 'preview' | 'original'

            if (!assetId) {
              res.statusCode = 400;
              res.end('Missing asset id');
              return;
            }

            // Route to Immich backend
            let targetPath = `/api/assets/${assetId}/thumbnail`;
            if (size === 'preview') {
              targetPath = `/api/assets/${assetId}/thumbnail?size=preview`;
            } else if (size === 'original') {
              targetPath = `/api/assets/${assetId}/original`;
            }

            const immichReqUrl = new URL(targetPath, immichUrl);

            const proxyReq = http.request(
              immichReqUrl,
              {
                method: 'GET',
                headers: {
                  'x-api-key': immichKey,
                  accept: req.headers.accept || '*/*',
                },
              },
              (proxyRes) => {
                res.writeHead(proxyRes.statusCode || 200, {
                  'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
                  'Cache-Control': 'public, max-age=604800, immutable',
                  'Access-Control-Allow-Origin': '*',
                });
                proxyRes.pipe(res);
              }
            );

            proxyReq.on('error', (err) => {
              console.error('Immich relay proxy error:', err);
              res.statusCode = 502;
              res.end('Bad gateway to Immich');
            });

            proxyReq.end();
          });
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
