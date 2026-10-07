import { describe, expect, it } from 'vitest';
import { suiteDir } from './paths';
import { resolveSuite } from './resolve';
import { COMPLETE_SUITES, MERGE_SUITES, type ConfigSuite } from './suites';
import { viewResolved } from './view';

/**
 * Resolve one fixture project and check the config both ways.
 *
 * The same expectations run for every suite: the config on `resolvedConfig.viteburner` (the outside
 * plugin's view), the config from `getPluginConfig()` (the plugin's own view), that the two are the
 * same object, and that `cwd` is the project directory rather than the process's working directory.
 */
async function expectSuite(suite: ConfigSuite) {
  const dir = suiteDir(suite.dir);
  const { fromResolvedConfig, fromApi } = await resolveSuite(dir);
  if (!fromResolvedConfig || !fromApi) {
    throw new Error(
      `${suite.dir} resolved no viteburner config ` +
        `(resolvedConfig: ${Boolean(fromResolvedConfig)}, getPluginConfig: ${Boolean(fromApi)})`,
    );
  }

  expect(fromApi, 'getPluginConfig() is the object the resolved config carries').toBe(fromResolvedConfig);
  expect(viewResolved(fromResolvedConfig), `resolvedConfig.viteburner of ${suite.dir}`).toEqual(suite.expected);
  expect(viewResolved(fromApi), `getPluginConfig() of ${suite.dir}`).toEqual(suite.expected);
  expect(fromResolvedConfig.cwd, `cwd of ${suite.dir}`).toBe(dir);
}

describe('a complete config resolves the same way from every file', () => {
  for (const suite of COMPLETE_SUITES) {
    it(`loads ${suite.files.join(' + ')}`, () => expectSuite(suite));
  }
});

describe('configs from a vite config and a viteburner config merge', () => {
  for (const suite of MERGE_SUITES) {
    it(`merges ${suite.files.join(' + ')}`, () => expectSuite(suite));
  }
});
