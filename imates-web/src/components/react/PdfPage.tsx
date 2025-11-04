/**
 * React版本的PDF页面组件
 */

import React, { useEffect, useRef, useState } from 'react'
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { FabricCanvasServiceEnhanced } from '@/services/pdf/core/FabricCanvasServiceEnhanced'
import { PdfStateAdapterReactZustand } from '@/services/pdf/adapters/react/PdfStateAdapterReactZustand'
import type { PageLayout } from '@/services/pdf/types/pdf-types'

interface PdfPageProps {
  layout: PageLayout
  pdfCoreService: PdfCoreService
  stateAdapter: PdfStateAdapterReactZustand
  onScreenshotCaptured?: (blob: Blob) => void
}

export const PdfPage: React.FC<PdfPageProps> = ({
  layout,
  pdfCoreService,
  stateAdapter,
  onScreenshotCaptured,
}) => {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fabricServiceRef = useRef<FabricCanvasServiceEnhanced | null>(null)

  useEffect(() => {
    const initPage = async () => {
      if (!pdfCanvasRef.current || !fabricCanvasRef.current) return

      try {
        setIsLoading(true)
        setError(null)

        // 渲染PDF页面
        const scale = stateAdapter.getState().scale
        await pdfCoreService.renderPage(layout.pageNum, pdfCanvasRef.current, scale)

        // 初始化Fabric Canvas
        const drawingConfig = stateAdapter.getDrawingConfig()
        const fabricService = new FabricCanvasServiceEnhanced(drawingConfig)

        await fabricService.initialize(
          fabricCanvasRef.current,
          pdfCanvasRef.current,
          layout.width,
          layout.height,
          layout.pageNum,
          {
            onAnnotationChanged: (annotations) => {
              stateAdapter.setAnnotations(layout.pageNum, annotations)
            },
            onScreenshotCaptured: (blob) => {
              onScreenshotCaptured?.(blob)
            },
          }
        )

        // 加载现有注释
        const annotations = stateAdapter.getAnnotations(layout.pageNum)
        if (annotations.length > 0) {
          fabricService.loadAnnotations(annotations)
        }

        fabricServiceRef.current = fabricService
      } catch (err) {
        console.error(`第 ${layout.pageNum} 页初始化失败:`, err)
        setError(err instanceof Error ? err.message : '初始化失败')
      } finally {
        setIsLoading(false)
      }
    }

    initPage()

    return () => {
      if (fabricServiceRef.current) {
        fabricServiceRef.current.dispose()
        fabricServiceRef.current = null
      }
    }
  }, [layout.pageNum, layout.width, layout.height, pdfCoreService, stateAdapter, onScreenshotCaptured])

  // 监听工具变化
  useEffect(() => {
    const selectedTool = stateAdapter.getSelectedTool()
    if (fabricServiceRef.current) {
      fabricServiceRef.current.setToolMode(selectedTool)
    }
  }, [stateAdapter.getSelectedTool()])

  // 监听配置变化
  useEffect(() => {
    const config = stateAdapter.getDrawingConfig()
    if (fabricServiceRef.current) {
      fabricServiceRef.current.updateConfig(config)
    }
  }, [stateAdapter.getDrawingConfig()])

  // 监听缩放变化
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfCanvasRef.current) return

      try {
        setIsLoading(true)
        const scale = stateAdapter.getState().scale
        await pdfCoreService.renderPage(layout.pageNum, pdfCanvasRef.current, scale)

        // 重新初始化Fabric Canvas
        if (fabricServiceRef.current && fabricCanvasRef.current) {
          fabricServiceRef.current.dispose()
          const drawingConfig = stateAdapter.getDrawingConfig()
          const fabricService = new FabricCanvasServiceEnhanced(drawingConfig)

          await fabricService.initialize(
            fabricCanvasRef.current,
            pdfCanvasRef.current,
            layout.width,
            layout.height,
            layout.pageNum,
            {
              onAnnotationChanged: (annotations) => {
                stateAdapter.setAnnotations(layout.pageNum, annotations)
              },
              onScreenshotCaptured: (blob) => {
                onScreenshotCaptured?.(blob)
              },
            }
          )

          // 加载现有注释
          const annotations = stateAdapter.getAnnotations(layout.pageNum)
          if (annotations.length > 0) {
            fabricService.loadAnnotations(annotations)
          }

          fabricServiceRef.current = fabricService
        }
      } catch (err) {
        console.error(`第 ${layout.pageNum} 页重新渲染失败:`, err)
        setError(err instanceof Error ? err.message : '重新渲染失败')
      } finally {
        setIsLoading(false)
      }
    }

    renderPage()
  }, [stateAdapter.getState().scale])

  const pageStyle: React.CSSProperties = {
    position: 'relative',
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    margin: '0 auto 20px',
    backgroundColor: '#f5f5f5',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
  }

  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  }

  const pdfCanvasStyle: React.CSSProperties = {
    ...canvasStyle,
    pointerEvents: 'none',
    zIndex: 1,
  }

  const fabricCanvasStyle: React.CSSProperties = {
    ...canvasStyle,
    pointerEvents: 'auto',
    zIndex: 2,
  }

  return (
    <div style={pageStyle}>
      <canvas ref={pdfCanvasRef} style={pdfCanvasStyle} />
      <canvas ref={fabricCanvasRef} style={fabricCanvasStyle} />

      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '16px',
            borderRadius: '8px',
            zIndex: 10,
          }}
        >
          <div>加载中...</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            正在加载第 {layout.pageNum} 页...
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '16px',
            borderRadius: '8px',
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: '24px' }}>⚠️</div>
          <div style={{ fontSize: '14px', color: '#d32f2f', textAlign: 'center' }}>
            第 {layout.pageNum} 页加载失败
          </div>
          <button
            onClick={() => {
              setError(null)
              // 重新初始化
            }}
            style={{
              padding: '8px 16px',
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
      )}
    </div>
  )
}

