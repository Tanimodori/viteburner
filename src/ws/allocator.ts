import { WebSocketServer } from 'ws';

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
  }
  return wss;
}
