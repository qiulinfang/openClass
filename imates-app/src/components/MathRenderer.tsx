import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { preprocessLatexFormats } from '../utils/latexPreprocess';

interface MathRendererProps {
  content: string;
  markdownStyle?: any;
  textColor?: string;
}

// 针对 iOS / Android 原生 Webview 测量高度的全局静态缓存，防止 List 向上滚动抖动
const heightCache = new Map<string, number>();

/**
 * 动态加载 Web 端的 KaTeX 与 Marked CDN 资源 (Web 平台专用)
 */
function loadWebScripts() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. KaTeX CSS
  if (!document.getElementById('katex-css')) {
    const link = document.createElement('link');
    link.id = 'katex-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
    document.head.appendChild(link);
  }

  // 2. KaTeX Core JS
  if (!(window as any).katex && !document.getElementById('katex-js')) {
    const script = document.createElement('script');
    script.id = 'katex-js';
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
    document.head.appendChild(script);
  }

  // 3. Marked JS
  if (!(window as any).marked && !document.getElementById('marked-js')) {
    const script = document.createElement('script');
    script.id = 'marked-js';
    script.src = 'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js';
    document.head.appendChild(script);
  }
}

/**
 * Web 端强效 Markdown 与 KaTeX 占位符解析渲染管线
 * 先提取 LaTeX 公式到纯字母占位符 (MATHPHX...XID)，防止 Marked 误将公式下划线 _ 识别为 <em> 标签
 */
function renderMarkdownWithMathHtmlWeb(contentStr: string): string {
  if (!contentStr) return '';

  const preprocessed = preprocessLatexFormats(contentStr);

  const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[\s\S]*?\$|\\\([\s\S]*?\\\))/g;
  const mathStore: { id: string; math: string; isInline: boolean }[] = [];

  const textWithPlaceholders = preprocessed.replace(mathRegex, (match) => {
    let math = match;
    let isInline = true;

    if (match.startsWith('$$') && match.endsWith('$$')) {
      math = match.slice(2, -2).trim();
      isInline = false;
    } else if (match.startsWith('\\[') && match.endsWith('\\]')) {
      math = match.slice(2, -2).trim();
      isInline = false;
    } else if (match.startsWith('$') && match.endsWith('$')) {
      math = match.slice(1, -1).trim();
      isInline = true;
    } else if (match.startsWith('\\(') && match.endsWith('\\)')) {
      math = match.slice(2, -2).trim();
      isInline = true;
    }

    const placeholderId = `MATHPHX${mathStore.length}XID`;
    mathStore.push({ id: placeholderId, math, isInline });
    return placeholderId;
  });

  const marked = (typeof window !== 'undefined' && (window as any).marked) || null;
  let parsedHtml = marked ? marked.parse(textWithPlaceholders) : textWithPlaceholders;

  const katex = (typeof window !== 'undefined' && (window as any).katex) || null;

  mathStore.forEach((item) => {
    let mathHtml = '';
    if (katex) {
      try {
        const renderedMath = katex.renderToString(item.math, {
          displayMode: !item.isInline,
          throwOnError: false,
        });
        mathHtml = item.isInline
          ? `<span class="math-inline" style="display:inline-block;margin:0 2px;vertical-align:middle;">${renderedMath}</span>`
          : `<div class="math-block" style="display:block;margin:12px 0;text-align:center;">${renderedMath}</div>`;
      } catch {
        mathHtml = `<span>${item.math}</span>`;
      }
    } else {
      mathHtml = `<span>$${item.math}$</span>`;
    }

    parsedHtml = parsedHtml.split(item.id).join(mathHtml);
  });

  return parsedHtml;
}

/**
 * 统一跨平台 Universal MathRenderer 组件
 * Web 与 Native 原生双端统一采用 预处理器 + 占位符隔离 + Marked + KaTeX 引擎
 */
