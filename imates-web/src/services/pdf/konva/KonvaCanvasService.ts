import Konva from 'konva'

// 绘制对象类型定义（与 PdfPage.vue 保持一致）
export interface DrawObject {
  type: 'path' | 'rectangle' | 'circle' | 'line' | 'triangle' | 'text'
  color: string
  lineWidth: number
  points?: { x: number; y: number }[]
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  text?: string
  fontSize?: number
  opacity?: number
  rawPoints?: { x: number; y: number }[]
}

// 工具配置
export interface DrawingConfig {
  penColor: string
  penWidth: number
  highlighterColor: string
  highlighterWidth: number
  highlighterOpacity: number
  eraserSize: number
  eraserMode?: 'stroke' | 'pixel'
  screenshotShape?: 'rectangle' | 'polygon'
  screenshotStrokeColor?: string
  screenshotFillColor?: string
  screenshotStrokeWidth?: number
  selectMode?: 'rectangle' | 'freeform'
}

// 事件回调
export interface KonvaCanvasCallbacks {
  onDataChange?: () => void
  onObjectSelected?: (objects: Konva.Node[]) => void
  onScreenshotCaptured?: (blob: Blob) => void
}

/**
 * Konva Canvas 服务类
 * 封装 Konva.js 的 Stage 和 Layer 管理，提供绘制功能
 */
export class KonvaCanvasService {
  private stage: Konva.Stage | null = null
  private layer: Konva.Layer | null = null
  private transformer: Konva.Transformer | null = null
  
  // 当前工具模式
  private currentTool: string = 'none'
  private config: DrawingConfig
  
  // 回调函数
  private callbacks: KonvaCanvasCallbacks = {}
  
  // 当前绘制状态
  private currentLine: Konva.Line | null = null
  private linePoints: number[] = []
  private isDrawing: boolean = false
  private startPoint: { x: number; y: number } | null = null
  
  // 截图状态
  private screenshotRect: Konva.Rect | null = null
  private screenshotPath: Konva.Line | null = null
  private screenshotPoints: { x: number; y: number }[] = []
  private isScreenshotDrawing: boolean = false
  
  // 选择状态
  private selectionBox: Konva.Rect | null = null
  private selectedNodes: Konva.Node[] = []
  
  // 触摸手势状态
  private touchState: {
    isTwoFinger: boolean
    initialDistance: number
    initialScale: number
    initialCenter: { x: number; y: number }
    initialPosition: { x: number; y: number }
  } = {
    isTwoFinger: false,
    initialDistance: 0,
    initialScale: 1,
    initialCenter: { x: 0, y: 0 },
    initialPosition: { x: 0, y: 0 },
  }

  constructor(config: DrawingConfig, callbacks?: KonvaCanvasCallbacks) {
    this.config = config
    this.callbacks = callbacks || {}
  }

  /**
   * 初始化 Konva Stage
   */
  init(container: HTMLElement, width: number, height: number, scale: number = 1.0): void {
    // 第1步：创建 Stage
    this.stage = new Konva.Stage({
      container: container,
      width: width,
      height: height,
      scaleX: scale,
      scaleY: scale,
    })

    // 第2步：创建 Layer
    this.layer = new Konva.Layer()
    this.stage.add(this.layer)

    // 第3步：创建 Transformer（用于选择和变换）
    this.transformer = new Konva.Transformer({
      nodes: [],
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      rotateAnchorOffset: 20,
      borderStroke: '#2196F3',
      borderStrokeWidth: 2,
      anchorFill: '#2196F3',
      anchorStroke: '#fff',
      anchorStrokeWidth: 2,
      anchorSize: 8,
    })
    this.layer.add(this.transformer)
    this.transformer.moveToTop()

    // 第4步：绑定事件
    this.bindEvents()

    // 第5步：触发初始绘制
    this.layer.batchDraw()
  }

