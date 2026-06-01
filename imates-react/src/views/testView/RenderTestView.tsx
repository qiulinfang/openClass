import React, { useState, useEffect, useRef, useCallback } from 'react'
import MarkdownIt from 'markdown-it'
import mathjax3 from 'markdown-it-mathjax3'
// @ts-ignore
import katexPlugin from 'markdown-it-katex'
// @ts-ignore
import texmath from 'markdown-it-texmath'
// @ts-ignore
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { MathJaxUtils } from '@/utils/math/mathjax'
import './RenderTestView.css'

const RenderTestView: React.FC = () => {
  const example = `成功我们先看第一个不等式① \\\(ac^2 \\geq bc^2\\\)，已知 \\\(a > b\\\)，这里有没有需要注意的特殊情况呀？`

  const [raw, setRaw] = useState(example)
  const [htmlMathJax, setHtmlMathJax] = useState('')
  const [htmlKatex, setHtmlKatex] = useState('')
  const [htmlTexmath, setHtmlTexmath] = useState('')
  const previewMathJaxRef = useRef<HTMLDivElement>(null)

  const md = useRef(new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  }).use(mathjax3)).current

  const mdKatex = useRef(new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  }).use(katexPlugin)).current

  const mdTexmath = useRef(new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  }).use(texmath, {
    engine: katex,
    delimiters: 'mac',
  })).current

  const renderNow = useCallback(async () => {
    setHtmlMathJax(md.render(raw))
    try {
      setHtmlKatex(mdKatex.render(raw))
    } catch (e) {
      setHtmlKatex('<div class="error">KaTeX renderer failed (check dependencies)</div>')
    }
    try {
      setHtmlTexmath(mdTexmath.render(raw))
    } catch (e) {
      setHtmlTexmath('<div class="error">Texmath renderer failed (check dependencies)</div>')
    }
  }, [raw, md, mdKatex, mdTexmath])

  useEffect(() => {
    renderNow()
  }, [renderNow])

  useEffect(() => {
    if (previewMathJaxRef.current && htmlMathJax) {
      MathJaxUtils.renderMathAndWait(previewMathJaxRef.current)
    }
  }, [htmlMathJax])

  const reset = () => {
    setRaw(example)
  }

  return (
    <div className="render-test-view">
      <div className="header">
        <div className="title">渲染测试页（无预处理）</div>
        <div className="desc">同一份 Raw 内容并排对比：MathJax vs KaTeX（katex plugin / texmath）</div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-title">输入（Raw）</div>
          <textarea 
            value={raw} 
            onChange={(e) => setRaw(e.target.value)}
            className="editor" 
            spellCheck="false" 
          />
          <div className="actions">
            <button className="btn" onClick={reset}>重置示例</button>
            <button className="btn primary" onClick={renderNow}>重新渲染</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">输出（MathJax）</div>
          <div 
            ref={previewMathJaxRef} 
            className="preview" 
            dangerouslySetInnerHTML={{ __html: htmlMathJax }}
          ></div>
        </div>

        <div className="panel">
          <div className="panel-title">输出（KaTeX / markdown-it-katex）</div>
          <div 
            className="preview" 
            dangerouslySetInnerHTML={{ __html: htmlKatex }}
          ></div>
        </div>

        <div className="panel">
          <div className="panel-title">输出（KaTeX / markdown-it-texmath）</div>
          <div 
            className="preview" 
            dangerouslySetInnerHTML={{ __html: htmlTexmath }}
          ></div>
        </div>
      </div>
    </div>
  )
}

export default RenderTestView
