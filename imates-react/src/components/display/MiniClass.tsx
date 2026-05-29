import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Modal } from '@/components/base/Modal'
import { Loading } from '@/components/base/Loading'
import '@/components/display/MiniClass.css'

export interface MiniClassProps {
  open?: boolean
  classUrl?: string
  questionTitle?: string
  onClose?: () => void
}

export const MiniClass: React.FC<MiniClassProps> = ({
  open = false,
  classUrl = '',
  questionTitle = '',
  onClose,
}) => {
  const [loading, setLoading] = useState(false)
  const [is404, setIs404] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iframeSrc, setIframeSrc] = useState<string>('')
  
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const check404TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLoadTimers = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }
    if (check404TimeoutRef.current) {
      clearTimeout(check404TimeoutRef.current)
      check404TimeoutRef.current = null
    }
  }, [])

  const startLoadTimeout = useCallback(() => {
    loadTimeoutRef.current = setTimeout(() => {
      setLoading(false)
      setError('加载超时，请检查网络连接或URL是否正确')
      loadTimeoutRef.current = null
    }, 30000)
  }, [])

  const isMicroClassWkUrl = (url: string): boolean => {
    return typeof url === 'string' && url.includes('/wk/')
  }

  const precheckWk404 = async (url: string): Promise<boolean> => {
    if (!isMicroClassWkUrl(url)) {
      return false
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
      })

      if (response.status === 404) {
        setLoading(false)
        setIs404(true)
        return true
      }
    } catch {
      setLoading(false)
      setIs404(true)
      return true
    }

    return false
  }

  const handleIframeLoad = async () => {
    clearLoadTimers()
    setLoading(false)
    
    const url = iframeRef.current?.src
    if (url && url !== 'about:blank') {
      try {
        const response = await fetch(url, {
          method: 'GET',
          cache: 'no-cache',
        })

        if (response.status === 404) {
          setIs404(true)
          setError(null)
          return
        }
      } catch (e) {
        if (isMicroClassWkUrl(url)) {
          setIs404(true)
          setError(null)
          return
        }
      }
    }

    setIs404(false)
    setError(null)
  }

  const handleIframeError = async () => {
    clearLoadTimers()
    setLoading(false)
    
    const url = iframeRef.current?.src
    if (url && url !== 'about:blank') {
      try {
        const response = await fetch(url, {
          method: 'GET',
          cache: 'no-cache'
        })
        if (response.status === 404) {
          setIs404(true)
          setError(null)
          return
        }
      } catch {
        if (isMicroClassWkUrl(url)) {
          setIs404(true)
          setError(null)
          return
        }
      }
    }
    
    setIs404(false)
    setError('页面加载失败，请检查URL是否正确')
  }

  const loadContent = useCallback(async (url: string) => {
    if (!url) return

    clearLoadTimers()

    if (await precheckWk404(url)) {
      return
    }

    setLoading(true)
    setError(null)
    setIs404(false)
    setIframeSrc('about:blank')
    startLoadTimeout()

    // 延迟设置真正的 src 以触发重新加载
    setTimeout(() => {
      setIframeSrc(url)
    }, 0)
  }, [clearLoadTimers, startLoadTimeout])

  useEffect(() => {
    if (!open) {
      setIframeSrc('')
      clearLoadTimers()
      setLoading(false)
      setIs404(false)
      setError(null)
      return
    }

    if (classUrl) {
      setIs404(false)
      setError(null)
      loadContent(classUrl)
    }
  }, [open, classUrl, loadContent, clearLoadTimers])

  useEffect(() => {
    return () => clearLoadTimers()
  }, [clearLoadTimers])

  return (
    <Modal 
      open={open} 
      title="微课" 
      onClose={onClose}
      initialWidth={1200}
      initialHeight={700}
      minWidth={800}
      minHeight={500}
      showFooter={false}
    >
      <div className="mini-class-container">
        {is404 ? (
          <div className="empty-container">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="#999">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM10 12l5 3V9z"/>
            </svg>
            <div className="empty-title">该题目暂无微课内容</div>
            <div className="empty-desc">微课资源可能尚未上传或已被移除</div>
          </div>
        ) : classUrl ? (
          <div className="video-container">
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className="iframe-player"
              frameBorder="0"
              scrolling="auto"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
            {loading && (
              <div className="loading-overlay">
                <Loading text="正在加载微课..." size={48} />
              </div>
            )}
            {error && !loading && (
              <div className="empty-container">
                <div className="empty-title">{error}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-container">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="#999">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM10 12l5 3V9z"/>
            </svg>
            <div className="empty-title">暂无微课内容</div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default MiniClass
