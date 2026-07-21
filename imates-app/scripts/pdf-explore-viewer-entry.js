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
let incomingPdf = [];
let exploreMode = false;
let renderedViewportWidth = 0;
let pageObserver = null;
let renderGeneration = 0;
let documentReadyPosted = false;
let zoomScale = 1;
let pinchState = null;
let suppressSelectionUntil = 0;

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
  Math.round(
    Math.max(240, Math.min(920, document.documentElement.clientWidth - 16)) *
      zoomScale
  );

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
    if (
      event.type !== 'pointercancel' &&
      Date.now() >= suppressSelectionUntil
    ) {
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
  try {
    const pdfPage = await pdfDocument.getPage(pageIndex + 1);
    if (generation !== renderGeneration) return;
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const viewport = pdfPage.getViewport({
      scale: renderedViewportWidth / baseViewport.width,
    });
    const cssWidth = Math.round(viewport.width);
    const cssHeight = Math.round(viewport.height);
    page.wrapper.style.width = `${cssWidth}px`;
    page.wrapper.style.height = `${cssHeight}px`;
    page.canvas.style.width = `${cssWidth}px`;
    page.canvas.style.height = `${cssHeight}px`;
    page.canvas.width = Math.round(cssWidth * page.pixelRatio);
    page.canvas.height = Math.round(cssHeight * page.pixelRatio);
    page.cssWidth = cssWidth;
    page.cssHeight = cssHeight;
    await pdfPage.render({
      canvasContext: page.canvas.getContext('2d'),
      viewport,
      transform: [page.pixelRatio, 0, 0, page.pixelRatio, 0, 0],
    }).promise;
    if (generation !== renderGeneration) return;
    page.rendered = true;
    page.wrapper.classList.add('is-rendered');
    pageObserver?.unobserve(page.wrapper);
    pdfPage.cleanup();
    if (!documentReadyPosted && pageIndex === 0) {
      documentReadyPosted = true;
      emptyState.hidden = true;
      post('documentLoaded', { totalPages: pdfDocument.numPages });
    }
  } catch (error) {
    page.rendering = false;
    if (pageIndex === 0) {
      emptyState.hidden = false;
      emptyState.textContent = 'PDF 文件无法打开';
      post('documentError', {
        message: error instanceof Error ? error.message : 'PDF 首页无法渲染',
      });
    }
  }
};

const renderDocument = async () => {
  if (!pdfDocument) return;
  const generation = ++renderGeneration;
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

  pageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const pageIndex = Number(entry.target.dataset.pageIndex);
        void renderPage(pageIndex, generation);
      });
    },
    { rootMargin: '900px 0px' }
  );
  pageElements.forEach((page, pageIndex) => {
    page.wrapper.dataset.pageIndex = String(pageIndex);
    pageObserver.observe(page.wrapper);
  });
  await renderPage(0, generation);
};

const loadPdfBytes = async (base64) => {
  try {
    emptyState.hidden = false;
    emptyState.textContent = '正在渲染 PDF…';
    documentReadyPosted = false;
    pageObserver?.disconnect();
    if (pdfDocument) await pdfDocument.destroy();
    pdfDocument = await pdfjsLib.getDocument({ data: decodeBase64(base64) }).promise;
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
    incomingPdf = new Array(expectedChunks);
  } else if (message.type === 'pdf-chunk') {
    incomingPdf[message.index] = message.data;
    post('pdf-chunk-ack', { index: message.index });
  } else if (message.type === 'pdf-end') {
    if (incomingPdf.filter(Boolean).length !== expectedChunks) {
      post('documentError', { message: 'PDF 数据传输不完整，请重试' });
      return;
    }
    const base64 = incomingPdf.join('');
    incomingPdf = [];
    void loadPdfBytes(base64);
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

const preventGestureZoom = (event) => event.preventDefault();
document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
document.addEventListener('gestureend', preventGestureZoom, { passive: false });
document.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length > 1) event.preventDefault();
  },
  { passive: false }
);

const touchDistance = (touches) =>
  Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

document.addEventListener(
  'touchstart',
  (event) => {
    if (event.touches.length !== 2 || !pdfDocument) return;
    event.preventDefault();
    suppressSelectionUntil = Date.now() + 500;
    const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    pinchState = {
      distance: touchDistance(event.touches),
      startZoom: zoomScale,
      nextZoom: zoomScale,
      centerX,
      centerY,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  },
  { passive: false }
);

document.addEventListener(
  'touchmove',
  (event) => {
    if (!pinchState || event.touches.length !== 2) return;
    event.preventDefault();
    const nextZoom = Math.max(
      1,
      Math.min(
        4,
        pinchState.startZoom *
          (touchDistance(event.touches) / pinchState.distance)
      )
    );
    pinchState.nextZoom = nextZoom;
    const previewScale = nextZoom / pinchState.startZoom;
    pagesRoot.style.transformOrigin = `${
      pinchState.scrollX + pinchState.centerX
    }px ${pinchState.scrollY + pinchState.centerY}px`;
    pagesRoot.style.transform = `scale(${previewScale})`;
  },
  { passive: false }
);

document.addEventListener(
  'touchend',
  () => {
    if (!pinchState) return;
    const completed = pinchState;
    pinchState = null;
    suppressSelectionUntil = Date.now() + 250;
    pagesRoot.style.transform = '';
    pagesRoot.style.transformOrigin = '';
    if (Math.abs(completed.nextZoom - zoomScale) < 0.01) return;
    const ratio = completed.nextZoom / completed.startZoom;
    zoomScale = completed.nextZoom;
    void renderDocument().then(() => {
      window.scrollTo(
        (completed.scrollX + completed.centerX) * ratio - completed.centerX,
        (completed.scrollY + completed.centerY) * ratio - completed.centerY
      );
    });
  },
  { passive: false }
);
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
