import type {
  LearningPackage,
  ResourceFile,
} from '../services/textbook-service';

export type LearningResourceKind =
  | 'pdf'
  | 'video'
  | 'image'
  | 'html'
  | 'office'
  | 'audio'
  | 'text'
  | 'archive'
  | 'unknown';

export interface LearningResourceMeta {
  kind: LearningResourceKind;
  label: string;
  shortLabel: string;
  accent: string;
  background: string;
}

const META: Record<LearningResourceKind, Omit<LearningResourceMeta, 'kind'>> = {
  pdf: {
    label: 'PDF 课件',
    shortLabel: 'PDF',
    accent: '#D94B53',
    background: '#FFF0F1',
  },
  video: {
    label: '微课视频',
    shortLabel: 'VIDEO',
    accent: '#6B55D9',
    background: '#F0EEFF',
  },
  image: {
    label: '图片资料',
    shortLabel: 'IMAGE',
    accent: '#2C8C78',
    background: '#EAF8F4',
  },
  html: {
    label: '互动课件',
    shortLabel: 'HTML',
    accent: '#D36B2C',
    background: '#FFF3E8',
  },
  office: {
    label: 'Office 文档',
    shortLabel: 'DOC',
    accent: '#2F6DB0',
    background: '#EAF3FC',
  },
  audio: {
    label: '音频资料',
    shortLabel: 'AUDIO',
    accent: '#A1498A',
    background: '#F9ECF6',
  },
  text: {
    label: '文本资料',
    shortLabel: 'TEXT',
    accent: '#5C667A',
    background: '#EFF1F5',
  },
  archive: {
    label: '压缩文件',
    shortLabel: 'ZIP',
    accent: '#8A6A35',
    background: '#F8F1E5',
  },
  unknown: {
    label: '学习资源',
    shortLabel: 'FILE',
    accent: '#687086',
    background: '#F0F1F5',
  },
};

const getExtension = (fileName: string): string => {
  const cleanName = fileName.split(/[?#]/, 1)[0];
  const dotIndex = cleanName.lastIndexOf('.');
  return dotIndex >= 0 ? cleanName.slice(dotIndex + 1).toLowerCase() : '';
};

export const getLearningResourceKind = (
  resource: Pick<ResourceFile, 'fileName' | 'mimeType'>
): LearningResourceKind => {
  const extension = getExtension(resource.fileName);
  const mimeType = resource.mimeType?.toLowerCase() || '';

  if (extension === 'pdf' || mimeType.includes('pdf')) return 'pdf';
  if (
    ['mp4', 'm3u8', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(
      extension
    ) ||
    mimeType.startsWith('video/')
  ) {
    return 'video';
  }
  if (
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(
      extension
    ) ||
    mimeType.startsWith('image/')
  ) {
    return 'image';
  }
  if (['html', 'htm'].includes(extension) || mimeType.includes('html')) {
    return 'html';
  }
  if (
    ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension) ||
    mimeType.includes('officedocument') ||
    mimeType.includes('msword') ||
    mimeType.includes('ms-excel') ||
    mimeType.includes('ms-powerpoint')
  ) {
    return 'office';
  }
  if (
    ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(extension) ||
    mimeType.startsWith('audio/')
  ) {
    return 'audio';
  }
  if (
    ['txt', 'md', 'json', 'csv', 'xml'].includes(extension) ||
    mimeType.startsWith('text/')
  ) {
    return 'text';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
  return 'unknown';
};

export const getLearningResourceMeta = (
  resource: Pick<ResourceFile, 'fileName' | 'mimeType'>
): LearningResourceMeta => {
  const kind = getLearningResourceKind(resource);
  return { kind, ...META[kind] };
};

export const formatLearningResourceSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '未知大小';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  return `${Number((bytes / 1024 ** unitIndex).toFixed(2))} ${units[unitIndex]}`;
};

export const getUniqueLearningResources = (
  packages: LearningPackage[]
): ResourceFile[] =>
  Array.from(
    new Map(
      packages
        .flatMap((item) => item.resourceList || [])
        .map((resource) => [resource.id, resource])
    ).values()
  );

export const getLearningResourcePreviewUri = (
  resource: ResourceFile,
  kind = getLearningResourceKind(resource)
): string => {
  if (kind !== 'office') return resource.fileUrl;

  const remoteUri = resource.remoteUrl || resource.fileUrl;
  if (!/^https?:\/\//i.test(remoteUri)) return resource.fileUrl;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    remoteUri
  )}`;
};