  /**
   * 绑定事件监听器
   */
  private bindEvents(): void {
    if (!this.stage || !this.layer) return

    // 鼠标/触摸按下
    this.stage.on('mousedown touchstart', (e) => {
      const pos = this.getKonvaPosition(e.evt)
      if (!pos) return

      this.handlePointerDown(pos, e.evt)
    })

    // 鼠标/触摸移动
    this.stage.on('mousemove touchmove', (e) => {
      const pos = this.getKonvaPosition(e.evt)
      if (!pos) return

      this.handlePointerMove(pos, e.evt)
    })

    // 鼠标/触摸抬起
    this.stage.on('mouseup touchend', (e) => {
      this.handlePointerUp(e.evt)
    })

    // 鼠标离开画布
    this.stage.on('mouseleave', () => {
      this.handlePointerUp(new MouseEvent('mouseup'))
    })

    // Transformer 变换事件
    this.transformer?.on('transformend', () => {
      this.onDataChange()
    })
  }

  /**
   * 获取 Konva 坐标位置
   */
  private getKonvaPosition(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
    if (!this.stage) return null

    const pointerPos = this.stage.getPointerPosition()
    if (!pointerPos) return null

    // 考虑 Stage 的 scale
    return {
      x: pointerPos.x / (this.stage.scaleX() || 1),
      y: pointerPos.y / (this.stage.scaleY() || 1),
    }
  }

  /**
   * 处理指针按下事件
   */
  private handlePointerDown(pos: { x: number; y: number }, e: MouseEvent | TouchEvent): void {
    this.startPoint = pos
    this.isDrawing = true

    switch (this.currentTool) {
      case 'pen':
        this.handlePenStart(pos)
        break
      case 'highlighter':
        this.handleHighlighterStart(pos)
        break
      case 'eraser':
        this.handleEraser(pos)
        break
      case 'screenshot':
        this.handleScreenshotStart(pos)
        break
      case 'select':
        this.handleSelectStart(pos, e)
        break
    }
  }

  /**
   * 处理指针移动事件
   */
  private handlePointerMove(pos: { x: number; y: number }, e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing && this.currentTool !== 'eraser') return

