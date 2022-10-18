export const virtualModuleId = 'virtual:bitburner-vite-entry';

export function entryPlugin() {
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'bitburner-vite:entry',
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
