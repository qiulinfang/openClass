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
  <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=4,user-scalable=yes,viewport-fit=cover">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; margin: 0; background: #eceef5; touch-action: pan-x pan-y pinch-zoom; }
    body { overflow: auto; overscroll-behavior: contain; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #pages { width: 100%; min-height: 100vh; padding: var(--reader-top-inset, 16px) 0 var(--reader-bottom-inset, 24px); }
    .pdf-page { position: relative; contain: layout paint style; margin: 0 auto 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 12px rgba(23, 27, 52, .12); }
    .pdf-canvas, .annotation-canvas, .annotation-text-layer, .selection-layer { position: absolute; inset: 0; display: block; }
    .pdf-canvas { z-index: 1; }
    .annotation-canvas { z-index: 2; pointer-events: none; }
    .annotation-text-layer { z-index: 3; overflow: hidden; pointer-events: none; }
    .selection-layer { z-index: 4; pointer-events: none; }
    body.explore-mode .selection-layer,
    body.annotation-active .selection-layer { pointer-events: auto; touch-action: none; }
    body.explore-mode .selection-layer { cursor: crosshair; }
    body[data-annotation-tool="pen"] .selection-layer,
    body[data-annotation-tool="highlighter"] .selection-layer { cursor: crosshair; }
    body[data-annotation-tool="eraser"] .selection-layer { cursor: cell; }
    body[data-annotation-tool="text"] .selection-layer { cursor: text; }
    .selection-box { position: absolute; display: none; border: 2px solid #6256d9; background: rgba(98, 86, 217, .13); box-shadow: 0 0 0 9999px rgba(32, 36, 61, .10); }
    .text-annotation { position: absolute; overflow: visible; border: 1px solid rgba(98, 86, 217, .2); border-radius: 5px; background: transparent; box-shadow: 0 1px 3px rgba(23, 27, 52, .09); font-weight: 600; line-height: 1.35; pointer-events: none; touch-action: none; -webkit-user-select: none; user-select: none; }
    .text-annotation.has-background { background: rgba(255, 255, 255, .84); }
    .text-annotation:not(.has-background):not(.is-selected) { border-color: transparent; box-shadow: none; }
    body[data-annotation-tool="hand"]:not(.explore-mode) .text-annotation { pointer-events: auto; cursor: grab; }
    body[data-annotation-tool="hand"]:not(.explore-mode) .text-annotation:active { cursor: grabbing; }
    .text-annotation-content { width: 100%; height: 100%; padding: 3px 5px; overflow: hidden; overflow-wrap: anywhere; white-space: pre-wrap; border-radius: inherit; pointer-events: none; }
    .text-annotation.is-selected { z-index: 2; border: 2px solid #6256d9; box-shadow: 0 3px 10px rgba(48, 38, 116, .18); }
    .text-annotation.is-selected.has-background { background: rgba(255, 255, 255, .96); }
    .text-annotation.is-selected:not(.has-background) { border-color: transparent; box-shadow: none; }
    .text-drag-ghost { z-index: 1000 !important; margin: 0; pointer-events: none !important; opacity: .92; box-shadow: 0 8px 22px rgba(48, 38, 116, .24); }
    .text-drag-ghost .text-control { display: none !important; }
    .text-control { position: absolute; z-index: 3; display: none; width: 44px; height: 44px; margin: 0; padding: 0; border: 0; outline: 0; background: transparent; touch-action: none; -webkit-tap-highlight-color: transparent; }
    .text-annotation.is-selected .text-control,
    .text-editor-shell .text-control { display: grid; place-items: center; }
    .text-resize-top-left { top: -23px; left: -23px; cursor: nwse-resize; }
    .text-resize-bottom-right { right: -23px; bottom: -23px; cursor: nwse-resize; }
    .text-resize-handle::after { content: ""; width: 18px; height: 18px; border: 3px solid #fff; border-radius: 50%; background: #6256d9; box-shadow: 0 1px 5px rgba(48, 38, 116, .32); }
    .text-move { left: -23px; bottom: -23px; cursor: move; }
    .text-move::before { content: ""; position: absolute; inset: 8px; border: 3px solid #fff; border-radius: 50%; background: #6256d9; box-shadow: 0 1px 5px rgba(48, 38, 116, .32); }
    .text-move svg { position: relative; z-index: 1; width: 18px; height: 18px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .text-delete { top: -23px; right: -23px; color: #fff; font: 700 20px/1 -apple-system, BlinkMacSystemFont, sans-serif; cursor: pointer; }
    .text-delete::before { content: ""; position: absolute; inset: 9px; z-index: -1; border: 3px solid #fff; border-radius: 50%; background: #e34850; box-shadow: 0 1px 5px rgba(115, 31, 38, .28); }
    .text-editor-shell { position: absolute; z-index: 5; min-width: 96px; min-height: 52px; max-width: 90%; max-height: 90%; border: 2px solid #6256d9; border-radius: 8px; background: transparent; box-shadow: 0 5px 18px rgba(44, 35, 105, .2); pointer-events: auto; touch-action: none; }
    .text-editor-shell.has-background { background: rgba(255, 255, 255, .97); }
    .text-editor { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 9px 10px; resize: none; outline: none; border: 0; border-radius: inherit; background: transparent; font: 600 16px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; pointer-events: auto; }
    .text-editor::placeholder { color: #989db2; }
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
