import React, { useState, useMemo, useEffect } from 'react'
import Popover from '@/components/base/Popover'
import Slider from '@/components/base/Slider'
import '@/components/drawing/ToolbarNew.css'

// 导入图标 (React 中通常使用相对路径或从 public 引用)
const icons = {
  signaturePen: '/icons/signaturePen.svg',
  signaturePenConfig: '/icons/signaturePen_config.svg',
  highlighter: '/icons/highlighter.svg',
  highlighterConfig: '/icons/highlighter_config.svg',
  eraser: '/icons/eraser.svg',
  eraserSmall: '/icons/eraserSmall.svg',
  eraserMedium: '/icons/eraserMedium.svg',
  eraserLarge: '/icons/eraserLarge.svg',
  screenshot: '/icons/screenshot.svg',
  reset: '/icons/reset.svg',
  select: '/icons/select.svg',
  hand: '/icons/hand.svg',
  insertText: '/icons/InsertText.svg',
  rectangle: '/icons/rectangle.svg',
  circle: '/icons/circle.svg',
  line: '/icons/line.svg',
  triangle: '/icons/triangle.svg',
  coordinate: '/icons/zuobiaozhou.svg',
  undo: '/icons/undo.svg',
  redo: '/icons/redo.svg',
  dustbin: '/icons/delete.svg',
  askAi: '/icons/wenai.svg',
  picture: '/icons/picture1.svg',
}

export interface ToolConfig {
  showColorPicker?: boolean
  colors?: Array<{ value: string; label: string }>
  showSizePicker?: boolean
  sizes?: Array<{ value: number; label: string; displayHeight?: string; icon?: string }>
  sizeLabel?: string
  showShapePicker?: boolean
  shapes?: Array<{ value: string; label: string; icon: string }>
  showSelectionModePicker?: boolean
  selectionModes?: Array<{ value: string; label: string; icon?: string; description?: string }>
  selectionModeLabel?: string
  showOpacityPicker?: boolean
}

export interface ToolOption {
  value: string
  label: string
  icon: string
  config?: ToolConfig
  subTools?: string[]
}

export interface ToolConfigState {
  color?: string
  size?: number
  shape?: string
  opacity?: number
  selectMode?: string
  [key: string]: string | number | boolean | undefined
}

export interface ToolbarNewProps {
  tools: string[] | { left?: string[]; middle?: string[]; right?: string[] }
  selectedTool: string
  toolConfig?: ToolConfigState
  toolStates?: Record<string, boolean>
  variant?: 'floating' | 'browser'
  backgroundColor?: string
  orientation?: 'horizontal' | 'vertical'
  showAskAi?: boolean
  allowPopup?: boolean
  onToolChange?: (tool: string) => void
  onConfigChange?: (config: ToolConfigState) => void
  onUndo?: () => void
  onRedo?: () => void
  onClear?: () => void
  onInsertImage?: () => void
  onAskAi?: () => void
}

