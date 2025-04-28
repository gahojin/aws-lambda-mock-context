import path from 'node:path'
import { defineConfig } from 'rolldown'
import IsolatedDecl from 'unplugin-isolated-decl/rolldown'

export default defineConfig([
  {
    external: ['node:crypto', 'aws-lambda'],
    treeshake: true,
    input: 'src/index.ts',
    resolve: {
      alias: {
        '@': path.resolve('src'),
      },
    },
    output: [
      { format: 'esm', entryFileNames: '[name].mjs', sourcemap: true },
      { format: 'cjs', entryFileNames: '[name].cjs', sourcemap: true, exports: 'named' },
    ],
    plugins: [IsolatedDecl()],
  },
])
