/**
 * ChatInput 工具栏工具类型定义（极简版）
 * 只需传入工具类型字符串数组，图标和位置由 ChatInput 内部决定
 */

/** 内置工具类型 */
export type BuiltinToolType =
  | 'screenshot'      // 截图/屏幕快照（prefix位置）
  | 'select-and-ask'  // 选中并问（prefix位置，支持状态切换）
  | 'new-session'     // 新增会话（right位置）
  | 'formula'         // 公式编辑器（middle位置）
  | 'ask-teacher'     // 问老师（middle位置）
  | 'web-search'      // 联网搜索

/** 工具配置（极简） */
export interface ToolbarTool {
  /** 工具类型 */
  type: BuiltinToolType
  /** 当前是否处于激活状态（仅 select-and-ask 等需要状态切换的工具） */
  isActive?: boolean
}
