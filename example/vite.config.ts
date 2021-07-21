import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';
import reactRefresh from '@vitejs/plugin-react-refresh';
import reactJsx from 'vite-react-jsx';

export default async (args: {command: 'serve' | 'build' | string, mode: 'development' | string} & {[K in string]: unknown}) => {
  console.log(args);
  return defineConfig({
    // server: { port: 3000 },
    plugins: [
      reactJsx(),
      reactRefresh(),
      !process.argv0.includes('vite-node') ? [] : VitePluginNode({
        server: 'express',
        appPath: './server.ts',
        port: 3000,
        tsCompiler: 'esbuild',
        // createCustomServer: () => 
      })
    ],
    build: {
      manifest: true,
      rollupOptions: {
        input: './server.ts',
      },
    },
  });
};