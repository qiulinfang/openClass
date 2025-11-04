/**
 * PDF核心服务类单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PdfCoreService } from '../core/PdfCoreService'

describe('PdfCoreService', () => {
  let service: PdfCoreService

  beforeEach(() => {
    service = new PdfCoreService()
  })

  afterEach(() => {
    service.dispose()
  })

  describe('初始化', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeInstanceOf(PdfCoreService)
    })

    it('初始状态应该为null', () => {
      expect(service.getPdfDoc()).toBeNull()
      expect(service.getOriginalPdfBytes()).toBeNull()
      expect(service.getScale()).toBe(1.0)
    })
  })

  describe('缩放管理', () => {
    it('应该设置缩放比例', () => {
      service.setScale(1.5)
      expect(service.getScale()).toBe(1.5)
    })

    it('应该限制缩放范围', () => {
      service.setScale(0.3) // 小于最小值
      expect(service.getScale()).toBeGreaterThanOrEqual(0.5)

      service.setScale(5.0) // 大于最大值
      expect(service.getScale()).toBeLessThanOrEqual(3.0)
    })
  })

  describe('资源清理', () => {
    it('应该清理所有资源', () => {
      service.dispose()
      expect(service.getPdfDoc()).toBeNull()
      expect(service.getOriginalPdfBytes()).toBeNull()
    })
  })
})

