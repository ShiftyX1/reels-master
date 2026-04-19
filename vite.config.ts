import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';
import AdmZip from 'adm-zip';

const browser = process.env.BROWSER || 'chrome';

const buildEntry = process.env.BUILD_ENTRY; // 'background' | 'content' | undefined (both)

const inputs =
  buildEntry === 'background'
    ? { background: resolve(__dirname, 'src/background/service-worker.ts') }
    : buildEntry === 'content'
    ? { content: resolve(__dirname, 'src/content/content.ts') }
    : {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
      };

const shouldEmptyOutDir = buildEntry !== 'content';
const isFinalPass = buildEntry !== 'background';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: shouldEmptyOutDir,
    rollupOptions: {
      input: inputs,
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
        if (!isFinalPass) return;
        try {
          copyFileSync(
            resolve(__dirname, `src/manifest.${browser}.json`),
            resolve(__dirname, 'dist/manifest.json')
          );
          console.log(`✓ Copied manifest.${browser}.json`);
        } catch (err) {
          console.error('Error copying manifest.json:', err);
        }
      }
    },
    {
      name: 'create-zip',
      closeBundle() {
        if (!isFinalPass) return;
        if (process.env.NODE_ENV === 'production' || !process.argv.includes('--watch')) {
          try {
            const zip = new AdmZip();
            const distPath = resolve(__dirname, 'dist');
            
            if (existsSync(distPath)) {
              zip.addLocalFolder(distPath);
              zip.writeZip(resolve(__dirname, `reels-master-${browser}.zip`));
              console.log(`Created reels-master-${browser}.zip`);
            }
          } catch (err) {
            console.error('Error creating zip:', err);
          }
        }
      }
    }
  ]
});