import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
};

export interface StaticServer {
  url: string;
  close(): Promise<void>;
}

/**
 * Minimal static file server so the pinned game build can be loaded from a trustworthy
 * `http://127.0.0.1:<port>` origin. Serves .wasm with the correct MIME type (required by
 * `WebAssembly.instantiateStreaming`).
 */
export async function startStaticServer(rootDir: string): Promise<StaticServer> {
  const root = path.resolve(rootDir);
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let filePath = path.resolve(path.join(root, urlPath));
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end(`Not found: ${urlPath}`);
        return;
      }
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as net.AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
