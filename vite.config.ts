/**
 * Vite Configuration
 * 
 * Configures the build tool for the Oceans Institute Research Database frontend.
 * 
 * Key Features:
 * - React with SWC for fast builds and hot module replacement
 * - Path aliases for cleaner imports (@/ → src/)
 * - Optimized production builds with code splitting
 * - Development server with API proxy to Flask backend
 * 
 * @see https://vitejs.dev/config/
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  /**
   * Vite Plugins
   * 
   * @vitejs/plugin-react-swc - React plugin using SWC for faster builds
   * SWC (Speedy Web Compiler) is 20x faster than Babel
   */
  plugins: [react()],

  /**
   * Module Resolution
   * 
   * Configures how modules are resolved and imported
   */
  resolve: {
    /**
     * Path aliases for cleaner imports
     * 
     * @example
     * // Instead of: import { api } from '../../../../data/api'
     * // You can use: import { api } from '@/data/api'
     */
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  /**
   * Production Build Configuration
   * 
   * Optimizes the output for production deployment
   */
  build: {
    /**
     * Target modern browsers (ES2020+)
     * Allows use of modern JS features without transpilation overhead
     */
    target: 'esnext',

    /**
     * Output directory for built files
     * Default is 'dist', but changed to 'build' for consistency
     */
    outDir: 'build',

    /**
     * Use esbuild for minification (faster than terser)
     * Reduces bundle size by removing whitespace, comments, and shortening names
     */
    minify: 'esbuild',

    /**
     * Disable source maps in production
     * Reduces bundle size and prevents source code exposure
     * Set to true during development if needed for debugging
     */
    sourcemap: false,

    /**
     * Rollup-specific options for advanced bundling control
     */
    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting for optimal caching
         * 
         * Benefits:
         * - Vendor code changes rarely, so it can be cached long-term
         * - App code changes frequently, so it's in separate chunks
         * - Users only re-download changed chunks on updates
         * 
         * Chunks created:
         * - react-vendor: React core libraries (~140KB)
         * - ui-vendor: Radix UI components (~100KB)
         * - Other chunks: Created automatically by Vite
         */
        manualChunks: {
          /**
           * React and ReactDOM bundle
           * These rarely change, so aggressive caching is beneficial
           */
          'react-vendor': ['react', 'react-dom'],

          /**
           * UI library components bundle
           * Groups all Radix UI components together
           */
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
          ],
        },
      },
    },

    /**
     * Increase chunk size warning limit to 1000 KB
     * Default is 500 KB, but our vendor chunks are intentionally larger
     * This prevents unnecessary warnings during build
     */
    chunkSizeWarningLimit: 1000,
  },

  /**
   * Development Server Configuration
   * 
   * Settings for the local development server
   */
  server: {
    /**
     * Port number for the dev server
     * Frontend will be available at http://localhost:3000
     */
    port: 3000,

    /**
     * Automatically open browser when server starts
     * Useful for development workflow
     */
    open: true,

    /**
     * API Proxy Configuration
     * 
     * Forwards /api/* requests to the Flask backend
     * This avoids CORS issues during development
     * 
     * How it works:
     * - Frontend makes request to: http://localhost:3000/api/researchers
     * - Vite proxies it to: http://127.0.0.1:5000/api/researchers
     * - Flask backend processes and returns response
     * - Vite forwards response back to frontend
     */
    proxy: {
      '/api': {
        /** Flask backend URL */
        target: 'http://127.0.0.1:5000',

        /** Needed for proxying to different origins */
        changeOrigin: true,

        /** Accept self-signed SSL certificates (if backend uses HTTPS) */
        secure: false,
      },
    },
  },
});