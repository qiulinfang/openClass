import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clearNetworkEntries,
  exportNetworkDebugReport,
  getNetworkEntries,
  NetworkDebugEntry,
  subscribeNetworkEntries,
} from '@/services/network-debugger';
import { isInternalBuild } from '@/services/env-config';

type Filter = 'all' | 'errors';

const getStatusColor = (entry?: NetworkDebugEntry): string => {
  if (!entry || !entry.completed) return '#F59E0B';
  if (entry.error || (entry.status ?? 0) >= 400) return '#FB7185';
  return '#34D399';
};

const formatEntryDetails = (entry: NetworkDebugEntry): string => [
  `${entry.method} ${entry.url}`,
  `开始时间: ${entry.startedAt}`,
  `状态: ${entry.error ? '网络错误' : `${entry.status ?? '请求中'} ${entry.statusText || ''}`}`,
  `耗时: ${entry.durationMs ?? '-'} ms`,
  `请求头:\n${JSON.stringify(entry.requestHeaders, null, 2)}`,
  `请求体:\n${entry.requestBody}`,
  `响应头:\n${JSON.stringify(entry.responseHeaders ?? {}, null, 2)}`,
  `响应体:\n${entry.responseBody ?? '<无>'}`,
  entry.error ? `完整错误:\n${entry.error}` : '',
].filter(Boolean).join('\n\n');

export function NetworkDebugOverlay() {
  const [visible, setVisible] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [entries, setEntries] = useState<NetworkDebugEntry[]>(getNetworkEntries());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeNetworkEntries(() => setEntries([...getNetworkEntries()])), []);

  const filteredEntries = useMemo(() => filter === 'errors'
    ? entries.filter((entry) => entry.error || (entry.status ?? 0) >= 400)
    : entries, [entries, filter]);
  const selectedEntry = entries.find((entry) => entry.id === selectedId);
  const errorCount = entries.filter((entry) => entry.error || (entry.status ?? 0) >= 400).length;
  const latestEntry = entries[0];

  if (!isInternalBuild()) return null;

  const copyText = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="打开全局网络调试工具"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.floatingButton, pressed && styles.pressed]}
      >
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(latestEntry) }]} />
        <Text style={styles.floatingLabel}>NET</Text>
        <Text style={styles.floatingCount}>{entries.length}</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.console} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>INTERNAL · GLOBAL FETCH</Text>
              <Text style={styles.title}>网络仪表台</Text>
            </View>
            <Pressable onPress={() => setVisible(false)} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>关闭</Text>
            </Pressable>
          </View>

          {selectedEntry ? (
            <View style={styles.detailPane}>
              <View style={styles.detailActions}>
                <Pressable onPress={() => setSelectedId(null)} style={styles.utilityButton}>
                  <Text style={styles.utilityButtonText}>‹ 返回列表</Text>
                </Pressable>
                <Pressable onPress={() => copyText(formatEntryDetails(selectedEntry))} style={styles.copyButton}>
                  <Text style={styles.copyButtonText}>{copied ? '已复制' : '复制详情'}</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
                <Text selectable style={styles.mono}>{formatEntryDetails(selectedEntry)}</Text>
              </ScrollView>
            </View>
          ) : (
            <>
              <View style={styles.toolbar}>
                <View style={styles.filters}>
                  <Pressable
                    onPress={() => setFilter('all')}
                    style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                  >
                    <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                      全部 {entries.length}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilter('errors')}
                    style={[styles.filterButton, filter === 'errors' && styles.filterButtonActive]}
                  >
                    <Text style={[styles.filterText, filter === 'errors' && styles.filterTextActive]}>
                      异常 {errorCount}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.toolbarActions}>
                  <Pressable onPress={() => copyText(exportNetworkDebugReport())} style={styles.utilityButton}>
                    <Text style={styles.utilityButtonText}>{copied ? '已复制' : '导出'}</Text>
                  </Pressable>
                  <Pressable onPress={clearNetworkEntries} style={styles.utilityButton}>
                    <Text style={styles.dangerText}>清空</Text>
                  </Pressable>
                </View>
              </View>

              <FlatList
                data={filteredEntries}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={(
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>等待接口请求</Text>
                    <Text style={styles.emptyText}>操作应用后，每一条网络请求都会显示在这里。</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <Pressable onPress={() => setSelectedId(item.id)} style={styles.requestRow}>
                    <View style={[styles.methodBadge, { borderColor: getStatusColor(item) }]}>
                      <Text style={styles.methodText}>{item.method}</Text>
                    </View>
                    <View style={styles.requestMain}>
                      <Text numberOfLines={1} style={styles.requestUrl}>{item.url}</Text>
                      <Text style={styles.requestMeta}>
                        {new Date(item.startedAt).toLocaleTimeString()} · {item.durationMs ?? '…'} ms
                      </Text>
                    </View>
                    <Text style={[styles.statusText, { color: getStatusColor(item) }]}>
                      {item.error ? 'ERR' : item.status ?? '…'}
                    </Text>
                  </Pressable>
                )}
              />
            </>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    zIndex: 9999,
    elevation: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    height: 34,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  floatingLabel: { color: '#F8FAFC', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  floatingCount: { color: '#94A3B8', fontSize: 10, fontVariant: ['tabular-nums'] },
  console: { flex: 1, backgroundColor: '#08111F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  eyebrow: { color: '#38BDF8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#F8FAFC', fontSize: 23, fontWeight: '800', marginTop: 2 },
  headerButton: { backgroundColor: '#1E293B', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9 },
  headerButtonText: { color: '#E2E8F0', fontSize: 13, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  filters: { flexDirection: 'row', backgroundColor: '#0F1B2D', borderRadius: 9, padding: 3 },
  filterButton: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7 },
  filterButtonActive: { backgroundColor: '#1E3A5F' },
  filterText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#BAE6FD' },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  utilityButton: { paddingHorizontal: 10, paddingVertical: 8 },
  utilityButtonText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  dangerText: { color: '#FB7185', fontSize: 12, fontWeight: '700' },
  copyButton: { backgroundColor: '#0284C7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  copyButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  listContent: { padding: 12, paddingBottom: 40 },
  requestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F1B2D',
    borderWidth: 1, borderColor: '#1E293B', borderRadius: 11, padding: 12, marginBottom: 8,
  },
  methodBadge: { minWidth: 48, borderLeftWidth: 3, paddingLeft: 8 },
  methodText: { color: '#CBD5E1', fontSize: 10, fontWeight: '900' },
  requestMain: { flex: 1 },
  requestUrl: { color: '#E2E8F0', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  requestMeta: { color: '#64748B', fontSize: 10, marginTop: 5, fontVariant: ['tabular-nums'] },
  statusText: { fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  emptyState: { paddingVertical: 80, paddingHorizontal: 30, alignItems: 'center' },
  emptyTitle: { color: '#CBD5E1', fontSize: 17, fontWeight: '800' },
  emptyText: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  detailPane: { flex: 1 },
  detailActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  detailScroll: { flex: 1 },
  detailScrollContent: { padding: 16, paddingBottom: 50 },
  mono: { color: '#CBD5E1', fontSize: 11, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});

