/**
 * score/MusicXMLParser.ts
 *
 * 将 MusicXML 解析为 @accordion/core 的 Course / LessonEvent[] 格式。
 *
 * 支持两种调用方式：
 *   - 浏览器：传 XML 字符串，内部用 window.DOMParser 解析
 *   - Node.js 构建脚本：传已解析好的 Document 对象（用 @xmldom/xmldom 预解析）
 *
 * DOM 访问只用 getElementsByTagName / childNodes / getAttribute / textContent，
 * 这些 API 在浏览器 DOM 和 @xmldom 里都有；刻意避开 querySelector(All)，
 * 因为 @xmldom 不实现它们（曾导致 build-songs 报错）。
 *
 * 解析能力：
 *   - 双手：单 part 大谱表（G/F 双谱号，按 <staff> 区分）或多 part（右手 + 左手）
 *   - <backup>/<forward>：正确推进时间游标，让第二谱表落在正确节拍
 *   - 连音线（tie）按 staff+midi 合并为单一更长事件
 *   - 右手：treble key id（"C4"…），按中位数自适应移调
 *   - 左手：同时刻音符聚合成和弦 → detectChord 归一化为 { rootPc, type }（配置无关），
 *     写入 NoteSpec.bass；具体贝斯按钮 id 在运行时按所选琴型回填
 *   - supportedConfigs：按音域 + 所需贝斯和弦判定本曲可演奏的琴型
 */

import type { Course, LessonEvent, AccordionConfig, BassButton } from '@accordion/core';
import { KNOWN_CONFIGS } from '@accordion/core';
import { detectChord, findBassButton } from './bassMapping';

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
    txt(descendants(doc, 'movement-title')[0]) ||
    txt(descendants(doc, 'work-title')[0]) ||
    '导入曲目';

  const parts = descendants(doc, 'part').filter(el => el.tagName === 'part');
  if (parts.length === 0) throw new Error('未找到声部（<part> 元素）');

  const { rightPart, leftPart, splitByStaff } = chooseParts(doc, parts);

  // 右手旋律
  const rightRaw = collectRawNotes(rightPart, defaultBpm, 'right', splitByStaff);
  if (rightRaw.notes.length === 0)
    throw new Error('未解析到右手音符，请确认文件包含旋律声部');

  const transposeOctaves =
    options.transposeOctaves !== undefined
      ? options.transposeOctaves
      : suggestTranspose(rightRaw.notes.map(n => n.midi));

  const rightEvents: LessonEvent[] = [];
  for (const n of rightRaw.notes) {
    const midi = n.midi + transposeOctaves * 12;
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
    rightEvents.push(event);
  }

  // 左手贝斯（可选）
  const leftRaw = leftPart
    ? collectRawNotes(leftPart, rightRaw.bpm, 'left', splitByStaff)
    : { notes: [] as RawNote[], bpm: rightRaw.bpm };
  const leftEvents = buildLeftEvents(leftRaw.notes);

  // 合并并按时间排序（同时刻允许左右两个事件）
  const events = [...rightEvents, ...leftEvents].sort((a, b) => a.time - b.time);

  const warnings: string[] = [];
  if (transposeOctaves !== 0)
    warnings.push(`已自动移调 ${transposeOctaves > 0 ? '+' : ''}${transposeOctaves} 个八度以适配键盘`);

  // 本曲可演奏的琴型
  const supportedConfigs = compatibleConfigs(
    rightEvents.map(e => e.notes!.midi[0]),
    leftEvents.map(e => e.notes!.bass!),
  );
  if (supportedConfigs.length === 0) {
    warnings.push('未找到能完整覆盖本曲音域/和弦的琴型，默认使用首个内置琴型');
    supportedConfigs.push(KNOWN_CONFIGS[0].id);
  }

  const last = events[events.length - 1];
  const durationSec = (last.time + (last.notes?.duration ?? 0)) / 1000;

  const id = `song-${slugify(title)}-${Date.now()}`;
  const course: Course = {
    id,
    title,
    author: '导入',
    difficulty: leftEvents.length > 0 ? 3 : 2,
    supportedConfigs,
    levels: [
      { id: `${id}-demo`,   title: `${title} · 演示`, bpm: rightRaw.bpm, mode: 'demo',   events },
      { id: `${id}-guided`, title: `${title} · 跟练`, bpm: rightRaw.bpm, mode: 'guided', events },
    ],
  };

  return {
    course,
    warnings,
    stats: { totalNotes: events.length, outOfRange: 0, suggestedTranspose: transposeOctaves, durationSec },
  };
}

