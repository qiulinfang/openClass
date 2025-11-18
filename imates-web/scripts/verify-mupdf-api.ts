/**
 * MuPDF.js API 验证脚本
 * 在浏览器环境中运行，验证实际的 API 方法名
 */

import * as mupdf from 'mupdf'

/**
 * 验证注释获取方法 API
 */
export function verifyAnnotationAPI() {
  console.log('=== MuPDF.js 注释 API 验证 ===\n')

  // 创建一个简单的测试 PDF
  // 这里我们需要一个有效的 PDF 文件
  // 为了测试，我们可以尝试创建一个最小的有效 PDF
  const results: Record<string, any> = {}

  try {
    // 创建一个最小的有效 PDF (单页空白)
    const minimalPdf = createMinimalPDF()
    const doc = mupdf.Document.openDocument(minimalPdf, 'application/pdf')

    if (doc.countPages() === 0) {
      console.warn('PDF 没有页面，无法继续测试')
      return results
    }

    const page = doc.loadPage(0) as mupdf.PDFPage

    // 创建注释
    const annot = page.createAnnotation('Highlight')

    // 设置一些属性
    annot.setColor([1, 0, 0, 0.5])
    annot.setOpacity(0.5)
    annot.setBorderWidth(2)

    // 检查方法是否存在
    const methodChecks: Record<string, boolean> = {
      // 文档中提到的无前缀方法
      'annot.type': typeof (annot as any).type === 'function',
      'annot.rect': typeof (annot as any).rect === 'function',
      'annot.color': typeof (annot as any).color === 'function',
      'annot.opacity': typeof (annot as any).opacity === 'function',
      'annot.borderWidth': typeof (annot as any).borderWidth === 'function',
      // 代码中使用的 get 前缀方法
      'annot.getType': typeof (annot as any).getType === 'function',
      'annot.getRect': typeof (annot as any).getRect === 'function',
      'annot.getColor': typeof (annot as any).getColor === 'function',
      'annot.getOpacity': typeof (annot as any).getOpacity === 'function',
      'annot.getBorderWidth': typeof (annot as any).getBorderWidth === 'function',
      // 其他方法
      'annot.hasQuadPoints': typeof (annot as any).hasQuadPoints === 'function',
      'annot.getQuadPoints': typeof (annot as any).getQuadPoints === 'function',
      'annot.hasInkList': typeof (annot as any).hasInkList === 'function',
      'annot.getInkList': typeof (annot as any).getInkList === 'function',
      'annot.id': typeof (annot as any).id === 'function',
    }

    console.log('方法存在性检查:')
    Object.entries(methodChecks).forEach(([method, exists]) => {
      console.log(`  ${method}: ${exists ? '✓' : '✗'}`)
    })

    // 尝试调用方法
    const methodResults: Record<string, any> = {}

    // 测试 get 前缀方法
    if (methodChecks['annot.getType']) {
      try {
        methodResults.type = (annot as any).getType()
        console.log(`✓ getType() 返回: ${methodResults.type}`)
      } catch (e) {
        console.log(`✗ getType() 失败: ${e}`)
      }
    }

    if (methodChecks['annot.getRect']) {
      try {
        methodResults.rect = (annot as any).getRect()
        console.log(`✓ getRect() 返回:`, methodResults.rect)
      } catch (e) {
        console.log(`✗ getRect() 失败: ${e}`)
      }
    }

    if (methodChecks['annot.getColor']) {
      try {
        methodResults.color = (annot as any).getColor()
        console.log(`✓ getColor() 返回:`, methodResults.color)
      } catch (e) {
        console.log(`✗ getColor() 失败: ${e}`)
      }
    }

    if (methodChecks['annot.getOpacity']) {
      try {
        methodResults.opacity = (annot as any).getOpacity()
        console.log(`✓ getOpacity() 返回: ${methodResults.opacity}`)
      } catch (e) {
        console.log(`✗ getOpacity() 失败: ${e}`)
      }
    }

    if (methodChecks['annot.getBorderWidth']) {
      try {
        methodResults.borderWidth = (annot as any).getBorderWidth()
        console.log(`✓ getBorderWidth() 返回: ${methodResults.borderWidth}`)
      } catch (e) {
        console.log(`✗ getBorderWidth() 失败: ${e}`)
      }
    }

    // 测试无前缀方法（如果 get 前缀方法不存在）
    if (!methodChecks['annot.getType'] && methodChecks['annot.type']) {
      try {
        methodResults.type = (annot as any).type()
        console.log(`✓ type() 返回: ${methodResults.type}`)
      } catch (e) {
        console.log(`✗ type() 失败: ${e}`)
      }
    }

    results.methodChecks = methodChecks
    results.methodResults = methodResults

    // 测试 Quad 格式
    console.log('\n=== Quad 格式验证 ===\n')

    const quadTests = verifyQuadFormat(page)
    results.quadTests = quadTests

    doc.destroy()
  } catch (error) {
    console.error('验证过程中出错:', error)
    results.error = String(error)
  }

  return results
}

