export interface ContentBlock {
  type: 'text' | 'math';
  content: string;
  isInline?: boolean;
}

export function parseLaTeX(text: string): ContentBlock[] {
  if (!text) return [];

  const blocks: ContentBlock[] = [];
  // 正则匹配：
  // $$ ... $$ 或 \[ ... \] (块级公式)
  // $ ... $ 或 \( ... \) (行内公式)
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[\s\S]*?\$|\\\([\s\S]*?\\\))/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchedText = match[0];

    // 添加公式前的普通文本块
    if (matchIndex > lastIndex) {
      const textVal = text.substring(lastIndex, matchIndex);
      if (textVal) {
        blocks.push({ type: 'text', content: textVal });
      }
    }

    // 提取公式核心内容并移除分隔符
    let content = matchedText;
    let isInline = true;

    if (matchedText.startsWith('$$') && matchedText.endsWith('$$')) {
      content = matchedText.slice(2, -2).trim();
      isInline = false;
    } else if (matchedText.startsWith('\\[') && matchedText.endsWith('\\]')) {
      content = matchedText.slice(2, -2).trim();
      isInline = false;
    } else if (matchedText.startsWith('$') && matchedText.endsWith('$')) {
      content = matchedText.slice(1, -1).trim();
      isInline = true;
    } else if (matchedText.startsWith('\\(') && matchedText.endsWith('\\)')) {
      content = matchedText.slice(2, -2).trim();
      isInline = true;
    }

    blocks.push({ type: 'math', content, isInline });
    lastIndex = regex.lastIndex;
  }

  // 添加公式后的尾部文本块
  if (lastIndex < text.length) {
    const textVal = text.substring(lastIndex);
    if (textVal) {
      blocks.push({ type: 'text', content: textVal });
    }
  }

  return blocks;
}
