import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';
import reactRefresh from '@vitejs/plugin-react-refresh';
import reactJsx from 'vite-react-jsx';

export default defineConfig({
  // server: { port: 3000 },
  plugins: [
    reactJsx(),
    reactRefresh(),
    ...VitePluginNode({
      server: 'express',
      appPath: './server.ts',
      port: 3000,
      tsCompiler: 'esbuild',
      // createCustomServer: () => 
    })
  ],
});