    switch (this.currentTool) {
      case 'pen':
        this.handlePenMove(pos)
        break
      case 'highlighter':
        this.handleHighlighterMove(pos)
        break
      case 'eraser':
        this.handleEraser(pos)
        break
      case 'screenshot':
        this.handleScreenshotMove(pos)
        break
      case 'select':
        this.handleSelectMove(pos)
        break
    }
  }

  /**
   * 处理指针抬起事件
   */
  private handlePointerUp(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing) return

    switch (this.currentTool) {
      case 'pen':
        this.handlePenEnd()
        break
      case 'highlighter':
        this.handleHighlighterEnd()
        break
      case 'screenshot':
        this.handleScreenshotEnd()
        break
      case 'select':
        this.handleSelectEnd()
        break
    }

    this.isDrawing = false
    this.startPoint = null
  }

  /**
   * 签字笔模式：开始绘制
   */
  private handlePenStart(pos: { x: number; y: number }): void {
    this.currentLine = new Konva.Line({
      points: [pos.x, pos.y],
      stroke: this.config.penColor,
      strokeWidth: this.config.penWidth,
      lineCap: 'round',
      lineJoin: 'round',
      tension: 0.5, // 平滑曲线
      name: 'annotation',
    })

    this.layer?.add(this.currentLine)
    this.linePoints = [pos.x, pos.y]
  }

  /**
   * 签字笔模式：移动绘制
   */
  private handlePenMove(pos: { x: number; y: number }): void {
    if (!this.currentLine) return

    this.linePoints.push(pos.x, pos.y)
    this.currentLine.points(this.linePoints)
    this.layer?.batchDraw()
  }

  /**
   * 签字笔模式：结束绘制
   */
  private handlePenEnd(): void {
    if (!this.currentLine || this.linePoints.length < 4) {
      // 点数太少，删除
      this.currentLine?.destroy()
      this.currentLine = null
      this.linePoints = []
      this.layer?.batchDraw()
      return
    }

    // 保存路径对象
    this.currentLine = null
    this.linePoints = []
    this.onDataChange()
  }

  /**
   * 荧光笔模式：开始绘制
   */
  private handleHighlighterStart(pos: { x: number; y: number }): void {
    this.currentLine = new Konva.Line({
      points: [pos.x, pos.y],
      stroke: this.config.highlighterColor,
      strokeWidth: this.config.highlighterWidth,
      opacity: this.config.highlighterOpacity / 100,
      globalCompositeOperation: 'multiply', // 混合模式
      lineCap: 'round',
      lineJoin: 'round',
      tension: 0.5,
      name: 'annotation',
    })

    this.layer?.add(this.currentLine)
    this.linePoints = [pos.x, pos.y]
  }

  /**
   * 荧光笔模式：移动绘制
   */
  private handleHighlighterMove(pos: { x: number; y: number }): void {
    if (!this.currentLine) return

    this.linePoints.push(pos.x, pos.y)
    this.currentLine.points(this.linePoints)
    this.layer?.batchDraw()
  }

  /**
   * 荧光笔模式：结束绘制
   */
  private handleHighlighterEnd(): void {
    if (!this.currentLine || this.linePoints.length < 4) {
      this.currentLine?.destroy()
      this.currentLine = null
      this.linePoints = []
      this.layer?.batchDraw()
      return
    }

    this.currentLine = null
    this.linePoints = []
    this.onDataChange()
  }

  /**
   * 橡皮擦模式：整笔擦除
   */
  private handleEraser(pos: { x: number; y: number }): void {
    if (!this.stage) return

    // 获取点击位置的对象
    const shape = this.stage.getIntersection({ x: pos.x * (this.stage.scaleX() || 1), y: pos.y * (this.stage.scaleY() || 1) })

    if (shape && shape !== this.transformer && shape.name() === 'annotation') {
      // 删除对象
      shape.destroy()

      // 更新 Transformer
      this.updateTransformer()

      // 触发重绘
      this.layer?.batchDraw()

      // 通知数据变化
      this.onDataChange()
    }
  }

  /**
   * 截图模式：开始绘制
   */
  private handleScreenshotStart(pos: { x: number; y: number }): void {
    this.isScreenshotDrawing = true
    this.screenshotPoints = [pos]

    const shapeType = this.config.screenshotShape || 'rectangle'

    if (shapeType === 'rectangle') {
      this.screenshotRect = new Konva.Rect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: this.config.screenshotStrokeColor || '#ff0000',
        fill: this.config.screenshotFillColor || 'rgba(255, 0, 0, 0.1)',
        strokeWidth: this.config.screenshotStrokeWidth || 2,
        name: 'screenshot-temp',
      })
      this.layer?.add(this.screenshotRect)
      this.screenshotRect.moveToTop()
    } else {
      this.screenshotPath = new Konva.Line({
        points: [pos.x, pos.y],
        stroke: this.config.screenshotStrokeColor || '#ff0000',
        fill: this.config.screenshotFillColor || 'rgba(255, 0, 0, 0.1)',
        strokeWidth: this.config.screenshotStrokeWidth || 2,
        closed: false,
        name: 'screenshot-temp',
      })
      this.layer?.add(this.screenshotPath)
      this.screenshotPath.moveToTop()
    }
  }

  /**
   * 截图模式：移动绘制
   */
  private handleScreenshotMove(pos: { x: number; y: number }): void {
    if (!this.isScreenshotDrawing) return

    const shapeType = this.config.screenshotShape || 'rectangle'

    if (shapeType === 'rectangle' && this.screenshotRect) {
      const startX = this.screenshotRect.x()
      const startY = this.screenshotRect.y()

      this.screenshotRect.width(Math.abs(pos.x - startX))
      this.screenshotRect.height(Math.abs(pos.y - startY))

      if (pos.x < startX) this.screenshotRect.x(pos.x)
      if (pos.y < startY) this.screenshotRect.y(pos.y)

      this.layer?.batchDraw()
    } else if (shapeType === 'polygon' && this.screenshotPath) {
      this.screenshotPoints.push(pos)
      const points: number[] = []
      this.screenshotPoints.forEach(p => {
        points.push(p.x, p.y)
      })
      this.screenshotPath.points(points)
      this.layer?.batchDraw()
    }
  }

  /**
   * 截图模式：结束绘制
   */
  private handleScreenshotEnd(): void {
    if (!this.isScreenshotDrawing) return

    // 截图功能需要结合 PDF Canvas，这里先清理临时对象
    // 实际的截图捕获会在外部处理
    this.screenshotRect?.destroy()
    this.screenshotPath?.destroy()
    this.screenshotRect = null
    this.screenshotPath = null
    this.screenshotPoints = []
    this.isScreenshotDrawing = false
    this.layer?.batchDraw()
  }

  /**
   * 选择模式：开始选择
   */
  private handleSelectStart(pos: { x: number; y: number }, e: MouseEvent | TouchEvent): void {
    if (!this.stage) return

    // 获取点击位置的对象
    const shape = this.stage.getIntersection({ x: pos.x * (this.stage.scaleX() || 1), y: pos.y * (this.stage.scaleY() || 1) })

    if (shape && shape !== this.transformer && shape.name() === 'annotation') {
      // 选中对象
      this.selectedNodes = [shape]
      this.transformer?.nodes(this.selectedNodes)
      this.transformer?.moveToTop()
      this.layer?.batchDraw()

      // 触发回调
      this.callbacks.onObjectSelected?.(this.selectedNodes)
    } else {
      // 开始框选
      this.startBoxSelection(pos)
    }
  }

  /**
   * 开始框选
   */
  private startBoxSelection(pos: { x: number; y: number }): void {
    const selectMode = this.config.selectMode || 'rectangle'

    if (selectMode === 'rectangle') {
      this.selectionBox = new Konva.Rect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: '#2196F3',
        fill: 'rgba(33, 150, 243, 0.1)',
        dash: [5, 5],
        strokeWidth: 2,
        name: 'selection-temp',
      })
      this.layer?.add(this.selectionBox)
      this.selectionBox.moveToBottom()
    }
  }

  /**
   * 选择模式：移动
   */
  private handleSelectMove(pos: { x: number; y: number }): void {
    if (this.selectionBox && this.startPoint) {
      this.selectionBox.width(Math.abs(pos.x - this.startPoint.x))
      this.selectionBox.height(Math.abs(pos.y - this.startPoint.y))

      if (pos.x < this.startPoint.x) this.selectionBox.x(pos.x)
      if (pos.y < this.startPoint.y) this.selectionBox.y(pos.y)

      this.layer?.batchDraw()
    }
  }

  /**
   * 选择模式：结束选择
   */
  private handleSelectEnd(): void {
    if (this.selectionBox && this.startPoint) {
      // 查找与选框相交的对象
      const box = this.selectionBox.getClientRect()
      const selected: Konva.Node[] = []

      this.layer?.children.forEach((node) => {
        if (node === this.transformer || node.name() === 'temp' || node.name() === 'screenshot-temp' || node.name() === 'selection-temp') {
          return
        }

        const nodeBox = node.getClientRect()
        if (
          box.x < nodeBox.x + nodeBox.width &&
          box.x + box.width > nodeBox.x &&
          box.y < nodeBox.y + nodeBox.height &&
          box.y + box.height > nodeBox.y
        ) {
          selected.push(node)
        }
      })

      if (selected.length > 0) {
        this.selectedNodes = selected
        this.transformer?.nodes(this.selectedNodes)
        this.transformer?.moveToTop()
        this.callbacks.onObjectSelected?.(this.selectedNodes)
      }

      // 清理选框
      this.selectionBox.destroy()
      this.selectionBox = null
      this.layer?.batchDraw()
    }
  }

  /**
   * 更新 Transformer
   */
  private updateTransformer(): void {
    // 移除已删除的对象
    this.selectedNodes = this.selectedNodes.filter(node => node.isAttached())
    this.transformer?.nodes(this.selectedNodes)
    this.layer?.batchDraw()
  }

  /**
   * 设置工具模式
   */
  setTool(tool: string): void {
    this.currentTool = tool

    // 清理选择状态
    if (tool !== 'select') {
      this.selectedNodes = []
      this.transformer?.nodes([])
      this.layer?.batchDraw()
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DrawingConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 更新尺寸和缩放
   */
  updateSize(width: number, height: number, scale: number = 1.0): void {
    if (!this.stage) return

    this.stage.width(width)
    this.stage.height(height)
    this.stage.scaleX(scale)
    this.stage.scaleY(scale)
    this.layer?.batchDraw()
  }

  /**
   * 设置交互状态（用于禁用/启用触摸事件）
   */
  setListening(listening: boolean): void {
    if (this.stage) {
      this.stage.setAttrs({ listening })
    }
  }

  /**
   * 清空画布
   */
  clear(): void {
    this.layer?.children.forEach((node) => {
      if (node !== this.transformer && node.name() !== 'temp') {
        node.destroy()
      }
    })
    this.selectedNodes = []
    this.transformer?.nodes([])
    this.layer?.batchDraw()
    this.onDataChange()
  }

  /**
   * 删除选中的对象
   */
  deleteSelected(): void {
    this.selectedNodes.forEach(node => node.destroy())
    this.selectedNodes = []
    this.transformer?.nodes([])
    this.layer?.batchDraw()
    this.onDataChange()
  }

  /**
   * 序列化：Konva 对象 → DrawObject
   */
  serialize(currentScale: number): DrawObject[] {
    const objects: DrawObject[] = []

    this.layer?.children.forEach((node) => {
      // 跳过 Transformer 和临时对象
      if (node === this.transformer || node.name() === 'temp' || node.name() === 'screenshot-temp' || node.name() === 'selection-temp') {
        return
      }

      const normalized = this.normalizeKonvaObject(node, currentScale)
      if (normalized) {
        objects.push(normalized)
      }
    })

    return objects
  }

  /**
   * 反序列化：DrawObject → Konva 对象
   */
  load(objects: DrawObject[], currentScale: number): void {
    // 清空当前 Layer（保留 Transformer）
    const transformer = this.transformer
    this.layer?.children.forEach((node) => {
      if (node !== transformer) {
        node.destroy()
      }
    })

    // 重新创建 Transformer（如果被销毁）
    if (!transformer || !transformer.isAttached()) {
      this.transformer = new Konva.Transformer({
        nodes: [],
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        rotateAnchorOffset: 20,
        borderStroke: '#2196F3',
        borderStrokeWidth: 2,
        anchorFill: '#2196F3',
        anchorStroke: '#fff',
        anchorStrokeWidth: 2,
        anchorSize: 8,
      })
      this.layer?.add(this.transformer)
      this.transformer.moveToTop()
    }

    // 加载对象
    objects.forEach(obj => {
      const konvaNode = this.createKonvaObject(obj, currentScale)
      if (konvaNode) {
        this.layer?.add(konvaNode)
      }
    })

    // 触发重绘
    this.layer?.batchDraw()
  }

  /**
   * 将 Konva 对象转换为标准化 DrawObject
   */
  private normalizeKonvaObject(node: Konva.Node, currentScale: number): DrawObject | null {
    const attrs = node.getAttrs()

    if (node instanceof Konva.Line) {
      const points = node.points()
      const normalizedPoints: { x: number; y: number }[] = []

      for (let i = 0; i < points.length; i += 2) {
        normalizedPoints.push({
          x: points[i] / currentScale,
          y: points[i + 1] / currentScale,
        })
      }

      return {
        type: 'path',
        color: attrs.stroke as string,
        lineWidth: (attrs.strokeWidth as number) / currentScale,
        points: normalizedPoints,
        opacity: attrs.opacity !== undefined ? attrs.opacity : undefined,
      }
    }

    if (node instanceof Konva.Rect) {
      return {
        type: 'rectangle',
        color: attrs.stroke as string,
        lineWidth: (attrs.strokeWidth as number) / currentScale,
        x: (attrs.x as number) / currentScale,
        y: (attrs.y as number) / currentScale,
        width: (attrs.width as number) / currentScale,
        height: (attrs.height as number) / currentScale,
      }
    }

    if (node instanceof Konva.Circle) {
      return {
        type: 'circle',
        color: attrs.stroke as string,
        lineWidth: (attrs.strokeWidth as number) / currentScale,
        x: (attrs.x as number) / currentScale,
        y: (attrs.y as number) / currentScale,
        radius: (attrs.radius as number) / currentScale,
      }
    }

    if (node instanceof Konva.Line && attrs.points && attrs.points.length === 4) {
      // 直线
      return {
        type: 'line',
        color: attrs.stroke as string,
        lineWidth: (attrs.strokeWidth as number) / currentScale,
        x1: attrs.points[0] / currentScale,
        y1: attrs.points[1] / currentScale,
        x2: attrs.points[2] / currentScale,
        y2: attrs.points[3] / currentScale,
      }
    }

    if (node instanceof Konva.Text) {
      return {
        type: 'text',
        color: attrs.fill as string,
        lineWidth: 1,
        text: attrs.text as string,
        x: (attrs.x as number) / currentScale,
        y: (attrs.y as number) / currentScale,
        fontSize: (attrs.fontSize as number) / currentScale,
      }
    }

    return null
  }

  /**
   * 将 DrawObject 转换为 Konva 对象
   */
  private createKonvaObject(obj: DrawObject, currentScale: number): Konva.Node | null {
    if (obj.type === 'path' && obj.points) {
      const points: number[] = []
      obj.points.forEach(p => {
        points.push(p.x * currentScale, p.y * currentScale)
      })

      return new Konva.Line({
        points,
        stroke: obj.color,
        strokeWidth: obj.lineWidth * currentScale,
        lineCap: 'round',
        lineJoin: 'round',
        tension: 0.5,
        opacity: obj.opacity,
        name: 'annotation',
      })
    }

    if (obj.type === 'rectangle' && obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
      return new Konva.Rect({
        x: obj.x * currentScale,
        y: obj.y * currentScale,
        width: obj.width * currentScale,
        height: obj.height * currentScale,
        stroke: obj.color,
        strokeWidth: obj.lineWidth * currentScale,
        name: 'annotation',
      })
    }

    if (obj.type === 'circle' && obj.x !== undefined && obj.y !== undefined && obj.radius !== undefined) {
      return new Konva.Circle({
        x: obj.x * currentScale,
        y: obj.y * currentScale,
        radius: obj.radius * currentScale,
        stroke: obj.color,
        strokeWidth: obj.lineWidth * currentScale,
        name: 'annotation',
      })
    }

    if (obj.type === 'line' && obj.x1 !== undefined && obj.y1 !== undefined && obj.x2 !== undefined && obj.y2 !== undefined) {
      return new Konva.Line({
        points: [
          obj.x1 * currentScale,
          obj.y1 * currentScale,
          obj.x2 * currentScale,
          obj.y2 * currentScale,
        ],
        stroke: obj.color,
        strokeWidth: obj.lineWidth * currentScale,
        name: 'annotation',
      })
    }

    if (obj.type === 'text' && obj.text && obj.x !== undefined && obj.y !== undefined) {
      return new Konva.Text({
        x: obj.x * currentScale,
        y: obj.y * currentScale,
        text: obj.text,
        fontSize: (obj.fontSize || 16) * currentScale,
        fill: obj.color,
        name: 'annotation',
      })
    }

    return null
  }

  /**
   * 获取截图选区边界
   */
  getScreenshotBounds(): { x: number; y: number; width: number; height: number } | null {
    if (this.screenshotRect) {
      const rect = this.screenshotRect.getClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }
    }

    if (this.screenshotPath && this.screenshotPoints.length > 0) {
      const xs = this.screenshotPoints.map(p => p.x)
      const ys = this.screenshotPoints.map(p => p.y)
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      }
    }

    return null
  }

  /**
   * 数据变化回调
   */
  private onDataChange(): void {
    this.callbacks.onDataChange?.()
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stage?.destroy()
    this.stage = null
    this.layer = null
    this.transformer = null
  }
}




