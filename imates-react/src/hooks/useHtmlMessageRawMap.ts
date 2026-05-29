import { useCallback } from 'react'
import type { ChatBubble } from '@/types'
import { apiService } from '@/services/http/api-service'
import type { ApiService } from '@/services/http/api-service'
import html2canvas from 'html2canvas'

// 增强配置选项接口
export interface HtmlEnhanceOptions {
  /** 是否隐藏 GGB 工具栏、菜单栏、代数输入框等 UI 元素 */
  hideGgbUIs?: boolean;
  /** 是否强制锁定为几何视图 (Perspective "G") */
  lockPerspectiveG?: boolean;
  /** 是否开启自适应宽高适配和 ResizeObserver 注入 */
  enableAdaptive?: boolean;
  /** 是否注入 GGB 事件监听桥接脚本 (GGB_LISTENER_BRIDGE) */
  enableBridge?: boolean;
}

// 默认配置项：保持与重构前行为一致
const DEFAULT_ENHANCE_OPTIONS: HtmlEnhanceOptions = {
  hideGgbUIs: true,
  lockPerspectiveG: true,
  enableAdaptive: true,
  enableBridge: true,
};

// 对传入的 HTML 进行自适应增强处理（前端精简版，核心逻辑已移至后端）
export const enhanceResponsiveHtml = (html: string, options: HtmlEnhanceOptions = DEFAULT_ENHANCE_OPTIONS): string => {
  if (!html) return html
  // 后端已经完成了大部分增强逻辑（UI 隐藏、视角锁定、ResizeObserver、Bridge 注入）
  // 前端此处仅保留基础返回，除非有极致的实时调整需求
  return html
}

// 配置选项类型
type EnsureOptions = {
  urlRegex?: RegExp      // 自定义 URL 匹配正则
  enhanceHtml?: (html: string) => string  // 自定义 HTML 增强函数
  logTag?: string         // 日志标签，用于区分不同场景
  onlyUrls?: string[]     // 仅处理指定 URL（用于局部刷新/重渲染）
  forceRender?: boolean   // 强制重新生成图片（忽略已有缓存）
}

/**
 * HTML 消息原始内容获取与增强 Hook
 * 
 * 功能：
 * - 从消息内容中提取 HTML URL
 * - 通过后端代理获取 HTML 源码
 * - 对 HTML 进行响应式增强处理
 * - 缓存到 message.rawHtmlMap 供 iframe 渲染使用
 */
