import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TextbookService,
  UserTextbookInfo,
  ChapterNode,
  LearningPackage,
  ResourceFile,
} from '../services/textbook-service';
import { TextbookDownloadService } from '../services/textbook-download-service';
import type { TextbookPracticeContext } from '../types';
import { TextbookPracticePanel } from '../components/TextbookPracticePanel';
import { LearningResourceList } from '../components/LearningResourceList';
import { LearningResourceViewer } from '../components/LearningResourceViewer';
import { getUniqueLearningResources } from '../components/learning-resource';
import {
  PracticeQuestion,
  PreparedPracticeData,
  TextbookPracticeService,
} from '../services/textbook-practice-service';

interface TextbookDetailScreenProps {
  textbook: UserTextbookInfo;
  onBackToTextbookCenter?: () => void;
  onStartPractice?: (questions: PracticeQuestion[]) => void;
}

const LightColors = {
  background: '#F3F4FC',
  cardBorder: '#E4E5F0',
  textPrimary: '#20243D',
  textSecondary: '#626881',
  textMuted: '#989DB2',
  primary: '#6256D9',
};

// 默认占位图
const DEFAULT_BOOK_ICON = 'https://img.icons8.com/color/96/book.png';

export function TextbookDetailScreen({
  textbook,
  onBackToTextbookCenter,
  onStartPractice,
}: TextbookDetailScreenProps) {
  const insets = useSafeAreaInsets();
  // 图谱详页状态
  const [catalogTree, setCatalogTree] = useState<ChapterNode[]>([]);
  const [learningPackages, setLearningPackages] = useState<LearningPackage[]>(
    []
  );
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    null
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [previewResource, setPreviewResource] = useState<ResourceFile | null>(
    null
  );
  const closeResourceViewer = useCallback(() => setPreviewResource(null), []);
  const [activeContentTab, setActiveContentTab] = useState<
    'resources' | 'practice'
  >('resources');
  const [practicePreparing, setPracticePreparing] = useState(false);
  const [preparedPractice, setPreparedPractice] =
    useState<PreparedPracticeData | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState('');

  const selectedChapter = useMemo(
    () =>
      catalogTree.find((chapter) => chapter.id === selectedChapterId) || null,
    [catalogTree, selectedChapterId]
  );
  const lessonOptions = useMemo(() => {
    const chapterChildren = selectedChapter?.children || [];
    const levelOneLessons = chapterChildren.filter(
      (child) => child.level === 1
    );
    return levelOneLessons.length > 0 ? levelOneLessons : chapterChildren;
  }, [selectedChapter]);
  const selectedLesson = useMemo(
    () =>
      lessonOptions.find((lesson) => lesson.id === selectedLessonId) || null,
    [lessonOptions, selectedLessonId]
  );
  const activePackages = useMemo(() => {
    const activeSectionId = (selectedLessonId || selectedChapterId || '')
      .trim()
      .toLowerCase();
    if (!activeSectionId) return [];

    return learningPackages.filter(
      (pkg) => pkg.sectionId?.trim().toLowerCase() === activeSectionId
    );
  }, [learningPackages, selectedChapterId, selectedLessonId]);
  const activeResourceCount = useMemo(
    () => getUniqueLearningResources(activePackages).length,
    [activePackages]
  );
  const practiceContext = useMemo<TextbookPracticeContext | null>(
    () =>
      selectedLesson
        ? {
            textbookId: textbook.textbookId,
            textbookRecordId: textbook.id,
            sectionId: selectedLesson.id,
            sectionName: selectedLesson.name || selectedLesson.label,
            subject: textbook.textbookSubjectLabel,
          }
        : null,
    [selectedLesson, textbook]
  );

  const selectChapter = useCallback((chapter: ChapterNode) => {
    const directChildren = chapter.children || [];
    const preferredLessons = directChildren.filter(
      (child) => child.level === 1
    );
    const firstLesson = (
      preferredLessons.length > 0 ? preferredLessons : directChildren
    )[0];
    setSelectedChapterId(chapter.id);
    setSelectedLessonId(firstLesson?.id || null);
    setActiveContentTab('resources');
    setPreparedPractice(null);
    setPracticeFeedback('');
  }, []);

  const selectLesson = useCallback((lesson: ChapterNode) => {
    setSelectedLessonId(lesson.id);
    setActiveContentTab('resources');
    setPreparedPractice(null);
    setPracticeFeedback('');
  }, []);

  const openPracticeMode = async () => {
    if (!practiceContext || practicePreparing) return;
    if (preparedPractice) {
      setActiveContentTab('practice');
      return;
    }
    setActiveContentTab('practice');
    setPracticePreparing(true);
    setPreparedPractice(null);
    setPracticeFeedback('');
    try {
      const prepared = await TextbookPracticeService.preparePractice(
        practiceContext.textbookId,
        practiceContext.sectionId,
        practiceContext.subject,
        practiceContext.textbookRecordId
      );
      if (prepared.page.questions.length > 0) {
        setPreparedPractice(prepared);
      } else {
        setPracticeFeedback('练习列表为空');
      }
      setActiveContentTab('practice');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '练习题查询失败，请稍后重试';
      setPracticeFeedback(
        /暂无|没有|无.*练习|无.*题/.test(message)
          ? '练习列表为空'
          : message
      );
      setActiveContentTab('practice');
    } finally {
      setPracticePreparing(false);
    }
  };
  const totalResourceCount = useMemo(
    () => getUniqueLearningResources(learningPackages).length,
    [learningPackages]
  );

  // 处理点击教材，拉取该教材的目录树和所有微课视频/课件资源
  const handleTextbookPress = useCallback(async (item: UserTextbookInfo) => {
    setCatalogTree([]);
    setLearningPackages([]);
    setSelectedChapterId(null);
    setSelectedLessonId(null);
    setActiveContentTab('resources');
    setPreparedPractice(null);
    setPracticeFeedback('');
    setIsLoadingDetail(true);

    try {
      // 已下载教材优先读取永久目录中的本地资源；未下载教材仍沿用原在线接口。
      const [cachedTree, cachedPackages] = await Promise.all([
        TextbookDownloadService.getCachedChapterTree(item.id),
        TextbookDownloadService.getDownloadedLearningPackages(item.id),
      ]);
      const [tree, packages] = await Promise.all([
        cachedTree
          ? Promise.resolve(cachedTree)
          : TextbookService.fetchSectionTree(item.textbookId),
        cachedPackages
          ? Promise.resolve(cachedPackages)
          : TextbookService.fetchLearningPackages(item.id),
      ]);

      setCatalogTree(tree);
      setLearningPackages(packages);

      // 默认展开并选中第一章
      if (tree.length > 0) {
        const firstChapter = tree[0];
        const directChildren = firstChapter.children || [];
        const preferredLessons = directChildren.filter(
          (child) => child.level === 1
        );
        const firstLesson = (
          preferredLessons.length > 0 ? preferredLessons : directChildren
        )[0];
        setSelectedChapterId(firstChapter.id);
        setSelectedLessonId(firstLesson?.id || null);
      }
    } catch (e) {
      console.warn('[TextbookDetailScreen] 获取教材目录与资源失败:', e);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void handleTextbookPress(textbook);
  }, [handleTextbookPress, textbook]);

  const returnToTextbookCenter = () => {
    onBackToTextbookCenter?.();
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
          <View style={styles.detailTopBar}>
            <TouchableOpacity
              style={styles.detailBackButton}
              onPress={returnToTextbookCenter}
              accessibilityRole="button"
              accessibilityLabel="返回教材中心"
            >
              <Text style={styles.detailBackIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.detailTopTitle}>教材详情</Text>
            <View style={styles.detailTopSpacer} />
          </View>

          {isLoadingDetail ? (
            <View style={styles.detailLoadingContainer}>
              <ActivityIndicator size="large" color={LightColors.primary} />
              <Text style={styles.detailLoadingText}>
                正在加载学科知识图谱与微课文件...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={[
                styles.detailScrollContent,
                { paddingBottom: Math.max(40, insets.bottom + 24) },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailHero}>
                <View style={styles.detailHeroMain}>
                  <Image
                    source={{
                      uri: textbook.textbookCover || DEFAULT_BOOK_ICON,
                    }}
                    style={styles.detailBookCover}
                    resizeMode="cover"
                  />
                  <View style={styles.detailBookInfo}>
                    <View style={styles.detailSubjectPill}>
                      <Text style={styles.detailSubjectText}>
                        {textbook.textbookSubjectLabel || '教材'}
                      </Text>
                    </View>
                    <Text style={styles.detailBookTitle} numberOfLines={3}>
                      {textbook.textbookName}
                    </Text>
                    <Text style={styles.detailBookMeta} numberOfLines={2}>
                      {textbook.textbookPublisher} ·{' '}
                      {textbook.textbookGradeLabel}
                      {textbook.textbookSemesterLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailStats}>
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatValue}>
                      {catalogTree.length}
                    </Text>
                    <Text style={styles.detailStatLabel}>章节</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatValue}>
                      {totalResourceCount}
                    </Text>
                    <Text style={styles.detailStatLabel}>学习资源</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatValue}>
                      {textbook.textbookEditionYear || '—'}
                    </Text>
                    <Text style={styles.detailStatLabel}>出版年份</Text>
                  </View>
                </View>
              </View>

              {catalogTree.length > 0 ? (
                <View style={styles.treeSectionWrapper}>
                  <View style={styles.mobileSectionHeading}>
                    <Text style={styles.mobileSectionTitle}>章节</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chapterList}
                  >
                    {catalogTree.map((chapter, index) => {
                      const active = chapter.id === selectedChapterId;
                      return (
                        <TouchableOpacity
                          key={chapter.id}
                          style={[
                            styles.chapterChip,
                            active && styles.chapterChipActive,
                          ]}
                          onPress={() => selectChapter(chapter)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <Text
                            style={[
                              styles.chapterChipIndex,
                              active && styles.chapterChipIndexActive,
                            ]}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </Text>
                          <Text
                            style={[
                              styles.chapterChipText,
                              active && styles.chapterChipTextActive,
                            ]}
                            numberOfLines={2}
                          >
                            {chapter.name || chapter.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.mobileSectionHeading}>
                    <Text style={styles.mobileSectionTitle}>课节</Text>
                    <Text style={styles.mobileSectionHint}>
                      {selectedChapter?.name ||
                        selectedChapter?.label ||
                        '请先选择章节'}
                    </Text>
                  </View>
                  {lessonOptions.length > 0 ? (
                    <View style={styles.lessonList}>
                      {lessonOptions.map((lesson, index) => {
                        const active = lesson.id === selectedLessonId;
                        return (
                          <TouchableOpacity
                            key={lesson.id}
                            style={[
                              styles.lessonRow,
                              active && styles.lessonRowActive,
                            ]}
                            onPress={() => selectLesson(lesson)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <View
                              style={[
                                styles.lessonNumber,
                                active && styles.lessonNumberActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.lessonNumberText,
                                  active && styles.lessonNumberTextActive,
                                ]}
                              >
                                {index + 1}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.lessonText,
                                active && styles.lessonTextActive,
                              ]}
                              numberOfLines={2}
                            >
                              {lesson.name || lesson.label}
                            </Text>
                            <Text
                              style={[
                                styles.lessonCheck,
                                active && styles.lessonCheckActive,
                              ]}
                            >
                              {active ? '✓' : '›'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.promptPanelCard}>
                      <Text style={styles.promptPanelText}>本章暂无课节</Text>
                    </View>
                  )}

                  <View style={styles.contentTabs}>
                    <TouchableOpacity
                      style={[
                        styles.contentTab,
                        activeContentTab === 'resources' &&
                          styles.contentTabActive,
                      ]}
                      onPress={() => setActiveContentTab('resources')}
                      accessibilityRole="tab"
                      accessibilityState={{
                        selected: activeContentTab === 'resources',
                      }}
                    >
                      <Text
                        style={[
                          styles.contentTabText,
                          activeContentTab === 'resources' &&
                            styles.contentTabTextActive,
                        ]}
                      >
                        探索
                      </Text>
                      {activeResourceCount > 0 ? (
                        <View style={styles.resourceCountBadge}>
                          <Text style={styles.resourceCountText}>
                            {activeResourceCount}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.contentTab,
                        activeContentTab === 'practice' &&
                          styles.contentTabActive,
                        (!practiceContext || practicePreparing) &&
                          styles.contentTabDisabled,
                      ]}
                      onPress={() => void openPracticeMode()}
                      disabled={!practiceContext || practicePreparing}
                      accessibilityRole="tab"
                      accessibilityLabel="当前课节练习"
                      accessibilityState={{
                        selected: activeContentTab === 'practice',
                        disabled: !practiceContext || practicePreparing,
                      }}
                    >
                      {practicePreparing ? (
                        <ActivityIndicator
                          size="small"
                          color={LightColors.primary}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.contentTabText,
                            activeContentTab === 'practice' &&
                              styles.contentTabTextActive,
                          ]}
                        >
                          练习
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {activeContentTab === 'resources' ? (
                    selectedLessonId || selectedChapterId ? (
                      <LearningResourceList
                        key={selectedLessonId || selectedChapterId}
                        packages={activePackages}
                        onOpenResource={setPreviewResource}
                      />
                    ) : (
                      <View style={styles.promptPanelCard}>
                        <Text style={styles.promptPanelText}>
                          请先选择一个课节
                        </Text>
                      </View>
                    )
                  ) : practiceContext && preparedPractice ? (
                    <TextbookPracticePanel
                      context={practiceContext}
                      preparedData={preparedPractice}
                      onStart={(questions) => onStartPractice?.(questions)}
                    />
                  ) : (
                    <View style={styles.resourcesPanelCard}>
                      {practicePreparing ? (
                        <View style={styles.noResourceBox}>
                          <ActivityIndicator
                            size="small"
                            color={LightColors.primary}
                          />
                        </View>
                      ) : (
                        <View style={styles.noResourceBox}>
                          <Text style={styles.noResourceTitle}>
                            {practiceFeedback || '练习列表为空'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.flatSectionWrapper}>
                  <View style={styles.mobileSectionHeading}>
                    <Text style={styles.mobileSectionTitle}>课程资源</Text>
                    <Text style={styles.mobileSectionHint}>
                      共 {totalResourceCount} 个文件
                    </Text>
                  </View>
                  {learningPackages.length > 0 ? (
                    <LearningResourceList
                      packages={learningPackages}
                      onOpenResource={setPreviewResource}
                      emptyTitle="暂无课程资源"
                      emptyHint="下拉刷新或稍后再试"
                    />
                  ) : (
                    <View style={styles.emptySectionsBox}>
                      <Text style={styles.noResourceTitle}>暂无课程资源</Text>
                      <Text style={styles.emptySectionsText}>
                        下拉刷新或稍后再试
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          )}
      </View>

      <LearningResourceViewer
        resource={previewResource}
        onClose={closeResourceViewer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  container: {
    flex: 1,
  },
  // ==================== 移动端教材详情 ====================
  detailTopBar: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LightColors.cardBorder,
  },
  detailBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
  },
  detailBackIcon: {
    color: LightColors.primary,
    fontSize: 34,
    lineHeight: 36,
    marginTop: -2,
  },
  detailTopTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: LightColors.textPrimary,
  },
  detailTopSpacer: {
    width: 44,
    height: 44,
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  detailHero: {
    minHeight: 218,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#292545',
    overflow: 'hidden',
  },
  detailHeroMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailBookCover: {
    width: 78,
    height: 108,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  detailBookInfo: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-start',
  },
  detailSubjectPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 10,
  },
  detailSubjectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DCD8FF',
  },
  detailBookTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  detailBookMeta: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#C8C5DC',
  },
  detailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  detailStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  detailStatLabel: {
    marginTop: 3,
    fontSize: 10,
    color: '#BDB9D2',
  },
  detailStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  mobileSectionHeading: {
    marginTop: 24,
    marginBottom: 10,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  mobileSectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: LightColors.textPrimary,
  },
  mobileSectionHint: {
    flexShrink: 1,
    marginLeft: 12,
    fontSize: 11,
    color: LightColors.textMuted,
    textAlign: 'right',
  },
  resourceCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    marginLeft: 7,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECE9FF',
  },
  resourceCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: LightColors.primary,
  },
  contentTabs: {
    minHeight: 52,
    marginTop: 24,
    marginBottom: 10,
    padding: 4,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E9F2',
  },
  contentTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentTabActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#24203E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  contentTabDisabled: {
    opacity: 0.45,
  },
  contentTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: LightColors.textSecondary,
  },
  contentTabTextActive: {
    color: LightColors.primary,
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
    width: '100%',
  },
  flatSectionWrapper: {
    width: '100%',
  },
  chapterList: {
    paddingRight: 8,
  },
  chapterChip: {
    width: 142,
    minHeight: 76,
    marginRight: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LightColors.cardBorder,
    backgroundColor: '#FFFFFF',
  },
  chapterChipActive: {
    borderColor: '#BBB4FF',
    backgroundColor: '#F0EEFF',
  },
  chapterChipIndex: {
    marginBottom: 5,
    fontSize: 10,
    fontWeight: '800',
    color: LightColors.textMuted,
  },
  chapterChipIndexActive: {
    color: LightColors.primary,
  },
  chapterChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: LightColors.textSecondary,
  },
  chapterChipTextActive: {
    color: LightColors.primary,
  },
  lessonList: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LightColors.cardBorder,
    backgroundColor: '#FFFFFF',
  },
  lessonRow: {
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonRowActive: {
    backgroundColor: '#F0EEFF',
  },
  lessonNumber: {
    width: 30,
    height: 30,
    marginRight: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F3F8',
  },
  lessonNumberActive: {
    backgroundColor: LightColors.primary,
  },
  lessonNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: LightColors.textSecondary,
  },
  lessonNumberTextActive: {
    color: '#FFFFFF',
  },
  lessonText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: LightColors.textSecondary,
  },
  lessonTextActive: {
    fontWeight: '800',
    color: LightColors.primary,
  },
  lessonCheck: {
    width: 30,
    textAlign: 'center',
    fontSize: 20,
    color: LightColors.textMuted,
  },
  lessonCheckActive: {
    fontSize: 15,
    fontWeight: '900',
    color: LightColors.primary,
  },
  // 资源显示面板卡片
  resourcesPanelCard: {
    backgroundColor: '#FFFFFF',
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderRadius: 18,
    overflow: 'hidden',
  },
  promptPanelCard: {
    backgroundColor: '#F8FAFC',
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    padding: 16,
    borderRadius: 18,
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
    paddingVertical: 28,
    alignItems: 'center',
  },
  noResourceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LightColors.textPrimary,
    marginBottom: 5,
  },
  emptySectionsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LightColors.cardBorder,
  },
  emptySectionsText: {
    fontSize: 12,
    color: LightColors.textMuted,
  },
});
