import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { TextbookService, UserTextbookInfo, ChapterNode, LearningPackage, ResourceFile } from '@/services/textbook-service';
import { DirectoryTree } from '@/components/DirectoryTree';

interface MicroClassScreenProps {
  onLogout: () => void;
}

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#3B82F6',
  warning: '#F59E0B',
  success: '#10B981',
  selectedBg: 'rgba(59, 130, 246, 0.08)',
};

// 默认占位图
const DEFAULT_BOOK_ICON = 'https://img.icons8.com/color/96/book.png';

export function MicroClassScreen({ onLogout }: MicroClassScreenProps) {
  const [textbooks, setTextbooks] = useState<UserTextbookInfo[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasToken, setHasToken] = useState(true);

  // 筛选器状态 (教材选择列表)
  const [selectedSubject, setSelectedSubject] = useState<string>('全部');
  const [selectedGrade, setSelectedGrade] = useState<string>('全部');

  // 图谱详页状态
  const [activeTextbook, setActiveTextbook] = useState<UserTextbookInfo | null>(null);
  const [catalogTree, setCatalogTree] = useState<ChapterNode[]>([]);
  const [learningPackages, setLearningPackages] = useState<LearningPackage[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  // 目录树展开/折叠状态 (Key: NodeID, Value: boolean)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  // 选中的目录树子节点 ID
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 预览资源模态框
  const [previewResource, setPreviewResource] = useState<ResourceFile | null>(null);

  const loadTextbooks = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await TextbookService.fetchTextbooks();
      if (data.length === 0) {
        const tokenExists = await TextbookService.fetchTextbooks().then(() => true).catch(() => false);
        setHasToken(tokenExists);
      } else {
        setHasToken(true);
      }
      setTextbooks(data);
    } catch (e) {
      console.warn('[MicroClassScreen] 加载教材列表出错:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTextbooks();
  }, [loadTextbooks]);

  // 从获取到的教材中提取所有出现的科目和年级，动态构建筛选项
  const subjects = ['全部', ...Array.from(new Set(textbooks.map(t => t.textbookSubjectLabel).filter(Boolean)))];
  const grades = ['全部', ...Array.from(new Set(textbooks.map(t => t.textbookGradeLabel).filter(Boolean)))];

  // 过滤后的教材列表
  const filteredTextbooks = textbooks.filter(t => {
    const matchSubject = selectedSubject === '全部' || t.textbookSubjectLabel === selectedSubject;
    const matchGrade = selectedGrade === '全部' || t.textbookGradeLabel === selectedGrade;
    return matchSubject && matchGrade;
  });

  // 展开折叠目录树节点
  const toggleNodeExpand = (id: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 递归查找选中的 Node 对象
  const findNodeInTree = (nodes: ChapterNode[], id: string): ChapterNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children && node.children.length > 0) {
        const found = findNodeInTree(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNode = selectedNodeId ? findNodeInTree(catalogTree, selectedNodeId) : null;

  // 收集选中节点及其所有子孙节点的 ID，以聚合展示名下的所有多媒体文件
  const getSelectedNodeResources = (): ResourceFile[] => {
    if (!selectedNodeId || !selectedNode) return [];

    const collectIds = (node: ChapterNode): string[] => {
      let ids = [node.id];
      if (node.children) {
        node.children.forEach(child => {
          ids = [...ids, ...collectIds(child)];
        });
      }
      return ids;
    };

    const targetIds = collectIds(selectedNode);
    const matchedPackages = learningPackages.filter(p => targetIds.includes(p.sectionId));
    return matchedPackages.flatMap(p => p.resourceList);
  };

  const activeResources = getSelectedNodeResources();

  // 处理点击教材，拉取该教材的目录树和所有微课视频/课件资源
  const handleTextbookPress = async (item: UserTextbookInfo) => {
    console.log(`[MicroClassScreen Click] 🖱️ 用户点击教材卡片: "${item.textbookName}" (ID: ${item.textbookId})`);
    setActiveTextbook(item);
    setCatalogTree([]);
    setLearningPackages([]);
    setSelectedNodeId(null);
    setExpandedNodes({});
    setIsLoadingDetail(true);

    try {
      console.log(`[MicroClassScreen API] 🚀 开始并行请求教材 [${item.textbookName}] 的目录结构树与学习资源包...`);
      // 并行请求章节目录与资源包数据
      const [tree, packages] = await Promise.all([
        TextbookService.fetchSectionTree(item.textbookId),
        TextbookService.fetchLearningPackages(item.textbookId),
      ]);
      
      console.log(`[MicroClassScreen API] 📥 请求成功! 原始大章目录树: ${tree.length} 个, 原始学习资源包: ${packages.length} 个`);
      setCatalogTree(tree);
      setLearningPackages(packages);

      // 默认展开并选中第一章
      if (tree.length > 0) {
        const firstChapter = tree[0];
        setSelectedNodeId(firstChapter.id);
        setExpandedNodes({ [firstChapter.id]: true });
        console.log(`[MicroClassScreen Navigation] 🧭 默认选中并展开首章目录 (ID: ${firstChapter.id}, 名称: ${firstChapter.name || firstChapter.label})`);
      }
    } catch (e) {
      console.warn('[MicroClassScreen API] ❌ 获取教材图谱资源失败:', e);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 获取文件后缀并选择图标
  const getFileIcon = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (name.endsWith('.mp4') || name.endsWith('.m3u8') || name.endsWith('.avi')) {
      return '📺'; // 视频
    }
    if (name.endsWith('.pdf')) {
      return '📕'; // PDF
    }
    if (name.endsWith('.ppt') || name.endsWith('.pptx')) {
      return '📊'; // PPT
    }
    return '📄'; // 默认文档
  };

  // 根据字节计算文件大小显示
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '未知大小';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderTextbookItem = ({ item }: { item: UserTextbookInfo }) => {
    return (
      <TouchableOpacity onPress={() => handleTextbookPress(item)} activeOpacity={0.85}>
        <Card style={styles.textbookCard}>
          {/* 左侧：封面图 */}
          <View style={styles.coverWrapper}>
            <Image
              source={{ uri: item.textbookCover || DEFAULT_BOOK_ICON }}
              style={styles.bookCover}
              resizeMode="cover"
            />
          </View>

          {/* 右侧：详细内容 */}
          <View style={styles.bookInfoWrapper}>
            <Text style={styles.bookName} numberOfLines={2}>
              {item.textbookName}
            </Text>

            {/* 教材规格与版本标签 */}
            <View style={styles.badgeRow}>
              <Badge
                text={item.textbookSubjectLabel}
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  borderColor: 'rgba(59, 130, 246, 0.15)',
                  color: LightColors.primary,
                }}
              />
              <Text style={styles.publisherText}>
                {item.textbookPublisher} • {item.textbookGradeLabel}{item.textbookSemesterLabel}
              </Text>
            </View>

            {/* ISBN与年份信息 */}
            <View style={styles.isbnRow}>
              <Text style={styles.metaText}>
                📅 年份: {item.textbookEditionYear || '暂无'}
              </Text>
              {item.textbookIsbn ? (
                <Text style={styles.metaText} numberOfLines={1}>
                  🔍 ISBN: {item.textbookIsbn}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  // 渲染微课资源文件行
  const renderResourceItem = (res: ResourceFile) => {
    const icon = getFileIcon(res.fileName);
    return (
      <TouchableOpacity
        key={res.id}
        style={styles.resourceRow}
        onPress={() => setPreviewResource(res)}
        activeOpacity={0.7}
      >
        <View style={styles.resourceLeft}>
          <Text style={styles.fileIconText}>{icon}</Text>
          <View style={styles.resourceNameCol}>
            <Text style={styles.resourceName} numberOfLines={1}>
              {res.fileName}
            </Text>
            <Text style={styles.resourceSize}>
              大小: {formatFileSize(res.size)}
            </Text>
          </View>
        </View>
        <View style={styles.previewBtn}>
          <Text style={styles.previewBtnText}>立即学习</Text>
        </View>
      </TouchableOpacity>
    );
  };



  // 渲染没有章节目录树时的扁平资源包列表 (公开课兼容)
  const renderFlatPackages = () => {
    return learningPackages.map(pkg => {
      const allFiles = pkg.resourceList || [];
      return (
        <Card key={pkg.id} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle} numberOfLines={1}>
              {pkg.packageName || '共享资源包'}
            </Text>
          </View>
          {pkg.description ? (
            <Text style={{ fontSize: 11, color: LightColors.textSecondary, marginBottom: 8, paddingHorizontal: 4 }}>
              {pkg.description}
            </Text>
          ) : null}
          <View style={styles.resourcesContainer}>
            {allFiles.length > 0 ? (
              allFiles.map(renderResourceItem)
            ) : (
              <Text style={styles.noResourceText}>💡 暂无关联文件</Text>
            )}
          </View>
        </Card>
      );
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部 Header */}
      <View style={styles.header}>
        <View style={styles.userProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>谱</Text>
          </View>
          <View>
            <Text style={styles.welcomeText}>您好，</Text>
            <Text style={styles.userName}>知识图谱与资源 📚</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.logoutIconButton} onPress={onLogout}>
          <Text style={styles.logoutIconText}>🚪</Text>
        </TouchableOpacity>
      </View>

      {!activeTextbook ? (
        // ==================== 主教材选择视图 ====================
        <View style={styles.container}>
          <View style={styles.viewHeader}>
            <Text style={styles.viewTitle}>教材中心</Text>
            <Text style={styles.viewSub}>同步绑定的云教材，点击卡片进入学科知识图谱</Text>
          </View>

          {/* 筛选项胶囊滚动区 */}
          {textbooks.length > 0 && (
            <View style={styles.filterSection}>
              {/* 科目筛选 */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
                style={styles.filterRow}
              >
                <Text style={styles.filterLabel}>学科: </Text>
                {subjects.map(sub => {
                  const isActive = selectedSubject === sub;
                  return (
                    <TouchableOpacity
                      key={`sub-${sub}`}
                      style={[styles.chip, isActive && styles.activeChip]}
                      onPress={() => setSelectedSubject(sub)}
                    >
                      <Text style={[styles.chipText, isActive && styles.activeChipText]}>
                        {sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 年级筛选 */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
                style={styles.filterRow}
              >
                <Text style={styles.filterLabel}>年级: </Text>
                {grades.map(gr => {
                  const isActive = selectedGrade === gr;
                  return (
                    <TouchableOpacity
                      key={`grade-${gr}`}
                      style={[styles.chip, isActive && styles.activeChip]}
                      onPress={() => setSelectedGrade(gr)}
                    >
                      <Text style={[styles.chipText, isActive && styles.activeChipText]}>
                        {gr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 教材内容列表 */}
          <FlatList
            data={filteredTextbooks}
            renderItem={renderTextbookItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={isRefreshing}
            onRefresh={loadTextbooks}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {!hasToken ? (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      ⚠️ 研伴账号未登录，无法请求在线教材。请先切换至“作业”页面完成登录，再回来刷新。
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>
                    {textbooks.length === 0 ? '暂无关联教材资源 📚\n下拉可刷新重试' : '无符合当前筛选条件的教材 💡'}
                  </Text>
                )}
              </View>
            }
          />
        </View>
      ) : (
        // ==================== 详细知识图谱学习视图 (目录树独立渲染 + 选子节点展出资源) ====================
        <View style={styles.container}>
          {/* 返回与教材背景栏 */}
          <View style={styles.textbookHeaderBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setActiveTextbook(null)}
            >
              <Text style={styles.backButtonText}>◀ 返回教材列表</Text>
            </TouchableOpacity>
            
            <View style={styles.activeBookRow}>
              <Image
                source={{ uri: activeTextbook.textbookCover || DEFAULT_BOOK_ICON }}
                style={styles.activeBookCover}
                resizeMode="cover"
              />
              <View style={styles.activeBookInfo}>
                <Text style={styles.activeBookTitle} numberOfLines={1}>
                  {activeTextbook.textbookName}
                </Text>
                <Text style={styles.activeBookPublisher}>
                  {activeTextbook.textbookPublisher} • {activeTextbook.textbookGradeLabel}
                </Text>
              </View>
            </View>
          </View>

          {isLoadingDetail ? (
            <View style={styles.detailLoadingContainer}>
              <ActivityIndicator size="large" color={LightColors.primary} />
              <Text style={styles.detailLoadingText}>正在加载学科知识图谱与微课文件...</Text>
            </View>
          ) : (
            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              
              {catalogTree.length > 0 ? (
                // ================== 有章节目录树时的树形架构 ==================
                <View style={styles.treeSectionWrapper}>
                  <Text style={styles.sectionHeaderTitle}>📖 课程目录大纲树</Text>
                  <Card style={styles.treeCard}>
                    <DirectoryTree
                      nodes={catalogTree}
                      expandedNodes={expandedNodes}
                      selectedNodeId={selectedNodeId}
                      onNodePress={(node) => {
                        setSelectedNodeId(node.id);
                        console.log(`[MicroClassScreen] 🎯 选中目录树节点: "${node.name || node.label}" (ID: ${node.id})`);
                      }}
                      onToggleExpand={toggleNodeExpand}
                    />
                  </Card>

                  {/* 对应选中的子节点的资源文件展示面板 */}
                  <Text style={styles.sectionHeaderTitle}>
                    📺 对应学习资源 {selectedNode ? `[${selectedNode.name || selectedNode.label}]` : ''}
                  </Text>
                  
                  {selectedNodeId ? (
                    <Card style={styles.resourcesPanelCard}>
                      {activeResources.length > 0 ? (
                        activeResources.map(renderResourceItem)
                      ) : (
                        <View style={styles.noResourceBox}>
                          <Text style={styles.noResourceText}>💡 当前选中节点暂无关联的微课视频或课件文件</Text>
                        </View>
                      )}
                    </Card>
                  ) : (
                    <Card style={styles.promptPanelCard}>
                      <Text style={styles.promptPanelText}>💡 请在上方目录树中点击具体小节，以查看对应的课后微课资源</Text>
                    </Card>
                  )}
                </View>
              ) : (
                // ================== 无章节树时的扁平公开课兼容 ==================
                <View style={styles.flatSectionWrapper}>
                  <Text style={styles.sectionHeaderTitle}>📺 课程共享资源列表</Text>
                  {learningPackages.length > 0 ? (
                    renderFlatPackages()
                  ) : (
                    <View style={styles.emptySectionsBox}>
                      <Text style={styles.emptySectionsText}>
                        此教材下暂无任何学习资源与课件 📭
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* 留出底部边距 */}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      )}

      {/* 资源在线学习预览 Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={!!previewResource}
        onRequestClose={() => setPreviewResource(null)}
      >
        <SafeAreaView style={styles.previewSafeArea}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {previewResource?.fileName || '学习文件预览'}
            </Text>
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewResource(null)}
            >
              <Text style={styles.previewCloseText}>关闭</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.previewBody}>
            {previewResource?.fileUrl ? (
              <WebView
                source={{ uri: previewResource.fileUrl }}
                style={styles.webView}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.webViewLoading}>
                    <ActivityIndicator size="large" color={LightColors.primary} />
                    <Text style={styles.webViewLoadingText}>正在加载课件/微课媒体，请稍候...</Text>
                  </View>
                )}
              />
            ) : (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>该文件暂无可用的在线播放/预览地址</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: LightColors.cardBorder,
    backgroundColor: LightColors.cardBackground,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: LightColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  welcomeText: {
    fontSize: 11,
    color: LightColors.textSecondary,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  logoutIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoutIconText: {
    fontSize: 14,
  },
  container: {
    flex: 1,
  },
  viewHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  viewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: LightColors.textPrimary,
    marginBottom: 4,
  },
  viewSub: {
    fontSize: 12,
    color: LightColors.textSecondary,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: LightColors.cardBorder,
    paddingVertical: 8,
  },
  filterRow: {
    marginVertical: 4,
  },
  filterScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 11,
    color: LightColors.textSecondary,
    fontWeight: '700',
    marginRight: 6,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeChip: {
    backgroundColor: LightColors.primary,
    borderColor: LightColors.primary,
  },
  chipText: {
    fontSize: 11,
    color: LightColors.textSecondary,
  },
  activeChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  textbookCard: {
    flexDirection: 'row',
    marginBottom: 12,
    padding: 12,
    backgroundColor: LightColors.cardBackground,
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  coverWrapper: {
    width: 72,
    height: 96,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bookCover: {
    width: '100%',
    height: '100%',
  },
  bookInfoWrapper: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },
  bookName: {
    fontSize: 14,
    fontWeight: '700',
    color: LightColors.textPrimary,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginVertical: 4,
  },
  publisherText: {
    fontSize: 11,
    color: LightColors.textSecondary,
    marginLeft: 8,
  },
  isbnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F8FAFC',
    paddingTop: 4,
  },
  metaText: {
    fontSize: 10,
    color: LightColors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 12,
    color: LightColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.15)',
  },
  warningText: {
    fontSize: 12,
    color: LightColors.warning,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },

  // ==================== 详细图谱与树形视图 ====================
  textbookHeaderBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: LightColors.cardBorder,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 12,
    color: LightColors.primary,
    fontWeight: '700',
  },
  activeBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeBookCover: {
    width: 36,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeBookInfo: {
    marginLeft: 12,
    flex: 1,
  },
  activeBookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: LightColors.textPrimary,
  },
  activeBookPublisher: {
    fontSize: 11,
    color: LightColors.textSecondary,
    marginTop: 2,
  },
  detailLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  detailLoadingText: {
    marginTop: 12,
    fontSize: 12,
    color: LightColors.textSecondary,
    textAlign: 'center',
  },
  detailScroll: {
    flex: 1,
  },
  treeSectionWrapper: {
    padding: 16,
  },
  flatSectionWrapper: {
    padding: 16,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: LightColors.textPrimary,
    marginTop: 16,
    marginBottom: 10,
  },
  treeCard: {
    backgroundColor: '#FFFFFF',
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
  },
  treeNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingRight: 12,
    marginHorizontal: 6,
    marginVertical: 1.5,
    borderRadius: 6,
  },
  treeNodeRowSelected: {
    backgroundColor: LightColors.selectedBg,
    borderLeftWidth: 4,
    borderLeftColor: LightColors.primary,
  },
  chapterNode: {
    backgroundColor: '#F1F5F9',
    marginVertical: 3,
  },
  sectionNode: {
    backgroundColor: 'transparent',
  },
  treeNodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  treeNodeIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  treeNodeText: {
    fontSize: 13,
    color: LightColors.textSecondary,
    flex: 1,
  },
  treeNodeTextSelected: {
    color: LightColors.primary,
    fontWeight: '700',
  },
  chapterNodeText: {
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  sectionNodeText: {
    fontWeight: '500',
  },
  expandArrow: {
    fontSize: 10,
    color: LightColors.textMuted,
  },
  treeChildrenWrapper: {
    borderLeftWidth: 1.5,
    borderColor: '#E2E8F0',
    marginLeft: 22,
    paddingLeft: 4,
  },

  // 资源显示面板卡片
  resourcesPanelCard: {
    backgroundColor: '#FFFFFF',
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promptPanelCard: {
    backgroundColor: '#F8FAFC',
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  promptPanelText: {
    fontSize: 12,
    color: LightColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  noResourceBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  sectionCard: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 10,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LightColors.primary,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: LightColors.textPrimary,
  },
  resourcesContainer: {
    marginTop: 4,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F8FAFC',
  },
  resourceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  fileIconText: {
    fontSize: 20,
    marginRight: 10,
  },
  resourceNameCol: {
    flex: 1,
  },
  resourceName: {
    fontSize: 12,
    fontWeight: '600',
    color: LightColors.textPrimary,
  },
  resourceSize: {
    fontSize: 9,
    color: LightColors.textMuted,
    marginTop: 2,
  },
  previewBtn: {
    backgroundColor: LightColors.primary,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewBtnText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  noResourceText: {
    fontSize: 11,
    color: LightColors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  emptySectionsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptySectionsText: {
    fontSize: 12,
    color: LightColors.textMuted,
  },

  // ==================== 资源学习预览 Modal ====================
  previewSafeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#1E293B',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 10,
  },
  previewCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#334155',
    borderRadius: 4,
  },
  previewCloseText: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  previewBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewLoadingText: {
    marginTop: 10,
    fontSize: 12,
    color: LightColors.textSecondary,
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 12,
    color: LightColors.textMuted,
  },
});
