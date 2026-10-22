# viteburner-template

A [viteburner](https://github.com/Tanimodori/viteburner) project template: write TypeScript, and let viteburner transform and sync your scripts to Bitburner.

Requires Node.js `>=20.19.0`.

## Getting started

If this project was created for you, install the dependencies and start viteburner:

```bash
npm install
npm run dev
```

To create a new project, use the scaffolder instead:

```bash
npm create viteburner@latest
cd viteburner-project
npm install
npm run dev
```

You can also clone the template repository directly:

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

Upgrade viteburner with your package manager:

```bash
npm i -D viteburner@latest
```

If you cloned the template repository, you can also merge the upstream template:

```bash
git remote add upstream https://github.com/Tanimodori/viteburner-template.git
git fetch upstream
git merge upstream/main
npm install
```

## License

[MIT](./LICENSE) © 2022-present Tanimodori
