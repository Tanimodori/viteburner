# viteburner

Daemon tools of bitburner using vite for script transform, file syncing, RAM monitoring and more!

**Packages**

Published to npm: **viteburner** (unscoped) and **@viteburner/vite-plugin** (the `@viteburner` scope). The rest are internal.

- **[@viteburner/bb-ws-server](packages/bb-ws-server/README.md)**: The Bitburner Remote API WebSocket server and its `WsManager` client. Internal — bundled into the plugin, never published
- **[@viteburner/vite-plugin](packages/vite-plugin/README.md)**: The vite plugin: file watching, transform, sync, and config resolution
- **[viteburner](packages/viteburner/README.md)**: The CLI built on the plugin, and re-exporting it
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
