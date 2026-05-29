import { useEffect, useRef, useCallback, useState } from 'react'
import BScroll from '@better-scroll/core'
import type { Options as BScrollOptions } from '@better-scroll/core'

/**
 * Better Scroll Hook
 * 提供 BScroll 的初始化、刷新、销毁等功能的封装
 * 
 * @param wrapperRef - 滚动容器的 ref
 * @param options - BScroll 配置选项（可选）
 * @param autoWatch - 是否自动监听数据变化并刷新（默认：false）
 * @param watchSources - 需要监听的数据源（当 autoWatch 为 true 时生效）
 * @returns 返回初始化、刷新、销毁等方法
 */
export function useBetterScroll(
  wrapperRef: React.RefObject<HTMLElement>,
  options?: Partial<BScrollOptions>,
  autoWatch: boolean = false,
  watchSources?: any[]
) {
  const bscrollInstance = useRef<BScroll | null>(null)
  const [instance, setInstance] = useState<BScroll | null>(null)

  // 默认配置
  const defaultOptions: Partial<BScrollOptions> = {
    scrollY: true,
    scrollX: false,
    click: true,
    bounce: {
      top: true,
      bottom: true,
      left: false,
      right: false
    },
    deceleration: 0.003,
    useTransition: true,
    HWCompositing: true,
    ...options
  }

  /**
   * 销毁 BScroll 实例
   */
  const destroy = useCallback(() => {
    if (bscrollInstance.current) {
      bscrollInstance.current.destroy()
      bscrollInstance.current = null
      setInstance(null)
    }
  }, [])

  /**
   * 初始化 BScroll
   */
  const init = useCallback(async () => {
    if (wrapperRef.current) {
      // 如果已存在实例，先销毁
      if (bscrollInstance.current) {
        destroy()
      }

      bscrollInstance.current = new BScroll(wrapperRef.current, defaultOptions)
      setInstance(bscrollInstance.current)
    }
  }, [wrapperRef, defaultOptions, destroy])

  /**
   * 刷新 BScroll
   */
  const refresh = useCallback(async () => {
    bscrollInstance.current?.refresh()
  }, [])

  /**
   * 滚动到指定位置
   * @param x - 横坐标
   * @param y - 纵坐标
   * @param time - 动画时间（毫秒）
   */
  const scrollTo = useCallback((x: number, y: number, time?: number) => {
    bscrollInstance.current?.scrollTo(x, y, time)
  }, [])

  /**
   * 滚动到指定元素
   * @param element - 目标元素
   * @param time - 动画时间（毫秒）
   * @param offsetX - 横向偏移
   * @param offsetY - 纵向偏移
   */
  const scrollToElement = useCallback((
    element: HTMLElement | string,
    time?: number,
    offsetX?: number | boolean,
    offsetY?: number | boolean
  ) => {
    bscrollInstance.current?.scrollToElement(element, time, offsetX, offsetY)
  }, [])

  // 自动监听数据变化
  useEffect(() => {
    if (autoWatch && watchSources && watchSources.length > 0) {
      if (wrapperRef.current) {
        if (!bscrollInstance.current) {
          init()
        } else {
          refresh()
        }
      }
    }
  }, [autoWatch, watchSources, init, refresh, wrapperRef])

  // 组件卸载时自动清理
  useEffect(() => {
    return () => {
      destroy()
    }
  }, [destroy])

  return {
    init,
    refresh,
    destroy,
    scrollTo,
    scrollToElement,
    instance,
    // 便捷方法：获取实例（用于访问 maxScrollY 等属性）
    getInstance: () => bscrollInstance.current
  }
}
