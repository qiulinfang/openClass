/**
 * 路径平滑算法工具函数
 * 用于实现手写笔迹的平滑效果
 */

export type HandwritingStyle = 
  | 'brush'        // 毛笔
  | 'writing'      // 书写笔
  | 'spray'        // 喷枪
  | 'oil-paint'    // 油画笔
  | 'crayon'       // 蜡笔
  | 'marker'       // 记号笔
  | 'pencil'       // 普通铅笔
  | 'watercolor'   // 水彩画笔

/**
 * 画笔样式配置接口
 */
interface BrushStyleConfig {
  smoothness: number      // 平滑度 (0-1)
  pressureVariation: number  // 压力变化 (0-1)
  textureIntensity: number   // 纹理强度 (0-1)
  edgeSoftness: number       // 边缘柔和度 (0-1)
  lineWidthVariation: number // 线宽变化 (0-1)
}

/**
 * 获取样式对应的配置参数
 */
export function getBrushStyleConfig(style: HandwritingStyle): BrushStyleConfig {
  const configMap: Record<HandwritingStyle, BrushStyleConfig> = {
    'brush': {
      smoothness: 0.4,        // 毛笔：中等平滑，粗细变化明显
      pressureVariation: 0.6,  // 高压力变化
      textureIntensity: 0.5,   // 有毛糙感
      edgeSoftness: 0.3,       // 边缘较硬
      lineWidthVariation: 0.7  // 线宽变化大
    },
    'writing': {
      smoothness: 0.5,        // 书写笔：流畅
      pressureVariation: 0.3,  // 中等压力变化
      textureIntensity: 0.1,   // 纹理少
      edgeSoftness: 0.2,       // 边缘清晰
      lineWidthVariation: 0.2  // 线宽变化小
    },
    'spray': {
      smoothness: 0.3,        // 喷枪：轻度平滑
      pressureVariation: 0.4,  // 中等压力变化
      textureIntensity: 0.7,   // 高纹理（颗粒感）
      edgeSoftness: 0.8,       // 边缘很柔和
      lineWidthVariation: 0.5  // 中等线宽变化
    },
    'oil-paint': {
      smoothness: 0.6,        // 油画笔：强平滑
      pressureVariation: 0.5,  // 中等压力变化
      textureIntensity: 0.6,   // 高纹理（厚重感）
      edgeSoftness: 0.5,       // 中等边缘柔和
      lineWidthVariation: 0.6  // 较大线宽变化
    },
    'crayon': {
      smoothness: 0.4,        // 蜡笔：中等平滑
      pressureVariation: 0.4,  // 中等压力变化
      textureIntensity: 0.5,   // 中等纹理（粉质感）
      edgeSoftness: 0.6,       // 边缘柔和
      lineWidthVariation: 0.4  // 中等线宽变化
    },
    'marker': {
      smoothness: 0.5,        // 记号笔：流畅
      pressureVariation: 0.2,  // 低压力变化
      textureIntensity: 0.2,   // 低纹理
      edgeSoftness: 0.7,       // 边缘很柔和
      lineWidthVariation: 0.3  // 较小线宽变化
    },
    'pencil': {
      smoothness: 0.3,        // 普通铅笔：轻度平滑
      pressureVariation: 0.5,  // 中等压力变化
      textureIntensity: 0.4,   // 中等纹理
      edgeSoftness: 0.3,       // 边缘较硬
      lineWidthVariation: 0.3  // 较小线宽变化
    },
    'watercolor': {
      smoothness: 0.4,        // 水彩画笔：中等平滑
      pressureVariation: 0.4,  // 中等压力变化
      textureIntensity: 0.3,   // 低纹理
      edgeSoftness: 0.9,       // 边缘非常柔和（晕染效果）
      lineWidthVariation: 0.5  // 中等线宽变化
    }
  }
  return configMap[style] || configMap['writing']
}

/**
 * 使用贝塞尔曲线绘制平滑路径
 * @param ctx Canvas 2D 上下文
 * @param points 路径点数组
 * @param style 笔迹样式
 * @param baseLineWidth 基础线宽
 * @param baseColor 基础颜色
 */
