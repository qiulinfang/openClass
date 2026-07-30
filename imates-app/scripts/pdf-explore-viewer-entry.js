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
const pendingPageRenders = new Set();
const validTools = new Set(['hand', 'pen', 'highlighter', 'eraser', 'text']);
let pdfDocument = null;
let pdfLoadingTask = null;
let pdfRangeTransport = null;
let expectedChunks = 0;
let expectedBytes = 0;
let incomingPdf = null;
let receivedChunks = [];
let exploreMode = false;
let annotationTool = 'hand';
let annotationConfig = {
  color: '#242638',
  width: 0.0035,
  fontSize: 0.024,
  hasBackground: true,
};
let annotations = [];
let undoStack = [];
let redoStack = [];
let activeTextEditor = null;
let selectedTextId = null;
let renderedViewportWidth = 0;
let pageObserver = null;
let renderGeneration = 0;
let documentReadyPosted = false;
let renderQueueRunning = false;

const post = (type, payload = {}) => {
  const message = JSON.stringify({ type, ...payload });
  window.ReactNativeWebView?.postMessage(message);
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
};

const cloneItems = (items) => JSON.parse(JSON.stringify(items));
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const measureTextBoxHeight = (text, width, fontSize, page) => {
  const pageWidth = Math.max(1, page.cssWidth);
  const pageHeight = Math.max(1, page.cssHeight);
  const fontPixels = Math.max(12, fontSize * pageWidth);
  const measurement = document.createElement('div');
  measurement.style.position = 'fixed';
  measurement.style.left = '-10000px';
  measurement.style.top = '0';
  measurement.style.width = `${Math.max(1, width * pageWidth)}px`;
  measurement.style.height = 'auto';
  measurement.style.padding = '3px 5px';
  measurement.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, sans-serif';
  measurement.style.fontSize = `${fontPixels}px`;
  measurement.style.fontWeight = '600';
  measurement.style.lineHeight = '1.35';
  measurement.style.overflowWrap = 'anywhere';
  measurement.style.whiteSpace = 'pre-wrap';
  measurement.style.visibility = 'hidden';
  measurement.style.pointerEvents = 'none';
  measurement.textContent = text || '字';
  document.body.append(measurement);
  const minimumPixels = fontPixels * 1.35 + 6;
  const measuredPixels = Math.max(minimumPixels, measurement.scrollHeight);
  measurement.remove();
  return Math.min(0.9, measuredPixels / pageHeight);
};

const normalizeAnnotationDocument = (document) => {
  if (!document || typeof document !== 'object' || !Array.isArray(document.items)) {
    return [];
  }
  return document.items.slice(0, 5000).flatMap((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !Number.isInteger(item.pageIndex) ||
      item.pageIndex < 0
    ) {
      return [];
    }
    if (item.type === 'text') {
      const text = String(item.text || '').trim().slice(0, 2000);
      if (!text) return [];
      const fontSize = Math.max(
        0.014,
        Math.min(0.045, Number(item.fontSize) || 0.024)
      );
      return [
        {
          id: String(item.id || createId()),
          type: 'text',
          pageIndex: item.pageIndex,
          x: clamp01(item.x),
          y: clamp01(item.y),
          text,
          color: typeof item.color === 'string' ? item.color : '#242638',
          fontSize,
          hasBackground: item.hasBackground !== false,
          width: Math.max(
            0.12,
            Math.min(
              0.9,
              Number(item.width) ||
                Math.min(0.48, Math.max(0.2, text.length * fontSize * 0.55))
            )
          ),
          height: Math.max(
            0.045,
            Math.min(
              0.9,
              Number(item.height) ||
                Math.max(0.065, text.split('\n').length * fontSize * 1.5)
            )
          ),
        },
      ];
    }
    if (
      (item.type !== 'pen' && item.type !== 'highlighter') ||
      !Array.isArray(item.points)
    ) {
      return [];
    }
    const points = item.points.slice(0, 4000).map((point) => ({
      x: clamp01(point?.x),
      y: clamp01(point?.y),
    }));
    if (points.length === 0) return [];
    return [
      {
        id: String(item.id || createId()),
        type: item.type,
        pageIndex: item.pageIndex,
        points,
        color: typeof item.color === 'string' ? item.color : '#242638',
        width: Math.max(0.0015, Math.min(0.03, Number(item.width) || 0.004)),
        opacity:
          item.type === 'highlighter'
            ? Math.max(0.15, Math.min(0.7, Number(item.opacity) || 0.38))
            : 1,
      },
    ];
  });
};

const notifyHistory = () => {
  post('annotationHistoryState', {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  });
};

const notifyAnnotationsChanged = () => {
  post('annotationsChanged', {
    document: { version: 1, items: annotations },
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  });
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
    Math.max(240, Math.min(920, document.documentElement.clientWidth - 16))
  );

const getVisualViewportScale = () =>
  Math.max(1, Number(window.visualViewport?.scale) || 1);

const getRenderPixelRatio = (cssWidth, cssHeight) =>
  Math.max(
    2,
    Math.min(
      (window.devicePixelRatio || 1) * 1.6 * getVisualViewportScale(),
      6,
      8192 / Math.max(1, cssWidth),
      8192 / Math.max(1, cssHeight),
      Math.sqrt(12_000_000 / Math.max(1, cssWidth * cssHeight))
    )
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

const drawStroke = (context, item, cssWidth, cssHeight) => {
  const points = item.points;
  if (!points?.length) return;
  context.save();
  context.globalAlpha = item.opacity ?? 1;
  context.globalCompositeOperation =
    item.type === 'highlighter' ? 'multiply' : 'source-over';
  context.strokeStyle = item.color;
  context.fillStyle = item.color;
  context.lineWidth = Math.max(1, item.width * cssWidth);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (points.length === 1) {
    context.beginPath();
    context.arc(
      points[0].x * cssWidth,
      points[0].y * cssHeight,
      context.lineWidth / 2,
      0,
      Math.PI * 2
    );
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(points[0].x * cssWidth, points[0].y * cssHeight);
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      context.quadraticCurveTo(
        current.x * cssWidth,
        current.y * cssHeight,
        ((current.x + next.x) / 2) * cssWidth,
        ((current.y + next.y) / 2) * cssHeight
      );
    }
    const last = points[points.length - 1];
    context.lineTo(last.x * cssWidth, last.y * cssHeight);
    context.stroke();
  }
  context.restore();
};

