'use strict';

/**
 * Minimal static-file + reverse-proxy server for the Modulo desktop shell.
 *
 * The web frontend talks to the backend with same-origin relative paths
 * (`/api/...`, `/ws`, `/actuator/...`). In the browser those are handled by
 * the Vite dev-server proxy (dev) or nginx (Docker). The desktop app has
 * neither, so this server reproduces that contract: it serves the built SPA
 * from disk and forwards API/WebSocket traffic to the Spring Boot backend.
 * That keeps the renderer code and the backend completely unchanged — no
 * CORS configuration, no absolute API URLs.
 *
 * Node built-ins only; no third-party dependencies. Also runnable standalone
 * (without Electron) for testing: `node serve.js`.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

// Path prefixes forwarded to the backend instead of served from disk.
// Mirrors frontend/nginx.conf and the Vite dev-server proxy.
const PROXY_PREFIXES = ['/api', '/ws', '/actuator'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

function pathnameOf(reqUrl) {
  try {
    return decodeURIComponent(new URL(reqUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
}

function isProxiedPath(pathname) {
  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function serveStatic(distDir, pathname, res) {
  if (pathname === null) {
    res.writeHead(400).end('Bad request');
    return;
  }

  let filePath = path.normalize(path.join(distDir, pathname));
  if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    stats = null;
  }

  // SPA fallback: any path that is not a real file gets index.html so that
  // client-side routes (/workspace, /graph, /auth/callback, ...) work.
  if (!stats || !stats.isFile()) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const isIndex = path.basename(filePath) === 'index.html';
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    // Vite emits content-hashed filenames under /assets, safe to cache hard.
    // index.html must always be revalidated or a stale shell pins old chunks.
    'Cache-Control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  fs.createReadStream(filePath)
    .on('error', () => res.destroy())
    .pipe(res);
}

function backendRequestOptions(backend, req) {
  // Match frontend/nginx.conf's proxy behaviour:
  // - Preserve the incoming Host (proxy_set_header Host $host). Spring builds
  //   absolute URLs (e.g. the /login redirect for unauthenticated requests)
  //   from it; rewriting Host to the backend's would send the renderer to
  //   http://localhost:8080/... — a cross-origin hop that CORS then blocks
  //   and surfaces as "Failed to fetch".
  // - Strip the Origin header: Chromium attaches Origin to every mutating
  //   request, and unknown origins fail the backend's CORS allowlist
  //   (reads would work while every POST/PUT/DELETE gets rejected). Without
  //   Origin, Spring treats the request as same-origin — correct for a
  //   trusted local reverse proxy.
  const headers = {
    ...req.headers,
    'x-forwarded-for': req.socket.remoteAddress || '127.0.0.1',
    'x-forwarded-proto': 'http',
  };
  delete headers.origin;
  return {
    protocol: backend.protocol,
    hostname: backend.hostname,
    port: backend.port || (backend.protocol === 'https:' ? 443 : 80),
    path: req.url,
    method: req.method,
    headers,
  };
}

function proxyRequest(backend, req, res) {
  const mod = backend.protocol === 'https:' ? https : http;
  const proxyReq = mod.request(backendRequestOptions(backend, req), (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(
      JSON.stringify({
        error: 'backend_unreachable',
        message: `Could not reach Modulo backend at ${backend.origin}: ${err.message}`,
      })
    );
  });

  req.pipe(proxyReq);
}

function proxyUpgrade(backend, req, socket, head) {
  const mod = backend.protocol === 'https:' ? https : http;
  const proxyReq = mod.request(backendRequestOptions(backend, req));

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    // Replay the backend's 101 handshake to the client verbatim, then splice
    // the two sockets together so WebSocket frames flow untouched.
    const lines = [
      `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage || 'Switching Protocols'}`,
    ];
    for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
      lines.push(`${proxyRes.rawHeaders[i]}: ${proxyRes.rawHeaders[i + 1]}`);
    }
    socket.write(lines.join('\r\n') + '\r\n\r\n');

    if (proxyHead && proxyHead.length) socket.write(proxyHead);
    if (head && head.length) proxySocket.write(head);

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);

    const teardown = () => {
      socket.destroy();
      proxySocket.destroy();
    };
    socket.on('error', teardown);
    socket.on('close', teardown);
    proxySocket.on('error', teardown);
    proxySocket.on('close', teardown);
  });

  // Backend answered with a normal response instead of upgrading.
  proxyReq.on('response', (proxyRes) => {
    socket.end(`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage || ''}\r\n\r\n`);
  });

  proxyReq.on('error', () => socket.destroy());
  socket.on('error', () => proxyReq.destroy());

  proxyReq.end();
}

/**
 * Start the server.
 *
 * @param {object} options
 * @param {string} options.distDir     Directory with the built frontend (index.html).
 * @param {string} [options.backendUrl] Backend origin, default http://localhost:8080.
 * @param {number} [options.port]      Port to listen on; 0 picks a free one.
 * @param {string} [options.host]      Bind address, default 127.0.0.1 (never expose beyond loopback).
 * @returns {Promise<{server: import('http').Server, port: number, url: string, close: () => Promise<void>}>}
 */
function createAppServer({ distDir, backendUrl = 'http://localhost:8080', port = 0, host = '127.0.0.1' }) {
  const resolvedDist = path.resolve(distDir);
  if (!fs.existsSync(path.join(resolvedDist, 'index.html'))) {
    return Promise.reject(
      new Error(
        `No frontend build found at ${resolvedDist} — run "npm run build" in frontend/ first.`
      )
    );
  }
  const backend = new URL(backendUrl);

  const server = http.createServer((req, res) => {
    const pathname = pathnameOf(req.url);
    if (pathname !== null && isProxiedPath(pathname)) {
      proxyRequest(backend, req, res);
    } else {
      serveStatic(resolvedDist, pathname, res);
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const pathname = pathnameOf(req.url);
    if (pathname !== null && isProxiedPath(pathname)) {
      proxyUpgrade(backend, req, socket, head);
    } else {
      socket.destroy();
    }
  });

  // Track raw sockets ourselves: server.closeAllConnections() does not cover
  // upgraded (WebSocket) sockets, which would leave close() hanging forever.
  const sockets = new Set();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${port} is already in use (a running Vite dev server?). Close it or set ` +
              'MODULO_DESKTOP_PORT — note that a non-default port must also be allowed in ' +
              "Keycloak's redirect URIs and the backend CORS allowlist."
          )
        );
      } else {
        reject(err);
      }
    });
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      resolve({
        server,
        port: actualPort,
        url: `http://${host}:${actualPort}`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
            for (const socket of sockets) socket.destroy();
          }),
      });
    });
  });
}

module.exports = { createAppServer, PROXY_PREFIXES };

// Standalone mode for testing the serving/proxy layer without Electron.
if (require.main === module) {
  const distDir = process.env.MODULO_DIST_DIR || path.join(__dirname, '..', 'frontend', 'dist');
  const backendUrl = process.env.MODULO_BACKEND_URL || 'http://localhost:8080';
  const port = Number(process.env.MODULO_DESKTOP_PORT || 3000);

  createAppServer({ distDir, backendUrl, port })
    .then(({ url }) => {
      console.log(`Modulo desktop server listening at ${url} (backend: ${backendUrl})`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
