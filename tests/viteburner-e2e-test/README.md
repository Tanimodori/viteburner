# viteburner E2E 测试包

这个项目不看源码，它从包外运行**构建出来的** viteburner CLI，并判断真实同步链路的端到端行为：一个真实的 Bitburner 网页在真实浏览器里跑起来，通过游戏自带的 Remote API 连上 CLI，测试再从游戏那一侧验证上传的脚本出现、能被读取、能被游戏引擎执行。

本包通过 `workspace:*` 依赖 `viteburner`，用 `require.resolve('viteburner')` 反推出它的包根，再从 `bin/viteburner.js` 启动——走的正是发布到 npm 的那条路径。被同步的 fixture 工程作为本包的“源码”放在包根的 `src/`（`vite.config.ts` + 自己的 `tsconfig.json` + `src/**`），测试运行时才复制到 `test/` 下的临时目录执行。

## 一条流程，两条腿

整套测试只有**一个 spec、九个步骤**。mode 只决定步骤跑在哪个游戏上，不决定跑哪些步骤：

- **离线腿**（默认，`rushx test:e2e`）：游戏取自固定版构建（v3.0.1，commit `1540b4d5`），从 `test/.cache/` 经回环地址 serve。结论确定，是默认命令。
- **在线腿**（`rushx test:e2e:live`）：同一个 spec、同样九步，但游戏取自 <https://bitburner-official.github.io/>，会随上游更新漂移，因此不在默认命令里。

因此一条行为要么两条腿都被证明，要么在漂移的那条腿上报错。（`test/mode.ts` 暴露 `live` 供选择游戏源；`vitest.config.ts` 用同一条件给离线腿挂上「下载固定构建」的 global setup。）

## 测试的四个阶段

`test/e2e.spec.ts` 里的 `beforeAll` / `afterAll` 与九个 `it` 就是这四个阶段：

1. **fixture**（`beforeAll` 前半）：把只读的 fixture 工程（包根 `src/`）复制到 `test/.tmp/project/`；离线腿另外确保固定构建已下载并 serve 到回环地址。
2. **before-test**（`beforeAll` 后半）：起真实 CLI（`cli/vite.ts`）与浏览器（`web/browser.ts`），加载游戏、关掉教程，通过 Remote API 把游戏连到 CLI，并等 fixture 的**每个**文件都完成初次同步。
3. **test**（九个 `it`）：九步测试，读的都是阶段 2 建立起来的状态；第 6 步会改动工程副本（新增源文件、再删掉），第 9 步会退出 CLI，所以它必须排最后。
4. **after-test**（`afterAll`）：关浏览器、停 CLI、关静态服务，并删除工程副本（`E2E_KEEP=1` 时保留供人工检查）。

`vitest.config.ts` 的 `threads: false` 是让阶段 2 的状态能跨九个 `it` 存活的依据：一个浏览器、一个 CLI、一个游戏、一条 websocket。

### 九步测试

1. 每个 fixture 文件都上传到游戏：CLI 日志里有该文件的 `hmr add … (done)`，游戏侧 `ls` 也列得出。
2. 游戏能 `cat` 回每个文件且内容正确：转换过的带 inline sourcemap，原样复制的没有。
3. `dumpFiles` 把转换结果克隆到 fixture 的 `dist/`：内容与提交在 `test/fixture/dist/` 的基线逐字比对（inline sourcemap 与行尾除外）。
4. 每个可执行脚本逐个 `run`，核对其输出行，且没有运行时错误。
5. 本游戏拒绝执行的文件（`ns1.script`、`importExternal/main.js`）报告拒绝信息，而不是假装成功。
6. 新增源文件实时同步到游戏、能被 `cat`/`run`，删除后在游戏里消失。
7. CLI 的按键处理器有响应：`h` 打印帮助、`s` 打印状态（含 connection: connected）、`u` 触发全量上传并把 fixture 文件按 `hmr change … (done)` 重传。
8. `r` 打开 `prompts` 的 RAM 查询菜单并选默认的「All local scripts」：CLI 向游戏逐文件问 RAM，报告与提交在 `test/fixture/ram/offline.txt` 的基线逐字比对（**仅离线腿**：数值是游戏算的，会随游戏版本漂移）。
9. `q` 优雅退出 CLI：日志打 `bye`，进程以 code 0 结束。

第 7、8 步打的是 CLI 自己的键盘处理（`console.ts` 的 `onKeypress` / `task.ts` 的 `handleKeyInput`），不是游戏终端。CLI 由 `cli/cli.ts` 以 **piped stdin** 启动，`ViteburnerCli.sendKey()` 写入的每个字符就是一个 `keypress` 事件。stdin 不是 TTY，所以 CLI 会打一条 not-a-TTY 警告并跳过 raw mode——这些键走 `key.name`，不受影响；`prompts` 的菜单在 pipe 下照常渲染、方向键/回车/Ctrl+C 都能用。退出键（Ctrl+C、ESC）各自会让进程结束，一个 CLI 实例只能测一次退出，故只覆盖了 `q`。

## 目录结构

