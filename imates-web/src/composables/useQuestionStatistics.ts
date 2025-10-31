import { ref, type Ref, type ComputedRef } from 'vue'
import type { ExerciseItem } from '@/types/exercise'

// ========== 类型定义 ==========

// 高度统计信息（用于智能估算）
export interface HeightStats {
  min: number
  max: number
  avg: number
  median: number
  samples: number[]
}

// 题目 title 和高度关系统计
export interface TitleHeightStat {
  questionId: string
  title: string
  titleLength: number
  imageCount: number  // 图片数量
  formulaCount: number  // 公式数量
  height: number
  timestamp: number
}

// 估算高度 vs 真实高度对比统计
export interface HeightComparison {
  questionId: string
  index: number
  estimatedHeight: number
  actualHeight: number
  error: number  // 误差（实际 - 估算）
  errorPercentage: number  // 误差百分比
  title: string
  titleLength: number
  imageCount: number
  formulaCount: number  // 公式总数（保持兼容）
  inlineFormulaCount: number  // 行内公式数量
  blockFormulaCount: number  // 块级公式数量
  lineCount: number  // 换行数（实际行数）
  hasTable: boolean  // 是否有表格
  hasComplexFormatting: boolean  // 是否有复杂格式
  timestamp: number
}

// ========== Composable 接口参数 ==========

export interface UseQuestionStatisticsOptions {
  // 题目列表
  displayList: ComputedRef<ExerciseItem[]>
  // 题目高度映射
  questionHeights: Ref<Map<string, number>>
  // 索引到高度映射
  indexToHeight: Ref<Map<number, number>>
  // 题目卡片DOM引用
  questionCardRefs: Ref<Map<string, HTMLElement>>
  // 已渲染索引集合
  renderedIndexes: Ref<Set<number>>
  // 滚动容器引用
  scrollContainer: Ref<HTMLElement | null>
  // 设置题目卡片引用的函数
  setQuestionCardRef: (el: HTMLElement | null, questionId: string, index: number) => void
}

// ========== Composable 实现 ==========

