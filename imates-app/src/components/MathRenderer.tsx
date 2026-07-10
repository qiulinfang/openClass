import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import Markdown, { RenderRules } from 'react-native-markdown-display';
import { parseLaTeX } from '../utils/latexParser';

interface MathViewProps {
  math: string;
  isInline?: boolean;
}

export function MathView({ math, isInline = false }: MathViewProps) {
  const [webViewHeight, setWebViewHeight] = useState(isInline ? 24 : 45);
  const webViewRef = useRef<WebView>(null);

  // 预载 KaTeX 的离线/在线 HTML 模板
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        <style>
          body {
            margin: 0;
            padding: ${isInline ? '0px' : '4px 0px'};
            background-color: transparent;
            color: #cbd5e1; /* 对齐文本浅灰色 */
            font-size: 15px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: ${isInline ? 'inline-block' : 'block'};
            text-align: ${isInline ? 'left' : 'center'};
            overflow: hidden;
          }
          #math-container {
            display: ${isInline ? 'inline-block' : 'block'};
            white-space: ${isInline ? 'nowrap' : 'normal'};
          }
        </style>
      </head>
      <body>
        <div id="math-container"></div>
        <script>
          try {
            const container = document.getElementById('math-container');
            const mathString = ${JSON.stringify(math)};
            katex.render(mathString, container, {
              displayMode: ${!isInline},
              throwOnError: false
            });
            
            // 延时测算实际高度并向 React Native 通信
            setTimeout(() => {
              const height = document.documentElement.offsetHeight || document.body.scrollHeight;
              window.ReactNativeWebView.postMessage(JSON.stringify({ height }));
            }, 60);
          } catch (e) {
            document.body.innerText = e.message;
          }
        </script>
      </body>
    </html>
  `;

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.height) {
        const adjustedHeight = Math.max(data.height, isInline ? 20 : 35);
        setWebViewHeight(adjustedHeight);
      }
    } catch (e) {
      console.warn('[MathView] 接收 WebView 高度测量失败:', e);
    }
  };

  return (
    <View style={[
      isInline ? styles.inlineContainer : styles.blockContainer,
      { height: webViewHeight }
    ]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={onMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.webView}
        containerStyle={styles.webViewContainer}
      />
    </View>
  );
}

interface HTMLMathRendererProps {
  content: string;
  textColor?: string;
}

export function HTMLMathRenderer({ content, textColor = '#cbd5e1' }: HTMLMathRendererProps) {
  const [webViewHeight, setWebViewHeight] = useState(60);
  const webViewRef = useRef<WebView>(null);

  // 预载 KaTeX 及自动渲染脚本的 HTML 模板，支持 HTML 标签（如 p, span, img, table 等）
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
        <style>
          body {
            margin: 0;
            padding: 4px;
            background-color: transparent;
            color: ${textColor};
            font-size: 15px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
          }
          img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10px 0;
            border-radius: 6px;
          }
          p {
            margin: 0 0 12px 0;
          }
          .fill-blank-underscore {
            display: inline-block;
            border-bottom: 2px solid ${textColor};
            width: 60px;
            height: 18px;
            vertical-align: middle;
            margin: 0 4px;
          }
          .ocr-image-wrapper {
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div id="content-container">${content}</div>
        <script>
          try {
            const container = document.getElementById('content-container');
            
            // 自动扫描渲染 LaTeX 块
            renderMathInElement(container, {
              delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "\\\\[", right: "\\\\]", display: true},
                {left: "$", right: "$", display: false},
                {left: "\\\\(", right: "\\\\)", display: false}
              ],
              throwOnError: false
            });

            // 反馈高宽变化测量
            const reportHeight = () => {
              const height = document.documentElement.offsetHeight || document.body.scrollHeight;
              window.ReactNativeWebView.postMessage(JSON.stringify({ height }));
            };

            setTimeout(reportHeight, 100);

            // 监听图片加载完毕更新高度，解决图片没加载好测量高度太小被截断的 Bug
            const imgs = document.getElementsByTagName('img');
            for (let i = 0; i < imgs.length; i++) {
              imgs[i].onload = reportHeight;
            }
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.message }));
          }
        </script>
      </body>
    </html>
  `;

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.height) {
        setWebViewHeight(data.height + 15);
      }
    } catch (e) {
      console.warn('[HTMLMathRenderer] WebView 高度消息解析失败:', e);
    }
  };

  return (
    <View style={{ height: webViewHeight, width: '100%' }}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={onMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.webView}
        containerStyle={styles.webViewContainer}
      />
    </View>
  );
}

interface MathRendererProps {
  content: string;
  markdownStyle?: any;
  textColor?: string;
}

export function MathRenderer({ content, markdownStyle, textColor }: MathRendererProps) {
  // 检测内容中是否含有 HTML 标签特性，有的话走富文本渲染通道
  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  if (isHtml) {
    return <HTMLMathRenderer content={content} textColor={textColor} />;
  }

  // 定义自定义 Markdown 渲染规则
  // 通过拦截 text 节点渲染公式，保证 Markdown 本身的语法树（如表格、列表）完整不被打乱
  const rules: RenderRules = {
    text: (node, children, parent, styles) => {
      const textContent = node.content;
      const blocks = parseLaTeX(textContent);

      const hasMath = blocks.some(b => b.type === 'math');
      if (!hasMath) {
        return (
          <Text key={node.key} style={styles.text}>
            {textContent}
          </Text>
        );
      }

      // 如果包含公式，以包裹的 View 形式渲染，避免 WebView 嵌套在 Text 中崩溃
      return (
        <View key={node.key} style={styles.inlineWrap}>
          {blocks.map((block, idx) => {
            if (block.type === 'math') {
              return (
                <MathView 
                  key={idx} 
                  math={block.content} 
                  isInline={block.isInline} 
                />
              );
            } else {
              return (
                <Text key={idx} style={styles.text}>
                  {block.content}
                </Text>
              );
            }
          })}
        </View>
      );
    }
  };

  // 双重转义 \( \) 和 \[ \]，防止 markdown-it 解析器将反斜杠当作 Markdown 转义字符吞掉
  const escapedContent = content
    .replace(/\\\(/g, '\\\\(')
    .replace(/\\\)/g, '\\\\)')
    .replace(/\\\[/g, '\\\\[')
    .replace(/\\\]/g, '\\\\]');

  return (
    <Markdown rules={rules} style={markdownStyle}>
      {escapedContent}
    </Markdown>
  );
}

const styles = StyleSheet.create({
  inlineContainer: {
    display: 'flex',
    minWidth: 40,
    alignSelf: 'center',
    marginHorizontal: 2,
  },
  blockContainer: {
    width: '100%',
    marginVertical: 6,
    alignSelf: 'stretch',
  },
  webView: {
    backgroundColor: 'transparent',
    opacity: 0.99, // 绕过安卓硬件加速白屏问题
  },
  webViewContainer: {
    backgroundColor: 'transparent',
  },
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  }
});