export function MathRenderer({ content, textColor = '#0F172A' }: MathRendererProps) {

  // ==================== 1. WEB 平台渲染 (Platform.OS === 'web') ====================
  if (Platform.OS === 'web') {
    const [isEngineReady, setIsEngineReady] = useState(false);

    useEffect(() => {
      loadWebScripts();
      const checkTimer = setInterval(() => {
        if ((window as any).katex && (window as any).marked) {
          setIsEngineReady(true);
          clearInterval(checkTimer);
        }
      }, 40);
      return () => clearInterval(checkTimer);
    }, []);

    const htmlContent = useMemo(() => {
      if (!content) return '';
      return renderMarkdownWithMathHtmlWeb(content || '');
    }, [content, isEngineReady]);

    return (
      <View style={styles.container}>
        <style>{`
          .math-rendered-content {
            display: block;
            width: 100%;
            color: ${textColor};
            font-size: 15px;
            line-height: 1.6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            word-break: break-word;
          }
          .math-rendered-content h1,
          .math-rendered-content h2,
          .math-rendered-content h3,
          .math-rendered-content h4 {
            margin-top: 14px;
            margin-bottom: 8px;
            font-weight: 600;
            line-height: 1.3;
            color: ${textColor};
          }
          .math-rendered-content h1 { font-size: 20px; }
          .math-rendered-content h2 { font-size: 18px; }
          .math-rendered-content h3 { font-size: 16px; }
          .math-rendered-content p {
            margin: 0 0 10px 0;
            line-height: 1.6;
          }
          .math-rendered-content ul,
          .math-rendered-content ol {
            margin: 6px 0 10px 0;
            padding-left: 22px;
          }
          .math-rendered-content li {
            margin-bottom: 4px;
            line-height: 1.6;
          }
          .math-rendered-content .katex-display {
            margin: 12px 0 !important;
            text-align: center;
          }
          .math-rendered-content img {
            max-width: 100% !important;
            max-height: 400px !important;
            object-fit: contain !important;
            height: auto !important;
            display: block;
            margin: 8px auto;
            border-radius: 6px;
          }
        `}</style>
        <div
          className="math-rendered-content"
          dangerouslySetInnerHTML={{ __html: htmlContent || content }}
        />
      </View>
    );
  }

  // ==================== 2. NATIVE 原生平台渲染 (iOS / Android WebView) ====================
  const cacheKey = content || '';
  const initialHeight = heightCache.get(cacheKey) || 40;
  const [webViewHeight, setWebViewHeight] = useState(initialHeight);
  const webViewRef = useRef<WebView>(null);

  const htmlContent = useMemo(() => {
    const preprocessedContent = preprocessLatexFormats(content || '');
    const rawJsonContent = JSON.stringify(preprocessedContent);

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"></script>
        <style>
          * { box-sizing: border-box; }
          html, body {
            width: 100% !important;
            margin: 0;
            padding: 2px 4px;
            background-color: transparent;
            color: ${textColor};
            font-size: 15px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            word-break: break-word;
            overflow-wrap: break-word;
            overflow: hidden;
          }
          #content-container {
            width: 100% !important;
            box-sizing: border-box;
          }
          h1, h2, h3, h4, h5, h6 {
            margin-top: 14px;
            margin-bottom: 8px;
            font-weight: 600;
            line-height: 1.3;
          }
          h1 { font-size: 20px; }
          h2 { font-size: 18px; }
          h3 { font-size: 16px; }
          p {
            margin: 0 0 10px 0;
            line-height: 1.6;
          }
          ul, ol {
            margin: 6px 0 10px 0;
            padding-left: 22px;
          }
          li {
            margin-bottom: 4px;
            line-height: 1.6;
          }
          .katex-display {
            margin: 12px 0 !important;
            text-align: center;
          }
          img {
            max-width: 100% !important;
            max-height: 400px !important;
            object-fit: contain !important;
            height: auto !important;
            display: block;
            margin: 8px auto;
            border-radius: 6px;
          }
        </style>
      </head>
      <body>
        <div id="content-container"></div>
        <script>
          var rawContent = ${rawJsonContent};

          function reportHeight() {
            var height = document.documentElement.offsetHeight || document.body.scrollHeight || 40;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ height: height, done: true }));
            }
          }

          function renderMarkdownAndMath() {
            var container = document.getElementById('content-container');
            if (!container || !rawContent) return;

            // 1. 优先使用 Marked，未加载完时使用原始文本保障 100% 有字可看，决不断流空白
            var html = (typeof marked !== 'undefined') ? marked.parse(rawContent) : rawContent;
            container.innerHTML = html;
            reportHeight();

            // 2. KaTeX 自动检索替换公式
            if (typeof renderMathInElement !== 'undefined') {
              try {
                renderMathInElement(container, {
                  delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\\\(', right: '\\\\)', display: false },
                    { left: '\\\\[', right: '\\\\]', display: true }
                  ],
                  throwOnError: false
                });
                reportHeight();
              } catch (err) {}
            }
          }

          // 首次加载渲染
          renderMarkdownAndMath();

          // 如果 CDN 异步脚本后加载完成，触发二次重绘
          var retryCount = 0;
          var interval = setInterval(function() {
            retryCount++;
            renderMarkdownAndMath();
            if (retryCount >= 10 || (typeof marked !== 'undefined' && typeof renderMathInElement !== 'undefined')) {
              clearInterval(interval);
            }
          }, 100);
        </script>
      </body>
    </html>
  `;
  }, [content, textColor]);

  const source = useMemo(() => ({ html: htmlContent }), [htmlContent]);

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.height) {
        const calculatedHeight = Math.max(data.height + 6, 24);
        setWebViewHeight(calculatedHeight);
        heightCache.set(cacheKey, calculatedHeight);
      }
    } catch (e) {
      console.warn('[MathRenderer] WebView height measurement failed:', e);
    }
  };

  return (
    <View style={{ height: webViewHeight, width: '100%', alignSelf: 'stretch' }}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={source}
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

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  webView: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
    opacity: 0.99,
  },
  webViewContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
});
