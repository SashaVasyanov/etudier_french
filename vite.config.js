import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    clearScreen: false,
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
                        return 'react-vendor';
                    }
                    if (id.includes('/src/lib/exercises.ts')) {
                        return 'lesson-engine';
                    }
                    if (id.includes('/src/lib/wordImages.ts')) {
                        return 'illustrations';
                    }
                    if (id.includes('/src/data/japaneseExamples.ts')) {
                        return 'japanese-examples';
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        host: '127.0.0.1',
        port: 1420,
        strictPort: true,
    },
});
