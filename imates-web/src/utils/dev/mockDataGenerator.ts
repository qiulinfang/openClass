import type { ExerciseItem } from '../../types'

/**
 * 生成数学题目假数据
 */
export function generateMathQuestions(count: number = 10): ExerciseItem[] {
  const questions: ExerciseItem[] = []
  
  for (let i = 0; i < count; i++) {
    const questionId = `mock_math_${Date.now()}_${i}`
    const bmNo = `M${String(i + 1).padStart(3, '0')}`
    
    questions.push({
      id: questionId,
      bmNo: bmNo,
      title: `数学题目 ${i + 1}`,
      question: generateMathQuestionContent(i),
      answer: generateMathAnswer(i),
      explanation: generateMathExplanation(i),
      analysisData: generateMathAnalysis(i),
      subject: 'math'
    })
  }
  
  return questions
}

/**
 * 生成生物题目假数据
 */
export function generateBiologyQuestions(count: number = 10): ExerciseItem[] {
  const questions: ExerciseItem[] = []
  
  for (let i = 0; i < count; i++) {
    const questionId = `mock_bio_${Date.now()}_${i}`
    const bmNo = `B${String(i + 1).padStart(3, '0')}`
    
    questions.push({
      id: questionId,
      bmNo: bmNo,
      title: `生物题目 ${i + 1}`,
      question: generateBiologyQuestionContent(i),
      answer: generateBiologyAnswer(i),
      explanation: generateBiologyExplanation(i),
      analysisData: generateBiologyAnalysis(i),
      subject: 'biology'
    })
  }
  
  return questions
}

/**
 * 生成特殊字符题目假数据
 */
export function generateSpecialCharacterQuestions(count: number = 5): ExerciseItem[] {
  const questions: ExerciseItem[] = []
  
  for (let i = 0; i < count; i++) {
    const questionId = `mock_special_${Date.now()}_${i}`
    const bmNo = `S${String(i + 1).padStart(3, '0')}`
    
    questions.push({
      id: questionId,
      bmNo: bmNo,
      title: `特殊字符题目 ${i + 1}`,
      question: generateSpecialQuestionContent(i),
      answer: generateSpecialAnswer(i),
      explanation: generateSpecialExplanation(i),
      analysisData: generateSpecialAnalysis(i),
      subject: 'math'
    })
  }
  
  return questions
}

/**
 * 生成大量题目假数据
 */
export function generateLargeQuestionSet(count: number = 100): ExerciseItem[] {
  const questions: ExerciseItem[] = []
  
  // 70% 数学题目
  const mathCount = Math.floor(count * 0.7)
  questions.push(...generateMathQuestions(mathCount))
  
  // 30% 生物题目
  const bioCount = count - mathCount
  questions.push(...generateBiologyQuestions(bioCount))
  
  return questions
}

// 数学题目内容生成器
function generateMathQuestionContent(index: number): string {
  const mathQuestions = [
    `若函数 $f(x)$ 满足 $f(2^{x}) = x$，则 $f(4) =$______，$f(6) =$______.`,
    `若 $a = \\log_{4}3$，则 $2^{a} + 2^{-a} =$______.`,
    `方程 $9^{x} = 3^{x} + 2$ 的解为______.`,
    `已知函数 $f(x) = \\log_{3}x$，若正数 $a,b$ 满足 $\\frac{a}{b} = \\frac{1}{5}$，则 $f(a) - f(b) =$______.`,
    `$3^{-\\log_{3}2} =$______.`,
    `大西洋鲑鱼每年都要逆流而上，游回它们出生的地方产卵繁殖。研究鲑鱼的科学家发现鲑鱼的游速 $v$ (单位: $\\mathrm{m} / \\mathrm{s}$) 可以表示为 $v = \\frac{1}{2} \\log_{3} \\frac{O}{100}$，其中 $O$ 表示鲑鱼的耗氧量的单位数。则该鲑鱼游速为 $2 \\mathrm{~m} / \\mathrm{s}$ 时的耗氧量与静止时耗氧量的比值为 _____.`,
    `方程 $\\lg (2x + 1) + \\lg x = 1$ 的解集为______.`,
    `若 $\\lg a,\\lg b$ 是方程 $2x^{2} - 4x + 1 = 0$ 的两个根，则 $\\left(\\lg {\\frac{a}{b}}\\right)^{2} =$______.`,
    `已知 $f(x)$ 是定义域为 $\\mathbf{R}$ 的奇函数，且当 $x > 0$ 时，$f(x) = \\ln x$，则 $f\\left(-\\frac{1}{\\mathrm{e}}\\right)$ 的值是______.`,
    `方程 $\\log_{2}(x^{2} - 8) = 1 + \\log_{2}x$，则 $x =$______.`
  ]
  
  return mathQuestions[index % mathQuestions.length]
}

