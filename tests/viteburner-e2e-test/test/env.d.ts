/**
 * The mode (`--mode live`, default `test`) reaches the specs through `import.meta.env.MODE`, which Vite
 * injects. Declaring it here keeps the specs off `vite/client` — a dependency this package does not carry —
 * while still naming the one field they read.
 */
interface ImportMetaEnv {
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
