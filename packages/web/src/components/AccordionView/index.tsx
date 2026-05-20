/**
 * packages/web/src/components/AccordionView/index.tsx
 *
 * Canvas-rendered interactive accordion diagram.
 *
 * Layout: bass panel (left, 228px) | bellows (center, 120px) | treble keyboard (right).
 * Canvas width is fixed at 760px; height = numWhiteKeys × 32px (scales with config).
 *
 * Supports both the 8-bass demo config (15 white keys, 2-col legacy layout) and the
 * 41-key 120-bass config (24 white keys, 6-col grid layout) via dynamic geometry
 * computed from AccordionConfig.
 *
 * `mirrored` prop applies CSS scaleX(-1) for 演奏者视角. Text is counter-transformed
 * so glyphs stay readable in both orientations.
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
  mirrored?: boolean;
}

// ─── Fixed canvas/section dimensions ──────────────────────────────────────────
const CW        = 760;
const WK_H      = 32;   // white key slot height (px); CH = numWhiteKeys × WK_H
const WK_W      = 342;  // white key depth (fills treble panel)
const BK_H      = 21;   // black key height
const BK_W      = 210;  // black key depth
const BODY_R    = 18;

const BASS_X    = 0;
const BASS_W    = 220;

const BELLOWS_X = BASS_X + BASS_W;
const BELLOWS_W = 152;  // wider bellows for realistic proportion

const TREBLE_X  = BELLOWS_X + BELLOWS_W;
const KEY_X     = TREBLE_X + 6;  // left edge of keyboard

// Legacy 2-col bass constants
const BASS_COL0_X  = BASS_X + 143;  // 单音/bass (inner)
const BASS_COL1_X  = BASS_X + 68;   // 和弦/chord (outer)
const BTN_STAGGER  = 30;
const BTN_ROW_GAP  = 65;
const LEGACY_BTN_R = 21;

// ─── Layout types ──────────────────────────────────────────────────────────────
interface BassLayout {
  BTN_R: number;
  colXs: number[];
  rowYs: number[];
  /** per-column y stagger — creates the characteristic diagonal button arrangement */
  colYOffsets: number[];
  /** y offset for column header labels (top of panel) */
  headerY: number;
}

function computeBassLayout(config: AccordionConfig, CH: number): BassLayout {
  const { rows: bassRows, cols: bassCols } = config.bass;

  if (bassCols === 2) {
    // 2-col: chord column (outer, col 1) is staggered up by BTN_STAGGER
    const topY = Math.round((CH - (bassRows - 1) * BTN_ROW_GAP) / 2);
    return {
      BTN_R: LEGACY_BTN_R,
      colXs: [BASS_COL0_X, BASS_COL1_X],
      rowYs: Array.from({ length: bassRows }, (_, i) => topY + i * BTN_ROW_GAP),
      colYOffsets: [0, -BTN_STAGGER],
      headerY: topY - LEGACY_BTN_R - 14,
    };
  }

  // Grid layout: 6-col (120-bass)
  // Odd columns are staggered down by half a row — matches real Stradella diagonal layout
  const colSpacing = BASS_W / (bassCols + 1);
  const HEADER_H   = 20;
  const rowSpacing = (CH - HEADER_H) / bassRows;
  const stagger    = rowSpacing * 0.5;
  const BTN_R = Math.floor(Math.min(colSpacing * 0.43, rowSpacing * 0.43));

  return {
    BTN_R,
    colXs: Array.from({ length: bassCols }, (_, i) => BASS_X + colSpacing * (i + 1)),
    rowYs: Array.from({ length: bassRows }, (_, i) => HEADER_H + rowSpacing * 0.5 + i * rowSpacing),
    colYOffsets: Array.from({ length: bassCols }, (_, i) => (i % 2 === 1 ? stagger : 0)),
    headerY: HEADER_H * 0.5 + 3,
  };
}

function bassButtonPos(
  btn: BassButton,
  layout: BassLayout,
): { x: number; y: number } {
  return { x: layout.colXs[btn.col], y: layout.rowYs[btn.row] + layout.colYOffsets[btn.col] };
}

// ─── Key geometry ──────────────────────────────────────────────────────────────
function whiteKeyY(key: TrebleKey, numWK: number): number {
  return (numWK - 1 - key.position) * WK_H;
}

function blackKeyY(key: TrebleKey, numWK: number): number {
  return (numWK - 1 - key.position) * WK_H - BK_H / 2;
}

