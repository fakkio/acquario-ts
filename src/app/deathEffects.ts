import type {OrganismView} from "../world";
import {drawBody, type BodyShape} from "./bodyGlyph";

/**
 * The moment of going (ticket #24), App-layer only: no world-side dying
 * state, because that would be state crossing tick boundaries for the sake
 * of a visual — the thing ADR-0015 already refused for `α` smoothing. Body
 * brightness already fades an organism to a dim ghost of its `lineageHue`
 * as its energy runs out (M2, ADR-0010); this adds the ring for the tick it
 * actually vanishes, around the body itself fading out with its organelles
 * (M7), so the effect shows the body that died.
 *
 * Driven off **wall-clock**, not ticks, so it reads the same at any
 * simulation speed and keeps animating while the sim is paused — the
 * caller feeds it `nowMs` every animation frame regardless of whether a
 * tick ran. Subjects are found by diffing object identity against the
 * previous frame's population: `getPopulation` hands out the live
 * `Organism[]` narrowed to `readonly OrganismView[]`, so a reference that
 * was there last frame and is gone this frame just died.
 */
export interface DeathEffects {
  /** Diffs `population` against the previous frame's, spawning one effect
   * per reference that has disappeared. Call once per animation frame,
   * before `draw`. */
  recordFrame(population: readonly OrganismView[], nowMs: number): void;
  /** Draws every effect still inside its lifetime, in world space — call
   * with the ctx left in the same world-space transform `renderWorld`
   * draws bodies in. `worldScale` keeps the ring's stroke a constant pixel
   * width regardless of zoom, the way the wall stroke already does. */
  draw(ctx: CanvasRenderingContext2D, worldScale: number, nowMs: number): void;
}

/** How long a ring lives, start to fully transparent. */
const EFFECT_DURATION_MS = 300;

/** How far past the organism's own `bodyRadius` the ring expands to by the
 * end of its life. */
const EXPANSION_RADII = 2;

const RING_WIDTH_PX = 2;

/**
 * Caps the tracked list so a mass extinction — every organism disappearing
 * on one frame — spawns a bounded number of rings rather than stalling the
 * render loop. The newest deaths are kept: they are the ones still worth
 * watching by the time the cap bites.
 */
const MAX_LIVE_EFFECTS = 48;

/** The body that died, kept whole so it can fade out as it looked. */
interface Effect extends BodyShape {
  readonly startMs: number;
}

export function createDeathEffects(): DeathEffects {
  let previous = new Set<OrganismView>();
  let effects: Effect[] = [];

  return {
    recordFrame(population, nowMs) {
      const current = new Set(population);
      for (const organism of previous) {
        if (!current.has(organism)) {
          effects.push({
            x: organism.x,
            y: organism.y,
            bodyRadius: organism.bodyRadius,
            lineageHue: organism.lineageHue,
            organelles: organism.organelles,
            startMs: nowMs,
          });
        }
      }

      if (effects.length > MAX_LIVE_EFFECTS) {
        effects = effects.slice(effects.length - MAX_LIVE_EFFECTS);
      }

      previous = current;
    },

    draw(ctx, worldScale, nowMs) {
      effects = effects.filter(
        (effect) => nowMs - effect.startMs < EFFECT_DURATION_MS,
      );

      for (const effect of effects) {
        const age = (nowMs - effect.startMs) / EFFECT_DURATION_MS;
        const radius = effect.bodyRadius * (1 + EXPANSION_RADII * age);

        // The body fades out where it died, organelles included, at the
        // dimmest brightness: it died with its energy store empty.
        ctx.globalAlpha = 1 - age;
        drawBody(ctx, effect, 0, worldScale);
        ctx.globalAlpha = 1;

        ctx.lineWidth = RING_WIDTH_PX / worldScale;
        ctx.strokeStyle = `hsla(${String(effect.lineageHue * 360)}, 70%, 60%, ${String(1 - age)})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    },
  };
}
