import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { ResourceFile } from '../services/textbook-service';
import { TextbookService } from '../services/textbook-service';

const OFFICE_TYPES: Record<
  string,
  { mimeType: string; UTI?: string }
> = {
  xls: {
    mimeType: 'application/vnd.ms-excel',
    UTI: 'com.microsoft.excel.xls',
  },
  xlsx: {
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  },
  doc: {
    mimeType: 'application/msword',
    UTI: 'com.microsoft.word.doc',
  },
  docx: {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    UTI: 'org.openxmlformats.wordprocessingml.document',
  },
  ppt: {
    mimeType: 'application/vnd.ms-powerpoint',
    UTI: 'com.microsoft.powerpoint.ppt',
  },
  pptx: {
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    UTI: 'org.openxmlformats.presentationml.presentation',
  },
};

const getExtension = (fileName: string): string =>
  fileName.split('.').pop()?.toLowerCase() || '';

const getLocalOfficeUri = async (resource: ResourceFile): Promise<string> => {
  if (
    resource.fileUrl.startsWith('file://') ||
    resource.fileUrl.startsWith('content://')
  ) {
    return resource.fileUrl;
  }

  const sourceUri = resource.remoteUrl || resource.fileUrl;
  if (!sourceUri) throw new Error('办公文件地址不可用');

  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('设备缓存目录不可用');

  const safeName = `${resource.id}-${resource.checksum || resource.size || 0}-${resource.fileName}`
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-180);
  const localUri = `${cacheDirectory}office-${safeName}`;
  const cached = await FileSystem.getInfoAsync(localUri);
  if (cached.exists) return localUri;

  const headers = await TextbookService.getYanbanAuthHeaders();
  const result = await FileSystem.downloadAsync(sourceUri, localUri, {
    headers,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`办公文件下载失败（HTTP ${result.status}）`);
  }
  return result.uri;
};

export const openOfficeResource = async (
  resource: ResourceFile
): Promise<void> => {
  const externalUri = resource.remoteUrl || resource.fileUrl;
  if (!externalUri) throw new Error('办公文件地址不可用');

  if (Platform.OS === 'web') {
    window.open(externalUri, '_blank', 'noopener,noreferrer');
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    const localUri = await getLocalOfficeUri(resource);
    const options = OFFICE_TYPES[getExtension(resource.fileName)];
    await Sharing.shareAsync(localUri, {
      dialogTitle: '选择打开方式',
      mimeType: options?.mimeType,
      UTI: options?.UTI,
    });
    return;
  }

  await Linking.openURL(externalUri);
};

