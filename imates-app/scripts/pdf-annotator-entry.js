import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const workerSource = atob('__PDF_WORKER_BASE64__');
const workerBytes = new Uint8Array(workerSource.length);
for (let index = 0; index < workerSource.length; index += 1) {
  workerBytes[index] = workerSource.charCodeAt(index);
}
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([workerBytes], { type: 'text/javascript' })
);

const pagesElement = document.querySelector('#pages');
const emptyElement = document.querySelector('#empty');
const pageElements = new Map();

let pdfDocument = null;
let strokes = [];
let currentStroke = null;
let tool = 'hand';
let config = {
  pen: { color: '#212529', width: 2.5, opacity: 1 },
  highlighter: { color: '#FFFF00', width: 8, opacity: 0.4 },
  eraser: { width: 18 },
};
let undoStack = [];
let redoStack = [];
let incomingPdf = [];
let expectedChunks = 0;
let renderGeneration = 0;
let documentAnnounced = false;
let pageObserver = null;

const post = (type, payload = {}) => {
  const message = JSON.stringify({ type, ...payload });
  if (window.ReactNativeWebView?.postMessage) {
    window.ReactNativeWebView.postMessage(message);
  } else if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
};

window.addEventListener('error', (event) => {
  post('documentError', {
    message: event.message || 'PDF 阅读器脚本运行失败',
  });
});
window.addEventListener('unhandledrejection', (event) => {
  post('documentError', {
    message:
      event.reason instanceof Error
        ? event.reason.message
        : 'PDF 阅读器运行失败',
  });
});

const postHistory = () => {
  post('history', {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  });
};

const cloneStrokes = (value) => JSON.parse(JSON.stringify(value));

const saveSnapshot = () => {
  undoStack.push(cloneStrokes(strokes));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
};

const emitAnnotations = () => {
  post('annotationsChanged', { strokes });
  postHistory();
};

const setCanvasMode = () => {
  pageElements.forEach(({ inkCanvas }) => {
    const drawing = tool !== 'hand';
    inkCanvas.style.pointerEvents = drawing ? 'auto' : 'none';
    inkCanvas.style.touchAction = drawing ? 'pinch-zoom' : 'auto';
    inkCanvas.style.cursor =
      tool === 'hand' ? 'grab' : tool === 'eraser' ? 'cell' : 'crosshair';
  });
};

const drawSmoothPath = (context, points, width, color, opacity, highlighter) => {
  if (!points.length) return;
  context.save();
  context.globalAlpha = opacity;
  context.globalCompositeOperation = highlighter ? 'multiply' : 'source-over';
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length - 1; index += 1) {
      const midpoint = {
        x: (points[index].x + points[index + 1].x) / 2,
        y: (points[index].y + points[index + 1].y) / 2,
      };
      context.quadraticCurveTo(
        points[index].x,
        points[index].y,
        midpoint.x,
        midpoint.y
      );
    }
    const last = points[points.length - 1];
    context.lineTo(last.x, last.y);
    context.stroke();
  }
  context.restore();
};

const renderInkPage = (pageIndex) => {
  const page = pageElements.get(pageIndex);
  if (!page?.rendered) return;
  const { inkCanvas, cssWidth, cssHeight, scale } = page;
  const context = inkCanvas.getContext('2d');
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const pageStrokes = strokes.filter((stroke) => stroke.pageIndex === pageIndex);
  if (currentStroke?.pageIndex === pageIndex) pageStrokes.push(currentStroke);
  pageStrokes.forEach((stroke) => {
    drawSmoothPath(
      context,
      stroke.points.map((point) => ({
        x: point.x * cssWidth,
        y: point.y * cssHeight,
      })),
      stroke.width * cssWidth,
      stroke.color,
      stroke.opacity,
      stroke.type === 'highlighter'
    );
  });
};

const renderAllInk = () => {
  pageElements.forEach((_, pageIndex) => renderInkPage(pageIndex));
};

const distanceToSegment = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(
    point.x - (start.x + position * dx),
    point.y - (start.y + position * dy)
  );
};

const strokeTouchesPoint = (stroke, point, radius) => {
  if (stroke.points.length === 1) {
    return distanceToSegment(point, stroke.points[0], stroke.points[0]) <= radius;
  }
  return stroke.points.some((strokePoint, index) => {
    if (index === 0) return false;
    return distanceToSegment(point, stroke.points[index - 1], strokePoint) <= radius;
  });
};

