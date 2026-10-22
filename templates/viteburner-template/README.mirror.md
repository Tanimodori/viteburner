# viteburner-template

A [viteburner](https://github.com/Tanimodori/viteburner) project template: write TypeScript, and let viteburner transform and sync your scripts to Bitburner.

> This repository is generated from [`Tanimodori/viteburner`](https://github.com/Tanimodori/viteburner). Do not edit it directly: change `templates/viteburner-template/` there and run the template export.

Requires Node.js `^20.19.0 || >=22.12.0`.

## Create a project

```bash
npm create viteburner@latest
cd viteburner-project
npm install
npm run dev
```

If you are testing a pre-release, use the matching tag, for example `npm create viteburner@next`; `@latest` stays on the last stable release.

Or clone this repository:

```bash
git clone https://github.com/Tanimodori/viteburner-template.git
cd viteburner-template
npm install
npm run dev
```

In Bitburner, open **Options > Remote API**, enter the port viteburner prints (default `12525`), and click **Connect**.

## Scripts

- `npm run dev` starts viteburner.
- `npm run typecheck` type-checks the project. The first `npm run dev` downloads `NetscriptDefinitions.d.ts` from the game; run it once before type-checking.

## Updating

```bash
npm i -D viteburner@latest
```

During a pre-release, install the matching tag explicitly, for example `npm i -D viteburner@next`.

If you cloned this repository, you can also merge the upstream template:

```bash
git remote add upstream https://github.com/Tanimodori/viteburner-template.git
git fetch upstream
git merge upstream/main
npm install
```

## License

[MIT](./LICENSE) © 2022-present Tanimodori
