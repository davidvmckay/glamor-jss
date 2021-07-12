import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import reactJsx from 'vite-react-jsx';

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    reactJsx(),
    reactRefresh(),
  ],
});
