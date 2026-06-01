import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import Button from '@/components/base/Button'
import './MarkdownRenderTestView.css'

const defaultContent = `
# 标题测试 H1
## 标题测试 H2
### 标题测试 H3

**加粗文本**，*斜体文本*，~~删除线~~。

#### 数学公式测试

行内公式： \\\( E = mc^2 \\\) 或者 $x^2 + y^2 = r^2$

块级公式：
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

分段函数：
\\\(
f(x) = \\begin{cases} 
x, & x > 0 \\\\
0, & x \\leq 0
\\end{cases}
\\\)

#### 列表与表格

1. 第一项
2. 第二项
   - 子项 A
   - 子项 B

| 姓名 | 年龄 | 角色 |
| :--- | :--- | :--- |
| 张三 | 18 | 学生 |
| 老师 | 35 | 辅导员 |

#### 代码块

\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`
`

const examples = [
  {
    name: '基础语法',
    content: defaultContent
  },
  {
    name: '复杂数学',
    content: `#### 线性代数
$$
A = \\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}, \\quad \\det(A) = ad - bc
$$

#### 积分与极限
$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$
$$
\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e
$$
`
  },
  {
    name: '混合文本',
    content: '已知点 \\\(P(x,y)\\\) 在圆 $x^2+y^2=1$ 上，求 $x+y$ 的最大值。\\n\\n**解析：**\\n可以使用三角代换，设 $x=\\cos\\theta, y=\\sin\\theta$，则 $x+y=\\cos\\theta+\\sin\\theta=\\sqrt{2}\\sin(\\theta+\\frac{\\pi}{4})$。'
  }
]

const MarkdownRenderTestView: React.FC = () => {
  const navigate = useNavigate()
  const { renderMessageContent } = useMessageRenderer()
  const renderTargetRef = useRef<HTMLDivElement>(null)
  const [markdownInput, setMarkdownInput] = useState(defaultContent)

  const renderedHtml = useMemo(() => {
    return renderMessageContent(markdownInput)
  }, [markdownInput, renderMessageContent])

  const resetToDefault = () => {
    setMarkdownInput(defaultContent)
  }

  useEffect(() => {
    const renderMath = async () => {
      if (renderTargetRef.current) {
        await MathJaxUtils.renderMathAndWait(renderTargetRef.current)
      }
    }
    renderMath()
  }, [renderedHtml])

  return (
    <div className="markdown-render-test">
      <div className="header-bar">
        <div className="header-title">Markdown & LaTeX 渲染测试</div>
        <div className="header-actions">
          <Button label="返回" variant="ghost" onClick={() => navigate(-1)} />
          <Button label="重置示例" onClick={resetToDefault} />
        </div>
      </div>

      <div className="main-content">
        {/* 左侧：输入区 */}
        <div className="input-panel">
          <div className="section-title">
            <span>✏️</span> Markdown 输入
          </div>
          <textarea
            className="full-height-input"
            value={markdownInput}
            onChange={(e) => setMarkdownInput(e.target.value)}
            placeholder="在此输入 Markdown 或 LaTeX 内容..."
            spellCheck="false"
          />
          <div className="examples-grid">
            <div className="text-subtitle2" style={{ marginBottom: '8px', fontSize: '13px', color: '#666' }}>快速示例：</div>
            <div className="example-btns">
              {examples.map((ex, index) => (
                <button
                  key={index}
                  className="example-btn"
                  onClick={() => setMarkdownInput(ex.content)}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：渲染区 */}
        <div className="render-panel">
          <div className="section-title">
            <span>👁️</span> 渲染效果 (useMessageRenderer)
          </div>
          <div className="render-container">
            <div 
              className="markdown-content" 
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
              ref={renderTargetRef}
            ></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarkdownRenderTestView
