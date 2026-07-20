import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AiChatSession } from '../types';

interface AiSessionListProps {
  sessions: AiChatSession[];
  currentSessionId?: string;
  loading?: boolean;
  onSelect: (session: AiChatSession) => void;
  onTogglePin: (session: AiChatSession) => void;
  onDelete: (session: AiChatSession) => void;
  onCreate: () => void;
}

interface SessionSection {
  title: string;
  data: AiChatSession[];
}

const startOfDay = (timestamp: number): number => {
  const value = new Date(timestamp);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
};

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

const groupSessions = (sessions: AiChatSession[]): SessionSection[] => {
  const nowStart = startOfDay(Date.now());
  const groups: Record<string, AiChatSession[]> = {
    置顶: [],
    今天: [],
    昨天: [],
    近七天: [],
    更早: [],
  };
  sessions.forEach((session) => {
    if (session.pinned) {
      groups.置顶.push(session);
      return;
    }
    const days = Math.floor(
      (nowStart - startOfDay(session.updatedAt)) / 86400000
    );
    if (days <= 0) groups.今天.push(session);
    else if (days === 1) groups.昨天.push(session);
    else if (days <= 7) groups.近七天.push(session);
    else groups.更早.push(session);
  });
  return Object.entries(groups)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
};

export function AiSessionList({
  sessions,
  currentSessionId,
  loading = false,
  onSelect,
  onTogglePin,
  onDelete,
  onCreate,
}: AiSessionListProps) {
  const [query, setQuery] = useState('');
  const sections = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = keyword
      ? sessions.filter(
          (session) =>
            session.title.toLowerCase().includes(keyword) ||
            session.summary.toLowerCase().includes(keyword)
        )
      : sessions;
    return groupSessions(filtered);
  }, [query, sessions]);

  const confirmDelete = (session: AiChatSession) => {
    Alert.alert('删除会话', `确认删除“${session.title}”？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => onDelete(session),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            placeholder="搜索会话"
            placeholderTextColor="#9297AA"
            returnKeyType="search"
            accessibilityLabel="搜索会话"
          />
          {query ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="清除搜索"
            >
              <Text style={styles.clearText}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="新建 AI 会话"
        >
          <Text style={styles.createIcon}>＋</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#6256D9" />
          <Text style={styles.stateText}>正在加载会话…</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            sections.length === 0 && styles.emptyListContent,
          ]}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const selected = item.id === currentSessionId;
            return (
              <TouchableOpacity
                style={[
                  styles.sessionCard,
                  selected && styles.sessionCardSelected,
                ]}
                onPress={() => onSelect(item)}
                activeOpacity={0.76}
                accessibilityRole="button"
                accessibilityLabel={`打开会话：${item.title}`}
                accessibilityState={{ selected }}
              >
                {item.thumbnailUri ? (
                  <Image
                    source={{ uri: item.thumbnailUri }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.sessionMark}>
                    <View style={styles.sessionMarkDot} />
                    <View style={styles.sessionMarkLine} />
                    <View style={styles.sessionMarkLineShort} />
                  </View>
                )}
                <View style={styles.sessionCopy}>
                  <View style={styles.sessionTitleRow}>
                    <Text
                      style={styles.sessionTitle}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.sessionTime}>
                      {formatTime(item.updatedAt)}
                    </Text>
                  </View>
                  <Text style={styles.sessionSummary} numberOfLines={2}>
                    {item.summary || '点击继续对话'}
                  </Text>
                  <View style={styles.sessionMeta}>
                    {item.pinned ? (
                      <Text style={styles.pinnedLabel}>已置顶</Text>
                    ) : null}
                    {item.pageNumber ? (
                      <Text style={styles.metaText}>
                        第 {item.pageNumber} 页
                      </Text>
                    ) : null}
                    <Text style={styles.metaText}>
                      {item.messageCount} 条消息
                    </Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onTogglePin(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.pinned ? '取消置顶' : '置顶'}
                  >
                    <Text style={styles.actionText}>
                      {item.pinned ? '取消置顶' : '置顶'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.actionButtonGap,
                    ]}
                    onPress={() => confirmDelete(item)}
                    accessibilityRole="button"
                    accessibilityLabel="删除会话"
                  >
                    <Text style={styles.deleteText}>删除</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIcon}>
                <View style={styles.emptyIconLine} />
                <View style={styles.emptyIconLineShort} />
              </View>
              <Text style={styles.emptyTitle}>
                {query ? '没有匹配的会话' : '暂无会话记录'}
              </Text>
              <Text style={styles.stateText}>
                {query
                  ? '换一个关键词试试'
                  : '开始提问后，会话会自动保存在这里'}
              </Text>
              {!query ? (
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={onCreate}
                >
                  <Text style={styles.emptyActionText}>开始新对话</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DFE1EB',
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 23,
    lineHeight: 25,
    color: '#73798E',
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    fontSize: 16,
    color: '#20243D',
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 24,
    color: '#858A9D',
  },
  createButton: {
    width: 46,
    height: 46,
    marginLeft: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6256D9',
  },
  createIcon: {
    fontSize: 26,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  sectionTitle: {
    paddingTop: 8,
    paddingBottom: 7,
    fontSize: 12,
    fontWeight: '800',
    color: '#777C90',
    backgroundColor: '#F7F7FC',
  },
  sessionCard: {
    minHeight: 102,
    marginBottom: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E4EC',
    backgroundColor: '#FFFFFF',
  },
  sessionCardSelected: {
    borderColor: '#AAA2EE',
    backgroundColor: '#F1EFFF',
  },
  thumbnail: {
    width: 66,
    height: 66,
    marginRight: 11,
    borderRadius: 12,
    backgroundColor: '#ECEEF5',
  },
  sessionMark: {
    width: 46,
    height: 46,
    marginRight: 11,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#EEEAFE',
  },
  sessionMarkDot: {
    width: 6,
    height: 6,
    marginBottom: 6,
    borderRadius: 3,
    backgroundColor: '#6256D9',
  },
  sessionMarkLine: {
    height: 3,
    marginBottom: 5,
    borderRadius: 2,
    backgroundColor: '#8B83E5',
  },
  sessionMarkLineShort: {
    width: '65%',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#B7B1F0',
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionTitle: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '800',
    color: '#20243D',
  },
  sessionTime: {
    fontSize: 10,
    color: '#969AAF',
  },
  sessionSummary: {
    minHeight: 34,
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: '#666C82',
  },
  sessionMeta: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinnedLabel: {
    marginRight: 8,
    fontSize: 10,
    fontWeight: '800',
    color: '#6256D9',
  },
  metaText: {
    marginRight: 8,
    fontSize: 10,
    color: '#969AAF',
  },
  actions: {
    marginLeft: 7,
  },
  actionButton: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonGap: {
    marginTop: 8,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6256D9',
  },
  deleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D94A5A',
  },
  centerState: {
    flex: 1,
    minHeight: 280,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#858A9D',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    marginBottom: 15,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#EEEAFE',
  },
  emptyIconLine: {
    height: 4,
    marginBottom: 8,
    borderRadius: 2,
    backgroundColor: '#7770DE',
  },
  emptyIconLineShort: {
    width: '65%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A9A3EB',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#292D47',
  },
  emptyAction: {
    minHeight: 44,
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6256D9',
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
