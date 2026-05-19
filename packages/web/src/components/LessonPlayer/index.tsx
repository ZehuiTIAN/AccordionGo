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
  const engineRef = useRef(new LessonEngine());
  const audioRef = useRef(new WebAudioEngine());
  const [status, setStatus] = useState<EngineStatus>({
    state: 'idle',
    currentEventIndex: 0,
    currentEvent: null,
    activeKeys: new Set(),
  });
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [lyric, setLyric] = useState('');
  const [progress, setProgress] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);

  useEffect(() => {
    const engine = engineRef.current;
    const audio = audioRef.current;

    engine.onPlayNote = (event) => {
      if (event.notes) {
        if (event.notes.hand === 'right') {
          event.notes.midi.forEach(m => audio.playNote(m, event.notes!.duration));
        } else {
          audio.playChord(event.notes.midi, event.notes!.duration);
        }
        // Flash pressed keys briefly in demo mode
        if (level.mode === 'demo') {
          setPressedKeys(new Set(event.notes.keys));
          setTimeout(() => setPressedKeys(new Set()), event.notes.duration * 0.8);
        }
      }
      if (event.lyric) setLyric(event.lyric);
    };

    const unsub = engine.subscribe((s) => {
      setStatus(s);
      const total = level.events.length;
      setProgress(total > 0 ? (s.currentEventIndex / total) * 100 : 0);
      if (s.state === 'wrong') {
        setWrongFlash(true);
        setTimeout(() => setWrongFlash(false), 600);
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
    };
  }, [level, onFinish]);

  const handleStart = useCallback(async () => {
    await audioRef.current.init();
    engineRef.current.start();
  }, []);

  const handleKeyPress = useCallback((keyId: string, midis: number[]) => {
    const engine = engineRef.current;
    const audio = audioRef.current;

    // Always play sound on tap
    midis.forEach(m => audio.playNote(m, 400));
    setPressedKeys(new Set([keyId]));
    setTimeout(() => setPressedKeys(prev => { const n = new Set(prev); n.delete(keyId); return n; }), 200);

    if (level.mode === 'guided') {
      engine.pressKey(keyId);
    }
  }, [level.mode]);

  const isWaiting = status.state === 'waiting_input';
  const isPlaying = status.state === 'playing';
  const isFinished = status.state === 'finished';
  const isReady = status.state === 'ready';

  return (
    <div className={`${styles.player} ${wrongFlash ? styles.wrongFlash : ''}`}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <h2 className={styles.title}>{level.title}</h2>
        <div className={styles.modeTag}>{level.mode === 'demo' ? '演示' : '跟练'}</div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {/* Lyric display */}
      <div className={styles.lyricArea}>
        <span className={styles.lyric}>{lyric || (isWaiting ? '按下高亮的键 ↓' : '')}</span>
      </div>

      {/* Hint for guided mode */}
      {isWaiting && (
        <div className={styles.waitingHint}>等待你的按键…</div>
      )}

      {/* Accordion keyboard */}
      <div className={styles.keyboard}>
        <AccordionView
          config={pianoAccordionConfig}
          activeKeys={isWaiting || isPlaying ? (status.currentEvent?.notes ? new Set(status.currentEvent.notes.keys) : status.activeKeys) : new Set()}
          pressedKeys={pressedKeys}
          onKeyPress={handleKeyPress}
        />
      </div>

      {/* Controls */}
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
