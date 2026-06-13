/**
 * api/client.ts
 *
 * 数据获取层。所有与"曲目内容"相关的网络请求都经过这里。
 *
 * 当前实现：fetch 静态 JSON（由 scripts/build-songs.ts 生成，放在 /public/songs/）
 * 后续后端化：把 BASE_URL 换成后端地址，其余代码不用动。
 *
 * 导出：
 *   fetchManifest()  — 获取曲目列表
 *   fetchCourse(id)  — 按需加载单首曲目数据
 */

import type { Course } from '@accordion/core';

// 切换到后端时改这一行即可。
// 用 import.meta.env.BASE_URL 兼容 vite base（如 '/AccordionGo/'），dev 与生产构建都对。
const BASE_URL = `${import.meta.env.BASE_URL}songs`;

export interface SongMeta {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  file: string;
  durationSec: number;
  totalNotes: number;
}

export async function fetchManifest(): Promise<SongMeta[]> {
  const res = await fetch(`${BASE_URL}/manifest.json`);
  if (!res.ok) throw new Error(`获取曲目列表失败 (${res.status})`);
  return res.json();
}

export async function fetchCourse(meta: SongMeta): Promise<Course> {
  const res = await fetch(`${BASE_URL}/${meta.file}`);
  if (!res.ok) throw new Error(`加载曲目失败 (${res.status})`);
  return res.json();
}
