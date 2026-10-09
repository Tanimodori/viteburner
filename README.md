# viteburner

Daemon tools of bitburner using vite for script transform, file syncing, RAM monitoring and more!

**Packages**

- **[bb-ws-server](packages/bb-ws-server/README.md)**: The Bitburner Remote API WebSocket server and its `WsManager` client
- **[vite-plugin-viteburner](packages/vite-plugin-viteburner/README.md)**: The standalone vite plugin: file watching, transform, sync, and config resolution
- **[viteburner](packages/viteburner/README.md)**: The CLI built on the plugin, published to npm, and re-exporting the plugin
- **[viteburner-e2e-test](tests/viteburner-e2e-test/README.md)**: End-to-end suite that drives the built CLI from the outside (vitest + Playwright)
- **[viteburner-config-test](tests/viteburner-config-test/README.md)**: Config suite that resolves every config form through a real vite server

## Development

To build the projects in this repo, try these shell commands:

```
npm install -g @microsoft/rush
rush install
rush build
```

For more information, see the documentation at: https://rushjs.io/
