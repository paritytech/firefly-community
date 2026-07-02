import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'dotns/index': 'src/dotns/index.ts',
    'dotns/host': 'src/dotns/host.ts',
    'dotns/types': 'src/dotns/types.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
});
