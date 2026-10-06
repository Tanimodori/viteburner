# viteburner E2E 测试包

这个项目不看源码，它从包外运行**构建出来的** viteburner CLI，并判断真实同步链路的端到端行为：一个真实的 Bitburner 网页构建在真实浏览器里跑起来，通过游戏自带的 Remote API 连上 CLI，测试再从游戏那一侧验证上传的脚本出现、能被读取、能被游戏引擎执行。

本包通过 `workspace:*` 依赖 `viteburner`，用 `require.resolve('viteburner')` 反推出它的包根，再从 `bin/viteburner.js` 启动——走的正是发布到 npm 的那条路径。被同步的 fixture 工程也归本包（`src/`，由原来的 `packages/viteburner/playground` 迁入）：测试的唯一消费者就是这套 E2E，放在被测包之外才不会再被误当作要发布的源码。

## 构成

- `src/` —— **fixture 工程**，即被测 CLI 实际同步的那份源码工程（原来的 `packages/viteburner/playground` 整体迁入此处）。`src/vite.config.ts` 是它交给 CLI 的配置，`src/src/**` 是待上传的源码。测试运行时它被整份复制到 `test/.tmp/project/`，所以原目录始终保持只读。
- `test/helpers/` —— 端到端所需的机件：`ensure-game.ts` 下载并校验固定版 Bitburner 构建，`static-server.ts` 用回环地址 serve 它，`project.ts` 把 `src/` 复制成隔离副本，`cli.ts` 起停真实 CLI 进程，`browser.ts` 按所需 flags 启动 Chromium，`game.ts` 是游戏内操作（连接 Remote API、跑终端命令、`ls`/`cat`/`run` 并取回终端文本），`flow.ts` 把前几样拼成一次 fixture。
- `test/helpers/fixture.ts` —— fixture 清单：每个源文件对应的上传路径、`dumpFiles` 落点、转换标志、期望内容，以及游戏会怎么跑它。这是本包对同步结果的唯一事实来源。
- `test/fixture-manifest.spec.ts` —— 不开浏览器、不跑 CLI，只校验清单与 `src/` 磁盘内容一致（声明了每个文件、且只声明存在的文件；上传/落点按配置规则推导；运行结论齐全）。
- `test/local.spec.ts` —— 默认腿。固定构建 + 固定结论：fixture 的每个文件都上传、都能被游戏 `cat` 回（转换过的带 inline sourcemap）、都被 `dumpFiles` 克隆到 `dist/`，能跑的脚本逐个 `run` 并核对输出，本构建拒绝的两个文件断言拒绝信息而不是假装成功，最后验证新增文件的实时同步与删除。
- `test/live.spec.ts` —— opt-in 活体腿。同一条链路，但游戏取自 <https://bitburner-official.github.io/>，会随上游更新漂移，不在默认命令里。
- `test/global-setup.ts` —— 本地腿开始前跑一次，下载并缓存固定构建。
- `test/scripts/ensure-game.ts` —— 手动入口，只下载构建、不跑 spec。

## 在固定构建上观察到的事实

断言用的是**测出来的**结果，不是想当然的结论。用 v3.0.1（commit `1540b4d5`）实测：

- 12 个源文件全部上传，其中 10 个 `.ts` 经 vite 转换为 `.js`，`foo.txt` 与 `ns1.script` 原样复制。
- 可运行并通过：`template.js`、`deep/multi-entry.js`、`enum/index.js`、`import/main.js`（相对路径、`@/`、`/src/` 三种写法都解析到同一批上传文件）、`importGlob/index.js`（`import.meta.glob` 在转换期展开）。
- 上传成功但本构建拒绝执行，测试固定这一事实：`ns1.script` 报 `Running .script files is unsupported`（v3 已移除 Netscript 1.0），`importExternal/main.js` 报 `Invalid module path: "https://unpkg.com/…"`（游戏自身的模块加载器不接受 URL 导入，转换阶段按 issue #12 有意原样保留）。

## 从 Playwright 迁到 vitest

原先 `packages/viteburner` 下由 `@playwright/test` 承担 runner，本包改为 **vitest 驱动，浏览器控制用 `playwright` 库**。这是本仓库的版本约束决定的：`vitest@0.34.6` 是支持 `vite@4` 的最后一个稳定版（见仓库记忆 `tsx-migration`），因此不能跟着新 vitest 用 `@vitest/browser` 之类需要更高 vite 的集成。

映射关系：

- `test.beforeAll` / `test.afterAll` → `beforeAll` / `afterAll`；`test.describe.configure({ mode: 'serial' })` 不再需要——`vitest.config.ts` 设了 `threads: false`，文件内本就是顺序执行。
- Playwright 的自动重试断言 `expect(locator).toContainText(...)` → `expectLocatorText()`（`test/helpers/game.ts`），内部是 `vi.waitFor` 轮询 `locator.innerText()`。`vi.waitFor` 是 0.34.6 就有的 API，等价于新版的 `expect.poll`。
- `test.step(...)` → 没有等价 API（0.34.6 未提供）。`local.spec.ts` 改为把一次性的准备（起服务、连游戏、初始同步）放进 `beforeAll`，其余按“读同一个已建立的状态”拆成多个 `it`，失败点因此就是失败的那一项，而不是一串无关报错。迁移时它还是一个线性流程的单个 `it`（见该文件的注释）。
- `playwright.config.ts` 的 `launchOptions.args` → `test/helpers/browser.ts` 的 `launchGameBrowser()`。
- `@playwright/test` 的 `devices[...]` 与 projects → 由 `--mode` 选腿：`vitest run`（默认 mode `test`）跑本地腿，`vitest run --mode live` 跑活体腿；两个 spec 各自用 `describe.skipIf`（`test/testUtils/mode.ts`）自守。
- 失败时把 CLI 日志写文件（`testInfo.attach`）→ `onTestFailed` 里打印日志尾部，控制台就是证据。

## 运行

```bash
rushx setup        # 装 Chromium + 下载固定构建（首次）
rushx test:e2e     # 默认：确定性本地腿
rushx test:e2e:live # opt-in：对官方在线站的冒烟测试
rushx test:e2e:watch # vitest watch 模式
rushx typecheck    # tsc --noEmit
```

前置：先在 `packages/viteburner` 里 `rushx build`（本包跑的是它的 `dist/`）；在 Rush 仓库里 `rush build` 会按依赖图先构建它。

`E2E_GAME_DIR=/path/to/build` 可改为 serve 一个现成构建而不下载；`E2E_KEEP=1` 保留 `test/.tmp/project/` 供人工检查。

## 目录与忽略

固定构建与临时项目缓存于 `test/.cache/`、`test/.tmp/`（均 gitignore）。`src/` 是从 `packages/viteburner/playground` 迁来的 fixture 工程（那次迁移把 fixture 交给它唯一的消费者），只读；`packages/viteburner` 里原来的 `e2e/` 与 `playwright.config.ts` 已删除。