function generateMathAnswer(index: number): string {
  const answers = [
    `2&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$\\log_{2}6$`,
    `$\\frac{4}{3}\\sqrt{3}$`,
    `$\\log_{3}2$`,
    `-2`,
    `$\\frac{1}{2}$`,
    `81`,
    `$\\{2\\}$`,
    `2`,
    `1`,
    `4`
  ]
  
  return answers[index % answers.length]
}

function generateMathExplanation(index: number): string {
  const explanations = [
    `### 主题干中的答案和解析步骤\n1- 分析题目：题目给出了一个函数f(x)满足f(2^x) = x，要求我们求f(4)和f(6)的值。\n\n2- 解题思路：由于f(2^x) = x，我们可以通过令2^x等于4和6来解出对应的x值，即f(4)和f(6)。\n\n3- 求f(4)：令2^x = 4，解得x = 2，因此f(4) = 2。\n\n4- 求f(6)：令2^x = 6，解得x = log₂6，因此f(6) = log₂6。\n\n最终答案：2;\n$\\log_{2}6$`,
    `### 主题干中的答案和解析步骤\n1- 题目给出了$a = \\log_{4}3$，需要计算$2^{a} + 2^{-a}$的值。\n2- 首先将$a$的表达式转换为以2为底的对数形式：$a = \\log_{4}3 = \\frac{1}{2}\\log_{2}3$。\n3- 将$2^{a}$和$2^{-a}$表示为指数形式：$2^{a} = 2^{\\frac{1}{2}\\log_{2}3} = \\sqrt{3}$，$2^{-a} = \\frac{1}{\\sqrt{3}}$。\n4- 将两项相加并通分：$\\sqrt{3} + \\frac{1}{\\sqrt{3}} = \\frac{3 + 1}{\\sqrt{3}} = \\frac{4}{\\sqrt{3}}$。\n5- 有理化分母：$\\frac{4}{\\sqrt{3}} = \\frac{4\\sqrt{3}}{3}$。\n\n最终答案：$\\frac{4}{3}\\sqrt{3}$`,
    `### 主题干中的答案和解析步骤\n1- 首先，观察方程 $9^{x} = 3^{x} + 2$，注意到 $9$ 可以表示为 $3$ 的平方，即 $9 = 3^2$。\n2- 将方程改写为 $(3^2)^x = 3^x + 2$，进一步简化为 $3^{2x} = 3^x + 2$。\n3- 设 $y = 3^x$，则方程变为 $y^2 = y + 2$，即 $y^2 - y - 2 = 0$。\n4- 解这个二次方程，得到 $y = 2$ 或 $y = -1$。由于 $3^x > 0$，舍去 $y = -1$，保留 $y = 2$。\n5- 由 $3^x = 2$，取对数得到 $x = \\log_{3}2$。\n\n最终答案：$\\log_{3}2$`,
    `### 主题干中的答案和解析步骤\n1- 分析题目：已知函数 \\( f(x) = \\log_{3}x \\)，正数 \\( a, b \\) 满足比例关系 \\( \\frac{a}{b} = \\frac{1}{5} \\)，要求计算 \\( f(a) - f(b) \\) 的值。\n\n2- 根据比例关系 \\( \\frac{a}{b} = \\frac{1}{5} \\)，可以表示为 \\( a = \\frac{b}{5} \\)。\n\n3- 将 \\( a = \\frac{b}{5} \\) 代入函数 \\( f(x) \\)，得到 \\( f(a) = \\log_{3}\\left(\\frac{b}{5}\\right) \\)，而 \\( f(b) = \\log_{3}b \\)。\n\n4- 计算 \\( f(a) - f(b) = \\log_{3}\\left(\\frac{b}{5}\\right) - \\log_{3}b \\)，利用对数减法公式合并为 \\( \\log_{3}\\left(\\frac{1}{5}\\right) \\)。\n\n5- 化简 \\( \\log_{3}\\left(\\frac{1}{5}\\right) = -\\log_{3}5 \\)，但题目未给出 \\( \\log_{3}5 \\) 的具体值，需要进一步分析比例关系。\n\n6- 由于 \\( \\frac{a}{b} = \\frac{1}{5} \\)，直接代入对数差公式得到 \\( \\log_{3}\\left(\\frac{a}{b}\\right) = \\log_{3}\\left(\\frac{1}{5}\\right) = - \\log_{3}5 \\)，但题目可能隐含其他条件。\n\n7- 重新审视题目，发现 \\( f(a) - f(b) = \\log_{3}a - \\log_{3}b = \\log_{3}\\left(\\frac{a}{b}\\right) = \\log_{3}\\left(\\frac{1}{5}\\right) \\)，而 \\( \\log_{3}\\left(\\frac{1}{5}\\right) = -\\log_{3}5 \\)。\n\n8- 题目可能要求的是数值结果，但根据选项或上下文，可能需要进一步计算或近似，但题目明确答案为 -2。\n\n最终答案：-2`,
    `### 主题干中的答案和解析步骤\n1- 题目要求计算 \\(3^{-\\log_{3}2}\\) 的值，其中底数为3的对数和指数函数相关联。\n2- 利用对数和指数的性质，可以将表达式重写为 \\(3^{\\log_{3}2^{-1}}\\)，因为负指数表示倒数。\n3- 根据指数和对数的逆运算关系，\\(3^{\\log_{3}x} = x\\)，所以 \\(3^{\\log_{3}2^{-1}} = 2^{-1}\\)。\n4- 计算 \\(2^{-1}\\) 得到最终结果 \\(\\frac{1}{2}\\)。\n\n最终答案：$\\frac{1}{2}$`
  ]
  
  return explanations[index % explanations.length]
}

