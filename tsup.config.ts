import { type Options, defineConfig } from 'tsup'

export default defineConfig((options) => {
  const commonOptions: Partial<Options> = {
    entry: ['src/index.ts'],
    sourcemap: true,
    treeshake: 'smallest',
    minifySyntax: true,
    dts: true,
    ...options,
  }

  return [
    {
      ...commonOptions,
      format: ['esm'],
      outExtension: () => ({ js: '.mjs' }),
      clean: true,
    },
    {
      ...commonOptions,
      format: ['cjs'],
      outDir: './dist/cjs/',
      cjsInterop: true,
      outExtension: () => ({ js: '.cjs' }),
    },
  ]
})
