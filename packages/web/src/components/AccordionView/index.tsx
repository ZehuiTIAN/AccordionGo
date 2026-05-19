/**
 * packages/web/src/components/AccordionView/index.tsx
 *
 * Canvas-rendered interactive accordion diagram (760×480).
 *
 * Three sections: bass panel (left, 220px ~29%), bellows (center, 110px ~14%),
 * treble keyboard (right, 430px ~57%) — proportions match a real piano accordion. The treble keyboard is displayed
 * vertically — keys stacked top-to-bottom with C5 at top and C3 at bottom,
 * matching the real accordion's playing-position orientation. Black keys are
 * shorter and sit on the left (body) side of each slot.
 *
 * `mirrored` prop applies CSS scaleX(-1) for 演奏者视角. Pointer coordinates
 * are compensated for hit-testing, and text is counter-transformed so glyphs
 * stay readable in both orientations.
 *
 * Exports: AccordionView
 */
import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { AccordionConfig, TrebleKey, BassButton } from '@accordion/core';

interface Props {
  config: AccordionConfig;
  activeKeys: Set<string>;
  pressedKeys?: Set<string>;
  onKeyPress?: (keyId: string, midi: number[]) => void;
  /** Mirror the canvas horizontally (演奏者视角). Default false = 观众视角. */
  mirrored?: boolean;
}

// ─── Layout constants ──────────────────────────────────────────────────────────
const CW = 760;
const CH = 480;    // 15 white keys × 32 px
const BODY_R = 18;

const BASS_X = 0;
const BASS_W = 228;   // 30 % of CW

const BELLOWS_X = BASS_X + BASS_W;
const BELLOWS_W = 228; // 30 % of CW — large placeholder for bellows image

const TREBLE_X = BELLOWS_X + BELLOWS_W;
const TREBLE_W = CW - TREBLE_X;

// Vertical keyboard — C5 at top (y=0), C3 at bottom (y=448)
// Key body end at KEY_X (left), pressing end at KEY_X + WK_W (right)
const NUM_WHITE_KEYS = 15;
const WK_H = 32;             // white key slot height (CH / NUM_WHITE_KEYS)
const WK_W = 270;            // white key depth — fills 40 % treble section
const BK_H = 21;             // black key height (~65 % of WK_H)
const BK_W = 167;            // black key depth (62 % of WK_W; shorter = body side)
const KEY_X = TREBLE_X + 10; // left (body) edge of keyboard

// Bass buttons — col 1 (和弦) is outer/left, col 0 (单音) is inner/right
const BTN_R = 21;
const BTN_ROW_GAP = 65;
const BTN_STAGGER = 30;
const BASS_COL0_X = BASS_X + 138; // 单音 column (inner, close to bellows)
const BASS_COL1_X = BASS_X + 65;  // 和弦 column (outer, far from bellows)
const BASS_TOP_Y = Math.round((CH - 3 * BTN_ROW_GAP) / 2);

// ─── Geometry helpers ──────────────────────────────────────────────────────────
function whiteKeyY(key: TrebleKey): number {
  // C5 (position 14) → y=0 (top); C3 (position 0) → y=448 (bottom)
  return (NUM_WHITE_KEYS - 1 - key.position) * WK_H;
}

function blackKeyY(key: TrebleKey): number {
  // Centered at boundary between white key `position` and `position+1`
  return (NUM_WHITE_KEYS - 1 - key.position) * WK_H - BK_H / 2;
}

function bassButtonPos(btn: BassButton): { x: number; y: number } {
  const x = btn.col === 0 ? BASS_COL0_X : BASS_COL1_X;
  const stagger = btn.col === 1 ? -BTN_STAGGER : 0;  // negative = upward (chords above bass notes)
  const y = BASS_TOP_Y + btn.row * BTN_ROW_GAP + stagger;
  return { x, y };
}

