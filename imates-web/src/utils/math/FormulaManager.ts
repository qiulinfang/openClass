/**
 * 公式管理器 - 负责管理所有公式节点的生命周期
 */
export interface FormulaNode {
  id: string
  content: string
  isActive: boolean
  isNew: boolean
  position: number
  mathField?: unknown
  container?: HTMLElement
}

export interface FormulaState {
  activeNodeId: string | null
  pendingNodes: Set<string>
  keyboardVisible: boolean
  editingMode: boolean
}

export class FormulaManager {
  private static instance: FormulaManager | null = null
  private nodes = new Map<string, FormulaNode>()
  private state: FormulaState = {
    activeNodeId: null,
    pendingNodes: new Set(),
    keyboardVisible: false,
    editingMode: false
  }

  // 单例模式
  static getInstance(): FormulaManager {
    if (!FormulaManager.instance) {
      FormulaManager.instance = new FormulaManager()
    }
    return FormulaManager.instance
  }

  // 创建公式节点
  async createFormula(position: number): Promise<string> {
    console.log('🧮 [FORMULA-MANAGER] 开始创建公式节点')
    
    // 1. 清理现有公式状态
    await this.cleanupExistingFormulas()
    
    // 2. 生成唯一ID
    const nodeId = this.generateUniqueId()
    
    // 3. 创建节点对象
    const node: FormulaNode = {
      id: nodeId,
      content: '',
      isActive: false,
      isNew: true,
      position
    }
    
    // 4. 添加到节点映射
    this.nodes.set(nodeId, node)
    
    // 5. 标记为待处理
    this.state.pendingNodes.add(nodeId)
    
    console.log('✅ [FORMULA-MANAGER] 公式节点创建完成', { nodeId, position })
    return nodeId
  }

  // 激活公式节点
  async activateFormula(nodeId: string): Promise<boolean> {
    console.log('🧮 [FORMULA-MANAGER] 激活公式节点', { nodeId })
    
    const node = this.nodes.get(nodeId)
    if (!node) {
      console.error('❌ [FORMULA-MANAGER] 节点不存在', { nodeId })
      return false
    }

    // 1. 失活其他节点
    if (this.state.activeNodeId && this.state.activeNodeId !== nodeId) {
      await this.deactivateFormula(this.state.activeNodeId)
    }

    // 2. 更新节点状态
    node.isActive = true
    this.state.activeNodeId = nodeId
    this.state.editingMode = true

    // 3. 从待处理列表中移除
    this.state.pendingNodes.delete(nodeId)

    console.log('✅ [FORMULA-MANAGER] 公式节点激活完成', { nodeId })
    return true
  }

  // 失活公式节点
  async deactivateFormula(nodeId: string): Promise<boolean> {
    console.log('🧮 [FORMULA-MANAGER] 失活公式节点', { nodeId })
    
    const node = this.nodes.get(nodeId)
    if (!node) {
      console.error('❌ [FORMULA-MANAGER] 节点不存在', { nodeId })
      return false
    }

    // 1. 更新节点状态
    node.isActive = false
    node.isNew = false

    // 2. 更新全局状态
    if (this.state.activeNodeId === nodeId) {
      this.state.activeNodeId = null
    }
    this.state.editingMode = false

    console.log('✅ [FORMULA-MANAGER] 公式节点失活完成', { nodeId })
    return true
  }

  // 更新公式内容
  updateFormulaContent(nodeId: string, content: string): boolean {
    console.log('🧮 [FORMULA-MANAGER] 更新公式内容', { nodeId, content })
    
    const node = this.nodes.get(nodeId)
    if (!node) {
      console.error('❌ [FORMULA-MANAGER] 节点不存在', { nodeId })
      return false
    }

    node.content = content
    console.log('✅ [FORMULA-MANAGER] 公式内容更新完成', { nodeId, content })
    return true
  }

  // 删除公式节点
  deleteFormula(nodeId: string): boolean {
    console.log('🧮 [FORMULA-MANAGER] 删除公式节点', { nodeId })
    
    const node = this.nodes.get(nodeId)
    if (!node) {
      console.error('❌ [FORMULA-MANAGER] 节点不存在', { nodeId })
      return false
    }

    // 1. 如果正在编辑，先失活
    if (node.isActive) {
      this.deactivateFormula(nodeId)
    }

    // 2. 从映射中移除
    this.nodes.delete(nodeId)

    // 3. 从待处理列表中移除
    this.state.pendingNodes.delete(nodeId)

    console.log('✅ [FORMULA-MANAGER] 公式节点删除完成', { nodeId })
    return true
  }

  // 获取节点信息
  getNode(nodeId: string): FormulaNode | undefined {
    return this.nodes.get(nodeId)
  }

  // 获取所有节点
  getAllNodes(): FormulaNode[] {
    return Array.from(this.nodes.values())
  }

  // 获取激活的节点
  getActiveNode(): FormulaNode | undefined {
    if (!this.state.activeNodeId) return undefined
    return this.nodes.get(this.state.activeNodeId)
  }

  // 检查节点是否激活
  isActive(nodeId: string): boolean {
    const node = this.nodes.get(nodeId)
    return node?.isActive || false
  }

  // 获取当前状态
  getState(): FormulaState {
    return { ...this.state }
  }

  // 清理现有公式状态
  private async cleanupExistingFormulas(): Promise<void> {
    console.log('🧮 [FORMULA-MANAGER] 清理现有公式状态')
    
    // 失活所有激活的节点
    for (const [nodeId, node] of this.nodes) {
      if (node.isActive) {
        await this.deactivateFormula(nodeId)
      }
    }

    // 清空待处理列表
    this.state.pendingNodes.clear()
    this.state.keyboardVisible = false
    this.state.editingMode = false

    console.log('✅ [FORMULA-MANAGER] 现有公式状态清理完成')
  }

  // 生成唯一ID
  private generateUniqueId(): string {
    return `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // 重置管理器状态
  reset(): void {
    console.log('🧮 [FORMULA-MANAGER] 重置管理器状态')
    
    this.nodes.clear()
    this.state = {
      activeNodeId: null,
      pendingNodes: new Set(),
      keyboardVisible: false,
      editingMode: false
    }

    console.log('✅ [FORMULA-MANAGER] 管理器状态重置完成')
  }
}
