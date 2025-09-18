/**
 * 公式管理器 - 负责管理所有公式节点的生命周期
 * 
 * 主要职责：
 * 1. 管理公式节点的创建、激活、失活、删除
 * 2. 维护全局公式状态（确保同时只有一个公式处于编辑状态）
 * 3. 提供节点查询和状态检查接口
 * 4. 管理MathField实例和DOM容器的引用
 * 
 * 方法命名说明：
 * - setNodeActive/setNodeInactive: 纯状态管理方法，只处理内存中的状态更新
 * 
 * 注意：此类只负责状态管理，不涉及UI操作（如聚焦、键盘显示等）
 */
export interface FormulaNode {
  id: string              // 节点唯一标识符
  content: string         // 公式内容（LaTeX格式）
  isActive: boolean       // 是否处于激活状态（正在编辑）
  isNew: boolean          // 是否为新创建的节点
  position: number        // 在编辑器中的位置（字符偏移量）
  mathField?: unknown     // MathLive编辑器实例引用
  container?: HTMLElement // DOM容器元素引用
}

export interface FormulaState {
  activeNodeId: string | null  // 当前激活的公式节点ID（同时只能有一个）
  pendingNodes: Set<string>    // 待处理的节点ID集合（已创建但未完全初始化）
  keyboardVisible: boolean     // 虚拟键盘是否可见
  editingMode: boolean         // 是否处于公式编辑模式
}

export class FormulaManager {
  // 单例实例
  private static instance: FormulaManager | null = null
  
  // 存储所有公式节点的映射表，key为nodeId，value为FormulaNode对象
  private nodes = new Map<string, FormulaNode>()
  
  // 全局公式状态
  private state: FormulaState = {
    activeNodeId: null,        // 当前激活的节点ID
    pendingNodes: new Set(),   // 待处理的节点ID集合
    keyboardVisible: false,    // 虚拟键盘可见性
    editingMode: false         // 编辑模式状态
  }

  /**
   * 获取FormulaManager单例实例
   * 使用单例模式确保全局只有一个公式管理器实例
   * @returns FormulaManager实例
   */
  static getInstance(): FormulaManager {
    if (!FormulaManager.instance) {
      FormulaManager.instance = new FormulaManager()
    }
    return FormulaManager.instance
  }

  /**
   * 创建新的公式节点
   * 
   * 流程：
   * 1. 清理现有激活的公式节点（确保同时只有一个激活）
   * 2. 生成唯一ID
   * 3. 创建节点对象并存储
   * 4. 标记为待处理状态
   * 
   * @param position 在编辑器中的位置（字符偏移量）
   * @returns 新创建的节点ID
   */
  async createFormula(position: number): Promise<string> {
    
    // 1. 清理现有公式状态（确保同时只有一个公式处于激活状态）
    await this.cleanupExistingFormulas()
    
    // 2. 生成唯一ID（时间戳 + 随机字符串）
    const nodeId = this.generateUniqueId()
    
    // 3. 创建节点对象
    const node: FormulaNode = {
      id: nodeId,                    // 节点唯一标识
      content: '',                   // 初始内容为空
      isActive: false,               // 初始状态为非激活
      isNew: true,                   // 标记为新节点
      position,                      // 在编辑器中的位置
      mathField: undefined,          // MathField实例（在MathLive初始化完成后更新）
      container: undefined           // DOM容器（在MathLive初始化完成后更新）
    }
    
    // 4. 添加到节点映射表
    this.nodes.set(nodeId, node)
    
    // 5. 标记为待处理状态（等待MathLive初始化完成）
    this.state.pendingNodes.add(nodeId)
    return nodeId
  }

  /**
   * 设置节点为激活状态（纯状态管理）
   * 
   * 流程：
   * 1. 检查节点是否存在
   * 2. 更新节点状态为激活
   * 3. 更新全局状态
   * 4. 从待处理列表中移除
   * 
   * 注意：此方法只负责状态管理，不处理其他节点的失活逻辑
   * 失活其他节点的逻辑由 SmartFocusManager 负责
   * 
   * @param nodeId 要激活的节点ID
   * @returns 是否激活成功
   */
  async setNodeActive(nodeId: string): Promise<boolean> {
    // 1. 检查节点是否存在
    const node = this.nodes.get(nodeId)
    if (!node) {
      return false
    }

    // 2. 更新节点状态
    node.isActive = true
    this.state.activeNodeId = nodeId
    this.state.editingMode = true

    // 3. 从待处理列表中移除（节点已完全初始化）
    this.state.pendingNodes.delete(nodeId)
    return true
  }

