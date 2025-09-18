/**
 * 公式错误处理器 - 负责处理公式相关的所有错误
 */


export enum FormulaErrorType {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  MATHLIVE_LOAD_FAILED = 'MATHLIVE_LOAD_FAILED',
  NODE_CREATION_FAILED = 'NODE_CREATION_FAILED',
  KEYBOARD_SHOW_FAILED = 'KEYBOARD_SHOW_FAILED',
  FOCUS_FAILED = 'FOCUS_FAILED',
  CONTENT_SAVE_FAILED = 'CONTENT_SAVE_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface FormulaError {
  type: FormulaErrorType
  message: string
  nodeId?: string
  originalError?: Error
  context?: unknown
}

export class FormulaErrorHandler {
  private static instance: FormulaErrorHandler | null = null

  // 单例模式
  static getInstance(): FormulaErrorHandler {
    if (!FormulaErrorHandler.instance) {
      FormulaErrorHandler.instance = new FormulaErrorHandler()
    }
    return FormulaErrorHandler.instance
  }

  constructor() {
    // 移除事件管理器依赖
  }

  // 处理错误
  async handleError(error: FormulaError): Promise<void> {
    console.error('❌ [FORMULA-ERROR] 处理公式错误', error)
    
    // 错误处理完成（移除事件发送）

    // 根据错误类型执行不同的恢复策略
    switch (error.type) {
      case FormulaErrorType.INITIALIZATION_FAILED:
        await this.handleInitializationError(error)
        break
      case FormulaErrorType.MATHLIVE_LOAD_FAILED:
        await this.handleMathLiveLoadError()
        break
      case FormulaErrorType.NODE_CREATION_FAILED:
        await this.handleNodeCreationError(error)
        break
      case FormulaErrorType.KEYBOARD_SHOW_FAILED:
        await this.handleKeyboardShowError(error)
        break
      case FormulaErrorType.FOCUS_FAILED:
        await this.handleFocusError(error)
        break
      case FormulaErrorType.CONTENT_SAVE_FAILED:
        await this.handleContentSaveError(error)
        break
      default:
        await this.handleUnknownError(error)
    }
  }

  // 创建错误对象
  createError(
    type: FormulaErrorType,
    message: string,
    nodeId?: string,
    originalError?: Error,
    context?: unknown
  ): FormulaError {
    return {
      type,
      message,
      nodeId,
      originalError,
      context
    }
  }

  // 处理初始化错误
  private async handleInitializationError(error: FormulaError): Promise<void> {
    console.log('🔄 [FORMULA-ERROR] 处理初始化错误', { nodeId: error.nodeId })
    
    if (error.nodeId) {
      // 尝试重新初始化（移除事件发送）
      try {
        console.log('🔄 [FORMULA-ERROR] 尝试重新初始化', { nodeId: error.nodeId })
      } catch (retryError) {
        console.error('❌ [FORMULA-ERROR] 重新初始化失败', retryError)
      }
    }
  }

  // 处理MathLive加载错误
  private async handleMathLiveLoadError(): Promise<void> {
    console.log('🔄 [FORMULA-ERROR] 处理MathLive加载错误')
    
    try {
      // MathLive加载失败处理（移除事件发送）
      console.log('💡 [FORMULA-ERROR] 建议使用文本输入作为降级方案')
    } catch (fallbackError) {
      console.error('❌ [FORMULA-ERROR] 降级方案执行失败', fallbackError)
    }
  }

  // 处理节点创建错误
  private async handleNodeCreationError(error: FormulaError): Promise<void> {
    console.log('🔄 [FORMULA-ERROR] 处理节点创建错误', { nodeId: error.nodeId })
    
    // 节点创建失败处理（移除事件发送）
  }

  // 处理键盘显示错误
  private async handleKeyboardShowError(error: FormulaError): Promise<void> {
    console.log('🔄 [FORMULA-ERROR] 处理键盘显示错误', { nodeId: error.nodeId })
    
    try {
      // 尝试显示替代键盘（移除事件发送）
      console.log('🔄 [FORMULA-ERROR] 尝试显示替代键盘', { nodeId: error.nodeId })
    } catch (fallbackError) {
      console.error('❌ [FORMULA-ERROR] 替代键盘显示失败', fallbackError)
    }
  }

  // 处理聚焦错误
  private async handleFocusError(error: FormulaError): Promise<void> {
    console.log('🔄 [FORMULA-ERROR] 处理聚焦错误', { nodeId: error.nodeId })
    
    // 聚焦失败处理（移除事件发送）
  }

  // 处理内容保存错误
  private async handleContentSaveError(error: FormulaError): Promise<void> {
    console.log('🔄 [FORMULA-ERROR] 处理内容保存错误', { nodeId: error.nodeId })
    
    // 内容保存失败处理（移除事件发送）
  }

  // 处理未知错误
  private async handleUnknownError(error: FormulaError): Promise<void> {
    console.log('🔄 [FORMULA-ERROR] 处理未知错误', error)
    
    // 记录错误详情
    console.error('❌ [FORMULA-ERROR] 未知错误详情', {
      type: error.type,
      message: error.message,
      nodeId: error.nodeId,
      originalError: error.originalError,
      context: error.context
    })
  }

  // 包装异步操作，自动捕获错误
  async wrapAsyncOperation<T>(
    operation: () => Promise<T>,
    errorType: FormulaErrorType,
    nodeId?: string,
    context?: unknown
  ): Promise<T | null> {
    try {
      return await operation()
    } catch (error) {
      const formulaError = this.createError(
        errorType,
        error instanceof Error ? error.message : String(error),
        nodeId,
        error instanceof Error ? error : undefined,
        context
      )
      
      await this.handleError(formulaError)
      return null
    }
  }

  // 包装同步操作，自动捕获错误
  wrapSyncOperation<T>(
    operation: () => T,
    errorType: FormulaErrorType,
    nodeId?: string,
    context?: unknown
  ): T | null {
    try {
      return operation()
    } catch (error) {
      const formulaError = this.createError(
        errorType,
        error instanceof Error ? error.message : String(error),
        nodeId,
        error instanceof Error ? error : undefined,
        context
      )
      
      this.handleError(formulaError)
      return null
    }
  }
}
