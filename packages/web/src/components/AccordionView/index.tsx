import { useRef, useEffect, useCallback } from 'react';
import type { AccordionConfig, TrebleKey, BassButton } from '@accordion/core';

interface Props {
  config: AccordionConfig;
  activeKeys: Set<string>;
  pressedKeys?: Set<string>;
  onKeyPress?: (keyId: string, midi: number[]) => void;
}

// ─── Layout constants ──────────────────────────────────────────────────────────
const CW = 760;    // canvas width
const CH = 320;    // canvas height
const BODY_R = 18; // body corner radius

// Bass section
const BASS_X = 0;
const BASS_W = 200;

// Bellows
const BELLOWS_X = BASS_X + BASS_W;
const BELLOWS_W = 64;

// Treble section
const TREBLE_X = BELLOWS_X + BELLOWS_W;
const TREBLE_W = CW - TREBLE_X;

// Piano keys — 15 white keys (C3–C5) × 32px = 480px; center in treble section
const WHITE_W = 32;
const WHITE_H = 192;
const BLACK_W = 21;
const BLACK_H = 118;
const KEYS_TOP = Math.round((CH - WHITE_H) / 2);
const KEYS_LEFT = TREBLE_X + Math.round((TREBLE_W - 15 * WHITE_W) / 2);

// Bass buttons
const BTN_R = 21;           // button radius
const BTN_ROW_GAP = 65;     // center-to-center vertical
const BTN_STAGGER = 30;     // chord column offset downward
const BASS_COL0_X = BASS_X + 65;   // bass note column center X
const BASS_COL1_X = BASS_X + 138;  // chord column center X
// vertically center 4 rows (3 gaps) in canvas
const BASS_TOP_Y = Math.round((CH - 3 * BTN_ROW_GAP) / 2);

// ─── Geometry helpers ──────────────────────────────────────────────────────────
function whiteKeys(config: AccordionConfig): TrebleKey[] {
  return config.treble.keys.filter(k => k.type === 'white');
}
function blackKeys(config: AccordionConfig): TrebleKey[] {
  return config.treble.keys.filter(k => k.type === 'black');
}

function whiteKeyX(key: TrebleKey): number {
  return KEYS_LEFT + key.position * WHITE_W;
}
function blackKeyX(key: TrebleKey): number {
  // black key sits between its left neighbor and the next white key
  return KEYS_LEFT + (key.position + 1) * WHITE_W - BLACK_W / 2;
}

function bassButtonPos(btn: BassButton): { x: number; y: number } {
  const x = btn.col === 0 ? BASS_COL0_X : BASS_COL1_X;
  const stagger = btn.col === 1 ? BTN_STAGGER : 0;
  const y = BASS_TOP_Y + btn.row * BTN_ROW_GAP + stagger;
  return { x, y };
}

