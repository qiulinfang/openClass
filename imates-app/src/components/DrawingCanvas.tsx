import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

export interface DrawingCanvasProps {
  style?: any;
}

export function DrawingCanvas({ style }: DrawingCanvasProps) {
  const [currentColor, setCurrentColor] = useState<string>('#000000');
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const webViewRef = useRef<WebView>(null);
  const webCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Web 端 HTML5 绘图逻辑
  const isDrawingWeb = useRef<boolean>(false);
  const pathsWeb = useRef<Array<{ color: string; width: number; points: Array<{ x: number; y: number }> }>>([]);
  const currentPointsWeb = useRef<Array<{ x: number; y: number }>>([]);

  const drawWebCanvas = () => {
    if (Platform.OS !== 'web' || !webCanvasRef.current) return;
    const canvas = webCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width || 600;
      canvas.height = rect.height || 400;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 网格线
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 已有路径
    pathsWeb.current.forEach((p) => {
      if (p.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      ctx.stroke();
    });

    // 正在画的路径
    if (currentPointsWeb.current.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = isEraser ? '#FAFAFA' : currentColor;
      ctx.lineWidth = isEraser ? 16 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(currentPointsWeb.current[0].x, currentPointsWeb.current[0].y);
      for (let i = 1; i < currentPointsWeb.current.length; i++) {
        ctx.lineTo(currentPointsWeb.current[i].x, currentPointsWeb.current[i].y);
      }
      ctx.stroke();
    }
  };

  const handleWebStart = (e: any) => {
    if (Platform.OS !== 'web' || !webCanvasRef.current) return;
    const rect = webCanvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    isDrawingWeb.current = true;
    currentPointsWeb.current = [{ x, y }];
    drawWebCanvas();
  };

  const handleWebMove = (e: any) => {
    if (Platform.OS !== 'web' || !isDrawingWeb.current || !webCanvasRef.current) return;
    const rect = webCanvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    currentPointsWeb.current.push({ x, y });
    drawWebCanvas();
  };

  const handleWebEnd = () => {
    if (Platform.OS !== 'web' || !isDrawingWeb.current) return;
    isDrawingWeb.current = false;
    if (currentPointsWeb.current.length > 0) {
      pathsWeb.current.push({
        color: isEraser ? '#FAFAFA' : currentColor,
        width: isEraser ? 16 : 3,
        points: [...currentPointsWeb.current],
      });
      currentPointsWeb.current = [];
      drawWebCanvas();
    }
  };

  // WebView 内部 HTML 绘图代码 (针对手机 iOS/Android)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; touch-action: none; }
          html, body { width: 100%; height: 100%; overflow: hidden; background: #FAFAFA; }
          canvas { width: 100%; height: 100%; display: block; background: #FAFAFA; }
        </style>
      </head>
      <body>
        <canvas id="c"></canvas>
        <script>
          const canvas = document.getElementById('c');
          const ctx = canvas.getContext('2d');
          let currentColor = '${currentColor}';
          let isEraser = ${isEraser};
          let isDrawing = false;
          let paths = [];
          let currentPoints = [];

          function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            redraw();
          }
          window.addEventListener('resize', resize);

          function redraw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 画网格线
            ctx.strokeStyle = '#F1F5F9';
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 20) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, canvas.height);
              ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += 20) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(canvas.width, y);
              ctx.stroke();
            }

            // 绘制已保存笔迹
            paths.forEach(p => {
              if (p.points.length < 2) return;
              ctx.beginPath();
              ctx.strokeStyle = p.color;
              ctx.lineWidth = p.width;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.moveTo(p.points[0].x, p.points[0].y);
              for (let i = 1; i < p.points.length; i++) {
                ctx.lineTo(p.points[i].x, p.points[i].y);
              }
              ctx.stroke();
            });

            // 绘制正在画笔迹
            if (currentPoints.length >= 2) {
              ctx.beginPath();
              ctx.strokeStyle = isEraser ? '#FAFAFA' : currentColor;
              ctx.lineWidth = isEraser ? 16 : 3;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
              for (let i = 1; i < currentPoints.length; i++) {
                ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
              }
              ctx.stroke();
            }
          }

          function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            return {
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top
            };
          }

          function start(e) {
            e.preventDefault();
            isDrawing = true;
            currentPoints = [getPos(e)];
            redraw();
          }

          function move(e) {
            if (!isDrawing) return;
            e.preventDefault();
            currentPoints.push(getPos(e));
            redraw();
          }

          function stop() {
            if (!isDrawing) return;
            isDrawing = false;
            if (currentPoints.length > 0) {
              paths.push({
                color: isEraser ? '#FAFAFA' : currentColor,
                width: isEraser ? 16 : 3,
                points: currentPoints
              });
              currentPoints = [];
              redraw();
            }
          }

          canvas.addEventListener('mousedown', start);
          canvas.addEventListener('mousemove', move);
          canvas.addEventListener('mouseup', stop);
          canvas.addEventListener('mouseleave', stop);

          canvas.addEventListener('touchstart', start, { passive: false });
          canvas.addEventListener('touchmove', move, { passive: false });
          canvas.addEventListener('touchend', stop);

          window.addEventListener('message', function(e) {
            try {
              const msg = JSON.parse(e.data);
              if (msg.type === 'SET_COLOR') {
                currentColor = msg.color;
                isEraser = false;
              } else if (msg.type === 'SET_ERASER') {
                isEraser = msg.isEraser;
              } else if (msg.type === 'CLEAR') {
                paths = [];
                currentPoints = [];
                redraw();
              } else if (msg.type === 'UNDO') {
                paths.pop();
                redraw();
              }
            } catch(err){}
          });

          setTimeout(resize, 100);
        </script>
      </body>
    </html>
  `;

  const sendWebviewMessage = (msg: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(msg));
    }
  };

  const handleColorChange = (c: string) => {
    setIsEraser(false);
    setCurrentColor(c);
    if (Platform.OS !== 'web') {
      sendWebviewMessage({ type: 'SET_COLOR', color: c });
    } else {
      drawWebCanvas();
    }
  };

  const handleEraserToggle = () => {
    const next = !isEraser;
    setIsEraser(next);
    if (Platform.OS !== 'web') {
      sendWebviewMessage({ type: 'SET_ERASER', isEraser: next });
    } else {
      drawWebCanvas();
    }
  };

  const handleClear = () => {
    if (Platform.OS !== 'web') {
      sendWebviewMessage({ type: 'CLEAR' });
    } else {
      pathsWeb.current = [];
      currentPointsWeb.current = [];
      drawWebCanvas();
    }
  };

  const handleUndo = () => {
    if (Platform.OS !== 'web') {
      sendWebviewMessage({ type: 'UNDO' });
    } else {
      pathsWeb.current.pop();
      drawWebCanvas();
    }
  };

  return (
    <View style={[styles.canvasContainer, style]}>
      {/* 顶部画板控制工具栏 */}
      <View style={styles.toolbar}>
        <View style={styles.toolsGroup} />

        <View style={styles.toolsGroup}>
          <TouchableOpacity
            style={[styles.toolBtn, isEraser && styles.activeToolBtn]}
            onPress={handleEraserToggle}
          >
            <Text style={[styles.toolBtnText, isEraser && styles.activeToolBtnText]}>
              橡皮
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolBtn} onPress={handleUndo}>
            <Text style={styles.toolBtnText}>撤销</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.toolBtn, styles.clearBtn]} onPress={handleClear}>
            <Text style={[styles.toolBtnText, styles.clearBtnText]}>清空</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 画板绘制区域 */}
      <View style={styles.viewport}>
        {Platform.OS === 'web' ? (
          <canvas
            ref={webCanvasRef}
            style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
            onMouseDown={handleWebStart}
            onMouseMove={handleWebMove}
            onMouseUp={handleWebEnd}
            onMouseLeave={handleWebEnd}
            onTouchStart={handleWebStart}
            onTouchMove={handleWebMove}
            onTouchEnd={handleWebEnd}
          />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            scrollEnabled={false}
            bounces={false}
            style={{ flex: 1, backgroundColor: 'transparent' }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeColorDot: {
    borderColor: '#0F172A',
    transform: [{ scale: 1.15 }],
  },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  activeToolBtn: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  toolBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  activeToolBtnText: {
    color: '#FFFFFF',
  },
  clearBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  clearBtnText: {
    color: '#EF4444',
  },
  viewport: {
    flex: 1,
    minHeight: 240,
    backgroundColor: '#FAFAFA',
    position: 'relative',
  },
});
