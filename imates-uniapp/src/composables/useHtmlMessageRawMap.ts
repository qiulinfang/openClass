import type { ChatBubble } from '@/types/chat'

export const enhanceResponsiveHtml = (html: string): string => {
  if (!html) return html
  return html
}

type EnsureOptions = {
  urlRegex?: RegExp
  logTag?: string
}

export const useHtmlMessageRawMap = (api?: { fetchHtmlSource?: (url: string) => Promise<string> }) => {
  const defaultUrlRegex = /(https?:\/\/[a-z0-9.-]*kelvin-cosin\.cloud\/.*?\.html)/gi
  const inflight = new Map<string, Promise<string | undefined>>()

  const extractUrls = (content: string, urlRegex = defaultUrlRegex): string[] => {
    if (!content) return []
    const matches: string[] = []
    let match: RegExpExecArray | null
    const regex = new RegExp(urlRegex.source, urlRegex.flags)
    while ((match = regex.exec(content)) !== null) {
      matches.push(match[1])
    }
    return Array.from(new Set(matches))
  }

  const fetchSource = async (url: string): Promise<string | undefined> => {
    if (inflight.has(url)) return inflight.get(url)
    const promise = (async () => {
      try {
        if (api?.fetchHtmlSource) {
          return await api.fetchHtmlSource(url)
        }
        return undefined
      } catch (err) {
        console.warn('[useHtmlMessageRawMap] 拉取 HTML 源码失败:', url, err)
        return undefined
      } finally {
        inflight.delete(url)
      }
    })()
    inflight.set(url, promise)
    return promise
  }

  const ensureHtmlRawMapForMessage = async (
    msg: ChatBubble,
    options: EnsureOptions = {},
  ): Promise<boolean> => {
    if (!msg || !msg.content) return false
    const urls = extractUrls(msg.content, options.urlRegex)
    if (urls.length === 0) return false

    const nextMap = { ...(msg.rawHtmlMap || {}) }
    let updated = false

    for (const url of urls) {
      if (nextMap[url] && nextMap[url][0]) continue
      const raw = await fetchSource(url)
      if (raw) {
        nextMap[url] = [raw]
        updated = true
      }
    }

    if (updated) {
      msg.rawHtmlMap = nextMap
    }
    return updated
  }

  return {
    ensureHtmlRawMapForMessage,
    extractUrls,
  }
}