// ─── XML parsing shim ──────────────────────────────────────────────────────────

function parseXMLString(xml: string): Document {
  // globalThis.DOMParser 在浏览器和 Node.js ≥ 18.14 都可用
  if (typeof globalThis.DOMParser !== 'undefined') {
    const doc = new globalThis.DOMParser().parseFromString(xml, 'application/xml');
    const err = descendants(doc, 'parsererror')[0];
    if (err) throw new Error('XML 格式错误：' + (txt(err) || '').slice(0, 120));
    return doc;
  }
  throw new Error('DOMParser 不可用。请在 Node.js 脚本中预先解析 XML 并传入 Document 对象。');
}

// ─── DOM 无关助手（兼容浏览器与 @xmldom）──────────────────────────────────────

/** 所有后代中指定 tag 的元素（等价于 querySelectorAll(tag)）。 */
function descendants(root: Element | Document, tag: string): Element[] {
  const node = root as Element;
  if (typeof node.getElementsByTagName !== 'function') return [];
  return Array.from(node.getElementsByTagName(tag)) as Element[];
}

/** 直接子元素中第一个指定 tag（等价于 'a > b' 中 b 为直接子级时的取值）。 */
function firstChild(el: Element | undefined | null, tag: string): Element | undefined {
  if (!el || !el.childNodes) return undefined;
  for (const c of Array.from(el.childNodes)) {
    if ((c as Element).tagName === tag) return c as Element;
  }
  return undefined;
}

function txt(el: Element | undefined | null): string {
  return el?.textContent?.trim() ?? '';
}

