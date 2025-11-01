import { ref, nextTick, watch, onUnmounted, type Ref } from 'vue'
import BScroll from '@better-scroll/core'
import type { Options as BScrollOptions } from '@better-scroll/core'

/**
 * Better Scroll 组合式函数
 * 提供 BScroll 的初始化、刷新、销毁等功能的封装
 * 
 * @param wrapperRef - 滚动容器的 ref
 * @param options - BScroll 配置选项（可选）
 * @param autoWatch - 是否自动监听数据变化并刷新（默认：false）
 * @param watchSources - 需要监听的数据源（当 autoWatch 为 true 时生效）
 * @returns 返回初始化、刷新、销毁等方法
 */
export function useBetterScroll(
  wrapperRef: Ref<HTMLElement | null>,
  options?: Partial<BScrollOptions>,
  autoWatch: boolean = false,
  watchSources?: Array<() => unknown>
) {
  let bscrollInstance: BScroll | null = null

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
   * 初始化 BScroll
   */
  const init = async () => {
    await nextTick()

    if (wrapperRef.value) {
      // 如果已存在实例，先销毁
      if (bscrollInstance) {
        destroy()
      }

      bscrollInstance = new BScroll(wrapperRef.value, defaultOptions)
    }
  }

  /**
   * 刷新 BScroll
   */
  const refresh = async () => {
    await nextTick()
    bscrollInstance?.refresh()
  }

  /**
   * 销毁 BScroll 实例
   */
  const destroy = () => {
    if (bscrollInstance) {
      bscrollInstance.destroy()
      bscrollInstance = null
    }
  }

  /**
   * 滚动到指定位置
   * @param x - 横坐标
   * @param y - 纵坐标
   * @param time - 动画时间（毫秒）
   */
  const scrollTo = (x: number, y: number, time?: number) => {
    bscrollInstance?.scrollTo(x, y, time)
  }

  /**
   * 滚动到指定元素
   * @param element - 目标元素
   * @param time - 动画时间（毫秒）
   * @param offsetX - 横向偏移
   * @param offsetY - 纵向偏移
   */
  const scrollToElement = (
    element: HTMLElement | string,
    time?: number,
    offsetX?: number | boolean,
    offsetY?: number | boolean
  ) => {
    bscrollInstance?.scrollToElement(element, time, offsetX, offsetY)
  }

  // 自动监听数据变化
  if (autoWatch && watchSources) {
    watchSources.forEach((watchSource) => {
      watch(
        watchSource,
        () => {
          nextTick(() => {
            if (wrapperRef.value) {
              if (!bscrollInstance) {
                init()
              } else {
                refresh()
              }
            }
          })
        },
        { deep: true }
      )
    })
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    destroy()
  })

  return {
    init,
    refresh,
    destroy,
    scrollTo,
    scrollToElement,
    instance: ref(bscrollInstance),
    // 便捷方法：获取实例（用于访问 maxScrollY 等属性）
    getInstance: () => bscrollInstance
  }
}