/**
 * 验证 Quad 格式
 */
function verifyQuadFormat(page: mupdf.PDFPage) {
  const results: Record<string, any> = {}

  // 代码中使用的格式: [左上, 右上, 右下, 左下]
  const codeFormat: mupdf.Quad = [10, 10, 100, 10, 100, 50, 10, 50]

  // 文档中描述的格式: [左上, 右上, 左下, 右下]
  const docFormat: mupdf.Quad = [10, 10, 100, 10, 10, 50, 100, 50]

  console.log('测试代码格式 (左上, 右上, 右下, 左下):')
  const annot1 = page.createAnnotation('Highlight')
  annot1.setColor([1, 1, 0, 0.5]) // 黄色
  try {
    annot1.setQuadPoints([codeFormat])
    annot1.update()
    console.log('  ✓ 设置成功')
    results.codeFormatSuccess = true

    // 尝试获取 Quad 点
    try {
      const retrieved = (annot1 as any).getQuadPoints?.()
      console.log('  获取到的 Quad:', retrieved)
      results.codeFormatRetrieved = retrieved
    } catch (e) {
      console.log('  无法获取 Quad:', e)
    }
  } catch (e) {
    console.log('  ✗ 设置失败:', e)
    results.codeFormatSuccess = false
    results.codeFormatError = String(e)
  }

  console.log('\n测试文档格式 (左上, 右上, 左下, 右下):')
  const annot2 = page.createAnnotation('Highlight')
  annot2.setColor([0, 1, 1, 0.5]) // 青色
  try {
    annot2.setQuadPoints([docFormat])
    annot2.update()
    console.log('  ✓ 设置成功')
    results.docFormatSuccess = true

    // 尝试获取 Quad 点
    try {
      const retrieved = (annot2 as any).getQuadPoints?.()
      console.log('  获取到的 Quad:', retrieved)
      results.docFormatRetrieved = retrieved
    } catch (e) {
      console.log('  无法获取 Quad:', e)
    }
  } catch (e) {
    console.log('  ✗ 设置失败:', e)
    results.docFormatSuccess = false
    results.docFormatError = String(e)
  }

  return results
}

/**
 * 创建一个最小的有效 PDF
 */
function createMinimalPDF(): Uint8Array {
  // 这是一个最小的单页空白 PDF
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Resources <<
/Font <<
/F1 4 0 R
>>
>>
/Contents 5 0 R
>>
endobj
4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
5 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Hello) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000307 00000 n 
0000000380 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
472
%%EOF`

  return new TextEncoder().encode(pdfContent)
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  ;(window as any).verifyMuPDFAPI = verifyAnnotationAPI
  console.log('验证函数已挂载到 window.verifyMuPDFAPI')
  console.log('在浏览器控制台中运行: verifyMuPDFAPI()')
}



