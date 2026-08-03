import React, { memo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AiChatAttachment, AiChatContext, AiChatRole } from '../types';
import { AiRoleSelector } from './AiRoleSelector';
import { FormulaInsertModal } from './FormulaInsertModal';
import { ImagePreviewModal } from './ImagePreviewModal';

interface AiChatComposerProps {
  context: AiChatContext;
  inputText: string;
  attachment: AiChatAttachment | null;
  isSending: boolean;
  role: AiChatRole;
  enableWebSearch: boolean;
  bottomInset: number;
  editingMessageId: string | null;
  onInputChange: (value: string) => void;
  onSend: (prompt?: string) => void;
  onStop: () => void;
  onPickImage?: (source: 'camera' | 'library') => void;
  onRemoveAttachment: () => void;
  onReselect?: () => void;
  onRoleChange: (role: AiChatRole) => void;
  onToggleWebSearch: () => void;
  onCancelEdit: () => void;
}

function AiChatComposerComponent({
  context,
  inputText,
  attachment,
  isSending,
  role,
  enableWebSearch,
  bottomInset,
  editingMessageId,
  onInputChange,
  onSend,
  onStop,
  onPickImage,
  onRemoveAttachment,
  onReselect,
  onRoleChange,
  onToggleWebSearch,
  onCancelEdit,
}: AiChatComposerProps) {
  const inputRef = useRef<TextInput>(null);
  const [formulaVisible, setFormulaVisible] = useState(false);
  const [attachmentPreviewVisible, setAttachmentPreviewVisible] =
    useState(false);
  const [imageSourceVisible, setImageSourceVisible] = useState(false);
  const [inputSelection, setInputSelection] = useState({ start: 0, end: 0 });

  const insertFormula = (latex: string) => {
    const start = Math.min(inputSelection.start, inputText.length);
    const end = Math.min(inputSelection.end, inputText.length);
    const formula = `$${latex}$`;
    const nextValue = `${inputText.slice(0, start)}${formula}${inputText.slice(end)}`;
    const nextCursor = start + formula.length;
    onInputChange(nextValue);
    setInputSelection({ start: nextCursor, end: nextCursor });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const sendDisabled = !inputText.trim() && !attachment;

  const selectImageSource = (source: 'camera' | 'library') => {
    setImageSourceVisible(false);
    onPickImage?.(source);
  };

  const openFormulaFromSourceSheet = () => {
    setImageSourceVisible(false);
    setTimeout(() => setFormulaVisible(true), 220);
  };

  return (
    <>
      <View
        style={[
          styles.composerArea,
          { paddingBottom: Math.max(10, bottomInset) },
        ]}
      >
        {attachment ? (
          <View style={styles.attachmentBar}>
            <TouchableOpacity
              style={styles.attachmentImageButton}
              onPress={() => setAttachmentPreviewVisible(true)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`查看${attachment.label}`}
              accessibilityHint="打开框选图片预览"
            >
              <Image
                source={{ uri: attachment.uri }}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <View style={styles.attachmentCopy}>
              <Text style={styles.attachmentTitle} numberOfLines={1}>
                {attachment.label}
              </Text>
              <Text style={styles.attachmentHint}>将随下一条问题发送</Text>
            </View>
            {context.scene === 'textbook' && onReselect ? (
              <TouchableOpacity
                style={styles.attachmentAction}
                onPress={onReselect}
              >
                <Text style={styles.attachmentActionText}>重新框选</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.removeAttachment}
              onPress={onRemoveAttachment}
              accessibilityRole="button"
              accessibilityLabel="移除图片"
            >
              <Text style={styles.removeAttachmentText}>×</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {editingMessageId ? (
          <View style={styles.editIndicator}>
            <View style={styles.editIndicatorMark}>
              <Text style={styles.editIndicatorMarkText}>改</Text>
            </View>
            <View style={styles.editIndicatorCopy}>
              <Text style={styles.editIndicatorTitle}>正在编辑提问</Text>
              <Text style={styles.editIndicatorHint}>
                发送后将重新生成后续回答
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editCancelButton}
              onPress={onCancelEdit}
              accessibilityRole="button"
              accessibilityLabel="取消编辑"
            >
              <Text style={styles.editCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View
          style={[
            styles.inputRow,
            editingMessageId && styles.inputRowEditing,
          ]}
        >
          <TextInput
            ref={inputRef}
            value={inputText}
            onChangeText={onInputChange}
            selection={inputSelection}
            onSelectionChange={(event) =>
              setInputSelection(event.nativeEvent.selection)
            }
            style={styles.input}
            placeholder="输入你的问题"
            placeholderTextColor="#9499AC"
            multiline
            maxLength={2000}
            editable={!isSending}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => onSend()}
            accessibilityLabel="AI 问题输入框"
          />
          <View style={styles.inputActions}>
            <View style={styles.inputTools}>
              <AiRoleSelector
                value={role}
                disabled={isSending}
                onChange={onRoleChange}
              />
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  enableWebSearch && styles.toolChipActive,
                ]}
                onPress={onToggleWebSearch}
                disabled={isSending}
                accessibilityRole="switch"
                accessibilityLabel="联网搜索"
                accessibilityState={{
                  checked: enableWebSearch,
                  disabled: isSending,
                }}
              >
                <Text
                  style={[
                    styles.toolChipText,
                    enableWebSearch && styles.toolChipTextActive,
                  ]}
                >
                  联网搜索
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputButtons}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  if (context.scene === 'textbook' && onReselect) {
                    onReselect();
                    return;
                  }
                  setImageSourceVisible(true);
                }}
                disabled={isSending || (!onPickImage && !onReselect)}
                accessibilityRole="button"
                accessibilityLabel={
                  context.scene === 'textbook' ? '框选内容' : '添加内容'
                }
              >
                <Text style={styles.addIcon}>＋</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !isSending && sendDisabled && styles.sendButtonDisabled,
                  isSending && styles.stopButton,
                ]}
                onPress={isSending ? onStop : () => onSend()}
                disabled={!isSending && sendDisabled}
                accessibilityRole="button"
                accessibilityLabel={isSending ? '停止生成' : '发送消息'}
              >
                {isSending ? (
                  <View style={styles.stopIcon} />
                ) : (
                  <Text style={styles.sendText}>↑</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Text style={styles.footerText}>
          与学伴共学，敢质疑、会判断，思维不设限
        </Text>
      </View>
      <FormulaInsertModal
        visible={formulaVisible}
        onClose={() => setFormulaVisible(false)}
        onInsert={insertFormula}
      />
      <ImagePreviewModal
        visible={attachmentPreviewVisible && !!attachment}
        uri={attachment?.uri || null}
        title={attachment?.label}
        onClose={() => setAttachmentPreviewVisible(false)}
      />
      <Modal
        transparent
        visible={imageSourceVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setImageSourceVisible(false)}
      >
        <View style={styles.sourceModalRoot}>
          <Pressable
            style={styles.sourceBackdrop}
            onPress={() => setImageSourceVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="关闭添加内容菜单"
          />
          <View
            style={[
              styles.sourceSheet,
              { paddingBottom: Math.max(16, bottomInset) },
            ]}
          >
            <View style={styles.sourceHandle} />
            <Text style={styles.sourceTitle}>添加内容</Text>
            <TouchableOpacity
              style={styles.sourceOption}
              onPress={() => selectImageSource('camera')}
              accessibilityRole="button"
              accessibilityLabel="拍照"
            >
              <View style={styles.sourceOptionCopy}>
                <Text style={styles.sourceOptionTitle}>拍照</Text>
                <Text style={styles.sourceOptionHint}>拍摄题目或学习资料</Text>
              </View>
              <Text style={styles.sourceChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sourceOption}
              onPress={() => selectImageSource('library')}
              accessibilityRole="button"
              accessibilityLabel="从相册选择"
            >
              <View style={styles.sourceOptionCopy}>
                <Text style={styles.sourceOptionTitle}>从相册选择</Text>
                <Text style={styles.sourceOptionHint}>选择已有图片</Text>
              </View>
              <Text style={styles.sourceChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sourceOption}
              onPress={openFormulaFromSourceSheet}
              accessibilityRole="button"
              accessibilityLabel="插入公式"
            >
              <View style={styles.sourceOptionCopy}>
                <Text style={styles.sourceOptionTitle}>公式</Text>
                <Text style={styles.sourceOptionHint}>手写或输入数学公式</Text>
              </View>
              <Text style={styles.sourceChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sourceCancel}
              onPress={() => setImageSourceVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="取消添加内容"
            >
              <Text style={styles.sourceCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export const AiChatComposer = memo(AiChatComposerComponent);

const styles = StyleSheet.create({
  composerArea: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#DADCE7',
    backgroundColor: '#FFFFFF',
  },
  attachmentBar: {
    minHeight: 70,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 7,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DED9FA',
    backgroundColor: '#F5F3FF',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#E8E9F0',
  },
  attachmentImageButton: {
    width: 58,
    height: 54,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E8E9F0',
  },
  attachmentCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  attachmentTitle: { fontSize: 12, fontWeight: '800', color: '#2C3049' },
  attachmentHint: { marginTop: 4, fontSize: 10, color: '#777C90' },
  attachmentAction: {
    minHeight: 44,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentActionText: { fontSize: 11, fontWeight: '800', color: '#6256D9' },
  removeAttachment: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachmentText: { fontSize: 24, color: '#74798F' },
  searchButton: {
    height: 44,
    marginRight: 4,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE1EA',
    backgroundColor: '#F8F8FB',
  },
  toolChipActive: {
    borderColor: '#B9B3F2',
    backgroundColor: '#EEEAFE',
  },
  toolChipText: { fontSize: 11, fontWeight: '700', color: '#666C82' },
  toolChipTextActive: { color: '#5B50CE' },
  editIndicator: {
    minHeight: 54,
    marginHorizontal: 12,
    marginBottom: 7,
    paddingLeft: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CFC9F7',
    borderRadius: 15,
    backgroundColor: '#F5F3FF',
  },
  editIndicatorMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#6256D9',
  },
  editIndicatorMarkText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  editIndicatorCopy: { flex: 1, marginLeft: 9 },
  editIndicatorTitle: { fontSize: 12, fontWeight: '900', color: '#3D366F' },
  editIndicatorHint: { marginTop: 2, fontSize: 9, color: '#827AAE' },
  editCancelButton: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelText: { fontSize: 11, fontWeight: '800', color: '#675DC6' },
  inputRow: {
    minHeight: 104,
    marginHorizontal: 12,
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9DBE7',
    backgroundColor: '#FFFFFF',
  },
  inputRowEditing: { borderColor: '#AFA7ED' },
  input: {
    width: '100%',
    minHeight: 44,
    maxHeight: 128,
    paddingHorizontal: 10,
    paddingTop: 11,
    paddingBottom: 9,
    fontSize: 16,
    lineHeight: 22,
    color: '#20243D',
  },
  inputActions: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputTools: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputButtons: {
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F0F1F5',
  },
  addIcon: {
    marginTop: -2,
    fontSize: 23,
    fontWeight: '500',
    color: '#4E5368',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6256D9',
  },
  sendButtonDisabled: { opacity: 0.4 },
  stopButton: { backgroundColor: '#4E5267' },
  stopIcon: {
    width: 13,
    height: 13,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  sendText: {
    marginTop: -2,
    fontSize: 25,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerText: {
    marginTop: 5,
    fontSize: 9,
    textAlign: 'center',
    color: '#A0A4B4',
  },
  sourceModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sourceBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 27, 39, 0.5)',
  },
  sourceSheet: {
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  sourceHandle: {
    width: 38,
    height: 4,
    marginBottom: 16,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#D3D5DE',
  },
  sourceTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '900',
    color: '#20243D',
  },
  sourceOption: {
    minHeight: 64,
    marginBottom: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E3EA',
    backgroundColor: '#FAFAFC',
  },
  sourceOptionCopy: {
    flex: 1,
  },
  sourceOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#292D43',
  },
  sourceOptionHint: {
    marginTop: 3,
    fontSize: 11,
    color: '#7A7F92',
  },
  sourceChevron: {
    marginLeft: 12,
    fontSize: 26,
    color: '#858A9C',
  },
  sourceCancel: {
    minHeight: 48,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  sourceCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#61667A',
  },
});
