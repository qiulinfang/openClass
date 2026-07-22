import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const workerSource = atob('__PDF_WORKER_BASE64__');
const workerBytes = new Uint8Array(workerSource.length);
for (let index = 0; index < workerSource.length; index += 1) {
  workerBytes[index] = workerSource.charCodeAt(index);
}
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([workerBytes], { type: 'text/javascript' })
);

const pagesRoot = document.getElementById('pages');
const emptyState = document.getElementById('empty');
const pageElements = new Map();
let pdfDocument = null;
let expectedChunks = 0;
let expectedBytes = 0;
let incomingPdf = null;
let receivedChunks = [];
let exploreMode = false;
let renderedViewportWidth = 0;
let pageObserver = null;
let renderGeneration = 0;
let documentReadyPosted = false;
let renderQueueRunning = false;
const pendingPageRenders = new Set();

const post = (type, payload = {}) => {
  const message = JSON.stringify({ type, ...payload });
  window.ReactNativeWebView?.postMessage(message);
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
};

const decodeBase64 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let offset = 0; offset < binary.length; offset += 1) {
    bytes[offset] = binary.charCodeAt(offset);
  }
  return bytes;
};

const getTargetWidth = () =>
  Math.round(Math.max(240, Math.min(920, document.documentElement.clientWidth - 16)));

const pointForEvent = (event, layer) => {
  const rect = layer.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
};

const paintSelection = (selectionBox, start, end) => {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  selectionBox.style.display = 'block';
  selectionBox.style.left = `${left * 100}%`;
  selectionBox.style.top = `${top * 100}%`;
  selectionBox.style.width = `${Math.abs(end.x - start.x) * 100}%`;
  selectionBox.style.height = `${Math.abs(end.y - start.y) * 100}%`;
};

const captureSelection = (pageIndex, start, end) => {
  const page = pageElements.get(pageIndex);
  if (!page?.rendered) return;
  const { canvas, cssWidth, cssHeight, pixelRatio } = page;
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width * cssWidth < 28 || height * cssHeight < 28) {
    post('exploreCaptureError', { message: '框选区域过小，请重新框选' });
    return;
  }

  const sourceX = Math.round(left * canvas.width);
  const sourceY = Math.round(top * canvas.height);
  const sourceWidth = Math.max(1, Math.round(width * canvas.width));
  const sourceHeight = Math.max(1, Math.round(height * canvas.height));
  const output = document.createElement('canvas');
  output.width = sourceWidth;
  output.height = sourceHeight;
  const context = output.getContext('2d');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, sourceWidth, sourceHeight);
  context.drawImage(
    canvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );
  post('exploreCapture', {
    dataUrl: output.toDataURL('image/jpeg', 0.88),
    pageNumber: pageIndex + 1,
    width: Math.round(sourceWidth / pixelRatio),
    height: Math.round(sourceHeight / pixelRatio),
  });
};

const bindSelection = (pageIndex, layer, selectionBox) => {
  let selection = null;

  layer.addEventListener('pointerdown', (event) => {
    if (!exploreMode || event.button > 0) return;
    event.preventDefault();
    layer.setPointerCapture(event.pointerId);
    const point = pointForEvent(event, layer);
    selection = { pointerId: event.pointerId, start: point, end: point };
    paintSelection(selectionBox, point, point);
  });

  layer.addEventListener('pointermove', (event) => {
    if (!selection || selection.pointerId !== event.pointerId) return;
    event.preventDefault();
    selection.end = pointForEvent(event, layer);
    paintSelection(selectionBox, selection.start, selection.end);
  });

  const finish = (event) => {
    if (!selection || selection.pointerId !== event.pointerId) return;
    if (layer.hasPointerCapture(event.pointerId)) {
      layer.releasePointerCapture(event.pointerId);
    }
    const completed = selection;
    selection = null;
    selectionBox.style.display = 'none';
    if (event.type !== 'pointercancel') {
      captureSelection(pageIndex, completed.start, completed.end);
    }
  };

  layer.addEventListener('pointerup', finish);
  layer.addEventListener('pointercancel', finish);
};

const createPageElement = (pageIndex) => {
  const wrapper = document.createElement('section');
  wrapper.className = 'pdf-page';
  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-canvas';
  const selectionLayer = document.createElement('div');
  selectionLayer.className = 'selection-layer';
  const selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  selectionLayer.append(selectionBox);
  wrapper.append(canvas, selectionLayer);
  bindSelection(pageIndex, selectionLayer, selectionBox);
  return { wrapper, canvas, selectionLayer, selectionBox, rendered: false };
};

