/**
 * packages/web/src/components/AccordionView/index.tsx
 *
 * Canvas-rendered interactive accordion diagram.
 *
 * Layout: bass panel (left, 220px) | bellows (center, 152px) | treble keyboard (right).
 * Canvas width is fixed at 760px; height = numWhiteKeys × 32px (scales with config).
 *
 * Visual theming: all colours and gradient stops live in an AccordionTheme object
 * (see ./theme.ts).  Pass a `theme` prop to switch skins; omit it to use the default
 * classicBlackTheme (piano-black lacquer, silver-chrome trim, ivory keys).
 *
 * Active keys render with a screen-blend Gaussian glow that preserves the key's
 * material texture; glow colour comes from config.visual.highlightColor so each
 * instrument can have its own highlight hue independent of the skin.
 *
 * Supports both the 8-bass demo config (15 white keys, 2-col legacy layout) and the
 * 41-key 120-bass config (24 white keys, 6-col parallelogram layout) via dynamic
 * geometry computed from AccordionConfig.
 *
 * Bass layout for 120-bass: 6 columns in Stradella order. Col 0 (counterbass) is
 * rightmost (closest to bellows); col 5 (diminished) is leftmost (outer edge).
 * 内侧低外侧高: inner columns sit LOWER on the panel (larger y-offset) and outer
 * columns sit HIGHER — matching real accordion geometry.  Produces a "\" diagonal.
 * Tactile markers: C (primary), G#/Ab and E (secondary); see TACTILE_MARKER_ROOTS.
 *
 * `mirrored` prop applies CSS scaleX(-1) for 演奏者视角. Text is counter-transformed
 * so glyphs stay readable in both orientations.
 *
 * Exports: AccordionView
 */
import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { AccordionConfig, TrebleKey, BassButton } from '@accordion/core';
import { TACTILE_MARKER_ROOTS } from '@accordion/core';
import type { AccordionTheme, GradStop } from './theme';
import { classicBlackTheme } from './themes';

interface Props {
  config: AccordionConfig;
  activeKeys: Set<string>;
  pressedKeys?: Set<string>;
  onKeyPress?: (keyId: string, midi: number[]) => void;
  mirrored?: boolean;
  /** Visual skin. Defaults to classicBlackTheme. */
  theme?: AccordionTheme;
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
const BELLOWS_W = 152;

const TREBLE_X  = BELLOWS_X + BELLOWS_W;
const KEY_X     = TREBLE_X + 6;  // left edge of keyboard

// Legacy 2-col bass constants
const BASS_COL0_X  = BASS_X + 143;
const BASS_COL1_X  = BASS_X + 68;
const BASS_EDGE_CLIP = 4;
const BTN_STAGGER  = 30;
const BTN_ROW_GAP  = 65;
const LEGACY_BTN_R = 21;

// ─── Gradient helpers ──────────────────────────────────────────────────────────
function applyStops(grad: CanvasGradient, stops: GradStop[]) {
  stops.forEach(([pos, color]) => grad.addColorStop(pos, color));
}

function applyStopsReversed(grad: CanvasGradient, stops: GradStop[]) {
  [...stops].reverse().forEach(([pos, color]) => grad.addColorStop(1 - pos, color));
}

/** Convert a 6-digit hex colour to `rgba(r,g,b,alpha)` */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
    const topY = Math.round((CH - (bassRows - 1) * BTN_ROW_GAP) / 2);
    return {
      BTN_R: LEGACY_BTN_R,
      colXs: [BASS_COL0_X, BASS_COL1_X],
      rowYs: Array.from({ length: bassRows }, (_, i) => topY + i * BTN_ROW_GAP),
      colYOffsets: [0, -BTN_STAGGER],
      headerY: topY - LEGACY_BTN_R - 14,
    };
  }

  // 6-col (120-bass): col 0 rightmost (inner, closest to bellows), col 5 leftmost (outer)
  const colSpacing = BASS_W / (bassCols + 1);
  const HEADER_H   = 24;
  const availH     = CH - HEADER_H - 8;
  const rowSpacing = availH / (bassRows + (bassCols - 1) * 0.4);
  const stepPerCol = rowSpacing * 0.4;
  const BTN_R = Math.floor(Math.min(colSpacing * 0.43, rowSpacing * 0.43));

  return {
    BTN_R,
    colXs: Array.from({ length: bassCols }, (_, i) => BASS_X + colSpacing * (bassCols - i)),
    rowYs: Array.from({ length: bassRows }, (_, i) => HEADER_H + rowSpacing * 0.5 + i * rowSpacing),
    colYOffsets: Array.from({ length: bassCols }, (_, i) => (bassCols - 1 - i) * stepPerCol),
    headerY: HEADER_H * 0.5 + 3,
  };
}

