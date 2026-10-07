// The second half of the merge suite: fields the vite config does not touch. None of them overlap
// with `vite.config.js`'s, so the resolution order between the two files never enters the picture.
export default {
  timeout: 34567,
  dts: 'types/defs.d.ts',
  ignoreInitial: true,
  download: {
    server: 'n00dles',
    ignoreTs: false,
    ignoreSourcemap: false,
  },
};
