import { Alert, Platform } from 'react-native';

/**
 * 跨端 Confirm 确认对话框助手 (解决 Web 模式下 Alert.alert 回调不触发导致无反应问题)
 */
export function showConfirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  cancelText = '取消',
  confirmText = '确定'
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok) {
        onConfirm();
      }
    } else {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel' },
      { text: confirmText, onPress: onConfirm },
    ]);
  }
}

/**
 * 跨端 Alert 提示通知对话框助手 (解决 Web 模式下 Alert.alert 无响应问题)
 */
export function showNoticeDialog(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    Alert.alert(title, message);
  }
}

/**
 * 漏答确认对话框助手
 */
export function showIncompleteConfirmDialog(
  incompleteNumbers: number[],
  onPerformSubmit: () => void,
  onGoAnswer: (firstUnansweredIndex: number) => void
) {
  const firstUnansweredIndex = incompleteNumbers[0] - 1;
  const msg = `您还有 ${incompleteNumbers.length} 道题未作答（第 ${incompleteNumbers.slice(0, 5).join('、')}${incompleteNumbers.length > 5 ? '...' : ''} 题），确定要提交吗？`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(`确认提交\n\n${msg}\n\n点击【确定】仍然提交，点击【取消】去作答`);
      if (ok) {
        onPerformSubmit();
      } else {
        onGoAnswer(firstUnansweredIndex);
      }
    } else {
      onPerformSubmit();
    }
  } else {
    Alert.alert(
      '确认提交',
      msg,
      [
        {
          text: '去作答',
          style: 'cancel',
          onPress: () => onGoAnswer(firstUnansweredIndex),
        },
        {
          text: '仍然提交',
          style: 'destructive',
          onPress: onPerformSubmit,
        },
      ]
    );
  }
}
