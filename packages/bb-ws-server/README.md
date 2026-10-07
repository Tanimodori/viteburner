# bb-ws-server

Server side of the [Bitburner Remote API](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/en/programming/remote_api.md).

Bitburner connects to this package's WebSocket server as a client; `WsManager` sends the protocol's request/response calls to it and returns the validated results. One port serves one active client: the last client to connect, which is the one every request is sent to and the only one whose responses are accepted.

## Usage

```ts
import { WsManager } from 'bb-ws-server';

const manager = new WsManager({ port: 12525 });
manager.onConnected(async (client) => {
  // called whenever `client` becomes the active one
});
await manager.pushFile({ filename: 'script.js', content: '...', server: 'home' });
```

## API

- `WsManager` — the Remote API calls (`pushFile`, `getFile`, `deleteFile`, `getFileNames`, `getAllFiles`, `calculateRam`, `getDefinitionFile`) plus `onConnected`, `connected`, `client` and `close`.
- `Logger` / `consoleLogger` — the diagnostics sink the manager writes to.
- Message param/response types and their zod validators (`PushFileParams`, `pushFileResponseSchema`, …).
