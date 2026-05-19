/**
 * hooks/useSongs.ts
 *
 * 曲目数据 hook。
 *
 * - 首次挂载时 fetch manifest（曲目列表元数据）
 * - loadCourse(meta) 按需 fetch 单首完整数据（Course），并缓存在内存中
 *
 * 返回值：
 *   songs    — 元数据列表（来自 manifest.json）
 *   loading  — 初始加载状态
 *   error    — fetch 错误信息
 *   loadCourse(meta) — 返回 Promise<Course>，已加载过的会直接从缓存返回
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Course } from '@accordion/core';
import { fetchManifest, fetchCourse, type SongMeta } from '../api/client';

interface UseSongsResult {
  songs: SongMeta[];
  loading: boolean;
  error: string | null;
  loadCourse: (meta: SongMeta) => Promise<Course>;
}

export function useSongs(): UseSongsResult {
  const [songs, setSongs]   = useState<SongMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const cache = useRef<Map<string, Course>>(new Map());

  useEffect(() => {
    fetchManifest()
      .then(setSongs)
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const loadCourse = useCallback(async (meta: SongMeta): Promise<Course> => {
    if (cache.current.has(meta.id)) return cache.current.get(meta.id)!;
    const course = await fetchCourse(meta);
    cache.current.set(meta.id, course);
    return course;
  }, []);

  return { songs, loading, error, loadCourse };
}
