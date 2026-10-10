import type {OrganismView} from "../world";

/**
 * How one body is drawn, v0.2's look (`docs/vision.md` § Interface → v0.2):
 * the cytoplasm filled in `lineageHue`, the organelles inside it at their
 * positions, and the energy fraction dimming the whole organism, organelles
 * included, so dying still reads as fading. Shared by the live population
 * and the death effect, so a body fades out looking like the body that died.
 *
 * Untested per ADR-0013's TDD boundary, like everything else that draws.
 */

/** What a body glyph reads: an `OrganismView`'s geometry and hue, which the
 * death effect also keeps for a body no longer in the population. */
export type BodyShape = Pick<
  OrganismView,
  "x" | "y" | "bodyRadius" | "lineageHue" | "organelles"
>;

/** Lightness at zero energy and at a full store, in percent — the range a
 * body's brightness maps its energy fraction into (M2, ADR-0010). A
 * starving body never goes fully black: it stays a dim, legible ghost of
 * its lineage hue rather than vanishing into the background. */
const BODY_LIGHTNESS_FLOOR = 12;
const BODY_LIGHTNESS_FULL = 55;

/** Less saturated than v0.1's 70%, so the organelles stand out against the
 * cytoplasm while clade waves stay readable zoomed out. */
const CYTOPLASM_SATURATION = 40;

/** A neuron at full energy: an opaque light-grey disc with a dark outline,
 * the screen's own palette, which binds nothing an organism perceives. */
const NEURON_LIGHTNESS = 82;
const ORGANELLE_OUTLINE_LIGHTNESS = 12;

/** A float at full energy: a pale white-blue disc, translucent like a
 * bubble, with the same dark outline. */
const FLOAT_HUE = 200;
const FLOAT_SATURATION = 70;
const FLOAT_LIGHTNESS = 90;
const FLOAT_ALPHA = 0.55;

/** The outline's screen width, and the share of an organelle's radius it may
 * take at most, so a neuron a pixel wide stays grey rather than all outline. */
const ORGANELLE_OUTLINE_PX = 1;
const ORGANELLE_OUTLINE_MAX_SHARE = 0.4;

/**
 * Draws a body and its organelles. `energyFraction` scales every lightness
 * by the same factor, `BODY_LIGHTNESS_FULL` at a full store down to
 * `BODY_LIGHTNESS_FLOOR`'s share of it at empty, so cytoplasm and organelles
 * dim together. Linear, with no perceptual compression the way the water's
 * light gradient has: the energy fraction has no orders-of-magnitude spread
 * to compress.
 */
export function drawBody(
  ctx: CanvasRenderingContext2D,
  body: BodyShape,
  energyFraction: number,
  worldScale: number,
): void {
  const fraction = Math.min(1, Math.max(0, energyFraction));
  const brightness =
    (BODY_LIGHTNESS_FLOOR +
      (BODY_LIGHTNESS_FULL - BODY_LIGHTNESS_FLOOR) * fraction) /
    BODY_LIGHTNESS_FULL;

  ctx.fillStyle = `hsl(${String(body.lineageHue * 360)}, ${String(CYTOPLASM_SATURATION)}%, ${String(BODY_LIGHTNESS_FULL * brightness)}%)`;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.bodyRadius, 0, 2 * Math.PI);
  ctx.fill();

  if (body.organelles.length === 0) {
    return;
  }

  ctx.strokeStyle = `hsl(0, 0%, ${String(ORGANELLE_OUTLINE_LIGHTNESS * brightness)}%)`;
  for (const organelle of body.organelles) {
    // The per-type palette grows with the roster (`docs/vision.md`:
    // chloroplast green, thruster red). The body keeps the world's
    // orientation until the Body Axis arrives, so an organelle sits at the
    // body's position plus its own.
    ctx.fillStyle =
      organelle.type === "float"
        ? `hsla(${String(FLOAT_HUE)}, ${String(FLOAT_SATURATION)}%, ${String(FLOAT_LIGHTNESS * brightness)}%, ${String(FLOAT_ALPHA)})`
        : `hsl(0, 0%, ${String(NEURON_LIGHTNESS * brightness)}%)`;
    const x = body.x + organelle.x;
    const y = body.y + organelle.y;
    ctx.lineWidth = Math.min(
      ORGANELLE_OUTLINE_PX / worldScale,
      organelle.radius * ORGANELLE_OUTLINE_MAX_SHARE,
    );
    ctx.beginPath();
    ctx.arc(x, y, organelle.radius - ctx.lineWidth / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
}
