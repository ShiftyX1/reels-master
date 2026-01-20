import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';
import AdmZip from 'adm-zip';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
      },
      output: {
        entryFileNames: '[name]/[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        try {
          copyFileSync(
            resolve(__dirname, 'src/manifest.json'),
            resolve(__dirname, 'dist/manifest.json')
          );
          console.log('✓ Copied manifest.json');
        } catch (err) {
          console.error('Error copying manifest.json:', err);
        }
      }
    },
    {
      name: 'create-zip',
      closeBundle() {
        if (process.env.NODE_ENV === 'production' || !process.argv.includes('--watch')) {
          try {
            const zip = new AdmZip();
            const distPath = resolve(__dirname, 'dist');
            
            if (existsSync(distPath)) {
              zip.addLocalFolder(distPath);
              zip.writeZip(resolve(__dirname, 'reels-master.zip'));
              console.log('Created reels-master.zip');
            }
          } catch (err) {
            console.error('Error creating zip:', err);
          }
        }
      }
    }
  ]
});