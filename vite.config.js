import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    build: {
        target: 'esnext',
        // sourcemap: 'inline',
        minify: false,
        // rollupOptions: {
        //     treeshake: false,
        //     preserveEntrySignatures: true,
        //     output: {
        //         interop: 'auto',
        //         preserveModules: true,
        //     },
        // },
    },
});