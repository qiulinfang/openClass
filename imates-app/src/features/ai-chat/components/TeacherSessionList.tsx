import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { TeacherChatSession } from '../services/teacher-chat-service';

interface TeacherSessionListProps {
  sessions: TeacherChatSession[];
  currentSessionId?: string;
  unreadSessionIds?: ReadonlySet<string>;
  loading?: boolean;
  pendingForwardCount?: number;
  onSelect: (session: TeacherChatSession) => void;
}

export function TeacherSessionList({
  sessions,
  currentSessionId,
  unreadSessionIds,
  loading = false,
  pendingForwardCount = 0,
  onSelect,
}: TeacherSessionListProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(keyword) ||
        session.subject.toLowerCase().includes(keyword)
    );
  }, [query, sessions]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          placeholder="搜索答疑学科"
          placeholderTextColor="#9297AA"
          returnKeyType="search"
          accessibilityLabel="搜索老师答疑学科"
        />
        {query ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setQuery('')}
            accessibilityLabel="清除搜索"
          >
            <Text style={styles.clearText}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {pendingForwardCount > 0 ? (
        <View style={styles.forwardBanner}>
          <View style={styles.forwardMark}>
            <Text style={styles.forwardMarkText}>师</Text>
          </View>
          <View style={styles.forwardCopy}>
            <Text style={styles.forwardTitle}>选择要咨询的老师</Text>
            <Text style={styles.forwardHint}>
              选中学科后，将发送 {pendingForwardCount} 条对话
            </Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#6256D9" />
          <Text style={styles.stateText}>正在加载老师会话…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.column}
          renderItem={({ item }) => {
            const selected = item.id === currentSessionId;
            return (
              <TouchableOpacity
                style={[
                  styles.subjectCard,
                  selected && styles.subjectCardSelected,
                ]}
                onPress={() => onSelect(item)}
                activeOpacity={0.76}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`进入${item.title}老师答疑`}
              >
                <View
                  style={[
                    styles.subjectMark,
                    selected && styles.subjectMarkSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.subjectInitial,
                      selected && styles.subjectInitialSelected,
                    ]}
                  >
                    {item.title.slice(0, 1)}
                  </Text>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{item.title}老师</Text>
                  <Text style={styles.subtitle}>固定答疑会话</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
                {unreadSessionIds?.has(item.id) ? (
                  <View style={styles.unreadDot} />
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>没有匹配的学科</Text>
              <Text style={styles.stateText}>换一个关键词试试</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBox: {
    minHeight: 46,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DFE1EB',
    backgroundColor: '#FFFFFF',
  },
  searchIcon: { marginRight: 8, fontSize: 23, color: '#73798E' },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 16,
    color: '#20243D',
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 24, color: '#858A9D' },
  forwardBanner: {
    minHeight: 62,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CDE8DB',
    borderRadius: 16,
    backgroundColor: '#F0FAF5',
  },
  forwardMark: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#27A875',
  },
  forwardMarkText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  forwardCopy: { flex: 1, marginLeft: 10 },
  forwardTitle: { fontSize: 12, fontWeight: '900', color: '#24664E' },
  forwardHint: { marginTop: 4, fontSize: 10, color: '#5C8574' },
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  column: { alignItems: 'stretch' },
  subjectCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    margin: 4,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E3EC',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  subjectCardSelected: {
    borderColor: '#7568E8',
    backgroundColor: '#F1EEFF',
  },
  subjectMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#ECEAF8',
  },
  subjectMarkSelected: { backgroundColor: '#6256D9' },
  subjectInitial: { fontSize: 16, fontWeight: '900', color: '#6256D9' },
  subjectInitialSelected: { color: '#FFFFFF' },
  copy: { flex: 1, minWidth: 0, marginLeft: 10 },
  title: { fontSize: 14, fontWeight: '900', color: '#20243D' },
  subtitle: { marginTop: 5, fontSize: 10, color: '#7D8295' },
  chevron: { marginLeft: 3, fontSize: 23, color: '#979BAD' },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E94C5C',
  },
  centerState: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#34384D' },
  stateText: { marginTop: 8, fontSize: 13, color: '#888DA0' },
});