const renderPage = async (pageIndex, generation) => {
  const page = pageElements.get(pageIndex);
  if (!pdfDocument || !page || page.rendered || page.rendering) return;
  page.rendering = true;
  let pdfPage = null;
  let renderCanvas = null;
  try {
    pdfPage = await pdfDocument.getPage(pageIndex + 1);
    if (generation !== renderGeneration) return;
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const viewport = pdfPage.getViewport({
      scale: renderedViewportWidth / baseViewport.width,
    });
    const cssWidth = Math.round(viewport.width);
    const cssHeight = Math.round(viewport.height);
    page.wrapper.style.width = `${cssWidth}px`;
    page.wrapper.style.height = `${cssHeight}px`;
    renderCanvas = document.createElement('canvas');
    renderCanvas.width = Math.round(cssWidth * page.pixelRatio);
    renderCanvas.height = Math.round(cssHeight * page.pixelRatio);
    const renderTask = pdfPage.render({
      canvasContext: renderCanvas.getContext('2d'),
      viewport,
      transform: [page.pixelRatio, 0, 0, page.pixelRatio, 0, 0],
    });
    page.renderTask = renderTask;
    await renderTask.promise;
    if (generation !== renderGeneration) return;
    page.canvas.style.width = `${cssWidth}px`;
    page.canvas.style.height = `${cssHeight}px`;
    page.canvas.width = renderCanvas.width;
    page.canvas.height = renderCanvas.height;
    page.canvas.getContext('2d').drawImage(renderCanvas, 0, 0);
    renderCanvas.width = 1;
    renderCanvas.height = 1;
    page.cssWidth = cssWidth;
    page.cssHeight = cssHeight;
    page.rendered = true;
    page.rendering = false;
    page.renderTask = null;
    page.wrapper.classList.add('is-rendered');
    if (!documentReadyPosted && pageIndex === 0) {
      documentReadyPosted = true;
      emptyState.hidden = true;
      post('documentLoaded', { totalPages: pdfDocument.numPages });
    }
  } catch (error) {
    page.rendering = false;
    page.renderTask = null;
    if (error?.name === 'RenderingCancelledException') return;
    if (pageIndex === 0) {
      emptyState.hidden = false;
      emptyState.textContent = 'PDF 文件无法打开';
      post('documentError', {
        message: error instanceof Error ? error.message : 'PDF 首页无法渲染',
      });
    }
  } finally {
    pdfPage?.cleanup();
    if (renderCanvas) {
      renderCanvas.width = 1;
      renderCanvas.height = 1;
    }
  }
};

const releasePage = (pageIndex) => {
  const page = pageElements.get(pageIndex);
  if (!page || (!page.rendered && !page.rendering)) return;
  page.renderTask?.cancel();
  page.renderTask = null;
  page.rendered = false;
  page.rendering = false;
  page.wrapper.classList.remove('is-rendered');
  page.canvas.width = 1;
  page.canvas.height = 1;
};

const queuePageRender = (pageIndex) => {
  pendingPageRenders.add(pageIndex);
  if (renderQueueRunning) return;
  renderQueueRunning = true;
  void (async () => {
    while (pendingPageRenders.size > 0) {
      const activeGeneration = renderGeneration;
      const viewportCenter = window.innerHeight / 2;
      const nextPageIndex = [...pendingPageRenders].sort((left, right) => {
        const leftRect = pageElements.get(left)?.wrapper.getBoundingClientRect();
        const rightRect = pageElements.get(right)?.wrapper.getBoundingClientRect();
        const leftDistance = leftRect
          ? Math.abs((leftRect.top + leftRect.bottom) / 2 - viewportCenter)
          : Number.POSITIVE_INFINITY;
        const rightDistance = rightRect
          ? Math.abs((rightRect.top + rightRect.bottom) / 2 - viewportCenter)
          : Number.POSITIVE_INFINITY;
        return leftDistance - rightDistance;
      })[0];
      pendingPageRenders.delete(nextPageIndex);
      await renderPage(nextPageIndex, activeGeneration);
    }
    renderQueueRunning = false;
    if (pendingPageRenders.size > 0) {
      queuePageRender([...pendingPageRenders][0]);
    }
  })();
};

