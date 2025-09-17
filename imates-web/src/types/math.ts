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
  setOptions(options: Record<string, unknown>): void
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
