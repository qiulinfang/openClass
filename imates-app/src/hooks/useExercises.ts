import { useState, useCallback, useEffect, useRef } from 'react';
import { ExerciseService, ExerciseItem } from '@/services/exercise-service';

export interface UseExercisesOptions {
  active?: boolean;
}

export function useExercises(options: UseExercisesOptions = {}) {
  const { active = true } = options;

  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [savedExerciseIds, setSavedExerciseIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('全部学科');
  const isFetchingRef = useRef(false);

  const loadExercises = useCallback(async (force = false) => {
    if (isFetchingRef.current && !force) return;
    isFetchingRef.current = true;
    try {
      setIsLoading(true);
      const data = await ExerciseService.getExercises();
      setExercises(data);

      const idsMap: Record<string, boolean> = {};
      data.forEach((ex) => {
        idsMap[ex.id] = true;
      });
      setSavedExerciseIds(idsMap);
    } catch (e) {
      console.warn('[useExercises] 加载自选习题失败:', e);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const refreshExercises = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadExercises();
    } catch (e) {
      console.warn('[useExercises] 刷新习题库失败:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadExercises]);

  const toggleExercise = useCallback(
    async (item: Omit<ExerciseItem, 'timestamp'>): Promise<boolean> => {
      try {
        const saved = await ExerciseService.toggleExercise(item);
        if (saved) {
          setExercises((prev) => [
            ...prev,
            { ...item, timestamp: Date.now() },
          ]);
          setSavedExerciseIds((prev) => ({ ...prev, [item.id]: true }));
        } else {
          setExercises((prev) => prev.filter((ex) => ex.id !== item.id));
          setSavedExerciseIds((prev) => {
            const next = { ...prev };
            delete next[item.id];
            return next;
          });
        }
        return saved;
      } catch (e) {
        console.warn('[useExercises] 切换习题收藏状态失败:', e);
        return false;
      }
    },
    []
  );

  useEffect(() => {
    if (active) {
      loadExercises();
    }
  }, [active, loadExercises]);

  return {
    exercises,
    savedExerciseIds,
    isLoading,
    isRefreshing,
    selectedSubject,
    setSelectedSubject,
    loadExercises,
    refreshExercises,
    toggleExercise,
  };
}