```
src/                fixture 工程本体（包根 src/ 下为 vite.config.ts、tsconfig.json 与待上传的 src/src/**），只读；
                    测试前整份复制到 test/.tmp/project/，测试只跑副本
test/
  e2e.spec.ts        主测试：四个阶段 + 九步测试
  mode.ts            当前是哪条腿（import.meta.env.MODE）
  paths.ts           包根，供各域推导 fixture/cache/tmp 路径
  env.d.ts           声明 import.meta.env.MODE
  local/             本地服务器准备与运行
    ensure-game.ts     下载并校验固定版构建（缓存于 test/.cache/）
    static-server.ts   用回环地址 serve 构建
    global-setup.ts    离线腿开始前跑一次，预热构建
    setup-game.ts      手动入口：`rushx setup:game` 只下载不跑 spec
  fixture/           fixture 的清单与脚手架（工程本体在包根 src/）
    project.ts         fixture 工程的路径、复制成隔离副本、读写源文件
    manifest.ts       fixture 清单：上传/落点/转换/期望内容/运行结论 —— 同步结果的唯一事实来源
    dump.ts           dump 基线路径与 inline sourcemap 归一化（第 3 步的逐字比对）
    dist/             dump 基线（golden file）：第 3 步逐字比对的转换结果，提交进仓库
    ram.ts            RAM 报告基线路径与日志归一化（第 8 步的逐字比对）
    ram/              RAM 基线（golden file）：第 8 步在固定构建上取到的 RAM 报告，提交进仓库
    verify-script.ts  九步测试第 6 步新增的那个脚本，及其来源/上传路径
    manifest.spec.ts  不开浏览器、不跑 CLI，只校验清单与磁盘内容一致
  cli/               cli 操作，vite 框架搭建
    cli.ts            起停真实 CLI 进程，捕获并可等待其日志；以 piped stdin 启动，sendKey() 送按键
    vite.ts           用 fixture 工程装配一次 CLI（选端口、等待 watching）
  web/               浏览器控制、游戏控制
    browser.ts        按所需 flags 启动 Chromium
    game.ts           游戏内操作：连接 Remote API、终端命令、ls/cat/run 取回终端文本
```

## 在固定构建上观察到的事实

断言用的是**测出来的**结果，不是想当然的结论。用 v3.0.1（commit `1540b4d5`）实测（两条腿目前结论一致）：

- 12 个源文件全部上传，其中 10 个 `.ts` 经 vite 转换为 `.js`，`foo.txt` 与 `ns1.script` 原样复制。
- 可运行并通过：`template.js`、`deep/multi-entry.js`、`enum/index.js`、`import/main.js`（相对路径、`@/`、`/src/` 三种写法都解析到同一批上传文件）、`importGlob/index.js`（`import.meta.glob` 在转换期展开）。
- 上传成功但本构建拒绝执行，测试固定这一事实：`ns1.script` 报 `Running .script files is unsupported`（v3 已移除 Netscript 1.0），`importExternal/main.js` 报 `Invalid module path: "https://unpkg.com/…"`（游戏自身的模块加载器不接受 URL 导入，转换阶段按 issue #12 有意原样保留）。

## 从 Playwright 迁到 vitest

原先 `packages/viteburner` 下由 `@playwright/test` 承担 runner，本包改为 **vitest 驱动，浏览器控制用 `playwright` 库**。这是本仓库的版本约束决定的：`vitest@0.34.6` 是支持 `vite@4` 的最后一个稳定版（见仓库记忆 `tsx-migration`），因此不能跟着新 vitest 用 `@vitest/browser` 之类需要更高 vite 的集成。

映射关系：

- `test.beforeAll` / `test.afterAll` → `beforeAll` / `afterAll`；`test.describe.configure({ mode: 'serial' })` 不再需要——`vitest.config.ts` 设了 `threads: false`，文件内本就是顺序执行。
- Playwright 的自动重试断言 `expect(locator).toContainText(...)` → `expectLocatorText()`（`test/web/game.ts`），内部是 `vi.waitFor` 轮询 `locator.innerText()`。`vi.waitFor` 是 0.34.6 就有的 API，等价于新版的 `expect.poll`。
- `test.step(...)` → 没有等价 API（0.34.6 未提供）。九步测试改为九个顶层 `it`，一次性的准备放进 `beforeAll`，失败点因此就是失败的那一项，而不是一串无关报错。
- `playwright.config.ts` 的 `launchOptions.args` → `test/web/browser.ts` 的 `launchGameBrowser()`。
- `@playwright/test` 的 `devices[...]` 与 projects → 由 `--mode` 选腿：`vitest run`（默认 mode `test`）跑离线腿，`vitest run --mode live` 跑在线腿。两条腿共用同一个 spec，mode 只切换游戏源。
- 失败时把 CLI 日志写文件（`testInfo.attach`）→ `onTestFailed` 里打印日志尾部，控制台就是证据。

## 运行

```bash
rushx setup         # 装 Chromium + 下载固定构建（首次）
rushx test:e2e      # 默认：离线腿（固定构建）
rushx test:e2e:live # opt-in：在线腿（官方在线站）
rushx test:e2e:watch # vitest watch 模式
rushx typecheck     # tsc --noEmit
```

前置：先在 `packages/viteburner` 里 `rushx build`（本包跑的是它的 `dist/`）；在 Rush 仓库里 `rush build` 会按依赖图先构建它。

`E2E_GAME_DIR=/path/to/build` 可改为 serve 一个现成构建而不下载；`E2E_KEEP=1` 保留 `test/.tmp/project/` 供人工检查。

## 目录与忽略

固定构建与临时项目缓存于 `test/.cache/`、`test/.tmp/`（均 gitignore），基线在 `test/fixture/dist/`（提交进仓库）。包根的 `src/` 是只读的 fixture 工程，测试运行时被整份复制到 `test/.tmp/project/`，CLI 的 watch 与 `dumpFiles` 都只写副本——`src/` 里没有任何一处会被运行改写。`packages/viteburner` 里原来的 `e2e/` 与 `playwright.config.ts` 已删除。

fixture 的 `src/**` 因此不在本包 tsc 的扫描范围内（`tsconfig.json` 只 include `test/**` 与 fixture 的 `vite.config.ts`）：这些源码 import `@ns`，只有 CLI 把游戏类型定义下载到工程里之后才解析得了，其正确性由 E2E 运行判定。
