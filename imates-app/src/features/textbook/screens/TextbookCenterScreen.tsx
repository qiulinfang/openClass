import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DownloadPausedError,
  StoredTextbookDownload,
  TextbookDownloadService,
  TextbookDownloadStatus,
} from '../services/textbook-download-service';
import { TextbookService, UserTextbookInfo } from '../services/textbook-service';
import {
  TextbookFilterSelect,
  type TextbookFilterOption,
} from '../components/TextbookFilterSelect';
import {
  MotionPressable,
  textbookMotionConfig,
  useReducedMotion,
} from '../components/TextbookMotion';

interface TextbookCenterScreenProps {
  onLearn: (textbook: UserTextbookInfo) => void;
}

interface TextbookListItem extends UserTextbookInfo {
  downloadStatus: TextbookDownloadStatus;
  downloadedFiles: number;
  totalFiles: number;
  isDownloaded: boolean;
  hasUpdatesAvailable: boolean;
  downloadProgress?: number;
}

type ResourceTab = 'all' | 'downloaded' | 'notDownloaded';

const Palette = {
  page: '#EEF1FF',
  surface: '#FFFFFF',
  ink: '#172033',
  secondary: '#65708A',
  muted: '#9AA3B8',
  line: '#E7E9F2',
  primary: '#6556E8',
  primarySoft: '#EFEDFF',
  success: '#26A269',
  successSoft: '#EAF8F1',
  danger: '#E05252',
  dangerSoft: '#FFF0F0',
  warning: '#E59232',
  warningSoft: '#FFF6E8',
};

const DEFAULT_BOOK_ICON = 'https://img.icons8.com/color/96/book.png';
const textbookKeyExtractor = (item: TextbookListItem) => item.id;

const emptyDownloadState = {
  downloadStatus: 0 as TextbookDownloadStatus,
  downloadedFiles: 0,
  totalFiles: 0,
  isDownloaded: false,
  hasUpdatesAvailable: false,
};

const mergeTextbooks = (
  textbooks: UserTextbookInfo[],
  records: StoredTextbookDownload[]
): TextbookListItem[] => {
  const recordsById = new Map(records.map((record) => [record.recordId, record]));
  return textbooks.map((textbook) => {
    const record = recordsById.get(textbook.id);
    return {
      ...textbook,
      ...(record
        ? {
            downloadStatus: record.downloadStatus,
            downloadedFiles: record.downloadedFiles,
            totalFiles: record.totalFiles,
            isDownloaded: record.isDownloaded,
            hasUpdatesAvailable: record.hasUpdatesAvailable,
          }
        : emptyDownloadState),
    };
  });
};

const statusRank = (textbook: TextbookListItem): number => {
  if (textbook.isDownloaded && textbook.hasUpdatesAvailable) return 0;
  if (!textbook.isDownloaded || textbook.downloadStatus === 0) return 1;
  if (textbook.isDownloaded && textbook.downloadStatus === 2) return 2;
  return 3;
};

const getStatusPresentation = (textbook: TextbookListItem) => {
  if (textbook.downloadStatus === 1) {
    return { text: '正在下载', color: Palette.primary, background: Palette.primarySoft };
  }
  if (textbook.downloadStatus === 3) {
    return { text: '已暂停', color: Palette.secondary, background: '#F2F4F8' };
  }
  if (textbook.isDownloaded && textbook.hasUpdatesAvailable) {
    return { text: '有更新', color: Palette.warning, background: Palette.warningSoft };
  }
  if (textbook.downloadStatus === 2 && textbook.isDownloaded) {
    return { text: '下载完成', color: Palette.success, background: Palette.successSoft };
  }
  return { text: '未下载', color: Palette.danger, background: Palette.dangerSoft };
};

interface TextbookCardProps {
  item: TextbookListItem;
  reduceMotion: boolean;
  onClear: (textbook: TextbookListItem) => void;
  onDownload: (textbook: TextbookListItem, forceRefresh?: boolean) => void;
  onLearn: (textbook: UserTextbookInfo) => void;
  onPause: (textbook: TextbookListItem) => void;
}

