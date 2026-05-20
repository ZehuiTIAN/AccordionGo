/**
 * App.tsx
 *
 * 应用根组件。管理两个屏幕：首页（home）和关卡播放页（play）。
 *
 * 曲目来源：
 *   1. 内置曲目：直接 import 的 TypeScript 常量（twinkleStar）
 *   2. XML 导入曲目：useSongs hook 从 /songs/manifest.json 加载，
 *      由 scripts/build-songs.ts 在构建时从 content/songs/ 生成
 *   3. 运行时上传：XMLImport 组件处理（适合开发/测试用）
 */

import { useState } from 'react';
import type { Course, Level } from '@accordion/core';
import { LessonPlayer } from './components/LessonPlayer';
import { XMLImport } from './components/XMLImport';
import { useSongs } from './hooks/useSongs';
import { twinkleStar } from './content/twinkleStar';
import './App.css';

type Screen = 'home' | 'play';

export function App() {
  const [screen, setScreen]   = useState<Screen>('home');
  const [activeLevel, setActiveLevel] = useState<Level | null>(null);
  const [runtimeCourses, setRuntimeCourses] = useState<Course[]>([]);

  const { songs, loading: songsLoading, error: songsError, loadCourse } = useSongs();

  const startLevel = (level: Level) => { setActiveLevel(level); setScreen('play'); };

  const handleStartSong = async (meta: Parameters<typeof loadCourse>[0]) => {
    try {
      const course = await loadCourse(meta);
      startLevel(course.levels[0]);
    } catch (e) {
      console.error(e);
      alert(`加载曲目失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  if (screen === 'play' && activeLevel) {
    return <LessonPlayer level={activeLevel} onBack={() => setScreen('home')} />;
  }

  return (
    <div className="home">
      <div className="hero">
        <div className="noteDecor" aria-hidden="true">
          <span>♩</span><span>♫</span><span>♪</span><span>♬</span>
        </div>
        <div className="logo">🪗</div>
        <h1 className="appName">AccordionGo</h1>
        <p className="tagline">10 分钟学会一首歌，零基础也能演奏手风琴</p>
        <div className="pianoAccent" aria-hidden="true" />
      </div>

      {/* Built-in courses */}
      <div className="courseSection">
        <h2 className="sectionTitle">内置曲目</h2>
        <CourseCard course={twinkleStar} onStart={startLevel} />
      </div>

      {/* Songs from content/songs/ (built by scripts/build-songs.ts) */}
      {(songsLoading || songs.length > 0 || songsError) && (
        <div className="courseSection">
          <h2 className="sectionTitle">曲目库</h2>
          {songsLoading ? (
            <p className="importHint">加载中…</p>
          ) : songsError ? (
            <p className="importHint" style={{ color: '#e55' }}>加载失败：{songsError}</p>
          ) : (
            songs.map(meta => (
              <div key={meta.id} className="courseCard">
                <div className="courseInfo">
                  <span className="courseDifficulty">{'★'.repeat(meta.difficulty)}{'☆'.repeat(5 - meta.difficulty)}</span>
                  <h3 className="courseTitle">{meta.title}</h3>
                  <p className="courseDesc">{meta.totalNotes} 个音符 · 约 {Math.round(meta.durationSec)}秒</p>
                </div>
                <div className="levelButtons">
                  <button className="levelBtn demo" onClick={() => handleStartSong(meta)}>▶ 演示</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Runtime XML upload (dev/test convenience) */}
      <div className="courseSection">
        <h2 className="sectionTitle">临时导入</h2>
        <XMLImport onImport={c => setRuntimeCourses(prev => [c, ...prev])} />
        <p className="importHint">
          正式添加曲目请将 .xml 放入 <code>content/songs/</code> 并运行 <code>pnpm songs</code>
        </p>
      </div>

      {runtimeCourses.length > 0 && (
        <div className="courseSection">
          {runtimeCourses.map(course => (
            <CourseCard key={course.id} course={course} onStart={startLevel} />
          ))}
        </div>
      )}

      <footer className="footer">♩ MVP Demo · Phase 1</footer>
    </div>
  );
}

function CourseCard({ course, onStart }: { course: Course; onStart: (l: Level) => void }) {
  const stars = '★'.repeat(course.difficulty) + '☆'.repeat(5 - course.difficulty);
  return (
    <div className="courseCard">
      <div className="courseInfo">
        <span className="courseDifficulty">{stars}</span>
        <h3 className="courseTitle">{course.title}</h3>
      </div>
      <div className="levelButtons">
        {course.levels.map(level => (
          <button key={level.id} className={`levelBtn ${level.mode}`} onClick={() => onStart(level)}>
            {level.mode === 'demo' ? '▶ 演示' : '✋ 跟练'}
          </button>
        ))}
      </div>
    </div>
  );
}
