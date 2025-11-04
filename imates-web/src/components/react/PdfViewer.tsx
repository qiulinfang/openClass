/**
 * React版本的PDF Viewer组件
 */

import React, { useMemo } from 'react'
import { PdfPage } from './PdfPage'
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { PdfStateAdapterReactZustand, usePdfStore } from '@/services/pdf/adapters/react/PdfStateAdapterReactZustand'
import type { PdfState } from '@/services/pdf/types/pdf-types'

interface PdfViewerProps {
  file: File | null
  onScreenshotCaptured?: (blob: Blob) => void
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, onScreenshotCaptured }) => {
  const state = usePdfStore()
  const pdfCoreService = useMemo(() => new PdfCoreService(), [])
  const stateAdapter = useMemo(() => new PdfStateAdapterReactZustand(), [])

  // 加载PDF
  React.useEffect(() => {
    const loadPdf = async () => {
      if (!file) return

      try {
        stateAdapter.setLoading(true)
        stateAdapter.setError(null)

        // 加载PDF
        const result = await pdfCoreService.loadPdf(file)

        // 计算页面布局
        const layouts = await pdfCoreService.calculatePageLayouts(state.scale)

        // 更新状态
        stateAdapter.setPdfLoaded({
          ...result,
          pageLayouts: layouts,
        })
      } catch (error) {
        stateAdapter.setError(error instanceof Error ? error.message : 'PDF加载失败')
      } finally {
        stateAdapter.setLoading(false)
      }
    }

    loadPdf()
  }, [file, pdfCoreService, stateAdapter, state.scale])

  if (state.isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
        }}
      >
        <div>加载中...</div>
        <div style={{ fontSize: '14px', color: '#666' }}>正在加载PDF...</div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '50px' }}>⚠️</div>
        <div>{state.error}</div>
        <button
          onClick={() => {
            // 重试加载
            if (file) {
              const loadPdf = async () => {
                try {
                  stateAdapter.setLoading(true)
                  stateAdapter.setError(null)
                  const result = await pdfCoreService.loadPdf(file)
                  const layouts = await pdfCoreService.calculatePageLayouts(state.scale)
                  stateAdapter.setPdfLoaded({
                    ...result,
                    pageLayouts: layouts,
                  })
                } catch (error) {
                  stateAdapter.setError(
                    error instanceof Error ? error.message : 'PDF加载失败'
                  )
                } finally {
                  stateAdapter.setLoading(false)
                }
              }
              loadPdf()
            }
          }}
          style={{
            padding: '12px 24px',
            background: '#1976D2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          重试
        </button>
      </div>
    )
  }

  if (!state.isDocLoaded || state.pageLayouts.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '80px', color: '#ccc' }}>📄</div>
        <div style={{ fontSize: '18px', color: '#666' }}>暂无PDF文档</div>
        <div style={{ fontSize: '14px', color: '#999' }}>请选择或加载PDF文件开始查看</div>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        padding: '20px 0',
      }}
    >
      {state.pageLayouts.map((layout) => (
        <PdfPage
          key={layout.pageNum}
          layout={layout}
          pdfCoreService={pdfCoreService}
          stateAdapter={stateAdapter}
          onScreenshotCaptured={onScreenshotCaptured}
        />
      ))}
    </div>
  )
}

