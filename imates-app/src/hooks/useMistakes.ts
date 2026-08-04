import { useState, useCallback, useEffect, useRef } from 'react';
import { MistakeService, MistakeItem } from '@/services/mistake-service';
import { SyncService } from '@/services/sync-service';

export interface UseMistakesOptions {
  active?: boolean;
  searchQuery?: string;
}

export function useMistakes(options: UseMistakesOptions = {}) {
  const { active = true, searchQuery = '' } = options;

  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('全部学科');
  const isFetchingRef = useRef(false);

  const loadMistakes = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setIsLoading(true);
      const data = await MistakeService.getMistakes();
      setMistakes(data);
    } catch (e) {
      console.warn('[useMistakes] 加载错题失败:', e);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const refreshMistakes = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await SyncService.syncMistakes();
      await loadMistakes();
    } catch (e) {
      console.warn('[useMistakes] 刷新错题同步失败:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadMistakes]);

  const removeMistake = useCallback(async (id: string) => {
    try {
      await MistakeService.removeMistake(id);
      setMistakes(prev => prev.filter(m => m.id !== id && m.bmNo !== id));
      SyncService.syncMistakes();
    } catch (e) {
      console.warn('[useMistakes] 移除错题失败:', e);
    }
  }, []);

  useEffect(() => {
    if (active) {
      loadMistakes();
      SyncService.syncMistakes().then(() => {
        loadMistakes();
      });
    }
  }, [active, loadMistakes]);

  return {
    mistakes,
    isLoading,
    isRefreshing,
    selectedSubject,
    setSelectedSubject,
    loadMistakes,
    refreshMistakes,
    removeMistake,
  };
}