function generateMathAnalysis(index: number): string {
  return generateMathExplanation(index)
}

// 生物题目内容生成器
function generateBiologyQuestionContent(index: number): string {
  const bioQuestions = [
    `下列哪项不是细胞膜的主要功能？`,
    `DNA复制过程中，下列哪种酶负责解开双螺旋结构？`,
    `光合作用的光反应阶段发生在叶绿体的哪个部位？`,
    `下列哪种细胞器是蛋白质合成的主要场所？`,
    `有丝分裂过程中，染色体排列在赤道板上的时期是？`,
    `下列哪项不是RNA与DNA的主要区别？`,
    `细胞呼吸过程中，产生ATP最多的阶段是？`,
    `下列哪种物质是细胞壁的主要成分？`,
    `基因表达过程中，转录发生在细胞的哪个部位？`,
    `下列哪项不是酶的特性？`
  ]
  
  return bioQuestions[index % bioQuestions.length]
}

function generateBiologyAnswer(index: number): string {
  const answers = [
    `A`,
    `B`,
    `C`,
    `A`,
    `B`,
    `D`,
    `C`,
    `A`,
    `B`,
    `D`
  ]
  
  return answers[index % answers.length]
}

function generateBiologyExplanation(index: number): string {
  const explanations = [
    `细胞膜的主要功能包括：1. 控制物质进出细胞；2. 进行细胞间的信息交流；3. 维持细胞内部环境的相对稳定。细胞膜不直接参与蛋白质的合成，蛋白质合成主要在核糖体上进行。`,
    `DNA复制过程中，解旋酶负责解开双螺旋结构，使两条链分开，为复制提供模板。DNA聚合酶负责合成新的DNA链，连接酶负责连接DNA片段，RNA聚合酶负责转录过程。`,
    `光合作用的光反应阶段发生在叶绿体的类囊体膜上，这里含有光合色素和光系统，能够捕获光能并转化为化学能。暗反应阶段发生在叶绿体基质中。`,
    `核糖体是蛋白质合成的主要场所，它由rRNA和蛋白质组成，能够读取mRNA上的遗传信息并合成相应的蛋白质。内质网和高尔基体主要参与蛋白质的加工和分泌。`,
    `有丝分裂过程中，染色体排列在赤道板上的时期是中期。前期染色体开始凝集，后期染色体分离，末期形成两个子细胞。`
  ]
  
  return explanations[index % explanations.length]
}

