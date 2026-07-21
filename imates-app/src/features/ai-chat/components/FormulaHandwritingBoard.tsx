import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface FormulaHandwritingBoardHandle {
  run: (command: 'undo' | 'redo' | 'clear') => void;
  requestImage: () => void;
}

interface FormulaHandwritingBoardProps {
  html: string;
  instanceKey: number;
  onMessage: (message: string) => void;
}

export const FormulaHandwritingBoard = forwardRef<
  FormulaHandwritingBoardHandle,
  FormulaHandwritingBoardProps
>(({ html, instanceKey, onMessage }, ref) => {
  const webViewRef = useRef<WebView>(null);

  const inject = (script: string) => {
    webViewRef.current?.injectJavaScript(`${script}; true;`);
  };

  useImperativeHandle(ref, () => ({
    run: (command) =>
      inject(`window.formulaBoard && window.formulaBoard.${command}()`),
    requestImage: () =>
      inject('window.formulaBoard && window.formulaBoard.getDataUrl()'),
  }));

  return (
    <WebView
      key={instanceKey}
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html }}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      style={styles.board}
      containerStyle={styles.board}
    />
  );
});

FormulaHandwritingBoard.displayName = 'FormulaHandwritingBoard';

const styles = StyleSheet.create({
  board: { flex: 1, backgroundColor: '#F8FAFC' },
});
