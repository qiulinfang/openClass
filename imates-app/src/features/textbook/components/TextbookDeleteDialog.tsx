import React, { memo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MotionPressable } from './TextbookMotion';

interface TextbookDeleteDialogProps {
  deleting: boolean;
  reduceMotion: boolean;
  textbookName: string;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const TextbookDeleteDialog = memo(function TextbookDeleteDialog({
  deleting,
  reduceMotion,
  textbookName,
  visible,
  onCancel,
  onConfirm,
}: TextbookDeleteDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={deleting ? undefined : onCancel}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={deleting ? undefined : onCancel}
          accessible={false}
        />
        <View
          style={styles.dialog}
          accessibilityViewIsModal
          accessibilityRole="alert"
          accessibilityLabel={`删除《${textbookName}》本地资料`}
        >
          <View style={styles.dangerMark}>
            <Text style={styles.dangerMarkText}>!</Text>
          </View>
          <Text style={styles.title}>删除本地资料？</Text>
          <Text style={styles.description}>
            《{textbookName}》的下载文件将从当前设备移除，之后需要重新下载才能离线学习。
          </Text>
          <View style={styles.actions}>
            <MotionPressable
              style={[styles.action, styles.cancelAction]}
              onPress={onCancel}
              disabled={deleting}
              reduceMotion={reduceMotion}
              accessibilityRole="button"
              accessibilityLabel="取消删除"
            >
              <Text style={styles.cancelText}>取消</Text>
            </MotionPressable>
            <MotionPressable
              style={[styles.action, styles.deleteAction]}
              onPress={onConfirm}
              disabled={deleting}
              reduceMotion={reduceMotion}
              accessibilityRole="button"
              accessibilityLabel={`确认删除${textbookName}本地资料`}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteText}>确认删除</Text>
              )}
            </MotionPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 22, 36, 0.52)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderRadius: 22,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  dangerMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
  },
  dangerMarkText: {
    color: '#D94747',
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
  },
  title: {
    marginTop: 14,
    color: '#172033',
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
  },
  description: {
    marginTop: 10,
    color: '#65708A',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    marginTop: 22,
    flexDirection: 'row',
    gap: 12,
  },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelAction: {
    borderWidth: 1,
    borderColor: '#DDE2EE',
    backgroundColor: '#FFFFFF',
  },
  deleteAction: {
    backgroundColor: '#D94747',
  },
  cancelText: {
    color: '#47536B',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
