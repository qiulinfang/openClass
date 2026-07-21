import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerPath = resolve(
  root,
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'
);
const outputPath = resolve(root, 'src/generated/pdf-explore-viewer-html.ts');

const [{ text: bundledScript }] = (
  await build({
    entryPoints: [resolve(root, 'scripts/pdf-explore-viewer-entry.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['safari15', 'chrome100'],
    minify: true,
    write: false,
  })
).outputFiles;

const workerBase64 = (await readFile(workerPath)).toString('base64');
const script = bundledScript
  .replace('__PDF_WORKER_BASE64__', workerBase64)
  .replaceAll('</script', '<\\/script');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; margin: 0; background: #eceef5; touch-action: pan-x pan-y; }
    body { overflow: auto; overscroll-behavior: contain; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #pages { width: 100%; min-height: 100vh; padding: var(--reader-top-inset, 16px) 0 var(--reader-bottom-inset, 24px); }
    .pdf-page { position: relative; margin: 0 auto 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 12px rgba(23, 27, 52, .12); }
    .pdf-canvas, .selection-layer { position: absolute; inset: 0; display: block; }
    .selection-layer { z-index: 2; pointer-events: none; }
    body.explore-mode .selection-layer { pointer-events: auto; cursor: crosshair; touch-action: none; }
    .selection-box { position: absolute; display: none; border: 2px solid #6256d9; background: rgba(98, 86, 217, .13); box-shadow: 0 0 0 9999px rgba(32, 36, 61, .10); }
    #empty { position: fixed; inset: 0; display: grid; place-items: center; color: #626881; font-size: 14px; }
    #empty[hidden] { display: none; }
  </style>
</head>
<body>
  <main id="pages"></main>
  <div id="empty">正在准备 PDF 阅读器…</div>
  <script>${script}</script>
</body>
</html>`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `// 此文件由 npm run build:pdf-explore-viewer 自动生成，请勿手动修改。\nexport default ${JSON.stringify(html)};\n`
);
console.log(`Generated ${outputPath}`);