export function useQuestionStatistics(options: UseQuestionStatisticsOptions) {
  const {
    displayList,
    questionHeights,
    indexToHeight,
    questionCardRefs,
    renderedIndexes,
    scrollContainer,
    setQuestionCardRef
  } = options

  // ========== 响应式状态 ==========

  const heightStats = ref<HeightStats>({
    min: Infinity,
    max: 0,
    avg: 0,
    median: 0,
    samples: []
  })

  const titleHeightStats = ref<TitleHeightStat[]>([])

  const heightComparisons = ref<HeightComparison[]>([])

  // ========== 工具函数 ==========

  // 第1步：检测标题中的图片数量（支持 markdown 和 HTML 格式）
  const countImagesInTitle = (title: string): number => {
    if (!title) return 0
    
    let count = 0
    
    // 第2步：检测 Markdown 格式的图片: ![](url) 或 ![alt](url)
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const markdownMatches = title.match(markdownImageRegex)
    if (markdownMatches) {
      count += markdownMatches.length
    }
    
    // 第3步：检测 HTML 格式的图片: <img src="..." /> 或 <img src='...' />
    const htmlImageRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi
    const htmlMatches = title.match(htmlImageRegex)
    if (htmlMatches) {
      count += htmlMatches.length
    }
    
    // 第4步：检测图片 URL 模式（.jpg, .jpeg, .png, .gif 等，可能是直接链接）
    if (count === 0) {
      const imageUrlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp)(\?[^\s]*)?/gi
      const urlMatches = title.match(imageUrlRegex)
      if (urlMatches) {
        count += urlMatches.length
      }
    }
    
    return count
  }

  // 第1步：计算公式数量（返回总数，以及行内和块级公式的数量分别）
  const countFormulasInTitle = (title: string): { total: number; inline: number; block: number } => {
    if (!title) return { total: 0, inline: 0, block: 0 }
    
    let inlineCount = 0
    let blockCount = 0
    const matchedPositions: Set<string> = new Set() // 记录已匹配的位置，避免重复计算
    
    // 第2步：检测 Markdown 格式的块级公式: $$...$$（优先匹配，避免与行内公式冲突）
    const blockFormulaRegex = /\$\$[^$]*\$\$/g
    let match: RegExpExecArray | null
    while ((match = blockFormulaRegex.exec(title)) !== null) {
      const key = `${match.index}-${match.index + match[0].length}`
      if (!matchedPositions.has(key)) {
        blockCount++
        matchedPositions.add(key)
        // 第3步：标记这一整段已被匹配，避免后续行内公式重复匹配
        for (let i = match.index; i < match.index + match[0].length; i++) {
          matchedPositions.add(`${i}`)
        }
      }
    }
    
    // 第4步：检测 Markdown 格式的行内公式: $...$（排除已在块级公式中的）
    const inlineFormulaRegex = /\$[^$\n]+\$/g
    while ((match = inlineFormulaRegex.exec(title)) !== null) {
      // 第5步：检查这个匹配是否与之前的块级公式重叠
      let overlaps = false
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (matchedPositions.has(`${i}`)) {
          overlaps = true
          break
        }
      }
      if (!overlaps) {
        inlineCount++
        // 第6步：记录已匹配的位置
        for (let i = match.index; i < match.index + match[0].length; i++) {
          matchedPositions.add(`${i}`)
        }
      }
    }
    
    // 第7步：重置匹配位置记录，用于 LaTeX 格式
    matchedPositions.clear()
    
    // 第8步：检测 LaTeX 格式的块级公式: \[...\]
    const latexBlockRegex = /\\\[[^\]]*\\\]/g
    while ((match = latexBlockRegex.exec(title)) !== null) {
      blockCount++
    }
    
    // 第9步：检测 LaTeX 格式的行内公式: \(...\)
    const latexInlineRegex = /\\\([^)]*\\\)/g
    while ((match = latexInlineRegex.exec(title)) !== null) {
      inlineCount++
    }
    
    // 第10步：检测 MathLive 格式: \begin{math}...\end{math}（视为块级公式）
    const mathLiveRegex = /\\begin\{math\}[^]*?\\end\{math\}/g
    while ((match = mathLiveRegex.exec(title)) !== null) {
      blockCount++
    }
    
    return { total: inlineCount + blockCount, inline: inlineCount, block: blockCount }
  }

  // ========== 统计方法 ==========

  // 第1步：更新高度统计
  const updateHeightStats = (newHeight: number) => {
    const stats = heightStats.value
    stats.samples.push(newHeight)

    // 第2步：保持样本数量在合理范围（如最近100个）
    if (stats.samples.length > 100) {
      stats.samples.shift()
    }

    // 第3步：重新计算统计值
    stats.min = Math.min(stats.min, newHeight)
    stats.max = Math.max(stats.max, newHeight)

    const sorted = [...stats.samples].sort((a, b) => a - b)
    stats.avg = Math.round(
      stats.samples.reduce((a, b) => a + b, 0) / stats.samples.length
    )
    stats.median = sorted[Math.floor(sorted.length / 2)]
  }

  // 第1步：记录题目的 title 和高度关系
  const recordTitleHeightRelation = (questionId: string, height: number) => {
    try {
      // 第2步：查找题目数据
      const question = displayList.value.find(q => q.id === questionId)
      if (!question) {
        console.warn(`[STATS] ⚠️ 未找到题目 ID: ${questionId}, displayList长度: ${displayList.value.length}`)
        return
      }

      // 第3步：获取 title（优先使用 question.title，其次使用 question.question）
      const title = question.title || question.question || ''
      const titleLength = title.length
      const imageCount = countImagesInTitle(title)
      const formulaInfo = countFormulasInTitle(title)
      const formulaCount = formulaInfo.total

      if (!title) {
        console.warn(`[STATS] ⚠️ 题目 ${questionId} 的 title 为空`)
      }

      // 第4步：检查是否已存在该题目的记录（避免重复）
      const existingIndex = titleHeightStats.value.findIndex(stat => stat.questionId === questionId)
      
      const stat: TitleHeightStat = {
        questionId,
        title,
        titleLength,
        imageCount,
        formulaCount,
        height,
        timestamp: Date.now()
      }

      if (existingIndex >= 0) {
        // 第5步：更新现有记录
        titleHeightStats.value[existingIndex] = stat
        console.log(`[STATS] 🔄 更新统计: ${questionId}, 高度: ${height}px, Title长度: ${titleLength}, 图片数: ${imageCount}, 公式数: ${formulaCount}`)
      } else {
        // 第6步：添加新记录
        titleHeightStats.value.push(stat)
        console.log(`[STATS] ➕ 添加统计: ${questionId}, 高度: ${height}px, Title长度: ${titleLength}, 图片数: ${imageCount}, 公式数: ${formulaCount}, 总数: ${titleHeightStats.value.length}`)
      }
    } catch (error) {
      console.error(`[STATS] ❌ 记录统计失败 (questionId: ${questionId}, height: ${height}):`, error)
    }
  }

  // 第1步：对比估算高度和真实高度
  const compareEstimatedAndActualHeight = (
    questionId: string,
    index: number,
    actualHeight: number
  ) => {
    try {
      // 第2步：查找题目数据
      const question = displayList.value.find(q => q.id === questionId)
      if (!question) {
        return
      }

      // 第3步：获取 title
      const title = question.title || question.question || ''
      if (!title) {
        return
      }

      // 第4步：计算估算高度
      const estimatedHeight = estimateHeightByStats(title)
      if (estimatedHeight <= 0) {
        return
      }

      // 第5步：计算误差
      const error = actualHeight - estimatedHeight
      const errorPercentage = actualHeight > 0 
        ? Math.round((error / actualHeight) * 100 * 100) / 100
        : 0

      const titleLength = title.length
      const imageCount = countImagesInTitle(title)
      const formulaInfo = countFormulasInTitle(title)
      const inlineFormulaCount = formulaInfo.inline
      const blockFormulaCount = formulaInfo.block
      
      // 第6步：检测其他影响因素
      const lineCount = (title.match(/\n/g) || []).length + 1
      const hasTable = title.includes('|') && title.split('|').length > 4
      const hasMultipleLines = lineCount > 2
      const hasComplexFormatting = hasTable || hasMultipleLines

      // 第7步：查找是否已存在对比记录
      const existingIndex = heightComparisons.value.findIndex(
        comp => comp.questionId === questionId
      )

      const comparison: HeightComparison = {
        questionId,
        index,
        estimatedHeight,
        actualHeight,
        error,
        errorPercentage,
        title,
        titleLength,
        imageCount,
        formulaCount: formulaInfo.total,
        inlineFormulaCount,
        blockFormulaCount,
        lineCount,
        hasTable,
        hasComplexFormatting,
        timestamp: Date.now()
      }

      if (existingIndex >= 0) {
        // 第8步：更新现有记录
        heightComparisons.value[existingIndex] = comparison
      } else {
        // 第9步：添加新记录
        heightComparisons.value.push(comparison)
      }

      // 第10步：输出对比信息
      const errorSign = error >= 0 ? '+' : ''
      const errorColor = Math.abs(errorPercentage) <= 10 ? '✅' : Math.abs(errorPercentage) <= 20 ? '⚠️' : '❌'
      console.log(
        `[高度对比] ${errorColor} 题目${index + 1} (ID: ${questionId})\n` +
        `  估算: ${estimatedHeight}px | 实际: ${actualHeight}px | 误差: ${errorSign}${error}px (${errorSign}${errorPercentage}%)\n` +
        `  标题长度: ${titleLength} | 图片数: ${imageCount} | 总数: ${heightComparisons.value.length}`
      )

      // 第11步：每收集10个样本输出一次统计
      if (heightComparisons.value.length % 10 === 0) {
        outputComparisonStatistics()
      }
    } catch (error) {
      console.error(`[高度对比] ❌ 对比失败 (questionId: ${questionId}):`, error)
    }
  }

  // 第1步：输出对比统计信息
  const outputComparisonStatistics = () => {
    if (heightComparisons.value.length === 0) {
      console.log('📊 [高度对比统计] 暂无对比数据')
      return
    }

    const comparisons = heightComparisons.value
    const errors = comparisons.map(c => Math.abs(c.error))
    const errorPercentages = comparisons.map(c => Math.abs(c.errorPercentage))

    // 第2步：计算统计值
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length
    const avgErrorPercentage = errorPercentages.reduce((a, b) => a + b, 0) / errorPercentages.length
    const maxError = Math.max(...errors)
    const maxErrorPercentage = Math.max(...errorPercentages)

    // 第3步：计算准确率（误差在10%以内认为是准确的）
    const accurateCount = comparisons.filter(c => Math.abs(c.errorPercentage) <= 10).length
    const accuracy = Math.round((accurateCount / comparisons.length) * 100 * 100) / 100

    // 第4步：按误差分组统计
    const excellent = comparisons.filter(c => Math.abs(c.errorPercentage) <= 5).length
    const good = comparisons.filter(c => Math.abs(c.errorPercentage) > 5 && Math.abs(c.errorPercentage) <= 10).length
    const fair = comparisons.filter(c => Math.abs(c.errorPercentage) > 10 && Math.abs(c.errorPercentage) <= 20).length
    const poor = comparisons.filter(c => Math.abs(c.errorPercentage) > 20).length

    // 第5步：输出汇总统计
    console.log(
      `\n${'='.repeat(60)}\n` +
      `📊 [高度对比统计 - 汇总] 样本数: ${comparisons.length}\n` +
      `${'='.repeat(60)}\n` +
      `  平均误差: ${Math.round(avgError)}px (${Math.round(avgErrorPercentage * 100) / 100}%)\n` +
      `  最大误差: ${Math.round(maxError)}px (${Math.round(maxErrorPercentage * 100) / 100}%)\n` +
      `  准确率 (误差≤10%): ${accuracy}% (${accurateCount}/${comparisons.length})\n` +
      `  误差分布:\n` +
      `    ✅ 优秀 (≤5%): ${excellent} 个\n` +
      `    ⚠️ 良好 (5-10%): ${good} 个\n` +
      `    ⚠️ 一般 (10-20%): ${fair} 个\n` +
      `    ❌ 较差 (>20%): ${poor} 个`
    )

    // 第6步：按图片数量分组统计
    const withImage = comparisons.filter(c => c.imageCount > 0)
    const withoutImage = comparisons.filter(c => c.imageCount === 0)
    
    if (withImage.length > 0) {
      const withImageErrors = withImage.map(c => Math.abs(c.errorPercentage))
      const avgWithImageError = withImageErrors.reduce((a, b) => a + b, 0) / withImageErrors.length
      console.log(`  有图片题目: ${withImage.length} 个, 平均误差: ${Math.round(avgWithImageError * 100) / 100}%`)
    }
    
    if (withoutImage.length > 0) {
      const withoutImageErrors = withoutImage.map(c => Math.abs(c.errorPercentage))
      const avgWithoutImageError = withoutImageErrors.reduce((a, b) => a + b, 0) / withoutImageErrors.length
      console.log(`  无图片题目: ${withoutImage.length} 个, 平均误差: ${Math.round(avgWithoutImageError * 100) / 100}%`)
    }

    // 第7步：输出详细数据列表
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📋 [高度对比统计 - 详细数据] 共 ${comparisons.length} 个题目`)
    console.log(`${'='.repeat(60)}`)

    // 第8步：按误差百分比降序排序（误差最大的在前）
    const sortedComparisons = [...comparisons].sort((a, b) => 
      Math.abs(b.errorPercentage) - Math.abs(a.errorPercentage)
    )

    sortedComparisons.forEach((comp, idx) => {
      const errorSign = comp.error >= 0 ? '+' : ''
      const absErrorPercentage = Math.abs(comp.errorPercentage)
      let statusIcon = '❌'
      let statusText = '较差'
      
      if (absErrorPercentage <= 5) {
        statusIcon = '✅'
        statusText = '优秀'
      } else if (absErrorPercentage <= 10) {
        statusIcon = '⚠️'
        statusText = '良好'
      } else if (absErrorPercentage <= 20) {
        statusIcon = '⚠️'
        statusText = '一般'
      }

      // 第9步：截取标题预览（去除HTML标签，保留前60个字符）
      const titlePreview = comp.title
        .replace(/<[^>]*>/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
        .substring(0, 60)
        + (comp.title.replace(/<[^>]*>/g, '').length > 60 ? '...' : '')

      // 第10步：格式化影响因素信息
      const factorsInfo = [
        `标题长度: ${comp.titleLength} 字符`,
        `图片数量: ${comp.imageCount} 个`,
        `公式总数: ${comp.formulaCount} 个 (行内: ${comp.inlineFormulaCount}, 块级: ${comp.blockFormulaCount})`,
        `换行数: ${comp.lineCount} 行`,
        `表格: ${comp.hasTable ? '有' : '无'}`,
        `复杂格式: ${comp.hasComplexFormatting ? '是' : '否'}`
      ].join(' | ')

      console.log(
        `\n${idx + 1}. ${statusIcon} [${statusText}] 题目 #${comp.index + 1}\n` +
        `   ID: ${comp.questionId}\n` +
        `   估算高度: ${comp.estimatedHeight}px\n` +
        `   实际高度: ${comp.actualHeight}px\n` +
        `   误差: ${errorSign}${comp.error}px (${errorSign}${comp.errorPercentage.toFixed(2)}%)\n` +
        `   影响因素: ${factorsInfo}\n` +
        `   标题预览: ${titlePreview}`
      )
    })

    // 第11步：输出数据表格格式（便于复制）
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 [数据表格格式] (便于复制分析)`)
    console.log(`${'='.repeat(60)}`)
    console.log(`索引\t估算高度\t实际高度\t误差(px)\t误差(%)\t标题长度\t图片数\t公式总数\t行内公式\t块级公式\t换行数\t表格\t复杂格式\t状态`)
    console.log(`-`.repeat(120))
    
    sortedComparisons.forEach((comp) => {
      const absErrorPercentage = Math.abs(comp.errorPercentage)
      let status = '较差'
      if (absErrorPercentage <= 5) status = '优秀'
      else if (absErrorPercentage <= 10) status = '良好'
      else if (absErrorPercentage <= 20) status = '一般'
      
      console.log(
        `${comp.index + 1}\t` +
        `${comp.estimatedHeight}\t` +
        `${comp.actualHeight}\t` +
        `${comp.error >= 0 ? '+' : ''}${comp.error.toFixed(1)}\t` +
        `${comp.error >= 0 ? '+' : ''}${comp.errorPercentage.toFixed(2)}%\t` +
        `${comp.titleLength}\t` +
        `${comp.imageCount}\t` +
        `${comp.formulaCount}\t` +
        `${comp.inlineFormulaCount}\t` +
        `${comp.blockFormulaCount}\t` +
        `${comp.lineCount}\t` +
        `${comp.hasTable ? '是' : '否'}\t` +
        `${comp.hasComplexFormatting ? '是' : '否'}\t` +
        `${status}`
      )
    })

    // 第12步：输出 JSON 格式（便于程序处理）
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📦 [JSON 格式] (便于程序处理)`)
    console.log(`${'='.repeat(60)}`)
    console.log(JSON.stringify(sortedComparisons, null, 2))
    
    console.log(`\n${'='.repeat(60)}\n`)
  }

  // 第1步：主动查找并绑定已渲染题目的DOM引用
  const activelyBindQuestionRefs = () => {
    console.log('[STATS] 🔗 开始主动查找并绑定DOM引用...')
    let bound = 0
    let notFound = 0
    
    // 第2步：遍历所有已渲染的题目索引
    renderedIndexes.value.forEach((index) => {
      const question = displayList.value[index]
      if (!question) {
        notFound++
        return
      }
      
      // 第3步：如果已经有引用，跳过
      if (questionCardRefs.value.has(question.id)) {
        return
      }
      
      // 第4步：通过 data-question-id 属性查找DOM元素
      const selector = `[data-question-id="${question.id}"]`
      let el: HTMLElement | null = null
      
      if (scrollContainer.value) {
        el = scrollContainer.value.querySelector(selector) as HTMLElement
      } else {
        el = document.querySelector(selector) as HTMLElement
      }
      
      if (el && el instanceof HTMLElement) {
        // 第5步：找到DOM元素，设置引用（会触发ResizeObserver和高度测量）
        setQuestionCardRef(el, question.id, index)
        bound++
        console.log(`[STATS] ✅ 已绑定引用: 题目${index + 1} (ID: ${question.id})`)
      } else {
        notFound++
        console.log(`[STATS] ⚠️ 未找到DOM元素: 题目${index + 1} (ID: ${question.id}), selector: ${selector}`)
      }
    })
    
    console.log(`[STATS] ✅ 主动绑定完成: 成功 ${bound} 个, 未找到DOM ${notFound} 个`)
    console.log(`[STATS] 📊 绑定后卡片引用数量: ${questionCardRefs.value.size}`)
    
    return bound
  }

  // 第1步：执行实际测量
  const performMeasurement = (recordQuestionHeight: (questionId: string, index: number, height: number) => void) => {
    let measured = 0
    let notFound = 0
    let zeroHeight = 0
    
    questionCardRefs.value.forEach((el, questionId) => {
      if (!el) {
        notFound++
        return
      }
      
      const height = el.getBoundingClientRect().height
      if (height > 0) {
        const question = displayList.value.find(q => q.id === questionId)
        if (question) {
          const index = displayList.value.findIndex(q => q.id === questionId)
          recordQuestionHeight(questionId, index, height)
          measured++
        } else {
          console.warn(`[STATS] ⚠️ 未找到题目数据: ${questionId}`)
        }
      } else {
        zeroHeight++
      }
    })
    
    console.log(`[STATS] ✅ 手动测量完成: 成功 ${measured} 个, 零高度 ${zeroHeight} 个, 未找到DOM ${notFound} 个`)
    console.log(`[STATS] 📊 已渲染卡片引用数量: ${questionCardRefs.value.size}`)
    console.log(`[STATS] 📊 已渲染索引数量: ${renderedIndexes.value.size}`)
    
    return measured
  }

  // 第1步：手动触发所有已渲染题目的高度测量
  const manuallyMeasureAllQuestions = (recordQuestionHeight: (questionId: string, index: number, height: number) => void) => {
    console.log('[STATS] 🔧 开始手动测量所有已渲染的题目...')
    
    // 第2步：先尝试主动绑定引用
    const bound = activelyBindQuestionRefs()
    if (bound > 0) {
      console.log(`[STATS] ⏳ 等待 ${bound} 个引用绑定完成，延迟测量...`)
      // 第3步：等待一段时间，让ResizeObserver有时间触发
      setTimeout(() => {
        performMeasurement(recordQuestionHeight)
      }, 500)
      return bound
    }
    
    return performMeasurement(recordQuestionHeight)
  }

  // 第1步：分析并输出 title 和高度关系的统计信息
  const analyzeTitleHeightRelation = (
    recordQuestionHeight: (questionId: string, index: number, height: number) => void,
    questions: ComputedRef<ExerciseItem[]>
  ) => {
    console.log(`[STATS] 🔍 开始分析统计数据...`)
    console.log(`[STATS] 📋 displayList长度: ${displayList.value.length}`)
    console.log(`[STATS] 📋 questions长度: ${questions.value.length}`)
    console.log(`[STATS] 📋 已收集统计样本数: ${titleHeightStats.value.length}`)
    console.log(`[STATS] 📋 已测量高度数量: ${questionHeights.value.size}`)
    console.log(`[STATS] 📋 已渲染卡片引用数量: ${questionCardRefs.value.size}`)
    console.log(`[STATS] 📋 已渲染索引数量: ${renderedIndexes.value.size}`)
    
    if (titleHeightStats.value.length === 0) {
      console.log('[STATS] 📊 暂无统计数据')
      console.log('[STATS] 💡 提示: 统计数据会在题目渲染完成后自动收集，请确保:')
      console.log('  1. 题目已经加载完成')
      console.log('  2. 题目卡片已经渲染到DOM中')
      console.log('  3. ResizeObserver 已经测量到高度')
      
      // 第2步：如果已测量的高度为空，但已渲染索引不为空，尝试主动绑定和测量
      if (questionHeights.value.size === 0 && renderedIndexes.value.size > 0) {
        console.log('[STATS] 🔧 尝试主动绑定DOM引用并测量...')
        // 第3步：先主动绑定引用
        const bound = activelyBindQuestionRefs()
        if (bound > 0) {
          // 第4步：等待一段时间后测量
          setTimeout(() => {
            const measured = performMeasurement(recordQuestionHeight)
            if (measured > 0) {
              console.log(`[STATS] ✅ 测量了 ${measured} 个题目，重新分析...`)
              analyzeTitleHeightRelation(recordQuestionHeight, questions)
            }
          }, 500)
          return
        } else if (questionCardRefs.value.size > 0) {
          // 第5步：如果已经有引用但还没测量，直接测量
          console.log('[STATS] 🔧 尝试手动测量已渲染的题目...')
          const measured = manuallyMeasureAllQuestions(recordQuestionHeight)
          if (measured > 0) {
            console.log(`[STATS] ✅ 手动测量了 ${measured} 个题目，重新分析...`)
            return analyzeTitleHeightRelation(recordQuestionHeight, questions)
          }
        }
      }
      
      // 第6步：尝试手动触发一次数据收集（从已测量的高度中收集）
      if (questionHeights.value.size > 0) {
        console.log('[STATS] 🔧 尝试从已测量的高度中收集数据...')
        let collected = 0
        questionHeights.value.forEach((height, questionId) => {
          const question = displayList.value.find(q => q.id === questionId)
          if (question) {
            recordTitleHeightRelation(questionId, height)
            collected++
          }
        })
        console.log(`[STATS] ✅ 手动收集了 ${collected} 条统计数据`)
        
        // 第7步：如果现在有数据了，重新调用分析
        if (titleHeightStats.value.length > 0) {
          console.log('[STATS] 🔄 重新分析统计数据...')
          return analyzeTitleHeightRelation(recordQuestionHeight, questions)
        }
      }
      
      return
    }

    const stats = titleHeightStats.value
    const titleLengths = stats.map(s => s.titleLength)
    const imageCounts = stats.map(s => s.imageCount)
    const formulaCounts = stats.map(s => s.formulaCount)
    const heights = stats.map(s => s.height)

    // 第8步：基础统计
    const avgTitleLength = Math.round(titleLengths.reduce((a, b) => a + b, 0) / titleLengths.length)
    const avgImageCount = Math.round((imageCounts.reduce((a, b) => a + b, 0) / imageCounts.length) * 100) / 100
    const avgFormulaCount = Math.round((formulaCounts.reduce((a, b) => a + b, 0) / formulaCounts.length) * 100) / 100
    const avgHeight = Math.round(heights.reduce((a, b) => a + b, 0) / heights.length)
    const minHeight = Math.min(...heights)
    const maxHeight = Math.max(...heights)
    const minTitleLength = Math.min(...titleLengths)
    const maxTitleLength = Math.max(...titleLengths)
    const minImageCount = Math.min(...imageCounts)
    const maxImageCount = Math.max(...imageCounts)
    const minFormulaCount = Math.min(...formulaCounts)
    const maxFormulaCount = Math.max(...formulaCounts)

    // 第9步：计算相关系数（简单的皮尔逊相关系数）
    const meanTitleLength = titleLengths.reduce((a, b) => a + b, 0) / titleLengths.length
    const meanHeight = heights.reduce((a, b) => a + b, 0) / heights.length

    let numerator = 0
    let sumSquaredTitleDiff = 0
    let sumSquaredHeightDiff = 0

    for (let i = 0; i < stats.length; i++) {
      const titleDiff = titleLengths[i] - meanTitleLength
      const heightDiff = heights[i] - meanHeight
      numerator += titleDiff * heightDiff
      sumSquaredTitleDiff += titleDiff * titleDiff
      sumSquaredHeightDiff += heightDiff * heightDiff
    }

    const correlation = Math.sqrt(sumSquaredTitleDiff) * Math.sqrt(sumSquaredHeightDiff) > 0
      ? numerator / (Math.sqrt(sumSquaredTitleDiff) * Math.sqrt(sumSquaredHeightDiff))
      : 0

    // 第10步：计算图片数量与高度的相关系数
    const meanImageCount = imageCounts.reduce((a, b) => a + b, 0) / imageCounts.length
    let imageHeightNumerator = 0
    let sumSquaredImageDiff = 0

    for (let i = 0; i < stats.length; i++) {
      const imageDiff = imageCounts[i] - meanImageCount
      const heightDiff = heights[i] - meanHeight
      imageHeightNumerator += imageDiff * heightDiff
      sumSquaredImageDiff += imageDiff * imageDiff
    }

    const imageHeightCorrelation = Math.sqrt(sumSquaredImageDiff) * Math.sqrt(sumSquaredHeightDiff) > 0
      ? imageHeightNumerator / (Math.sqrt(sumSquaredImageDiff) * Math.sqrt(sumSquaredHeightDiff))
      : 0

    // 第11步：计算公式数量与高度的相关系数
    const meanFormulaCount = formulaCounts.reduce((a, b) => a + b, 0) / formulaCounts.length
    let formulaHeightNumerator = 0
    let sumSquaredFormulaDiff = 0

    for (let i = 0; i < stats.length; i++) {
      const formulaDiff = formulaCounts[i] - meanFormulaCount
      const heightDiff = heights[i] - meanHeight
      formulaHeightNumerator += formulaDiff * heightDiff
      sumSquaredFormulaDiff += formulaDiff * formulaDiff
    }

    const formulaHeightCorrelation = Math.sqrt(sumSquaredFormulaDiff) * Math.sqrt(sumSquaredHeightDiff) > 0
      ? formulaHeightNumerator / (Math.sqrt(sumSquaredFormulaDiff) * Math.sqrt(sumSquaredHeightDiff))
      : 0

    // 第12步：按 title 长度分组统计
    const groups: Record<string, { count: number; avgHeight: number; titles: string[] }> = {}
    stats.forEach(stat => {
      const groupKey = stat.titleLength < 20 ? '短标题(0-20)'
        : stat.titleLength < 50 ? '中标题(21-50)'
        : stat.titleLength < 100 ? '长标题(51-100)'
        : '超长标题(100+)'
      
      if (!groups[groupKey]) {
        groups[groupKey] = { count: 0, avgHeight: 0, titles: [] }
      }
      groups[groupKey].count++
      groups[groupKey].avgHeight += stat.height
      if (groups[groupKey].titles.length < 3) {
        groups[groupKey].titles.push(stat.title.substring(0, 50))
      }
    })

    // 第13步：计算每组的平均高度
    Object.keys(groups).forEach(key => {
      groups[key].avgHeight = Math.round(groups[key].avgHeight / groups[key].count)
    })

    // 第14步：按图片数量分组统计
    const imageGroups: Record<string, { count: number; avgHeight: number; avgTitleLength: number; titles: string[] }> = {}
    stats.forEach(stat => {
      const groupKey = stat.imageCount === 0 ? '无图片(0)'
        : stat.imageCount === 1 ? '单图片(1)'
        : stat.imageCount <= 3 ? `多图片(2-3)`
        : `超多图片(${stat.imageCount}+)`
      
      if (!imageGroups[groupKey]) {
        imageGroups[groupKey] = { count: 0, avgHeight: 0, avgTitleLength: 0, titles: [] }
      }
      imageGroups[groupKey].count++
      imageGroups[groupKey].avgHeight += stat.height
      imageGroups[groupKey].avgTitleLength += stat.titleLength
      if (imageGroups[groupKey].titles.length < 3) {
        imageGroups[groupKey].titles.push(stat.title.substring(0, 50))
      }
    })

    // 第15步：计算每组的平均值
    Object.keys(imageGroups).forEach(key => {
      const group = imageGroups[key]
      group.avgHeight = Math.round(group.avgHeight / group.count)
      group.avgTitleLength = Math.round(group.avgTitleLength / group.count)
    })

    // 第16步：按公式数量分组统计
    const formulaGroups: Record<string, { count: number; avgHeight: number; avgTitleLength: number; titles: string[] }> = {}
    stats.forEach(stat => {
      const groupKey = stat.formulaCount === 0 ? '无公式(0)'
        : stat.formulaCount === 1 ? '单公式(1)'
        : stat.formulaCount <= 3 ? `多公式(2-3)`
        : stat.formulaCount <= 5 ? `较多公式(4-5)`
        : `超多公式(${stat.formulaCount}+)`
      
      if (!formulaGroups[groupKey]) {
        formulaGroups[groupKey] = { count: 0, avgHeight: 0, avgTitleLength: 0, titles: [] }
      }
      formulaGroups[groupKey].count++
      formulaGroups[groupKey].avgHeight += stat.height
      formulaGroups[groupKey].avgTitleLength += stat.titleLength
      if (formulaGroups[groupKey].titles.length < 3) {
        formulaGroups[groupKey].titles.push(stat.title.substring(0, 50))
      }
    })

    // 第17步：计算公式分组的平均值
    Object.keys(formulaGroups).forEach(key => {
      const group = formulaGroups[key]
      group.avgHeight = Math.round(group.avgHeight / group.count)
      group.avgTitleLength = Math.round(group.avgTitleLength / group.count)
    })

    // 第18步：按图片数量和标题长度组合分组统计（综合影响分析）
    const combinedGroups: Record<string, { count: number; avgHeight: number; titles: string[] }> = {}
    stats.forEach(stat => {
      const imageGroup = stat.imageCount === 0 ? '无图' : stat.imageCount === 1 ? '1图' : stat.imageCount <= 3 ? '2-3图' : '多图'
      const titleGroup = stat.titleLength < 50 ? '短' : stat.titleLength < 100 ? '中' : '长'
      const groupKey = `${imageGroup}+${titleGroup}标题`
      
      if (!combinedGroups[groupKey]) {
        combinedGroups[groupKey] = { count: 0, avgHeight: 0, titles: [] }
      }
      combinedGroups[groupKey].count++
      combinedGroups[groupKey].avgHeight += stat.height
      if (combinedGroups[groupKey].titles.length < 2) {
        combinedGroups[groupKey].titles.push(stat.title.substring(0, 40))
      }
    })

    // 第19步：计算组合分组的平均值
    Object.keys(combinedGroups).forEach(key => {
      combinedGroups[key].avgHeight = Math.round(combinedGroups[key].avgHeight / combinedGroups[key].count)
    })

    // 第20步：输出统计结果
    console.log('═══════════════════════════════════════════════════════════')
    console.log('📊 题目 Title 和卡片高度关系统计分析')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`📈 总样本数: ${stats.length}`)
    console.log('')
    console.log('📏 Title 长度统计:')
    console.log(`  平均长度: ${avgTitleLength} 字符`)
    console.log(`  最短: ${minTitleLength} 字符`)
    console.log(`  最长: ${maxTitleLength} 字符`)
    console.log('')
    console.log('🖼️  图片数量统计:')
    console.log(`  平均数量: ${avgImageCount.toFixed(2)} 张`)
    console.log(`  最少: ${minImageCount} 张`)
    console.log(`  最多: ${maxImageCount} 张`)
    const imageCountDistribution: Record<number, number> = {}
    imageCounts.forEach(count => {
      imageCountDistribution[count] = (imageCountDistribution[count] || 0) + 1
    })
    console.log(`  分布: ${Object.entries(imageCountDistribution).map(([count, num]) => `${count}张(${num}题)`).join(', ')}`)
    console.log('')
    console.log('📐 公式数量统计:')
    console.log(`  平均数量: ${avgFormulaCount.toFixed(2)} 个`)
    console.log(`  最少: ${minFormulaCount} 个`)
    console.log(`  最多: ${maxFormulaCount} 个`)
    const formulaCountDistribution: Record<number, number> = {}
    formulaCounts.forEach(count => {
      formulaCountDistribution[count] = (formulaCountDistribution[count] || 0) + 1
    })
    console.log(`  分布: ${Object.entries(formulaCountDistribution).map(([count, num]) => `${count}个(${num}题)`).join(', ')}`)
    console.log('')
    console.log('📐 卡片高度统计:')
    console.log(`  平均高度: ${avgHeight}px`)
    console.log(`  最小高度: ${minHeight}px`)
    console.log(`  最大高度: ${maxHeight}px`)
    console.log('')
    console.log('🔗 相关性分析:')
    console.log(`  Title 长度与高度的相关系数: ${correlation.toFixed(4)}`)
    if (correlation > 0.5) {
      console.log('  💡 结论: Title 长度与卡片高度呈正相关关系')
    } else if (correlation < -0.5) {
      console.log('  💡 结论: Title 长度与卡片高度呈负相关关系')
    } else {
      console.log('  💡 结论: Title 长度与卡片高度相关性较弱')
    }
    console.log(`  图片数量与高度的相关系数: ${imageHeightCorrelation.toFixed(4)}`)
    if (imageHeightCorrelation > 0.5) {
      console.log('  💡 结论: 图片数量与卡片高度呈正相关关系')
    } else if (imageHeightCorrelation < -0.5) {
      console.log('  💡 结论: 图片数量与卡片高度呈负相关关系')
    } else {
      console.log('  💡 结论: 图片数量与卡片高度相关性较弱')
    }
    console.log(`  公式数量与高度的相关系数: ${formulaHeightCorrelation.toFixed(4)}`)
    if (formulaHeightCorrelation > 0.5) {
      console.log('  💡 结论: 公式数量与卡片高度呈正相关关系')
    } else if (formulaHeightCorrelation < -0.5) {
      console.log('  💡 结论: 公式数量与卡片高度呈负相关关系')
    } else {
      console.log('  💡 结论: 公式数量与卡片高度相关性较弱')
    }
    console.log('')
    console.log('📊 按 Title 长度分组统计:')
    Object.keys(groups).sort().forEach(key => {
      const group = groups[key]
      console.log(`  ${key}:`)
      console.log(`    样本数: ${group.count}`)
      console.log(`    平均高度: ${group.avgHeight}px`)
      if (group.titles.length > 0) {
        console.log(`    示例标题: ${group.titles.join(', ')}`)
      }
    })
    console.log('')
    console.log('🖼️  按图片数量分组统计:')
    Object.keys(imageGroups).sort().forEach(key => {
      const group = imageGroups[key]
      console.log(`  ${key}:`)
      console.log(`    样本数: ${group.count}`)
      console.log(`    平均高度: ${group.avgHeight}px`)
      console.log(`    平均标题长度: ${group.avgTitleLength} 字符`)
      if (group.titles.length > 0) {
        console.log(`    示例标题: ${group.titles.join(', ')}`)
      }
    })
    console.log('')
    console.log('📐 按公式数量分组统计:')
    Object.keys(formulaGroups).sort().forEach(key => {
      const group = formulaGroups[key]
      console.log(`  ${key}:`)
      console.log(`    样本数: ${group.count}`)
      console.log(`    平均高度: ${group.avgHeight}px`)
      console.log(`    平均标题长度: ${group.avgTitleLength} 字符`)
      if (group.titles.length > 0) {
        console.log(`    示例标题: ${group.titles.join(', ')}`)
      }
    })
    console.log('')
    console.log('📊 综合影响分析（图片数量 + 标题长度）:')
    Object.keys(combinedGroups).sort().forEach(key => {
      const group = combinedGroups[key]
      console.log(`  ${key}:`)
      console.log(`    样本数: ${group.count}`)
      console.log(`    平均高度: ${group.avgHeight}px`)
      if (group.titles.length > 0) {
        console.log(`    示例: ${group.titles.join(', ')}`)
      }
    })
    console.log('')
    console.log('📋 详细数据（前10条）:')
    stats.slice(0, 10).forEach((stat, index) => {
      const imageInfo = stat.imageCount > 0 ? `[${stat.imageCount}图]` : ''
      const formulaInfo = stat.formulaCount > 0 ? `[${stat.formulaCount}公式]` : ''
      console.log(`  ${index + 1}. ${stat.questionId}: 高度=${stat.height}px, 长度=${stat.titleLength}, ${imageInfo}${formulaInfo}`)
    })
    console.log('═══════════════════════════════════════════════════════════')
  }

  // ========== 高度估算方法 ==========

  // 基于统计数据的高度估算函数（优化版 - 基于最新实际数据调整）
  const estimateHeightByStats = (title: string): number => {
    if (!title) {
      return 207
    }

    const imageCount = countImagesInTitle(title)
    const formulaInfo = countFormulasInTitle(title)
    const inlineFormulaCount = formulaInfo.inline
    const blockFormulaCount = formulaInfo.block
    const titleLength = title.length

    const lineCount = (title.match(/\n/g) || []).length + 1
    const hasTable = title.includes('|') && title.split('|').length > 4
    const hasMultipleLines = lineCount > 2
    const hasComplexFormatting = hasTable || hasMultipleLines

    if (imageCount > 0) {
      let baseHeight: number
      
      if (titleLength <= 150) {
        baseHeight = 350
        baseHeight += Math.round((titleLength / 150) * 50)
      } else if (titleLength <= 220) {
        const extraLength = titleLength - 150
        baseHeight = Math.round(400 + (extraLength / 70) * 10)
      } else if (titleLength <= 280) {
        if (titleLength <= 262) {
          const ratio = (titleLength - 220) / 42
          baseHeight = Math.round(410 - (410 - 389) * ratio)
        } else {
          const ratio = (titleLength - 262) / 18
          baseHeight = Math.round(389 + (530 - 389) * ratio)
        }
      } else if (titleLength <= 420) {
        const extraLength = titleLength - 280
        if (titleLength <= 370) {
          baseHeight = Math.round(530 + (extraLength / 90) * 50)
        } else {
          baseHeight = Math.round(580 - ((titleLength - 370) / 50) * 50)
        }
      } else {
        if (titleLength <= 450) {
          const extraLength = titleLength - 420
          baseHeight = Math.round(580 + (extraLength / 30) * 94)
        } else {
          const extraLength = titleLength - 450
          baseHeight = Math.round(674 + (extraLength / 100) * 80)
        }
      }
      
      if (lineCount > 1) {
        const extraLines = lineCount - 1
        if (titleLength <= 280) {
          baseHeight += extraLines * 15
        } else if (titleLength <= 420) {
          baseHeight += extraLines * 20
        } else {
          baseHeight += extraLines * 25
        }
      }
      
      if (hasComplexFormatting) {
        baseHeight += 20
      }
      
      if (inlineFormulaCount > 0) {
        if (inlineFormulaCount <= 10) {
          baseHeight += inlineFormulaCount * 1
        } else {
          baseHeight += 10 + Math.floor((inlineFormulaCount - 10) / 10) * 5
        }
      }
      if (blockFormulaCount > 0) {
        baseHeight += blockFormulaCount * 30
      }
      
      return Math.max(baseHeight, 350)
    }
    
    if (titleLength <= 20) {
      return 141
    } else if (titleLength <= 50) {
      return 171
    } else if (titleLength <= 100) {
      return 171
    } else {
      let baseHeight = 0
      
      if (titleLength <= 200) {
        const extraLength = titleLength - 100
        const heightIncrease = (extraLength / 100) * (194 - 171)
        baseHeight = Math.round(171 + heightIncrease)
      } else if (titleLength <= 250) {
        const extraLength = titleLength - 200
        const heightIncrease = (extraLength / 50) * (225 - 194)
        baseHeight = Math.round(194 + heightIncrease)
      } else if (titleLength <= 300) {
        const extraLength = titleLength - 250
        const heightIncrease = (extraLength / 50) * (240 - 225)
        baseHeight = Math.round(225 + heightIncrease)
      } else if (titleLength <= 400) {
        const extraLength = titleLength - 300
        const heightIncrease = (extraLength / 100) * (407 - 240)
        baseHeight = Math.round(240 + heightIncrease)
      } else {
        const extraLength = titleLength - 400
        if (hasTable) {
          if (extraLength <= 100) {
            const heightIncrease = extraLength * 3.5
            baseHeight = Math.round(440 + heightIncrease)
          } else {
            const first100Increase = 100 * 3.5
            const remainingLength = extraLength - 100
            const remainingIncrease = remainingLength * 2.5
            baseHeight = Math.round(440 + first100Increase + remainingIncrease)
          }
        } else {
          if (inlineFormulaCount > 10 || lineCount > 4) {
            const heightIncrease = extraLength * 0.2
            baseHeight = Math.round(407 + heightIncrease)
          } else {
            const heightIncrease = extraLength * 0.4
            baseHeight = Math.round(407 + heightIncrease)
          }
        }
      }
      
      if (lineCount > 1) {
        const extraLines = lineCount - 1
        if (titleLength <= 300) {
          baseHeight += extraLines * 18
        } else if (titleLength <= 400) {
          baseHeight += extraLines * 35
        } else {
          if (inlineFormulaCount > 10) {
            baseHeight += extraLines * 15
          } else {
            baseHeight += extraLines * 25
          }
        }
      }
      
      if (inlineFormulaCount > 0) {
        if (inlineFormulaCount <= 10) {
          baseHeight += Math.round(inlineFormulaCount * 0.5)
        } else {
          baseHeight += 5 + Math.round((inlineFormulaCount - 10) * 0.5)
        }
      }
      if (blockFormulaCount > 0) {
        baseHeight += blockFormulaCount * 30
      }
      
      return Math.max(baseHeight, 141)
    }
  }

  // ========== 主要方法 ==========

  // 记录题目高度（整合所有统计功能）
  const recordQuestionHeight = (
    questionId: string,
    index: number,
    height: number
  ) => {
    // 1. 存储到ID映射
    questionHeights.value.set(questionId, height)

    // 2. 存储到索引映射（便于快速查找）
    indexToHeight.value.set(index, height)

    // 3. 更新统计信息
    updateHeightStats(height)

    // 4. 记录 title 和高度关系（用于统计分析）
    recordTitleHeightRelation(questionId, height)

    // 5. 对比估算高度和真实高度
    compareEstimatedAndActualHeight(questionId, index, height)
  }

  // ========== 导出 ==========

  return {
    // 状态
    heightStats,
    titleHeightStats,
    heightComparisons,

    // 工具函数
    countImagesInTitle,
    countFormulasInTitle,
    estimateHeightByStats,

    // 统计方法
    recordQuestionHeight,
    updateHeightStats,
    recordTitleHeightRelation,
    compareEstimatedAndActualHeight,
    outputComparisonStatistics,

    // 分析方法
    analyzeTitleHeightRelation,
    activelyBindQuestionRefs,
    manuallyMeasureAllQuestions,
    performMeasurement
  }
}