// ─── Text helper ───────────────────────────────────────────────────────────────
function fillTextSafe(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  mirrored: boolean,
) {
  if (!mirrored) { ctx.fillText(text, x, y); return; }
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(-1, 1);
  ctx.fillText(text, 0, y);
  ctx.restore();
}

// ─── Draw: body ───────────────────────────────────────────────────────────────
function drawBody(ctx: CanvasRenderingContext2D, CH: number) {
  // Lacquer gradient
  const grad = ctx.createLinearGradient(0, 0, CW, CH);
  grad.addColorStop(0,   '#8c1e1e');
  grad.addColorStop(0.3, '#701414');
  grad.addColorStop(0.7, '#6a1010');
  grad.addColorStop(1,   '#4e0c0c');
  ctx.beginPath();
  ctx.roundRect(0, 0, CW, CH, BODY_R);
  ctx.fillStyle = grad;
  ctx.fill();

  // Very subtle diagonal wood-grain lines
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, CW, CH, BODY_R);
  ctx.clip();
  ctx.globalAlpha = 0.025;
  ctx.strokeStyle = '#ffcc88';
  ctx.lineWidth = 1;
  for (let x = -CH; x < CW + CH; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + CH, CH);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Gold outer border
  ctx.strokeStyle = '#c0983a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(0, 0, CW, CH, BODY_R);
  ctx.stroke();

  // Inner highlight seam
  ctx.strokeStyle = 'rgba(255,200,100,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(2, 2, CW - 4, CH - 4, BODY_R - 2);
  ctx.stroke();
}

// ─── Draw: bass panel (split for offscreen caching) ───────────────────────────
function drawBassPanelBackground(ctx: CanvasRenderingContext2D, CH: number) {
  ctx.beginPath();
  ctx.roundRect(BASS_X + 5, 5, BASS_W - 6, CH - 10, [BODY_R - 4, 0, 0, BODY_R - 4]);
  ctx.fillStyle = '#0c0c18';
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(BASS_X + 5, 5, BASS_W - 6, CH - 10, [BODY_R - 4, 0, 0, BODY_R - 4]);
  ctx.clip();

  ctx.strokeStyle = 'rgba(140,140,200,0.08)';
  ctx.lineWidth = 1;
  for (let y = 10; y < CH - 5; y += 6) {
    ctx.beginPath();
    ctx.moveTo(BASS_X + 5, y);
    ctx.lineTo(BASS_X + BASS_W - 1, y);
    ctx.stroke();
  }

  const grillTop = CH * 0.77;
  const grillBot = CH - 14;
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  let row = 0;
  for (let gy = grillTop + 6; gy < grillBot; gy += 10) {
    const offset = (row % 2) * 5;
    for (let gx = BASS_X + 10 + offset; gx < BASS_X + BASS_W - 10; gx += 10) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    row++;
  }

  ctx.restore();
}

function drawBassPanelLabel(ctx: CanvasRenderingContext2D, CH: number, mirrored: boolean) {
  ctx.fillStyle = 'rgba(160,160,210,0.3)';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  fillTextSafe(ctx, '左手 BASS', BASS_X + BASS_W / 2, CH - 7, mirrored);
}

// ─── Draw: bellows ────────────────────────────────────────────────────────────
function drawBellows(ctx: CanvasRenderingContext2D, CH: number) {
  const x = BELLOWS_X;
  const foldH = 24;
  const numFolds = Math.ceil(CH / foldH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, BELLOWS_W, CH);
  ctx.clip();

  for (let i = 0; i < numFolds; i++) {
    const fy = i * foldH;
    const even = i % 2 === 0;
    // Each fold: front face (60%) darker, top face (40%) lighter
    const frontH = foldH * 0.62;
    const topH   = foldH - frontH;

    const frontY = even ? fy : fy + topH;
    const topY   = even ? fy + frontH : fy;

    // Front face
    const fg = ctx.createLinearGradient(x, frontY, x + BELLOWS_W, frontY);
    fg.addColorStop(0, '#1a0505');
    fg.addColorStop(0.5, '#260808');
    fg.addColorStop(1, '#140303');
    ctx.beginPath();
    ctx.rect(x, frontY, BELLOWS_W, frontH);
    ctx.fillStyle = fg;
    ctx.fill();

    // Top face (reflects light)
    const tg = ctx.createLinearGradient(x, topY, x + BELLOWS_W, topY);
    tg.addColorStop(0, '#3e1212');
    tg.addColorStop(0.4, '#541a1a');
    tg.addColorStop(1, '#3a1010');
    ctx.beginPath();
    ctx.rect(x, topY, BELLOWS_W, topH);
    ctx.fillStyle = tg;
    ctx.fill();

    // Bright fold edge
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x + BELLOWS_W, fy);
    ctx.strokeStyle = even ? 'rgba(190,60,60,0.65)' : 'rgba(220,80,80,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Gold border strips
  ctx.strokeStyle = '#c0983a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);          ctx.lineTo(x, CH);
  ctx.moveTo(x + BELLOWS_W, 0); ctx.lineTo(x + BELLOWS_W, CH);
  ctx.stroke();

  ctx.restore();
}

