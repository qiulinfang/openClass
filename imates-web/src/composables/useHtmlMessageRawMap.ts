import type { ChatBubble } from '@/types'
import type { ApiService } from '@/services'
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
 * HTML 消息原始内容获取与增强 Composable
 * 
 * 功能：
 * - 从消息内容中提取 HTML URL
 * - 通过后端代理获取 HTML 源码
 * - 对 HTML 进行响应式增强处理
 * - 缓存到 message.rawHtmlMap 供 iframe 渲染使用
 * 
 * 使用场景：
 * - 新消息完成后补齐 rawHtmlMap
 * - 历史消息加载时增强 HTML 内容
 */
export const useHtmlMessageRawMap = (api: Pick<ApiService, 'fetchHtmlSource'>) => {
  // 默认匹配 kelvin-cosin.cloud 的 HTML 文件 URL
  const defaultUrlRegex = /(https?:\/\/[a-z0-9.-]*kelvin-cosin\.cloud\/.*?\.html)/gi

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
      void ggbContainer.offsetHeight
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
      console.log(`[GGB_EXPORT] 开始导出: ggbApplet存在=${!!ggbApplet}, getPNGBase64函数=${typeof ggbApplet?.getPNGBase64}`)
      
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

          // 低墨迹检测：坐标轴/网格通常只占很少像素；真正图形会显著增加非白像素占比。
          // 这里做采样而不是全量遍历，避免开销。
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

          // 经验阈值：仅坐标轴/网格一般非常低；如果你的主题颜色很浅可再调低一些
          return ratio < 0.0025
        } catch {
          return false
        }
      }

      // 等待 GeoGebra 再稳定一点：有时坐标轴出来了但对象/图形还没渲染完成
      // 这里用"对象/构造就绪"作为导出门槛，并做多次导出重试
      const isConstructionReady = () => {
        try {
          // 检查对象数量（最可靠的方式）
          if (typeof ggbApplet.getAllObjectNames === 'function') {
            const names = ggbApplet.getAllObjectNames() as unknown
            if (Array.isArray(names)) {
              console.log(`[GGB_EXPORT] 对象数量: ${names.length}`)
              if (names.length > 0) {
                console.log(`[GGB_EXPORT] 构造检查通过: getAllObjectNames返回${names.length}个对象`)
                console.log(`[GGB_EXPORT] 对象列表:`, names.slice(0, 10))
                return true
              }
            }
          }

          // 检查 XML 内容（兼容旧版本）
          if (typeof ggbApplet.getXML === 'function') {
            const xml = ggbApplet.getXML() as unknown
            if (typeof xml === 'string' && xml.length > 0) {
              // 检查 XML 中是否包含构造/对象（仅用长度会误判：有时只有坐标系配置但无对象）
              const hasConstruction = xml.includes('<construction>') || xml.includes('<element ')
              const hasObjects = xml.includes('type="') && xml.includes('label="')
              console.log(`[GGB_EXPORT] XML长度=${xml.length}`)
              console.log(`[GGB_EXPORT] XML内容检查: construction=${hasConstruction}, objects=${hasObjects}`)
              if (hasConstruction || hasObjects) return true
            }
          }

          // 新版本适配：检查是否有 evalCommand 的执行结果
          // 通过检查一些基础对象是否存在来判断
          if (typeof ggbApplet.exists === 'function') {
            // 检查 A、B、C 这些基础点是否存在（根据 HTML 中的命令）
            const hasPoints = ggbApplet.exists('A') && ggbApplet.exists('B') && ggbApplet.exists('C')
            console.log(`[GGB_EXPORT] 基础点检查: A=${ggbApplet.exists('A')}, B=${ggbApplet.exists('B')}, C=${ggbApplet.exists('C')}`)
            if (hasPoints) return true
          }
        } catch {
          // ignore
        }
        console.log(`[GGB_EXPORT] 构造未就绪`)
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

      // 等待就绪（最多约 2.5s）
      for (let i = 0; i < 10; i++) {
        if (isConstructionReady()) break
        console.log(`[GGB_EXPORT] 等待构造就绪 #${i+1}/10`)
        tryForceRepaint()
        await raf()
        await wait(250)
      }

      // 导出重试：即使"对象已就绪"，首帧也可能只渲染出坐标轴；因此对导出结果做低墨迹判定
      // 最多约 4s
      for (let i = 0; i < 12; i++) {
        console.log(`[GGB_EXPORT] 导出尝试 #${i+1}/12`)
        tryForceRepaint()
        await raf()
        await wait(180)

        // 尝试不同的导出参数
        let pngBase64: string | undefined
        try {
          if (i < 4) {
            // 前4次尝试使用原始参数
            pngBase64 = ggbApplet.getPNGBase64(1, false)
            console.log(`[GGB_EXPORT] 使用参数 (1, false)`)
          } else if (i < 8) {
            // 中4次尝试使用透明背景
            pngBase64 = ggbApplet.getPNGBase64(1, true)
            console.log(`[GGB_EXPORT] 使用参数 (1, true)`)
          } else {
            // 最后4次尝试更高分辨率
            pngBase64 = ggbApplet.getPNGBase64(2, false)
            console.log(`[GGB_EXPORT] 使用参数 (2, false)`)
          }
        } catch (e) {
          console.log(`[GGB_EXPORT] PNG 导出异常:`, e)
          continue
        }

        if (typeof pngBase64 !== 'string' || pngBase64.length <= 200) {
          console.log(`[GGB_EXPORT] PNG 数据无效或太短: length=${pngBase64?.length || 0}`)
          continue
        }

        const dataUrl = `data:image/png;base64,${pngBase64}`
        const lowInk = await isPngLowInk(dataUrl)
        console.log(`[GGB_EXPORT] 低墨迹检测: ratio=${lowInk ? 'low' : 'normal'}`)
        
        if (!lowInk) {
          console.log(`[GGB_EXPORT] PNG 导出成功，墨迹正常`)
          console.log(`[GGB_EXPORT] PNG 数据详情: base64长度=${pngBase64.length}, dataUrl长度=${dataUrl.length}`)
          
          // 尝试验证图片有效性
          try {
            const img = new Image()
            img.onload = () => {
              console.log(`[GGB_EXPORT] 图片验证成功: 尺寸=${img.naturalWidth}x${img.naturalHeight}`)
            }
            img.onerror = () => {
              console.log(`[GGB_EXPORT] 图片验证失败: 无法加载`)
            }
            img.src = dataUrl
          } catch (e) {
            console.log(`[GGB_EXPORT] 图片验证异常:`, e)
          }
          
          return dataUrl
        }

        // 低墨迹（疑似仅坐标轴/网格）：再等一会继续
        console.log(`[GGB_EXPORT] 检测到低墨迹，继续等待...`)
        await wait(260)
      }

      console.log(`[GGB_EXPORT] 所有导出尝试均失败`)
      return
    } catch (error) {
      console.log(`[GGB_EXPORT] 导出异常:`, error)
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
      // 统计接近纯白像素占比
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

    console.log(`[HTML_RENDER] 开始渲染 URL: ${url}`)
    console.log(`[HTML_RENDER] 原始 HTML 长度: ${rawHtml.length}`)

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
        console.log(`[HTML_RENDER] iframe 创建完成，等待加载...`)
        await new Promise<void>((resolve) => {
          const done = () => {
            console.log(`[HTML_RENDER] iframe 加载完成`)
            resolve()
          }
          iframe.addEventListener('load', done, { once: true })
          setTimeout(() => {
            console.log(`[HTML_RENDER] iframe 加载超时`)
            resolve()
          }, 3000)
        })

        console.log(`[HTML_RENDER] 检查 GeoGebra 状态...`)
        await new Promise<void>((resolve) => {
          let attempts = 0
          const maxAttempts = 20 // 增加最大尝试次数

          const checkGeoGebra = () => {
            attempts++
            const contentWindow = iframe.contentWindow as any
            const ggbApplet = contentWindow?.ggbApplet || contentWindow?.ggbApplet?.ggbApplet
            const containerContent = contentWindow?.document?.querySelector('#ggb-container')?.innerHTML?.length || 0
            const hasContent = containerContent > 50 // 降低阈值，因为新版本可能只注入 canvas
            const hasPngMethod = typeof ggbApplet?.getPNGBase64 === 'function'
            
            // 额外检查：是否有 canvas 元素（新版本 GeoGebra 的渲染方式）
            const hasCanvas = !!contentWindow?.document?.querySelector('#ggb-container canvas')

            console.log(`[HTML_RENDER] GeoGebra 检查 #${attempts}: ggbApplet=${!!ggbApplet}, containerContent=${containerContent}, getPNGBase64=${hasPngMethod}, hasCanvas=${hasCanvas}`)

            // 更宽松的条件：有实例 + (有内容或canvas) + 有导出方法
            if ((ggbApplet && (hasContent || hasCanvas) && hasPngMethod) || attempts >= maxAttempts) {
              console.log(`[HTML_RENDER] GeoGebra 检查完成: ggbApplet=${!!ggbApplet}, hasContent=${hasContent}, hasCanvas=${hasCanvas}, getPNGBase64=${hasPngMethod}`)
              resolve()
            } else {
              setTimeout(checkGeoGebra, 500)
            }
          }

          setTimeout(checkGeoGebra, 3000) // 增加到 3 秒，给 appletOnLoad 回调更多时间
        })

        console.log(`[HTML_RENDER] 等待 iframe 稳定...`)
        await waitForIframeStable(iframe)

        // GeoGebra 优先：直接用官方导出 API，避免 html2canvas 截不到 canvas/WebGL 而变白
        console.log(`[HTML_RENDER] 尝试 GeoGebra PNG 导出...`)
        const ggbPng = await tryExportGeoGebraPng(iframe)
        if (ggbPng) {
          console.log(`[HTML_RENDER] GeoGebra PNG 导出成功，长度: ${ggbPng.length}`)
          return ggbPng
        }
        console.log(`[HTML_RENDER] GeoGebra PNG 导出失败，回退到 html2canvas`)

        const body = iframe.contentDocument?.body
        if (!body) {
          console.log(`[HTML_RENDER] 无法获取 body，渲染失败`)
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

        // 白图通常是首帧未渲染完成，做一次轻量重试
        console.log(`[HTML_RENDER] 第一次 html2canvas 渲染...`)
        let canvas = await renderOnce()
        const mostlyWhite = isCanvasMostlyWhite(canvas)
        console.log(`[HTML_RENDER] 第一次渲染结果: mostlyWhite=${mostlyWhite}, canvas尺寸=${canvas.width}x${canvas.height}`)

        if (mostlyWhite) {
          console.log(`[HTML_RENDER] 检测到白图，等待 400ms 后重试...`)
          await wait(400)
          await waitForIframeStable(iframe)
          console.log(`[HTML_RENDER] 第二次 html2canvas 渲染...`)
          canvas = await renderOnce()
          const mostlyWhiteAfterRetry = isCanvasMostlyWhite(canvas)
          console.log(`[HTML_RENDER] 第二次渲染结果: mostlyWhite=${mostlyWhiteAfterRetry}`)
        }

        const dataUrl = canvas.toDataURL('image/png')
        console.log(`[HTML_RENDER] 最终渲染完成，图片长度: ${dataUrl.length}`)
        return dataUrl
      } finally {
        iframe.remove()
        host.remove()
        inflight.delete(url)
      }
    })()

    inflight.set(url, job)
    return job
  }

  /**
   * 确保消息中的 HTML 内容被获取并缓存到 rawHtmlMap
   * 
   * @param message 聊天消息对象
   * @param options 配置选项
   * @returns 是否有变更（true: 新增或更新了 HTML，false: 无变化）
   */
  const ensureHtmlRawMapForMessage = async (message: ChatBubble, options: EnsureOptions = {}): Promise<boolean> => {
    console.log('[ensureHtmlRawMapForMessage] 收到消息对象:', JSON.parse(JSON.stringify(message)))
    // 非 HTML 消息直接返回
    if (message.messageType !== 'html') {
      console.log('[ensureHtmlRawMapForMessage] 拦截：消息类型不是 html')
      return false
    }

    // 使用自定义正则或默认正则
    const regex = options.urlRegex || defaultUrlRegex
    regex.lastIndex = 0  // 重置正则状态

    // 从消息内容中提取 HTML URL
    const urlMatches = message.content ? message.content.match(regex) : null
    const urlsAll = urlMatches || []
    const urls = options.onlyUrls?.length
      ? urlsAll.filter((u) => options.onlyUrls!.includes(u))
      : urlsAll
    
    console.log('[ensureHtmlRawMapForMessage] 正则匹配到的 URLs:', urlsAll, '过滤后的 URLs:', urls)
    if (urls.length === 0) return false

    if (!message.rawHtmlMap) message.rawHtmlMap = {}

    // 获取增强函数和日志标签
    const enhance = options.enhanceHtml || enhanceResponsiveHtml
    const logTag = options.logTag || 'HTML_RAW'

    let changed = false

    // 遍历每个 URL，获取并缓存 HTML 内容
    for (const url of urls) {
      try {
        const cached = message.rawHtmlMap[url]
        const cachedHtml = cached?.[0]
        const cachedImg = cached?.[1]

        let html: string | undefined = cachedHtml

        // 缓存未命中，发起 HTTP 请求
        if (!html) {
          console.log('[ensureHtmlRawMapForMessage] 缓存未命中，开始请求 fetchHtmlSource:', url)
          const htmlData = await api.fetchHtmlSource(url)
          if (htmlData) {
            // 直接使用后端已经增强过的 html
            html = htmlData.html || htmlData.raw_html
          }
        }

        // 对 HTML 进行增强处理并缓存
        if (html) {
          const finalHtml = enhance ? enhance(html) : html

          // 🎯 核心逻辑：始终优先在前端生成/复用快照
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
  }

  return { ensureHtmlRawMapForMessage }
}
