import { WebSocketServer } from 'ws';

let reused = false;
let wss: WebSocketServer | null = null;
let wssPort = -1;

export function getWss(port: number) {
  if (wss === null || wssPort !== port) {
    if (wss) {
      wss.clients.forEach((ws) => ws.close());
      wss.close();
    }
    wssPort = port;
    wss = new WebSocketServer({ port });
    reused = false;
  } else {
    reused = true;
  }
  return wss;
}

export function isWssReused() {
  return reused;
}
