const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...new Set([...(config.resolver.assetExts || []), 'html'])];
const previousEnhance = config.server && config.server.enhanceMiddleware;

// Expo Go can reach Metro (8081/8082) even when Windows Firewall blocks
// node-api on :4000. Forward /api and /health over that same connection.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, metroServer) => {
    const inner = previousEnhance ? previousEnhance(middleware, metroServer) : middleware;
    return (req, res, next) => {
      const path = req.url || '';
      if (path.startsWith('/api') || path.startsWith('/health')) {
        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port: 4000,
            path,
            method: req.method,
            headers: { ...req.headers, host: '127.0.0.1:4000' },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        proxyReq.on('error', (err) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Can't reach node-api on :4000 (${err.message})` }));
        });
        req.pipe(proxyReq);
        return;
      }
      return inner(req, res, next);
    };
  },
};

module.exports = config;
