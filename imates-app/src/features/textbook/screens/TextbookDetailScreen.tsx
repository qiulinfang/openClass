import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  TextbookService,
  UserTextbookInfo,
  ChapterNode,
  LearningPackage,
  ResourceFile,
} from '../services/textbook-service';
import { TextbookDownloadService } from '../services/textbook-download-service';
import { PdfAnnotationViewer } from '../components/PdfAnnotationViewer';
import type { TextbookPracticeContext } from '../types';
import { TextbookPracticePanel } from '../components/TextbookPracticePanel';
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
  cardBackground: '#FFFFFF',
  cardBorder: '#E4E5F0',
  textPrimary: '#20243D',
  textSecondary: '#626881',
  textMuted: '#989DB2',
  primary: '#6256D9',
  warning: '#F59E0B',
  success: '#10B981',
  selectedBg: 'rgba(98, 86, 217, 0.10)',
};

// 默认占位图
const DEFAULT_BOOK_ICON = 'https://img.icons8.com/color/96/book.png';

export function TextbookDetailScreen({
  textbook,
  onBackToTextbookCenter,
  onStartPractice,
}: TextbookDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const previewTopInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top || 0,
    Platform.OS === 'ios' &&
      insets.top === 0 &&
      !initialWindowMetrics?.insets.top
      ? 44
      : 0,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0
  );
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

  // 预览资源模态框
  const [previewResource, setPreviewResource] = useState<ResourceFile | null>(
    null
  );
  const [previewStatus, setPreviewStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [previewError, setPreviewError] = useState('');
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [activeContentTab, setActiveContentTab] = useState<
    'resources' | 'practice'
  >('resources');
  const [practicePreparing, setPracticePreparing] = useState(false);
  const [preparedPractice, setPreparedPractice] =
    useState<PreparedPracticeData | null>(null);

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
  const activeResources = useMemo(() => {
    const activeSectionId = (selectedLessonId || selectedChapterId || '')
      .trim()
      .toLowerCase();
    if (!activeSectionId) return [];

    return Array.from(
      new Map(
        learningPackages
          .filter(
            (pkg) =>
              pkg.sectionId?.trim().toLowerCase() === activeSectionId
          )
          .flatMap((pkg) => pkg.resourceList || [])
          .map((resource) => [resource.id, resource])
      ).values()
    );
  }, [learningPackages, selectedChapterId, selectedLessonId]);
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
  }, []);

  const selectLesson = useCallback((lesson: ChapterNode) => {
    setSelectedLessonId(lesson.id);
    setActiveContentTab('resources');
    setPreparedPractice(null);
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
    try {
      const prepared = await TextbookPracticeService.preparePractice(
        practiceContext.textbookId,
        practiceContext.sectionId,
        practiceContext.subject,
        practiceContext.textbookRecordId
      );
      setPreparedPractice(prepared);
      setActiveContentTab('practice');
    } catch (error) {
      setActiveContentTab('resources');
      Alert.alert(
        '练习模式',
        error instanceof Error ? error.message : '练习题查询失败，请稍后重试'
      );
    } finally {
      setPracticePreparing(false);
    }
  };
  const totalResourceCount = useMemo(
    () =>
      learningPackages.reduce(
        (count, pkg) => count + (pkg.resourceList?.length || 0),
        0
      ),
    [learningPackages]
  );

  useEffect(() => {
    if (!previewResource || previewStatus !== 'loading') return;
    const timeout = setTimeout(
      () => {
        setPreviewError('文件加载超时，请检查网络后重试');
        setPreviewStatus('error');
      },
      isPdfResource(previewResource) ? 45000 : 15000
    );

    return () => clearTimeout(timeout);
  }, [previewReloadKey, previewResource, previewStatus]);

  const isPdfResource = (resource: ResourceFile | null): boolean =>
    !!resource?.fileName.toLowerCase().endsWith('.pdf');

  const getPreviewUri = (resource: ResourceFile): string => {
    return resource.fileUrl;
  };

  const previewUri = previewResource ? getPreviewUri(previewResource) : '';
  const previewReadAccessUrl =
    previewUri.startsWith('file://') && previewUri.includes('/')
      ? previewUri.slice(0, previewUri.lastIndexOf('/') + 1)
      : undefined;

  const closePreview = () => {
    setPreviewResource(null);
    setPreviewError('');
    setPreviewStatus('loading');
  };

  const retryPreview = () => {
    setPreviewStatus('loading');
    setPreviewError('');
    setPreviewReloadKey((current) => current + 1);
  };

  // 处理点击教材，拉取该教材的目录树和所有微课视频/课件资源
  const handleTextbookPress = useCallback(async (item: UserTextbookInfo) => {
    setCatalogTree([]);
    setLearningPackages([]);
    setSelectedChapterId(null);
    setSelectedLessonId(null);
    setActiveContentTab('resources');
    setPreparedPractice(null);
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
          : TextbookService.fetchSectionTree(item.id),
        cachedPackages
          ? Promise.resolve(cachedPackages)
          : TextbookService.fetchLearningPackages(item.id, item.textbookId),
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

  // 获取文件后缀并选择图标
  const getFileIcon = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (
      name.endsWith('.mp4') ||
      name.endsWith('.m3u8') ||
      name.endsWith('.avi')
    ) {
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

  // 渲染微课资源文件行
  const renderResourceItem = (res: ResourceFile) => {
    const icon = getFileIcon(res.fileName);
    return (
      <TouchableOpacity
        key={res.id}
        style={styles.resourceRow}
        onPress={() => {
          setPreviewStatus('loading');
          setPreviewError('');
          setPreviewResource(res);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.resourceLeft}>
          <View style={styles.fileIconBox}>
            <Text style={styles.fileIconText}>{icon}</Text>
          </View>
          <View style={styles.resourceNameCol}>
            <Text style={styles.resourceName} numberOfLines={2}>
              {res.fileName}
            </Text>
            <Text style={styles.resourceSize}>
              {isPdfResource(res) ? 'PDF 课件' : '学习资源'} ·{' '}
              {formatFileSize(res.size)}
            </Text>
          </View>
        </View>
        <View style={styles.previewBtn}>
          <Text style={styles.previewBtnText}>打开</Text>
          <Text style={styles.previewChevron}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // 渲染没有章节目录树时的扁平资源包列表 (公开课兼容)
  const renderFlatPackages = () => {
    return learningPackages.map((pkg) => {
      const allFiles = pkg.resourceList || [];
      return (
        <View key={pkg.id} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle} numberOfLines={1}>
              {pkg.packageName || '共享资源包'}
            </Text>
          </View>
          {pkg.description ? (
            <Text
              style={{
                fontSize: 11,
                color: LightColors.textSecondary,
                marginBottom: 8,
                paddingHorizontal: 4,
              }}
            >
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
        </View>
      );
    });
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
                        学习资源
                      </Text>
                      {activeResources.length > 0 ? (
                        <View style={styles.resourceCountBadge}>
                          <Text style={styles.resourceCountText}>
                            {activeResources.length}
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
                      accessibilityLabel="当前课节练习模式"
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
                          练习模式
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {activeContentTab === 'resources' ? (
                    selectedLessonId || selectedChapterId ? (
                      <View style={styles.resourcesPanelCard}>
                        {activeResources.length > 0 ? (
                          activeResources.map(renderResourceItem)
                        ) : (
                          <View style={styles.noResourceBox}>
                            <Text style={styles.noResourceTitle}>
                              本课节暂无学习文件
                            </Text>
                            <Text style={styles.noResourceText}>
                              可选择其他课节继续查看
                            </Text>
                          </View>
                        )}
                      </View>
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
                    <View style={styles.promptPanelCard}>
                      {practicePreparing ? (
                        <ActivityIndicator
                          size="small"
                          color={LightColors.primary}
                        />
                      ) : (
                        <Text style={styles.promptPanelText}>
                          请先选择一个有练习题的课节
                        </Text>
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
                    renderFlatPackages()
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

      {/* 资源在线学习预览 Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={!!previewResource}
        presentationStyle="fullScreen"
        statusBarTranslucent={false}
        onRequestClose={closePreview}
      >
        <View style={styles.previewSafeArea}>
          <View
            style={[styles.previewHeader, { paddingTop: previewTopInset + 8 }]}
          >
            <TouchableOpacity
              style={styles.previewBackBtn}
              onPress={closePreview}
              accessibilityRole="button"
              accessibilityLabel="返回教材详情"
            >
              <Text style={styles.previewBackIcon}>‹</Text>
            </TouchableOpacity>
            <View style={styles.previewHeading}>
              <Text style={styles.previewEyebrow}>
                {isPdfResource(previewResource) ? 'PDF 课件' : '学习资源'}
              </Text>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {previewResource?.fileName || '文件预览'}
              </Text>
            </View>
            <View style={styles.previewHeaderSpacer} />
          </View>

          <View style={styles.previewBody}>
            {previewResource?.fileUrl && previewUri ? (
              <>
                {isPdfResource(previewResource) ? (
                  <PdfAnnotationViewer
                    resource={previewResource}
                    reloadKey={previewReloadKey}
                    onReady={() => setPreviewStatus('ready')}
                    onError={(message) => {
                      setPreviewError(message);
                      setPreviewStatus('error');
                    }}
                  />
                ) : (
                  <WebView
                    key={`${previewResource.id}-${previewReloadKey}`}
                    source={{ uri: previewUri }}
                    style={styles.webView}
                    originWhitelist={['*']}
                    allowFileAccess={true}
                    allowFileAccessFromFileURLs={true}
                    allowUniversalAccessFromFileURLs={true}
                    {...(Platform.OS === 'ios' && previewReadAccessUrl
                      ? { allowingReadAccessToURL: previewReadAccessUrl }
                      : {})}
                    startInLoadingState={false}
                    onLoadStart={() => setPreviewStatus('loading')}
                    onLoadProgress={({ nativeEvent }) => {
                      if (nativeEvent.progress >= 0.9)
                        setPreviewStatus('ready');
                    }}
                    onLoad={() => setPreviewStatus('ready')}
                    onError={({ nativeEvent }) => {
                      setPreviewError(
                        nativeEvent.description || '文件加载失败'
                      );
                      setPreviewStatus('error');
                    }}
                    onHttpError={({ nativeEvent }) => {
                      if (nativeEvent.url === previewUri) {
                        setPreviewError(
                          `文件请求失败（HTTP ${nativeEvent.statusCode}）`
                        );
                        setPreviewStatus('error');
                      }
                    }}
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                  />
                )}
                {previewStatus === 'loading' ? (
                  <View style={styles.webViewLoading}>
                    <ActivityIndicator
                      size="large"
                      color={LightColors.primary}
                    />
                    <Text style={styles.webViewLoadingTitle}>正在打开文件</Text>
                    <Text style={styles.webViewLoadingText}>
                      {isPdfResource(previewResource)
                        ? '正在准备 PDF 阅读器…'
                        : '正在加载学习资源…'}
                    </Text>
                  </View>
                ) : null}
                {previewStatus === 'error' ? (
                  <View style={styles.previewErrorState}>
                    <View style={styles.previewErrorIcon}>
                      <Text style={styles.previewErrorIconText}>!</Text>
                    </View>
                    <Text style={styles.previewErrorTitle}>文件未能打开</Text>
                    <Text style={styles.previewErrorMessage}>
                      {previewError || '文件地址不可访问，请稍后重试'}
                    </Text>
                    <TouchableOpacity
                      style={styles.previewRetryButton}
                      onPress={retryPreview}
                    >
                      <Text style={styles.previewRetryText}>重新加载</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.modalEmpty}>
                <Text style={styles.previewErrorTitle}>暂无可用地址</Text>
                <Text style={styles.modalEmptyText}>
                  该文件暂时无法在线预览
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
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
    width: '100%',
  },
  flatSectionWrapper: {
    width: '100%',
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
    paddingVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
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
  sectionCard: {
    width: '100%',
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
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
    minHeight: 68,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: LightColors.cardBorder,
  },
  resourceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  fileIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    backgroundColor: '#F0EEFF',
  },
  fileIconText: {
    fontSize: 20,
  },
  resourceNameCol: {
    flex: 1,
  },
  resourceName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  resourceSize: {
    fontSize: 10,
    color: LightColors.textMuted,
    marginTop: 4,
  },
  previewBtn: {
    minWidth: 54,
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
  },
  previewBtnText: {
    fontSize: 11,
    color: LightColors.primary,
    fontWeight: '700',
  },
  previewChevron: {
    marginLeft: 2,
    marginTop: -1,
    fontSize: 20,
    lineHeight: 20,
    color: LightColors.primary,
  },
  noResourceText: {
    fontSize: 11,
    color: LightColors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
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

  // ==================== 资源学习预览 Modal ====================
  previewSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: LightColors.cardBorder,
    backgroundColor: '#FFFFFF',
    zIndex: 20,
    elevation: 10,
  },
  previewBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
  },
  previewBackIcon: {
    color: LightColors.primary,
    fontSize: 34,
    lineHeight: 36,
    marginTop: -2,
  },
  previewHeading: {
    flex: 1,
    marginHorizontal: 10,
    alignItems: 'center',
  },
  previewEyebrow: {
    marginBottom: 2,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: LightColors.primary,
  },
  previewTitle: {
    maxWidth: '100%',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: LightColors.textPrimary,
  },
  previewHeaderSpacer: {
    width: 44,
    height: 44,
  },
  previewBody: {
    flex: 1,
    backgroundColor: '#ECEEF5',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ECEEF5',
  },
  webViewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F7F7FC',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  webViewLoadingTitle: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '800',
    color: LightColors.textPrimary,
  },
  webViewLoadingText: {
    marginTop: 5,
    fontSize: 11,
    color: LightColors.textSecondary,
  },
  previewErrorState: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7FC',
    zIndex: 8,
  },
  previewErrorIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#FFF0F0',
  },
  previewErrorIconText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#D64B4B',
  },
  previewErrorTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    color: LightColors.textPrimary,
  },
  previewErrorMessage: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 12,
    lineHeight: 18,
    color: LightColors.textSecondary,
    textAlign: 'center',
  },
  previewRetryButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LightColors.primary,
  },
  previewRetryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  modalEmptyText: {
    marginTop: 8,
    fontSize: 12,
    color: LightColors.textMuted,
  },
});