function bassButtonPos(btn: BassButton, layout: BassLayout): { x: number; y: number } {
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
function drawBody(ctx: CanvasRenderingContext2D, CH: number, t: AccordionTheme) {
  const grad = ctx.createLinearGradient(0, 0, CW, CH);
  applyStops(grad, t.body.gradient);
  ctx.beginPath();
  ctx.roundRect(0, 0, CW, CH, BODY_R);
  ctx.fillStyle = grad;
  ctx.fill();

  // Surface texture (gloss streaks OR wood grain lines)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, CW, CH, BODY_R);
  ctx.clip();
  ctx.globalAlpha = t.body.grainAlpha;
  ctx.strokeStyle = t.body.grainColor;

  if (t.body.grainStyle === 'gloss') {
    // Wide diagonal specular reflections on lacquer
    ctx.lineWidth = 18;
    for (let x = -CH * 0.5; x < CW + CH; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + CH * 0.6, CH);
      ctx.stroke();
    }
    // Single bright specular near top-left
    ctx.globalAlpha = t.body.grainAlpha * 1.4;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(200, CH * 0.35);
    ctx.stroke();
  } else {
    // Fine diagonal wood-grain lines
    ctx.lineWidth = 1;
    for (let x = -CH; x < CW + CH; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + CH, CH);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Outer border stroke
  const border = ctx.createLinearGradient(0, 0, 0, CH);
  applyStops(border, t.body.border);
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(0, 0, CW, CH, BODY_R);
  ctx.stroke();

  // Inner seam highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(2, 2, CW - 4, CH - 4, BODY_R - 2);
  ctx.stroke();
}

// ─── Draw: bass panel background ──────────────────────────────────────────────
function drawBassPanelBackground(ctx: CanvasRenderingContext2D, CH: number, t: AccordionTheme) {
  ctx.beginPath();
  ctx.roundRect(BASS_X + 5, 5, BASS_W - 6, CH - 10, [BODY_R - 4, 0, 0, BODY_R - 4]);
  const grad = ctx.createLinearGradient(BASS_X, 0, BASS_X + BASS_W, 0);
  applyStops(grad, t.bassPanel.gradient);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(BASS_X + 5, 5, BASS_W - 6, CH - 10, [BODY_R - 4, 0, 0, BODY_R - 4]);
  ctx.clip();

  // Horizontal scan lines for texture depth
  ctx.strokeStyle = t.bassPanel.gridColor;
  ctx.lineWidth = 1;
  for (let y = 10; y < CH - 5; y += 5) {
    ctx.beginPath();
    ctx.moveTo(BASS_X + 5, y);
    ctx.lineTo(BASS_X + BASS_W - 1, y);
    ctx.stroke();
  }

  // Speaker grille dot-pattern at bottom third
  const grillTop = CH * 0.75;
  const grillBot = CH - 14;
  ctx.fillStyle = t.bassPanel.grilleColor;
  let row = 0;
  for (let gy = grillTop + 6; gy < grillBot; gy += 9) {
    const offset = (row % 2) * 4.5;
    for (let gx = BASS_X + 10 + offset; gx < BASS_X + BASS_W - 10; gx += 9) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    row++;
  }

  // Left-edge gloss catch-light
  const sheen = ctx.createLinearGradient(BASS_X + 5, 0, BASS_X + 22, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(BASS_X + 5, 5, 17, CH - 10);

  ctx.restore();
}

function drawBassPanelLabel(
  ctx: CanvasRenderingContext2D, CH: number, mirrored: boolean, t: AccordionTheme,
) {
  ctx.fillStyle = t.labels.bassPanel;
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  fillTextSafe(ctx, '左手 BASS', BASS_X + BASS_W / 2, CH - 7, mirrored);
}

// ─── Draw: bellows ────────────────────────────────────────────────────────────
// Folds run vertically (top-to-bottom), creating the characteristic parallel
// pleats visible on a real accordion when viewed from the front.
function drawBellows(ctx: CanvasRenderingContext2D, CH: number, t: AccordionTheme) {
  const x      = BELLOWS_X;
  const foldW  = 9;   // width of each vertical pleat in pixels
  const edgeH  = 10;  // height of top/bottom edge binding strips
  const numFolds = Math.ceil(BELLOWS_W / foldW) + 1;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, BELLOWS_W, CH);
  ctx.clip();

  // Vertical extent of fold faces is constant across all folds
  const innerY = edgeH;
  const innerH = CH - edgeH * 2;
  const litW   = Math.round(foldW * 0.42);
  const shadW  = foldW - litW;

  for (let i = 0; i < numFolds; i++) {
    const fx = x + i * foldW;

    // Lit face — left portion of each pleat, catches light from left/above
    const litG = ctx.createLinearGradient(fx, 0, fx + litW, 0);
    applyStops(litG, t.bellows.litFace);
    ctx.beginPath();
    ctx.rect(fx, innerY, litW, innerH);
    ctx.fillStyle = litG;
    ctx.fill();

    // Shadow face — right portion of pleat, recedes into shadow
    const shadG = ctx.createLinearGradient(fx + litW, 0, fx + foldW, 0);
    applyStops(shadG, t.bellows.shadowFace);
    ctx.beginPath();
    ctx.rect(fx + litW, innerY, shadW, innerH);
    ctx.fillStyle = shadG;
    ctx.fill();

    // Ridge highlight — vertical bright line at each fold peak
    ctx.beginPath();
    ctx.moveTo(fx + 0.5, innerY + 2);
    ctx.lineTo(fx + 0.5, innerY + innerH - 2);
    ctx.strokeStyle = i % 2 === 0 ? t.bellows.ridgePrimary : t.bellows.ridgeSecondary;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Valley shadow — vertical dark line at each fold trough
    ctx.beginPath();
    ctx.moveTo(fx + foldW - 0.5, innerY + 4);
    ctx.lineTo(fx + foldW - 0.5, innerY + innerH - 4);
    ctx.strokeStyle = t.bellows.valleyColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Top edge binding strip (outer-edge → inner-edge, top-down)
  const topBind = ctx.createLinearGradient(0, 0, 0, edgeH);
  applyStops(topBind, t.bellows.edgeBind);
  ctx.beginPath();
  ctx.rect(x, 0, BELLOWS_W, edgeH);
  ctx.fillStyle = topBind;
  ctx.fill();

  // Bottom edge binding strip (inner→outer = reversed)
  const botBind = ctx.createLinearGradient(0, CH - edgeH, 0, CH);
  applyStopsReversed(botBind, t.bellows.edgeBind);
  ctx.beginPath();
  ctx.rect(x, CH - edgeH, BELLOWS_W, edgeH);
  ctx.fillStyle = botBind;
  ctx.fill();

  // Metallic corner patches along top and bottom edges every ~5 folds
  const patchW = 7;
  const patchH = edgeH + 2;
  const patchInterval = foldW * 5;
  for (let px = x; px < x + BELLOWS_W; px += patchInterval) {
    const tpg = ctx.createLinearGradient(px, 0, px + patchW, patchH);
    applyStops(tpg, t.bellows.cornerPatch);
    ctx.beginPath();
    ctx.rect(px, 0, patchW, patchH);
    ctx.fillStyle = tpg;
    ctx.fill();

    const bpg = ctx.createLinearGradient(px, CH - patchH, px + patchW, CH);
    applyStopsReversed(bpg, t.bellows.cornerPatch);
    ctx.beginPath();
    ctx.rect(px, CH - patchH, patchW, patchH);
    ctx.fillStyle = bpg;
    ctx.fill();
  }

  ctx.restore();

  // Left and right chrome border lines (between bellows and adjacent panels)
  const sideBorder = ctx.createLinearGradient(0, 0, 0, CH);
  applyStops(sideBorder, t.bellows.border);
  ctx.strokeStyle = sideBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);             ctx.lineTo(x, CH);
  ctx.moveTo(x + BELLOWS_W, 0); ctx.lineTo(x + BELLOWS_W, CH);
  ctx.stroke();

  // Thin inner highlight just inside each border
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 1.5, 2);             ctx.lineTo(x + 1.5, CH - 2);
  ctx.moveTo(x + BELLOWS_W - 1.5, 2); ctx.lineTo(x + BELLOWS_W - 1.5, CH - 2);
  ctx.stroke();
}

