/**
 * progress/types.ts
 *
 * 学习进度的数据类型和存储接口。
 *
 * ProgressStore 是平台无关接口：
 *   Web 实现用 localStorage，小程序实现用 wx.setStorageSync。
 * （当前 MVP 尚未实现具体 adapter，仅定义接口。）
 */

export interface LevelProgress {
  levelId: string;
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  playCount: number;
  lastPlayedAt: number; // timestamp
}

export interface ProgressStore {
  getProgress(levelId: string): LevelProgress | null;
  saveProgress(progress: LevelProgress): void;
  getAllProgress(): LevelProgress[];
}
