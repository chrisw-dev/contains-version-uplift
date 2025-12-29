import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import { defineConfig } from 'rollup';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    sourcemap: false,
    inlineDynamicImports: true,
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        module: 'esnext',
        moduleResolution: 'bundler',
        declaration: false,
        declarationMap: false,
        sourceMap: false,
      },
      outDir: './dist',
    }),
    resolve({
      preferBuiltins: true,
    }),
    commonjs(),
    json(),
  ],
});
