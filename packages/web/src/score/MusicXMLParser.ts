/**
 * MusicXMLParser.ts
 *
 * 将 MusicXML 文件解析为 @accordion/core 的 Course / LessonEvent[] 格式。
 *
 * 支持两种调用方式：
 *   - 浏览器：传 XML 字符串，内部用 window.DOMParser 解析
 *   - Node.js 构建脚本：传已解析好的 Document 对象（用 @xmldom/xmldom 预解析）
 *
 * 主要处理逻辑：
 *   - 自动选取高音（右手）声部
 *   - 按 <divisions> + <sound tempo> 计算每个音符的绝对时间戳（ms）
 *   - 连音线（tie）合并为单一更长时值的事件
 *   - 降号（Bb/Eb…）规范化为升号（A#/D#…）以匹配键盘 ID
 *   - 超出 C3–C5 范围的音符自动计算建议移调量并跳过
 */

import type { Course, LessonEvent } from '@accordion/core';

// ─── Public API ────────────────────────────────────────────────────────────────

export interface ParseResult {
  course: Course;
  warnings: string[];
  stats: {
    totalNotes: number;
    outOfRange: number;
    suggestedTranspose: number;
    durationSec: number;
  };
}

export interface ParseOptions {
  defaultBpm?: number;
  transposeOctaves?: number;
}

/**
 * 解析 MusicXML。
 * @param input  XML 字符串（浏览器）或已解析的 Document（Node.js 脚本）
 */
export function parseMusicXML(input: string | Document, options: ParseOptions = {}): ParseResult {
  const { defaultBpm = 90 } = options;

  const doc: Document =
    typeof input === 'string' ? parseXMLString(input) : input;

  const title =
    doc.querySelector('movement-title')?.textContent?.trim() ||
    doc.querySelector('work work-title')?.textContent?.trim() ||
    '导入曲目';

  const parts = Array.from(doc.querySelectorAll('part'));
  if (parts.length === 0) throw new Error('未找到声部（<part> 元素）');

  const part = chooseTreblePart(doc, parts);
  const raw  = collectRawNotes(part, defaultBpm);

  if (raw.notes.length === 0)
    throw new Error('未解析到音符，请确认文件包含旋律声部');

  const transposeOctaves =
    options.transposeOctaves !== undefined
      ? options.transposeOctaves
      : suggestTranspose(raw.notes.map(n => n.midi));

  let outOfRange = 0;
  const events: LessonEvent[] = [];

  for (const n of raw.notes) {
    const midi = n.midi + transposeOctaves * 12;
    if (midi < 48 || midi > 72) { outOfRange++; continue; }

    const keyId = midiToKeyId(midi);
    const event: LessonEvent = {
      time: Math.round(n.time),
      type: 'note',
      notes: {
        hand: 'right',
        keys: [keyId],
        midi: [midi],
        duration: Math.round(n.duration * 0.88),
      },
    };
    if (n.lyric) event.lyric = n.lyric;
    events.push(event);
  }

  if (events.length === 0)
    throw new Error(
      `所有 ${raw.notes.length} 个音符均超出键盘范围（C3–C5）。` +
      `建议移调 ${transposeOctaves} 个八度。`
    );

  const warnings: string[] = [];
  if (outOfRange > 0)
    warnings.push(`${outOfRange} 个音符超出键盘范围（C3–C5）已跳过`);
  if (transposeOctaves !== 0)
    warnings.push(`已自动移调 ${transposeOctaves > 0 ? '+' : ''}${transposeOctaves} 个八度以适配键盘`);

  const last = events[events.length - 1];
  const durationSec = (last.time + (last.notes?.duration ?? 0)) / 1000;

  const id = `song-${slugify(title)}-${Date.now()}`;
  const course: Course = {
    id,
    title,
    author: '导入',
    difficulty: 2,
    levels: [
      { id: `${id}-demo`,   title: `${title} · 演示`, bpm: raw.bpm, mode: 'demo',   events },
      { id: `${id}-guided`, title: `${title} · 跟练`, bpm: raw.bpm, mode: 'guided', events },
    ],
  };

  return { course, warnings, stats: { totalNotes: raw.notes.length, outOfRange, suggestedTranspose: transposeOctaves, durationSec } };
}

// ─── XML parsing shim ──────────────────────────────────────────────────────────

