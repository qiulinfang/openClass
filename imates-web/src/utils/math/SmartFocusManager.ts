/**
 * 智能聚焦管理器 - 负责公式节点的智能聚焦和键盘显示
 */

import { FormulaEventManager, FORMULA_EVENTS } from './FormulaEventManager'
import { FormulaErrorHandler, FormulaErrorType } from './FormulaErrorHandler'

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
  }

  // 智能聚焦公式节点
  async focusFormula(
    nodeId: string, 
    mathField: unknown, 
    options: FocusOptions = {}
  ): Promise<boolean> {
    console.log('🎯 [FOCUS-MANAGER] 开始智能聚焦公式节点', { nodeId, options })
    
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

      // 6. 发出聚焦事件
      this.eventManager.emit(FORMULA_EVENTS.FOCUS, { nodeId, mathField })

      console.log('✅ [FOCUS-MANAGER] 公式节点聚焦完成', { nodeId })
      return true

    } catch (error) {
      console.error('❌ [FOCUS-MANAGER] 公式节点聚焦失败', { nodeId, error })
      
      const formulaError = this.errorHandler.createError(
        FormulaErrorType.FOCUS_FAILED,
        `公式节点聚焦失败: ${error instanceof Error ? error.message : String(error)}`,
        nodeId,
        error instanceof Error ? error : undefined
      )
      
      await this.errorHandler.handleError(formulaError)
      return false
    }
  }

  // 失焦公式节点
  async blurFormula(nodeId: string, mathField: unknown): Promise<boolean> {
    console.log('🎯 [FOCUS-MANAGER] 失焦公式节点', { nodeId })
    
    try {
      // 1. 隐藏虚拟键盘
      await this.hideVirtualKeyboard(mathField, nodeId)

      // 2. 失焦MathField
      if (mathField && typeof mathField.blur === 'function') {
        mathField.blur()
      }

      // 3. 发出失焦事件
      this.eventManager.emit(FORMULA_EVENTS.BLUR, { nodeId, mathField })

      console.log('✅ [FOCUS-MANAGER] 公式节点失焦完成', { nodeId })
      return true

    } catch (error) {
      console.error('❌ [FOCUS-MANAGER] 公式节点失焦失败', { nodeId, error })
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

    // 聚焦MathField
    if (typeof mathField.focus === 'function') {
      mathField.focus()
    }

    // 执行滚动到视图命令
    if (typeof mathField.executeCommand === 'function') {
      mathField.executeCommand('scrollIntoView')
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
      if (typeof mathField.executeCommand === 'function') {
        mathField.executeCommand('showVirtualKeyboard')
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
      if (typeof mathField.executeCommand === 'function') {
        mathField.executeCommand('hideVirtualKeyboard')
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
        if (typeof mathField.executeCommand === 'function') {
          mathField.executeCommand('showVirtualKeyboard')
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
