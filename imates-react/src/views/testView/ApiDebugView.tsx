import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { httpClient } from '@/services'
import { getApiPaths } from '@/config/env-config'
import Button from '@/components/base/Button'
import './ApiDebugView.css'

interface ApiPreset {
  name: string
  method: string
  url: string
  body: string
}

interface ApiGroup {
  groupName: string
  items: ApiPreset[]
}

interface HistoryItem {
  method: string
  url: string
  body: string
  success: boolean
  status: number | string
  latency: number
  time: string
  timeout?: number
}

const ApiDebugView: React.FC = () => {
  const apiPaths = getApiPaths()

  const [leftTab, setLeftTab] = useState<'presets' | 'history'>('presets')
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST')
  const [url, setUrl] = useState(apiPaths.xueban.biologyTopicKnowledge.knowledgeTopicAndAck2)
  const [bodyText, setBodyText] = useState('{\n  "bmNoList": "1001,1002,1003"\n}')
  const [timeoutMs, setTimeoutMs] = useState<number>(30000)

  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [responseText, setResponseText] = useState('')
  const [lastResponse, setLastResponse] = useState<{ status: number | string; latency: number; success: boolean } | null>(null)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [stats, setStats] = useState({
    total: 0,
    avgLatency: 0,
    successRate: 0,
    successCount: 0,
    totalLatency: 0
  })

  const apiPresets: ApiGroup[] = useMemo(() => [
    {
      groupName: '学伴 AI 服务',
      items: [
        {
          name: '数学 AI 聊天',
          method: 'POST',
          url: apiPaths.xueban.ai.chatMath,
          body: '{\n  "content": "求导函数 y=x^2",\n  "subject": "math"\n}'
        },
        {
          name: '图片/截图问答',
          method: 'POST',
          url: apiPaths.xueban.ai.previewPictureQA,
          body: '{\n  "base64DataUrl": "data:image/png;base64,...",\n  "content": "这道题怎么做？"\n}'
        },
        {
          name: '多轮对话',
          method: 'POST',
          url: apiPaths.xueban.ai.chats,
          body: '{\n  "messages": [\n    {"role": "user", "content": "你好"}\n  ]\n}'
        }
      ]
    },
    {
      groupName: '题目与知识点',
      items: [
        {
          name: '知识点查相似题 (v2)',
          method: 'POST',
          url: apiPaths.xueban.biologyTopicKnowledge.knowledgeTopicAndAck2,
          body: '{\n  "bmNoList": "1001,1002,1003",\n  "exercisesId": ""\n}'
        },
        {
          name: '文本搜题 (数学)',
          method: 'GET',
          url: `${apiPaths.xueban.permission.textSearchMathBase}/勾股定理`,
          body: ''
        },
        {
          name: '题目详情',
          method: 'GET',
          url: `${apiPaths.xueban.permission.exercises}/1001`,
          body: ''
        }
      ]
    },
    {
      groupName: '研伴/作业服务',
      items: [
        {
          name: '学生登录',
          method: 'POST',
          url: apiPaths.yanban.auth.loginStudent,
          body: '{\n  "username": "test",\n  "password": "123"\n}'
        },
        {
          name: '获取未完成作业',
          method: 'POST',
          url: apiPaths.yanban.homework.undoList,
          body: '{\n  "userId": "123"\n}'
        },
        {
          name: '作业详情列表',
          method: 'POST',
          url: apiPaths.yanban.homework.detailList,
          body: '{\n  "homeworkId": "hw_001"\n}'
        }
      ]
    },
    {
      groupName: '教师与教材',
      items: [
        {
          name: '教师端聊天历史',
          method: 'POST',
          url: apiPaths.yanban.teacher.historyList,
          body: '{\n  "sessionId": "teacher_123_math",\n  "pageNum": 1,\n  "pageSize": 20\n}'
        },
        {
          name: '教师端教材树',
          method: 'GET',
          url: apiPaths.yanban.textbook.teacherTextbookSectionTree,
          body: ''
        },
        {
          name: '教材学习包',
          method: 'GET',
          url: apiPaths.yanban.textbook.teacherTextbookLearningPackage,
          body: ''
        }
      ]
    }
  ], [apiPaths])

  const loadHistory = useCallback(() => {
    const saved = localStorage.getItem('api_debug_history')
    if (saved) {
      try {
        setHistory(JSON.parse(saved))
      } catch {
        setHistory([])
      }
    }
  }, [])

  const updateStats = useCallback((historyList: HistoryItem[]) => {
    if (historyList.length === 0) return
    
    const total = historyList.length
    const successCount = historyList.filter(h => h.success).length
    const successRate = Math.round((successCount / total) * 100)
    const totalLat = historyList.reduce((acc, h) => acc + (h.latency || 0), 0)
    const avgLatency = Math.round(totalLat / total)
    
    setStats({
      total,
      avgLatency,
      successRate,
      successCount,
      totalLatency: totalLat
    })
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    updateStats(history)
  }, [history, updateStats])

  const saveToHistory = useCallback((item: HistoryItem) => {
    setHistory(prev => {
      const newList = [item, ...prev].slice(0, 20)
      localStorage.setItem('api_debug_history', JSON.stringify(newList))
      return newList
    })
  }, [])

  const getMethodColor = (m: string) => {
    switch (m.toUpperCase()) {
      case 'GET': return 'method-get'
      case 'POST': return 'method-post'
      case 'PUT': return 'method-put'
      case 'DELETE': return 'method-delete'
      default: return ''
    }
  }

  const applyPreset = (api: ApiPreset) => {
    setMethod(api.method as any)
    setUrl(api.url)
    setBodyText(api.body)
    setTimeoutMs(30000)
  }

  const applyHistory = (item: HistoryItem) => {
    setMethod(item.method as any)
    setUrl(item.url)
    setBodyText(item.body)
    setTimeoutMs(item.timeout || 30000)
  }

  const safePrettyJson = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  const parseBody = (): unknown => {
    const t = (bodyText || '').trim()
    if (!t) return {}
    try {
      return JSON.parse(t)
    } catch (e) {
      throw new Error('请求体 JSON 格式错误')
    }
  }

  const callApi = async () => {
    setLoading(true)
    setErrorText('')
    setResponseText('')
    const startTime = Date.now()

    try {
      const u = (url || '').trim()
      if (!u) {
        throw new Error('URL 不能为空')
      }

      const requestConfig = {
        timeout: Math.max(0, Number(timeoutMs) || 0),
      }

      let resp: any
      if (method === 'GET') {
        resp = await httpClient.get<any>(u, requestConfig)
      } else if (method === 'DELETE') {
        resp = await httpClient.delete<any>(u, requestConfig)
      } else {
        const body = parseBody()
        if (method === 'POST') {
          resp = await httpClient.post<any>(u, body, requestConfig)
        } else {
          resp = await httpClient.put<any>(u, body, requestConfig)
        }
      }

      const latency = Date.now() - startTime
      setResponseText(safePrettyJson(resp))
      setLastResponse({ status: 200, latency, success: true })
      
      saveToHistory({
        method: method,
        url: u,
        body: bodyText,
        success: true,
        status: 200,
        latency,
        time: new Date().toLocaleTimeString(),
        timeout: timeoutMs
      })

    } catch (e: any) {
      const latency = Date.now() - startTime
      const message = e.message || String(e)
      setErrorText(message)
      setLastResponse({ status: e.status || 'ERROR', latency, success: false })

      saveToHistory({
        method: method,
        url: url,
        body: bodyText,
        success: false,
        status: e.status || 'ERR',
        latency,
        time: new Date().toLocaleTimeString(),
        timeout: timeoutMs
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="api-debug-dashboard">
      <div className="dashboard-layout">
        {/* 左侧：预设与历史 */}
        <aside className="sidebar">
          <div className="sidebar-header">
            API 控制台
          </div>
          <div className="sidebar-tabs">
            <div 
              className={`sidebar-tab ${leftTab === 'presets' ? 'active' : ''}`}
              onClick={() => setLeftTab('presets')}
            >
              预设模板
            </div>
            <div 
              className={`sidebar-tab ${leftTab === 'history' ? 'active' : ''}`}
              onClick={() => setLeftTab('history')}
            >
              历史记录
            </div>
          </div>

          <div className="sidebar-content">
            {leftTab === 'presets' ? (
              <div className="presets-list">
                {apiPresets.map((group, gIndex) => (
                  <div key={gIndex} className="preset-group">
                    <div className="preset-group-header">{group.groupName}</div>
                    {group.items.map((api, aIndex) => (
                      <div 
                        key={aIndex} 
                        className="preset-item"
                        onClick={() => applyPreset(api)}
                      >
                        <span className={`item-method-badge ${getMethodColor(api.method)}`}>
                          {api.method}
                        </span>
                        <span className="item-name">{api.name}</span>
                        <span className="item-url">{api.url}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-list">
                {history.length === 0 ? (
                  <div className="empty-state">暂无调用历史</div>
                ) : (
                  history.map((item, index) => (
                    <div 
                      key={index} 
                      className="preset-item"
                      onClick={() => applyHistory(item)}
                    >
                      <span className={`item-method-badge ${item.success ? 'status-positive' : 'status-negative'}`}>
                        {item.status}
                      </span>
                      <span className="item-name">{item.url}</span>
                      <span className="item-url">{item.time} | {item.latency}ms</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* 右侧：主操作区 */}
        <main className="main-area">
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">总调用次数</div>
              <div className="stat-value text-primary">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">平均响应时间</div>
              <div className="stat-value text-secondary">{stats.avgLatency}ms</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">成功率</div>
              <div className={`stat-value ${stats.successRate >= 90 ? 'text-positive' : 'text-warning'}`}>
                {stats.successRate}%
              </div>
            </div>
          </div>

          <div className="request-config-card">
            <div className="config-row">
              <select 
                className="method-select"
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
              >
                {['GET', 'POST', 'PUT', 'DELETE'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input 
                className="url-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="请输入 API 路径..."
              />
              <input 
                className="timeout-input"
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                placeholder="超时(ms)"
              />
              <Button 
                label="发送请求" 
                loading={loading}
                onClick={callApi}
              />
            </div>
            <div className="body-area">
              <div className="body-label">请求体 (JSON)</div>
              <textarea 
                className="body-textarea"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder='{"key": "value"}'
              />
            </div>
          </div>

          <div className="response-card">
            <div className="response-header">
              <div className="text-subtitle1">响应结果</div>
              {lastResponse && (
                <div className="response-info">
                  <span className={`status-badge ${lastResponse.success ? 'status-positive' : 'status-negative'}`}>
                    Status: {lastResponse.status}
                  </span>
                  <span className="latency-badge">
                    Time: {lastResponse.latency}ms
                  </span>
                  <button 
                    className="copy-btn"
                    onClick={() => navigator.clipboard.writeText(responseText || errorText)}
                  >
                    📋
                  </button>
                </div>
              )}
            </div>
            <div className="response-content">
              {loading && (
                <div className="loading-overlay">
                  <div className="spinner">⏳</div>
                </div>
              )}
              {!responseText && !errorText ? (
                <div className="empty-response">等待请求发送...</div>
              ) : (
                <pre className={`response-pre ${errorText ? 'text-negative' : ''}`}>
                  {errorText || responseText}
                </pre>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default ApiDebugView
