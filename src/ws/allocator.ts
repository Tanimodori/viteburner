import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WebSocketServer, ServerOptions } from 'ws';

let reused = false;
let wss: WebSocketServer | null = null;
let wssPort = -1;

export function getWss(port: number, tls = false): Promise<WebSocketServer> {
  return new Promise((resolve) => {
    if (wss === null || wssPort !== port) {
      if (wss) {
        wss.clients.forEach((ws) => ws.close());
        wss.close();
      }
      wssPort = port;

      if (tls) {
        const certPath = join(__dirname, '../tls/cert.pem');
        const keyPath = join(__dirname, '../tls/key.pem');
        const httpsServer = createHttpsServer({
          cert: readFileSync(certPath),
          key: readFileSync(keyPath),
        });
        wss = new WebSocketServer({ server: httpsServer } as ServerOptions);
        httpsServer.listen(port, () => {
          reused = false;
          resolve(wss!);
        });
      } else {
        wss = new WebSocketServer({ port });
        reused = false;
        resolve(wss);
      }
    } else {
      reused = true;
      resolve(wss!);
    }
  });
}

export function isWssReused() {
  return reused;
}
