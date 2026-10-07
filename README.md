# viteburner

Daemon tools of bitburner using vite for script transform, file syncing, RAM monitoring and more!

**Packages**

- **[bb-ws-server](packages/bb-ws-server/README.md)**: The Bitburner Remote API WebSocket server and its `WsManager` client
- **[viteburner](packages/viteburner/README.md)**: The CLI/daemon package published to npm
- **[viteburner-e2e-test](tests/viteburner-e2e-test/README.md)**: End-to-end suite that drives the built CLI from the outside (vitest + Playwright)

## Development

To build the projects in this repo, try these shell commands:

```
npm install -g @microsoft/rush
rush install
rush build
```

For more information, see the documentation at: https://rushjs.io/
