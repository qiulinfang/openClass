import { getApiBaseUrl } from '@/config/env-config'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: any
  baseUrl?: string
}

export const request = <T = any>(options: RequestOptions): Promise<T> => {
  return new Promise((resolve, reject) => {
    const baseUrl = options.baseUrl || getApiBaseUrl()
    const xuebanToken = uni.getStorageSync('XUEBAN_TOKEN') || ''
    const yanbanToken = uni.getStorageSync('YANBAN_TOKEN') || ''

    // 对齐 imates-web HttpClient.getDynamicAuthConfig() 的 Header 传递规范
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.header
    }

    // 根据 URL 判断匹配 token
    let selectedToken = ''
    if (
      options.url.startsWith('/xb-test') ||
      options.url.startsWith('/xb-release')
    ) {
      selectedToken = xuebanToken
    } else if (
      options.url.startsWith('/yb-test') ||
      options.url.startsWith('/yb-release')
    ) {
      selectedToken = yanbanToken
    } else {
      selectedToken = xuebanToken || yanbanToken
    }

    if (selectedToken && !options.url.includes('/admin/login')) {
      headers['Token'] = selectedToken
      headers['sa-token'] = selectedToken
      headers['authorization'] = selectedToken
      headers['Authorization'] = selectedToken
    }

    const startTime = Date.now()
    const fullUrl = options.url.startsWith('http') ? options.url : `${baseUrl}${options.url}`
    console.log(`[Request:Start] 🚀 [${options.method || 'GET'}] ${fullUrl}`, { data: options.data, header: headers })

    uni.request({
      url: fullUrl,
      method: options.method || 'GET',
      data: options.data,
      header: headers,
      success: (res) => {
        const duration = Date.now() - startTime
        console.log(`[Request:Success] ✅ [${res.statusCode}] ${fullUrl} (${duration}ms)`, res.data)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
        } else {
          uni.showToast({
            title: `请求错误: ${res.statusCode}`,
            icon: 'none'
          })
          reject(res)
        }
      },
      fail: (err) => {
        const duration = Date.now() - startTime
        console.error(`[Request:Fail] ❌ ${fullUrl} (${duration}ms)`, err)
        uni.showToast({
          title: '网络连接失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}
