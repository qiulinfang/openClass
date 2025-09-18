/**
 * 智能聚焦管理器 - 负责公式节点的智能聚焦和键盘显示
 */

import { FormulaEventManager, FORMULA_EVENTS } from './FormulaEventManager'
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
  private eventManager: FormulaEventManager
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
    this.eventManager = FormulaEventManager.getInstance()
    this.errorHandler = FormulaErrorHandler.getInstance()
    this.formulaManager = FormulaManager.getInstance()
  }

  /**
   * 统一激活公式节点
   * 整合状态管理 + 聚焦实现，提供完整的激活功能
   * 
   * 职责：
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
    console.log('🎯 [FOCUS-MANAGER] 统一激活公式节点', { nodeId, options })
    
    try {
      // 1. 状态管理（通过 FormulaManager）
      const stateSuccess = await this.formulaManager.activateFormula(nodeId)
      if (!stateSuccess) {
        console.error('❌ [FOCUS-MANAGER] 状态激活失败', { nodeId })
        return false
      }

      // 2. 聚焦实现
      const focusSuccess = await this.focusFormula(nodeId, mathField, options)
      if (!focusSuccess) {
        // 状态激活成功但聚焦失败，需要回滚状态
        console.warn('⚠️ [FOCUS-MANAGER] 聚焦失败，回滚状态', { nodeId })
        await this.formulaManager.deactivateFormula(nodeId)
        return false
      }

      // 3. 发出激活和聚焦事件
      this.eventManager.emit(FORMULA_EVENTS.ACTIVATED, { nodeId, mathField })
      this.eventManager.emit(FORMULA_EVENTS.FOCUS, { nodeId, mathField })

      console.log('✅ [FOCUS-MANAGER] 统一激活完成', { nodeId })
      return true

    } catch (error) {
      console.error('❌ [FOCUS-MANAGER] 统一激活失败', { nodeId, error })
      
      // 确保状态回滚
      await this.formulaManager.deactivateFormula(nodeId)
      
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
    console.log('🎯 [FOCUS-MANAGER] 统一失活公式节点', { nodeId })
    
    try {
      // 1. 失焦实现
      const blurSuccess = await this.blurFormula(nodeId, mathField)
      
      // 2. 状态管理（无论失焦是否成功都要更新状态）
      const stateSuccess = await this.formulaManager.deactivateFormula(nodeId)
      
      // 3. 发出失焦和失活事件
      this.eventManager.emit(FORMULA_EVENTS.BLUR, { nodeId, mathField })
      this.eventManager.emit(FORMULA_EVENTS.DEACTIVATED, { nodeId, mathField })

      console.log('✅ [FOCUS-MANAGER] 统一失活完成', { nodeId })
      return blurSuccess && stateSuccess

    } catch (error) {
      console.error('❌ [FOCUS-MANAGER] 统一失活失败', { nodeId, error })
      
      // 确保状态更新
      await this.formulaManager.deactivateFormula(nodeId)
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
    console.log('🎯 [FOCUS-MANAGER] 开始聚焦实现', { nodeId, options })
    
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
        await this.ensureKeyboardVisible(mathField, nodeId)
      }

      console.log('✅ [FOCUS-MANAGER] 聚焦实现完成', { nodeId })
      return true

    } catch (error) {
      console.error('❌ [FOCUS-MANAGER] 聚焦实现失败', { nodeId, error })
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
    console.log('🎯 [FOCUS-MANAGER] 开始失焦实现', { nodeId })
    
    try {
      // 1. 设置MathField为只读状态，防止光标闪烁
      if (mathField && typeof (mathField as Record<string, unknown>).setOptions === 'function') {
        try {
          ;(mathField as { setOptions: (options: Record<string, unknown>) => void }).setOptions({
            readOnly: true,
            selectionMode: 'none'
          })
          console.log('✅ [FOCUS-MANAGER] MathField已设置为只读状态', { nodeId })
        } catch (error) {
          console.error('❌ [FOCUS-MANAGER] 设置只读状态失败', { nodeId, error })
        }
      }

      // 2. 隐藏虚拟键盘
      await this.hideVirtualKeyboard(mathField, nodeId)

      // 3. 失焦MathField
      if (mathField && typeof (mathField as Record<string, unknown>).blur === 'function') {
        ;(mathField as { blur: () => void }).blur()
      }

      console.log('✅ [FOCUS-MANAGER] 失焦实现完成', { nodeId })
      return true

    } catch (error) {
      console.error('❌ [FOCUS-MANAGER] 失焦实现失败', { nodeId, error })
      return false
    }
  }

  // 滚动到可见区域
  private async scrollIntoView(nodeId: string): Promise<void> {
    console.log('📜 [FOCUS-MANAGER] 滚动到可见区域', { nodeId })
    
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
  private async focusMathField(mathField: unknown, nodeId: string): Promise<void> {
    console.log('🎯 [FOCUS-MANAGER] 聚焦MathField', { nodeId })
    
    if (!mathField) {
      throw new Error('MathField实例不存在')
    }

    // 设置MathField为可编辑状态
    if (typeof (mathField as Record<string, unknown>).setOptions === 'function') {
      try {
        ;(mathField as { setOptions: (options: Record<string, unknown>) => void }).setOptions({
          readOnly: false,
          selectionMode: 'none'
        })
        console.log('✅ [FOCUS-MANAGER] MathField已设置为可编辑状态', { nodeId })
      } catch (error) {
        console.error('❌ [FOCUS-MANAGER] 设置可编辑状态失败', { nodeId, error })
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
    console.log('⌨️ [FOCUS-MANAGER] 显示虚拟键盘', { nodeId })
    
    if (!mathField) {
      throw new Error('MathField实例不存在')
    }

    try {
      // 显示虚拟键盘
      if (typeof (mathField as Record<string, unknown>).executeCommand === 'function') {
        ;(mathField as { executeCommand: (command: string) => void }).executeCommand('showVirtualKeyboard')
      }

      // 发出键盘显示事件
      this.eventManager.emit(FORMULA_EVENTS.KEYBOARD_SHOW, { nodeId, mathField })

    } catch (error) {
      console.error('❌ [FOCUS-MANAGER] 显示虚拟键盘失败', { nodeId, error })
      
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
  private async hideVirtualKeyboard(mathField: unknown, nodeId: string): Promise<void> {
    console.log('⌨️ [FOCUS-MANAGER] 隐藏虚拟键盘', { nodeId })
    
    if (!mathField) {
      return
    }

    try {
      // 隐藏虚拟键盘
      if (typeof (mathField as Record<string, unknown>).executeCommand === 'function') {
        ;(mathField as { executeCommand: (command: string) => void }).executeCommand('hideVirtualKeyboard')
      }

      // 发出键盘隐藏事件
      this.eventManager.emit(FORMULA_EVENTS.KEYBOARD_HIDE, { nodeId, mathField })

    } catch (error) {
      console.error('❌ [FOCUS-MANAGER] 隐藏虚拟键盘失败', { nodeId, error })
    }
  }

  // 确保键盘可见
  private async ensureKeyboardVisible(mathField: unknown, nodeId: string): Promise<void> {
    console.log('⌨️ [FOCUS-MANAGER] 确保键盘可见', { nodeId })
    
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
      } catch (error) {
        console.error('❌ [FOCUS-MANAGER] 确保键盘可见失败', { nodeId, error })
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
    console.log('🎯 [FOCUS-MANAGER] 开始处理聚焦队列', { count: this.focusQueue.length })

    try {
      while (this.focusQueue.length > 0) {
        const nodeId = this.focusQueue.shift()!
        // 这里可以添加批量聚焦的具体逻辑
        console.log('🎯 [FOCUS-MANAGER] 处理队列中的节点', { nodeId })
      }
    } finally {
      this.isProcessing = false
      console.log('✅ [FOCUS-MANAGER] 聚焦队列处理完成')
    }
  }

  // 添加到聚焦队列
  addToFocusQueue(nodeId: string): void {
    if (!this.focusQueue.includes(nodeId)) {
      this.focusQueue.push(nodeId)
      console.log('🎯 [FOCUS-MANAGER] 添加到聚焦队列', { nodeId, queueLength: this.focusQueue.length })
    }
  }

  // 清空聚焦队列
  clearFocusQueue(): void {
    this.focusQueue = []
    console.log('🎯 [FOCUS-MANAGER] 清空聚焦队列')
  }
}