const renderTextAnnotations = (pageIndex) => {
  const page = pageElements.get(pageIndex);
  if (!page) return;
  page.textLayer.replaceChildren();
  annotations
    .filter((item) => item.pageIndex === pageIndex && item.type === 'text')
    .forEach((item) => {
      const text = document.createElement('div');
      text.className = 'text-annotation';
      if (item.id === selectedTextId) {
        text.classList.add('is-selected');
      }
      text.dataset.annotationId = item.id;
      text.classList.toggle('has-background', item.hasBackground !== false);
      text.style.left = `${item.x * 100}%`;
      text.style.top = `${item.y * 100}%`;
      text.style.width = `${item.width * 100}%`;
      text.style.height = `${item.height * 100}%`;
      text.style.color = item.color;
      text.style.fontSize = `${Math.max(12, item.fontSize * page.cssWidth)}px`;

      const content = document.createElement('div');
      content.className = 'text-annotation-content';
      content.textContent = item.text;

      const moveHandle = document.createElement('button');
      moveHandle.type = 'button';
      moveHandle.className = 'text-control text-move';
      moveHandle.dataset.move = 'true';
      moveHandle.setAttribute('aria-label', '移动文本框');
      moveHandle.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3"/></svg>';

      const topLeftResize = document.createElement('button');
      topLeftResize.type = 'button';
      topLeftResize.className =
        'text-control text-resize-handle text-resize-top-left';
      topLeftResize.dataset.resize = 'top-left';
      topLeftResize.setAttribute('aria-label', '从左上角调整文本框大小');

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'text-control text-delete';
      deleteButton.setAttribute('aria-label', '删除文本框');
      deleteButton.textContent = '×';
      deleteButton.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      deleteButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        deleteTextAnnotation(item.id);
      });

      const bottomRightResize = document.createElement('button');
      bottomRightResize.type = 'button';
      bottomRightResize.className =
        'text-control text-resize-handle text-resize-bottom-right';
      bottomRightResize.dataset.resize = 'bottom-right';
      bottomRightResize.setAttribute('aria-label', '从右下角调整文本框大小');

      text.append(
        content,
        topLeftResize,
        deleteButton,
        moveHandle,
        bottomRightResize
      );
      bindTextInteraction(pageIndex, text, item.id);
      page.textLayer.append(text);
    });
};

const renderAnnotationPage = (pageIndex, previewItem = null) => {
  const page = pageElements.get(pageIndex);
  if (!page) return;
  renderTextAnnotations(pageIndex);
  if (!page.rendered) return;
  const { annotationCanvas, cssWidth, cssHeight, pixelRatio } = page;
  const targetWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
  const targetHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
  if (
    annotationCanvas.width !== targetWidth ||
    annotationCanvas.height !== targetHeight
  ) {
    annotationCanvas.width = targetWidth;
    annotationCanvas.height = targetHeight;
    annotationCanvas.style.width = `${cssWidth}px`;
    annotationCanvas.style.height = `${cssHeight}px`;
  }
  const context = annotationCanvas.getContext('2d');
  context.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  context.save();
  context.scale(pixelRatio, pixelRatio);
  annotations
    .filter(
      (item) =>
        item.pageIndex === pageIndex &&
        (item.type === 'pen' || item.type === 'highlighter')
    )
    .forEach((item) => drawStroke(context, item, cssWidth, cssHeight));
  if (previewItem) {
    drawStroke(context, previewItem, cssWidth, cssHeight);
  }
  context.restore();
};

const renderAllAnnotations = () => {
  pageElements.forEach((_, pageIndex) => renderAnnotationPage(pageIndex));
};

const commitItems = (nextItems, previousItems = cloneItems(annotations)) => {
  undoStack.push(previousItems);
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  annotations = nextItems;
  renderAllAnnotations();
  notifyAnnotationsChanged();
};

const postTextSelectionState = (item) => {
  if (!item || item.type !== 'text') {
    post('textSelectionCleared');
    return;
  }
  post('textSelectionState', {
    color: item.color,
    fontSize: item.fontSize,
    hasBackground: item.hasBackground !== false,
  });
};

const postTextConfigState = (config) => {
  post('textSelectionState', {
    color: config.color,
    fontSize: config.fontSize,
    hasBackground: config.hasBackground !== false,
  });
};

const undo = () => {
  const previous = undoStack.pop();
  if (!previous) return;
  redoStack.push(cloneItems(annotations));
  annotations = previous;
  if (
    selectedTextId &&
    !annotations.some((item) => item.id === selectedTextId)
  ) {
    selectedTextId = null;
  }
  renderAllAnnotations();
  postTextSelectionState(
    annotations.find((item) => item.id === selectedTextId)
  );
  notifyAnnotationsChanged();
};

const redo = () => {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(cloneItems(annotations));
  annotations = next;
  if (
    selectedTextId &&
    !annotations.some((item) => item.id === selectedTextId)
  ) {
    selectedTextId = null;
  }
  renderAllAnnotations();
  postTextSelectionState(
    annotations.find((item) => item.id === selectedTextId)
  );
  notifyAnnotationsChanged();
};

const selectText = (item) => {
  const previous = annotations.find(
    (candidate) => candidate.id === selectedTextId
  );
  selectedTextId = item?.id || null;
  if (previous) renderTextAnnotations(previous.pageIndex);
  if (item) {
    renderTextAnnotations(item.pageIndex);
    postTextSelectionState(item);
  } else {
    postTextSelectionState(null);
  }
};

const deleteTextAnnotation = (id) => {
  closeTextEditor(true);
  const item = annotations.find(
    (candidate) => candidate.id === id && candidate.type === 'text'
  );
  if (!item) return;
  const previous = cloneItems(annotations);
  const next = annotations.filter((candidate) => candidate.id !== id);
  if (selectedTextId === id) {
    selectedTextId = null;
    postTextSelectionState(null);
  }
  commitItems(next, previous);
};

const closeTextEditor = (commit) => {
  const editor = activeTextEditor;
  if (!editor) return;
  activeTextEditor = null;
  post('textEditingState', { active: false });
  const text = editor.element.value.trim();
  editor.shell.remove();
  if (!commit || !text) {
    renderTextAnnotations(editor.pageIndex);
    if (!editor.existingId) selectText(null);
    return;
  }
  const previous = cloneItems(annotations);
  const next = cloneItems(annotations);
  let selected = null;
  if (editor.existingId) {
    const item = next.find((candidate) => candidate.id === editor.existingId);
    if (
      !item ||
      (item.text === text &&
        item.color === editor.color &&
        Math.abs(item.fontSize - editor.fontSize) < 0.0001 &&
        item.hasBackground === editor.hasBackground &&
        Math.abs(item.x - editor.point.x) < 0.0001 &&
        Math.abs(item.y - editor.point.y) < 0.0001 &&
        Math.abs(item.width - editor.width) < 0.0001 &&
        Math.abs(item.height - editor.height) < 0.0001)
    ) {
      renderTextAnnotations(editor.pageIndex);
      return;
    }
    item.text = text;
    item.color = editor.color;
    item.fontSize = editor.fontSize;
    item.hasBackground = editor.hasBackground;
    item.x = editor.point.x;
    item.y = editor.point.y;
    item.width = editor.width;
    item.height = editor.height;
    selected = item;
  } else {
    selected = {
      id: createId(),
      type: 'text',
      pageIndex: editor.pageIndex,
      x: editor.point.x,
      y: editor.point.y,
      text,
      color: editor.color,
      fontSize: editor.fontSize,
      hasBackground: editor.hasBackground,
      width: editor.width,
      height: editor.height,
    };
    next.push(selected);
  }
  commitItems(next, previous);
  selectText(selected);
};

