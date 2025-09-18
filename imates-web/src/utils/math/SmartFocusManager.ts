/**
 * 智能聚焦管理器 - 负责公式节点的智能聚焦和键盘显示
 */

import { FormulaErrorHandler, FormulaErrorType } from './FormulaErrorHandler'
import { FormulaManager } from './FormulaManager'

export interface FocusOptions {
  scrollIntoView?: boolean
  showKeyboard?: boolean
  delay?: number
  ensureVisible?: boolean
}

export class SmartFocusManager {
  private static instance: SmartFocusManager | null = null
  private errorHandler: FormulaErrorHandler
  private formulaManager: FormulaManager
  private focusQueue: string[] = []
  private isProcessing = false

  // 单例模式
  static getInstance(): SmartFocusManager {
    if (!SmartFocusManager.instance) {
      SmartFocusManager.instance = new SmartFocusManager()
    }
    return SmartFocusManager.instance
  }

  constructor() {
    this.errorHandler = FormulaErrorHandler.getInstance()
    this.formulaManager = FormulaManager.getInstance()
  }

  /**
   * 统一激活公式节点
   * 整合状态管理 + 聚焦实现，提供完整的激活功能
   * 
   * 职责：
   * - 失活其他激活的节点（确保同时只有一个公式处于编辑状态）
   * - 状态管理（通过 FormulaManager）
   * - 聚焦实现（调用 focusFormula）
   * - 事件发出（ACTIVATED + FOCUS）
   * - 错误处理和回滚
   * 
   * @param nodeId 节点ID
   * @param mathField MathField实例
   * @param options 聚焦选项
   * @returns 是否激活成功
   */
  async activateFormula(
    nodeId: string, 
    mathField: unknown, 
    options: FocusOptions = {}
  ): Promise<boolean> {
    
    try {
      // 1. 失活其他激活的节点（确保同时只有一个公式处于编辑状态）
      await this.deactivateOtherActiveNodes()

      // 2. 状态管理（通过 FormulaManager）
      const stateSuccess = await this.formulaManager.setNodeActive(nodeId)
      if (!stateSuccess) {
        return false
      }

      // 3. 聚焦实现
      const focusSuccess = await this.focusFormula(nodeId, mathField, options)
      if (!focusSuccess) {
        // 状态激活成功但聚焦失败，需要回滚状态
        await this.formulaManager.setNodeInactive(nodeId)
        return false
      }

      // 4. 更新DOM样式类为激活状态
      const node = this.getNode(nodeId)
      if (node?.container) {
        node.container.className = 'formula-node-container formula-active'
        // 更新ID标签样式为激活状态
        this.updateIdLabelStyle(node.container, true)
      }

      // 5. 激活完成（移除事件发送）

      return true

    } catch (error) {
      
      // 确保状态回滚
      await this.formulaManager.setNodeInactive(nodeId)
      
      // 确保DOM样式也回滚
      const node = this.getNode(nodeId)
      if (node?.container) {
        node.container.className = 'formula-node-container formula-inactive'
        // 更新ID标签样式为非激活状态
        this.updateIdLabelStyle(node.container, false)
      }
      
      const formulaError = this.errorHandler.createError(
        FormulaErrorType.FOCUS_FAILED,
        `统一激活失败: ${error instanceof Error ? error.message : String(error)}`,
        nodeId,
        error instanceof Error ? error : undefined
      )
      
      await this.errorHandler.handleError(formulaError)
      return false
    }
  }

  /**
   * 统一失活公式节点
   * 整合状态管理 + 失焦实现，提供完整的失活功能
   * 
   * 职责：
   * - 失焦实现（调用 blurFormula）
   * - 状态管理（通过 FormulaManager）
   * - 事件发出（BLUR + DEACTIVATED）
   * - 错误处理
   * 
   * @param nodeId 节点ID
   * @param mathField MathField实例
   * @returns 是否失活成功
   */
  async deactivateFormula(
    nodeId: string, 
    mathField: unknown
  ): Promise<boolean> {
    
    try {
      // 1. 失焦实现
      const blurSuccess = await this.blurFormula(nodeId, mathField)
      
      // 2. 状态管理（无论失焦是否成功都要更新状态）
      const stateSuccess = await this.formulaManager.setNodeInactive(nodeId)
      
      // 3. 更新DOM样式类为非激活状态
      const node = this.getNode(nodeId)
      if (node?.container) {
        node.container.className = 'formula-node-container formula-inactive'
        // 更新ID标签样式为非激活状态
        this.updateIdLabelStyle(node.container, false)
      }
      
      // 4. 失活完成（移除事件发送）

      return blurSuccess && stateSuccess

    } catch {
      
      // 确保状态更新
      await this.formulaManager.setNodeInactive(nodeId)
      
      // 确保DOM样式也更新
      const node = this.getNode(nodeId)
      if (node?.container) {
        node.container.className = 'formula-node-container formula-inactive'
        // 更新ID标签样式为非激活状态
        this.updateIdLabelStyle(node.container, false)
      }
      
      return false
    }
  }

