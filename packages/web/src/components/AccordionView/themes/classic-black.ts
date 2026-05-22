/**
 * packages/web/src/components/AccordionView/themes/classic-black.ts
 *
 * Piano Black & White Classic theme — inspired by concert-grade black-lacquer
 * accordions (e.g. Roland FR-7x).
 *
 * Palette summary:
 *   Body    — dark charcoal gloss with diagonal specular streaks
 *   Bellows — dark gray leather folds, silver ridge highlights, chrome binding
 *   Keys    — pure ivory white keys, near-black black keys
 *   Buttons — black pearl radial gradient with chrome ring
 *   Trim    — silver-chrome borders
 *
 * Section values are ordered brightest→darkest (bellows > body > treble > bass panel)
 * to maintain visible contrast separation from the dark page background.
 */
import type { AccordionTheme } from '../theme';

export const classicBlackTheme: AccordionTheme = {
  id: 'classic-black',

  body: {
    gradient: [
      [0,    '#404040'],
      [0.25, '#282828'],
      [0.6,  '#181818'],
      [1,    '#101010'],
    ],
    grainStyle: 'gloss',
    grainColor: '#ffffff',
    grainAlpha: 0.06,
    border: [
      [0,   '#d8d8d8'],
      [0.3, '#a0a0a0'],
      [0.7, '#909090'],
      [1,   '#c0c0c0'],
    ],
  },

  bassPanel: {
    gradient: [
      [0, '#202020'],
      [1, '#141414'],
    ],
    gridColor:   'rgba(255,255,255,0.07)',
    grilleColor: 'rgba(255,255,255,0.13)',
  },

  bellows: {
    litFace: [
      [0,   '#585858'],
      [0.5, '#383838'],
      [1,   '#242424'],
    ],
    shadowFace: [
      [0,   '#1a1a1a'],
      [0.6, '#101010'],
      [1,   '#080808'],
    ],
    ridgePrimary:   'rgba(220,220,220,0.80)',
    ridgeSecondary: 'rgba(160,160,160,0.52)',
    valleyColor:    'rgba(0,0,0,0.90)',
    edgeBind: [
      [0,   '#383838'],
      [0.4, '#282828'],
      [1,   '#141414'],
    ],
    cornerPatch: [
      [0,   '#aaaaaa'],
      [0.4, '#e8e8e8'],
      [1,   '#777777'],
    ],
    border: [
      [0,   '#d8d8d8'],
      [0.5, '#909090'],
      [1,   '#b8b8b8'],
    ],
  },

  treble: {
    housing: [
      [0,   '#303030'],
      [0.3, '#202020'],
      [1,   '#141414'],
    ],
    frame: [
      [0,    '#484848'],
      [0.08, '#686868'],
      [0.5,  '#505050'],
      [0.92, '#686868'],
      [1,    '#484848'],
    ],
    frameHighlight: 'rgba(230,230,230,0.35)',
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
