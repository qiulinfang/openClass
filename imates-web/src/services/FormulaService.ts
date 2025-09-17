/**
 * 公式服务 - 整合所有公式相关功能的主服务类
 */

import { FormulaManager } from '../utils/math/FormulaManager'
import { FormulaEventManager, FORMULA_EVENTS } from '../utils/math/FormulaEventManager'
import { MathLiveLoader } from '../utils/math/MathLiveLoader'
import { SmartFocusManager } from '../utils/math/SmartFocusManager'
import { FormulaErrorHandler, FormulaErrorType } from '../utils/math/FormulaErrorHandler'
import { FormulaNodeBuilder } from '../utils/math/FormulaNodeBuilder'

export class FormulaService {
  private static instance: FormulaService | null = null
  private formulaManager: FormulaManager
  private eventManager: FormulaEventManager
  private mathLiveLoader: MathLiveLoader
  private focusManager: SmartFocusManager
  private errorHandler: FormulaErrorHandler
  private nodeBuilder: FormulaNodeBuilder

  // 单例模式
  static getInstance(): FormulaService {
    if (!FormulaService.instance) {
      FormulaService.instance = new FormulaService()
    }
    return FormulaService.instance
  }

  constructor() {
    this.formulaManager = FormulaManager.getInstance()
    this.eventManager = FormulaEventManager.getInstance()
    this.mathLiveLoader = MathLiveLoader.getInstance()
    this.focusManager = SmartFocusManager.getInstance()
    this.errorHandler = FormulaErrorHandler.getInstance()
    this.nodeBuilder = FormulaNodeBuilder.getInstance()
    
    this.setupEventListeners()
  }

  // 创建公式节点
  async createFormula(position: number): Promise<string | null> {
    console.log('🧮 [FORMULA-SERVICE] 开始创建公式', { position })
    
    return await this.errorHandler.wrapAsyncOperation(
      async () => {
        // 1. 创建公式节点
        const nodeId = await this.formulaManager.createFormula(position)
        
        // 2. 发出创建事件
        this.eventManager.emit(FORMULA_EVENTS.CREATED, { nodeId, position })
        
        console.log('✅ [FORMULA-SERVICE] 公式创建完成', { nodeId })
        return nodeId
      },
      FormulaErrorType.NODE_CREATION_FAILED,
      undefined,
      { position }
    )
  }

  // 激活公式节点
  async activateFormula(nodeId: string): Promise<boolean> {
    console.log('🧮 [FORMULA-SERVICE] 激活公式节点', { nodeId })
    
    const result = await this.errorHandler.wrapAsyncOperation(
      async () => {
        // 1. 激活公式节点
        const success = await this.formulaManager.activateFormula(nodeId)
        
        if (success) {
          // 2. 获取MathField实例
          const node = this.formulaManager.getNode(nodeId)
          if (node?.mathField) {
            // 3. 智能聚焦
            await this.focusManager.focusFormula(node.mathField, nodeId, {
              scrollIntoView: true,
              showKeyboard: true,
              delay: 100,
              ensureVisible: true
            })
          }
          
          // 4. 发出激活事件
          this.eventManager.emit(FORMULA_EVENTS.ACTIVATED, { nodeId })
        }
        
        return success
      },
      FormulaErrorType.FOCUS_FAILED,
      nodeId
    )
    
    return result || false
  }

  // 失活公式节点
  async deactivateFormula(nodeId: string): Promise<boolean> {
    console.log('🧮 [FORMULA-SERVICE] 失活公式节点', { nodeId })
    
    const result = await this.errorHandler.wrapAsyncOperation(
      async () => {
        // 1. 获取MathField实例
        const node = this.formulaManager.getNode(nodeId)
        if (node?.mathField) {
          // 2. 失焦
          await this.focusManager.blurFormula(nodeId, node.mathField)
        }
        
        // 3. 失活公式节点
        const success = await this.formulaManager.deactivateFormula(nodeId)
        
        if (success) {
          // 4. 发出失活事件
          this.eventManager.emit(FORMULA_EVENTS.DEACTIVATED, { nodeId })
        }
        
        return success
      },
      FormulaErrorType.FOCUS_FAILED,
      nodeId
    )
    
    return result || false
  }