const eraseAt = (pageIndex, point, cssWidth) => {
  const radius = config.eraser.width / cssWidth;
  const previousLength = strokes.length;
  strokes = strokes.filter(
    (stroke) =>
      stroke.pageIndex !== pageIndex ||
      !strokeTouchesPoint(stroke, point, radius + stroke.width / 2)
  );
  return previousLength !== strokes.length;
};

const pointForEvent = (event, inkCanvas) => {
  const rect = inkCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
};

const bindInkEvents = (pageIndex, inkCanvas) => {
  let eraserChanged = false;
  inkCanvas.addEventListener('pointerdown', (event) => {
    if (tool === 'hand') return;
    event.preventDefault();
    inkCanvas.setPointerCapture(event.pointerId);
    const point = pointForEvent(event, inkCanvas);
    saveSnapshot();

    if (tool === 'eraser') {
      eraserChanged = eraseAt(pageIndex, point, inkCanvas.clientWidth);
      renderInkPage(pageIndex);
      return;
    }

    const activeConfig = config[tool];
    currentStroke = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: tool,
      pageIndex,
      points: [point],
      color: activeConfig.color,
      width: activeConfig.width / inkCanvas.clientWidth,
      opacity: activeConfig.opacity,
    };
    renderInkPage(pageIndex);
  });

  inkCanvas.addEventListener('pointermove', (event) => {
    if (!inkCanvas.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const point = pointForEvent(event, inkCanvas);
    if (tool === 'eraser') {
      eraserChanged =
        eraseAt(pageIndex, point, inkCanvas.clientWidth) || eraserChanged;
    } else if (currentStroke) {
      const previous = currentStroke.points[currentStroke.points.length - 1];
      if (Math.hypot(point.x - previous.x, point.y - previous.y) > 0.001) {
        currentStroke.points.push(point);
      }
    }
    renderInkPage(pageIndex);
  });

  const finishPointer = (event) => {
    if (!inkCanvas.hasPointerCapture(event.pointerId)) return;
    inkCanvas.releasePointerCapture(event.pointerId);
    if (event.type === 'pointercancel') {
      const previousStrokes = undoStack.pop();
      if (previousStrokes) strokes = previousStrokes;
      currentStroke = null;
      eraserChanged = false;
      renderInkPage(pageIndex);
      postHistory();
      return;
    }
    if (tool === 'eraser') {
      if (eraserChanged) emitAnnotations();
      else undoStack.pop();
      eraserChanged = false;
    } else if (currentStroke) {
      strokes.push(currentStroke);
      currentStroke = null;
      emitAnnotations();
    }
    renderInkPage(pageIndex);
  };
  inkCanvas.addEventListener('pointerup', finishPointer);
  inkCanvas.addEventListener('pointercancel', finishPointer);
};

const createPageElement = (pageIndex) => {
  const wrapper = document.createElement('section');
  wrapper.className = 'pdf-page';
  const pdfCanvas = document.createElement('canvas');
  pdfCanvas.className = 'pdf-canvas';
  const inkCanvas = document.createElement('canvas');
  inkCanvas.className = 'ink-canvas';
  wrapper.append(pdfCanvas, inkCanvas);
  pagesElement.append(wrapper);
  bindInkEvents(pageIndex, inkCanvas);
  return { wrapper, pdfCanvas, inkCanvas };
};

const renderPdfPage = async (pageIndex, generation) => {
  const element = pageElements.get(pageIndex);
  if (
    !element ||
    element.rendered ||
    element.rendering ||
    generation !== renderGeneration
  ) {
    return;
  }
  element.rendering = true;
  const { cssWidth, cssHeight, pixelRatio, pdfCanvas, inkCanvas } = element;
  for (const canvas of [pdfCanvas, inkCanvas]) {
    canvas.width = Math.floor(cssWidth * pixelRatio);
    canvas.height = Math.floor(cssHeight * pixelRatio);
  }

  await element.page.render({
    canvasContext: pdfCanvas.getContext('2d'),
    viewport: element.viewport,
    transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
  }).promise;
  if (generation !== renderGeneration) return;
  element.rendered = true;
  element.rendering = false;
  renderInkPage(pageIndex);
  if (!documentAnnounced) {
    documentAnnounced = true;
    post('documentLoaded', { totalPages: pdfDocument.numPages });
  }
};