const findTextAtPoint = (pageIndex, point) => {
  const page = pageElements.get(pageIndex);
  if (!page) return null;
  return [...annotations]
    .reverse()
    .find((item) => {
      if (item.pageIndex !== pageIndex || item.type !== 'text') return false;
      const marginX =
        item.id === selectedTextId ? Math.max(0.018, 24 / page.cssWidth) : 0.015;
      const marginY =
        item.id === selectedTextId
          ? Math.max(0.014, 24 / page.cssHeight)
          : 0.015;
      return (
        point.x >= item.x - marginX &&
        point.x <= item.x + item.width + marginX &&
        point.y >= item.y - marginY &&
        point.y <= item.y + item.height + marginY
      );
    });
};

const beginTextEdit = (
  pageIndex,
  point,
  { forceNew = false, existingId = null } = {}
) => {
  closeTextEditor(true);
  const page = pageElements.get(pageIndex);
  if (!page) return;
  const existing = forceNew
    ? null
    : annotations.find(
        (item) =>
          item.id === existingId &&
          item.pageIndex === pageIndex &&
          item.type === 'text'
      ) || findTextAtPoint(pageIndex, point);
  const width = existing?.width || 0.32;
  const height = existing?.height || 0.085;
  const color = existing?.color || annotationConfig.color || '#242638';
  const fontSize = existing?.fontSize || annotationConfig.fontSize || 0.024;
  const hasBackground = existing
    ? existing.hasBackground !== false
    : annotationConfig.hasBackground !== false;
  const editorPoint = existing
    ? { x: existing.x, y: existing.y }
    : {
        x: Math.min(point.x, 1 - width),
        y: Math.min(point.y, 1 - height),
      };
  selectText(existing || null);
  const editorShell = document.createElement('div');
  editorShell.className = 'text-editor-shell';
  editorShell.classList.toggle('has-background', hasBackground);
  editorShell.style.left = `${editorPoint.x * 100}%`;
  editorShell.style.top = `${editorPoint.y * 100}%`;
  editorShell.style.width = `${width * 100}%`;
  editorShell.style.height = `${height * 100}%`;

  const textarea = document.createElement('textarea');
  textarea.className = 'text-editor';
  textarea.placeholder = '输入文字…';
  textarea.value = existing?.text || '';
  textarea.style.color = color;
  textarea.style.fontSize = `${Math.max(
    12,
    fontSize * page.cssWidth
  )}px`;
  textarea.addEventListener('pointerdown', (event) => event.stopPropagation());
  textarea.addEventListener('pointermove', (event) => event.stopPropagation());
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTextEditor(false);
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      closeTextEditor(true);
    }
  });
  textarea.addEventListener('input', () => {
    const nextHeight = Math.min(
      0.9,
      Math.max(height, textarea.scrollHeight / page.cssHeight)
    );
    editorShell.style.height = `${nextHeight * 100}%`;
    if (activeTextEditor?.element === textarea) {
      activeTextEditor.height = nextHeight;
    }
  });
  textarea.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (activeTextEditor?.element === textarea) closeTextEditor(true);
    }, 0);
  });

  const topLeftResize = document.createElement('button');
  topLeftResize.type = 'button';
  topLeftResize.className =
    'text-control text-resize-handle text-resize-top-left';
  topLeftResize.setAttribute('aria-label', '从左上角调整文本框大小');

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'text-control text-delete';
  deleteButton.setAttribute(
    'aria-label',
    existing ? '删除文本框' : '取消新增文本框'
  );
  deleteButton.textContent = '×';

  const bottomRightResize = document.createElement('button');
  bottomRightResize.type = 'button';
  bottomRightResize.className =
    'text-control text-resize-handle text-resize-bottom-right';
  bottomRightResize.setAttribute('aria-label', '从右下角调整文本框大小');

  const moveHandle = document.createElement('button');
  moveHandle.type = 'button';
  moveHandle.className = 'text-control text-move';
  moveHandle.setAttribute('aria-label', '移动文本框');
  moveHandle.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3"/></svg>';

  editorShell.append(
    textarea,
    topLeftResize,
    deleteButton,
    moveHandle,
    bottomRightResize
  );
  page.selectionLayer.append(editorShell);
  activeTextEditor = {
    pageIndex,
    point: editorPoint,
    existingId: existing?.id || null,
    shell: editorShell,
    element: textarea,
    width,
    height,
    color,
    fontSize,
    hasBackground,
  };
  post('textEditingState', { active: true });
  bindTextEditorResize(topLeftResize, 'top-left');
  bindTextEditorResize(bottomRightResize, 'bottom-right');
  bindTextEditorMove(moveHandle);
  deleteButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  deleteButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const existingTextId = activeTextEditor?.existingId;
    closeTextEditor(false);
    if (existingTextId) deleteTextAnnotation(existingTextId);
  });
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
};

const updateTextEditorFrame = (editor) => {
  editor.shell.style.left = `${editor.point.x * 100}%`;
  editor.shell.style.top = `${editor.point.y * 100}%`;
  editor.shell.style.width = `${editor.width * 100}%`;
  editor.shell.style.height = `${editor.height * 100}%`;
};