// ─── Draw: treble housing ─────────────────────────────────────────────────────
function drawTreblePanel(ctx: CanvasRenderingContext2D, CH: number, t: AccordionTheme) {
  ctx.beginPath();
  ctx.roundRect(TREBLE_X + 2, 5, CW - TREBLE_X - 7, CH - 10, [0, BODY_R - 4, BODY_R - 4, 0]);
  const grad = ctx.createLinearGradient(TREBLE_X, 0, CW, 0);
  applyStops(grad, t.treble.housing);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ─── Draw: keyboard metallic frame ────────────────────────────────────────────
function drawKeyboardFrame(ctx: CanvasRenderingContext2D, CH: number, t: AccordionTheme) {
  const fx = KEY_X - 5;
  const fy = 4;
  const fw = WK_W + 7;
  const fh = CH - 8;

  // Frame body with chrome facets
  const frameGrad = ctx.createLinearGradient(fx, 0, fx + fw, 0);
  applyStops(frameGrad, t.treble.frame);
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, 5);
  ctx.fillStyle = frameGrad;
  ctx.fill();

  // Outer chrome highlight edge
  ctx.beginPath();
  ctx.roundRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1, 5);
  ctx.strokeStyle = t.treble.frameHighlight;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inner shadow lip (pressed-in key recess)
  ctx.beginPath();
  ctx.roundRect(KEY_X - 1, fy + 2, WK_W + 2, fh - 4, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ─── Draw: keyboard AO shadow overlay ─────────────────────────────────────────
// Drawn AFTER keys to simulate the ambient-occlusion depth of keys being
// recessed into the housing slot.  Colours are always neutral black shadows.
function drawKeyboardAOShadow(ctx: CanvasRenderingContext2D, CH: number) {
  const kx = KEY_X;
  const ky = 5;
  const kw = WK_W;
  const kh = CH - 10;

  ctx.save();
  ctx.beginPath();
  ctx.rect(kx, ky, kw, kh);
  ctx.clip();

  const topAO = ctx.createLinearGradient(0, ky, 0, ky + 10);
  topAO.addColorStop(0, 'rgba(0,0,0,0.5)');
  topAO.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topAO;
  ctx.fillRect(kx, ky, kw, 10);

  const botAO = ctx.createLinearGradient(0, ky + kh - 10, 0, ky + kh);
  botAO.addColorStop(0, 'rgba(0,0,0,0)');
  botAO.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = botAO;
  ctx.fillRect(kx, ky + kh - 10, kw, 10);

  // Left-edge inner shadow where keys emerge from the housing wall
  const leftAO = ctx.createLinearGradient(kx, 0, kx + 9, 0);
  leftAO.addColorStop(0, 'rgba(0,0,0,0.45)');
  leftAO.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftAO;
  ctx.fillRect(kx, ky, 9, kh);

  ctx.restore();
}

// ─── Draw: white key ──────────────────────────────────────────────────────────
function drawWhiteKey(
  ctx: CanvasRenderingContext2D,
  key: TrebleKey,
  numWK: number,
  active: boolean,
  pressed: boolean,
  highlightColor: string,
  pressedColor: string,
  t: AccordionTheme,
) {
  const y = whiteKeyY(key, numWK);

  ctx.beginPath();
  ctx.roundRect(KEY_X, y + 0.5, WK_W, WK_H - 1, [0, 5, 5, 0]);

  if (pressed) {
    ctx.fillStyle = pressedColor;
    ctx.fill();
  } else {
    // Always draw ivory base — even when active (glow overlays the texture)
    const kg = ctx.createLinearGradient(KEY_X, y, KEY_X, y + WK_H);
    applyStops(kg, t.keys.white);
    ctx.fillStyle = kg;
    ctx.fill();

    // Top-edge micro shadow (key recessed; top edge catches less light)
    const topShade = ctx.createLinearGradient(KEY_X, y, KEY_X, y + 4);
    topShade.addColorStop(0, 'rgba(0,0,0,0.14)');
    topShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.roundRect(KEY_X, y + 0.5, WK_W, WK_H - 1, [0, 5, 5, 0]);
    ctx.fillStyle = topShade;
    ctx.fill();

    if (active) {
      // Screen-blend glow: diffused coloured light over the preserved ivory texture
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(KEY_X - 1, y - 1, WK_W + 2, WK_H + 2, [0, 6, 6, 0]);
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = `blur(${t.keys.glowBlur}px)`;
      const glowG = ctx.createRadialGradient(
        KEY_X + WK_W * 0.4, y + WK_H * 0.5, 0,
        KEY_X + WK_W * 0.4, y + WK_H * 0.5, WK_W * 0.65,
      );
      glowG.addColorStop(0,   hexToRgba(highlightColor, 0.88));
      glowG.addColorStop(0.5, hexToRgba(highlightColor, 0.45));
      glowG.addColorStop(1,   hexToRgba(highlightColor, 0));
      ctx.fillStyle = glowG;
      ctx.fillRect(KEY_X - 10, y - 10, WK_W + 20, WK_H + 20);
      ctx.restore();
    }
  }

  // Key border
  ctx.beginPath();
  ctx.roundRect(KEY_X, y + 0.5, WK_W, WK_H - 1, [0, 5, 5, 0]);
  ctx.strokeStyle = active ? hexToRgba(highlightColor, 0.65) : t.keys.whiteBorder;
  ctx.lineWidth = active ? 1.5 : 0.8;
  ctx.stroke();

  // C-marker dot
  if (key.noteName === 'C') {
    ctx.beginPath();
    ctx.arc(KEY_X + WK_W - 12, y + WK_H / 2, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = active || pressed ? '#1a1a2e' : '#aaaaaa';
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
  highlightColor: string,
  pressedColor: string,
  t: AccordionTheme,
) {
  const y = blackKeyY(key, numWK);

  ctx.beginPath();
  ctx.roundRect(KEY_X, y, BK_W, BK_H, [0, 4, 4, 0]);

  if (pressed) {
    ctx.fillStyle = pressedColor;
    ctx.fill();
  } else {
    // Vertical dark gradient — top edge is brightest (catches overhead light)
    const kg = ctx.createLinearGradient(KEY_X, y, KEY_X, y + BK_H);
    applyStops(kg, t.keys.black);
    ctx.fillStyle = kg;
    ctx.fill();

    // Top-edge specular — narrow bright rim simulating light on the key's top face
    ctx.beginPath();
    ctx.roundRect(KEY_X + 1, y, BK_W - 2, 2.5, [0, 2, 0, 0]);
    ctx.fillStyle = t.keys.blackSpecular;
    ctx.fill();

    // Left-edge secondary catch-light
    ctx.beginPath();
    ctx.rect(KEY_X, y + 1, 2, BK_H - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();

    if (active) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(KEY_X - 1, y - 1, BK_W + 2, BK_H + 2, [0, 5, 5, 0]);
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = `blur(${t.keys.glowBlur - 1}px)`;
      const glowG = ctx.createRadialGradient(
        KEY_X + BK_W * 0.4, y + BK_H * 0.5, 0,
        KEY_X + BK_W * 0.4, y + BK_H * 0.5, BK_W * 0.6,
      );
      glowG.addColorStop(0,   hexToRgba(highlightColor, 0.92));
      glowG.addColorStop(0.5, hexToRgba(highlightColor, 0.5));
      glowG.addColorStop(1,   hexToRgba(highlightColor, 0));
      ctx.fillStyle = glowG;
      ctx.fillRect(KEY_X - 8, y - 6, BK_W + 16, BK_H + 12);
      ctx.restore();
    }
  }

  // Key outline
  ctx.beginPath();
  ctx.roundRect(KEY_X, y, BK_W, BK_H, [0, 4, 4, 0]);
  ctx.strokeStyle = active ? hexToRgba(highlightColor, 0.65) : '#080808';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ─── Draw: bass column headers ─────────────────────────────────────────────────
const COL_LABELS_2 = ['根', '和'];
const COL_LABELS_6 = ['反', '根', '大', '小', '七', '减'];

function drawBassColHeaders(
  ctx: CanvasRenderingContext2D,
  layout: BassLayout,
  mirrored: boolean,
  t: AccordionTheme,
) {
  const labels = layout.colXs.length === 2 ? COL_LABELS_2 : COL_LABELS_6;
  ctx.fillStyle = t.labels.colHeader;
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (layout.colXs.length === 2 && layout.headerY < 8) return;

  layout.colXs.forEach((cx, i) => {
    if (i >= labels.length) return;
    fillTextSafe(ctx, labels[i], cx, layout.headerY, mirrored);
  });
  ctx.textBaseline = 'alphabetic';
}

// ─── Draw: bass button ────────────────────────────────────────────────────────
function drawBassButton(
  ctx: CanvasRenderingContext2D,
  btn: BassButton,
  x: number,
  y: number,
  BTN_R: number,
  active: boolean,
  pressed: boolean,
  highlightColor: string,
  pressedColor: string,
  mirrored: boolean,
  t: AccordionTheme,
) {
  ctx.beginPath();
  ctx.arc(x + 1.5, y + 2.5, BTN_R + 2, 0, Math.PI * 2);
  ctx.fillStyle = t.bassButtons.dropShadow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, BTN_R + 2.5, 0, Math.PI * 2);
  const ringG = ctx.createRadialGradient(
    x - BTN_R * 0.25, y - BTN_R * 0.25, BTN_R * 0.05,
    x + BTN_R * 0.1,  y + BTN_R * 0.1,  BTN_R + 2.5,
  );
  applyStops(ringG, t.bassButtons.ring);
  ctx.fillStyle = ringG;
  ctx.fill();

  const typeColors = t.bassButtons.types[btn.type] ?? ['#404040', '#202020', '#080808'];
  const [crest, mid, edge] = typeColors;

  ctx.beginPath();
  ctx.arc(x, y, BTN_R, 0, Math.PI * 2);

  if (pressed) {
    ctx.fillStyle = pressedColor;
    ctx.shadowColor = pressedColor;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // Black pearl radial gradient — light source at upper-left for dome depth
    const bg = ctx.createRadialGradient(
      x - BTN_R * 0.35, y - BTN_R * 0.35, BTN_R * 0.04,
      x + BTN_R * 0.12, y + BTN_R * 0.12, BTN_R * 1.12,
    );
    bg.addColorStop(0,    crest);
    bg.addColorStop(0.45, mid);
    bg.addColorStop(1,    edge);
    ctx.fillStyle = bg;
    ctx.fill();

    // Pearl iridescent layer — two offset radial glints
    if (BTN_R >= 7) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, BTN_R, 0, Math.PI * 2);
      ctx.clip();

      const p1 = ctx.createRadialGradient(
        x - BTN_R * 0.3, y - BTN_R * 0.4, 0,
        x - BTN_R * 0.1, y - BTN_R * 0.2, BTN_R * 0.7,
      );
      p1.addColorStop(0,   'rgba(255,255,255,0.14)');
      p1.addColorStop(0.5, 'rgba(200,220,255,0.06)');
      p1.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = p1;
      ctx.fillRect(x - BTN_R, y - BTN_R, BTN_R * 2, BTN_R * 2);

      const p2 = ctx.createRadialGradient(
        x + BTN_R * 0.15, y - BTN_R * 0.2, 0,
        x + BTN_R * 0.15, y - BTN_R * 0.2, BTN_R * 0.4,
      );
      p2.addColorStop(0, 'rgba(180,200,255,0.09)');
      p2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = p2;
      ctx.fillRect(x - BTN_R, y - BTN_R, BTN_R * 2, BTN_R * 2);

      ctx.restore();
    }

    if (active) {
      // Screen-blend glow over the preserved material
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, BTN_R + 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = `blur(${t.bassButtons.glowBlur}px)`;
      const glowG = ctx.createRadialGradient(x, y, 0, x, y, BTN_R * 1.1);
      glowG.addColorStop(0,   hexToRgba(highlightColor, 0.95));
      glowG.addColorStop(0.5, hexToRgba(highlightColor, 0.55));
      glowG.addColorStop(1,   hexToRgba(highlightColor, 0));
      ctx.fillStyle = glowG;
      ctx.beginPath();
      ctx.arc(x, y, BTN_R * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Dome crescent highlight arc
  if (!pressed && BTN_R >= 8) {
    ctx.beginPath();
    ctx.arc(x - BTN_R * 0.15, y - BTN_R * 0.18, BTN_R * 0.56, Math.PI * 0.72, Math.PI * 1.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = BTN_R * 0.2;
    ctx.stroke();
  }

  // Note name label
  if (BTN_R >= 8) {
    const fontSize = Math.max(7, Math.min(Math.floor(BTN_R * 0.68), 13));
    ctx.fillStyle = active || pressed ? '#0a0a0a' : '#e8e8e8';
    ctx.font = `bold ${fontSize}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fillTextSafe(ctx, btn.label, x, y - 0.5, mirrored);
  }

  // Sub-label for larger buttons
  if (BTN_R >= 16) {
    const isMajor = btn.type === 'major';
    ctx.fillStyle = active || pressed ? '#0a0a0a' : (isMajor ? '#8888cc' : '#777777');
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fillTextSafe(ctx, isMajor ? '和' : '根', x, y + 10, mirrored);
  }

  ctx.textBaseline = 'alphabetic';

  if (!active && !pressed && BTN_R >= 10 && TACTILE_MARKER_ROOTS.has(btn.rootNote)) {
    const primary = btn.rootNote === 'C';
    ctx.beginPath();
    ctx.arc(x, y - BTN_R * 0.3, BTN_R * (primary ? 0.15 : 0.09), 0, Math.PI * 2);
    ctx.fillStyle = primary ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)';
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
  theme = classicBlackTheme,
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

  // Static background rendered once per config+theme change; stamped each frame.
  // Includes: body, bass panel, bellows, treble housing, keyboard frame.
  const staticBg = useMemo((): OffscreenCanvas => {
    const oc = new OffscreenCanvas(CW, CH);
    const octx = oc.getContext('2d')! as unknown as CanvasRenderingContext2D;
    drawBody(octx, CH, theme);
    drawBassPanelBackground(octx, CH, theme);
    drawBellows(octx, CH, theme);
    drawTreblePanel(octx, CH, theme);
    drawKeyboardFrame(octx, CH, theme);
    return oc;
  }, [CH, theme]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CW, CH);

    ctx.drawImage(staticBg, 0, 0);
    drawBassPanelLabel(ctx, CH, mirrored, theme);

    wk.forEach(key => drawWhiteKey(
      ctx, key, numWK,
      activeKeys.has(key.id), pressedKeys.has(key.id),
      highlightColor, pressedColor, theme,
    ));

    // White key gap dividers
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    wk.forEach(key => {
      const y = whiteKeyY(key, numWK);
      ctx.beginPath();
      ctx.moveTo(KEY_X + 2, y + WK_H - 0.5);
      ctx.lineTo(KEY_X + WK_W - 4, y + WK_H - 0.5);
      ctx.stroke();
    });

    bk.forEach(key => drawBlackKey(
      ctx, key, numWK,
      activeKeys.has(key.id), pressedKeys.has(key.id),
      highlightColor, pressedColor, theme,
    ));

    drawKeyboardAOShadow(ctx, CH);

    // Bass column headers
    drawBassColHeaders(ctx, bassLayout, mirrored, theme);

    // Bass buttons
    config.bass.buttons.forEach(btn => {
      const { x, y } = bassButtonPos(btn, bassLayout);
      if (y < BASS_EDGE_CLIP || y > CH - BASS_EDGE_CLIP) return;
      drawBassButton(
        ctx, btn, x, y, bassLayout.BTN_R,
        activeKeys.has(btn.id), pressedKeys.has(btn.id),
        highlightColor, pressedColor, mirrored, theme,
      );
    });
  }, [activeKeys, pressedKeys, config, wk, bk, numWK, CH, highlightColor, pressedColor, mirrored, bassLayout, staticBg, theme]);

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

    // Black keys first (they overlap white key slots)
    for (const key of bk) {
      const y = blackKeyY(key, numWK);
      if (cx >= KEY_X && cx <= KEY_X + BK_W && cy >= y && cy <= y + BK_H) {
        onKeyPress(key.id, [key.midi]);
        return;
      }
    }
    for (const key of wk) {
      const y = whiteKeyY(key, numWK);
      if (cx >= KEY_X && cx <= KEY_X + WK_W && cy >= y && cy <= y + WK_H) {
        onKeyPress(key.id, [key.midi]);
        return;
      }
    }
    for (const btn of config.bass.buttons) {
      const { x, y } = bassButtonPos(btn, bassLayout);
      if (y < BASS_EDGE_CLIP || y > CH - BASS_EDGE_CLIP) continue;
      if (Math.hypot(cx - x, cy - y) <= bassLayout.BTN_R + 4) {
        onKeyPress(btn.id, btn.midi);
        return;
      }
    }
  }, [onKeyPress, bk, wk, config.bass.buttons, numWK, bassLayout, mirrored]);

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
