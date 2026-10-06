# viteburner E2E 测试包

这个项目不看源码，它从包外运行**构建出来的** viteburner CLI，并判断真实同步链路的端到端行为：一个真实的 Bitburner 网页构建在真实浏览器里跑起来，通过游戏自带的 Remote API 连上 CLI，测试再从游戏那一侧验证上传的脚本出现、能被读取、能被游戏引擎执行。

独立成项目（而不是留在 `packages/viteburner` 里）的理由和参考仓库的测试包一致：被测对象是 `viteburner` 交出去的产物，测试用的浏览器与流程也不该混进那个要发布的包里。这里通过 `workspace:*` 依赖 `viteburner`，用 `require.resolve('viteburner')` 反推出它的包根，再从 `bin/viteburner.js` 启动——走的正是发布到 npm 的那条路径。

## 构成

- `test/helpers/` —— 端到端所需的机件：`ensure-game.ts` 下载并校验固定版 Bitburner 构建，`static-server.ts` 用回环地址 serve 它，`project.ts` 复制 `packages/viteburner/playground` 成隔离副本，`cli.ts` 起停真实 CLI 进程，`browser.ts` 按所需 flags 启动 Chromium，`game.ts` 是游戏内操作（连接 Remote API、跑终端命令、轮询终端文本），`flow.ts` 把前几样拼成一次 fixture。
- `test/local.spec.ts` —— 默认腿。固定构建 + 固定结论：初始上传出现在 `ls`、改动源码被实时转换同步、游戏能 `cat` 与 `run`，且 CLI 日志是同一批字节的来源证据。
- `test/live.spec.ts` —— opt-in 活体腿。同一条链路，但游戏取自 <https://bitburner-official.github.io/>，会随上游更新漂移，不在默认命令里。
- `test/global-setup.ts` —— 本地腿开始前跑一次，下载并缓存固定构建。
- `test/scripts/ensure-game.ts` —— 手动入口，只下载构建、不跑 spec。

## 从 Playwright 迁到 vitest

原先 `packages/viteburner` 下由 `@playwright/test` 承担 runner，本包改为 **vitest 驱动，浏览器控制用 `playwright` 库**。这是本仓库的版本约束决定的：`vitest@0.34.6` 是支持 `vite@4` 的最后一个稳定版（见仓库记忆 `tsx-migration`），因此不能跟着新 vitest 用 `@vitest/browser` 之类需要更高 vite 的集成。

映射关系：

- `test.beforeAll` / `test.afterAll` → `beforeAll` / `afterAll`；`test.describe.configure({ mode: 'serial' })` 不再需要——`vitest.config.ts` 设了 `threads: false`，文件内本就是顺序执行。
- Playwright 的自动重试断言 `expect(locator).toContainText(...)` → `expectLocatorText()`（`test/helpers/game.ts`），内部是 `vi.waitFor` 轮询 `locator.innerText()`。`vi.waitFor` 是 0.34.6 就有的 API，等价于新版的 `expect.poll`。
- `test.step(...)` → 没有等价 API（0.34.6 未提供），改为在单个 `it` 内用注释标出阶段。原测试本就是一个线性流程，拆成多个 `it` 只会让中途失败变成一串无关报错。
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

固定构建与临时项目缓存于 `test/.cache/`、`test/.tmp/`（均 gitignore）。`packages/viteburner` 里原来的 `e2e/` 与 `playwright.config.ts` 已删除；`playground/` 原地保留，只作为本包的只读 fixture。
