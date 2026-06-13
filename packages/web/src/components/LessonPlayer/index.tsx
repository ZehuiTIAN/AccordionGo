/**
 * components/LessonPlayer/index.tsx
 *
 * 关卡播放页。接收整首 Course，在页内提供两个下拉：
 *   - 琴型：选项 = course.supportedConfigs（按曲子过滤），默认第一个
 *   - 练习手：演示 / 右手跟练 / 左手跟练 / 双手跟练（按曲子实际拥有的手动态裁剪）
 *
 * 根据下拉派生 effective Level 后装载 LessonEngine：
 *   - 演示：全部事件，engine mode='demo'（左右手自动亮灯发声）
 *   - 右手/左手/双手跟练：过滤事件；左手事件的 keys 在此按所选琴型
 *     通过 findBassButton 回填具体贝斯按钮 id，engine 按时间步判定
 *
 * 状态：
 *   status         — 引擎状态（当前事件、高亮键、双手步进度等）
 *   pressedKeys    — 按键视觉反馈
 *   wrongFlash     — 答错红闪
 *   lyric          — 当前歌词
 *   progress       — 进度条百分比
 *   mirrored       — 演奏者/观众视角
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Course, Level, LessonEvent, EngineStatus, AccordionConfig } from '@accordion/core';
import { LessonEngine, KNOWN_CONFIGS, getConfig } from '@accordion/core';
import { AccordionView } from '../AccordionView';
import { WebAudioEngine } from '../../adapters/WebAudioEngine';
import { findBassButton } from '../../score/bassMapping';
import styles from './LessonPlayer.module.css';

type PracticeMode = 'demo' | 'right' | 'left' | 'both';

interface Props {
  course: Course;
  onBack: () => void;
  onFinish?: () => void;
}

/** 左手事件按琴型回填 keys；找不到按钮的事件丢弃（无法判定）。 */
function resolveLeftKeys(events: LessonEvent[], config: AccordionConfig): LessonEvent[] {
  const out: LessonEvent[] = [];
  for (const e of events) {
    if (e.notes?.hand !== 'left') { out.push(e); continue; }
    const bass = e.notes.bass;
    if (!bass) continue;
    const btn = findBassButton(config, bass.rootPc, bass.type);
    if (!btn) continue;
    out.push({ ...e, notes: { ...e.notes, keys: [btn.id] } });
  }
  return out;
}