const ALL_TOOLS: Record<string, ToolOption> = {
  highlighter: {
    value: 'highlighter',
    label: '荧光笔',
    icon: icons.highlighter,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#FFFF00', label: '黄色' },
        { value: '#00FF00', label: '绿色' },
        { value: '#0080FF', label: '蓝色' },
        { value: '#00FFFF', label: '青色' },
        { value: '#FF80FF', label: '粉色' },
        { value: '#8000FF', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 8, label: '细', displayHeight: '4px' },
        { value: 12, label: '中', displayHeight: '7px' },
        { value: 16, label: '粗', displayHeight: '10px' },
      ],
      sizeLabel: '粗细',
      showOpacityPicker: true,
    },
  },
  eraser: {
    value: 'eraser',
    label: '橡皮擦',
    icon: icons.eraser,
    config: {
      showSizePicker: true,
      sizes: [
        { value: 5, label: '小', icon: icons.eraserSmall },
        { value: 10, label: '中', icon: icons.eraserMedium },
        { value: 15, label: '大', icon: icons.eraserLarge },
      ],
      sizeLabel: '大小',
    },
  },
  reset: {
    value: 'reset',
    label: '重置',
    icon: icons.reset,
  },
  crop: {
    value: 'crop',
    label: '裁剪',
    icon: icons.askAi,
  },
  select: {
    value: 'select',
    label: '选择',
    icon: icons.select,
    config: {
      showSelectionModePicker: true,
      selectionModes: [
        {
          value: 'rectangle',
          label: '矩形选择',
          icon: 'crop_square',
          description: '拖拽形成矩形选区',
        },
        { value: 'freeform', label: '自由框选', icon: 'polyline', description: '自由绘制选区' },
      ],
      selectionModeLabel: '选择模式',
    },
  },
  hand: {
    value: 'hand',
    label: '移动画布',
    icon: icons.hand,
  },
  draw: {
    value: 'draw',
    label: '画笔',
    icon: icons.signaturePen,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '粗细',
      showOpacityPicker: true,
    },
  },
  'eraser-draw': {
    value: 'eraser-draw',
    label: '橡皮',
    icon: icons.eraser,
    config: {
      showSizePicker: true,
      sizes: [
        { value: 1, label: '小', icon: icons.eraserSmall },
        { value: 3, label: '中', icon: icons.eraserMedium },
        { value: 5, label: '大', icon: icons.eraserLarge },
      ],
      sizeLabel: '大小',
    },
  },
  'eraser-stroke': {
    value: 'eraser-stroke',
    label: '笔画橡皮',
    icon: icons.eraser,
    config: {
      showSizePicker: true,
      sizes: [
        { value: 40, label: '小', icon: icons.eraserSmall },
        { value: 60, label: '中', icon: icons.eraserMedium },
        { value: 80, label: '大', icon: icons.eraserLarge },
      ],
      sizeLabel: '擦除范围',
    },
  },
  text: {
    value: 'text',
    label: '文本',
    icon: icons.insertText,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#000000', label: '黑色' },
        { value: '#FF0000', label: '红色' },
        { value: '#00FF00', label: '绿色' },
        { value: '#0000FF', label: '蓝色' },
        { value: '#FFFF00', label: '黄色' },
        { value: '#FF00FF', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 12, label: '小', displayHeight: '2px' },
        { value: 16, label: '中', displayHeight: '3px' },
        { value: 24, label: '大', displayHeight: '5px' },
        { value: 32, label: '特大', displayHeight: '7px' },
      ],
      sizeLabel: '字体大小',
    },
  },
  note: {
    value: 'note',
    label: '文字笔记',
    icon: icons.insertText,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#FFCC00', label: '黄色' },
        { value: '#FF9900', label: '橙色' },
        { value: '#FF6666', label: '红色' },
        { value: '#66CCFF', label: '蓝色' },
        { value: '#66CC66', label: '绿色' },
        { value: '#000000', label: '黑色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 12, label: '小', displayHeight: '2px' },
        { value: 16, label: '中', displayHeight: '3px' },
        { value: 20, label: '大', displayHeight: '4px' },
      ],
      sizeLabel: '字体大小',
    },
  },
  rectangle: {
    value: 'rectangle',
    label: '矩形',
    icon: icons.rectangle,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '边框粗细',
      showOpacityPicker: true,
    },
  },
  circle: {
    value: 'circle',
    label: '圆形',
    icon: icons.circle,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '边框粗细',
      showOpacityPicker: true,
    },
  },
  line: {
    value: 'line',
    label: '直线',
    icon: icons.line,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '粗细',
      showOpacityPicker: true,
    },
  },
  triangle: {
    value: 'triangle',
    label: '三角形',
    icon: icons.triangle,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '边框粗细',
      showOpacityPicker: true,
    },
  },
  coordinate: {
    value: 'coordinate',
    label: '坐标轴',
    icon: icons.coordinate,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 2, label: '中', displayHeight: '2px' },
        { value: 3, label: '粗', displayHeight: '3px' },
        { value: 5, label: '特粗', displayHeight: '5px' },
      ],
      sizeLabel: '轴线粗细',
      showOpacityPicker: true,
    },
  },
  shape: {
    value: 'shape',
    label: '形状',
    icon: icons.rectangle,
    subTools: ['rectangle', 'circle', 'triangle', 'line'],
  },
  insertImage: {
    value: 'insertImage',
    label: '插入图片',
    icon: icons.picture,
  },
  undo: {
    value: 'undo',
    label: '撤销',
    icon: icons.undo,
  },
  redo: {
    value: 'redo',
    label: '重做',
    icon: icons.redo,
  },
  clear: {
    value: 'clear',
    label: '清空画布',
    icon: icons.dustbin,
  },
  search: {
    value: 'search',
    label: '搜索',
    icon: 'search',
  },
  hideNotes: {
    value: 'hideNotes',
    label: '隐藏笔记',
    icon: 'visibility_off',
  },
  back: {
    value: 'back',
    label: '返回',
    icon: 'arrow_back',
  },
  chat: {
    value: 'chat',
    label: '聊天',
    icon: 'chat',
  },
  askAi: {
    value: 'askAi',
    label: '问问学伴',
    icon: icons.askAi,
    config: {
      showSelectionModePicker: true,
      selectionModes: [
        {
          value: 'rectangle',
          label: '矩形框选',
          icon: 'crop_square',
          description: '拖拽形成矩形选区',
        },
        {
          value: 'freeform',
          label: '自由框选',
          icon: 'polyline',
          description: '自由绘制选区',
        },
      ],
      selectionModeLabel: '截图模式',
    },
  },
  help: {
    value: 'help',
    label: '帮助',
    icon: 'help_outline',
  },
}

