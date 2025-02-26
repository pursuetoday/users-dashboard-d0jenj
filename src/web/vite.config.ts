import { defineConfig } from 'vite'; // v^4.0.0
import react from '@vitejs/plugin-react'; // v^4.0.0
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for quick component updates without losing state
      fastRefresh: true,
      // Use the new JSX transform from React 17+
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    alias: {
      // Enable @ imports for cleaner path references
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Development server configuration
    port: 3000,
    host: true, // Listen on all addresses
    cors: true, // Enable CORS for development
    proxy: {
      // Proxy API requests to backend server
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Build configuration for production
    target: 'es2022', // Modern browsers target
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true, // Generate source maps for debugging
    minify: 'terser', // Use Terser for better minification
    rollupOptions: {
      output: {
        // Manual chunks for code splitting optimization
        manualChunks: {
          // Core React libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // UI component libraries
          ui: ['@headlessui/react', '@heroicons/react'],
        },
      },
    },
  },
});