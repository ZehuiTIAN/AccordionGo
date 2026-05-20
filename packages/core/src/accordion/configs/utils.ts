/**
 * accordion/configs/utils.ts
 *
 * Shared helpers for building AccordionConfig data.
 * Consumed by piano-accordion.ts and piano-accordion-120bass.ts.
 */

import type { TrebleKey } from '../types';

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const WHITE_NAMES = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

/** Build piano TrebleKeys from startMidi to endMidi (inclusive). C4 = MIDI 60. */
export function buildPianoKeysRange(startMidi: number, endMidi: number): TrebleKey[] {
  const keys: TrebleKey[] = [];
  let whitePos = 0;
  for (let midi = startMidi; midi <= endMidi; midi++) {
    const noteIndex = midi % 12;
    const octave    = Math.floor(midi / 12) - 1;
    const noteName  = CHROMATIC[noteIndex];
    const type: 'white' | 'black' = WHITE_NAMES.has(noteName) ? 'white' : 'black';
    keys.push({
      id: `${noteName}${octave}`,
      midi,
      type,
      position: type === 'white' ? whitePos : whitePos - 1,
      octave,
      noteName,
    });
    if (type === 'white') whitePos++;
  }
  return keys;
}