// ─── Draw: treble panel background ────────────────────────────────────────────
function drawTreblePanel(ctx: CanvasRenderingContext2D, CH: number) {
  ctx.beginPath();
  ctx.roundRect(TREBLE_X + 2, 5, CW - TREBLE_X - 7, CH - 10, [0, BODY_R - 4, BODY_R - 4, 0]);
  const grad = ctx.createLinearGradient(TREBLE_X, 0, CW, 0);
  grad.addColorStop(0, '#e6e2d8');
  grad.addColorStop(1, '#f0ece4');
  ctx.fillStyle = grad;
  ctx.fill();
}

// ─── Draw: white key ──────────────────────────────────────────────────────────
function drawWhiteKey(
  ctx: CanvasRenderingContext2D,
  key: TrebleKey,
  numWK: number,
  active: boolean,
  pressed: boolean,
  highlight: string,
  pressColor: string,
) {
  const y = whiteKeyY(key, numWK);
  ctx.beginPath();
  ctx.roundRect(KEY_X, y + 0.5, WK_W, WK_H - 1, [0, 5, 5, 0]);

  if (pressed) {
    ctx.fillStyle = pressColor;
  } else if (active) {
    ctx.fillStyle = highlight;
    ctx.shadowColor = highlight;
    ctx.shadowBlur = 20;
  } else {
    const kg = ctx.createLinearGradient(KEY_X, y, KEY_X + WK_W, y);
    kg.addColorStop(0, '#f8f6f0');
    kg.addColorStop(0.65, '#eeead8');
    kg.addColorStop(1, '#dfd9c8');
    ctx.fillStyle = kg;
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Edge shadow at top/bottom of key slot for depth
  if (!active && !pressed) {
    const shade = ctx.createLinearGradient(KEY_X, y, KEY_X, y + WK_H);
    shade.addColorStop(0, 'rgba(0,0,0,0.12)');
    shade.addColorStop(0.08, 'rgba(0,0,0,0)');
    shade.addColorStop(0.9, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.beginPath();
    ctx.roundRect(KEY_X, y + 0.5, WK_W, WK_H - 1, [0, 5, 5, 0]);
    ctx.fillStyle = shade;
    ctx.fill();
  }

  ctx.strokeStyle = active ? highlight : '#b0ae9c';
  ctx.lineWidth = active ? 2 : 1;
  ctx.stroke();

  // C-marker dot
  if (key.noteName === 'C') {
    ctx.beginPath();
    ctx.arc(KEY_X + WK_W - 12, y + WK_H / 2, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = active || pressed ? '#1a1a2e' : '#999';
    ctx.fill();
  }
}

// ─── Draw: black key ──────────────────────────────────────────────────────────
function drawBlackKey(
  ctx: CanvasRenderingContext2D,
  key: TrebleKey,
  numWK: number,
  active: boolean,
  pressed: boolean,
  highlight: string,
  pressColor: string,
) {
  const y = blackKeyY(key, numWK);
  ctx.beginPath();
  ctx.roundRect(KEY_X, y, BK_W, BK_H, [0, 4, 4, 0]);

  if (pressed) {
    ctx.fillStyle = pressColor;
  } else if (active) {
    ctx.fillStyle = highlight;
    ctx.shadowColor = highlight;
    ctx.shadowBlur = 22;
  } else {
    const kg = ctx.createLinearGradient(KEY_X, y, KEY_X + BK_W, y);
    kg.addColorStop(0, '#282828');
    kg.addColorStop(0.55, '#181818');
    kg.addColorStop(1, '#0c0c0c');
    ctx.fillStyle = kg;
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Subtle top highlight seam on black key
  if (!active && !pressed) {
    ctx.beginPath();
    ctx.roundRect(KEY_X, y, BK_W, 3, [0, 2, 0, 0]);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
  }

  ctx.strokeStyle = active ? highlight : '#0a0a0a';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ─── Draw: bass column headers ─────────────────────────────────────────────────
const COL_LABELS_2 = ['根', '和'];   // col 0=bass(inner), col 1=chord(outer) for 8-bass
const COL_LABELS_6 = ['反', '根', '大', '小', '七', '减'];

function drawBassColHeaders(
  ctx: CanvasRenderingContext2D,
  layout: BassLayout,
  mirrored: boolean,
) {
  const labels = layout.colXs.length === 2 ? COL_LABELS_2 : COL_LABELS_6;
  ctx.fillStyle = 'rgba(180,180,230,0.35)';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (layout.colXs.length === 2 && layout.headerY < 8) return;

  layout.colXs.forEach((cx, i) => {
    if (i >= labels.length) return;
    fillTextSafe(ctx, labels[i], cx, layout.headerY + layout.colYOffsets[i], mirrored);
  });
  ctx.textBaseline = 'alphabetic';
}

// ─── Draw: bass button ────────────────────────────────────────────────────────
const BUTTON_COLORS: Record<BassButton['type'], [light: string, dark: string]> = {
  bass:        ['#383838', '#0d0d0d'],
  counterbass: ['#38361a', '#161408'],
  major:       ['#2a2a60', '#10103a'],
  minor:       ['#1e3040', '#0a1420'],
  dominant7:   ['#302040', '#120818'],
  diminished:  ['#282828', '#080808'],
};

function drawBassButton(
  ctx: CanvasRenderingContext2D,
  btn: BassButton,
  x: number,
  y: number,
  BTN_R: number,
  active: boolean,
  pressed: boolean,
  highlight: string,
  pressColor: string,
  mirrored: boolean,
) {
  // Drop shadow
  ctx.beginPath();
  ctx.arc(x, y + 2, BTN_R + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  // Metallic ring
  ctx.beginPath();
  ctx.arc(x, y, BTN_R + 2, 0, Math.PI * 2);
  const rg = ctx.createRadialGradient(
    x - BTN_R * 0.3, y - BTN_R * 0.3, BTN_R * 0.08,
    x + BTN_R * 0.1, y + BTN_R * 0.1, BTN_R + 2,
  );
  rg.addColorStop(0, '#e8d8b0');
  rg.addColorStop(0.55, '#b89850');
  rg.addColorStop(1, '#604820');
  ctx.fillStyle = rg;
  ctx.fill();

  // Button face
  ctx.beginPath();
  ctx.arc(x, y, BTN_R, 0, Math.PI * 2);

  if (pressed) {
    ctx.fillStyle = pressColor;
    ctx.shadowColor = pressColor;
    ctx.shadowBlur = 14;
  } else if (active) {
    ctx.fillStyle = highlight;
    ctx.shadowColor = highlight;
    ctx.shadowBlur = 26;
  } else {
    const bg = ctx.createRadialGradient(
      x - BTN_R * 0.35, y - BTN_R * 0.35, BTN_R * 0.05,
      x + BTN_R * 0.1,  y + BTN_R * 0.1,  BTN_R * 1.15,
    );
    const [light, dark] = BUTTON_COLORS[btn.type];
    bg.addColorStop(0, light);
    bg.addColorStop(1, dark);
    ctx.fillStyle = bg;
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Dome highlight arc (3-D sheen)
  if (!pressed && !active && BTN_R >= 8) {
    ctx.beginPath();
    ctx.arc(x - BTN_R * 0.15, y - BTN_R * 0.18, BTN_R * 0.58, Math.PI * 0.75, Math.PI * 1.62);
    ctx.strokeStyle = 'rgba(255,255,255,0.17)';
    ctx.lineWidth = BTN_R * 0.22;
    ctx.stroke();
  }

  // Note name label
  if (BTN_R >= 8) {
    const fontSize = Math.max(7, Math.min(Math.floor(BTN_R * 0.68), 13));
    ctx.fillStyle = active || pressed ? '#1a1a2e' : '#e0e0e0';
    ctx.font = `bold ${fontSize}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fillTextSafe(ctx, btn.label, x, y - 0.5, mirrored);
  }

  // Sub-label (type indicator) for larger buttons only
  if (BTN_R >= 16) {
    const isMajor = btn.type === 'major';
    ctx.fillStyle = active || pressed ? '#1a1a2e' : (isMajor ? '#7777aa' : '#888');
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fillTextSafe(ctx, isMajor ? '和' : '根', x, y + 10, mirrored);
  }

  ctx.textBaseline = 'alphabetic';

  // C-key tactile dot
  if (btn.rootNote === 'C' && !active && !pressed && BTN_R >= 10) {
    ctx.beginPath();
    ctx.arc(x, y - BTN_R * 0.3, BTN_R * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fill();
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
  const numWK = wk.length;
  const CH = numWK * WK_H;
  const { highlightColor, pressedColor } = config.visual;

  const bassLayout = useMemo(
    () => computeBassLayout(config, CH),
    [config],  // CH is derived from config (numWK changes iff config changes)
  );

  // Pre-render static background (body, bass texture, bellows, treble panel) once per
  // config change. Stamped in draw() to avoid ~700 canvas ops on every keypress.
  const staticBg = useMemo((): OffscreenCanvas => {
    const oc = new OffscreenCanvas(CW, CH);
    // OffscreenCanvasRenderingContext2D is structurally identical to
    // CanvasRenderingContext2D for all drawing ops; TS types diverge only on
    // two focus-management methods irrelevant here.
    const octx = oc.getContext('2d')! as unknown as CanvasRenderingContext2D;
    drawBody(octx, CH);
    drawBassPanelBackground(octx, CH);
    drawBellows(octx, CH);
    drawTreblePanel(octx, CH);
    return oc;
  }, [CH]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CW, CH);

    ctx.drawImage(staticBg, 0, 0);
    drawBassPanelLabel(ctx, CH, mirrored);

    // White keys (background)
    wk.forEach(key => drawWhiteKey(ctx, key, numWK, activeKeys.has(key.id), pressedKeys.has(key.id), highlightColor, pressedColor));

    // White key dividers
    ctx.strokeStyle = 'rgba(0,0,0,0.13)';
    ctx.lineWidth = 1;
    wk.forEach(key => {
      const y = whiteKeyY(key, numWK);
      ctx.beginPath();
      ctx.moveTo(KEY_X, y + WK_H - 0.5);
      ctx.lineTo(KEY_X + WK_W, y + WK_H - 0.5);
      ctx.stroke();
    });

    // Black keys (foreground)
    bk.forEach(key => drawBlackKey(ctx, key, numWK, activeKeys.has(key.id), pressedKeys.has(key.id), highlightColor, pressedColor));

    // Bass column headers
    drawBassColHeaders(ctx, bassLayout, mirrored);

    // Bass buttons
    config.bass.buttons.forEach(btn => {
      const { x, y } = bassButtonPos(btn, bassLayout);
      drawBassButton(ctx, btn, x, y, bassLayout.BTN_R, activeKeys.has(btn.id), pressedKeys.has(btn.id), highlightColor, pressedColor, mirrored);
    });
  }, [activeKeys, pressedKeys, config, wk, bk, numWK, CH, highlightColor, pressedColor, mirrored, bassLayout, staticBg]);

  useEffect(() => { draw(); }, [draw]);

  // ─── Hit testing ─────────────────────────────────────────────────────────────
  const handlePointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onKeyPress) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const cx_raw = (e.clientX - rect.left) * sx;
    const cx = mirrored ? CW - cx_raw : cx_raw;
    const cy = (e.clientY - rect.top) * sy;

    // Black keys first
    for (const key of bk) {
      const y = blackKeyY(key, numWK);
      if (cx >= KEY_X && cx <= KEY_X + BK_W && cy >= y && cy <= y + BK_H) {
        onKeyPress(key.id, [key.midi]);
        return;
      }
    }
    // White keys
    for (const key of wk) {
      const y = whiteKeyY(key, numWK);
      if (cx >= KEY_X && cx <= KEY_X + WK_W && cy >= y && cy <= y + WK_H) {
        onKeyPress(key.id, [key.midi]);
        return;
      }
    }
    // Bass buttons
    for (const btn of config.bass.buttons) {
      const { x, y } = bassButtonPos(btn, bassLayout);
      if (Math.hypot(cx - x, cy - y) <= bassLayout.BTN_R + 4) {
        onKeyPress(btn.id, btn.midi);
        return;
      }
    }
  }, [onKeyPress, bk, wk, config.bass.buttons, config.bass.cols, numWK, bassLayout, mirrored]);

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
