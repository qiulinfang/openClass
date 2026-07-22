import React, { memo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ImagePreviewModalProps {
  visible: boolean;
  uri: string | null;
  title?: string;
  onClose: () => void;
}

function ImagePreviewModalComponent({
  visible,
  uri,
  title = '图片预览',
  onClose,
}: ImagePreviewModalProps) {
  return (
    <Modal
      transparent
      visible={visible && !!uri}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="关闭图片预览"
        />
        {uri ? (
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="关闭图片预览"
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={title}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export const ImagePreviewModal = memo(ImagePreviewModalComponent);

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 20, 32, 0.78)',
  },
  card: {
    width: '100%',
    maxWidth: 720,
    height: '82%',
    maxHeight: 820,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 24,
  },
  header: {
    minHeight: 58,
    paddingLeft: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E3EB',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#2C3049',
  },
  closeButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 28, color: '#74798F' },
  image: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F3F4F8',
  },
});
