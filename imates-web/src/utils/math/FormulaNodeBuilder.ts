/**
 * 公式节点构建器 - 负责创建和配置公式节点
 */

import { Node, Editor } from '@tiptap/core'
import { mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { FormulaNode, MathField } from '../../types'
import { FormulaManager } from './FormulaManager'
import { MathLiveLoader } from './MathLiveLoader'
import { SmartFocusManager } from './SmartFocusManager'
import { FormulaErrorHandler, FormulaErrorType } from './FormulaErrorHandler'

export class FormulaNodeBuilder {
  private static instance: FormulaNodeBuilder | null = null
  private formulaManager: FormulaManager
  private mathLiveLoader: MathLiveLoader
  private focusManager: SmartFocusManager
  private errorHandler: FormulaErrorHandler
  
  // 🔧 简化：只维护必要的本地状态（聚焦超时）
  private focusTimeouts = new Map<string, number | null>()

  // 单例模式
  static getInstance(): FormulaNodeBuilder {
    if (!FormulaNodeBuilder.instance) {
      FormulaNodeBuilder.instance = new FormulaNodeBuilder()
    }
    return FormulaNodeBuilder.instance
  }

  constructor() {
    this.formulaManager = FormulaManager.getInstance()
    this.mathLiveLoader = MathLiveLoader.getInstance()
    this.focusManager = SmartFocusManager.getInstance()
    this.errorHandler = FormulaErrorHandler.getInstance()
  }


  // 🔧 简化：设置聚焦超时
  private setFocusTimeout(nodeId: string, timeout: number | null): void {
    if (timeout) {
      this.focusTimeouts.set(nodeId, timeout)
    } else {
      this.focusTimeouts.delete(nodeId)
    }
  }

  // 🔧 简化：清理聚焦超时
  private clearFocusTimeout(nodeId: string): void {
    const timeout = this.focusTimeouts.get(nodeId)
    if (timeout) {
      clearTimeout(timeout)
      this.focusTimeouts.delete(nodeId)
    }
  }

  // 创建FormulaNode
  createFormulaNode(): unknown {
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
    const container = document.createElement('span')
    const { nodeId } = node.attrs
    
    // 使用传入的nodeId，如果没有则生成新的
    const finalNodeId = nodeId || `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    container.setAttribute('data-node-id', finalNodeId)
    
    // 基于FormulaManager的状态判断激活状态
    const formulaNode = this.formulaManager.getNode(finalNodeId)
    const isActive = formulaNode?.isActive || false
    
    // 设置初始样式类和定位
    container.className = isActive
      ? 'formula-node-container formula-active'
      : 'formula-node-container formula-inactive'
    
    // 设置相对定位，确保ID标签能正确显示
    container.style.position = 'relative'
    
    // 创建纯文本显示元素
    this.createTextDisplay(container, finalNodeId, node.attrs.formula || '')
    
    // 创建ID显示标签
    this.createIdDisplayLabel(container, finalNodeId)
    return container
  }

  // 创建纯文本显示元素
  private createTextDisplay(container: HTMLElement, nodeId: string, formula: string): void {
    // 创建纯文本显示元素
    const textDisplay = document.createElement('span')
    textDisplay.className = 'formula-text-display'
    textDisplay.textContent = formula || '点击编辑公式'
    textDisplay.setAttribute('data-node-id', nodeId)
    
    // 设置基础样式
    this.updateTextDisplayStyle(textDisplay, false)
    
    // 添加点击事件监听器
    textDisplay.addEventListener('click', (event) => {
      event.stopPropagation()
      this.handleTextDisplayClick(nodeId, container)
    })
    
    // 将纯文本显示元素添加到容器
    container.appendChild(textDisplay)
  }

  // 创建ID显示标签
  private createIdDisplayLabel(container: HTMLElement, nodeId: string): void {
    // 提取ID的后6位数字/字符作为显示标识
    const displayId = nodeId.slice(-6)
    
    // 创建ID显示标签
    const idLabel = document.createElement('span')
    idLabel.className = 'formula-id-label'
    idLabel.textContent = `#${displayId}`
    idLabel.title = `公式ID: ${nodeId}` // 鼠标悬停显示完整ID
    idLabel.setAttribute('data-node-id', nodeId) // 存储完整ID用于后续操作
    
    // 设置基础样式
    this.updateIdLabelStyle(idLabel, false)
    
    // 将标签添加到容器
    container.appendChild(idLabel)
  }

  // 更新纯文本显示样式
  private updateTextDisplayStyle(textDisplay: HTMLElement, isActive: boolean): void {
    const baseStyle = `
      display: ${isActive ? 'none' : 'inline-block'};
      padding: 2px 6px;
      margin: 0 2px;
      border: 1px solid ${isActive ? '#007bff' : '#e0e0e0'};
      border-radius: 3px;
      background: ${isActive ? 'rgba(0, 123, 255, 0.1)' : '#f8f9fa'};
      color: #333;
      cursor: pointer;
      font-family: monospace;
      font-size: 14px;
      line-height: 1.2;
      min-width: 20px;
      min-height: 20px;
      transition: all 0.2s ease;
      user-select: none;
      box-shadow: ${isActive ? '0 0 0 1px rgba(0, 123, 255, 0.3)' : 'none'};
    `
    
    textDisplay.style.cssText = baseStyle
  }

  // 更新ID标签样式
  private updateIdLabelStyle(idLabel: HTMLElement, isActive: boolean): void {
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

  // 处理纯文本显示点击事件
  private async handleTextDisplayClick(nodeId: string, container: HTMLElement): Promise<void> {
    try {
      // 获取MathField实例
      const mathField = container.querySelector('math-field') as unknown as MathField
      if (!mathField) {
        console.warn('MathField not found for node:', nodeId)
        return
      }

      // 禁用原生键盘事件监听器，避免冲突
      if (typeof (window as any).disableNativeKeyboardListeners === 'function') {
        (window as any).disableNativeKeyboardListeners()
      }
      
      // 调用Android API禁用原生键盘
      if (typeof (window as any).AndroidBridge?.disableNativeKeyboard === 'function') {
        try {
          const result = (window as any).AndroidBridge.disableNativeKeyboard()
          console.log('🎯 [FORMULA_NODE_BUILDER] Android禁用原生键盘结果:', result)
        } catch (error) {
          console.warn('🎯 [FORMULA_NODE_BUILDER] Android禁用原生键盘失败:', error)
        }
      }

      // 隐藏纯文本显示，显示公式编辑器
      this.toggleDisplayMode(container, true)

      // 激活公式编辑器
      await this.focusManager.activateFormula(nodeId, mathField, {
        scrollIntoView: true,
        showKeyboard: true,
        delay: 100,
        ensureVisible: true
      })
    } catch (error) {
      console.error('Failed to activate formula from text display:', error)
      // 出错时也要重新启用原生键盘监听器
      if (typeof (window as any).enableNativeKeyboardListeners === 'function') {
        (window as any).enableNativeKeyboardListeners()
      }
    }
  }

  // 切换显示模式（纯文本/公式编辑器）
  private toggleDisplayMode(container: HTMLElement, showEditor: boolean): void {
    const textDisplay = container.querySelector('.formula-text-display') as HTMLElement
    const mathField = container.querySelector('math-field') as HTMLElement
    
    if (textDisplay) {
      this.updateTextDisplayStyle(textDisplay, showEditor)
    }
    
    if (mathField) {
      mathField.style.display = showEditor ? 'inline-block' : 'none'
    }
  }

  // 更新纯文本显示内容
  private updateTextDisplayContent(container: HTMLElement, formula: string): void {
    const textDisplay = container.querySelector('.formula-text-display') as HTMLElement
    if (textDisplay) {
      textDisplay.textContent = formula || '点击编辑公式'
    }
  }

  // 异步初始化MathLive
  private async initializeMathLive(
    container: HTMLElement, 
    node: FormulaNode, 
    getPos: () => number | undefined, 
    editor: Editor
  ): Promise<void> {
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
      
      // 6. 设置初始显示模式（新节点显示编辑器，已存在节点显示纯文本）
      this.toggleDisplayMode(container, isNew)
      
      // 7. !!将MathLive编辑器的实例信息同步到FormulaManager中!!
      this.updateFormulaManagerNode(nodeId, mathField, container)
      
      // 8. 如果是新节点，执行聚焦流程
      if (isNew) {
        await this.handleNewNodeFocus(mathField, nodeId, getPos, editor)
      }
      
      // 8. 初始化完成（移除事件发送）
    } catch (error) {
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
    // 使用直接属性设置替代废弃的setOptions方法
    mathField.mathVirtualKeyboardPolicy = 'manual'
    mathField.virtualKeyboardMode = 'manual'
    mathField.defaultMode = 'math'
    mathField.fontSize = 16
    mathField.placeholder = '输入内容...'
    mathField.smartMode = true
    mathField.smartSuperscript = true
    mathField.theme = 'light'
    mathField.toolbar = 'none'
    mathField.autoComplete = 'off'
    mathField.selectionMode = 'text'
    mathField.contextMenu = 'none'
    mathField.dragMode = 'none'
    mathField.readOnly = !isInitiallyActive
    mathField.border = 'none'
    mathField.backgroundColor = 'transparent'
    mathField.decorations = false
    mathField.inputMode = 'none'
  }

  // 设置MathField事件监听器
  private setupMathFieldListeners(
    mathField: MathField, 
    container: HTMLElement, 
    getPos: () => number | undefined, 
    editor: Editor
  ): void {
    const nodeId = container.getAttribute('data-node-id')!
    
    // 点击事件 - 阻止冒泡到编辑器
    mathField.addEventListener('click', (event: Event) => {
      // 阻止事件冒泡到 TiptapEditor 的 handleEditorClick
      event.stopPropagation()
      
      // 阻止默认行为（如果有的话）
      event.preventDefault()
    })
    
    // 容器点击事件 - 双重保险，确保整个公式节点区域都阻止冒泡
    container.addEventListener('click', (event: Event) => {
      // 阻止事件冒泡到 TiptapEditor 的 handleEditorClick
      event.stopPropagation()
    })
    
    // 输入事件
    mathField.addEventListener('input', (event: Event) => {
      const target = event.target as unknown as MathField
      const value = target.value || target.getValue() || ''
      
      // 更新公式管理器中的内容
      this.formulaManager.updateFormulaContent(nodeId, value)
      
      // 更新编辑器中的节点
      this.updateEditorNode(getPos, editor, value)
      
      // 更新纯文本显示内容
      this.updateTextDisplayContent(container, value)
      
      // 内容变化处理完成（移除事件发送）
    })
    
    // 聚焦事件 - 添加防循环机制
    mathField.addEventListener('focus', () => {
      
      // 防止重复聚焦（使用 SmartFocusManager 的状态）
      if (this.focusManager.isNodeActive(nodeId)) {
        return
      }
      
      // 切换到公式编辑器显示模式
      this.toggleDisplayMode(container, true)
      
      // 添加防循环延迟
      this.clearFocusTimeout(nodeId)
      
      const timeout = setTimeout(async () => {
        // 使用 SmartFocusManager 统一激活
        await this.focusManager.activateFormula(nodeId, mathField, {
          scrollIntoView: false, // focus 事件不需要滚动
          showKeyboard: true,
          delay: 0
        })
        
      }, 50) // 50ms 防循环延迟
      
      this.setFocusTimeout(nodeId, timeout)
    })
    
    // 失焦事件 - 添加防循环机制
    mathField.addEventListener('blur', () => {
      // 防止重复失焦（使用 SmartFocusManager 的状态）
      if (!this.focusManager.isNodeActive(nodeId)) {
        return
      }
      
      // 清除聚焦定时器
      this.clearFocusTimeout(nodeId)
      
      // 切换到纯文本显示模式
      this.toggleDisplayMode(container, false)
      
      // 使用 SmartFocusManager 统一失活
      this.focusManager.deactivateFormula(nodeId, mathField)
      
      // 重新启用原生键盘事件监听器
      if (typeof (window as any).enableNativeKeyboardListeners === 'function') {
        (window as any).enableNativeKeyboardListeners()
      }
      
      // 调用Android API启用原生键盘
      if (typeof (window as any).AndroidBridge?.enableNativeKeyboard === 'function') {
        try {
          const result = (window as any).AndroidBridge.enableNativeKeyboard()
          console.log('🎯 [FORMULA_NODE_BUILDER] Android启用原生键盘结果:', result)
        } catch (error) {
          console.warn('🎯 [FORMULA_NODE_BUILDER] Android启用原生键盘失败:', error)
        }
      }
    })
    
    // 键盘事件
    mathField.addEventListener('keydown', (event: Event) => {
      const keyboardEvent = event as KeyboardEvent
      if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
        keyboardEvent.preventDefault()
        // 使用 SmartFocusManager 统一失活
        this.focusManager.deactivateFormula(nodeId, mathField)
        
        // 重新启用原生键盘事件监听器
        if (typeof (window as any).enableNativeKeyboardListeners === 'function') {
          (window as any).enableNativeKeyboardListeners()
        }
        
        // 调用Android API启用原生键盘
        if (typeof (window as any).AndroidBridge?.enableNativeKeyboard === 'function') {
          try {
            const result = (window as any).AndroidBridge.enableNativeKeyboard()
            console.log('🎯 [FORMULA_NODE_BUILDER] Android启用原生键盘结果:', result)
          } catch (error) {
            console.warn('🎯 [FORMULA_NODE_BUILDER] Android启用原生键盘失败:', error)
          }
        }
        
        // 回车处理完成（移除事件发送）
        
      } else if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault()
        // 使用 SmartFocusManager 统一失活
        this.focusManager.deactivateFormula(nodeId, mathField)
        
        // 重新启用原生键盘事件监听器
        if (typeof (window as any).enableNativeKeyboardListeners === 'function') {
          (window as any).enableNativeKeyboardListeners()
        }
        
        // 调用Android API启用原生键盘
        if (typeof (window as any).AndroidBridge?.enableNativeKeyboard === 'function') {
          try {
            const result = (window as any).AndroidBridge.enableNativeKeyboard()
            console.log('🎯 [FORMULA_NODE_BUILDER] Android启用原生键盘结果:', result)
          } catch (error) {
            console.warn('🎯 [FORMULA_NODE_BUILDER] Android启用原生键盘失败:', error)
          }
        }
        
        // ESC处理完成（移除事件发送）
      }
    })
  }

  // 注意：MathField编辑状态设置和动画状态重置功能已移至 SmartFocusManager 中统一管理
  // 这里不再需要重复的相关方法

  // 处理新节点聚焦 - 简化版本
  private async handleNewNodeFocus(
    mathField: MathField, 
    nodeId: string, 
    getPos: () => number | undefined, 
    editor: Editor
  ): Promise<void> {
    try {
      // 使用 SmartFocusManager 统一激活
      const success = await this.focusManager.activateFormula(nodeId, mathField, {
        scrollIntoView: true,
        showKeyboard: true,
        delay: 300, // 等待DOM稳定
        ensureVisible: true
      })
      
      if (success) {
        // 移除isNew标记
        if (typeof getPos === 'function' && getPos() !== undefined) {
          const pos = getPos()
          if (pos !== undefined) {
            const transaction = editor.view.state.tr.setNodeMarkup(pos, undefined, { isNew: false })
            editor.view.dispatch(transaction)
          }
        }
      }
    } catch {
    }
  }

  // 更新公式管理器中的节点信息
  private updateFormulaManagerNode(nodeId: string, mathField: MathField, container: HTMLElement): void {
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
      mathField.setValue(newFormula)
      this.formulaManager.updateFormulaContent(nodeId, newFormula)
      
      // 更新纯文本显示内容
      this.updateTextDisplayContent(container, newFormula)
    }
  
    // 表示我们成功处理了更新
    return true 
  }

  // 销毁节点
  private destroyNode(container: HTMLElement): void {
    
    const nodeId = container.getAttribute('data-node-id')
    if (nodeId) {
      // 清理聚焦超时
      this.clearFocusTimeout(nodeId)
      
      // 删除公式节点（FormulaManager 会处理状态清理）
      this.formulaManager.deleteFormula(nodeId)
    }
  }
}
