export const virtualModuleId = 'virtual:viteburner-entry';

export function entryPlugin() {
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'viteburner:entry',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        return `export {}`;
      }
    },
  };
}

export default entryPlugin;