const bindTextEditorMove = (handle) => {
  let move = null;
  const update = (event) => {
    if (move?.pointerId !== event.pointerId || !activeTextEditor) return;
    const editor = activeTextEditor;
    event.preventDefault();
    event.stopPropagation();
    move.lastClientX = event.clientX;
    move.lastClientY = event.clientY;
    const target = closestPageAtClientPoint(event.clientX, event.clientY);
    if (!target) return;
    if (target.pageIndex !== editor.pageIndex) {
      const previousPage = pageElements.get(editor.pageIndex);
      if (!previousPage) return;
      const widthPixels = editor.width * previousPage.cssWidth;
      const heightPixels = editor.height * previousPage.cssHeight;
      editor.pageIndex = target.pageIndex;
      editor.width = Math.max(
        0.12,
        Math.min(0.9, widthPixels / target.page.cssWidth)
      );
      editor.height = Math.max(
        0.045,
        Math.min(0.9, heightPixels / target.page.cssHeight)
      );
      target.page.selectionLayer.append(editor.shell);
      editor.element.style.fontSize = `${Math.max(
        12,
        editor.fontSize * target.page.cssWidth
      )}px`;
    }
    const rect = target.page.wrapper.getBoundingClientRect();
    const localX = (event.clientX - rect.left) / Math.max(1, rect.width);
    const localY = (event.clientY - rect.top) / Math.max(1, rect.height);
    editor.point.x = Math.max(
      0,
      Math.min(1 - editor.width, localX - move.grabRatioX * editor.width)
    );
    editor.point.y = Math.max(
      0,
      Math.min(1 - editor.height, localY - move.grabRatioY * editor.height)
    );
    updateTextEditorFrame(editor);
  };
  const finish = (event) => {
    if (move?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener('pointermove', update, true);
    document.removeEventListener('pointerup', finish, true);
    document.removeEventListener('pointercancel', finish, true);
    if (move.autoScrollFrame) cancelAnimationFrame(move.autoScrollFrame);
    move = null;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
  };
  handle.addEventListener('pointerdown', (event) => {
    const editor = activeTextEditor;
    if (!editor || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    const shellRect = editor.shell.getBoundingClientRect();
    move = {
      pointerId: event.pointerId,
      grabRatioX: Math.max(
        0,
        Math.min(
          1,
          (event.clientX - shellRect.left) / Math.max(1, shellRect.width)
        )
      ),
      grabRatioY: Math.max(
        0,
        Math.min(
          1,
          (event.clientY - shellRect.top) / Math.max(1, shellRect.height)
        )
      ),
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
    const autoScroll = () => {
      if (!move) return;
      const edgeSize = 76;
      let speed = 0;
      if (move.lastClientY < edgeSize) {
        speed = -Math.min(
          18,
          Math.max(5, (edgeSize - move.lastClientY) * 0.24)
        );
      } else if (move.lastClientY > window.innerHeight - edgeSize) {
        speed = Math.min(
          18,
          Math.max(
            5,
            (move.lastClientY - (window.innerHeight - edgeSize)) * 0.24
          )
        );
      }
      if (speed !== 0) {
        window.scrollBy(0, speed);
        update({
          pointerId: move.pointerId,
          clientX: move.lastClientX,
          clientY: move.lastClientY,
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        });
      }
      move.autoScrollFrame = requestAnimationFrame(autoScroll);
    };
    move.autoScrollFrame = requestAnimationFrame(autoScroll);
    document.addEventListener('pointermove', update, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  });
};

const bindTextEditorResize = (handle, corner) => {
  let resize = null;
  const update = (event) => {
    if (resize?.pointerId !== event.pointerId || !activeTextEditor) return;
    const editor = activeTextEditor;
    const page = pageElements.get(editor.pageIndex);
    if (!page) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = page.selectionLayer.getBoundingClientRect();
    const deltaX =
      (event.clientX - resize.startClientX) / Math.max(1, rect.width);
    const deltaY =
      (event.clientY - resize.startClientY) / Math.max(1, rect.height);
    if (corner === 'top-left') {
      const right = resize.point.x + resize.width;
      const bottom = resize.point.y + resize.height;
      editor.point.x = Math.max(
        0,
        Math.min(right - 0.12, resize.point.x + deltaX)
      );
      editor.point.y = Math.max(
        0,
        Math.min(bottom - 0.045, resize.point.y + deltaY)
      );
      editor.width = right - editor.point.x;
      editor.height = bottom - editor.point.y;
    } else {
      editor.width = Math.max(
        0.12,
        Math.min(1 - editor.point.x, resize.width + deltaX)
      );
      editor.height = Math.max(
        0.045,
        Math.min(1 - editor.point.y, resize.height + deltaY)
      );
    }
    updateTextEditorFrame(editor);
  };
  const finish = (event) => {
    if (resize?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener('pointermove', update, true);
    document.removeEventListener('pointerup', finish, true);
    document.removeEventListener('pointercancel', finish, true);
    resize = null;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
  };
  handle.addEventListener('pointerdown', (event) => {
    const editor = activeTextEditor;
    const page = editor && pageElements.get(editor.pageIndex);
    if (!editor || !page || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    resize = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      point: { ...editor.point },
      width: editor.width,
      height: editor.height,
    };
    document.addEventListener('pointermove', update, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  });
};

const updateTextElementFrame = (element, item) => {
  element.style.left = `${item.x * 100}%`;
  element.style.top = `${item.y * 100}%`;
  element.style.width = `${item.width * 100}%`;
  element.style.height = `${item.height * 100}%`;
};

const closestPageAtClientPoint = (clientX, clientY) =>
  [...pageElements.entries()]
    .map(([pageIndex, page]) => {
      const rect = page.wrapper.getBoundingClientRect();
      const verticalDistance =
        clientY < rect.top
          ? rect.top - clientY
          : clientY > rect.bottom
            ? clientY - rect.bottom
            : 0;
      const horizontalDistance =
        clientX < rect.left
          ? rect.left - clientX
          : clientX > rect.right
            ? clientX - rect.right
            : 0;
      return {
        pageIndex,
        page,
        rect,
        distance: verticalDistance * 4 + horizontalDistance,
      };
    })
    .sort((left, right) => left.distance - right.distance)[0] || null;

const updateTextTransform = (interaction, clientX, clientY, element) => {
  const page = pageElements.get(interaction.currentPageIndex);
  if (!page) return;
  const movedPixels = Math.hypot(
    clientX - interaction.startClientX,
    clientY +
      window.scrollY -
      interaction.startClientY -
      interaction.startScrollY
  );
  if (!interaction.changed && movedPixels < 4) return;
  interaction.changed = true;
  const item = annotations.find(
    (candidate) => candidate.id === interaction.original.id
  );
  if (!item) return;

  if (interaction.mode === 'move') {
    const target = closestPageAtClientPoint(clientX, clientY);
    if (!target) return;
    if (target.pageIndex !== interaction.currentPageIndex) {
      const previousPage = pageElements.get(interaction.currentPageIndex);
      if (!previousPage) return;
      const widthPixels = item.width * previousPage.cssWidth;
      const heightPixels = item.height * previousPage.cssHeight;
      item.pageIndex = target.pageIndex;
      item.width = Math.max(
        0.12,
        Math.min(0.88, widthPixels / target.page.cssWidth)
      );
      item.height = Math.max(
        0.045,
        Math.min(0.9, heightPixels / target.page.cssHeight)
      );
      interaction.currentPageIndex = target.pageIndex;
    }
    const activePage = pageElements.get(interaction.currentPageIndex);
    if (!activePage) return;
    const rect = activePage.wrapper.getBoundingClientRect();
    const localX = (clientX - rect.left) / Math.max(1, rect.width);
    const localY = (clientY - rect.top) / Math.max(1, rect.height);
    item.x = Math.max(
      0,
      Math.min(1 - item.width, localX - interaction.grabRatioX * item.width)
    );
    item.y = Math.max(
      0,
      Math.min(1 - item.height, localY - interaction.grabRatioY * item.height)
    );
    const widthPixels = item.width * activePage.cssWidth;
    const heightPixels = item.height * activePage.cssHeight;
    interaction.ghost.style.left = `${
      clientX - interaction.grabRatioX * widthPixels
    }px`;
    interaction.ghost.style.top = `${
      clientY - interaction.grabRatioY * heightPixels
    }px`;
    interaction.ghost.style.width = `${widthPixels}px`;
    interaction.ghost.style.height = `${heightPixels}px`;
  } else {
    const rect = page.textLayer.getBoundingClientRect();
    const deltaX =
      (clientX - interaction.startClientX) / Math.max(1, rect.width);
    const deltaY =
      (clientY - interaction.startClientY) / Math.max(1, rect.height);
    if (interaction.mode === 'resize-top-left') {
      const right = interaction.original.x + interaction.original.width;
      const bottom = interaction.original.y + interaction.original.height;
      item.x = Math.max(
        0,
        Math.min(right - 0.12, interaction.original.x + deltaX)
      );
      item.y = Math.max(
        0,
        Math.min(bottom - 0.045, interaction.original.y + deltaY)
      );
      item.width = right - item.x;
      item.height = bottom - item.y;
    } else {
      item.width = Math.max(
        0.12,
        Math.min(1 - item.x, interaction.original.width + deltaX)
      );
      item.height = Math.max(
        0.045,
        Math.min(1 - item.y, interaction.original.height + deltaY)
      );
    }
  }
  if (interaction.mode !== 'move') {
    updateTextElementFrame(element, item);
  }
};

const bindTextInteraction = (pageIndex, element, itemId) => {
  let interaction = null;

  element.addEventListener('pointerdown', (event) => {
    if (event.button > 0 || exploreMode || annotationTool !== 'hand') return;
    if (event.target.closest('.text-delete')) return;
    const item = annotations.find(
      (candidate) => candidate.id === itemId && candidate.type === 'text'
    );
    if (!item) return;
    const page = pageElements.get(item.pageIndex);
    if (!page) return;
    event.preventDefault();
    event.stopPropagation();
    closeTextEditor(true);
    const wasSelected = selectedTextId === item.id;
    if (!wasSelected) {
      pageElements.forEach(({ textLayer }) => {
        textLayer
          .querySelector('.text-annotation.is-selected')
          ?.classList.remove('is-selected');
      });
      selectedTextId = item.id;
      element.classList.add('is-selected');
      postTextSelectionState(item);
    }
    const resizeCorner = event.target.closest('[data-resize]')?.dataset.resize;
    const start = pointForEvent(event, page.textLayer);
    element.setPointerCapture(event.pointerId);
    interaction = {
      pointerId: event.pointerId,
      initialPageIndex: item.pageIndex,
      currentPageIndex: item.pageIndex,
      mode:
        resizeCorner === 'top-left'
          ? 'resize-top-left'
          : resizeCorner === 'bottom-right'
            ? 'resize-bottom-right'
            : 'move',
      start,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollY: window.scrollY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      grabRatioX: Math.max(
        0,
        Math.min(1, (start.x - item.x) / Math.max(0.001, item.width))
      ),
      grabRatioY: Math.max(
        0,
        Math.min(1, (start.y - item.y) / Math.max(0.001, item.height))
      ),
      original: cloneItems([item])[0],
      baseItems: cloneItems(annotations),
      changed: false,
      wasSelected,
      element,
    };
    if (interaction.mode === 'move') {
      const elementRect = element.getBoundingClientRect();
      const ghost = element.cloneNode(true);
      ghost.classList.add('text-drag-ghost');
      ghost.removeAttribute('data-annotation-id');
      ghost.style.position = 'fixed';
      ghost.style.left = `${elementRect.left}px`;
      ghost.style.top = `${elementRect.top}px`;
      ghost.style.width = `${elementRect.width}px`;
      ghost.style.height = `${elementRect.height}px`;
      document.body.append(ghost);
      element.style.opacity = '0';
      interaction.ghost = ghost;
      const autoScroll = () => {
        if (!interaction) return;
        const edgeSize = 76;
        let speed = 0;
        if (interaction.lastClientY < edgeSize) {
          speed = -Math.min(
            18,
            Math.max(5, (edgeSize - interaction.lastClientY) * 0.24)
          );
        } else if (interaction.lastClientY > window.innerHeight - edgeSize) {
          speed = Math.min(
            18,
            Math.max(
              5,
              (interaction.lastClientY - (window.innerHeight - edgeSize)) * 0.24
            )
          );
        }
        if (speed !== 0) {
          window.scrollBy(0, speed);
          updateTextTransform(
            interaction,
            interaction.lastClientX,
            interaction.lastClientY,
            interaction.element
          );
        }
        interaction.autoScrollFrame = requestAnimationFrame(autoScroll);
      };
      interaction.autoScrollFrame = requestAnimationFrame(autoScroll);
    }
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  });

  const move = (event) => {
    if (interaction?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    interaction.lastClientX = event.clientX;
    interaction.lastClientY = event.clientY;
    updateTextTransform(
      interaction,
      event.clientX,
      event.clientY,
      interaction.element
    );
  };

  const finish = (event) => {
    if (interaction?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', finish, true);
    document.removeEventListener('pointercancel', finish, true);
    const completed = interaction;
    interaction = null;
    if (completed.autoScrollFrame) {
      cancelAnimationFrame(completed.autoScrollFrame);
    }
    completed.ghost?.remove();
    completed.element.style.opacity = '';
    if (completed.element.hasPointerCapture(event.pointerId)) {
      completed.element.releasePointerCapture(event.pointerId);
    }
    if (event.type === 'pointercancel') {
      annotations = completed.baseItems;
      renderTextAnnotations(completed.initialPageIndex);
      if (completed.currentPageIndex !== completed.initialPageIndex) {
        renderTextAnnotations(completed.currentPageIndex);
      }
      return;
    }
    if (completed.changed) {
      undoStack.push(completed.baseItems);
      if (undoStack.length > 80) undoStack.shift();
      redoStack = [];
      renderTextAnnotations(completed.initialPageIndex);
      if (completed.currentPageIndex !== completed.initialPageIndex) {
        renderTextAnnotations(completed.currentPageIndex);
      }
      notifyAnnotationsChanged();
      return;
    }
    if (completed.wasSelected && completed.mode === 'move') {
      const item = annotations.find((candidate) => candidate.id === itemId);
      if (item) {
        beginTextEdit(
          item.pageIndex,
          { x: item.x + item.width / 2, y: item.y + item.height / 2 },
          { existingId: item.id }
        );
      }
    }
  };

};

const distanceToSegment = (point, start, end, width, height) => {
  const px = point.x * width;
  const py = point.y * height;
  const ax = start.x * width;
  const ay = start.y * height;
  const bx = end.x * width;
  const by = end.y * height;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy));
};

const annotationHitAtPoint = (item, point, page) => {
  if (item.type === 'text') {
    return (
      point.x >= item.x - 0.02 &&
      point.x <= item.x + item.width + 0.02 &&
      point.y >= item.y - 0.02 &&
      point.y <= item.y + item.height + 0.02
    );
  }
  const tolerance = Math.max(14, item.width * page.cssWidth + 10);
  if (item.points.length === 1) {
    return (
      Math.hypot(
        (point.x - item.points[0].x) * page.cssWidth,
        (point.y - item.points[0].y) * page.cssHeight
      ) <= tolerance
    );
  }
  for (let index = 0; index < item.points.length - 1; index += 1) {
    if (
      distanceToSegment(
        point,
        item.points[index],
        item.points[index + 1],
        page.cssWidth,
        page.cssHeight
      ) <= tolerance
    ) {
      return true;
    }
  }
  return false;
};

const eraseAtPoint = (pageIndex, point) => {
  const page = pageElements.get(pageIndex);
  if (!page) return false;
  const beforeLength = annotations.length;
  annotations = annotations.filter(
    (item) =>
      item.pageIndex !== pageIndex || !annotationHitAtPoint(item, point, page)
  );
  if (annotations.length === beforeLength) return false;
  if (
    selectedTextId &&
    !annotations.some((item) => item.id === selectedTextId)
  ) {
    selectedTextId = null;
  }
  renderAnnotationPage(pageIndex);
  return true;
};

const drawTextIntoCapture = (
  context,
  pageIndex,
  sourceX,
  sourceY,
  pixelRatio,
  cssWidth,
  cssHeight
) => {
  annotations
    .filter((item) => item.pageIndex === pageIndex && item.type === 'text')
    .forEach((item) => {
      const lines = String(item.text).split('\n');
      const fontSize = Math.max(12, item.fontSize * cssWidth) * pixelRatio;
      const x = item.x * cssWidth * pixelRatio - sourceX;
      const y = item.y * cssHeight * pixelRatio - sourceY;
      const lineHeight = fontSize * 1.35;
      context.save();
      context.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const width = Math.max(
        ...lines.map((line) => context.measureText(line || ' ').width)
      );
      if (item.hasBackground !== false) {
        context.fillStyle = 'rgba(255,255,255,.88)';
        context.fillRect(
          x - 4,
          y - 3,
          width + 8,
          lineHeight * lines.length + 4
        );
      }
      context.fillStyle = item.color;
      context.textBaseline = 'top';
      lines.forEach((line, index) => {
        context.fillText(line, x, y + index * lineHeight);
      });
      context.restore();
    });
};

const captureSelection = (pageIndex, start, end) => {
  closeTextEditor(true);
  const page = pageElements.get(pageIndex);
  if (!page?.rendered) return;
  const { canvas, annotationCanvas, cssWidth, cssHeight, pixelRatio } = page;
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
  context.drawImage(
    annotationCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );
  drawTextIntoCapture(
    context,
    pageIndex,
    sourceX,
    sourceY,
    pixelRatio,
    cssWidth,
    cssHeight
  );
  post('exploreCapture', {
    dataUrl: output.toDataURL('image/jpeg', 0.88),
    pageNumber: pageIndex + 1,
    width: Math.round(sourceWidth / pixelRatio),
    height: Math.round(sourceHeight / pixelRatio),
  });
};

const bindInteraction = (pageIndex, layer, selectionBox) => {
  let selection = null;
  let drawing = null;
  let erasing = null;

  layer.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    const point = pointForEvent(event, layer);
    if (exploreMode) {
      event.preventDefault();
      layer.setPointerCapture(event.pointerId);
      selection = { pointerId: event.pointerId, start: point, end: point };
      paintSelection(selectionBox, point, point);
      return;
    }
    if (annotationTool === 'hand') return;
    event.preventDefault();
    if (annotationTool === 'text') {
      closeTextEditor(true);
      annotationTool = 'hand';
      updateBodyMode();
      beginTextEdit(pageIndex, point, { forceNew: true });
      return;
    }
    closeTextEditor(true);
    layer.setPointerCapture(event.pointerId);
    if (annotationTool === 'pen' || annotationTool === 'highlighter') {
      drawing = {
        pointerId: event.pointerId,
        item: {
          id: createId(),
          type: annotationTool,
          pageIndex,
          points: [point],
          color: annotationConfig.color,
          width: annotationConfig.width,
          opacity: annotationTool === 'highlighter' ? 0.38 : 1,
        },
      };
      renderAnnotationPage(pageIndex, drawing.item);
    } else if (annotationTool === 'eraser') {
      erasing = {
        pointerId: event.pointerId,
        baseItems: cloneItems(annotations),
        changed: eraseAtPoint(pageIndex, point),
      };
    }
  });

  layer.addEventListener('pointermove', (event) => {
    if (selection?.pointerId === event.pointerId) {
      event.preventDefault();
      selection.end = pointForEvent(event, layer);
      paintSelection(selectionBox, selection.start, selection.end);
      return;
    }
    if (drawing?.pointerId === event.pointerId) {
      event.preventDefault();
      const point = pointForEvent(event, layer);
      const previous = drawing.item.points[drawing.item.points.length - 1];
      const page = pageElements.get(pageIndex);
      if (
        page &&
        Math.hypot(
          (point.x - previous.x) * page.cssWidth,
          (point.y - previous.y) * page.cssHeight
        ) >= 1.2
      ) {
        drawing.item.points.push(point);
        renderAnnotationPage(pageIndex, drawing.item);
      }
      return;
    }
    if (erasing?.pointerId === event.pointerId) {
      event.preventDefault();
      erasing.changed =
        eraseAtPoint(pageIndex, pointForEvent(event, layer)) || erasing.changed;
      return;
    }
  });

  const finish = (event) => {
    if (
      selection?.pointerId !== event.pointerId &&
      drawing?.pointerId !== event.pointerId &&
      erasing?.pointerId !== event.pointerId
    ) {
      return;
    }
    if (layer.hasPointerCapture(event.pointerId)) {
      layer.releasePointerCapture(event.pointerId);
    }
    if (selection?.pointerId === event.pointerId) {
      const completed = selection;
      selection = null;
      selectionBox.style.display = 'none';
      if (event.type !== 'pointercancel') {
        captureSelection(pageIndex, completed.start, completed.end);
      }
    }
    if (drawing?.pointerId === event.pointerId) {
      const completed = drawing;
      drawing = null;
      if (event.type === 'pointercancel') {
        renderAnnotationPage(pageIndex);
      } else {
        commitItems([...annotations, completed.item]);
      }
    }
    if (erasing?.pointerId === event.pointerId) {
      const completed = erasing;
      erasing = null;
      if (event.type === 'pointercancel') {
        annotations = completed.baseItems;
        renderAnnotationPage(pageIndex);
      } else if (completed.changed) {
        undoStack.push(completed.baseItems);
        if (undoStack.length > 80) undoStack.shift();
        redoStack = [];
        notifyAnnotationsChanged();
      }
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
  const annotationCanvas = document.createElement('canvas');
  annotationCanvas.className = 'annotation-canvas';
  const textLayer = document.createElement('div');
  textLayer.className = 'annotation-text-layer';
  const selectionLayer = document.createElement('div');
  selectionLayer.className = 'selection-layer';
  const selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  selectionLayer.append(selectionBox);
  wrapper.append(canvas, annotationCanvas, textLayer, selectionLayer);
  bindInteraction(pageIndex, selectionLayer, selectionBox);
  return {
    wrapper,
    canvas,
    annotationCanvas,
    textLayer,
    selectionLayer,
    selectionBox,
    rendered: false,
  };
};

const renderPage = async (pageIndex, generation) => {
  const page = pageElements.get(pageIndex);
  if (!pdfDocument || !page || page.rendered || page.rendering) return;
  page.rendering = true;
  let pdfPage = null;
  let renderCanvas = null;
  const preserveExisting =
    page.preserveCanvas === true && page.canvas.width > 1;
  page.preserveCanvas = false;
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
    const pixelRatio = getRenderPixelRatio(cssWidth, cssHeight);
    renderCanvas = preserveExisting
      ? document.createElement('canvas')
      : page.canvas;
    renderCanvas.className = 'pdf-canvas';
    renderCanvas.style.width = `${cssWidth}px`;
    renderCanvas.style.height = `${cssHeight}px`;
    renderCanvas.width = Math.round(cssWidth * pixelRatio);
    renderCanvas.height = Math.round(cssHeight * pixelRatio);
    const renderTask = pdfPage.render({
      canvasContext: renderCanvas.getContext('2d'),
      viewport,
      transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
    });
    page.renderTask = renderTask;
    await renderTask.promise;
    if (generation !== renderGeneration) return;
    if (preserveExisting) {
      const previousCanvas = page.canvas;
      previousCanvas.replaceWith(renderCanvas);
      page.canvas = renderCanvas;
      previousCanvas.width = 1;
      previousCanvas.height = 1;
    }
    page.pixelRatio = pixelRatio;
    page.cssWidth = cssWidth;
    page.cssHeight = cssHeight;
    page.rendered = true;
    page.rendering = false;
    page.renderTask = null;
    page.wrapper.classList.add('is-rendered');
    renderAnnotationPage(pageIndex);
    if (page.refreshAfterRender) {
      page.refreshAfterRender = false;
      page.rendered = false;
      page.preserveCanvas = true;
      queuePageRender(pageIndex);
    }
    if (!documentReadyPosted && pageIndex === 0) {
      documentReadyPosted = true;
      emptyState.hidden = true;
      post('documentLoaded', { totalPages: pdfDocument.numPages });
    }
  } catch (error) {
    page.rendering = false;
    page.renderTask = null;
    page.rendered = preserveExisting;
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
    if (renderCanvas && renderCanvas !== page.canvas) {
      renderCanvas.width = 1;
      renderCanvas.height = 1;
    }
  }
};

const releasePage = (pageIndex) => {
  const page = pageElements.get(pageIndex);
  if (
    !page ||
    (!page.rendered && !page.rendering && !page.preserveCanvas)
  ) {
    return;
  }
  page.renderTask?.cancel();
  page.renderTask = null;
  page.rendered = false;
  page.rendering = false;
  page.preserveCanvas = false;
  page.refreshAfterRender = false;
  page.wrapper.classList.remove('is-rendered');
  page.canvas.width = 1;
  page.canvas.height = 1;
  page.annotationCanvas.width = 1;
  page.annotationCanvas.height = 1;
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
  closeTextEditor(true);
  const generation = ++renderGeneration;
  pendingPageRenders.clear();
  renderedViewportWidth = getTargetWidth();
  pageObserver?.disconnect();
  pagesRoot.replaceChildren();
  pageElements.clear();
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
      pixelRatio: getRenderPixelRatio(
        renderedViewportWidth,
        placeholderHeight
      ),
      rendering: false,
      preserveCanvas: false,
      refreshAfterRender: false,
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
    { rootMargin: '600px 0px' }
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
    pdfRangeTransport?.abort();
    pdfRangeTransport = null;
    if (pdfLoadingTask && !pdfDocument) await pdfLoadingTask.destroy();
    if (pdfDocument) await pdfDocument.destroy();
    pdfDocument = null;
    pdfLoadingTask = pdfjsLib.getDocument({ data: bytes });
    pdfDocument = await pdfLoadingTask.promise;
    await renderDocument();
  } catch (error) {
    emptyState.textContent = 'PDF 文件无法打开';
    post('documentError', {
      message: error instanceof Error ? error.message : 'PDF 文件无法解析',
    });
  }
};

const loadPdfRange = async (totalBytes, initialBytes, rangeChunkSize) => {
  try {
    emptyState.hidden = false;
    emptyState.textContent = '正在打开首页，其他页面后台加载中…';
    documentReadyPosted = false;
    pageObserver?.disconnect();
    pdfRangeTransport?.abort();
    if (pdfLoadingTask && !pdfDocument) await pdfLoadingTask.destroy();
    if (pdfDocument) await pdfDocument.destroy();
    pdfDocument = null;

    const transport = new pdfjsLib.PDFDataRangeTransport(
      totalBytes,
      initialBytes,
      false
    );
    transport.requestDataRange = (begin, end) => {
      post('pdf-range-request', { begin, end });
    };
    transport.abort = () => {
      if (pdfRangeTransport === transport) pdfRangeTransport = null;
    };
    pdfRangeTransport = transport;
    pdfLoadingTask = pdfjsLib.getDocument({
      range: transport,
      rangeChunkSize,
      disableStream: true,
      disableAutoFetch: true,
    });
    pdfDocument = await pdfLoadingTask.promise;
    if (pdfRangeTransport !== transport) return;
    await renderDocument();
  } catch (error) {
    emptyState.textContent = 'PDF 文件无法打开';
    post('documentError', {
      message: error instanceof Error ? error.message : 'PDF 分段加载失败',
    });
  }
};

const updateBodyMode = () => {
  document.body.classList.toggle('explore-mode', exploreMode);
  document.body.classList.toggle(
    'annotation-active',
    !exploreMode && annotationTool !== 'hand'
  );
  document.body.dataset.annotationTool = annotationTool;
};

const applySelectedTextConfig = () => {
  if (activeTextEditor) {
    const editorPage = pageElements.get(activeTextEditor.pageIndex);
    if (!editorPage) return;
    activeTextEditor.color = annotationConfig.color;
    activeTextEditor.fontSize = annotationConfig.fontSize;
    activeTextEditor.hasBackground = annotationConfig.hasBackground;
    activeTextEditor.element.style.color = annotationConfig.color;
    activeTextEditor.element.style.fontSize = `${Math.max(
      12,
      annotationConfig.fontSize * editorPage.cssWidth
    )}px`;
    activeTextEditor.shell.classList.toggle(
      'has-background',
      annotationConfig.hasBackground
    );
    postTextConfigState(activeTextEditor);
    return;
  }
  if (!selectedTextId) return;
  const current = annotations.find((item) => item.id === selectedTextId);
  if (
    !current ||
    current.type !== 'text' ||
    (current.color === annotationConfig.color &&
      Math.abs(current.fontSize - annotationConfig.fontSize) < 0.0001 &&
      current.hasBackground === annotationConfig.hasBackground)
  ) {
    return;
  }
  const previous = cloneItems(annotations);
  const next = cloneItems(annotations);
  const item = next.find((candidate) => candidate.id === selectedTextId);
  if (!item) return;
  item.color = annotationConfig.color;
  item.fontSize = annotationConfig.fontSize;
  item.hasBackground = annotationConfig.hasBackground;
  const itemPage = pageElements.get(item.pageIndex);
  if (itemPage) {
    item.height = Math.max(
      item.height,
      measureTextBoxHeight(item.text, item.width, item.fontSize, itemPage)
    );
    item.y = Math.min(item.y, 1 - item.height);
  }
  commitItems(next, previous);
  postTextSelectionState(item);
};

const applyAnnotationConfig = (config) => {
  if (!config || typeof config !== 'object') return;
  annotationConfig = {
    color:
      typeof config.color === 'string'
        ? config.color
        : annotationConfig.color,
    width: Math.max(
      0.0015,
      Math.min(0.03, Number(config.width) || annotationConfig.width)
    ),
    fontSize: Math.max(
      0.014,
      Math.min(0.045, Number(config.fontSize) || annotationConfig.fontSize)
    ),
    hasBackground:
      typeof config.hasBackground === 'boolean'
        ? config.hasBackground
        : annotationConfig.hasBackground,
  };
};

const insertTextIntoVisiblePage = (rawText) => {
  const text = String(rawText || '').trim().slice(0, 2000);
  if (!text) return;
  const viewportCenter = window.innerHeight * 0.38;
  const candidates = [...pageElements.entries()]
    .filter(([, page]) => page.rendered)
    .sort(([, left], [, right]) => {
      const leftRect = left.wrapper.getBoundingClientRect();
      const rightRect = right.wrapper.getBoundingClientRect();
      const leftDistance = Math.abs(
        (leftRect.top + leftRect.bottom) / 2 - viewportCenter
      );
      const rightDistance = Math.abs(
        (rightRect.top + rightRect.bottom) / 2 - viewportCenter
      );
      return leftDistance - rightDistance;
    });
  const target = candidates[0];
  if (!target) return;
  const [pageIndex, page] = target;
  const rect = page.wrapper.getBoundingClientRect();
  const width = Math.min(
    0.62,
    Math.max(0.26, text.length * annotationConfig.fontSize * 0.55)
  );
  const height = measureTextBoxHeight(
    text,
    width,
    annotationConfig.fontSize,
    page
  );
  const x = Math.min(0.1, 1 - width);
  const y = Math.max(
    0.06,
    Math.min(
      1 - height,
      (viewportCenter - rect.top) / Math.max(1, rect.height)
    )
  );
  annotationTool = 'hand';
  updateBodyMode();
  const item = {
    id: createId(),
    type: 'text',
    pageIndex,
    x,
    y,
    text,
    color: annotationConfig.color,
    fontSize: annotationConfig.fontSize,
    hasBackground: annotationConfig.hasBackground,
    width,
    height,
  };
  commitItems([...annotations, item]);
  selectText(item);
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
  } else if (message.type === 'pdf-range-start') {
    const totalBytes = Number(message.totalBytes) || 0;
    const rangeChunkSize = Math.max(
      64 * 1024,
      Number(message.rangeChunkSize) || 256 * 1024
    );
    const initialBytes = decodeBase64(message.data);
    if (totalBytes <= initialBytes.length) {
      void loadPdfBytes(initialBytes);
      return;
    }
    void loadPdfRange(totalBytes, initialBytes, rangeChunkSize);
  } else if (message.type === 'pdf-range-data') {
    if (!pdfRangeTransport) return;
    const begin = Math.max(0, Number(message.begin) || 0);
    pdfRangeTransport.onDataRange(begin, decodeBase64(message.data));
  } else if (message.type === 'pdf-range-error') {
    pdfRangeTransport?.abort();
    void pdfLoadingTask?.destroy();
    pdfLoadingTask = null;
    post('documentError', {
      message: message.message || 'PDF 后台加载失败，请重试',
    });
  } else if (message.type === 'exploreMode') {
    exploreMode = message.enabled === true;
    if (exploreMode) {
      closeTextEditor(true);
      selectText(null);
    }
    updateBodyMode();
    pageElements.forEach(({ selectionBox }) => {
      selectionBox.style.display = 'none';
    });
  } else if (message.type === 'annotationTool') {
    if (!validTools.has(message.tool)) return;
    if (message.tool !== 'hand') {
      closeTextEditor(true);
      selectText(null);
    }
    annotationTool = message.tool;
    applyAnnotationConfig(message.config);
    updateBodyMode();
    renderAllAnnotations();
  } else if (message.type === 'annotationState') {
    closeTextEditor(false);
    selectedTextId = null;
    annotations = normalizeAnnotationDocument(message.document);
    undoStack = [];
    redoStack = [];
    renderAllAnnotations();
    notifyHistory();
  } else if (message.type === 'annotationCommand') {
    if (message.command === 'undo') {
      closeTextEditor(true);
      undo();
    }
    if (message.command === 'redo') {
      closeTextEditor(true);
      redo();
    }
    if (message.command === 'insertText') {
      closeTextEditor(true);
      applyAnnotationConfig(message.config);
      insertTextIntoVisiblePage(message.text);
    }
    if (message.command === 'clearTextSelection') {
      closeTextEditor(true);
      selectText(null);
    }
    if (message.command === 'updateSelectedTextConfig') {
      applyAnnotationConfig(message.config);
      applySelectedTextConfig();
    }
  } else if (message.type === 'readerInsets') {
    const top = Math.max(0, Number(message.top) || 0);
    const bottom = Math.max(0, Number(message.bottom) || 0);
    document.documentElement.style.setProperty('--reader-top-inset', `${top}px`);
    document.documentElement.style.setProperty(
      '--reader-bottom-inset',
      `${bottom}px`
    );
  }
};

pagesRoot.addEventListener('pointerdown', (event) => {
  if (
    exploreMode ||
    annotationTool !== 'hand' ||
    !selectedTextId ||
    event.target.closest('.text-annotation, .text-editor')
  ) {
    return;
  }
  closeTextEditor(true);
  selectText(null);
});

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

let visualViewportScale = getVisualViewportScale();
let visualViewportTimer = 0;
window.visualViewport?.addEventListener('resize', () => {
  window.clearTimeout(visualViewportTimer);
  visualViewportTimer = window.setTimeout(() => {
    const nextScale = getVisualViewportScale();
    if (!pdfDocument || Math.abs(nextScale - visualViewportScale) < 0.08) {
      return;
    }
    visualViewportScale = nextScale;
    pageElements.forEach((page, pageIndex) => {
      const rect = page.wrapper.getBoundingClientRect();
      if (rect.bottom < -300 || rect.top > window.innerHeight + 300) return;
      if (page.rendering) {
        page.refreshAfterRender = true;
        return;
      }
      if (!page.rendered) return;
      page.rendered = false;
      page.preserveCanvas = true;
      queuePageRender(pageIndex);
    });
  }, 180);
});

updateBodyMode();
post('ready');
