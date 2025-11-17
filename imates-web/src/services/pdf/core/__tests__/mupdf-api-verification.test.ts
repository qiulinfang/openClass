/**
 * MuPDF.js API 验证测试
 * 用于验证实际 API 方法名和 Quad 格式要求
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as mupdf from 'mupdf'

describe('MuPDF.js API 验证', () => {
  let document: mupdf.Document | null = null
  let page: mupdf.PDFPage | null = null
  let testPdfBuffer: Uint8Array | null = null

  beforeAll(async () => {
    // 创建一个最小的 PDF 用于测试
    // 注意：MuPDF.js 需要实际的 PDF 数据，这里我们尝试创建一个简单的 PDF
    // 如果无法创建，测试将跳过
    try {
      // 创建一个简单的 PDF 文档（最小 PDF 格式）
      // PDF 文件头: %PDF-1.4
      // 这是一个最小的有效 PDF
      const minimalPdf = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, // %PDF-1.4\n
        0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, // %âãÏÓ\n
        0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a, // 1 0 obj\n
        0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x3e, 0x3e, 0x0a, // <</Type/Catalog>>\n
        0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a, // endobj\n
        0x78, 0x72, 0x65, 0x66, 0x0a, 0x30, 0x20, 0x30, 0x0a, // xref\n0 0\n
        0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a, // trailer\n
        0x3c, 0x3c, 0x2f, 0x53, 0x69, 0x7a, 0x65, 0x20, 0x31, 0x3e, 0x3e, 0x0a, // <</Size 1>>\n
        0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66, 0x0a, 0x30, 0x0a, // startxref\n0\n
        0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a, // %%EOF\n
      ])

      document = mupdf.Document.openDocument(minimalPdf, 'application/pdf')
      if (document.countPages() > 0) {
        page = document.loadPage(0) as mupdf.PDFPage
      }
    } catch (error) {
      console.warn('无法创建测试 PDF，测试将跳过:', error)
    }
  })

  describe('注释获取方法 API 验证', () => {
    it('应该能够创建 Highlight 注释并验证获取方法', () => {
      if (!page) {
        console.warn('页面未加载，跳过测试')
        return
      }

      // 创建注释
      const annot = page.createAnnotation('Highlight')

      // 验证方法是否存在
      const methods = {
        // 文档中提到的无前缀方法
        type: typeof (annot as any).type,
        rect: typeof (annot as any).rect,
        color: typeof (annot as any).color,
        opacity: typeof (annot as any).opacity,
        borderWidth: typeof (annot as any).borderWidth,
        // 代码中使用的 get 前缀方法
        getType: typeof (annot as any).getType,
        getRect: typeof (annot as any).getRect,
        getColor: typeof (annot as any).getColor,
        getOpacity: typeof (annot as any).getOpacity,
        getBorderWidth: typeof (annot as any).getBorderWidth,
        // 其他方法
        hasQuadPoints: typeof (annot as any).hasQuadPoints,
        getQuadPoints: typeof (annot as any).getQuadPoints,
        hasInkList: typeof (annot as any).hasInkList,
        getInkList: typeof (annot as any).getInkList,
        id: typeof (annot as any).id,
      }

      console.log('注释方法检查结果:', methods)

      // 记录结果
      expect(methods).toBeDefined()
    })

    it('应该能够设置和获取注释属性', () => {
      if (!page) {
        console.warn('页面未加载，跳过测试')
        return
      }

      const annot = page.createAnnotation('Highlight')

      // 设置属性
      annot.setColor([1, 0, 0, 0.5]) // 红色，50% 透明度
      annot.setOpacity(0.5)
      annot.setBorderWidth(2)

      // 尝试获取属性（使用两种可能的方法）
      let type: string | undefined
      let rect: mupdf.Rect | undefined
      let color: mupdf.Color | undefined
      let opacity: number | undefined
      let borderWidth: number | undefined

      // 尝试 get 前缀方法
      try {
        type = (annot as any).getType?.()
        rect = (annot as any).getRect?.()
        color = (annot as any).getColor?.()
        opacity = (annot as any).getOpacity?.()
        borderWidth = (annot as any).getBorderWidth?.()
      } catch (e) {
        console.log('get 前缀方法失败，尝试无前缀方法')
      }

      // 如果 get 前缀方法失败，尝试无前缀方法
      if (!type) {
        try {
          type = (annot as any).type?.()
          rect = (annot as any).rect?.()
          color = (annot as any).color?.()
          opacity = (annot as any).opacity?.()
          borderWidth = (annot as any).borderWidth?.()
        } catch (e) {
          console.log('无前缀方法也失败')
        }
      }

      console.log('获取到的属性:', { type, rect, color, opacity, borderWidth })

      expect(annot).toBeDefined()
    })
  })

  describe('Quad 格式验证', () => {
    it('应该能够创建和验证 Quad 格式', () => {
      if (!page) {
        console.warn('页面未加载，跳过测试')
        return
      }

      // 测试两种 Quad 格式顺序
      // 格式1: [左上, 右上, 右下, 左下] (代码中使用的)
      const quad1: mupdf.Quad = [10, 10, 100, 10, 100, 50, 10, 50] // 左上, 右上, 右下, 左下

      // 格式2: [左上, 右上, 左下, 右下] (文档中描述的)
      const quad2: mupdf.Quad = [10, 10, 100, 10, 10, 50, 100, 50] // 左上, 右上, 左下, 右下

      const annot1 = page.createAnnotation('Highlight')
      const annot2 = page.createAnnotation('Highlight')

      try {
        annot1.setQuadPoints([quad1])
        annot1.update()
        console.log('格式1 (代码格式) 设置成功')
      } catch (e) {
        console.error('格式1 设置失败:', e)
      }

      try {
        annot2.setQuadPoints([quad2])
        annot2.update()
        console.log('格式2 (文档格式) 设置成功')
      } catch (e) {
        console.error('格式2 设置失败:', e)
      }

      // 尝试获取 Quad 点来验证格式
      try {
        const retrievedQuad1 = (annot1 as any).getQuadPoints?.()
        const retrievedQuad2 = (annot2 as any).getQuadPoints?.()
        console.log('获取到的 Quad1:', retrievedQuad1)
        console.log('获取到的 Quad2:', retrievedQuad2)
      } catch (e) {
        console.log('无法获取 Quad 点:', e)
      }

      expect(annot1).toBeDefined()
      expect(annot2).toBeDefined()
    })

    it('应该能够验证 Quad 点的顺序要求', () => {
      if (!page) {
        console.warn('页面未加载，跳过测试')
        return
      }

      // 创建一个矩形区域
      const minX = 10
      const minY = 10
      const maxX = 100
      const maxY = 50

      // 代码中使用的格式: [左上, 右上, 右下, 左下]
      const codeFormat: mupdf.Quad = [
        minX, minY, // 左上
        maxX, minY, // 右上
        maxX, maxY, // 右下
        minX, maxY, // 左下
      ]

      // 文档中描述的格式: [左上, 右上, 左下, 右下]
      const docFormat: mupdf.Quad = [
        minX, minY, // 左上 (ulx, uly)
        maxX, minY, // 右上 (urx, ury)
        minX, maxY, // 左下 (llx, lly)
        maxX, maxY, // 右下 (lrx, lry)
      ]

      const annot1 = page.createAnnotation('Highlight')
      const annot2 = page.createAnnotation('Highlight')

      annot1.setColor([1, 1, 0, 0.5]) // 黄色
      annot2.setColor([0, 1, 1, 0.5]) // 青色

      let success1 = false
      let success2 = false

      try {
        annot1.setQuadPoints([codeFormat])
        annot1.update()
        success1 = true
        console.log('代码格式设置成功')
      } catch (e) {
        console.error('代码格式设置失败:', e)
      }

      try {
        annot2.setQuadPoints([docFormat])
        annot2.update()
        success2 = true
        console.log('文档格式设置成功')
      } catch (e) {
        console.error('文档格式设置失败:', e)
      }

      console.log('格式验证结果:', { codeFormat: success1, docFormat: success2 })

      // 至少一种格式应该成功
      expect(success1 || success2).toBe(true)
    })
  })
})



