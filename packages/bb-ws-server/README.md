# @viteburner/bb-ws-server

Server side of the [Bitburner Remote API](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/en/programming/remote_api.md).

Bitburner connects to this package's WebSocket server as a client; `WsManager` sends the protocol's request/response calls to it and returns the validated results. One port serves one active client: the last client to connect, which is the one every request is sent to and the only one whose responses are accepted.

The server under a port is shared and held for as long as any manager uses it, so a host that rebuilds its manager while the old one is still up — a dev server restarting on a config change, say — reuses the running server instead of binding again. `close` gives up that manager's hold, and the last hold closes the port.

**This package is internal.** It is bundled into `@viteburner/vite-plugin` — which re-exports everything below, as does `viteburner` — rather than published on its own, so only code inside this repository imports it by this name. (That is also why it carries no version that means anything.)

## Usage

```ts
// In this repository: '@viteburner/bb-ws-server'. Outside it, the same API arrives from '@viteburner/vite-plugin'.
import { WsManager } from '@viteburner/bb-ws-server';

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
