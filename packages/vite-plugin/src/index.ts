// The transport surface (WsManager and the protocol's types) is re-exported here because this package
// is the only published carrier of it: @viteburner/bb-ws-server is bundled into this package rather than published
// on its own, so a caller that used to reach it through `viteburner` still finds it — and finds the
// same copy the daemon runs, which the port allocator's module state requires.
export * from '@viteburner/bb-ws-server';
export * from './config';
export * from './console';
export * from './plugin';
export * from './types';
export * from './utils/path';
