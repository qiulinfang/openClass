import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MathRenderer } from '@/components/MathRenderer';
import { FormulaRecognitionService } from '../services/formula-recognition-service';
import {
  FormulaHandwritingBoard,
  type FormulaHandwritingBoardHandle,
} from './FormulaHandwritingBoard';

interface FormulaInsertModalProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
}

interface BoardStateMessage {
  type: 'state';
  hasInk: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

interface BoardImageMessage {
  type: 'imageData';
  dataUrl: string;
}

// 与 Web 的 HighSchoolMathEditor 保持同一图标映射。
const undoIcon = require('../../../../assets/formula-redo.png');
const redoIcon = require('../../../../assets/formula-undo.png');
const clearIcon = require('../../../../assets/formula-clear.png');

const BOARD_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #f8fafc; }
    #board-wrap {
      width: 100%; height: 100%; position: relative; overflow: hidden;
      background-color: #f8fafc;
      background-image:
        linear-gradient(rgba(148,163,184,.18) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148,163,184,.18) 1px, transparent 1px);
      background-size: 22px 22px;
    }
    canvas { display: block; width: 100%; height: 100%; touch-action: none; }
  </style>
</head>
<body>
  <div id="board-wrap"><canvas id="board"></canvas></div>
  <script>
    (() => {
      const canvas = document.getElementById('board');
      const context = canvas.getContext('2d');
      let strokes = [];
      let redoStack = [];
      let currentStroke = null;
      let cssWidth = 1;
      let cssHeight = 1;

      const post = (payload) => {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        window.parent && window.parent !== window && window.parent.postMessage(JSON.stringify(payload), '*');
      };

      const drawStroke = (target, stroke, offsetX = 0, offsetY = 0, scale = 1) => {
        if (!stroke || !stroke.length) return;
        target.beginPath();
        target.strokeStyle = '#20243D';
        target.lineWidth = 4 * scale;
        target.lineCap = 'round';
        target.lineJoin = 'round';
        target.moveTo((stroke[0].x - offsetX) * scale, (stroke[0].y - offsetY) * scale);
        if (stroke.length === 1) {
          target.lineTo((stroke[0].x - offsetX + 0.1) * scale, (stroke[0].y - offsetY + 0.1) * scale);
        } else {
          for (let index = 1; index < stroke.length; index += 1) {
            target.lineTo((stroke[index].x - offsetX) * scale, (stroke[index].y - offsetY) * scale);
          }
        }
        target.stroke();
      };

      const redraw = () => {
        context.clearRect(0, 0, cssWidth, cssHeight);
        strokes.forEach((stroke) => drawStroke(context, stroke));
      };

      const reportState = () => post({
        type: 'state',
        hasInk: strokes.length > 0,
        canUndo: strokes.length > 0,
        canRedo: redoStack.length > 0,
      });

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        cssWidth = Math.max(1, rect.width);
        cssHeight = Math.max(1, rect.height);
        canvas.width = Math.round(cssWidth * ratio);
        canvas.height = Math.round(cssHeight * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        redraw();
      };

      const pointFromEvent = (event) => {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      };

      canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        currentStroke = [pointFromEvent(event)];
        strokes.push(currentStroke);
        redoStack = [];
        redraw();
        reportState();
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!currentStroke) return;
        event.preventDefault();
        currentStroke.push(pointFromEvent(event));
        redraw();
      });
      const finishStroke = (event) => {
        if (!currentStroke) return;
        event.preventDefault();
        currentStroke.push(pointFromEvent(event));
        currentStroke = null;
        redraw();
        reportState();
      };
      canvas.addEventListener('pointerup', finishStroke);
      canvas.addEventListener('pointercancel', finishStroke);

      window.formulaBoard = {
        undo() {
          if (!strokes.length) return;
          redoStack.push(strokes.pop());
          redraw();
          reportState();
        },
        redo() {
          if (!redoStack.length) return;
          strokes.push(redoStack.pop());
          redraw();
          reportState();
        },
        clear() {
          strokes = [];
          redoStack = [];
          currentStroke = null;
          redraw();
          reportState();
        },
        getDataUrl() {
          const points = strokes.flat();
          if (!points.length) {
            post({ type: 'imageData', dataUrl: '' });
            return;
          }
          const padding = 18;
          const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - padding);
          const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - padding);
          const maxX = Math.min(cssWidth, Math.max(...points.map((point) => point.x)) + padding);
          const maxY = Math.min(cssHeight, Math.max(...points.map((point) => point.y)) + padding);
          const scale = 2;
          const output = document.createElement('canvas');
          output.width = Math.max(2, Math.ceil((maxX - minX) * scale));
          output.height = Math.max(2, Math.ceil((maxY - minY) * scale));
          const outputContext = output.getContext('2d');
          outputContext.fillStyle = '#FFFFFF';
          outputContext.fillRect(0, 0, output.width, output.height);
          strokes.forEach((stroke) => drawStroke(outputContext, stroke, minX, minY, scale));
          post({ type: 'imageData', dataUrl: output.toDataURL('image/png') });
        },
      };

      window.addEventListener('message', (event) => {
        let message = event.data;
        try {
          if (typeof message === 'string') message = JSON.parse(message);
        } catch (_) {
          return;
        }
        if (!message || message.type !== 'formulaBoardCommand') return;
        const command = message.command;
        if (command && typeof window.formulaBoard[command] === 'function') {
          window.formulaBoard[command]();
        }
      });

      window.addEventListener('resize', resize);
      resize();
      reportState();
      post({ type: 'ready' });
    })();
  </script>
