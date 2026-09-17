const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
const fs = require('fs');
const nodePath = require('path');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...new Set([...(config.resolver.assetExts || []), 'html'])];
const previousEnhance = config.server && config.server.enhanceMiddleware;

const ISL_ROOT = nodePath.resolve(__dirname, 'isl-player');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.sigml': 'application/xml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function serveIslPlayer(urlPath, res) {
  const rel = decodeURIComponent((urlPath.split('?')[0] || '').replace(/^\/isl-player\/?/, '')) || 'player.html';
  const file = nodePath.resolve(ISL_ROOT, rel);
  if (!file.startsWith(ISL_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = nodePath.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.sigml' ? 'public, max-age=86400' : 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(file).pipe(res);
  });
}

// Expo Go can reach Metro even when Windows Firewall blocks node-api on :4000.
// Forward /api and /health, and serve the local CWASA Text→ISL player at /isl-player.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, metroServer) => {
    const inner = previousEnhance ? previousEnhance(middleware, metroServer) : middleware;
    return (req, res, next) => {
      const urlPath = req.url || '';
      if (urlPath.startsWith('/isl-player')) {
        serveIslPlayer(urlPath, res);
        return;
      }
      if (urlPath.startsWith('/api') || urlPath.startsWith('/health')) {
        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port: 4000,
            path: urlPath,
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
