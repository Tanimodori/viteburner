#!/usr/bin/env node
// `prepublishOnly` guard for the publishable packages.
//
// `npm pack` keeps `workspace:*` dependencies verbatim, so `npm publish` would ship a
// `viteburner` tarball whose dependency on `@viteburner/vite-plugin` cannot be installed.
// pnpm rewrites workspace specs during pack/publish, and Rush's publish action invokes pnpm.

const agent = process.env.npm_config_user_agent ?? '';

if (!agent.startsWith('pnpm/')) {
  console.error('Publish with "rush publish" (which uses pnpm), not npm or yarn.');
  console.error('npm pack keeps workspace:* in package.json and produces an installable-looking but broken tarball.');
  process.exit(1);
}