  /**
   * 检查节点是否激活
   * 
   * @param nodeId 节点ID
   * @returns 是否激活
   */
  isNodeActive(nodeId: string): boolean {
    return this.formulaManager.isActive(nodeId)
  }

  /**
   * 获取公式节点
   * 
   * @param nodeId 节点ID
   * @returns 公式节点或undefined
   */
  getNode(nodeId: string) {
    return this.formulaManager.getNode(nodeId)
  }

  /**
   * 更新ID标签样式
   * 
   * @param container 容器元素
   * @param isActive 是否激活状态
   */
  private updateIdLabelStyle(container: HTMLElement, isActive: boolean): void {
    const idLabel = container.querySelector('.formula-id-label') as HTMLElement
    if (!idLabel) return

    const baseStyle = `
      position: absolute;
      top: -2px;
      right: -2px;
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 3px;
      font-family: monospace;
      z-index: 1000;
      pointer-events: none;
      line-height: 1;
      transition: all 0.2s ease;
    `
    
    const activeStyle = `
      background: rgba(33, 150, 243, 0.9);
      color: white;
      opacity: 1;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    `
    
    const inactiveStyle = `
      background: rgba(0, 0, 0, 0.7);
      color: white;
      opacity: 0.6;
    `
    
    idLabel.style.cssText = baseStyle + (isActive ? activeStyle : inactiveStyle)
  }

  /**
   * 获取激活的节点
   * 
   * @returns 激活的节点对象
   */
  getActiveNode() {
    return this.formulaManager.getActiveNode()
  }

  /**
   * 纯聚焦实现 - 只负责聚焦相关的技术实现
   * 
   * 职责：
   * - 滚动到可见区域
   * - 延迟处理
   * - MathField 聚焦
   * - 虚拟键盘显示
   * - 键盘可见性确保
   * 
   * 注意：不负责状态管理和事件发出
   */
  async focusFormula(
    nodeId: string, 
    mathField: unknown, 
    options: FocusOptions = {}
  ): Promise<boolean> {
    
    const {
      scrollIntoView = true,
      showKeyboard = true,
      delay = 100,
      ensureVisible = true
    } = options

    try {
      // 1. 滚动到可见区域
      if (scrollIntoView) {
        await this.scrollIntoView(nodeId)
      }

      // 2. 延迟聚焦，确保DOM更新完成
      if (delay > 0) {
        await this.delay(delay)
      }

      // 3. 聚焦MathField
      await this.focusMathField(mathField, nodeId)

      // 4. 显示虚拟键盘
      if (showKeyboard) {
        await this.showVirtualKeyboard(mathField, nodeId)
      }

      // 5. 确保键盘可见
      if (ensureVisible) {
        await this.ensureKeyboardVisible(mathField)
      }

      return true

    } catch {
      return false
    }
  }

  /**
   * 纯失焦实现 - 只负责失焦相关的技术实现
   * 
   * 职责：
   * - MathField 只读状态设置
   * - 虚拟键盘隐藏
   * - MathField 失焦
   * 
   * 注意：不负责状态管理和事件发出
   */
  async blurFormula(nodeId: string, mathField: unknown): Promise<boolean> {
    
    try {
      // 1. 设置MathField为只读状态，防止光标闪烁
      if (mathField && typeof (mathField as Record<string, unknown>).readOnly !== 'undefined') {
        try {
          ;(mathField as { readOnly: boolean }).readOnly = true
        } catch {
        }
      }

      // 2. 隐藏虚拟键盘
      await this.hideVirtualKeyboard(mathField, nodeId)

      // 3. 失焦MathField
      if (mathField && typeof (mathField as Record<string, unknown>).blur === 'function') {
        ;(mathField as { blur: () => void }).blur()
      }

      return true

    } catch {
      return false
    }
  }

