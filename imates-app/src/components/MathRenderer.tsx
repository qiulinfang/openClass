import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import Markdown from 'react-native-markdown-display';
import { parseLaTeX, ContentBlock } from '../utils/latexParser';

interface MathRendererProps {
  content: string;
  markdownStyle?: any; // Keep prop compatibility
  textColor?: string;
}

export function MathRenderer({ content, markdownStyle, textColor = '#0F172A' }: MathRendererProps) {
  // Parse the content into text and math blocks
  const blocks = parseLaTeX(content || '');
  const hasMath = blocks.some(b => b.type === 'math');

  // Performance optimization: If there is no LaTeX, render using native Markdown (highly efficient for lists)
  if (!hasMath) {
    const combinedStyle = {
      body: {
        color: textColor,
        fontSize: 15,
        lineHeight: 22,
      },
      ...markdownStyle,
    };
    return (
      <Markdown style={combinedStyle}>
        {content || ''}
      </Markdown>
    );
  }

  const [webViewHeight, setWebViewHeight] = useState(40);
  const webViewRef = useRef<WebView>(null);

  // Pre-load KaTeX and Marked JS templates
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"></script>
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
            display: inline;
          }
          /* Ensure paragraphs created by marked inside our inline flows don't force blocks */
          .inline-container p {
            display: inline;
            margin: 0;
          }
          .math-inline {
            display: inline-block;
            margin: 0 4px;
            vertical-align: middle;
          }
          .math-block {
            display: block;
            margin: 12px 0;
            text-align: center;
          }
          ul, ol {
            margin: 8px 0;
            padding-left: 20px;
          }
          li {
            margin-bottom: 4px;
          }
          .fill-blank-underscore {
            display: inline-block;
            border-bottom: 2px solid ${textColor};
            width: 60px;
            height: 18px;
            vertical-align: middle;
            margin: 0 4px;
          }
        </style>
      </head>
      <body>
        <div id="content-container"></div>
        <script>
          function escapeHtml(text) {
            return text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
          }

          function startRender() {
            try {
              const blocks = ${JSON.stringify(blocks)};
              const container = document.getElementById('content-container');
              
              let html = '';
              blocks.forEach(block => {
                if (block.type === 'math') {
                  const escapedMath = escapeHtml(block.content);
                  if (block.isInline) {
                    html += '<span class="math-inline" data-math="' + escapedMath + '"></span>';
                  } else {
                    html += '<div class="math-block" data-math="' + escapedMath + '"></div>';
                  }
                } else {
                  // If it is text/markdown
                  if (typeof marked !== 'undefined') {
                    // marked.parse wrapped paragraphs can break inline math flow,
                    // so we wrap in inline-container to set them display: inline.
                    html += '<span class="inline-container">' + marked.parse(block.content) + '</span>';
                  } else {
                    html += '<span>' + escapeHtml(block.content) + '</span>';
                  }
                }
              });
              
              container.innerHTML = html;

              // Render LaTeX formulas
              if (typeof katex !== 'undefined') {
                document.querySelectorAll('.math-inline').forEach(el => {
                  const mathContent = el.getAttribute('data-math');
                  try {
                    katex.render(mathContent, el, {
                      displayMode: false,
                      throwOnError: false
                    });
                  } catch (err) {
                    el.innerText = mathContent;
                  }
                });

                document.querySelectorAll('.math-block').forEach(el => {
                  const mathContent = el.getAttribute('data-math');
                  try {
                    katex.render(mathContent, el, {
                      displayMode: true,
                      throwOnError: false
                    });
                  } catch (err) {
                    el.innerText = mathContent;
                  }
                });
              }

              // Report actual height back to React Native
              const reportHeight = () => {
                const height = document.documentElement.offsetHeight || document.body.scrollHeight;
                window.ReactNativeWebView.postMessage(JSON.stringify({ height }));
              };

              reportHeight();
              setTimeout(reportHeight, 50);
              setTimeout(reportHeight, 150);

              // Re-report height when images load
              const imgs = document.getElementsByTagName('img');
              for (let i = 0; i < imgs.length; i++) {
                imgs[i].onload = reportHeight;
              }
            } catch (e) {
              const fallbackHeight = document.documentElement.offsetHeight || document.body.scrollHeight || 60;
              window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.message, height: fallbackHeight }));
            }
          }

          // Polling check for script loads (essential when multiple WebViews load concurrently in lists)
          function checkAndRender() {
            if (typeof marked !== 'undefined' && typeof katex !== 'undefined') {
              startRender();
            } else {
              setTimeout(checkAndRender, 30);
            }
          }

          if (document.readyState === 'complete') {
            checkAndRender();
          } else {
            window.addEventListener('load', checkAndRender);
          }
        </script>
      </body>
    </html>
  `;

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.height) {
        setWebViewHeight(data.height + 8);
      }
    } catch (e) {
      console.warn('[MathRenderer] WebView height measurement failed:', e);
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
        webviewDebuggingEnabled={__DEV__}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
    opacity: 0.99, // Avoid Android white screen bugs on hardware acceleration
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

