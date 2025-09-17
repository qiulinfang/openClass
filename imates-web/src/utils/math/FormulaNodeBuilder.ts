/**
 * 公式节点构建器 - 负责创建和配置公式节点
 */

import { Node, Editor } from '@tiptap/core'
import { mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { FormulaNode, MathField } from '../../types'
import { FormulaManager } from './FormulaManager'
import { FormulaEventManager, FORMULA_EVENTS } from './FormulaEventManager'
import { MathLiveLoader } from './MathLiveLoader'
import { SmartFocusManager } from './SmartFocusManager'
import { FormulaErrorHandler, FormulaErrorType } from './FormulaErrorHandler'

export class FormulaNodeBuilder {
  private static instance: FormulaNodeBuilder | null = null
  private formulaManager: FormulaManager
  private eventManager: FormulaEventManager
  private mathLiveLoader: MathLiveLoader
  private focusManager: SmartFocusManager
  private errorHandler: FormulaErrorHandler
  
  // 🔧 简化：只维护必要的状态
  private nodeStates = new Map<string, {
    isActive: boolean
    focusTimeout: number | null
  }>()

  // 单例模式
  static getInstance(): FormulaNodeBuilder {
    if (!FormulaNodeBuilder.instance) {
      FormulaNodeBuilder.instance = new FormulaNodeBuilder()
    }
    return FormulaNodeBuilder.instance
  }

  constructor() {
    this.formulaManager = FormulaManager.getInstance()
    this.eventManager = FormulaEventManager.getInstance()
    this.mathLiveLoader = MathLiveLoader.getInstance()
    this.focusManager = SmartFocusManager.getInstance()
    this.errorHandler = FormulaErrorHandler.getInstance()
  }

  // 🔧 简化：获取节点状态
  private getNodeState(nodeId: string) {
    if (!this.nodeStates.has(nodeId)) {
      this.nodeStates.set(nodeId, {
        isActive: false,
        focusTimeout: null
      })
    }
    return this.nodeStates.get(nodeId)!
  }

  // 🔧 简化：清理节点状态
  private clearNodeState(nodeId: string) {
    const state = this.nodeStates.get(nodeId)
    if (state?.focusTimeout) {
      clearTimeout(state.focusTimeout)
    }
    this.nodeStates.delete(nodeId)
  }

  // 创建FormulaNode
  createFormulaNode(): unknown {
    console.log('🔧 [FORMULA-NODE-BUILDER] 创建FormulaNode')
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const builder = this;

    return Node.create({
      name: 'formula',
      group: 'inline',
      inline: true,
      atom: true,

      addAttributes() {
        return {
          formula: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-formula'),
            renderHTML: (attributes) => {
              if (!attributes.formula) {
                return {}
              }
              return {
                'data-formula': attributes.formula,
              }
            },
          },
          isNew: {
            default: false,
            parseHTML: (element) => element.getAttribute('data-new') === 'true',
            renderHTML: (attributes) => {
              if (!attributes.isNew) {
                return {}
              }
              return {
                'data-new': 'true',
              }
            },
          },
          nodeId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-node-id'),
            renderHTML: (attributes) => {
              if (!attributes.nodeId) {
                return {}
              }
              return {
                'data-node-id': attributes.nodeId,
              }
            },
          },
        }
      },

      parseHTML() {
        return [
          {
            tag: 'span[data-formula]',
          },
        ]
      },

      renderHTML({ HTMLAttributes }) {
        return [
          'span',
          mergeAttributes(HTMLAttributes, {
            class: 'formula-node',
          }),
        ]
      },

      addNodeView() {
        return ({ node, getPos, editor }) => {
          return builder.buildNodeView(node as unknown as FormulaNode, getPos, editor)
        }
      },
    })
  }

  // 构建节点视图
  private buildNodeView(node: FormulaNode, getPos: () => number | undefined, editor: Editor) {
    console.log('🔧 [FORMULA-NODE-BUILDER] 构建节点视图')
    
    // 1. 创建容器元素
    const container = this.createContainer(node)
    
    // 2. 异步初始化MathLive
    this.initializeMathLive(container, node, getPos, editor)
    
    // 3. 返回NodeView接口
    return {
      dom: container,
      update: (updatedNode: ProseMirrorNode) => this.updateNode(updatedNode, container),
      destroy: () => this.destroyNode(container),
    }
  }

  // 创建容器元素
  private createContainer(node: FormulaNode): HTMLElement {
    console.log('🔧 [FORMULA-NODE-BUILDER] 创建容器元素')
    
    const container = document.createElement('span')
    const { isNew, nodeId } = node.attrs
    
    // 使用传入的nodeId，如果没有则生成新的
    const finalNodeId = nodeId || `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    container.setAttribute('data-node-id', finalNodeId)
    
    // 设置初始样式类
    container.className = isNew
      ? 'formula-node-container formula-active'
      : 'formula-node-container formula-inactive'
    
    console.log('✅ [FORMULA-NODE-BUILDER] 容器元素创建完成', { nodeId: finalNodeId, isNew })
    return container
  }

  // 异步初始化MathLive
  private async initializeMathLive(
    container: HTMLElement, 
    node: FormulaNode, 
    getPos: () => number | undefined, 
    editor: Editor
  ): Promise<void> {
    console.log('🔧 [FORMULA-NODE-BUILDER] 开始异步初始化MathLive')
    
    const nodeId = container.getAttribute('data-node-id')!
    const { isNew } = node.attrs
    
    try {
      // 1. 加载MathLive库
      const MathfieldElement = await this.mathLiveLoader.loadMathLive()
      
      // 2. 创建MathField实例
      const mathField = new (MathfieldElement as unknown as new () => MathField)()
      
      // 3. 配置MathField
      this.configureMathField(mathField, isNew)
      
      // 4. 设置事件监听器
      this.setupMathFieldListeners(mathField, container, getPos, editor)
      
      // 5. 添加到容器
      container.appendChild(mathField as unknown as HTMLElement)
      
      // 6. !!将MathLive编辑器的实例信息同步到FormulaManager中!!
      this.updateFormulaManagerNode(nodeId, mathField, container)
      
      // 7. 如果是新节点，执行聚焦流程
      if (isNew) {
        await this.handleNewNodeFocus(mathField, nodeId, getPos, editor)
      }
      
      // 8. 发出初始化完成事件
      this.eventManager.emit(FORMULA_EVENTS.CREATED, {
        nodeId,
        mathField,
        container,
        isNew
      })
      
      console.log('✅ [FORMULA-NODE-BUILDER] MathLive初始化完成', { nodeId })
      
    } catch (error) {
      console.error('❌ [FORMULA-NODE-BUILDER] MathLive初始化失败', { nodeId, error })
      
      const formulaError = this.errorHandler.createError(
        FormulaErrorType.INITIALIZATION_FAILED,
        `MathLive初始化失败: ${error instanceof Error ? error.message : String(error)}`,
        nodeId,
        error instanceof Error ? error : undefined
      )
      
      await this.errorHandler.handleError(formulaError)
    }
  }

  // 配置MathField
  private configureMathField(mathField: MathField, isInitiallyActive: boolean): void {
    console.log('🔧 [FORMULA-NODE-BUILDER] 配置MathField')
    
    mathField.setOptions({
      mathVirtualKeyboardPolicy: 'manual',
      virtualKeyboardMode: 'manual',
      defaultMode: 'math',
      fontSize: 16,
      placeholder: '输入内容...',
      smartMode: true,
      smartSuperscript: true,
      theme: 'light',
      toolbar: 'none',
      autoComplete: 'off',
      selectionMode: 'none',
      contextMenu: 'none',
      dragMode: 'none',
      readOnly: !isInitiallyActive,
      border: 'none',
      backgroundColor: 'transparent',
      decorations: false,
      inputMode: 'none',
    })
  }

  // 设置MathField事件监听器
  private setupMathFieldListeners(
    mathField: MathField, 
    container: HTMLElement, 
    getPos: () => number | undefined, 
    editor: Editor
  ): void {
    console.log('🔧 [FORMULA-NODE-BUILDER] 设置MathField事件监听器')
    
    const nodeId = container.getAttribute('data-node-id')!
    
    // 输入事件
    mathField.addEventListener('input', (event: Event) => {
      const target = event.target as unknown as MathField
      const value = target.value || target.getValue() || ''
      console.log('🧮 [FORMULA-INPUT] 公式内容变化', { nodeId, value })
      
      // 更新公式管理器中的内容
      this.formulaManager.updateFormulaContent(nodeId, value)
      
      // 更新编辑器中的节点
      this.updateEditorNode(getPos, editor, value)
      
      // 发出内容变化事件
      this.eventManager.emit(FORMULA_EVENTS.CONTENT_CHANGED, {
        nodeId,
        content: value
      })
    })
    
    // 聚焦事件 - 添加防循环机制
    mathField.addEventListener('focus', () => {
      console.log('🎯 [FORMULA-FOCUS] 公式获得焦点', { nodeId })
      
      const nodeState = this.getNodeState(nodeId)
      
      // 防止重复聚焦
      if (nodeState.isActive) {
        console.log('⚠️ [FORMULA-FOCUS] 公式已激活，跳过重复聚焦', { nodeId })
        return
      }
      
      // 添加防循环延迟
      if (nodeState.focusTimeout) {
        clearTimeout(nodeState.focusTimeout)
      }
      
      nodeState.focusTimeout = setTimeout(() => {
        nodeState.isActive = true
        
        // 激活公式节点
        this.formulaManager.activateFormula(nodeId)
        
        // 设置可编辑状态
        this.setMathFieldEditable(mathField, nodeId, true)
        
        // 显示虚拟键盘
        this.showVirtualKeyboard(mathField, nodeId)
        
        // 发出聚焦事件
        this.eventManager.emit(FORMULA_EVENTS.FOCUS, { nodeId, mathField })
        
        console.log('✅ [FORMULA-FOCUS] 聚焦处理完成', { nodeId })
      }, 50) // 50ms 防循环延迟
    })
    
    // 失焦事件 - 添加防循环机制
    mathField.addEventListener('blur', () => {
      const nodeState = this.getNodeState(nodeId)
      
      // 防止重复失焦
      if (!nodeState.isActive) {
        console.log('⚠️ [FORMULA-BLUR] 公式未激活，跳过失焦', { nodeId })
        return
      }
      
      console.log('🎯 [FORMULA-BLUR] 公式失去焦点', { nodeId })
      
      // 立即设置状态，防止重复处理
      nodeState.isActive = false
      
      // 清除聚焦定时器
      if (nodeState.focusTimeout) {
        clearTimeout(nodeState.focusTimeout)
        nodeState.focusTimeout = null
      }
      
      // 失活公式节点
      this.formulaManager.deactivateFormula(nodeId)
      
      // 设置只读状态
      this.setMathFieldEditable(mathField, nodeId, false)
      
      // 隐藏虚拟键盘
      this.hideVirtualKeyboard(mathField, nodeId)
      
      // 发出失焦事件
      this.eventManager.emit(FORMULA_EVENTS.BLUR, { nodeId, mathField })
      
      console.log('✅ [FORMULA-BLUR] 失焦处理完成', { nodeId })
    })
    
    // 键盘事件
    mathField.addEventListener('keydown', (event: Event) => {
      const keyboardEvent = event as KeyboardEvent
      console.log('⌨️ [FORMULA-KEYDOWN] 键盘事件', { nodeId, key: keyboardEvent.key })
      
      if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
        keyboardEvent.preventDefault()
        console.log('📤 [FORMULA-ENTER] 回车键完成编辑', { nodeId })
        
        // 失活公式节点
        this.formulaManager.deactivateFormula(nodeId)
        
        // 发出回车事件
        this.eventManager.emit(FORMULA_EVENTS.ENTER, { nodeId, mathField })
        
      } else if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault()
        console.log('🚫 [FORMULA-ESCAPE] ESC键取消编辑', { nodeId })
        
        // 失活公式节点
        this.formulaManager.deactivateFormula(nodeId)
        
        // 发出ESC事件
        this.eventManager.emit(FORMULA_EVENTS.ESCAPE, { nodeId, mathField })
      }
    })
  }

  // 设置MathField编辑状态
  private setMathFieldEditable(mathField: MathField, nodeId: string, editable: boolean): void {
    try {
      if (typeof mathField.setOptions === 'function') {
        mathField.setOptions({
          readOnly: !editable,
          selectionMode: 'none'
        })
        console.log(`✅ [MATH-FIELD] 设置为${editable ? '可编辑' : '只读'}状态`, { nodeId })
      }
    } catch (error) {
      console.error(`❌ [MATH-FIELD] 设置${editable ? '可编辑' : '只读'}状态失败`, { nodeId, error })
    }
  }

  // 显示虚拟键盘
  private showVirtualKeyboard(mathField: MathField, nodeId: string): void {
    try {
      if (typeof mathField.executeCommand === 'function') {
        mathField.executeCommand('showVirtualKeyboard')
        console.log('✅ [KEYBOARD] 虚拟键盘已显示', { nodeId })
      }
    } catch (error) {
      console.error('❌ [KEYBOARD] 显示虚拟键盘失败', { nodeId, error })
    }
    
    // 触发键盘显示事件
    const keyboardEvent = new CustomEvent('custom-keyboard-toggle', {
      detail: { visible: true, height: 300 }
    })
    window.dispatchEvent(keyboardEvent)
    
    // 添加强制重置动画状态的机制
    this.forceResetAnimationState()
  }

  // 隐藏虚拟键盘
  private hideVirtualKeyboard(mathField: MathField, nodeId: string): void {
    try {
      if (typeof mathField.executeCommand === 'function') {
        mathField.executeCommand('hideVirtualKeyboard')
        console.log('✅ [KEYBOARD] 虚拟键盘已隐藏', { nodeId })
      }
    } catch (error) {
      console.error('❌ [KEYBOARD] 隐藏虚拟键盘失败', { nodeId, error })
    }
    
    // 触发键盘隐藏事件
    const keyboardEvent = new CustomEvent('custom-keyboard-toggle', {
      detail: { visible: false, height: 0 }
    })
    window.dispatchEvent(keyboardEvent)
    
    // 添加强制重置动画状态的机制
    this.forceResetAnimationState()
  }

  // 强制重置动画状态
  private forceResetAnimationState(): void {
    // 延迟重置，确保动画状态能够正确恢复
    setTimeout(() => {
      // 通过事件通知 ChatView 重置动画状态
      const resetEvent = new CustomEvent('force-reset-animation-state')
      window.dispatchEvent(resetEvent)
      console.log('🔄 [ANIMATION] 强制重置动画状态事件已发送')
    }, 100)
  }

  // 处理新节点聚焦 - 简化版本
  private async handleNewNodeFocus(
    mathField: MathField, 
    nodeId: string, 
    getPos: () => number | undefined, 
    editor: Editor
  ): Promise<void> {
    console.log('🔧 [FORMULA-NODE-BUILDER] 处理新节点聚焦', { nodeId })
    
    try {
      // 激活公式节点
      await this.formulaManager.activateFormula(nodeId)
      
      // 设置节点为活跃状态
      const nodeState = this.getNodeState(nodeId)
      nodeState.isActive = true
      
      // 设置可编辑状态
      this.setMathFieldEditable(mathField, nodeId, true)
      
      // 显示虚拟键盘
      this.showVirtualKeyboard(mathField, nodeId)
      
      // 延迟聚焦，等待DOM稳定
      setTimeout(async () => {
        try {
          await this.focusManager.focusFormula(nodeId, mathField, {
            scrollIntoView: true,
            showKeyboard: false,
            delay: 0,
            ensureVisible: true
          })
          console.log('✅ [FORMULA-NODE-BUILDER] 聚焦完成', { nodeId })
        } catch (error) {
          console.error('❌ [FORMULA-NODE-BUILDER] 聚焦失败', { nodeId, error })
        }
      }, 300)
      
      // 移除isNew标记
      if (typeof getPos === 'function' && getPos() !== undefined) {
        const pos = getPos()
        if (pos !== undefined) {
          const transaction = editor.view.state.tr.setNodeMarkup(pos, undefined, { isNew: false })
          editor.view.dispatch(transaction)
        }
      }
      
    } catch (error) {
      console.error('❌ [FORMULA-NODE-BUILDER] 新节点聚焦失败', { nodeId, error })
    }
  }

  // 更新公式管理器中的节点信息
  private updateFormulaManagerNode(nodeId: string, mathField: MathField, container: HTMLElement): void {
    console.log('🔧 [FORMULA-NODE-BUILDER] 更新公式管理器节点信息', { nodeId })
    
    const node = this.formulaManager.getNode(nodeId)
    if (node) {
      node.mathField = mathField      // 保存MathField实例
      node.container = container      // 保存DOM容器
    }
  }

  // 更新编辑器节点
  private updateEditorNode(getPos: () => number | undefined, editor: Editor, value: string): void {
    if (typeof getPos === 'function' && getPos() !== undefined) {
      const pos = getPos()
      if (pos !== undefined) {
        const transaction = editor.view.state.tr.setNodeMarkup(pos, undefined, {
          formula: value,
        })
        editor.view.dispatch(transaction)
      }
    }
  }

  // 更新节点
  private updateNode(updatedNode: ProseMirrorNode, container: HTMLElement): boolean { 
    console.log('🔧 [FORMULA-NODE-BUILDER] 更新节点')
    
    const nodeId = container.getAttribute('data-node-id')
    if (!nodeId) {
      // 如果无法处理，理论上应该返回 false
      return false 
    }
    
    // 检查节点类型是否改变，如果改变了，则无法更新，应由Tiptap重建
    if (updatedNode.type.name !== 'formula') {
      return false
    }
    
    const formulaNode = updatedNode as unknown as FormulaNode
    const newFormula = formulaNode.attrs.formula
    const mathField = container.querySelector('math-field') as unknown as MathField; // 假设 math-field 是存在的
    
    if (mathField && mathField.getValue() !== newFormula) {
      console.log(`🔄 [FORMULA-NODE-BUILDER] 更新公式内容: ${newFormula}`)
      mathField.setValue(newFormula)
      this.formulaManager.updateFormulaContent(nodeId, newFormula)
    }
  
    // 表示我们成功处理了更新
    return true 
  }

  // 销毁节点
  private destroyNode(container: HTMLElement): void {
    console.log('🔧 [FORMULA-NODE-BUILDER] 销毁节点')
    
    const nodeId = container.getAttribute('data-node-id')
    if (nodeId) {
      // 🔧 修复：清理节点独立状态
      this.clearNodeState(nodeId)
      
      this.formulaManager.deleteFormula(nodeId)
      this.eventManager.emit(FORMULA_EVENTS.DELETED, { nodeId })
      
      console.log('✅ [FORMULA-NODE-BUILDER] 节点销毁完成，状态已清理', { nodeId })
    }
  }
}