</body>
</html>`;

export function FormulaInsertModal({
  visible,
  onClose,
  onInsert,
}: FormulaInsertModalProps) {
  const boardRef = useRef<FormulaHandwritingBoardHandle>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [hasInk, setHasInk] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [formula, setFormula] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setBoardKey((current) => current + 1);
    setHasInk(false);
    setCanUndo(false);
    setCanRedo(false);
    setIsRecognizing(false);
    setFormula('');
    setError('');
  }, [visible]);

  const runBoardCommand = (command: 'undo' | 'redo' | 'clear') => {
    boardRef.current?.run(command);
    if (command === 'clear') {
      setFormula('');
      setError('');
    }
  };

  const requestRecognition = () => {
    if (!hasInk || isRecognizing) return;
    setIsRecognizing(true);
    setFormula('');
    setError('');
    boardRef.current?.requestImage();
  };

  const recognizeImage = async (dataUrl: string) => {
    if (!dataUrl) {
      setIsRecognizing(false);
      setError('手写内容为空，请重新书写');
      return;
    }
    try {
      const result = await FormulaRecognitionService.recognize(dataUrl);
      setFormula(result.latex);
    } catch (recognitionError) {
      setError(
        recognitionError instanceof Error
          ? recognitionError.message
          : '识别失败，请重试'
      );
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleBoardMessage = (raw: string) => {
    try {
      const message = JSON.parse(raw) as
        | BoardStateMessage
        | BoardImageMessage
        | { type: 'ready' };
      if (message.type === 'state') {
        setHasInk(message.hasInk);
        setCanUndo(message.canUndo);
        setCanRedo(message.canRedo);
      } else if (message.type === 'imageData') {
        void recognizeImage(message.dataUrl);
      }
    } catch {
      setError('手写板数据读取失败，请重新打开');
    }
  };

  const handleInsert = () => {
    const latex = formula.trim();
    if (!latex) return;
    onInsert(latex);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="关闭公式编辑器"
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>公式编辑</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="关闭公式编辑器"
            >
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>手写区</Text>
              <Text style={styles.sectionHint}>请在方格内书写数学公式</Text>
            </View>
            <View style={styles.boardCard}>
            <FormulaHandwritingBoard
              ref={boardRef}
              instanceKey={boardKey}
              html={BOARD_HTML}
              onMessage={handleBoardMessage}
            />
            <View style={styles.boardToolbar}>
              <TouchableOpacity
                style={styles.boardToolButton}
                onPress={() => runBoardCommand('undo')}
                disabled={!canUndo || isRecognizing}
                accessibilityLabel="撤销手写"
              >
                <Image
                  source={undoIcon}
                  style={[
                    styles.boardToolIcon,
                    (!canUndo || isRecognizing) && styles.disabledIcon,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.boardToolButton}
                onPress={() => runBoardCommand('redo')}
                disabled={!canRedo || isRecognizing}
                accessibilityLabel="重做手写"
              >
                <Image
                  source={redoIcon}
                  style={[
                    styles.boardToolIcon,
                    (!canRedo || isRecognizing) && styles.disabledIcon,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.boardToolButton}
                onPress={() => runBoardCommand('clear')}
                disabled={!hasInk || isRecognizing}
                accessibilityLabel="清空手写"
              >
                <Image
                  source={clearIcon}
                  style={[
                    styles.boardToolIcon,
                    styles.clearToolIcon,
                    (!hasInk || isRecognizing) && styles.disabledIcon,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recognizeButton,
                  (!hasInk || isRecognizing) &&
                    styles.recognizeButtonDisabled,
                ]}
                onPress={requestRecognition}
                disabled={!hasInk || isRecognizing}
                accessibilityRole="button"
              >
                {isRecognizing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : null}
                <Text
                  style={[
                    styles.recognizeText,
                    (!hasInk || isRecognizing) &&
                      !isRecognizing &&
                      styles.recognizeTextDisabled,
                  ]}
                >
                  {isRecognizing ? '识别中…' : '识别公式'}
                </Text>
              </TouchableOpacity>
            </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>识别区</Text>
            </View>
            <View style={styles.recognitionCard}>
            {isRecognizing ? (
              <View style={styles.centerState}>
                <ActivityIndicator color="#7C3AED" />
                <Text style={styles.loadingText}>正在识别中…</Text>
              </View>
            ) : formula ? (
              <View style={styles.formulaPreview}>
                <MathRenderer content={`$${formula}$`} textColor="#1E293B" />
              </View>
            ) : (
              <View style={styles.centerState}>
                <Text style={styles.placeholderText}>
                  点击你想要的公式就可以啦
                </Text>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.insertButton,
                !formula && styles.insertButtonDisabled,
              ]}
              onPress={handleInsert}
              disabled={!formula}
              accessibilityRole="button"
              accessibilityLabel="插入公式"
            >
              <Text style={styles.insertText}>插入</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(25, 27, 43, 0.42)',
  },
  dismissArea: { flex: 1 },
  sheet: {
    maxHeight: '94%',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    width: 42,
    height: 5,
    marginTop: 9,
    marginBottom: 7,
    alignSelf: 'center',
    borderRadius: 3,
    backgroundColor: '#D9DBE5',
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '900', color: '#20243D' },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F3F3F8',
  },
  closeText: { marginTop: -2, fontSize: 26, color: '#686D80' },
  bodyScroll: { flexShrink: 1 },
  bodyContent: { paddingBottom: 2 },
  sectionHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#4E5368' },
  sectionHint: { fontSize: 10, color: '#9196A8' },
  boardCard: {
    height: 258,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  boardToolbar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 50,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EAF0',
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    shadowColor: '#25304B',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  boardToolButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardToolIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    opacity: 0.6,
  },
  clearToolIcon: { tintColor: '#EF4444' },
  disabledIcon: { opacity: 0.2 },
  recognizeButton: {
    flex: 1,
    minHeight: 38,
    marginLeft: 5,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#7C3AED',
  },
  recognizeButtonDisabled: { backgroundColor: '#E2E8F0' },
  recognizeText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recognizeTextDisabled: { color: '#94A3B8' },
  recognitionCard: {
    minHeight: 106,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  centerState: {
    flex: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loadingText: { marginTop: 8, fontSize: 12, color: '#64748B' },
  placeholderText: { fontSize: 13, color: '#94A3B8' },
  errorText: {
    marginTop: 8,
    fontSize: 11,
    textAlign: 'center',
    color: '#EF4444',
  },
  formulaPreview: {
    minHeight: 104,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  footer: { paddingTop: 14, flexDirection: 'row' },
  cancelButton: {
    minWidth: 88,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DADCE7',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  cancelText: { fontSize: 14, fontWeight: '800', color: '#5F6478' },
  insertButton: {
    flex: 1,
    minHeight: 48,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#6256D9',
  },
  insertButtonDisabled: { opacity: 0.38 },
  insertText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
});