function attr(el: Element | undefined | null, name: string): string | null {
  return el?.getAttribute?.(name) ?? null;
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface RawNote { time: number; duration: number; midi: number; lyric?: string; }
interface CollectResult {
  notes: RawNote[];
  bpm: number;
}

// ─── Part 选择 ─────────────────────────────────────────────────────────────────

interface PartChoice {
  rightPart: Element;
  leftPart: Element | null;
  /** true = 单 part 大谱表，左右手靠 <staff> 区分；false = 多 part，每 part 整体属于一只手。 */
  splitByStaff: boolean;
}

function chooseParts(doc: Document, parts: Element[]): PartChoice {
  const partName = (p: Element): string => {
    const id = attr(p, 'id');
    const sp = descendants(doc, 'score-part').find(s => attr(s, 'id') === id);
    return txt(firstChild(sp, 'part-name')).toLowerCase();
  };
  const has = (kw: string[], s: string) => kw.some(k => s.includes(k));

  // 大谱表：单 part 同时含 staff 1 与 staff 2 → 左右手都从它取
  for (const p of parts) {
    const staves = descendants(p, 'staff').map(s => txt(s));
    if (staves.includes('1') && staves.includes('2')) {
      return { rightPart: p, leftPart: p, splitByStaff: true };
    }
  }

  // 多 part：按名字挑右手/左手声部
  const rightKw = ['right', 'treble', 'soprano', '右手', '高音'];
  const leftKw  = ['left', 'bass', 'basso', '左手', '低音'];
  const rightPart = parts.find(p => has(rightKw, partName(p))) ?? parts[0];
  const leftPart  = parts.find(p => p !== rightPart && has(leftKw, partName(p)))
    ?? (parts.length > 1 ? (parts.find(p => p !== rightPart) ?? null) : null);
  return { rightPart, leftPart, splitByStaff: false };
}

// ─── 核心解析：按时间游标收集原始音符 ─────────────────────────────────────────

function collectRawNotes(
  part: Element,
  defaultBpm: number,
  hand: 'left' | 'right',
  splitByStaff: boolean,
): CollectResult {
  let bpm = defaultBpm;
  let divisionsPerQuarter = 1;
  let currentMs = 500; // 500 ms lead-in

  const notes: RawNote[] = [];
  const openTies = new Map<string, number>(); // `${staff}:${midi}` → notes[] index

  const durMsOf = (durEl: Element | undefined) => {
    const divs = parseInt(txt(durEl) || '0', 10) || 0;
    return (divs / divisionsPerQuarter) * (60_000 / bpm);
  };

  for (const measure of descendants(part, 'measure')) {
    for (const child of Array.from(measure.childNodes)) {
      const el = child as Element;
      const tag = el.tagName;
      if (!tag) continue;

      if (tag === 'attributes') {
        const divEl = firstChild(el, 'divisions');
        if (txt(divEl)) divisionsPerQuarter = parseInt(txt(divEl), 10) || 1;
        continue;
      }
      if (tag === 'direction') {
        const sound = descendants(el, 'sound').find(s => attr(s, 'tempo'));
        const t = attr(sound, 'tempo');
        if (t) bpm = parseFloat(t);
        continue;
      }
      if (tag === 'sound') {
        const t = attr(el, 'tempo');
        if (t) bpm = parseFloat(t);
        continue;
      }
      if (tag === 'backup')  { currentMs -= durMsOf(firstChild(el, 'duration')); continue; }
      if (tag === 'forward') { currentMs += durMsOf(firstChild(el, 'duration')); continue; }
      if (tag !== 'note') continue;

      // 单次遍历 note 子元素，收集所需字段（替代此前每音符 ~7 次后代扫描）
      let grace = false, isChord = false, isRest = false;
      let staff = '1', durationEl: Element | undefined, pitchEl: Element | undefined;
      let lyricEl: Element | undefined, tieStop = false, tieStart = false;
      for (const c of Array.from(el.childNodes)) {
        switch ((c as Element).tagName) {
          case 'grace':   grace = true; break;
          case 'chord':   isChord = true; break;
          case 'rest':    isRest = true; break;
          case 'staff':   staff = txt(c as Element) || '1'; break;
          case 'duration': durationEl = c as Element; break;
          case 'pitch':   pitchEl = c as Element; break;
          case 'lyric':   if (!lyricEl) lyricEl = c as Element; break;
          case 'tie': {
            const ty = attr(c as Element, 'type');
            if (ty === 'stop') tieStop = true;
            else if (ty === 'start') tieStart = true;
            break;
          }
        }
      }
      if (grace) continue;

      const durMs = durMsOf(durationEl);

      // 是否属于当前要收集的手
      const isRightStaff = staff === '1';
      const isTarget = splitByStaff
        ? (hand === 'right' ? isRightStaff : !isRightStaff)
        : true; // 多 part：整个 part 都属于该手

      if (isRest) { if (!isChord) currentMs += durMs; continue; }

      // pitch 的子元素（step/octave/alter）同样单次扫描
      let step = 'C', octave = 4, alter = 0;
      if (pitchEl) {
        for (const c of Array.from(pitchEl.childNodes)) {
          switch ((c as Element).tagName) {
            case 'step':   step = txt(c as Element) || 'C'; break;
            case 'octave': octave = parseInt(txt(c as Element) || '4', 10); break;
            case 'alter':  alter = parseFloat(txt(c as Element) || '0'); break;
          }
        }
      }
      const lyric = lyricEl ? txt(descendants(lyricEl, 'text')[0]) : '';
      const midi  = pitchToMidi(step, octave, alter);

      if (isTarget) {
        const tieKey = `${staff}:${midi}`;
        if (tieStop && openTies.has(tieKey)) {
          notes[openTies.get(tieKey)!].duration += durMs;
          if (!tieStart) openTies.delete(tieKey);
        } else {
          notes.push({ time: currentMs, duration: durMs, midi, lyric: lyric || undefined });
          if (tieStart) openTies.set(tieKey, notes.length - 1);
        }
      }
      // 时间游标对两个谱表统一推进（保证另一只手时间正确）
      if (!isChord) currentMs += durMs;
    }
  }

  return { notes, bpm };
}

// ─── 左手和弦 → 事件 ──────────────────────────────────────────────────────────

/** 代表性发音八度（C2 区），让左手事件即便未绑定琴型也能被音频直接播放。 */
const BASS_ROOT_OCTAVE = 36; // C2
const QUALITY_INTERVALS: Record<string, number[]> = {
  bass: [0],
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  dominant7: [0, 4, 7, 10],
};

function buildLeftEvents(raw: RawNote[]): LessonEvent[] {
  if (raw.length === 0) return [];
  const events: LessonEvent[] = [];

  // 按起始 time 聚合（同时刻、含 chord 的音符归为一组）
  const groups = new Map<number, RawNote[]>();
  for (const n of raw) {
    const arr = groups.get(n.time) ?? [];
    arr.push(n);
    groups.set(n.time, arr);
  }

  for (const t of [...groups.keys()].sort((a, b) => a - b)) {
    const group = groups.get(t)!;
    const midis = group.map(n => n.midi);
    const duration = Math.round(Math.max(...group.map(n => n.duration)) * 0.88);
    const chord = detectChord(midis);
    const rootPc = chord?.rootPc ?? (((Math.min(...midis) % 12) + 12) % 12);
    const type = chord?.type ?? 'bass';
    const intervals = QUALITY_INTERVALS[type] ?? [0];
    const rootMidi = BASS_ROOT_OCTAVE + rootPc;

    events.push({
      time: Math.round(t),
      type: 'note',
      notes: {
        hand: 'left',
        keys: [], // 运行时按所选琴型回填具体按钮 id
        midi: intervals.map(o => rootMidi + o),
        duration,
        bass: { rootPc, type },
      },
    });
  }
  return events;
}

// ─── supportedConfigs 计算 ─────────────────────────────────────────────────────

function compatibleConfigs(
  rightMidis: number[],
  leftBass: Array<{ rootPc: number; type: string }>,
): string[] {
  const ids: string[] = [];
  for (const cfg of KNOWN_CONFIGS) {
    const trebleMidis = cfg.treble.keys.map(k => k.midi);
    const tmin = Math.min(...trebleMidis);
    const tmax = Math.max(...trebleMidis);
    const trebleOk = rightMidis.every(m => m >= tmin && m <= tmax);
    const bassOk = leftBass.every(b => !!findBassButton(cfg, b.rootPc, b.type as BassButton['type']));
    if (trebleOk && bassOk) ids.push(cfg.id);
  }
  return ids;
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

/**
 * 选择移调八度数：把尽量多的音符纳入键盘可覆盖范围 [MIN,MAX]，并偏好 0（不移调）。
 * MIN/MAX 取所有候选琴型 treble 范围的并集下/上限，使双手曲优先落在 120 贝斯等宽音域琴上；
 * 单独某琴型能否覆盖由 supportedConfigs 再各自判定。
 */
const KEYBOARD_MIN = 48;  // C3（8 贝斯最低）
const KEYBOARD_MAX = 93;  // A6（120 贝斯最高）
function suggestTranspose(midis: number[]): number {
  if (midis.length === 0) return 0;
  let best = 0;
  let bestScore = Infinity;
  for (let o = -3; o <= 3; o++) {
    let out = 0;
    for (const m of midis) {
      const v = m + o * 12;
      if (v < KEYBOARD_MIN || v > KEYBOARD_MAX) out++;
    }
    const score = out * 1000 + Math.abs(o); // 越少超界越好；同分时八度偏移越小越好
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return best;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
