/**
 * 学校级应用配置（按学校/发行版本可配置）
 *
 * 设计目标：
 * - 不仅仅是导航菜单，后续所有与学校相关的差异都可以集中到这里
 * - 通过 import.meta.env.VITE_SCHOOL_ID 区分不同学校版本
 */

// 导航项 key 类型（与 MainView 等处保持一致）
export type NavKey =
  | 'toolbox'
  | 'knowledge'
  | 'exercises'
  | 'homework'
  | 'drawingBoard'
  | 'resources'
  | 'logout'

// 导航菜单配置
export interface NavItemConfig {
  key: NavKey
  label: string
  /**
   * 图标类型：用于在视图层映射到具体图标（普通/选中）
   * 目前与 key 基本一致，预留出来便于将来一个功能多种图标样式的情况
   */
  iconType: NavKey
  /**
   * 菜单位置：
   * - main：上半部分主菜单
   * - bottom：底部菜单（如资源下载、退出登录）
   */
  position: 'main' | 'bottom'
  /**
   * 关联的路由名称（可选）
   * - 存在时，点击菜单默认通过 router.push({ name: routeName }) 跳转
   * - 不存在时，视图层可以实现自定义行为（例如 toolbox、logout）
   */
  routeName?: string
}

export interface SchoolNavConfig {
  main: NavItemConfig[]
  bottom: NavItemConfig[]
}

// 后续可以在此扩展：如功能开关、默认路由、主题皮肤等
export interface SchoolAppConfig {
  /** 学校 ID 或渠道 ID，例如 bj10 / bj101 / default */
  schoolId: string
  /** 导航菜单配置 */
  nav: SchoolNavConfig
  /**
   * 应用更新配置文件路径（相对路径），例如：/bj101/appupdate.json
   * - 不包含域名和端口，由 http-client 路由表负责转发到实际服务器
   */
  appUpdatePath?: string
}

// 按学校划分的配置表：后续可以在这里新增/覆盖不同学校的配置
const SCHOOL_CONFIGS: Record<string, SchoolAppConfig> = {
  // 景山远洋：不显示“我的作业”菜单
  jinshanyuanyang: {
    schoolId: 'jinshanyuanyang',
    nav: {
      main: [
        { key: 'toolbox', label: '工具箱', iconType: 'toolbox', position: 'main' },
        {
          key: 'knowledge',
          label: '知识图谱',
          iconType: 'knowledge',
          position: 'main',
          routeName: 'knowledgeGraph',
        },
        {
          key: 'exercises',
          label: '我的习题',
          iconType: 'exercises',
          position: 'main',
          routeName: 'exerciseSolve',
        },
        {
          key: 'homework',
          label: '我的作业',
          iconType: 'homework',
          position: 'main',
          routeName: 'myHomework',
        },
        {
          key: 'drawingBoard',
          label: '草稿本',
          iconType: 'drawingBoard',
          position: 'main',
          routeName: 'drawingBoard',
        },
      ],
      bottom: [
        {
          key: 'resources',
          label: '资源下载',
          iconType: 'resources',
          position: 'bottom',
          routeName: 'myResources',
        },
      ],
    },
    // 目前沿用与默认学校相同的更新配置路径
    appUpdatePath: '/bj101/appupdate.json',
  },
  // 经开二中：当前与默认配置一致
  jingkaierzhong: {
    schoolId: 'jingkaierzhong',
    nav: {
      main: [
        { key: 'toolbox', label: '工具箱', iconType: 'toolbox', position: 'main' },
        {
          key: 'knowledge',
          label: '知识图谱',
          iconType: 'knowledge',
          position: 'main',
          routeName: 'knowledgeGraph',
        },
        {
          key: 'exercises',
          label: '我的习题',
          iconType: 'exercises',
          position: 'main',
          routeName: 'exerciseSolve',
        },
        {
          key: 'homework',
          label: '我的作业',
          iconType: 'homework',
          position: 'main',
          routeName: 'myHomework',
        },
        {
          key: 'drawingBoard',
          label: '草稿本',
          iconType: 'drawingBoard',
          position: 'main',
          routeName: 'drawingBoard',
        },
      ],
      bottom: [
        {
          key: 'resources',
          label: '资源下载',
          iconType: 'resources',
          position: 'bottom',
          routeName: 'myResources',
        },
      ],
    },
    // 经开二中：与 default 一致
    appUpdatePath: '/jinkai/appupdate.json',
  },
}

/**
 * 获取当前学校 ID（来自构建期环境变量）
 * - VITE_SCHOOL_ID 在不同学校包构建时写死
 * - 未定义时返回 'default'
 */
export function getCurrentSchoolId(): string {
  const id = import.meta.env.VITE_SCHOOL_ID as string | undefined
  if (!id || typeof id !== 'string' || !id.trim()) {
    // 未指定时，默认使用经开二中
    return 'jingkaierzhong'
  }
  return id.trim()
}

/**
 * 获取当前学校应用配置
 * - 优先返回指定 schoolId 对应配置
 * - 若未配置则回退到 default
 */
export function getCurrentSchoolAppConfig(): SchoolAppConfig {
  const schoolId = getCurrentSchoolId()
  // 未配置时回退到经开二中
  return SCHOOL_CONFIGS[schoolId] || SCHOOL_CONFIGS.jingkaierzhong
}

/**
 * 获取当前学校的 app 更新配置路径（相对路径）
 * 优先使用当前学校的 appUpdatePath，若未配置则回退到 default，再兜底 '/bj101/appupdate.json'
 */
export function getCurrentSchoolAppUpdatePath(): string {
  const current = getCurrentSchoolAppConfig()
  if (current.appUpdatePath && current.appUpdatePath.trim()) {
    return current.appUpdatePath.trim()
  }

  const fallback = SCHOOL_CONFIGS.jingkaierzhong?.appUpdatePath
  if (fallback && fallback.trim()) {
    return fallback.trim()
  }

  return '/jinkai/update.json'
}

