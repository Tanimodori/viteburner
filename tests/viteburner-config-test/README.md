# viteburner config 测试包

这个项目只测一件事：**配置是怎么被加载和解析的**。它把每个 fixture 工程交给真实的 vite 配置解析管线（和 CLI 走同一条 `config` → `configResolved`），然后从包外检查解析出来的 `viteburner` 配置对不对。没有浏览器、没有游戏、没有 CLI 进程，一个 spec、八个用例，全部在一秒内跑完。

本包通过 `workspace:*` 依赖 `viteburner`，跑的是它构建出来的 `dist/`（所以先在 `packages/viteburner` 里 `rushx build`）。

## 两类测试

`test/config.spec.ts` 里两个 `describe`，分别对应两类：

1. **完整配置，七种加载方式**（`COMPLETE_SUITES`）。每个 fixture 写的是**同一个**完整配置，只是换一种文件形式：`vite.config.ts`、`vite.config.js`、`vite.config.js` 的函数式、`viteburner.config.ts`、`viteburner.config.ts` 的函数式（async）、`viteburner.config.js`、`viteburner.config.json`。七份期望值完全一致，因此任意两份之间的差异只能来自「加载方式」，不可能来自「写的内容」。
2. **两份配置合并**（`MERGE_SUITES`）。一份 `vite.config.js` 放 `watch`、`usePolling`、`port` 和 `build.sourcemap`，一份 `viteburner.config.js` 放 `timeout`、`dts`、`ignoreInitial`、`download`，期望两边叠加。**刻意只放不相交的键**：这里不比顺序，只比「叠加成了同一份配置」；实际优先级是 standalone > `vite.config` 的 `viteburner` 键，inline CLI 选项最高。

## 每条用例检查什么

对每个 fixture，spec 用**两条独立路径**把配置读回来，再逐字段比对：

- `resolvedConfig.viteburner`：一个**外挂 plugin**（`test/resolve.ts` 里的 `config-test:capture`）在 `configResolved` 里抓下来的。这是任何第三方 plugin、以及 CLI 在 `findViteBurnerPlugin(server.config)` 之后看到的那份。
- `plugin.api.getPluginConfig()`：viteburner 插件自己提供的新 API（`ViteBurnerPluginApi.getPluginConfig`），从 `configResolved` 记住配置，**同步**返回。

断言依次是：

1. `getPluginConfig()` 返回的对象与 `resolvedConfig.viteburner` **是同一个对象**（`toBe`），证明两条路读的是同一份解析结果，而不是各自算了一遍。
2. 用 `viewResolved()`（`test/view.ts`）把两份配置都拍平成普通数据，分别与期望值 `toEqual`。
3. `cwd` 等于 fixture 目录——CLI 传的 inline `cwd` 胜过配置文件里可能写的值。

### 为什么配置值里不写函数

`viewResolved` 会把**解析后仍是函数**的字段调用一遍：每个 `watch[].location`、`download.location`、`dumpFiles`。所以除两个函数式 fixture 外，配置**值**里一个函数都不写（`location` 只用字符串、数组、`{ server, filename }` 对象；`dumpFiles` 只用字符串），这样函数的行为是 **viteburner 解析出来的**，而不是 fixture 自己塞进去的——比对的是解析逻辑，不是 fixture 的输入。两个函数式 fixture 只是把整个配置写成导出函数，配置值本身仍遵守这条规则。`download.location` 没有非函数写法，就固定断言它的默认行为（`'src/' + file`）。

## 为什么用 `resolveConfig` 而不是 `createServer`

CLI 用的是 `createServer`，但 `createServer` 会**初始化服务器**：起 chokidar watcher、占 WebSocket 端口，并可能触发插件的 `buildStart`。这对只关心配置解析的测试是纯粹的副作用，还会带来端口冲突和 watcher 泄漏的风险。

`resolveConfig(config, 'serve')` 跑完整条配置管线——`config` 钩子加载/合并/解析，然后所有插件的 `configResolved`——但到此为止，不创建服务器。所以 `test/resolve.ts` 用它，suite 之间没有任何需要清理的东西。

## 目录结构

```
src/                         fixture 工程，每个测试套一件，只读
  vite-config-ts/            vite.config.ts 的完整配置
  vite-config-js/            vite.config.js 的完整配置
  vite-config-function/      vite.config.js 的完整配置（导出函数）
  viteburner-config-ts/      viteburner.config.ts 的完整配置
  viteburner-config-function/ viteburner.config.ts 的完整配置（导出 async 函数）
  viteburner-config-js/      viteburner.config.js 的完整配置
  viteburner-config-json/    viteburner.config.json 的完整配置
  merge-vite-and-viteburner-config/
                             vite.config.js + viteburner.config.js，各放一半配置
test/
  config.spec.ts             两个 describe、八个用例
  suites.ts                  fixture 清单：目录、文件、期望的解析结果 —— 期望值的唯一来源
  view.ts                    把 ResolvedViteBurnerConfig 拍平成可比对的普通数据
  resolve.ts                 起一次 resolveConfig、装外挂 plugin、读回两份配置
  paths.ts                   包根与 fixture 路径
```

## 运行

```bash
rushx test:config      # vitest run
rushx test:config:watch
rushx typecheck        # tsc --noEmit
rushx lint             # tsc + oxlint + oxfmt --check
```

前置：先在 `packages/viteburner` 里 `rushx build`（本包跑的是它的 `dist/`）；在 Rush 仓库里 `rush build` 会按依赖图先构建它。

## 观察到的行为

用 `vite@7` 实测，八条用例全绿：

- 七种加载方式解析出的配置**逐字段一致**，包括 `vite.config.*` 里 `build.sourcemap: true` 与 `viteburner.sourcemap: 'inline'` 并存时解析为 `'inline'`（`load.ts` 把 vite 的值放进 unconfig 的 `defaults`，standalone 的值胜出）。
- standalone `viteburner.config.*` 可以导出对象，也可以导出函数；函数会收到 vite 的 `ConfigEnv`（`command`、`mode` 等），并且可以是 async。fixture 用 `port` 分支同时验证了这一点。
- `watch[].location` 解析成 `{ filename, server }[]`：默认落点去掉 `src/` 前缀并把 `.ts` 换成 `.js`；对象形式的 `filename` 若带子目录会补上前导斜杠（`data/keep.txt` → `/data/keep.txt`），根目录则不加。
- `vite.config.js` 与 `viteburner.config.js` 的字段叠加成一份配置，`build.sourcemap` 也作为 sourcemap 默认值传了进来。
