/**
 * 🚀 章节信息Store化 - 快速测试脚本
 *
 * 使用方法：在浏览器控制台中运行此脚本
 * 1. 复制此文件内容
 * 2. 在PDF查看器或知识图谱页面打开控制台
 * 3. 粘贴并执行
 * 4. 调用相应的测试函数
 */

// ==================== 全局测试对象 ====================
window.chapterInfoTest = {
  // 当前测试状态
  state: {
    testResults: [],
    startTime: null,
    endTime: null
  },

  // ==================== 基础检查函数 ====================

  /**
   * 检查store状态
   */
  checkStore: () => {
    try {
      const info = window.aiTextbookStore?.chapterInfo || null
      console.log('📊 Store状态:', info)
      return {
        hasStore: !!window.aiTextbookStore,
        chapterInfo: info,
        isValid: info && (info.grade || info.subject || info.textbook || info.chapter_title)
      }
    } catch (error) {
      console.error('❌ 检查store失败:', error)
      return { error: error.message }
    }
  },

  /**
   * 检查URL参数
   */
  checkUrlParams: () => {
    try {
      const url = new URL(window.location.href)
      const allParams = Array.from(url.searchParams.entries())
      const chapterParams = allParams.filter(([key]) =>
        key.toLowerCase().includes('chapter')
      )

      console.log('🔗 URL参数检查:')
      console.log('  所有参数:', Object.fromEntries(allParams))
      console.log('  章节参数:', chapterParams)

      return {
        totalParams: allParams.length,
        chapterParams: chapterParams,
        hasChapterParams: chapterParams.length > 0,
        cleanUrl: chapterParams.length === 0
      }
    } catch (error) {
      console.error('❌ 检查URL失败:', error)
      return { error: error.message }
    }
  },

  /**
   * 检查微课按钮状态
   */
  checkMiniClassButton: () => {
    try {
      // 查找微课按钮（根据实际DOM结构调整选择器）
      const buttons = document.querySelectorAll('button, [role="button"]')
      const miniClassBtn = Array.from(buttons).find(btn =>
        btn.textContent?.includes('微课') ||
        btn.className?.includes('mini-class') ||
        btn.getAttribute('data-testid') === 'mini-class-fab'
      )

      const isVisible = miniClassBtn && !miniClassBtn.hidden &&
                       window.getComputedStyle(miniClassBtn).display !== 'none'

      console.log('🎬 微课按钮状态:', {
        found: !!miniClassBtn,
        visible: isVisible,
        element: miniClassBtn
      })

      return {
        found: !!miniClassBtn,
        visible: isVisible,
        element: miniClassBtn
      }
    } catch (error) {
      console.error('❌ 检查微课按钮失败:', error)
      return { error: error.message }
    }
  },

  // ==================== 集成测试 ====================

  /**
   * 完整性检查 - 检查所有关键状态
   */
  checkIntegrity: () => {
    console.log('🔍 执行完整性检查...')
    const results = {
      timestamp: new Date().toISOString(),
      store: window.chapterInfoTest.checkStore(),
      url: window.chapterInfoTest.checkUrlParams(),
      miniClass: window.chapterInfoTest.checkMiniClassButton(),
      summary: {}
    }

    // 生成摘要
    results.summary = {
      overallHealth: 'unknown',
      issues: [],
      recommendations: []
    }

    // 检查是否有问题
    if (results.url.hasChapterParams) {
      results.summary.issues.push('URL中仍包含章节参数')
      results.summary.recommendations.push('确认URL参数已正确移除')
    }

    if (!results.store.hasStore) {
      results.summary.issues.push('aiTextbookStore未找到')
      results.summary.recommendations.push('检查store导入和初始化')
    } else if (!results.store.isValid && results.miniClass.found) {
      results.summary.issues.push('store无章节信息但微课按钮显示')
      results.summary.recommendations.push('检查章节信息设置逻辑')
    }

    // 确定整体健康状态
    if (results.summary.issues.length === 0) {
      results.summary.overallHealth = 'healthy'
    } else if (results.summary.issues.length === 1) {
      results.summary.overallHealth = 'warning'
    } else {
      results.summary.overallHealth = 'error'
    }

    console.log('📋 完整性检查结果:', results)
    return results
  },

  /**
   * 模拟学习流程测试
   */
  simulateLearningFlow: async () => {
    console.log('🎭 开始模拟学习流程测试...')

    // 步骤1: 检查初始状态
    console.log('步骤1: 检查初始状态')
    const initialState = window.chapterInfoTest.checkIntegrity()

    // 步骤2: 模拟设置章节信息（正常流程）
    console.log('步骤2: 模拟设置章节信息')
    if (window.aiTextbookStore) {
      const testChapterInfo = {
        grade: '初一',
        subject: '数学',
        textbook: '探究型公开课',
        chapter_title: '最短路径的基本原理'
      }
      window.aiTextbookStore.setChapterInfo(testChapterInfo)
      console.log('✅ 已设置测试章节信息:', testChapterInfo)
    }

    // 步骤3: 验证设置结果
    console.log('步骤3: 验证设置结果')
    await new Promise(resolve => setTimeout(resolve, 100)) // 等待状态更新
    const afterSetState = window.chapterInfoTest.checkIntegrity()

    // 步骤4: 模拟清空状态（返回场景）
    console.log('步骤4: 模拟状态清空')
    if (window.aiTextbookStore) {
      window.aiTextbookStore.setChapterInfo(null)
      console.log('✅ 已清空章节信息')
    }

    // 步骤5: 最终验证
    console.log('步骤5: 最终状态检查')
    await new Promise(resolve => setTimeout(resolve, 100))
    const finalState = window.chapterInfoTest.checkIntegrity()

    const results = {
      initial: initialState,
      afterSet: afterSetState,
      final: finalState,
      passed: afterSetState.summary.overallHealth === 'healthy'
    }

    console.log('🎭 学习流程测试完成:', results)
    return results
  },

  /**
   * 性能测试 - 检查操作耗时
   */
  performanceTest: async () => {
    console.log('⚡ 开始性能测试...')

    const results = {
      setChapterInfo: { times: [], avg: 0 },
      getChapterInfo: { times: [], avg: 0 },
      urlCheck: { times: [], avg: 0 }
    }

    // 测试setChapterInfo性能
    for (let i = 0; i < 10; i++) {
      const start = performance.now()
      if (window.aiTextbookStore) {
        window.aiTextbookStore.setChapterInfo({
          grade: `测试年级${i}`,
          subject: '测试科目',
          textbook: '测试教材',
          chapter_title: '测试章节'
        })
      }
      const end = performance.now()
      results.setChapterInfo.times.push(end - start)
    }

    // 测试getChapterInfo性能
    for (let i = 0; i < 10; i++) {
      const start = performance.now()
      const info = window.aiTextbookStore?.chapterInfo
      const end = performance.now()
      results.getChapterInfo.times.push(end - start)
    }

    // 测试URL检查性能
    for (let i = 0; i < 10; i++) {
      const start = performance.now()
      window.chapterInfoTest.checkUrlParams()
      const end = performance.now()
      results.urlCheck.times.push(end - start)
    }

    // 计算平均值
    results.setChapterInfo.avg = results.setChapterInfo.times.reduce((a, b) => a + b) / results.setChapterInfo.times.length
    results.getChapterInfo.avg = results.getChapterInfo.times.reduce((a, b) => a + b) / results.getChapterInfo.times.length
    results.urlCheck.avg = results.urlCheck.times.reduce((a, b) => a + b) / results.urlCheck.times.length

    console.log('⚡ 性能测试结果:', results)
    return results
  },

  // ==================== 批量测试套件 ====================

  /**
   * 运行完整测试套件
   */
  runFullTestSuite: async () => {
    console.log('🧪 开始执行完整测试套件...')
    console.time('fullTestSuite')

    const results = {
      integrity: null,
      learningFlow: null,
      performance: null,
      summary: {}
    }

    try {
      // 完整性检查
      console.log('1/3 执行完整性检查...')
      results.integrity = window.chapterInfoTest.checkIntegrity()

      // 学习流程测试
      console.log('2/3 执行学习流程测试...')
      results.learningFlow = await window.chapterInfoTest.simulateLearningFlow()

      // 性能测试
      console.log('3/3 执行性能测试...')
      results.performance = await window.chapterInfoTest.performanceTest()

      // 生成摘要
      results.summary = {
        timestamp: new Date().toISOString(),
        overallStatus: 'unknown',
        score: 0,
        issues: [],
        recommendations: []
      }

      // 计算分数
      let score = 0
      if (results.integrity?.summary.overallHealth === 'healthy') score += 40
      if (results.learningFlow?.passed) score += 40
      if (results.performance?.setChapterInfo.avg < 1) score += 20 // 性能良好

      results.summary.score = score

      // 确定整体状态
      if (score >= 80) results.summary.overallStatus = 'excellent'
      else if (score >= 60) results.summary.overallStatus = 'good'
      else if (score >= 40) results.summary.overallStatus = 'fair'
      else results.summary.overallStatus = 'poor'

      // 收集问题
      if (results.integrity?.summary.issues) {
        results.summary.issues.push(...results.integrity.summary.issues)
      }

      // 生成建议
      if (results.performance?.setChapterInfo.avg > 5) {
        results.summary.recommendations.push('setChapterInfo操作较慢，考虑优化')
      }
      if (!results.learningFlow?.passed) {
        results.summary.recommendations.push('学习流程测试失败，需要检查状态管理')
      }

    } catch (error) {
      console.error('❌ 测试套件执行失败:', error)
      results.summary.error = error.message
    }

    console.timeEnd('fullTestSuite')
    console.log('🧪 测试套件执行完成:', results)
    return results
  },

  // ==================== 工具函数 ====================

  /**
   * 导出测试结果
   */
  exportResults: (results) => {
    const dataStr = JSON.stringify(results, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = `chapter-info-test-results-${new Date().toISOString().slice(0, 19)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    console.log('📄 测试结果已导出')
  },

  /**
   * 显示使用帮助
   */
  help: () => {
    console.log(`
🎯 章节信息Store化测试工具

📖 使用方法:
  chapterInfoTest.checkStore()           - 检查store状态
  chapterInfoTest.checkUrlParams()       - 检查URL参数
  chapterInfoTest.checkMiniClassButton() - 检查微课按钮
  chapterInfoTest.checkIntegrity()       - 完整性检查
  chapterInfoTest.simulateLearningFlow() - 模拟学习流程
  chapterInfoTest.performanceTest()      - 性能测试
  chapterInfoTest.runFullTestSuite()     - 运行完整测试套件
  chapterInfoTest.exportResults(data)    - 导出测试结果
  chapterInfoTest.help()                 - 显示此帮助

💡 快速测试:
  chapterInfoTest.runFullTestSuite().then(results => {
    chapterInfoTest.exportResults(results)
  })

🔍 预期结果:
  - URL不应包含chapterGrade等参数
  - store.chapterInfo应在合适时机设置
  - 微课按钮应根据章节信息正确显示
    `)
  }
}

// ==================== 初始化 ====================
console.log('🚀 章节信息测试工具已加载!')
console.log('💡 输入 chapterInfoTest.help() 查看使用说明')
window.chapterInfoTest.help()

// 自动执行基础检查
setTimeout(() => {
  console.log('🔍 自动执行基础完整性检查...')
  window.chapterInfoTest.checkIntegrity()
}, 1000)

<<<<<<< HEAD
=======



>>>>>>> feekback
