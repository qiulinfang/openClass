import { getXuebanToken } from './auth'

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  code?: number
}

const getAuthHeaders = (): Record<string, string> => {
  const token = getXuebanToken()
  if (!token) return {}
  return {
    'Token': token,
    'sa-token': token,
    'authorization': token,
  }
}

export class HttpClient {
  private baseUrl: string

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }

  async post<T = any>(
    url: string,
    data?: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(this.baseUrl + url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...options.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      })

      const text = await response.text()
      
      try {
        const json = JSON.parse(text)
        return json
      } catch {
        return {
          success: response.ok,
          message: text,
          data: text as any,
        }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      }
    }
  }

  async get<T = any>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(this.baseUrl + url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...options.headers,
        },
        ...options,
      })

      const json = await response.json()
      return json
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      }
    }
  }
}

export const httpClient = new HttpClient()
