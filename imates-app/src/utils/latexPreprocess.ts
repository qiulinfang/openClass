/**
 * 跨平台 LaTeX 与 Markdown 预处理器
 * 完全对齐 imates-web/src/composables/useMessageRenderer.ts 预处理逻辑
 */

/**
 * 预处理 Markdown 标题（容错：允许标题标记不在行首时自动换行）
 */
export function preprocessMarkdownHeadings(contentStr: string): string {
  if (!contentStr) return '';
  const parts = contentStr.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => {
      if (part.startsWith('```')) return part;
      return part.replace(/([^\n])\s*(#{1,6}\s+)/g, '$1\n$2');
    })
    .join('');
}

/**
 * 预处理 LaTeX 公式格式
 * 将 \(...\)、\[...\]、MathLive 模式、孤立 $ 块统一化，防止打断文字排版
 */
export function preprocessLatexFormats(contentStr: string): string {
  if (!contentStr) return '';

  // 1. 反转义常见 HTML 实体（如 &lt; -> <, &gt; -> >）
  let processedContent = contentStr
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  // 2. 预处理 Markdown 标题及 HTML 缩进问题
  processedContent = preprocessMarkdownHeadings(processedContent)
    .split('\n')
    .map((line) => {
      if (/^\s*<[a-zA-Z]/.test(line)) {
        return line.trimStart();
      }
      return line;
    })
    .join('\n');

  // 3. 合并“孤立 $ 块”为块级公式：\n\n$$...$$\n\n
  const lonelyDollarBlockRegex = /(^|\n)\s*\$(?:\s*)\n([\s\S]*?)\n\s*\$\s*(?=\n|$)/g;
  processedContent = processedContent.replace(lonelyDollarBlockRegex, (_m, prefix, content) => {
    const trimmed = String(content ?? '').trim();
    return `${prefix}\n\n$$${trimmed}$$\n\n`;
  });

  // 4. 处理 MathLive 输出格式
  const mathLiveRegex = /\\begin\{math\}(.*?)\\end\{math\}/gs;
  processedContent = processedContent.replace(mathLiveRegex, (_m, c) => `$$${c}$$`);

  // 5. 处理分段函数包含 array 环境的行内公式为块级公式
  const piecewiseFunctionRegex = /\\\(([^)]*\\begin\{array\}[^)]*\\end\{array\}[^)]*)\\\)/gs;
  processedContent = processedContent.replace(piecewiseFunctionRegex, (_match, content) => {
    return `$$${content}$$`;
  });

  // 6. 处理复杂多行环境的行内公式为块级公式
  const complexFormulaRegex = /\\\(([^)]*\\begin\{[^}]*\}[^)]*\\end\{[^}]*\}[^)]*)\\\)/gs;
  processedContent = processedContent.replace(complexFormulaRegex, (_match, content) => {
    return `$$${content}$$`;
  });

  // 7. 处理行内公式 \(...\) 格式，转换为 $...$ 格式（避免字符串替换 $$ 脱敏成 $$formula$）
  const inlineRegex = /\\\(\s*(.*?)\s*\\\)/gs;
  processedContent = processedContent.replace(inlineRegex, (_m, c) => `$${c}$`);

  // 8. 处理块级公式 \[...\] 格式
  const displayRegex = /\\\[(.*?)\\\]/gs;
  processedContent = processedContent.replace(displayRegex, (_match, content) => {
    const trimmed = String(content ?? '').trim();
    return `\n\n$$${trimmed}$$\n\n`;
  });

  return processedContent;
}