const renderDocument = async () => {
  if (!pdfDocument) return;
  const generation = ++renderGeneration;
  pendingPageRenders.clear();
  renderedViewportWidth = getTargetWidth();
  pageObserver?.disconnect();
  pagesRoot.replaceChildren();
  pageElements.clear();
  const pixelRatio = Math.max(
    1,
    Math.min(window.devicePixelRatio || 1, 2, 4096 / renderedViewportWidth)
  );
  const firstPdfPage = await pdfDocument.getPage(1);
  const firstBaseViewport = firstPdfPage.getViewport({ scale: 1 });
  const placeholderHeight = Math.round(
    firstBaseViewport.height * (renderedViewportWidth / firstBaseViewport.width)
  );
  firstPdfPage.cleanup();

  for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
    const page = createPageElement(pageIndex);
    page.wrapper.style.width = `${renderedViewportWidth}px`;
    page.wrapper.style.height = `${placeholderHeight}px`;
    pagesRoot.append(page.wrapper);
    pageElements.set(pageIndex, {
      ...page,
      cssWidth: renderedViewportWidth,
      cssHeight: placeholderHeight,
      pixelRatio,
      rendering: false,
    });
  }

  await renderPage(0, generation);

  pageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const pageIndex = Number(entry.target.dataset.pageIndex);
        if (entry.isIntersecting) {
          queuePageRender(pageIndex);
        } else {
          pendingPageRenders.delete(pageIndex);
          releasePage(pageIndex);
        }
      });
    },
    { rootMargin: '1000px 0px' }
  );
  pageElements.forEach((page, pageIndex) => {
    page.wrapper.dataset.pageIndex = String(pageIndex);
    pageObserver.observe(page.wrapper);
  });
};

const loadPdfBytes = async (bytes) => {
  try {
    emptyState.hidden = false;
    emptyState.textContent = '正在渲染 PDF…';
    documentReadyPosted = false;
    pageObserver?.disconnect();
    if (pdfDocument) await pdfDocument.destroy();
    pdfDocument = await pdfjsLib.getDocument({ data: bytes }).promise;
    await renderDocument();
  } catch (error) {
    emptyState.textContent = 'PDF 文件无法打开';
    post('documentError', {
      message: error instanceof Error ? error.message : 'PDF 文件无法解析',
    });
  }
};

const handleMessage = (rawMessage) => {
  let message = rawMessage;
  try {
    if (typeof rawMessage === 'string') message = JSON.parse(rawMessage);
  } catch {
    return;
  }
  if (!message || typeof message !== 'object') return;

  if (message.type === 'host-ready') {
    post('ready');
  } else if (message.type === 'pdf-start') {
    expectedChunks = Number(message.totalChunks) || 0;
    expectedBytes = Number(message.totalBytes) || 0;
    incomingPdf = expectedBytes > 0 ? new Uint8Array(expectedBytes) : null;
    receivedChunks = new Array(expectedChunks).fill(false);
  } else if (message.type === 'pdf-chunk') {
    const index = Number(message.index);
    const offset = Number(message.offset);
    if (
      !incomingPdf ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= expectedChunks ||
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      post('documentError', { message: 'PDF 数据块无效，请重试' });
      return;
    }
    const chunk = decodeBase64(message.data);
    if (offset + chunk.length > incomingPdf.length) {
      post('documentError', { message: 'PDF 数据超出预期大小，请重试' });
      return;
    }
    incomingPdf.set(chunk, offset);
    receivedChunks[index] = true;
    post('pdf-chunk-ack', { index });
  } else if (message.type === 'pdf-end') {
    if (!incomingPdf || receivedChunks.filter(Boolean).length !== expectedChunks) {
      post('documentError', { message: 'PDF 数据传输不完整，请重试' });
      return;
    }
    const bytes = incomingPdf;
    incomingPdf = null;
    receivedChunks = [];
    void loadPdfBytes(bytes);
  } else if (message.type === 'exploreMode') {
    exploreMode = message.enabled === true;
    document.body.classList.toggle('explore-mode', exploreMode);
    pageElements.forEach(({ selectionBox }) => {
      selectionBox.style.display = 'none';
    });
  } else if (message.type === 'readerInsets') {
    const top = Math.max(0, Number(message.top) || 0);
    const bottom = Math.max(0, Number(message.bottom) || 0);
    document.documentElement.style.setProperty('--reader-top-inset', `${top}px`);
    document.documentElement.style.setProperty('--reader-bottom-inset', `${bottom}px`);
  }
};

window.addEventListener('message', (event) => handleMessage(event.data));
document.addEventListener('message', (event) => handleMessage(event.data));

document.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) event.preventDefault();
  },
  { passive: false }
);

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!pdfDocument) return;
    const nextWidth = getTargetWidth();
    if (Math.abs(nextWidth - renderedViewportWidth) <= 1) return;
    void renderDocument();
  }, 180);
});

post('ready');