  // 滚动到可见区域
  private async scrollIntoView(nodeId: string): Promise<void> {
    
    const element = document.querySelector(`[data-node-id="${nodeId}"]`)
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      })
    }
  }

  // 聚焦MathField
  private async focusMathField(mathField: unknown, _nodeId: string): Promise<void> {
    
    if (!mathField) {
      throw new Error('MathField实例不存在')
    }

    // 设置MathField为可编辑状态
    if (typeof (mathField as Record<string, unknown>).readOnly !== 'undefined') {
      try {
        ;(mathField as { readOnly: boolean; selectionMode: string }).readOnly = false
        ;(mathField as { readOnly: boolean; selectionMode: string }).selectionMode = 'text'
      } catch {
      }
    }

    // 聚焦MathField
    if (typeof (mathField as Record<string, unknown>).focus === 'function') {
      ;(mathField as { focus: () => void }).focus()
    }

    // 执行滚动到视图命令
    if (typeof (mathField as Record<string, unknown>).executeCommand === 'function') {
      ;(mathField as { executeCommand: (command: string) => void }).executeCommand('scrollIntoView')
    }
  }

  // 显示虚拟键盘
  private async showVirtualKeyboard(mathField: unknown, nodeId: string): Promise<void> {
    
    if (!mathField) {
      throw new Error('MathField实例不存在')
    }

    try {
      // 显示虚拟键盘
      if (typeof (mathField as Record<string, unknown>).executeCommand === 'function') {
        ;(mathField as { executeCommand: (command: string) => void }).executeCommand('showVirtualKeyboard')
      }

      // 触发公式键盘显示事件，通知 ChatView 进行布局调整
      const keyboardEvent = new CustomEvent('formula-keyboard-toggle', {
        detail: { 
          visible: true, 
          height: 300,
          keyboardType: 'formula'  // 标识为公式键盘
        }
      })
      window.dispatchEvent(keyboardEvent)

    } catch (error) {
      
      const formulaError = this.errorHandler.createError(
        FormulaErrorType.KEYBOARD_SHOW_FAILED,
        `显示虚拟键盘失败: ${error instanceof Error ? error.message : String(error)}`,
        nodeId,
        error instanceof Error ? error : undefined
      )
      
      throw formulaError
    }
  }

  // 隐藏虚拟键盘
  private async hideVirtualKeyboard(mathField: unknown, _nodeId: string): Promise<void> {
    
    if (!mathField) {
      return
    }

    try {
      // 隐藏虚拟键盘
      if (typeof (mathField as Record<string, unknown>).executeCommand === 'function') {
        ;(mathField as { executeCommand: (command: string) => void }).executeCommand('hideVirtualKeyboard')
      }

      // 触发公式键盘隐藏事件，通知 ChatView 进行布局调整
      const keyboardEvent = new CustomEvent('formula-keyboard-toggle', {
        detail: { 
          visible: false, 
          height: 0,
          keyboardType: 'formula'  // 标识为公式键盘
        }
      })
      window.dispatchEvent(keyboardEvent)

    } catch {
    }
  }

  // 确保键盘可见
  private async ensureKeyboardVisible(mathField: unknown): Promise<void> {
    
    if (!mathField) {
      return
    }

    // 延迟确保键盘可见
    setTimeout(() => {
      try {
        const mathFieldTyped = mathField as Record<string, unknown>
        if (typeof mathFieldTyped.executeCommand === 'function') {
          ;(mathFieldTyped as { executeCommand: (command: string) => void }).executeCommand('showVirtualKeyboard')
        }
      } catch {
      }
    }, 50)
  }

  // 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 批量聚焦处理
  async processFocusQueue(): Promise<void> {
    if (this.isProcessing || this.focusQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      while (this.focusQueue.length > 0) {
        const _nodeId = this.focusQueue.shift()!
        // 这里可以添加批量聚焦的具体逻辑
      }
    } finally {
      this.isProcessing = false
    }
  }

  // 添加到聚焦队列
  addToFocusQueue(nodeId: string): void {
    if (!this.focusQueue.includes(nodeId)) {
      this.focusQueue.push(nodeId)
    }
  }

  // 清空聚焦队列
  clearFocusQueue(): void {
    this.focusQueue = []
  }

  /**
   * 失活其他激活的节点
   * 
   * 职责：
   * - 获取当前激活的节点ID
   * - 如果存在激活节点，执行完整的失活流程
   * - 确保同时只有一个公式处于编辑状态
   * 
   * @private
   */
  private async deactivateOtherActiveNodes(): Promise<void> {
    const activeNodeId = this.formulaManager.getState().activeNodeId
    
    if (activeNodeId) {
      
      const node = this.formulaManager.getNode(activeNodeId)
      if (node?.mathField) {
        // 执行完整的失活流程（包括失焦、状态更新、样式更新）
        await this.deactivateFormula(activeNodeId, node.mathField)
      } else {
        // 如果节点存在但没有MathField实例，只更新状态
        await this.formulaManager.setNodeInactive(activeNodeId)
      }
    }
  }
}
