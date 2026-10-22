# viteburner

Daemon tools of bitburner using vite for script transform, file syncing, RAM monitoring and more!

**Packages**

Published to npm: **viteburner** (unscoped), **@viteburner/vite-plugin** (the `@viteburner` scope), and **create-viteburner**. The rest are internal.

Runtime requirements: Node.js `>=20.19.0` and Vite 7 (`vite@^7`).

- **[@viteburner/bb-ws-server](packages/bb-ws-server/README.md)**: The Bitburner Remote API WebSocket server and its `WsManager` client. Internal — bundled into the plugin, never published
- **[@viteburner/vite-plugin](packages/vite-plugin/README.md)**: The vite plugin: file watching, transform, sync, and config resolution
- **[viteburner](packages/viteburner/README.md)**: The CLI built on the plugin, and re-exporting it
- **[create-viteburner](packages/create-viteburner/README.md)**: Scaffolds a new project from the shared template
- **[viteburner-template](templates/viteburner-template)**: The hand-written template source. The standalone [`Tanimodori/viteburner-template`](https://github.com/Tanimodori/viteburner-template) repository is generated from it
- **[viteburner-create-test](tests/viteburner-create-test/README.md)**: Scaffold suite that runs the installed `create-viteburner` and type-checks the generated project
- **[viteburner-e2e-test](tests/viteburner-e2e-test/README.md)**: End-to-end suite that drives the built CLI from the outside (vitest + Playwright)
- **[viteburner-config-test](tests/viteburner-config-test/README.md)**: Config suite that resolves every config form through a real vite server

## Development

Development requires Node.js `>=24` (the range Rush enforces in `rush.json`); the published packages themselves run on Node 20.19+.

To build the projects in this repo, try these shell commands:

```
npm install -g @microsoft/rush
rush install
rush build
```

For more information, see the documentation at: https://rushjs.io/