export function drawSmoothPath(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  style: HandwritingStyle = 'writing',
  baseLineWidth?: number,
  baseColor?: string
): void {
  if (points.length < 2) return

  const config = getBrushStyleConfig(style)
  const originalLineWidth = baseLineWidth || ctx.lineWidth
  const originalColor = baseColor || ctx.strokeStyle as string
  const originalLineCap = ctx.lineCap
  const originalLineJoin = ctx.lineJoin

  // 保存原始状态
  ctx.save()

  // 设置基础属性（所有画笔都使用圆角）
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  // 设置颜色和线宽
  ctx.strokeStyle = originalColor
  ctx.lineWidth = originalLineWidth

  // 计算速度（用于线宽变化）
  const calculateSpeed = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  if (points.length === 2) {
    // 只有两个点，直接连线
    const speed = calculateSpeed(points[0], points[1])
    const widthVariation = 1 + (config.lineWidthVariation * (1 - Math.min(speed / 50, 1)))
    ctx.lineWidth = originalLineWidth * widthVariation
    
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[1].x, points[1].y)
    ctx.stroke()
  } else {
    // 使用二次贝塞尔曲线平滑
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]

      // 计算速度用于线宽变化
      const speed = calculateSpeed(prev, curr)
      const widthVariation = 1 + (config.lineWidthVariation * (1 - Math.min(speed / 50, 1)) * (0.5 + Math.random() * 0.5))
      
      // 根据压力变化调整线宽
      const pressureVariation = 1 + (config.pressureVariation * (Math.random() - 0.5) * 0.3)
      ctx.lineWidth = originalLineWidth * widthVariation * pressureVariation

      // 计算控制点
      const cpX = curr.x + (next.x - prev.x) * config.smoothness * 0.5
      const cpY = curr.y + (next.y - prev.y) * config.smoothness * 0.5

      ctx.quadraticCurveTo(cpX, cpY, curr.x, curr.y)
      
      // 对于需要纹理效果的画笔，添加一些随机点
      if (config.textureIntensity > 0.3 && Math.random() < config.textureIntensity * 0.3) {
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(curr.x, curr.y)
      }
    }

    // 连接到最后一个点
    const lastSpeed = calculateSpeed(points[points.length - 2], points[points.length - 1])
    const lastWidthVariation = 1 + (config.lineWidthVariation * (1 - Math.min(lastSpeed / 50, 1)))
    ctx.lineWidth = originalLineWidth * lastWidthVariation
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
    ctx.stroke()
  }

  // 对于需要柔和边缘的画笔，添加额外的渐变描边（在主要描边之后）
  if (config.edgeSoftness > 0.5) {
    ctx.save() // 保存当前状态
    const alpha = config.edgeSoftness * 0.3
    const rgba = parseColor(originalColor)
    if (rgba) {
      ctx.globalAlpha = alpha
      ctx.strokeStyle = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha})`
      ctx.lineWidth = originalLineWidth * (1 + config.edgeSoftness * 0.5)
      
      if (points.length === 2) {
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(points[1].x, points[1].y)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length - 1; i++) {
          const prev = points[i - 1]
          const curr = points[i]
          const next = points[i + 1]
          const cpX = curr.x + (next.x - prev.x) * config.smoothness * 0.5
          const cpY = curr.y + (next.y - prev.y) * config.smoothness * 0.5
          ctx.quadraticCurveTo(cpX, cpY, curr.x, curr.y)
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
        ctx.stroke()
      }
    }
    ctx.restore() // 恢复状态
  }

  // 恢复原始状态
  ctx.restore()
}

/**
 * 解析颜色字符串为 RGBA 值
 */
function parseColor(color: string): { r: number; g: number; b: number; a?: number } | null {
  // 处理 rgb/rgba 格式
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
    }
  }
  
  // 处理十六进制格式
  const hexMatch = color.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/)
  if (hexMatch) {
    const hex = hexMatch[1]
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16)
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16)
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16)
    return { r, g, b, a: 1 }
  }
  
  return null
}

/**
 * 路径平滑处理（可选，用于预处理点数组）
 * 注意：此函数主要用于特殊场景，一般直接使用 drawSmoothPath 即可
 */
export function smoothPath(
  points: { x: number; y: number }[],
  smoothness: number = 0.3
): { x: number; y: number }[] {
  if (points.length < 3) return points

  const smoothed: { x: number; y: number }[] = [points[0]]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    // 计算控制点（中点）
    const cp1x = prev.x + (curr.x - prev.x) * smoothness
    const cp1y = prev.y + (curr.y - prev.y) * smoothness
    const cp2x = curr.x + (next.x - curr.x) * smoothness
    const cp2y = curr.y + (next.y - curr.y) * smoothness

    smoothed.push({ x: cp1x, y: cp1y })
    smoothed.push({ x: cp2x, y: cp2y })
    smoothed.push(curr)
  }

  smoothed.push(points[points.length - 1])
  return smoothed
}