// ─── Draw helpers ──────────────────────────────────────────────────────────────
function drawBody(ctx: CanvasRenderingContext2D) {
  // Accordion body — deep red gradient
  const grad = ctx.createLinearGradient(0, 0, CW, CH);
  grad.addColorStop(0, '#7a1818');
  grad.addColorStop(0.45, '#6b1414');
  grad.addColorStop(1, '#5a1010');

  ctx.beginPath();
  ctx.roundRect(0, 0, CW, CH, BODY_R);
  ctx.fillStyle = grad;
  ctx.fill();

  // Gold outer trim
  ctx.strokeStyle = '#c8a040';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawBassPanel(ctx: CanvasRenderingContext2D) {
  // Dark grille panel
  ctx.beginPath();
  ctx.roundRect(BASS_X + 6, 6, BASS_W - 8, CH - 12, [BODY_R - 4, 0, 0, BODY_R - 4]);
  ctx.fillStyle = '#111120';
  ctx.fill();

  // Horizontal grille lines
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(160,160,200,0.18)';
  ctx.lineWidth = 1;
  for (let y = 14; y < CH - 8; y += 8) {
    ctx.beginPath();
    ctx.moveTo(BASS_X + 6, y);
    ctx.lineTo(BASS_X + BASS_W - 2, y);
    ctx.stroke();
  }
  ctx.restore();

  // Section label
  ctx.fillStyle = 'rgba(180,180,220,0.35)';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('左手 BASS', BASS_X + BASS_W / 2, CH - 10);
}

function drawBellows(ctx: CanvasRenderingContext2D) {
  const x = BELLOWS_X;
  const y = 0;
  const w = BELLOWS_W;
  const h = CH;
  const foldH = 22;
  const numFolds = Math.ceil(h / foldH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  for (let i = 0; i < numFolds; i++) {
    const fy = y + i * foldH;
    const nextFy = fy + foldH;
    const even = i % 2 === 0;

    // Panel fill — alternating dark shades for 3D depth
    const panelGrad = ctx.createLinearGradient(x, fy, x + w, fy);
    if (even) {
      panelGrad.addColorStop(0, '#260606');
      panelGrad.addColorStop(0.5, '#3d0c0c');
      panelGrad.addColorStop(1, '#200404');
    } else {
      panelGrad.addColorStop(0, '#1a0404');
      panelGrad.addColorStop(0.5, '#2e0808');
      panelGrad.addColorStop(1, '#260606');
    }

    // Trapezoid fold
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x + w, fy);
    ctx.lineTo(x + w, nextFy);
    ctx.lineTo(x, nextFy);
    ctx.closePath();
    ctx.fillStyle = panelGrad;
    ctx.fill();

    // Diagonal crease (the fold ridge)
    ctx.beginPath();
    if (even) {
      ctx.moveTo(x, fy);
      ctx.lineTo(x + w, fy + foldH * 0.45);
    } else {
      ctx.moveTo(x + w, fy);
      ctx.lineTo(x, fy + foldH * 0.45);
    }
    ctx.strokeStyle = 'rgba(200,50,50,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Crease line at fold boundary
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x + w, fy);
    ctx.strokeStyle = 'rgba(180,30,30,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Left and right chrome borders of bellows
  ctx.strokeStyle = '#c8a040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0); ctx.lineTo(x, h);
  ctx.moveTo(x + w, 0); ctx.lineTo(x + w, h);
  ctx.stroke();

  ctx.restore();
}

function drawTreblePanel(ctx: CanvasRenderingContext2D) {
  // Treble (keyboard) panel — cream/ivory background
  ctx.beginPath();
  ctx.roundRect(TREBLE_X + 2, 6, TREBLE_W - 8, CH - 12, [0, BODY_R - 4, BODY_R - 4, 0]);
  const grad = ctx.createLinearGradient(TREBLE_X, 0, CW, 0);
  grad.addColorStop(0, '#e8e4da');
  grad.addColorStop(1, '#f0ece2');
  ctx.fillStyle = grad;
  ctx.fill();

  // Top grille strip (decorative air vent)
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.beginPath();
  ctx.roundRect(TREBLE_X + 10, 10, TREBLE_W - 20, 20, 4);
  ctx.fill();
  for (let gx = TREBLE_X + 18; gx < CW - 14; gx += 10) {
    ctx.beginPath();
    ctx.roundRect(gx, 13, 5, 14, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();
  }

  // Bottom label
  ctx.fillStyle = 'rgba(80,60,40,0.4)';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('右手 TREBLE', TREBLE_X + TREBLE_W / 2, CH - 10);
}

function drawWhiteKey(
  ctx: CanvasRenderingContext2D,
  key: TrebleKey,
  active: boolean,
  pressed: boolean,
  highlight: string,
  pressColor: string,
) {
  const x = whiteKeyX(key);
  const y = KEYS_TOP;

  ctx.beginPath();
  ctx.roundRect(x + 1.5, y, WHITE_W - 3, WHITE_H, [0, 0, 5, 5]);

  if (pressed) {
    ctx.fillStyle = pressColor;
  } else if (active) {
    ctx.fillStyle = highlight;
    ctx.shadowColor = highlight;
    ctx.shadowBlur = 22;
  } else {
    // Subtle 3D gradient: slightly darker at bottom
    const kg = ctx.createLinearGradient(x, y, x, y + WHITE_H);
    kg.addColorStop(0, '#faf8f2');
    kg.addColorStop(0.7, '#f0ece0');
    kg.addColorStop(1, '#e0dac8');
    ctx.fillStyle = kg;
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Key border
  ctx.strokeStyle = active ? highlight : '#aaa9a0';
  ctx.lineWidth = active ? 2 : 1;
  ctx.stroke();

  // Octave marker: small dot on C keys
  if (key.noteName === 'C') {
    ctx.beginPath();
    ctx.arc(x + WHITE_W / 2, y + WHITE_H - 14, 4, 0, Math.PI * 2);
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
  const x = blackKeyX(key);
  const y = KEYS_TOP;

  ctx.beginPath();
  ctx.roundRect(x, y, BLACK_W, BLACK_H, [0, 0, 4, 4]);

  if (pressed) {
    ctx.fillStyle = pressColor;
  } else if (active) {
    ctx.fillStyle = highlight;
    ctx.shadowColor = highlight;
    ctx.shadowBlur = 24;
  } else {
    const kg = ctx.createLinearGradient(x, y, x, y + BLACK_H);
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
) {
  const { x, y } = bassButtonPos(btn);
  const isMajor = btn.type === 'major';

  // Shadow / depth ring
  ctx.beginPath();
  ctx.arc(x, y, BTN_R + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  // Outer chrome ring
  ctx.beginPath();
  ctx.arc(x, y, BTN_R + 1.5, 0, Math.PI * 2);
  const ringGrad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, BTN_R + 2);
  ringGrad.addColorStop(0, '#e0d0b0');
  ringGrad.addColorStop(1, '#8a7a50');
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // Button face
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

  // Label
  ctx.fillStyle = active || pressed ? '#1a1a2e' : (isMajor ? '#aaaaee' : '#cccccc');
  ctx.font = `bold ${BTN_R < 20 ? 12 : 13}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.label, x, y - 1);
  ctx.textBaseline = 'alphabetic';

  // Small type indicator below label
  ctx.fillStyle = active || pressed ? '#1a1a2e' : (isMajor ? '#7777aa' : '#888');
  ctx.font = '9px system-ui';
  ctx.textBaseline = 'middle';
  ctx.fillText(isMajor ? '和' : '根', x, y + 10);
  ctx.textBaseline = 'alphabetic';

  // Tactile marker on C (small center dot)
  if (btn.rootNote === 'C' && !active && !pressed) {
    ctx.beginPath();
    ctx.arc(x, y - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
  }

  // Column labels at top (first row only)
  if (btn.row === 0) {
    ctx.fillStyle = 'rgba(180,180,220,0.4)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isMajor ? '和弦' : '单音', x, BASS_TOP_Y - 22);
    ctx.textBaseline = 'alphabetic';
  }
}

// ─── Main component ────────────────────────────────────────────────────────────
export function AccordionView({ config, activeKeys, pressedKeys = new Set(), onKeyPress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wk = whiteKeys(config);
  const bk = blackKeys(config);
  const { highlightColor, pressedColor } = config.visual;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CW, CH);

    drawBody(ctx);
    drawBassPanel(ctx);
    drawBellows(ctx);
    drawTreblePanel(ctx);

    // White keys first (under black keys)
    wk.forEach(key => drawWhiteKey(ctx, key,
      activeKeys.has(key.id), pressedKeys.has(key.id), highlightColor, pressedColor));

    // Keyboard vertical separator shadow lines between keys
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    wk.forEach(key => {
      const x = whiteKeyX(key);
      ctx.beginPath();
      ctx.moveTo(x + WHITE_W - 0.5, KEYS_TOP);
      ctx.lineTo(x + WHITE_W - 0.5, KEYS_TOP + WHITE_H);
      ctx.stroke();
    });

    // Black keys on top
    bk.forEach(key => drawBlackKey(ctx, key,
      activeKeys.has(key.id), pressedKeys.has(key.id), highlightColor, pressedColor));

    // Bass buttons
    config.bass.buttons.forEach(btn => drawBassButton(ctx, btn,
      activeKeys.has(btn.id), pressedKeys.has(btn.id), highlightColor, pressedColor));
  }, [activeKeys, pressedKeys, config, wk, bk, highlightColor, pressedColor]);

  useEffect(() => { draw(); }, [draw]);

  // ─── Hit testing ────────────────────────────────────────────────────────────
  const handlePointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onKeyPress) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * sx;
    const cy = (e.clientY - rect.top) * sy;

    // Black keys (on top, check first)
    for (const key of bk) {
      const x = blackKeyX(key);
      if (cx >= x && cx <= x + BLACK_W && cy >= KEYS_TOP && cy <= KEYS_TOP + BLACK_H) {
        onKeyPress(key.id, [key.midi]);
        return;
      }
    }
    // White keys
    for (const key of wk) {
      const x = whiteKeyX(key);
      if (cx >= x && cx <= x + WHITE_W && cy >= KEYS_TOP && cy <= KEYS_TOP + WHITE_H) {
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
  }, [onKeyPress, bk, wk, config.bass.buttons]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      onPointerDown={handlePointer}
      style={{
        width: '100%',
        maxWidth: CW,
        cursor: onKeyPress ? 'pointer' : 'default',
        borderRadius: BODY_R,
        display: 'block',
        touchAction: 'none',
      }}
    />
  );
}