const TextbookCard = memo(function TextbookCard({
  item,
  reduceMotion,
  onClear,
  onDownload,
  onLearn,
  onPause,
}: TextbookCardProps) {
  const status = getStatusPresentation(item);
  const progress =
    item.downloadStatus === 1 && item.downloadProgress !== undefined
      ? item.downloadProgress
      : item.totalFiles > 0
        ? Math.min(100, Math.round((item.downloadedFiles / item.totalFiles) * 100))
        : 0;
  const canClear =
    item.isDownloaded || item.downloadStatus !== 0 || item.downloadedFiles > 0;

  return (
    <View
      style={[
        styles.textbookCard,
        item.downloadStatus === 1 && styles.textbookCardDownloading,
      ]}
    >
      {item.isDownloaded ? (
        <MotionPressable
          style={styles.downloadedMark}
          onPress={() => onClear(item)}
          reduceMotion={reduceMotion}
          pressedScale={0.88}
          accessibilityRole="button"
          accessibilityLabel={`${item.textbookName}已下载，点击可清除本地资料`}
        >
          <Text style={styles.downloadedMarkText}>✓</Text>
        </MotionPressable>
      ) : canClear ? (
        <MotionPressable
          style={styles.clearButton}
          onPress={() => onClear(item)}
          reduceMotion={reduceMotion}
          pressedScale={0.88}
          accessibilityRole="button"
          accessibilityLabel={`清除${item.textbookName}本地资料`}
        >
          <Text style={styles.clearButtonText}>×</Text>
        </MotionPressable>
      ) : null}

      <View style={styles.coverFrame}>
        <Image
          source={{ uri: item.textbookCover || DEFAULT_BOOK_ICON }}
          style={styles.cover}
          resizeMode="cover"
          fadeDuration={reduceMotion ? 0 : 180}
          progressiveRenderingEnabled
          accessible
          accessibilityLabel={`${item.textbookName}封面`}
        />
        <View style={styles.coverSpine} />
      </View>

      <View style={styles.textbookBody}>
        <View>
          <Text style={styles.textbookTitle} numberOfLines={2}>
            {item.textbookName}
          </Text>
          <View style={styles.tagRow}>
            <View style={styles.metaTag}>
              <Text style={styles.metaTagText}>{item.textbookSubjectLabel}</Text>
            </View>
            <View style={styles.metaTag}>
              <Text style={styles.metaTagText}>{item.textbookGradeLabel}</Text>
            </View>
            <View style={styles.metaTag}>
              <Text style={styles.metaTagText}>
                {item.textbookPublisher || '人教版'}
              </Text>
            </View>
          </View>
        </View>

        {item.downloadStatus === 1 ? (
          <View style={styles.cardProgressArea}>
            <View style={styles.cardProgressLabelRow}>
              <Text style={styles.cardProgressLabel}>正在下载</Text>
              <Text style={styles.cardProgressValue}>{progress}%</Text>
            </View>
            <MotionPressable
              style={styles.cardProgressTrack}
              onPress={() => onPause(item)}
              reduceMotion={reduceMotion}
              pressedScale={0.99}
              accessibilityRole="button"
              accessibilityLabel={`下载进度${progress}%，点击暂停`}
            >
              <View style={[styles.cardProgressFill, { width: `${progress}%` }]} />
            </MotionPressable>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={[styles.statusPill, { backgroundColor: status.background }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>

          {item.downloadStatus === 1 ? (
            <MotionPressable
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={() => onPause(item)}
              reduceMotion={reduceMotion}
              accessibilityRole="button"
              accessibilityLabel={`暂停下载${item.textbookName}`}
            >
              <Text style={styles.secondaryActionText}>暂停</Text>
            </MotionPressable>
          ) : item.downloadStatus === 3 ? (
            <MotionPressable
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={() => onDownload(item)}
              reduceMotion={reduceMotion}
              accessibilityRole="button"
              accessibilityLabel={`继续下载${item.textbookName}`}
            >
              <Text style={styles.secondaryActionText}>继续</Text>
            </MotionPressable>
          ) : item.isDownloaded && !item.hasUpdatesAvailable ? (
            <MotionPressable
              style={[styles.actionButton, styles.learnAction]}
              onPress={() => onLearn(item)}
              reduceMotion={reduceMotion}
              accessibilityRole="button"
              accessibilityLabel={`打开${item.textbookName}`}
            >
              <Text style={styles.learnActionText}>打开</Text>
            </MotionPressable>
          ) : item.isDownloaded && item.hasUpdatesAvailable ? (
            <MotionPressable
              style={[styles.actionButton, styles.updateAction]}
              onPress={() => onDownload(item, true)}
              reduceMotion={reduceMotion}
              accessibilityRole="button"
              accessibilityLabel={`更新${item.textbookName}`}
            >
              <Text style={styles.updateActionText}>更新</Text>
            </MotionPressable>
          ) : (
            <MotionPressable
              style={[styles.actionButton, styles.downloadAction]}
              onPress={() => onDownload(item)}
              reduceMotion={reduceMotion}
              accessibilityRole="button"
              accessibilityLabel={`下载${item.textbookName}`}
            >
              <Text style={styles.downloadActionText}>⇩ 下载</Text>
            </MotionPressable>
          )}
        </View>
      </View>
    </View>
  );
});

interface ResourceTabButtonProps {
  active: boolean;
  label: string;
  reduceMotion: boolean;
  onPress: () => void;
}

const ResourceTabButton = memo(function ResourceTabButton({
  active,
  label,
  reduceMotion,
  onPress,
}: ResourceTabButtonProps) {
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    activeProgress.stopAnimation();
    if (reduceMotion) {
      activeProgress.setValue(active ? 1 : 0);
      return undefined;
    }

    const animation = Animated.timing(activeProgress, {
      toValue: active ? 1 : 0,
      duration: active ? 220 : 140,
      easing: active ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: textbookMotionConfig.useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [active, activeProgress, reduceMotion]);

  return (
    <MotionPressable
      style={styles.resourceTab}
      onPress={onPress}
      reduceMotion={reduceMotion}
      pressedScale={0.96}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.resourceTabText,
          active && styles.resourceTabTextActive,
        ]}
      >
        {label}
      </Text>
      <Animated.View
        style={[
          styles.resourceTabIndicator,
          {
            opacity: activeProgress,
            transform: [{ scaleX: activeProgress }],
          },
        ]}
      />
    </MotionPressable>
  );
});

const AnimatedMessageBanner = memo(function AnimatedMessageBanner({
  message,
  reduceMotion,
}: {
  message: string;
  reduceMotion: boolean;
}) {
  const [displayedMessage, setDisplayedMessage] = useState(message);
  const visibility = useRef(new Animated.Value(message ? 1 : 0)).current;

  useEffect(() => {
    visibility.stopAnimation();

    if (message) {
      setDisplayedMessage(message);
      if (reduceMotion) {
        visibility.setValue(1);
        return undefined;
      }
      const animation = Animated.timing(visibility, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: textbookMotionConfig.useNativeDriver,
      });
      animation.start();
      return () => animation.stop();
    }

    if (reduceMotion) {
      visibility.setValue(0);
      setDisplayedMessage('');
      return undefined;
    }

    const animation = Animated.timing(visibility, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: textbookMotionConfig.useNativeDriver,
    });
    animation.start(({ finished }) => {
      if (finished) setDisplayedMessage('');
    });
    return () => animation.stop();
  }, [message, reduceMotion, visibility]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.messageBanner,
        {
          opacity: visibility,
          transform: [
            {
              translateY: visibility.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
            },
          ],
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.messageText}>{displayedMessage}</Text>
    </Animated.View>
  );
});

export function TextbookCenterScreen({ onLearn }: TextbookCenterScreenProps) {
  const reduceMotion = useReducedMotion();
  const [textbooks, setTextbooks] = useState<TextbookListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [resourceTab, setResourceTab] = useState<ResourceTab>('all');
  const [message, setMessage] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 2600);
  }, []);

  const refreshMergedState = useCallback(async (serverBooks: UserTextbookInfo[]) => {
    const records = await TextbookDownloadService.getRecords();
    setTextbooks(mergeTextbooks(serverBooks, records));
  }, []);

  const loadResources = useCallback(
    async (pullToRefresh = false) => {
      if (pullToRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        if (pullToRefresh) {
          await TextbookDownloadService.pauseAll();
        }
        const serverBooks = await TextbookService.fetchTextbooks();
        await TextbookDownloadService.syncServerTextbooks(serverBooks);
        await refreshMergedState(serverBooks);

        const updates = await TextbookDownloadService.checkForUpdates(serverBooks);
        if (updates.size > 0) {
          await refreshMergedState(serverBooks);
        }
      } catch (error) {
        showMessage(
          error instanceof Error ? `加载失败：${error.message}` : '加载资源失败，请稍后重试'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [refreshMergedState, showMessage]
  );

  useEffect(() => {
    let mounted = true;
    const loadCachedThenRefresh = async () => {
      const [cachedBooks, records] = await Promise.all([
        TextbookDownloadService.getCachedTextbooks(),
        TextbookDownloadService.getRecords(),
      ]);
      if (mounted && cachedBooks.length > 0) {
        setTextbooks(mergeTextbooks(cachedBooks, records));
        setIsLoading(false);
      }
      if (mounted) await loadResources(false);
    };
    void loadCachedThenRefresh();

    return () => {
      mounted = false;
      if (messageTimer.current) clearTimeout(messageTimer.current);
      void TextbookDownloadService.pauseAll();
    };
  }, [loadResources]);

  const toOptions = useCallback(
    (values: string[]): TextbookFilterOption[] => [
      { label: '全部', value: '' },
      ...Array.from(new Set(values.filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ label: value, value })),
    ],
    []
  );

  const gradeOptions = useMemo(
    () => toOptions(textbooks.map((textbook) => textbook.textbookGradeLabel)),
    [textbooks, toOptions]
  );
  const versionOptions = useMemo(
    () => toOptions(textbooks.map((textbook) => textbook.textbookPublisher)),
    [textbooks, toOptions]
  );
  const subjectOptions = useMemo(
    () => toOptions(textbooks.map((textbook) => textbook.textbookSubjectLabel)),
    [textbooks, toOptions]
  );

  const filteredTextbooks = useMemo(() => {
    const keyword = deferredSearchQuery.trim().toLocaleLowerCase();
    const matchedTextbooks = textbooks.filter((textbook) => {
        if (selectedGrade && textbook.textbookGradeLabel !== selectedGrade) return false;
        if (selectedVersion && textbook.textbookPublisher !== selectedVersion) return false;
        if (selectedSubject && textbook.textbookSubjectLabel !== selectedSubject) return false;
        if (resourceTab === 'downloaded' && !textbook.isDownloaded) return false;
        if (resourceTab === 'notDownloaded' && textbook.isDownloaded) return false;
        if (
          keyword &&
          ![
            textbook.textbookName,
            textbook.textbookSubjectLabel,
            textbook.textbookGradeLabel,
            textbook.textbookPublisher,
          ].some((value) => value?.toLocaleLowerCase().includes(keyword))
        ) return false;
        return true;
      });

    if (resourceTab === 'all') {
      const downloaded = matchedTextbooks
        .filter((textbook) => textbook.isDownloaded)
        .reverse();
      const notDownloaded = matchedTextbooks
        .filter((textbook) => !textbook.isDownloaded)
        .reverse();
      return [...downloaded, ...notDownloaded];
    }

    return matchedTextbooks.sort((a, b) => {
        const rankDifference = statusRank(a) - statusRank(b);
        if (rankDifference !== 0) return rankDifference;
        return (
          a.textbookSubjectLabel.localeCompare(b.textbookSubjectLabel) ||
          a.textbookGradeLabel.localeCompare(b.textbookGradeLabel) ||
          a.textbookName.localeCompare(b.textbookName)
        );
      });
  }, [
    selectedGrade,
    resourceTab,
    deferredSearchQuery,
    selectedSubject,
    selectedVersion,
    textbooks,
  ]);

  const updateItemState = useCallback(
    (recordId: string, updates: Partial<TextbookListItem>) => {
      setTextbooks((current) =>
        current.map((item) => (item.id === recordId ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const handleDownload = useCallback(
    async (textbook: TextbookListItem, forceRefresh = false) => {
      if (textbook.downloadStatus === 1) return;
      updateItemState(textbook.id, {
        downloadStatus: 1,
        isDownloaded: false,
        hasUpdatesAvailable: false,
        downloadProgress: 0,
      });

      try {
        let lastProgress = -1;
        let lastDownloadedFiles = -1;
        const record = await TextbookDownloadService.downloadTextbook(
          textbook,
          ({ progress, downloadedFiles, totalFiles }) => {
            if (
              progress === lastProgress &&
              downloadedFiles === lastDownloadedFiles
            ) {
              return;
            }
            lastProgress = progress;
            lastDownloadedFiles = downloadedFiles;
            updateItemState(textbook.id, {
              downloadStatus: 1,
              downloadedFiles,
              totalFiles,
              isDownloaded: false,
              downloadProgress: progress,
            });
            if (progress === 100) {
              updateItemState(textbook.id, { downloadedFiles: totalFiles });
            }
          },
          forceRefresh
        );
        updateItemState(textbook.id, {
          downloadStatus: record.downloadStatus,
          downloadedFiles: record.downloadedFiles,
          totalFiles: record.totalFiles,
          isDownloaded: record.isDownloaded,
          hasUpdatesAvailable: false,
          downloadProgress: 100,
        });
        showMessage(`《${textbook.textbookName}》下载完成`);
      } catch (error) {
        const record = await TextbookDownloadService.getRecord(textbook.id);
        if (record) {
          updateItemState(textbook.id, {
            downloadStatus: record.downloadStatus,
            downloadedFiles: record.downloadedFiles,
            totalFiles: record.totalFiles,
            isDownloaded: record.isDownloaded,
            hasUpdatesAvailable: record.hasUpdatesAvailable,
            downloadProgress:
              record.totalFiles > 0
                ? Math.round((record.downloadedFiles / record.totalFiles) * 100)
                : 0,
          });
        }
        if (error instanceof DownloadPausedError) {
          showMessage(`《${textbook.textbookName}》已暂停`);
        } else {
          showMessage(
            error instanceof Error
              ? `《${textbook.textbookName}》下载失败：${error.message}`
              : `《${textbook.textbookName}》下载失败`
          );
        }
      }
    },
    [showMessage, updateItemState]
  );

  const handlePause = useCallback(
    async (textbook: TextbookListItem) => {
      try {
        const paused = await TextbookDownloadService.pauseDownload(textbook.id);
        if (paused) {
          updateItemState(textbook.id, {
            downloadStatus: 3,
            isDownloaded: false,
          });
          showMessage(`《${textbook.textbookName}》已暂停`);
        }
      } catch (error) {
        showMessage(error instanceof Error ? error.message : '暂停失败，请重试');
      }
    },
    [showMessage, updateItemState]
  );

  const handleClear = useCallback(
    (textbook: TextbookListItem) => {
      Alert.alert(
        '清除本地资料',
        `确定要清除《${textbook.textbookName}》的本地下载资料吗？清除后需要重新下载才能离线学习。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确认清除',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await TextbookDownloadService.clearTextbook(textbook.id);
                  updateItemState(textbook.id, emptyDownloadState);
                  showMessage(`《${textbook.textbookName}》本地资料已清除`);
                } catch (error) {
                  showMessage(error instanceof Error ? error.message : '清除失败，请重试');
                }
              })();
            },
          },
        ]
      );
    },
    [showMessage, updateItemState]
  );

  const renderTextbook = useCallback(
    ({ item }: { item: TextbookListItem }) => {
      return (
        <TextbookCard
          item={item}
          reduceMotion={reduceMotion}
          onClear={handleClear}
          onDownload={handleDownload}
          onLearn={onLearn}
          onPause={handlePause}
        />
      );
    },
    [handleClear, handleDownload, handlePause, onLearn, reduceMotion]
  );
  const refreshResources = useCallback(() => {
    void loadResources(true);
  }, [loadResources]);
  const clearSearch = useCallback(() => setSearchQuery(''), []);
  const showAllResources = useCallback(() => setResourceTab('all'), []);
  const showDownloadedResources = useCallback(
    () => setResourceTab('downloaded'),
    []
  );
  const showNotDownloadedResources = useCallback(
    () => setResourceTab('notDownloaded'),
    []
  );
  const retryLoadResources = useCallback(() => {
    void loadResources(false);
  }, [loadResources]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>教材中心</Text>
        <View style={styles.headerFilters}>
          <TextbookFilterSelect
            compact
            label="教材版本"
            value={selectedVersion}
            options={versionOptions}
            onChange={setSelectedVersion}
            reduceMotion={reduceMotion}
          />
          <TextbookFilterSelect
            compact
            label="学科"
            value={selectedSubject}
            options={subjectOptions}
            onChange={setSelectedSubject}
            reduceMotion={reduceMotion}
          />
          <TextbookFilterSelect
            compact
            label="年级"
            value={selectedGrade}
            options={gradeOptions}
            onChange={setSelectedGrade}
            reduceMotion={reduceMotion}
          />
        </View>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <View style={styles.searchIcon}>
            <View style={styles.searchIconCircle} />
            <View style={styles.searchIconHandle} />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="搜索教材、知识点..."
            placeholderTextColor={Palette.muted}
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="never"
            accessibilityLabel="搜索教材"
          />
          {searchQuery ? (
            <MotionPressable
              style={styles.searchClearButton}
              onPress={clearSearch}
              reduceMotion={reduceMotion}
              pressedScale={0.88}
              accessibilityRole="button"
              accessibilityLabel="清除教材搜索内容"
            >
              <Text style={styles.searchClearText}>×</Text>
            </MotionPressable>
          ) : null}
        </View>
      </View>

      <AnimatedMessageBanner message={message} reduceMotion={reduceMotion} />

      <View style={styles.resourceTabs}>
        <ResourceTabButton
          active={resourceTab === 'all'}
          label="全部资源"
          reduceMotion={reduceMotion}
          onPress={showAllResources}
        />
        <ResourceTabButton
          active={resourceTab === 'downloaded'}
          label="已下载"
          reduceMotion={reduceMotion}
          onPress={showDownloadedResources}
        />
        <ResourceTabButton
          active={resourceTab === 'notDownloaded'}
          label="未下载"
          reduceMotion={reduceMotion}
          onPress={showNotDownloadedResources}
        />
        <View style={styles.resourceTabSpacer} />
        <Text style={styles.listCount}>{filteredTextbooks.length} 本</Text>
      </View>

      {isLoading && textbooks.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Palette.primary} size="large" />
          <Text style={styles.stateTitle}>正在整理教材</Text>
          <Text style={styles.stateText}>同步你的在线教材与本地下载状态</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTextbooks}
          renderItem={renderTextbook}
          keyExtractor={textbookKeyExtractor}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={40}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={[
            styles.listContent,
            filteredTextbooks.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshResources}
              tintColor={Palette.primary}
              colors={[Palette.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyBookIcon}>
                <Text style={styles.emptyBookGlyph}>书</Text>
              </View>
              <Text style={styles.stateTitle}>
                {textbooks.length === 0 ? '暂无教材数据' : '没有符合条件的教材'}
              </Text>
              <Text style={styles.stateText}>
                {textbooks.length === 0
                  ? '请检查网络连接后下拉刷新'
                  : '试试调整上方筛选条件'}
              </Text>
              {textbooks.length === 0 ? (
                <MotionPressable
                  style={styles.retryButton}
                  onPress={retryLoadResources}
                  reduceMotion={reduceMotion}
                  accessibilityRole="button"
                  accessibilityLabel="重新加载教材"
                >
                  <Text style={styles.retryButtonText}>重新加载</Text>
                </MotionPressable>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  pageTitle: {
    color: Palette.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerFilters: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBox: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDE2EE',
    backgroundColor: Palette.surface,
  },
  searchIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
    position: 'relative',
  },
  searchIconCircle: {
    position: 'absolute',
    left: 2,
    top: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#91A0B7',
  },
  searchIconHandle: {
    position: 'absolute',
    width: 8,
    height: 2,
    left: 14,
    top: 16,
    borderRadius: 1,
    backgroundColor: '#91A0B7',
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    minHeight: 50,
    paddingVertical: 0,
    color: Palette.ink,
    fontSize: 16,
  },
  searchClearButton: {
    width: 44,
    height: 44,
    marginRight: -10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#D9DEE9',
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  messageBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 128,
    zIndex: 20,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#27223F',
    ...Platform.select({
      ios: {
        shadowColor: '#172033',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  resourceTabs: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE2EE',
  },
  resourceTab: {
    alignSelf: 'stretch',
    minWidth: 82,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  resourceTabText: {
    color: Palette.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  resourceTabTextActive: {
    color: Palette.primary,
    fontWeight: '800',
  },
  resourceTabIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Palette.primary,
  },
  resourceTabSpacer: {
    flex: 1,
  },
  listCount: {
    color: Palette.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 36,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  textbookCard: {
    minHeight: 158,
    flexDirection: 'row',
    backgroundColor: Palette.surface,
    borderRadius: 22,
    marginBottom: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EBF3',
    ...Platform.select({
      ios: {
        shadowColor: '#4C5270',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 13,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  textbookCardDownloading: {
    borderColor: 'rgba(101, 86, 232, 0.35)',
  },
  clearButton: {
    position: 'absolute',
    right: 8,
    top: 7,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: Palette.secondary,
    fontSize: 19,
    lineHeight: 20,
    fontWeight: '400',
  },
  coverFrame: {
    width: 96,
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F1F5',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(23, 32, 51, 0.14)',
  },
  textbookBody: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 4,
    justifyContent: 'space-between',
  },
  textbookTitle: {
    color: Palette.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    paddingRight: 25,
  },
  tagRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  metaTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F2F4F8',
  },
  metaTagText: {
    color: '#334155',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  downloadedMark: {
    position: 'absolute',
    right: 10,
    top: 9,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadedMarkText: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Palette.success,
    borderRadius: 10,
    color: Palette.success,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  cardProgressArea: {
    marginTop: 'auto',
    marginBottom: 8,
  },
  cardProgressLabelRow: {
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardProgressLabel: {
    color: Palette.secondary,
    fontSize: 10,
    fontWeight: '600',
  },
  cardProgressValue: {
    color: Palette.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  cardProgressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#EEF1F6',
  },
  cardProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
  cardFooter: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    maxWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  actionButton: {
    minWidth: 76,
    height: 44,
    borderRadius: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadAction: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#AFA7FF',
  },
  downloadActionText: {
    color: Palette.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  learnAction: {
    backgroundColor: Palette.success,
  },
  learnActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  updateAction: {
    backgroundColor: Palette.warningSoft,
    borderWidth: 1,
    borderColor: '#F0C889',
  },
  updateActionText: {
    color: Palette.warning,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryAction: {
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: '#D8D3FF',
  },
  secondaryActionText: {
    color: Palette.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  progressButton: {
    flex: 1,
    maxWidth: 104,
  },
  progressTrack: {
    height: 29,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: Palette.primarySoft,
    justifyContent: 'center',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    right: undefined,
    backgroundColor: '#D9D4FF',
  },
  progressText: {
    color: Palette.primary,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerState: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  stateTitle: {
    color: Palette.ink,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 14,
  },
  stateText: {
    color: Palette.secondary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 5,
  },
  emptyBookIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  emptyBookGlyph: {
    color: Palette.primary,
    fontSize: 21,
    fontWeight: '900',
  },
  retryButton: {
    marginTop: 17,
    borderRadius: 10,
    backgroundColor: Palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
