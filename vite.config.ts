import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const extensions = [
  '.web.tsx', '.web.ts', '.web.jsx', '.web.js',
  '.tsx', '.ts', '.jsx', '.js',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions,
    alias: {
      'react-native': 'react-native-web',
      'react-native/Libraries/Utilities/Platform': path.resolve(__dirname, 'node_modules/react-native-web/dist/exports/Platform/index.js'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/utils/asyncStorageWeb.ts'),
    },
  },
  define: {
    global: 'window',
    __DEV__: JSON.stringify(true),
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-native-web',
      'react-native-safe-area-context',
      '@react-navigation/native',
      '@react-navigation/native-stack',
      '@react-navigation/bottom-tabs',
      'zustand',
    ],
    esbuildOptions: {
      resolveExtensions: extensions,
      jsx: 'automatic',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-native-web'],
          navigation: [
            '@react-navigation/native',
            '@react-navigation/native-stack',
            '@react-navigation/bottom-tabs',
          ],
        },
      },
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 8082,
    host: 'localhost',
  },
});
