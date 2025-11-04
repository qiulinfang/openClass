/**
 * React Hook for PDF Viewer
 */

import { useEffect, useRef, useState } from 'react'
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { PdfStateAdapterReactZustand, usePdfStore } from '@/services/pdf/adapters/react/PdfStateAdapterReactZustand'
import type { PdfState } from '@/services/pdf/types/pdf-types'

export function usePdfViewer(file: File | null) {
  const [state, setState] = useState<PdfState | null>(null)
  const pdfCoreServiceRef = useRef<PdfCoreService | null>(null)
  const stateAdapterRef = useRef<PdfStateAdapterReactZustand | null>(null)

  // 初始化服务
  useEffect(() => {
    pdfCoreServiceRef.current = new PdfCoreService()
    stateAdapterRef.current = new PdfStateAdapterReactZustand()

    // 订阅状态变化
    const unsubscribe = usePdfStore.subscribe((newState) => {
      setState(newState)
    })

    // 设置初始状态
    setState(stateAdapterRef.current.getState())

    return () => {
      unsubscribe()
      pdfCoreServiceRef.current?.dispose()
    }
  }, [])

  // 加载PDF
  useEffect(() => {
    const loadPdf = async () => {
      if (!file || !pdfCoreServiceRef.current || !stateAdapterRef.current) return

      try {
        stateAdapterRef.current.setLoading(true)
        stateAdapterRef.current.setError(null)

        // 加载PDF
        const result = await pdfCoreServiceRef.current.loadPdf(file)

        // 计算页面布局
        const scale = stateAdapterRef.current.getState().scale
        const layouts = await pdfCoreServiceRef.current.calculatePageLayouts(scale)

        // 更新状态
        stateAdapterRef.current.setPdfLoaded({
          ...result,
          pageLayouts: layouts,
        })
      } catch (error) {
        stateAdapterRef.current.setError(
          error instanceof Error ? error.message : 'PDF加载失败'
        )
      } finally {
        stateAdapterRef.current.setLoading(false)
      }
    }

    loadPdf()
  }, [file])

  const setSelectedTool = (tool: string) => {
    stateAdapterRef.current?.setSelectedTool(tool as any)
  }

  const setDrawingConfig = (config: Partial<any>) => {
    stateAdapterRef.current?.setDrawingConfig(config)
  }

  const setScale = (scale: number) => {
    if (stateAdapterRef.current) {
      stateAdapterRef.current.setScale(scale)
      // 重新计算布局
      const updateLayouts = async () => {
        if (pdfCoreServiceRef.current && stateAdapterRef.current) {
          try {
            stateAdapterRef.current.setLoading(true)
            const layouts = await pdfCoreServiceRef.current.calculatePageLayouts(scale)
            stateAdapterRef.current.setPageLayouts(layouts)
          } catch (error) {
            stateAdapterRef.current.setError(
              error instanceof Error ? error.message : '重新计算布局失败'
            )
          } finally {
            stateAdapterRef.current.setLoading(false)
          }
        }
      }
      updateLayouts()
    }
  }

  return {
    state,
    pdfCoreService: pdfCoreServiceRef.current,
    stateAdapter: stateAdapterRef.current,
    setSelectedTool,
    setDrawingConfig,
    setScale,
  }
}

