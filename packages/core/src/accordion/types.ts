/**
 * accordion/types.ts
 *
 * 手风琴乐器的核心数据类型。
 *
 * AccordionConfig 描述一台完整的手风琴：
 *   - treble.keys   右手钢琴键列表（TrebleKey），含位置和 MIDI 编号
 *   - bass.buttons  左手按钮列表（BassButton），含行列坐标和和弦 MIDI 编号
 *   - visual        亮灯颜色等渲染参数
 *
 * 换品牌/换琴型只需替换 AccordionConfig JSON，渲染层和引擎层零改动。
 */

export interface TrebleKey {
  id: string;         // e.g. "C4", "Db4"
  midi: number;       // MIDI note number
  type: 'white' | 'black';
  position: number;   // logical column index among white keys (for layout)
  octave: number;
  noteName: string;   // "C", "D", "Eb", etc.
}

export interface BassButton {
  id: string;         // e.g. "C-bass", "C-major"
  midi: number[];     // chord = multiple MIDI notes
  row: number;        // 0-5 (Stradella 6-row system)
  col: number;        // column index
  label: string;      // display label
  type: 'bass' | 'counterbass' | 'major' | 'minor' | 'dominant7' | 'diminished';
  rootNote: string;
}

export interface AccordionConfig {
  id: string;
  name: string;
  type: 'piano' | 'button-chromatic' | 'bayan';
  treble: {
    keys: TrebleKey[];
    layout: 'piano';
  };
  bass: {
    buttons: BassButton[];
    system: 'stradella' | 'free-bass';
    rows: number;
    cols: number;
  };
  visual: {
    highlightColor: string;
    pressedColor: string;
  };
}