const renderDocument = async () => {
  if (!pdfDocument) return;
  const generation = ++renderGeneration;
  pageObserver?.disconnect();
  pageObserver = null;
  pagesElement.replaceChildren();
  pageElements.clear();
  const targetWidth = Math.max(280, Math.min(1024, pagesElement.clientWidth - 20));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
    if (generation !== renderGeneration) return;
    const page = await pdfDocument.getPage(pageIndex + 1);
    const originalViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: targetWidth / originalViewport.width });
    const element = createPageElement(pageIndex);
    const cssWidth = Math.floor(viewport.width);
    const cssHeight = Math.floor(viewport.height);

    element.wrapper.style.width = `${cssWidth}px`;
    element.wrapper.style.height = `${cssHeight}px`;
    for (const canvas of [element.pdfCanvas, element.inkCanvas]) {
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    pageElements.set(pageIndex, {
      ...element,
      page,
      viewport,
      cssWidth,
      cssHeight,
      scale: pixelRatio,
      pixelRatio,
      rendered: false,
      rendering: false,
    });
    setCanvasMode();
    if (pageIndex === 0) void renderPdfPage(0, generation);
  }

  if ('IntersectionObserver' in window) {
    pageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const pageIndex = Number(entry.target.dataset.pageIndex);
          void renderPdfPage(pageIndex, generation);
        });
      },
      { rootMargin: '800px 0px' }
    );
    pageElements.forEach(({ wrapper }, pageIndex) => {
      wrapper.dataset.pageIndex = String(pageIndex);
      pageObserver.observe(wrapper);
    });
  } else {
    for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
      await renderPdfPage(pageIndex, generation);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  setCanvasMode();
};

const loadPdfBytes = async (base64) => {
  try {
    emptyElement.hidden = true;
    post('loadProgress', { phase: 'rendering' });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    pdfDocument = await pdfjsLib.getDocument({ data: bytes }).promise;
    documentAnnounced = false;
    await renderDocument();
  } catch (error) {
    emptyElement.hidden = false;
    emptyElement.textContent = 'PDF 加载失败';
    post('documentError', {
      message: error instanceof Error ? error.message : 'PDF 文件无法解析',
    });
  }
};

const handleMessage = (rawMessage) => {
  let message;
  try {
    message =
      typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
  } catch {
    return;
  }
  if (!message?.type) return;

  if (message.type === 'host-ready') {
    post('ready');
  } else if (message.type === 'pdf-start') {
    incomingPdf = new Array(message.totalChunks);
    expectedChunks = message.totalChunks;
    strokes = Array.isArray(message.annotations) ? message.annotations : [];
    undoStack = [];
    redoStack = [];
    postHistory();
  } else if (message.type === 'pdf-chunk') {
    incomingPdf[message.index] = message.data;
    post('pdf-chunk-ack', { index: message.index });
    if (message.index % 12 === 0) {
      post('loadProgress', {
        phase: 'transfer',
        progress: (message.index + 1) / expectedChunks,
      });
    }
  } else if (message.type === 'pdf-end') {
    if (incomingPdf.filter(Boolean).length !== expectedChunks) {
      post('documentError', { message: 'PDF 数据传输不完整，请重试' });
      return;
    }
    const base64 = incomingPdf.join('');
    incomingPdf = [];
    void loadPdfBytes(base64);
  } else if (message.type === 'tool') {
    tool = message.tool;
    currentStroke = null;
    setCanvasMode();
    renderAllInk();
  } else if (message.type === 'config') {
    config = { ...config, ...message.config };
  } else if (message.type === 'undo' && undoStack.length) {
    redoStack.push(cloneStrokes(strokes));
    strokes = undoStack.pop();
    renderAllInk();
    emitAnnotations();
  } else if (message.type === 'redo' && redoStack.length) {
    undoStack.push(cloneStrokes(strokes));
    strokes = redoStack.pop();
    renderAllInk();
    emitAnnotations();
  } else if (message.type === 'clear' && strokes.length) {
    saveSnapshot();
    strokes = [];
    renderAllInk();
    emitAnnotations();
  }
};

window.addEventListener('message', (event) => handleMessage(event.data));
document.addEventListener('message', (event) => handleMessage(event.data));

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => void renderDocument(), 180);
});

post('ready');
