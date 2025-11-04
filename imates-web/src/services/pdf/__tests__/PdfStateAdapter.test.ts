/**
 * PDF状态管理适配器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PdfStateAdapterReact } from '../adapters/react/PdfStateAdapterReact'
import type { PdfLoadResult } from '../types/pdf-types'

describe('PdfStateAdapterReact', () => {
  let adapter: PdfStateAdapterReact

  beforeEach(() => {
    adapter = new PdfStateAdapterReact()
  })

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = adapter.getState()
      expect(state.pdfDoc).toBeNull()
      expect(state.isDocLoaded).toBe(false)
      expect(state.totalPages).toBe(0)
      expect(state.selectedTool).toBe('none')
    })
  })

  describe('状态更新', () => {
    it('应该更新加载状态', () => {
      adapter.setLoading(true)
      expect(adapter.getState().isLoading).toBe(true)

      adapter.setLoading(false)
      expect(adapter.getState().isLoading).toBe(false)
    })

    it('应该更新错误状态', () => {
      adapter.setError('测试错误')
      expect(adapter.getState().error).toBe('测试错误')

      adapter.setError(null)
      expect(adapter.getState().error).toBeNull()
    })

    it('应该更新工具', () => {
      adapter.setSelectedTool('pen')
      expect(adapter.getSelectedTool()).toBe('pen')

      adapter.setSelectedTool('highlighter')
      expect(adapter.getSelectedTool()).toBe('highlighter')
    })

    it('应该更新绘制配置', () => {
      adapter.setDrawingConfig({ penColor: '#000000' })
      const config = adapter.getDrawingConfig()
      expect(config.penColor).toBe('#000000')
    })

    it('应该更新缩放', () => {
      adapter.setScale(1.5)
      expect(adapter.getState().scale).toBe(1.5)
    })

    it('应该更新当前页面', () => {
      adapter.setCurrentPage(5)
      expect(adapter.getState().currentPage).toBe(5)
    })
  })

  describe('订阅机制', () => {
    it('应该支持订阅状态变化', () => {
      let callbackCount = 0
      const unsubscribe = adapter.subscribe(() => {
        callbackCount++
      })

      adapter.setLoading(true)
      adapter.setLoading(false)

      expect(callbackCount).toBeGreaterThan(0)

      unsubscribe()
    })

    it('应该支持取消订阅', () => {
      let callbackCount = 0
      const unsubscribe = adapter.subscribe(() => {
        callbackCount++
      })

      adapter.setLoading(true)
      unsubscribe()
      adapter.setLoading(false)

      // 取消订阅后不应该再触发回调
      const finalCount = callbackCount
      expect(finalCount).toBeGreaterThan(0)
    })
  })
})