  // 更新公式内容
  updateFormulaContent(nodeId: string, content: string): boolean {
    console.log('🧮 [FORMULA-SERVICE] 更新公式内容', { nodeId, content })
    
    const result = this.errorHandler.wrapSyncOperation(
      () => {
        // 1. 更新公式管理器中的内容
        const success = this.formulaManager.updateFormulaContent(nodeId, content)
        
        if (success) {
          // 2. 发出内容变化事件
          this.eventManager.emit(FORMULA_EVENTS.CONTENT_CHANGED, { nodeId, content })
        }
        
        return success
      },
      FormulaErrorType.CONTENT_SAVE_FAILED,
      nodeId,
      { content }
    )
    
    return result || false
  }

  // 删除公式节点
  deleteFormula(nodeId: string): boolean {
    console.log('🧮 [FORMULA-SERVICE] 删除公式节点', { nodeId })
    
    const result = this.errorHandler.wrapSyncOperation(
      () => {
        // 1. 删除公式节点
        const success = this.formulaManager.deleteFormula(nodeId)
        
        if (success) {
          // 2. 发出删除事件
          this.eventManager.emit(FORMULA_EVENTS.DELETED, { nodeId })
        }
        
        return success
      },
      FormulaErrorType.UNKNOWN_ERROR,
      nodeId
    )
    
    return result || false
  }

  // 获取公式节点
  getFormulaNode(nodeId: string) {
    return this.formulaManager.getNode(nodeId)
  }

  // 获取所有公式节点
  getAllFormulaNodes() {
    return this.formulaManager.getAllNodes()
  }

  // 获取激活的公式节点
  getActiveFormulaNode() {
    return this.formulaManager.getActiveNode()
  }

  // 检查公式节点是否激活
  isFormulaActive(nodeId: string): boolean {
    return this.formulaManager.isActive(nodeId)
  }

  // 获取公式服务状态
  getServiceState() {
    return {
      formulaManager: this.formulaManager.getState(),
      mathLiveLoaded: this.mathLiveLoader.isMathLiveLoaded(),
      eventNames: this.eventManager.getEventNames()
    }
  }

  // 创建FormulaNode（供Tiptap使用）
  createFormulaNode() {
    return this.nodeBuilder.createFormulaNode()
  }

  // 设置事件监听器
  on(event: string, handler: Function) {
    this.eventManager.on(event, handler)
  }

  // 移除事件监听器
  off(event: string, handler: Function) {
    this.eventManager.off(event, handler)
  }

  // 获取FormulaManager实例（用于调试）
  getFormulaManager(): FormulaManager {
    return this.formulaManager
  }

  // 重置服务状态
  reset(): void {
    console.log('🔄 [FORMULA-SERVICE] 重置服务状态')
    
    this.formulaManager.reset()
    this.mathLiveLoader.reset()
    this.focusManager.clearFocusQueue()
    this.eventManager.removeAllListeners()
    
    console.log('✅ [FORMULA-SERVICE] 服务状态重置完成')
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    console.log('🎧 [FORMULA-SERVICE] 设置事件监听器')
    
    // 监听公式内容变化事件
    this.eventManager.on(FORMULA_EVENTS.CONTENT_CHANGED, (data) => {
      console.log('📝 [FORMULA-SERVICE] 公式内容变化', data)
    })
    
    // 监听公式激活事件
    this.eventManager.on(FORMULA_EVENTS.ACTIVATED, (data) => {
      console.log('🎯 [FORMULA-SERVICE] 公式激活', data)
    })
    
    // 监听公式失活事件
    this.eventManager.on(FORMULA_EVENTS.DEACTIVATED, (data) => {
      console.log('🎯 [FORMULA-SERVICE] 公式失活', data)
    })
    
    // 监听错误事件
    this.eventManager.on(FORMULA_EVENTS.ERROR, (data) => {
      console.error('❌ [FORMULA-SERVICE] 公式错误', data)
    })
  }
}
