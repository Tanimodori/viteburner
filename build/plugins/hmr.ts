export default function hmrPlugin() {
  return {
    name: 'bitburner-vite:hmr',
    handleHotUpdate(...args) {
      console.log(args);
      return;
    },
  };
}