function parseXMLString(xml: string): Document {
  // globalThis.DOMParser is available in browsers and Node.js ≥ 18.14
  if (typeof globalThis.DOMParser !== 'undefined') {
    const doc = new globalThis.DOMParser().parseFromString(xml, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('XML 格式错误：' + err.textContent?.slice(0, 120));
    return doc;
  }
  throw new Error(
    'DOMParser 不可用。请在 Node.js 脚本中预先解析 XML 并传入 Document 对象。'
  );
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface RawNote { time: number; duration: number; midi: number; lyric?: string; }
interface CollectResult { notes: RawNote[]; bpm: number; }

// ─── Core parsing logic ────────────────────────────────────────────────────────

function collectRawNotes(part: Element, defaultBpm: number): CollectResult {
  let bpm = defaultBpm;
  let divisionsPerQuarter = 1;
  let currentMs = 500; // 500 ms lead-in

  const notes: RawNote[] = [];
  const openTies = new Map<number, number>(); // midi → index in notes[]

  for (const measure of Array.from(part.children).filter(el => el.tagName === 'measure')) {
    for (const sound of Array.from(measure.querySelectorAll('direction > sound[tempo], sound[tempo]'))) {
      const t = sound.getAttribute('tempo');
      if (t) bpm = parseFloat(t);
    }
    const divEl = measure.querySelector('attributes > divisions');
    if (divEl?.textContent) divisionsPerQuarter = parseInt(divEl.textContent);

    const qMs = 60_000 / bpm;

    for (const noteEl of Array.from(measure.children).filter(el => el.tagName === 'note')) {
      if (noteEl.querySelector('grace')) continue;

      const isChord = !!noteEl.querySelector('chord');
      const isRest  = !!noteEl.querySelector('rest');
      const divs    = parseInt(noteEl.querySelector('duration')?.textContent ?? '0') || 0;
      const durMs   = (divs / divisionsPerQuarter) * qMs;

      if (isRest) { if (!isChord) currentMs += durMs; continue; }

      const step   = noteEl.querySelector('step')?.textContent?.trim()  ?? 'C';
      const octave = parseInt(noteEl.querySelector('octave')?.textContent ?? '4');
      const alter  = parseFloat(noteEl.querySelector('alter')?.textContent ?? '0');
      const lyric  = noteEl.querySelector('lyric text')?.textContent?.trim();
      const midi   = pitchToMidi(step, octave, alter);

      const tieStop  = !!noteEl.querySelector('tie[type="stop"]');
      const tieStart = !!noteEl.querySelector('tie[type="start"]');

      if (tieStop && openTies.has(midi)) {
        notes[openTies.get(midi)!].duration += durMs;
        if (!tieStart) openTies.delete(midi);
        if (!isChord) currentMs += durMs;
        continue;
      }

      notes.push({ time: currentMs, duration: durMs, midi, lyric });
      if (tieStart) openTies.set(midi, notes.length - 1);
      if (!isChord) currentMs += durMs;
    }
  }

  return { notes, bpm };
}

// ─── Pitch helpers ─────────────────────────────────────────────────────────────

const STEP_SEMITONE: Record<string, number> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function pitchToMidi(step: string, octave: number, alter: number): number {
  let semi = (STEP_SEMITONE[step] ?? 0) + Math.round(alter);
  let oct  = octave;
  if (semi < 0)  { semi += 12; oct--; }
  if (semi >= 12){ semi -= 12; oct++; }
  return 12 * (oct + 1) + semi; // standard MIDI: C4 = 60
}

function midiToKeyId(midi: number): string {
  const semi = ((midi % 12) + 12) % 12;
  const oct  = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[semi]}${oct}`;
}

function suggestTranspose(midis: number[]): number {
  if (midis.length === 0) return 0;
  const median = midis.slice().sort((a, b) => a - b)[Math.floor(midis.length / 2)];
  return Math.round((60 - median) / 12); // target: median near C4
}

function chooseTreblePart(doc: Document, parts: Element[]): Element {
  const keywords = ['right', 'treble', 'soprano', '右手', '高音'];
  for (const part of parts) {
    const id   = part.getAttribute('id') ?? '';
    const name = (doc.querySelector(`score-part[id="${id}"] part-name`)?.textContent ?? '').toLowerCase();
    if (keywords.some(k => name.includes(k))) return part;
  }
  return parts[0];
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