const ACTION_TOOLS = ['search', 'undo', 'redo', 'clear', 'hideNotes', 'hand', 'crop', 'insertImage', 'askAi']
const SELECTABLE_ACTION_TOOLS = ['hand', 'crop', 'askAi']

export const ToolbarNew: React.FC<ToolbarNewProps> = ({
  tools = [],
  selectedTool,
  toolConfig = {},
  toolStates = {},
  variant = 'floating',
  backgroundColor,
  orientation = 'horizontal',
  showAskAi = false,
  allowPopup = true,
  onToolChange,
  onConfigChange,
  onUndo,
  onRedo,
  onClear,
  onInsertImage,
  onAskAi,
}) => {
  const [activeToolPopup, setActiveToolPopup] = useState<string | null>(null)

  const [lastSelectedShape, setLastSelectedShape] = useState<string | null>(null)

  const toolsDistribution = useMemo(() => {
    if (Array.isArray(tools)) {
      return { left: [], middle: tools, right: [] }
    }
    return {
      left: tools.left || [],
      middle: tools.middle || [],
      right: tools.right || [],
    }
  }, [tools])

  const getToolOptions = (names: string[]) =>
    names.map((name) => ALL_TOOLS[name]).filter(Boolean)

  const leftTools = getToolOptions(toolsDistribution.left)
  const middleTools = getToolOptions(toolsDistribution.middle)
  const rightTools = getToolOptions(toolsDistribution.right)

  const middleActionTools = middleTools.filter((t) => ACTION_TOOLS.includes(t.value))
  const drawingTools = middleTools.filter((t) => !ACTION_TOOLS.includes(t.value))

  const selectShapeTool = (tool: string) => {
    const shapeTool = ALL_TOOLS['shape']
    if (shapeTool?.subTools?.includes(tool)) {
      setLastSelectedShape(tool)
    }
    onToolChange?.(tool)
  }

  const handleActionClick = (toolName: string) => {
    if (toolName === 'undo') onUndo?.()
    else if (toolName === 'redo') onRedo?.()
    else if (toolName === 'clear') onClear?.()
    else if (toolName === 'insertImage') onInsertImage?.()
    else if (toolName === 'askAi') onAskAi?.()
    else if (SELECTABLE_ACTION_TOOLS.includes(toolName)) onToolChange?.(toolName)
  }

  const handleToolClick = (toolName: string) => {
    if (toolName === 'insertImage') {
      onInsertImage?.()
      setActiveToolPopup(null)
      return
    }

    if (isSubToolActive(ALL_TOOLS[toolName])) {
      if (!allowPopup) {
        setActiveToolPopup(null)
        return
      }
      setActiveToolPopup(activeToolPopup === toolName ? null : toolName)
    } else {
      if (toolName === 'shape') {
        const shapeToSelect = lastSelectedShape || 'rectangle'
        selectShapeTool(shapeToSelect)
      } else {
        onToolChange?.(toolName)
      }
      setActiveToolPopup(null)
    }
  }

  const isSubToolActive = (tool: ToolOption) => {
    if (selectedTool === tool.value) return true
    if (tool.subTools?.includes(selectedTool)) return true
    return false
  }

  const getToolConfig = (tool: ToolOption) => {
    if (selectedTool === tool.value) return tool.config
    if (tool.subTools && tool.subTools.includes(selectedTool)) {
      return ALL_TOOLS[selectedTool]?.config || tool.config
    }
    return tool.config
  }

  const currentToolConfig = useMemo(() => {
    let tool = ALL_TOOLS[selectedTool]
    if (!tool) {
      // 如果没找到，尝试找包含它的父工具
      for (const key in ALL_TOOLS) {
        if (ALL_TOOLS[key].subTools?.includes(selectedTool)) {
          tool = ALL_TOOLS[selectedTool] || ALL_TOOLS[key]
          break
        }
      }
    }
    return tool?.config || null
  }, [selectedTool])

  const getMinSize = (tool: ToolOption) => {
    const cfg = getToolConfig(tool)
    const sizes = cfg?.sizes
    if (!sizes || sizes.length === 0) return 1
    return Math.min(...sizes.map((s) => s.value))
  }

  const getMaxSize = (tool: ToolOption) => {
    const cfg = getToolConfig(tool)
    const sizes = cfg?.sizes
    if (!sizes || sizes.length === 0) return 20
    return Math.max(...sizes.map((s) => s.value))
  }

  const getStepSize = (tool: ToolOption) => {
    const cfg = getToolConfig(tool)
    const sizes = cfg?.sizes
    if (!sizes) return 1
    const hasDecimal = sizes.some((s) => s.value % 1 !== 0)
    return hasDecimal ? 0.5 : 1
  }

  const getMaskIconStyle = (
    iconPath: string,
    type: 'action' | 'tool' | 'config' = 'action',
    toolValue?: string
  ) => {
    const maskStyle: React.CSSProperties = {
      WebkitMaskImage: `url('${iconPath}')`,
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskImage: `url('${iconPath}')`,
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      maskSize: 'contain',
    }

    let backgroundColor = '#ffffff'
    if (type === 'action') {
      backgroundColor = variant === 'browser' ? '#ffffff' : '#000000'
      if (toolValue === 'clear') backgroundColor = '#dc3545'
    } else if (type === 'tool') {
      if (toolValue && selectedTool === toolValue) {
        backgroundColor = '#6e55ff'
      } else {
        backgroundColor = variant === 'browser' ? '#ffffff' : '#4b5563'
      }
    }

    maskStyle.backgroundColor = backgroundColor
    return maskStyle
  }

  useEffect(() => {
    const tool = ALL_TOOLS[selectedTool]
    if (!tool?.config && activeToolPopup) {
      setActiveToolPopup(null)
    }
  }, [selectedTool, activeToolPopup])

  return (
    <div className={`unified-toolbar-container variant-${variant} orientation-${orientation}`}>
      <div className={`unified-toolbar unified-toolbar-${variant} unified-toolbar-orientation-${orientation}`}>
        <div className="toolbar-slot toolbar-slot-left">
          {leftTools.map(t => (
             <button key={t.value} className="action-btn" onClick={() => handleActionClick(t.value)} title={t.label}>
                <div className="action-icon mask-icon" style={getMaskIconStyle(t.icon, 'action', t.value)} />
             </button>
          ))}
        </div>

        <div className={`toolbar-content toolbar-content-orientation-${orientation}`} style={backgroundColor ? { backgroundColor } : {}}>
          <div className="left-section">
             {/* 可以根据需要添加左侧区域 */}
          </div>

          <div className="center-section">
            <div className="tool-row">
              {middleActionTools.map(t => (
                <div 
                  key={t.value} 
                  className={`tool-icon-wrapper ${toolStates[t.value] === false ? 'tool-disabled' : ''} ${selectedTool === t.value ? 'active' : ''}`}
                  onClick={() => handleActionClick(t.value)}
                  title={t.label}
                >
                  <div 
                    className="tool-icon mask-icon" 
                    style={getMaskIconStyle(t.icon, 'action', t.value)}
                  />
                </div>
              ))}

              {middleActionTools.length > 0 && drawingTools.length > 0 && <div className="toolbar-divider-vertical" />}

              {drawingTools.map(t => (
                <div key={t.value} className="tool-item-container">
                  <Popover
                    visible={activeToolPopup === t.value}
                    onVisibleChange={(visible) => setActiveToolPopup(visible ? t.value : null)}
                    placement={orientation === 'vertical' ? 'right' : 'bottom'}
                    trigger="click"
                    content={
                      <div className="combined-popup-content">
                        <div className="popup-inner">
                          {t.subTools && (
                            <div className="config-section">
                              <div className="section-title">
                                <span>切换形状</span>
                              </div>
                              <div className="section-content">
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {t.subTools.map(stName => {
                                    const st = ALL_TOOLS[stName]
                                    return (
                                      <div 
                                        key={stName} 
                                        className={`shape-grid-item ${selectedTool === stName ? 'item-selected' : ''}`}
                                        onClick={() => {
                                          selectShapeTool(stName)
                                          setActiveToolPopup(null)
                                        }}
                                      >
                                        <div className="shape-grid-icon mask-icon" style={getMaskIconStyle(st.icon, 'tool', stName)} />
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {currentToolConfig && (
                            <div className="config-sections-wrapper">
                              {currentToolConfig.showColorPicker && (
                                <div className="config-section">
                                  <div className="section-title"><span>颜色</span></div>
                                  <div className="section-content">
                                    <div className="color-options">
                                      {currentToolConfig.colors?.map(c => (
                                        <div 
                                          key={c.value} 
                                          className={`color-option ${toolConfig.color === c.value ? 'color-selected' : ''}`}
                                          onClick={() => onConfigChange?.({ ...toolConfig, color: c.value })}
                                        >
                                          <div className="color-display" style={{ backgroundColor: c.value }} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {currentToolConfig.showSizePicker && (
                                <div className="config-section">
                                  <div className="section-title"><span>{currentToolConfig.sizeLabel || '粗细'}</span></div>
                                  <div className="section-content">
                                    <Slider 
                                      value={toolConfig.size || getMinSize(t)} 
                                      onUpdate={(val) => onConfigChange?.({ ...toolConfig, size: val })}
                                      min={getMinSize(t)}
                                      max={getMaxSize(t)}
                                      step={getStepSize(t)}
                                    />
                                  </div>
                                </div>
                              )}

                              {currentToolConfig.showOpacityPicker && (
                                <div className="config-section">
                                  <div className="section-title"><span>浓度</span></div>
                                  <div className="section-content">
                                    <Slider 
                                      value={(toolConfig.opacity ?? 1) * 100} 
                                      onUpdate={(val) => onConfigChange?.({ ...toolConfig, opacity: val / 100 })}
                                      min={1}
                                      max={100}
                                      step={1}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    }
                  >
                    <div 
                      className={`tool-icon-wrapper ${isSubToolActive(t) ? 'active' : ''}`}
                      onClick={() => handleToolClick(t.value)}
                      title={t.label}
                    >
                      <div 
                        className="tool-icon mask-icon"
                        style={getMaskIconStyle(
                          isSubToolActive(t) && t.subTools?.includes(selectedTool) 
                            ? ALL_TOOLS[selectedTool].icon 
                            : t.icon,
                          'tool',
                          isSubToolActive(t) ? (t.subTools?.includes(selectedTool) ? selectedTool : t.value) : undefined
                        )}
                      />
                    </div>
                  </Popover>
                </div>
              ))}
            </div>
          </div>

          <div className="right-section">
             {rightTools.length > 0 && <div className="toolbar-divider" />}
             {rightTools.map(t => (
                <button key={t.value} className="action-btn" onClick={() => handleActionClick(t.value)} title={t.label}>
                   <div className="action-icon mask-icon" style={getMaskIconStyle(t.icon, 'action', t.value)} />
                </button>
             ))}
          </div>
        </div>

        <div className="toolbar-slot toolbar-slot-right">
          {/* 右侧插槽可以在这里添加 */}
        </div>
      </div>
    </div>
  )
}

export default ToolbarNew