export function LessonPlayer({ course, onBack, onFinish }: Props) {
  const engineRef       = useRef(new LessonEngine());
  const audioRef        = useRef(new WebAudioEngine());
  const wrongFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressedTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 曲子支持的琴型（兜底为全部内置）
  const supportedIds = useMemo(
    () => course.supportedConfigs?.length ? course.supportedConfigs : KNOWN_CONFIGS.map(c => c.id),
    [course.supportedConfigs],
  );
  const supportedConfigs = useMemo(
    () => supportedIds.map(id => getConfig(id)).filter((c): c is AccordionConfig => !!c),
    [supportedIds],
  );

  const [configId, setConfigId] = useState<string>(supportedConfigs[0]?.id ?? KNOWN_CONFIGS[0].id);
  const accordionConfig = useMemo(
    () => getConfig(configId) ?? supportedConfigs[0] ?? KNOWN_CONFIGS[0],
    [configId, supportedConfigs],
  );

  // 源事件（两个 level 共享同一份，取第一个）
  const sourceEvents = course.levels[0]?.events ?? [];

  const hasLeft  = sourceEvents.some(e => e.notes?.hand === 'left');
  const hasRight = sourceEvents.some(e => e.notes?.hand === 'right');

  const [practiceMode, setPracticeMode] = useState<PracticeMode>('demo');
  const [mirrored, setMirrored] = useState(false);

  // 练习手可选项
  const modeOptions: PracticeMode[] = useMemo(() => {
    const opts: PracticeMode[] = ['demo'];
    if (hasRight) opts.push('right');
    if (hasLeft)  opts.push('left');
    if (hasLeft && hasRight) opts.push('both');
    return opts;
  }, [hasLeft, hasRight]);

  // 派生 effective Level
  const effectiveLevel: Level = useMemo(() => {
    const isRight = practiceMode === 'right';
    const isLeft  = practiceMode === 'left';
    // right：仅右手；left：仅左手并回填贝斯键；demo/both：双手（回填贝斯键用于亮灯/判定）
    const events = isRight
      ? sourceEvents.filter(e => e.notes?.hand === 'right')
      : resolveLeftKeys(
          isLeft ? sourceEvents.filter(e => e.notes?.hand === 'left') : sourceEvents,
          accordionConfig,
        );
    return {
      id: `${course.id}-${practiceMode}`,
      title: course.title,
      bpm: course.levels[0]?.bpm ?? 90,
      mode: practiceMode === 'demo' ? 'demo' : 'guided',
      events,
    };
  }, [sourceEvents, practiceMode, accordionConfig, course.id, course.title, course.levels]);

  const [status, setStatus] = useState<EngineStatus>({
    state: 'idle',
    currentEventIndex: 0,
    currentEvent: null,
    activeKeys: new Set(),
    stepExpectedKeys: new Set(),
    stepPressedKeys: new Set(),
  });
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [lyric, setLyric]       = useState('');
  const [progress, setProgress] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);

  useEffect(() => {
    const engine = engineRef.current;
    const audio  = audioRef.current;

    engine.onPlayNote = (event) => {
      if (event.notes) {
        if (event.notes.hand === 'right') {
          event.notes.midi.forEach(m => audio.playNote(m, event.notes!.duration));
        } else {
          audio.playChord(event.notes.midi, event.notes.duration);
        }
        if (effectiveLevel.mode === 'demo') {
          if (pressedTimer.current) clearTimeout(pressedTimer.current);
          setPressedKeys(new Set(event.notes.keys));
          pressedTimer.current = setTimeout(() => setPressedKeys(new Set()), event.notes.duration * 0.8);
        }
      }
      if (event.lyric) setLyric(event.lyric);
    };

    const unsub = engine.subscribe((s) => {
      setStatus(s);
      setProgress(effectiveLevel.events.length > 0 ? (s.currentEventIndex / effectiveLevel.events.length) * 100 : 0);
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

    engine.load(effectiveLevel);
    return () => {
      engine.stop();
      unsub();
      if (wrongFlashTimer.current) clearTimeout(wrongFlashTimer.current);
      if (pressedTimer.current)    clearTimeout(pressedTimer.current);
    };
  }, [effectiveLevel, onFinish]);

  const handleStart = useCallback(async () => {
    await audioRef.current.init();
    engineRef.current.start();
  }, []);

  const handleKeyPress = useCallback(async (keyId: string, midis: number[]) => {
    await audioRef.current.init();
    midis.forEach(m => audioRef.current.playNote(m, 400));

    if (pressedTimer.current) clearTimeout(pressedTimer.current);
    setPressedKeys(prev => {
      const next = new Set(prev);
      next.add(keyId);
      return next;
    });
    pressedTimer.current = setTimeout(() => {
      setPressedKeys(prev => {
        if (!prev.has(keyId)) return prev;
        const next = new Set(prev);
        next.delete(keyId);
        return next;
      });
    }, 200);

    if (effectiveLevel.mode === 'guided') engineRef.current.pressKey(keyId);
  }, [effectiveLevel.mode]);

  const isWaiting  = status.state === 'waiting_input';
  const isPlaying  = status.state === 'playing';
  const isFinished = status.state === 'finished';
  const isReady    = status.state === 'ready';

  // 高亮当前要按的键：当前事件 keys ∪ 双手步期望键。
  // demo 模式 stepExpectedKeys 恒空 → 退化为只高亮当前事件 keys。
  const activeKeys = (isWaiting || isPlaying)
    ? new Set<string>([
        ...(status.currentEvent?.notes?.keys ?? []),
        ...status.stepExpectedKeys,
      ])
    : new Set<string>();

  const modeLabel: Record<PracticeMode, string> = {
    demo: '演示', right: '右手跟练', left: '左手跟练', both: '双手跟练',
  };

  return (
    <div className={`${styles.player} ${wrongFlash ? styles.wrongFlash : ''}`}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <h2 className={styles.title}>{course.title}</h2>
        <div className={styles.modeTag}>{modeLabel[practiceMode]}</div>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.lyricArea}>
        <span className={styles.lyric}>{lyric || (isWaiting ? '按下高亮的键 ↓' : '')}</span>
      </div>

      <div className={styles.keyboard}>
        <div className={styles.viewToggleRow}>
          <div className={styles.modelSwitcher}>
            {/* 琴型下拉：仅本曲支持的型号 */}
            {supportedConfigs.length > 1 ? (
              <select
                className={styles.modelSelect}
                value={configId}
                onChange={e => setConfigId(e.target.value)}
              >
                {supportedConfigs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <span className={styles.modelSingle}>{accordionConfig.name}</span>
            )}
            {/* 练习手下拉 */}
            <select
              className={styles.modelSelect}
              value={practiceMode}
              onChange={e => setPracticeMode(e.target.value as PracticeMode)}
            >
              {modeOptions.map(m => <option key={m} value={m}>{modeLabel[m]}</option>)}
            </select>
          </div>
          <button
            className={styles.viewToggleBtn}
            onClick={() => setMirrored(m => !m)}
          >
            {mirrored ? '演奏者视角 ↔' : '观众视角 ↔'}
          </button>
        </div>
        <AccordionView
          config={accordionConfig}
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
        {(isPlaying || isWaiting) && effectiveLevel.mode === 'demo' && (
          <button className={styles.stopBtn} onClick={() => engineRef.current.stop()}>停止</button>
        )}
      </div>
    </div>
  );
}