  /**
   * 设置节点为非激活状态（纯状态管理）
   * 
   * 流程：
   * 1. 检查节点是否存在
   * 2. 更新节点状态为非激活
   * 3. 更新全局状态
   * 
   * @param nodeId 要失活的节点ID
   * @returns 是否失活成功
   */
  async setNodeInactive(nodeId: string): Promise<boolean> {
    // 1. 检查节点是否存在
    const node = this.nodes.get(nodeId)
    if (!node) {
      return false
    }

    // 2. 更新节点状态
    node.isActive = false
    node.isNew = false  // 失活后不再是新节点

    // 3. 更新全局状态
    if (this.state.activeNodeId === nodeId) {
      this.state.activeNodeId = null  // 清除激活节点ID
    }
    
    // 4. 检查是否还有其他激活的节点
    const hasActiveNodes = Array.from(this.nodes.values()).some(n => n.isActive)
    if (!hasActiveNodes) {
      this.state.editingMode = false  // 没有激活节点时退出编辑模式
    }

    return true
  }

  /**
   * 更新公式内容
   * 
   * 当用户在MathLive编辑器中输入内容时，会调用此方法更新节点内容
   * 
   * @param nodeId 节点ID
   * @param content 新的公式内容（LaTeX格式）
   * @returns 是否更新成功
   */
  updateFormulaContent(nodeId: string, content: string): boolean {
    
    // 1. 检查节点是否存在
    const node = this.nodes.get(nodeId)
    if (!node) {
      return false
    }

    // 2. 更新节点内容
    node.content = content
    return true
  }

  /**
   * 删除公式节点
   * 
   * 流程：
   * 1. 检查节点是否存在
   * 2. 如果节点正在编辑，先失活
   * 3. 从节点映射表中移除
   * 4. 从待处理列表中移除
   * 
   * @param nodeId 要删除的节点ID
   * @returns 是否删除成功
   */
  deleteFormula(nodeId: string): boolean {
    
    // 1. 检查节点是否存在
    const node = this.nodes.get(nodeId)
    if (!node) {
      return false
    }

    // 2. 如果节点正在编辑，先失活（避免状态不一致）
    if (node.isActive) {
      this.setNodeInactive(nodeId)
    }

    // 3. 从节点映射表中移除
    this.nodes.delete(nodeId)

    // 4. 从待处理列表中移除
    this.state.pendingNodes.delete(nodeId)

    return true
  }

  /**
   * 获取指定节点信息
   * @param nodeId 节点ID
   * @returns 节点对象，如果不存在则返回undefined
   */
  getNode(nodeId: string): FormulaNode | undefined {
    return this.nodes.get(nodeId)
  }

  /**
   * 获取所有公式节点
   * @returns 所有节点对象的数组
   */
  getAllNodes(): FormulaNode[] {
    return Array.from(this.nodes.values())
  }

  /**
   * 获取当前激活的节点
   * @returns 激活的节点对象，如果没有激活节点则返回undefined
   */
  getActiveNode(): FormulaNode | undefined {
    if (!this.state.activeNodeId) return undefined
    return this.nodes.get(this.state.activeNodeId)
  }

  /**
   * 检查指定节点是否处于激活状态
   * @param nodeId 节点ID
   * @returns 是否激活
   */
  isActive(nodeId: string): boolean {
    const node = this.nodes.get(nodeId)
    return node?.isActive || false
  }

  /**
   * 获取当前全局状态
   * @returns 状态对象的副本
   */
  getState(): FormulaState {
    return { ...this.state }
  }

  /**
   * 清理现有公式状态
   * 
   * 在创建新公式前调用，确保：
   * 1. 所有激活的节点都被失活
   * 2. 清空待处理列表
   * 3. 重置全局状态
   * 
   * 这确保了同时只有一个公式处于编辑状态
   */
  private async cleanupExistingFormulas(): Promise<void> {
    
    // 1. 失活所有激活的节点
    for (const [nodeId, node] of this.nodes) {
      if (node.isActive) {
        await this.setNodeInactive(nodeId)
      }
    }

    // 2. 清空待处理列表和重置全局状态
    this.state.pendingNodes.clear()
    this.state.keyboardVisible = false
    this.state.editingMode = false

  }

  /**
   * 生成唯一节点ID
   * 
   * 格式：formula-{时间戳}-{随机字符串}
   * 确保每个节点都有唯一的标识符
   * 
   * @returns 唯一的节点ID
   */
  private generateUniqueId(): string {
    return `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 重置管理器状态
   * 
   * 清空所有节点和状态，用于组件卸载或重新初始化
   */
  reset(): void {
    
    // 清空所有节点
    this.nodes.clear()
    
    // 重置全局状态
    this.state = {
      activeNodeId: null,
      pendingNodes: new Set(),
      keyboardVisible: false,
      editingMode: false
    }

  }

}
