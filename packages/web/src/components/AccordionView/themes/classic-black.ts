/**
 * packages/web/src/components/AccordionView/themes/classic-black.ts
 *
 * Piano Black & White Classic theme — inspired by concert-grade black-lacquer
 * accordions (e.g. Roland FR-7x).
 *
 * Palette summary:
 *   Body    — deep piano-black gloss with diagonal specular streaks
 *   Bellows — black leather folds, silver ridge highlights, chrome binding
 *   Keys    — pure ivory white keys, near-black black keys
 *   Buttons — black pearl radial gradient with chrome ring
 *   Trim    — silver-chrome borders (replaces gold on "natural" instruments)
 */
import type { AccordionTheme } from '../theme';

export const classicBlackTheme: AccordionTheme = {
  id: 'classic-black',

  body: {
    gradient: [
      [0,    '#2e2e2e'],
      [0.25, '#1a1a1a'],
      [0.6,  '#0e0e0e'],
      [1,    '#080808'],
    ],
    grainStyle: 'gloss',
    grainColor: '#ffffff',
    grainAlpha: 0.045,
    border: [
      [0,   '#d0d0d0'],
      [0.3, '#909090'],
      [0.7, '#888888'],
      [1,   '#b0b0b0'],
    ],
  },

  bassPanel: {
    gradient: [
      [0, '#0a0a0a'],
      [1, '#050505'],
    ],
    gridColor:   'rgba(255,255,255,0.04)',
    grilleColor: 'rgba(255,255,255,0.07)',
  },

  bellows: {
    litFace: [
      [0,   '#343434'],
      [0.5, '#222222'],
      [1,   '#141414'],
    ],
    shadowFace: [
      [0,   '#0d0d0d'],
      [0.6, '#070707'],
      [1,   '#030303'],
    ],
    ridgePrimary:   'rgba(210,210,210,0.72)',
    ridgeSecondary: 'rgba(155,155,155,0.45)',
    valleyColor:    'rgba(0,0,0,0.88)',
    edgeBind: [
      [0,   '#2a2a2a'],
      [0.4, '#1c1c1c'],
      [1,   '#0a0a0a'],
    ],
    cornerPatch: [
      [0,   '#999999'],
      [0.4, '#dddddd'],
      [1,   '#666666'],
    ],
    border: [
      [0,   '#cccccc'],
      [0.5, '#888888'],
      [1,   '#aaaaaa'],
    ],
  },

  treble: {
    housing: [
      [0,   '#1e1e1e'],
      [0.3, '#141414'],
      [1,   '#0a0a0a'],
    ],
    frame: [
      [0,    '#3a3a3a'],
      [0.08, '#555555'],
      [0.5,  '#404040'],
      [0.92, '#555555'],
      [1,    '#3a3a3a'],
    ],
    frameHighlight: 'rgba(220,220,220,0.3)',
  },

  keys: {
    white: [
      [0,    '#FFFFFF'],
      [0.75, '#F0F0F0'],
      [1,    '#E8E8E8'],
    ],
    whiteBorder: '#b8b8b8',
    black: [
      [0,    '#2e2e2e'],
      [0.15, '#1e1e1e'],
      [0.7,  '#141414'],
      [1,    '#0a0a0a'],
    ],
    blackSpecular: 'rgba(255,255,255,0.18)',
    glowBlur: 5,
  },

  bassButtons: {
    ring: [
      [0,    '#e0e0e0'],
      [0.45, '#aaaaaa'],
      [0.75, '#666666'],
      [1,    '#333333'],
    ],
    dropShadow: 'rgba(0,0,0,0.65)',
    glowBlur: 5,
    types: {
      bass:        ['#484848', '#282828', '#0a0a0a'],
      counterbass: ['#3a3a28', '#252515', '#0c0c06'],
      major:       ['#303058', '#181840', '#08081e'],
      minor:       ['#203040', '#101c28', '#050d14'],
      dominant7:   ['#302838', '#181020', '#0c060e'],
      diminished:  ['#383838', '#202020', '#080808'],
    },
  },

  labels: {
    bassPanel: 'rgba(180,180,200,0.28)',
    colHeader:  'rgba(200,200,220,0.32)',
  },
};