// ─── Text helper ───────────────────────────────────────────────────────────────
// When the canvas element is CSS-mirrored (scaleX(-1)), counter-transform each
// text call so glyphs appear correctly oriented. Requires textAlign = 'center'.
function fillTextSafe(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  mirrored: boolean,
) {
  if (!mirrored) {
    ctx.fillText(text, x, y);
    return;
  }
  // translate to center x, flip horizontally → double-mirror cancels CSS scaleX(-1)
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(-1, 1);
  ctx.fillText(text, 0, y);
  ctx.restore();
}

// ─── Draw helpers ──────────────────────────────────────────────────────────────
function drawBody(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, CW, CH);
  grad.addColorStop(0, '#7a1818');
  grad.addColorStop(0.45, '#6b1414');
  grad.addColorStop(1, '#5a1010');
  ctx.beginPath();
  ctx.roundRect(0, 0, CW, CH, BODY_R);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#c8a040';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawBassPanel(ctx: CanvasRenderingContext2D, mirrored: boolean) {
  ctx.beginPath();
  ctx.roundRect(BASS_X + 6, 6, BASS_W - 8, CH - 12, [BODY_R - 4, 0, 0, BODY_R - 4]);
  ctx.fillStyle = '#111120';
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.beginPath();
  for (let y = 14; y < CH - 8; y += 8) {
    ctx.moveTo(BASS_X + 6, y);
    ctx.lineTo(BASS_X + BASS_W - 2, y);
  }
  ctx.strokeStyle = 'rgba(160,160,200,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(180,180,220,0.35)';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  fillTextSafe(ctx, '左手 BASS', BASS_X + BASS_W / 2, CH - 10, mirrored);
}

