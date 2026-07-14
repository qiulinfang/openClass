import { httpClient } from './http-client';

export interface SyncPullResponse<T> {
  success: boolean;
  code: number;
  data: {
    records: T[];
    serverTime: number;
  };
}

export interface SyncPushResponse {
  success: boolean;
  code: number;
  data: {
    serverTime: number;
  };
}

/**
 * 增量数据同步 HTTP 接口
 */
export class SyncApi {
  /**
   * 从云端拉取增量数据
   * @param module 模块名称：'chat' | 'mistake'
   * @param lastSyncTime 上次同步成功的服务器时间戳 (毫秒)
   */
  public async pull(module: 'chat' | 'mistake', lastSyncTime: number): Promise<SyncPullResponse<any>> {
    const url = `/permission/sync/pull?module=${module}&lastSyncTime=${lastSyncTime}`;
    return await httpClient.get<SyncPullResponse<any>>(url);
  }

  /**
   * 向云端推送本地修改的增量数据
   * @param module 模块名称：'chat' | 'mistake'
   * @param records 待同步的数据记录数组
   */
  public async push(module: 'chat' | 'mistake', records: any[]): Promise<SyncPushResponse> {
    const url = '/permission/sync/push';
    return await httpClient.post<SyncPushResponse>(url, {
      module,
      records
    });
  }
}
