/**
 * packages/web/src/components/AccordionView/theme.ts
 *
 * AccordionTheme interface — pure data that fully describes the visual skin of the
 * accordion canvas.  No Canvas API references here; all values are CSS color strings
 * and gradient-stop arrays that draw functions consume at runtime.
 *
 * Gradient stops: [position 0-1, CSS color string][].
 * The draw functions create the actual CanvasGradient objects and apply these stops.
 *
 * Active glow color is NOT stored in the theme — it comes from
 * config.visual.highlightColor so each instrument can have a distinct highlight hue
 * while sharing the same visual skin.
 */

/** [position, cssColor] gradient stop tuple */
export type GradStop = [number, string];

export interface AccordionTheme {
  readonly id: string;

  /** Instrument body (lacquered housing) */
  readonly body: {
    /** Diagonal gradient (top-left → bottom-right) for main fill */
    readonly gradient: GradStop[];
    /** 'gloss' = diagonal specular streaks; 'wood' = diagonal grain lines */
    readonly grainStyle: 'gloss' | 'wood';
    readonly grainColor: string;
    readonly grainAlpha: number;
    /** Vertical (top → bottom) gradient for the outer chrome/gold border stroke */
    readonly border: GradStop[];
  };

  /** Left-hand bass panel */
  readonly bassPanel: {
    /** Horizontal (left → right) fill gradient */
    readonly gradient: GradStop[];
    /** Colour of subtle horizontal scan lines */
    readonly gridColor: string;
    /** Colour of the speaker grille dot array */
    readonly grilleColor: string;
  };

  /** Center bellows (folded accordion bellows) */
  readonly bellows: {
    /** Vertical gradient for the lit (outward-facing) face of each fold */
    readonly litFace: GradStop[];
    /** Vertical gradient for the shadow (inward-facing) face of each fold */
    readonly shadowFace: GradStop[];
    /** Colour of the bright ridge highlight line at each fold peak (even folds) */
    readonly ridgePrimary: string;
    /** Dimmer ridge highlight (odd folds) */
    readonly ridgeSecondary: string;
    /** Colour of the deep shadow line at each fold valley */
    readonly valleyColor: string;
    /**
     * Horizontal gradient for the left binding strip (outer-edge → inner-edge).
     * The right strip uses the same stops with reversed direction.
     */
    readonly edgeBind: GradStop[];
    /**
     * Gradient for the metallic corner-patch reinforcements.
     * Applied diagonally so the brightest stop lands at centre.
     */
    readonly cornerPatch: GradStop[];
    /** Vertical (top → bottom) gradient for the side chrome/gold border stroke */
    readonly border: GradStop[];
  };

  /** Right-hand treble section */
  readonly treble: {
    /** Horizontal fill gradient for the housing panel behind the keyboard */
    readonly housing: GradStop[];
    /** Horizontal fill gradient for the metallic frame around the keyboard area */
    readonly frame: GradStop[];
    /** CSS color for the thin outer highlight edge of the keyboard frame */
    readonly frameHighlight: string;
  };

  /** Piano key visuals */
  readonly keys: {
    /** Vertical gradient (top → bottom of key slot) for white keys at rest */
    readonly white: GradStop[];
    /** Stroke colour for white key borders */
    readonly whiteBorder: string;
    /** Vertical gradient (top → bottom of key slot) for black keys at rest */
    readonly black: GradStop[];
    /** Colour of the specular highlight line at the top edge of each black key */
    readonly blackSpecular: string;
    /** Gaussian blur radius (px) applied to the screen-blend active-key glow */
    readonly glowBlur: number;
  };

  /** Bass button visuals */
  readonly bassButtons: {
    /** Radial gradient stops for the metallic ring (light source upper-left) */
    readonly ring: GradStop[];
    /** Drop-shadow colour behind each button */
    readonly dropShadow: string;
    /**
     * Per-type colour triples [crest, mid, edge] used for the button face radial
     * gradient.  Keys must match every BassButton['type'] value.
     */
    readonly types: Record<string, readonly [string, string, string]>;
    /** Gaussian blur radius (px) for the screen-blend active glow on bass buttons */
    readonly glowBlur: number;
  };

  /** Text label colours */
  readonly labels: {
    readonly bassPanel: string;
    readonly colHeader: string;
  };
}
