/**
 * 公式相关工具的统一导出
 * 提供便利的访问方式，避免直接使用 FormulaService
 */

// 核心管理器
export { FormulaManager } from './FormulaManager'
export { SmartFocusManager } from './SmartFocusManager'
export { FormulaEventManager, FORMULA_EVENTS } from './FormulaEventManager'
export { FormulaNodeBuilder } from './FormulaNodeBuilder'
export { FormulaErrorHandler } from './FormulaErrorHandler'
export { MathLiveLoader } from './MathLiveLoader'

// 便利的实例获取
import { FormulaManager } from './FormulaManager'
import { SmartFocusManager } from './SmartFocusManager'
import { FormulaEventManager } from './FormulaEventManager'
import { FormulaNodeBuilder } from './FormulaNodeBuilder'
import { FormulaErrorHandler } from './FormulaErrorHandler'
import { MathLiveLoader } from './MathLiveLoader'

// 导出单例实例，方便使用
export const formulaManager = FormulaManager.getInstance()
export const focusManager = SmartFocusManager.getInstance()
export const eventManager = FormulaEventManager.getInstance()
export const nodeBuilder = FormulaNodeBuilder.getInstance()
export const errorHandler = FormulaErrorHandler.getInstance()
export const mathLiveLoader = MathLiveLoader.getInstance()

// 便利方法
export const createFormula = async (position: number) => {
  const nodeId = await formulaManager.createFormula(position)
  if (nodeId) {
    eventManager.emit('FORMULA_CREATED', { nodeId, position })
  }
  return nodeId
}

export const updateFormulaContent = (nodeId: string, content: string) => {
  const success = formulaManager.updateFormulaContent(nodeId, content)
  if (success) {
    eventManager.emit('FORMULA_CONTENT_CHANGED', { nodeId, content })
  }
  return success
}

export const deleteFormula = (nodeId: string) => {
  const success = formulaManager.deleteFormula(nodeId)
  if (success) {
    eventManager.emit('FORMULA_DELETED', { nodeId })
  }
  return success
}

export const getFormulaNode = (nodeId: string) => formulaManager.getNode(nodeId)
export const getAllFormulaNodes = () => formulaManager.getAllNodes()
export const getActiveFormulaNode = () => formulaManager.getActiveNode()
export const isFormulaActive = (nodeId: string) => formulaManager.isActive(nodeId)

export const createFormulaNode = () => nodeBuilder.createFormulaNode()

// 重置所有状态
export const resetAll = () => {
  formulaManager.reset()
  mathLiveLoader.reset()
  focusManager.clearFocusQueue()
  eventManager.removeAllListeners()
}