export const useHtmlMessageRawMap = (api: Pick<ApiService, 'fetchHtmlSource'> = apiService) => {
  // 默认匹配 kelvin-cosin.cloud 的 HTML 文件 URL
  const defaultUrlRegex = /(https:\/\/[a-z0-9.-]*kelvin-cosin\.cloud\/.*?\.html)/gi

  const inflight = new Map<string, Promise<string | undefined>>()

  const PREVIEW_WIDTH = 600
  const PREVIEW_HEIGHT = 600
  const PREVIEW_SCALE = 1.5

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  const waitForIframeStable = async (iframe: HTMLIFrameElement) => {
    const doc = iframe.contentDocument
    const win = iframe.contentWindow as any
    if (!doc) return

    // 并行等待字体和图片，超时缩短到 800ms 避免卡顿
    const fontWait = (async () => {
      try {
        const fonts = (doc as any).fonts
        if (fonts?.ready) {
          await Promise.race([fonts.ready, wait(800)])
        }
      } catch {
        // ignore
      }
    })()

    const imageWait = (async () => {
      try {
        const images = Array.from(doc.images || [])
        const waits = images
          .filter((img) => !img.complete)
          .slice(0, 6) // 最多等前6张关键图，避免海量图片拖慢
          .map(
            (img) =>
              new Promise<void>((resolve) => {
                const done = () => resolve()
                img.addEventListener('load', done, { once: true })
                img.addEventListener('error', done, { once: true })
                setTimeout(done, 800)
              }),
          )
        if (waits.length) await Promise.all(waits)
      } catch {
        // ignore
      }
    })()

    // 并行执行，总耗时不超过 800ms（以慢的为准）
    await Promise.all([fontWait, imageWait])

    // GeoGebra 场景才做额外 reflow + 等待；普通 HTML 快速通过
    const ggbContainer = doc.querySelector('#ggb-container') as HTMLElement | null
    if (ggbContainer) {
      // 强制一次 reflow，避免某些情况下首次布局为 0
      void (ggbContainer as any).offsetHeight
      // 等待一帧确保绘制
      await raf()
      // GeoGebra 额外等 150ms（已比原来 200ms 短）
      if (win?.ggbApplet) {
        await wait(150)
      }
    }
  }

  const tryExportGeoGebraPng = async (iframe: HTMLIFrameElement) => {
    try {
      const win = iframe.contentWindow as any
      const ggbApplet = win?.ggbApplet
      console.log(`[GGB_EXPORT] 开始导出: ggbApplet存在=${!!ggbApplet}, ggbApplet类型=${typeof ggbApplet}, getPNGBase64函数=${typeof ggbApplet?.getPNGBase64}`)
      
      if (!ggbApplet || typeof ggbApplet.getPNGBase64 !== 'function') {
        console.log(`[GGB_EXPORT] GeoGebra 实例或 getPNGBase64 方法不可用`)
        return
      }

      const isPngLowInk = async (dataUrl: string) => {
        try {
          const img = new Image()
          img.decoding = 'async'
          img.src = dataUrl
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error('image load failed'))
          })

          const canvas = document.createElement('canvas')
          const w = Math.max(1, img.naturalWidth || img.width || PREVIEW_WIDTH)
          const h = Math.max(1, img.naturalHeight || img.height || PREVIEW_HEIGHT)
          canvas.width = w
          canvas.height = h

          const ctx = canvas.getContext('2d')
          if (!ctx) return false

          ctx.drawImage(img, 0, 0, w, h)

          // 低墨迹检测
          const sample = 2200
          let ink = 0
          for (let i = 0; i < sample; i++) {
            const x = Math.floor((Math.random() * w) | 0)
            const y = Math.floor((Math.random() * h) | 0)
            const p = ctx.getImageData(x, y, 1, 1).data
            // 非白像素（允许轻微抗锯齿）
            if (p[3] > 0 && (p[0] < 245 || p[1] < 245 || p[2] < 245)) ink++
          }
          const ratio = ink / sample
          console.log(`[GGB_EXPORT] 低墨迹检测: ratio=${ratio.toFixed(4)}, threshold=0.0025`)

          return ratio < 0.0025
        } catch {
          return false
        }
      }

      const isConstructionReady = () => {
        try {
          // 检查对象数量
          if (typeof ggbApplet.getAllObjectNames === 'function') {
            const names = ggbApplet.getAllObjectNames()
            if (Array.isArray(names)) {
              console.log(`[GGB_EXPORT] 对象数量: ${names.length}`)
              if (names.length > 0) {
                return true
              }
            }
          }

          // 检查 XML 内容
          if (typeof ggbApplet.getXML === 'function') {
            const xml = ggbApplet.getXML()
            if (typeof xml === 'string' && xml.length > 0) {
              const hasConstruction = xml.includes('<construction>') || xml.includes('<element ')
              const hasObjects = xml.includes('type="') && xml.includes('label="')
              if (hasConstruction || hasObjects) return true
            }
          }

          // 基础点检查
          if (typeof ggbApplet.exists === 'function') {
            const hasPoints = ggbApplet.exists('A') && ggbApplet.exists('B') && ggbApplet.exists('C')
            if (hasPoints) return true
          }
        } catch {
          // ignore
        }
        return false
      }

      const tryForceRepaint = () => {
        try {
          if (typeof ggbApplet.setSize === 'function') {
            ggbApplet.setSize(PREVIEW_WIDTH, PREVIEW_HEIGHT)
          }
          if (typeof ggbApplet.refreshViews === 'function') {
            ggbApplet.refreshViews()
          }
          if (typeof ggbApplet.repaint === 'function') {
            ggbApplet.repaint()
          }
        } catch {
          // ignore
        }
      }

      // 等待就绪
      for (let i = 0; i < 10; i++) {
        if (isConstructionReady()) break
        tryForceRepaint()
        await raf()
        await wait(250)
      }

      // 导出重试
      for (let i = 0; i < 12; i++) {
        tryForceRepaint()
        await raf()
        await wait(180)

        let pngBase64: string | undefined
        try {
          if (i < 4) {
            pngBase64 = ggbApplet.getPNGBase64(1, false)
          } else if (i < 8) {
            pngBase64 = ggbApplet.getPNGBase64(1, true)
          } else {
            pngBase64 = ggbApplet.getPNGBase64(2, false)
          }
        } catch (e) {
          continue
        }

        if (typeof pngBase64 !== 'string' || pngBase64.length <= 200) {
          continue
        }

        const dataUrl = `data:image/png;base64,${pngBase64}`
        const lowInk = await isPngLowInk(dataUrl)
        
        if (!lowInk) {
          return dataUrl
        }
        await wait(260)
      }

      return
    } catch (error) {
      return
    }
  }

  const isCanvasMostlyWhite = (canvas: HTMLCanvasElement) => {
    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) return false
      const w = canvas.width
      const h = canvas.height
      if (!w || !h) return true
      const sampleW = Math.min(60, w)
      const sampleH = Math.min(60, h)
      const data = ctx.getImageData(Math.floor((w - sampleW) / 2), Math.floor((h - sampleH) / 2), sampleW, sampleH)
        .data
      let white = 0
      const total = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        if (a >= 250 && r >= 250 && g >= 250 && b >= 250) white++
      }
      return white / total > 0.98
    } catch {
      return false
    }
  }

  const renderHtmlToImage = async (url: string, rawHtml: string): Promise<string | undefined> => {
    if (!url || !rawHtml) return
    if (inflight.has(url)) return inflight.get(url)

    const job = (async () => {
      const host = document.createElement('div')
      host.style.position = 'fixed'
      host.style.left = '-100000px'
      host.style.top = '-100000px'
      host.style.width = `${PREVIEW_WIDTH}px`
      host.style.height = `${PREVIEW_HEIGHT}px`
      host.style.overflow = 'hidden'
      host.style.pointerEvents = 'none'
      document.body.appendChild(host)

      const iframe = document.createElement('iframe')
      iframe.style.width = `${PREVIEW_WIDTH}px`
      iframe.style.height = `${PREVIEW_HEIGHT}px`
      iframe.style.border = '0'
      iframe.style.background = '#fff'
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms')
      iframe.srcdoc = rawHtml
      host.appendChild(iframe)

      try {
        await new Promise<void>((resolve) => {
          const done = () => resolve()
          iframe.addEventListener('load', done, { once: true })
          setTimeout(done, 3000)
        })

        await new Promise<void>((resolve) => {
          let attempts = 0
          const maxAttempts = 20

          const checkGeoGebra = () => {
            attempts++
            const contentWindow = iframe.contentWindow as any
            const ggbApplet = contentWindow?.ggbApplet || contentWindow?.ggbApplet?.ggbApplet
            const containerContent = contentWindow?.document?.querySelector('#ggb-container')?.innerHTML?.length || 0
            const hasContent = containerContent > 50
            const hasPngMethod = typeof ggbApplet?.getPNGBase64 === 'function'
            const hasCanvas = !!contentWindow?.document?.querySelector('#ggb-container canvas')

            if ((ggbApplet && (hasContent || hasCanvas) && hasPngMethod) || attempts >= maxAttempts) {
              resolve()
            } else {
              setTimeout(checkGeoGebra, 500)
            }
          }

          setTimeout(checkGeoGebra, 3000)
        })

        await waitForIframeStable(iframe)

        const ggbPng = await tryExportGeoGebraPng(iframe)
        if (ggbPng) {
          return ggbPng
        }

        const body = iframe.contentDocument?.body
        if (!body) {
          return
        }

        const renderOnce = async () =>
          html2canvas(body, {
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            backgroundColor: '#ffffff',
            scale: PREVIEW_SCALE,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: true,
            removeContainer: false,
            scrollX: 0,
            scrollY: 0,
          })

        let canvas = await renderOnce()
        if (isCanvasMostlyWhite(canvas)) {
          await wait(400)
          await waitForIframeStable(iframe)
          canvas = await renderOnce()
        }

        return canvas.toDataURL('image/png')
      } finally {
        iframe.remove()
        host.remove()
        inflight.delete(url)
      }
    })()

    inflight.set(url, job)
    return job
  }

  const ensureHtmlRawMapForMessage = useCallback(async (message: ChatBubble, options: EnsureOptions = {}): Promise<boolean> => {
    if (message.messageType !== 'html') return false

    const regex = options.urlRegex || defaultUrlRegex
    regex.lastIndex = 0

    const urlMatches = message.content ? message.content.match(regex) : null
    const urlsAll = urlMatches || []
    const urls = options.onlyUrls?.length
      ? urlsAll.filter((u) => options.onlyUrls!.includes(u))
      : urlsAll
    
    if (urls.length === 0) return false

    if (!message.rawHtmlMap) message.rawHtmlMap = {}

    const enhance = options.enhanceHtml || enhanceResponsiveHtml
    const logTag = options.logTag || 'HTML_RAW'

    let changed = false

    for (const url of urls) {
      try {
        const cached = message.rawHtmlMap[url]
        const cachedHtml = cached?.[0]
        const cachedImg = cached?.[1]

        let html: string | undefined = cachedHtml

        if (!html) {
          const htmlData = await api.fetchHtmlSource(url)
          if (htmlData) {
            html = htmlData.html || htmlData.raw_html
          }
        }

        if (html) {
          const finalHtml = enhance ? enhance(html) : html
          const needRender = !!options.forceRender || !cachedImg || cachedHtml !== finalHtml
          const finalImg = needRender ? (await renderHtmlToImage(url, finalHtml)) || '' : cachedImg

          const nextValue: [string, string] = [finalHtml, finalImg]
          const prev = message.rawHtmlMap[url]

          if (!prev || prev[0] !== nextValue[0] || prev[1] !== nextValue[1]) {
            message.rawHtmlMap[url] = nextValue
            changed = true
          }
        }
      } catch (error) {
        console.warn(`[${logTag}] 获取 rawHtml 失败:`, url, error)
      }
    }

    return changed
  }, [api, defaultUrlRegex, renderHtmlToImage])

  return { ensureHtmlRawMapForMessage }
}
