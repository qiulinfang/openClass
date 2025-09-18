/**
 * 数学公式相关类型定义
 * 数学公式和渲染相关类型
 */

/** 公式节点属性接口 */
export interface FormulaNodeAttrs {
  formula: string
  isNew: boolean
  nodeId: string | null
}

/** 公式节点接口 */
export interface FormulaNode {
  attrs: FormulaNodeAttrs
  type: {
    name: string
  }
}

/** MathField接口 */
export interface MathField {
  // 直接属性设置（替代废弃的setOptions方法）
  readOnly: boolean
  selectionMode: string
  mathVirtualKeyboardPolicy: string
  virtualKeyboardMode: string
  defaultMode: string
  fontSize: number
  placeholder: string
  smartMode: boolean
  smartSuperscript: boolean
  theme: string
  toolbar: string
  autoComplete: string
  contextMenu: string
  dragMode: string
  border: string
  backgroundColor: string
  decorations: boolean
  inputMode: string
  
  // 方法
  addEventListener(event: string, handler: (event: Event) => void): void
  focus(): void
  blur(): void
  getValue(): string
  setValue(value: string): void
  executeCommand(command: string): void
  isConnected?: boolean
  remove?(): void
  value?: string
}

/** 数学渲染任务接口 */
export interface RenderTask {
  element: HTMLElement
  priority: number
  timestamp: number
}
