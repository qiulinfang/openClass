// 测试修复后的LaTeX预处理函数
const preprocessLatexFormats = (contentStr) => {
  let processedContent = contentStr;
  
  // 1. 处理MathLive输出格式
  const mathLiveRegex = /\\begin\{math\}(.*?)\\end\{math\}/gs;
  processedContent = processedContent.replace(mathLiveRegex, '$$$1$$');
  
  // 2. 处理分段函数 - 将包含array环境的行内公式转换为块级公式
  const piecewiseFunctionRegex = /\\\(([^)]*\\begin\{array\}[^)]*\\end\{array\}[^)]*)\\\)/gs;
  processedContent = processedContent.replace(piecewiseFunctionRegex, (match, content) => {
    // 分段函数使用块级公式显示
    return `$$${content}$$`;
  });
  
  // 3. 处理其他复杂公式 - 包含多行或复杂结构的行内公式
  const complexFormulaRegex = /\\\(([^)]*\\begin\{[^}]*\}[^)]*\\end\{[^}]*\}[^)]*)\\\)/gs;
  processedContent = processedContent.replace(complexFormulaRegex, (match, content) => {
    // 复杂公式使用块级公式显示
    return `$$${content}$$`;
  });
  
  // 4. 处理普通行内公式 \(...\) 格式
  const inlineRegex = /\\\((.*?)\\\)/gs;
  processedContent = processedContent.replace(inlineRegex, '$$$1$');
  
  return processedContent;
};

// 测试用例
const testContent = `函数 \\( f(x) = \\left\\{ \\begin{array}{ll}f(x + 1), & x\\leqslant 0,\\\\ 2x - 3, & x > 0, \\end{array} \\right\\) ，我们现在要计算 \\( f(-2) \\) 的值，一起想想怎么做吧。`;

console.log('原始内容:');
console.log(testContent);
console.log('\n修复后处理结果:');
console.log(preprocessLatexFormats(testContent));
