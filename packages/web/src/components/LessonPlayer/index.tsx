/**
 * components/LessonPlayer/index.tsx
 *
 * 关卡播放页。持有 LessonEngine 和 WebAudioEngine 实例，将引擎回调桥接到 React state。
 *
 * 状态：
 *   status      — 来自 LessonEngine 的引擎状态（当前事件、高亮键等）
 *   pressedKeys — 用户实际触发或演示模式自动触发的按键视觉反馈（短暂高亮）
 *   wrongFlash  — 答错时全屏红闪
 *   lyric       — 当前事件的歌词
 *   progress    — 进度条百分比（0–100）
 *   mirrored    — 手风琴视角切换（演奏者视角 / 观众视角）
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Level, EngineStatus } from '@accordion/core';
import { LessonEngine } from '@accordion/core';
import { AccordionView } from '../AccordionView';
import { WebAudioEngine } from '../../adapters/WebAudioEngine';
import { pianoAccordionConfig } from '@accordion/core';
import styles from './LessonPlayer.module.css';

interface Props {
  level: Level;
  onBack: () => void;
  onFinish?: () => void;
}

export function LessonPlayer({ level, onBack, onFinish }: Props) {
  const engineRef      = useRef(new LessonEngine());
  const audioRef       = useRef(new WebAudioEngine());
  const wrongFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressedTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<EngineStatus>({
    state: 'idle',
    currentEventIndex: 0,
    currentEvent: null,
    activeKeys: new Set(),
  });
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [lyric, setLyric]       = useState('');
  const [progress, setProgress] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [mirrored, setMirrored] = useState(false);

  useEffect(() => {
    const engine = engineRef.current;
    const audio  = audioRef.current;

    engine.onPlayNote = (event) => {
      if (event.notes) {
        if (event.notes.hand === 'right') {
          event.notes.midi.forEach(m => audio.playNote(m, event.notes!.duration));
        } else {
          audio.playChord(event.notes.midi, event.notes!.duration);
        }
        if (level.mode === 'demo') {
          if (pressedTimer.current) clearTimeout(pressedTimer.current);
          setPressedKeys(new Set(event.notes.keys));
          pressedTimer.current = setTimeout(() => setPressedKeys(new Set()), event.notes.duration * 0.8);
        }
      }
      if (event.lyric) setLyric(event.lyric);
    };

    const unsub = engine.subscribe((s) => {
      setStatus(s);
      setProgress(level.events.length > 0 ? (s.currentEventIndex / level.events.length) * 100 : 0);
      if (s.state === 'wrong') {
        if (wrongFlashTimer.current) clearTimeout(wrongFlashTimer.current);
        setWrongFlash(true);
        wrongFlashTimer.current = setTimeout(() => setWrongFlash(false), 600);
      }
      if (s.state === 'finished') {
        setLyric('🎉 完成！');
        onFinish?.();
      }
    });

    engine.load(level);
    return () => {
      engine.stop();
      unsub();
      if (wrongFlashTimer.current) clearTimeout(wrongFlashTimer.current);
      if (pressedTimer.current)    clearTimeout(pressedTimer.current);
    };
  }, [level, onFinish]);

  const handleStart = useCallback(async () => {
    await audioRef.current.init();
    engineRef.current.start();
  }, []);

  const handleKeyPress = useCallback((keyId: string, midis: number[]) => {
    midis.forEach(m => audioRef.current.playNote(m, 400));

    if (pressedTimer.current) clearTimeout(pressedTimer.current);
    setPressedKeys(new Set([keyId]));
    pressedTimer.current = setTimeout(() => {
      setPressedKeys(prev => prev.has(keyId) ? (prev.delete(keyId), new Set(prev)) : prev);
    }, 200);

    if (level.mode === 'guided') engineRef.current.pressKey(keyId);
  }, [level.mode]);

  const isWaiting  = status.state === 'waiting_input';
  const isPlaying  = status.state === 'playing';
  const isFinished = status.state === 'finished';
  const isReady    = status.state === 'ready';

  // Only highlight keys when the engine is actively showing the next note to play
  const activeKeys = (isWaiting || isPlaying) && status.currentEvent?.notes
    ? new Set(status.currentEvent.notes.keys)
    : new Set<string>();

  return (
    <div className={`${styles.player} ${wrongFlash ? styles.wrongFlash : ''}`}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <h2 className={styles.title}>{level.title}</h2>
        <div className={styles.modeTag}>{level.mode === 'demo' ? '演示' : '跟练'}</div>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.lyricArea}>
        <span className={styles.lyric}>{lyric || (isWaiting ? '按下高亮的键 ↓' : '')}</span>
      </div>

      {isWaiting && <div className={styles.waitingHint}>等待你的按键…</div>}

      <div className={styles.keyboard}>
        <div className={styles.viewToggleRow}>
          <button
            className={styles.viewToggleBtn}
            onClick={() => setMirrored(m => !m)}
          >
            {mirrored ? '演奏者视角 ↔' : '观众视角 ↔'}
          </button>
        </div>
        <AccordionView
          config={pianoAccordionConfig}
          activeKeys={activeKeys}
          pressedKeys={pressedKeys}
          onKeyPress={handleKeyPress}
          mirrored={mirrored}
        />
      </div>

      <div className={styles.controls}>
        {(isReady || isFinished) && (
          <button className={styles.startBtn} onClick={handleStart}>
            {isFinished ? '再来一次 🔁' : '开始演奏 ▶'}
          </button>
        )}
        {(isPlaying || isWaiting) && level.mode === 'demo' && (
          <button className={styles.stopBtn} onClick={() => engineRef.current.stop()}>停止</button>
        )}
      </div>
    </div>
  );
}