function generateBiologyAnalysis(index: number): string {
  return generateBiologyExplanation(index)
}

// 特殊字符题目内容生成器
function generateSpecialQuestionContent(index: number): string {
  const specialQuestions = [
    `计算：$\\int_0^1 x^2 dx = $______.`,
    `求极限：$\\lim_{x \\to 0} \\frac{\\sin x}{x} = $______.`,
    `解方程：$\\sqrt{x+1} + \\sqrt{x-1} = 2$，则 $x = $______.`,
    `已知 $\\alpha + \\beta = \\frac{\\pi}{2}$，$\\sin\\alpha = \\frac{3}{5}$，则 $\\cos\\beta = $______.`,
    `求导数：$\\frac{d}{dx}(x^3 + 2x^2 - 5x + 1) = $______.`
  ]
  
  return specialQuestions[index % specialQuestions.length]
}

function generateSpecialAnswer(index: number): string {
  const answers = [
    `$\\frac{1}{3}$`,
    `1`,
    `$\\frac{5}{4}$`,
    `$\\frac{3}{5}$`,
    `$3x^2 + 4x - 5$`
  ]
  
  return answers[index % answers.length]
}

function generateSpecialExplanation(index: number): string {
  const explanations = [
    `使用定积分的基本公式：$\\int x^n dx = \\frac{x^{n+1}}{n+1} + C$，所以 $\\int_0^1 x^2 dx = \\left[\\frac{x^3}{3}\\right]_0^1 = \\frac{1}{3} - 0 = \\frac{1}{3}$。`,
    `这是一个重要的极限，可以使用洛必达法则或泰勒展开来求解。由于 $\\lim_{x \\to 0} \\frac{\\sin x}{x} = \\lim_{x \\to 0} \\frac{\\cos x}{1} = 1$。`,
    `设 $\\sqrt{x+1} = a$，$\\sqrt{x-1} = b$，则 $a + b = 2$，$a^2 - b^2 = 2$。由 $a^2 - b^2 = (a+b)(a-b) = 2$，得 $a-b = 1$。解得 $a = \\frac{3}{2}$，$b = \\frac{1}{2}$，所以 $x = \\frac{5}{4}$。`,
    `由于 $\\alpha + \\beta = \\frac{\\pi}{2}$，所以 $\\beta = \\frac{\\pi}{2} - \\alpha$。因此 $\\cos\\beta = \\cos\\left(\\frac{\\pi}{2} - \\alpha\\right) = \\sin\\alpha = \\frac{3}{5}$。`,
    `使用幂函数的导数公式：$\\frac{d}{dx}(x^n) = nx^{n-1}$，所以 $\\frac{d}{dx}(x^3 + 2x^2 - 5x + 1) = 3x^2 + 4x - 5$。`
  ]
  
  return explanations[index % explanations.length]
}

function generateSpecialAnalysis(index: number): string {
  return generateSpecialExplanation(index)
}
