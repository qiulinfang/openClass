import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { View } from 'react-native';
import type { FormulaHandwritingBoardHandle } from './FormulaHandwritingBoard';

interface FormulaHandwritingBoardProps {
  html: string;
  instanceKey: number;
  onMessage: (message: string) => void;
}

export const FormulaHandwritingBoard = forwardRef<
  FormulaHandwritingBoardHandle,
  FormulaHandwritingBoardProps
>(({ html, instanceKey, onMessage }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const sendCommand = (command: 'undo' | 'redo' | 'clear' | 'getDataUrl') => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ type: 'formulaBoardCommand', command }),
      '*'
    );
  };

  useImperativeHandle(ref, () => ({
    run: (command) => sendCommand(command),
    requestImage: () => sendCommand('getDataUrl'),
  }));

  useEffect(() => {
    const receiveMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message =
        typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      onMessageRef.current(message);
    };
    window.addEventListener('message', receiveMessage);
    return () => window.removeEventListener('message', receiveMessage);
  }, [instanceKey]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {React.createElement('iframe', {
        key: instanceKey,
        ref: iframeRef,
        srcDoc: html,
        title: '公式手写板',
        style: {
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
          background: '#F8FAFC',
        },
      })}
    </View>
  );
});

FormulaHandwritingBoard.displayName = 'FormulaHandwritingBoard';
