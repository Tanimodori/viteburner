import * as __vite_glob_0_0 from "/importGlob/modules/bar.js";import * as __vite_glob_0_1 from "/importGlob/modules/foo.js";const modules = /* #__PURE__ */ Object.assign({"./modules/bar.ts": __vite_glob_0_0,"./modules/foo.ts": __vite_glob_0_1});
export async function main(ns) {
  for (const module of Object.values(modules)) {
    await module.default(ns);
  }
}
//# sourceMappingURL=<inline sourcemap>