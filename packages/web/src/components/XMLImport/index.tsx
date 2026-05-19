import React, { useState, useCallback, useRef } from 'react';
import type { Course } from '@accordion/core';
import { parseMusicXML } from '../../score/MusicXMLParser';
import styles from './XMLImport.module.css';

interface Props {
  onImport: (course: Course) => void;
}

type State =
  | { phase: 'idle' }
  | { phase: 'parsing' }
  | { phase: 'preview'; course: Course; warnings: string[]; stats: { totalNotes: number; outOfRange: number; durationSec: number } }
  | { phase: 'error'; message: string };

export function XMLImport({ onImport }: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xml|musicxml)$/i)) {
      setState({ phase: 'error', message: '请选择 .xml 或 .musicxml 文件' });
      return;
    }
    setState({ phase: 'parsing' });
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseMusicXML(e.target!.result as string);
        setState({ phase: 'preview', course: result.course, warnings: result.warnings, stats: result.stats });
      } catch (err) {
        setState({ phase: 'error', message: err instanceof Error ? err.message : '解析失败' });
      }
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleConfirm = useCallback(() => {
    if (state.phase !== 'preview') return;
    onImport(state.course);
    setState({ phase: 'idle' });
  }, [state, onImport]);

  if (state.phase === 'preview') {
    const { course, warnings, stats } = state;
    const mins = Math.floor(stats.durationSec / 60);
    const secs = Math.round(stats.durationSec % 60);
    return (
      <div className={styles.preview}>
        <div className={styles.previewTitle}>🎵 {course.title}</div>
        <div className={styles.previewStats}>
          <span>{stats.totalNotes - stats.outOfRange} 个音符</span>
          <span>约 {mins > 0 ? `${mins}分` : ''}{secs}秒</span>
        </div>
        {warnings.map((w, i) => (
          <div key={i} className={styles.warning}>⚠ {w}</div>
        ))}
        <div className={styles.previewActions}>
          <button className={styles.confirmBtn} onClick={handleConfirm}>导入并演奏 ▶</button>
          <button className={styles.cancelBtn} onClick={() => setState({ phase: 'idle' })}>取消</button>
        </div>
      </div>
    );
  }

  let dropContent: React.ReactNode;
  if (state.phase === 'parsing') {
    dropContent = <span className={styles.hint}>解析中…</span>;
  } else if (state.phase === 'error') {
    dropContent = (
      <>
        <span className={styles.errorMsg}>✕ {state.message}</span>
        <span className={styles.hint}>点击重试</span>
      </>
    );
  } else {
    dropContent = (
      <>
        <span className={styles.icon}>🎼</span>
        <span className={styles.label}>拖入 MusicXML 文件</span>
        <span className={styles.hint}>或点击选择 .xml / .musicxml</span>
      </>
    );
  }

  return (
    <div
      className={`${styles.dropZone} ${dragging ? styles.dragging : ''} ${state.phase === 'error' ? styles.hasError : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.musicxml"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {dropContent}
    </div>
  );
}