function drawBellows(ctx: CanvasRenderingContext2D) {
  const x = BELLOWS_X;
  const foldH = 22;
  const numFolds = Math.ceil(CH / foldH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, BELLOWS_W, CH);
  ctx.clip();

  for (let i = 0; i < numFolds; i++) {
    const fy = i * foldH;
    const nextFy = fy + foldH;
    const even = i % 2 === 0;

    const panelGrad = ctx.createLinearGradient(x, fy, x + BELLOWS_W, fy);
    if (even) {
      panelGrad.addColorStop(0, '#260606');
      panelGrad.addColorStop(0.5, '#3d0c0c');
      panelGrad.addColorStop(1, '#200404');
    } else {
      panelGrad.addColorStop(0, '#1a0404');
      panelGrad.addColorStop(0.5, '#2e0808');
      panelGrad.addColorStop(1, '#260606');
    }
    ctx.beginPath();
    ctx.moveTo(x, fy); ctx.lineTo(x + BELLOWS_W, fy);
    ctx.lineTo(x + BELLOWS_W, nextFy); ctx.lineTo(x, nextFy);
    ctx.closePath();
    ctx.fillStyle = panelGrad;
    ctx.fill();

    ctx.beginPath();
    if (even) { ctx.moveTo(x, fy); ctx.lineTo(x + BELLOWS_W, fy + foldH * 0.45); }
    else       { ctx.moveTo(x + BELLOWS_W, fy); ctx.lineTo(x, fy + foldH * 0.45); }
    ctx.strokeStyle = 'rgba(200,50,50,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, fy); ctx.lineTo(x + BELLOWS_W, fy);
    ctx.strokeStyle = 'rgba(180,30,30,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.strokeStyle = '#c8a040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0); ctx.lineTo(x, CH);
  ctx.moveTo(x + BELLOWS_W, 0); ctx.lineTo(x + BELLOWS_W, CH);
  ctx.stroke();

  ctx.restore();
}

function drawTreblePanel(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.roundRect(TREBLE_X + 2, 6, TREBLE_W - 8, CH - 12, [0, BODY_R - 4, BODY_R - 4, 0]);
  const grad = ctx.createLinearGradient(TREBLE_X, 0, CW, 0);
  grad.addColorStop(0, '#e8e4da');
  grad.addColorStop(1, '#f0ece2');
  ctx.fillStyle = grad;
  ctx.fill();

  // Keys fill nearly the full treble section; right rim shows body color/trim naturally.
}

function drawWhiteKey(
  ctx: CanvasRenderingContext2D,
  key: TrebleKey,
  active: boolean,
  pressed: boolean,
  highlight: string,
  pressColor: string,
) {
  const y = whiteKeyY(key);
  ctx.beginPath();
  // Flat on left (body end), rounded on right (pressing end)
  ctx.roundRect(KEY_X, y + 0.5, WK_W, WK_H - 1, [0, 5, 5, 0]);

  if (pressed) {
    ctx.fillStyle = pressColor;
  } else if (active) {
    ctx.fillStyle = highlight;
    ctx.shadowColor = highlight;
    ctx.shadowBlur = 22;
  } else {
    const kg = ctx.createLinearGradient(KEY_X, y, KEY_X + WK_W, y);
    kg.addColorStop(0, '#faf8f2');
    kg.addColorStop(0.7, '#f0ece0');
    kg.addColorStop(1, '#e0dac8');
    ctx.fillStyle = kg;
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = active ? highlight : '#aaa9a0';
  ctx.lineWidth = active ? 2 : 1;
  ctx.stroke();

  // C-marker dot at the pressing (right) end
  if (key.noteName === 'C') {
    ctx.beginPath();
    ctx.arc(KEY_X + WK_W - 14, y + WK_H / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = active || pressed ? '#1a1a2e' : '#888';
    ctx.fill();
  }
}

function drawBlackKey(
  ctx: CanvasRenderingContext2D,
  key: TrebleKey,
  active: boolean,
  pressed: boolean,
  highlight: string,
  pressColor: string,
) {
  const y = blackKeyY(key);
  ctx.beginPath();
  ctx.roundRect(KEY_X, y, BK_W, BK_H, [0, 4, 4, 0]);

  if (pressed) {
    ctx.fillStyle = pressColor;
  } else if (active) {
    ctx.fillStyle = highlight;
    ctx.shadowColor = highlight;
    ctx.shadowBlur = 24;
  } else {
    const kg = ctx.createLinearGradient(KEY_X, y, KEY_X + BK_W, y);
    kg.addColorStop(0, '#2a2a2a');
    kg.addColorStop(0.6, '#1a1a1a');
    kg.addColorStop(1, '#0f0f0f');
    ctx.fillStyle = kg;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = active ? highlight : '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBassButton(
  ctx: CanvasRenderingContext2D,
  btn: BassButton,
  active: boolean,
  pressed: boolean,
  highlight: string,
  pressColor: string,
  mirrored: boolean,
) {
  const { x, y } = bassButtonPos(btn);
  const isMajor = btn.type === 'major';

  ctx.beginPath();
  ctx.arc(x, y, BTN_R + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, BTN_R + 1.5, 0, Math.PI * 2);
  const ringGrad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, BTN_R + 2);
  ringGrad.addColorStop(0, '#e0d0b0');
  ringGrad.addColorStop(1, '#8a7a50');
  ctx.fillStyle = ringGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, BTN_R, 0, Math.PI * 2);
  if (pressed) {
    ctx.fillStyle = pressColor;
    ctx.shadowColor = pressColor;
    ctx.shadowBlur = 16;
  } else if (active) {
    ctx.fillStyle = highlight;
    ctx.shadowColor = highlight;
    ctx.shadowBlur = 28;
  } else {
    const bg = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, BTN_R);
    if (isMajor) {
      bg.addColorStop(0, '#3a3a6a');
      bg.addColorStop(1, '#1e1e40');
    } else {
      bg.addColorStop(0, '#2a2a2a');
      bg.addColorStop(1, '#101010');
    }
    ctx.fillStyle = bg;
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = active || pressed ? '#1a1a2e' : (isMajor ? '#aaaaee' : '#cccccc');
  ctx.font = `bold ${BTN_R < 20 ? 12 : 13}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fillTextSafe(ctx, btn.label, x, y - 1, mirrored);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = active || pressed ? '#1a1a2e' : (isMajor ? '#7777aa' : '#888');
  ctx.font = '9px system-ui';
  ctx.textBaseline = 'middle';
  fillTextSafe(ctx, isMajor ? '和' : '根', x, y + 10, mirrored);
  ctx.textBaseline = 'alphabetic';

  if (btn.rootNote === 'C' && !active && !pressed) {
    ctx.beginPath();
    ctx.arc(x, y - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
  }

  if (btn.row === 0) {
    // Label sits above the topmost button in each column.
    // 和弦 col is staggered up by BTN_STAGGER, so its label must move up too.
    const colTopY = isMajor ? BASS_TOP_Y - BTN_STAGGER : BASS_TOP_Y;
    ctx.fillStyle = 'rgba(180,180,220,0.4)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fillTextSafe(ctx, isMajor ? '和弦' : '单音', x, colTopY - BTN_R - 10, mirrored);
    ctx.textBaseline = 'alphabetic';
  }
}

// ─── Main component ────────────────────────────────────────────────────────────
export function AccordionView({
  config,
  activeKeys,
  pressedKeys = new Set(),
  onKeyPress,
  mirrored = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wk = useMemo(() => config.treble.keys.filter(k => k.type === 'white'), [config]);
  const bk = useMemo(() => config.treble.keys.filter(k => k.type === 'black'), [config]);
  const { highlightColor, pressedColor } = config.visual;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CW, CH);

    drawBody(ctx);
    drawBassPanel(ctx, mirrored);
    drawBellows(ctx);
    drawTreblePanel(ctx);

    // White keys (background layer)
    wk.forEach(key => drawWhiteKey(ctx, key,
      activeKeys.has(key.id), pressedKeys.has(key.id), highlightColor, pressedColor));

    // Horizontal separator lines between white key slots
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    wk.forEach(key => {
      const y = whiteKeyY(key);
      ctx.beginPath();
      ctx.moveTo(KEY_X, y + WK_H - 0.5);
      ctx.lineTo(KEY_X + WK_W, y + WK_H - 0.5);
      ctx.stroke();
    });

    // Black keys (foreground layer)
    bk.forEach(key => drawBlackKey(ctx, key,
      activeKeys.has(key.id), pressedKeys.has(key.id), highlightColor, pressedColor));

    // Bass buttons
    config.bass.buttons.forEach(btn => drawBassButton(
      ctx, btn,
      activeKeys.has(btn.id), pressedKeys.has(btn.id),
      highlightColor, pressedColor, mirrored,
    ));
  }, [activeKeys, pressedKeys, config, wk, bk, highlightColor, pressedColor, mirrored]);

  useEffect(() => { draw(); }, [draw]);

  // ─── Hit testing ────────────────────────────────────────────────────────────
  const handlePointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onKeyPress) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const cx_raw = (e.clientX - rect.left) * sx;
    const cx = mirrored ? CW - cx_raw : cx_raw;
    const cy = (e.clientY - rect.top) * sy;

    // Black keys (on top, check first)
    for (const key of bk) {
      const y = blackKeyY(key);
      if (cx >= KEY_X && cx <= KEY_X + BK_W && cy >= y && cy <= y + BK_H) {
        onKeyPress(key.id, [key.midi]);
        return;
      }
    }
    // White keys
    for (const key of wk) {
      const y = whiteKeyY(key);
      if (cx >= KEY_X && cx <= KEY_X + WK_W && cy >= y && cy <= y + WK_H) {
        onKeyPress(key.id, [key.midi]);
        return;
      }
    }
    // Bass buttons
    for (const btn of config.bass.buttons) {
      const { x, y } = bassButtonPos(btn);
      if (Math.hypot(cx - x, cy - y) <= BTN_R + 4) {
        onKeyPress(btn.id, btn.midi);
        return;
      }
    }
  }, [onKeyPress, bk, wk, config.bass.buttons, mirrored]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      onPointerDown={handlePointer}
      style={{
        width: '100%',
        maxWidth: CW,
        height: 'auto',
        cursor: onKeyPress ? 'pointer' : 'default',
        borderRadius: BODY_R,
        display: 'block',
        touchAction: 'none',
        transform: mirrored ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}
