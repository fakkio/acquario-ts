/**
 * The geometry of a body's organelles (ADR-0028, ADR-0036): the **Reach** and
 * the relaxation that pushes overlapping organelles apart. The body is not
 * built from this layout: it is its cytoplasm plus its organelles, centred on
 * the genome's origin, and widened to the Reach when an organelle sticks out
 * of it. Pure functions over discs, with no idea what an organelle is or what
 * a genome holds, so the genome module can build a body from them and
 * compose the structural mutation law's operators from the same pieces.
 *
 * Arithmetic and square roots only, per ADR-0007, and every loop runs in the
 * order it was handed — the genome's — with no shuffle and nothing drawn.
 */

/** A circle in the genome's frame: an organelle, or the room a Split clears
 * for its pieces. Anything with these three fields is one. */
export interface Disc {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** How deep two discs may interpenetrate and still count as touching. Far
 * below any organelle's size, and only there so that discs pushed exactly to
 * tangency are not read as overlapping by rounding. */
const OVERLAP_TOLERANCE = 1e-12;

/** The genome's origin, the body's fixed centre (ADR-0036). */
const ORIGIN = {x: 0, y: 0};

/** A direction for the degenerate case where two centres coincide and the
 * geometry offers none: fixed, so the result stays a function of the input. */
const FALLBACK_DIRECTION = {x: 1, y: 0};

/**
 * The **Reach** of a layout (ADR-0036): the farthest edge of any disc from
 * the genome's origin, `max (|p| + r)`, and zero with no discs. Measured from
 * the fixed origin the body is centred on, not from any circle the discs
 * enclose.
 */
export function reach(discs: readonly Disc[]): number {
  let farthest = 0;
  for (const disc of discs) {
    farthest = Math.max(farthest, distance(disc.x, disc.y) + disc.radius);
  }
  return farthest;
}

/**
 * Pushes overlapping discs apart until none overlap, moving positions and
 * nothing else: every other field of every disc, and their order, comes back
 * as it went in. A layout with no overlaps comes back unchanged.
 *
 * It meets ADR-0036's relaxation contract by construction: after one event
 * on a layout with no overlaps, the Reach (measured from the genome's fixed
 * origin) grows by at most the diameter the event added plus the distance it
 * moved an organelle. Each round names a culprit, a disc with the most
 * overlapping partners, and tries two moves on every such disc, keeping
 * whichever leaves the smaller Reach (earliest in genome order, push before
 * slide, on a tie):
 *
 * - **push** every other disc straight away from the culprit by the
 *   culprit's deepest overlap `s`. The map `p ↦ p + s·û` is the gradient of
 *   the convex `|p|²/2 + s·|p|`, so it never brings two discs closer: it
 *   clears the culprit's overlaps, creates none, and moves each disc by
 *   exactly `s`, so no `|p|` grows by more than `s`. A disc that grew by
 *   `Δd/2` in radius, or moved by `d`, overlaps by at most that, so the
 *   Reach grows by at most `Δd` or `d`.
 * - **slide** the culprit alone outward, along the ray from the origin
 *   through it, to the first point where it overlaps nothing. Past
 *   `Reach + r` of the others it overlaps nothing, so it stops at most
 *   there, its far edge at most `2r` past the Reach: the bound for an
 *   inserted disc, which a push cannot give when the insertion lands deep
 *   inside a large organelle. The ray starts at the origin and not at the
 *   others' Enclosing Circle, whose far edge can lie past the Reach.
 *
 * After one event every overlap involves the disc it touched, so that disc
 * is among the culprits and one round ends the relaxation. Every round
 * clears the culprit's overlaps without creating new ones, so on any input
 * the count of overlapping pairs falls each round and the loop ends.
 *
 * An event that touches two discs at once, a Split, is not covered by one
 * round of this rule: its operator clears room for its pieces with the push
 * alone first (`makeRoom`), and leaves this nothing to do.
 */
export function relax<T extends Disc>(discs: readonly T[]): T[] {
  let layout = [...discs];
  const maxRounds = (discs.length * (discs.length - 1)) / 2;

  for (let round = 0; ; round++) {
    const partners = overlapCounts(layout);
    const most = Math.max(0, ...partners);
    if (most === 0) {
      return layout;
    }
    if (round >= maxRounds) {
      throw new Error(
        "relax: overlapping pairs did not fall every round, which its own " +
          "construction rules out (ADR-0036's relaxation contract)",
      );
    }

    let best: T[] | null = null;
    let bestReach = Number.POSITIVE_INFINITY;
    for (let culprit = 0; culprit < layout.length; culprit++) {
      if (partners[culprit] !== most) {
        continue;
      }
      for (const candidate of [
        pushAway(layout, layout[culprit], deepestOverlapOf(layout, culprit)),
        slideOut(layout, culprit),
      ]) {
        const candidateReach = reach(candidate);
        if (candidateReach < bestReach) {
          best = candidate;
          bestReach = candidateReach;
        }
      }
    }
    layout = best ?? layout;
  }
}

/**
 * Clears `room`, a disc that is not one of `discs`, by pushing every disc
 * straight away from its centre by the deepest overlap any of them has with
 * it: `relax`'s push, around a disc the layout does not hold yet. The
 * Split's first move (ADR-0028), which swells an organelle into the circle
 * its two pieces will fill and has the others make way.
 *
 * On a layout with no overlaps it creates none, and moves each disc by at
 * most how far `room` reaches past the disc it replaces, so the Reach
 * grows by no more than that. A room that overlaps nothing moves
 * nothing.
 */
export function makeRoom<T extends Disc>(discs: readonly T[], room: Disc): T[] {
  let deepest = 0;
  for (const disc of discs) {
    deepest = Math.max(deepest, overlap(room, disc));
  }
  return pushAway(discs, room, deepest);
}

/**
 * Moves every disc but `origin` itself straight away from `origin`'s centre
 * by `distance`: the push move of `relax`, where `origin` is one of the
 * discs, and of `makeRoom`, where it is not. Never brings two discs closer,
 * so it creates no overlap among the discs it moves.
 */
function pushAway<T extends Disc>(
  discs: readonly T[],
  origin: Disc,
  distance: number,
): T[] {
  return discs.map((disc) => {
    if (disc === origin || distance <= 0) {
      return disc;
    }
    const direction = unitVector(disc.x - origin.x, disc.y - origin.y);
    return {
      ...disc,
      x: disc.x + direction.x * distance,
      y: disc.y + direction.y * distance,
    };
  });
}

/** The slide move of `relax`: disc `index` alone, moved outward to the first
 * free point on the ray from the genome's origin. */
function slideOut<T extends Disc>(discs: readonly T[], index: number): T[] {
  const moving = discs[index];
  const others = discs.filter((_, i) => i !== index);
  const offsetX = moving.x - ORIGIN.x;
  const offsetY = moving.y - ORIGIN.y;
  const direction = unitVector(offsetX, offsetY);

  // Each other disc forbids an open interval of the ray, `|O + t·u − p| <
  // r + rⱼ`, the roots of a quadratic in `t`.
  const forbidden: {readonly from: number; readonly to: number}[] = [];
  for (const other of others) {
    const qx = other.x - ORIGIN.x;
    const qy = other.y - ORIGIN.y;
    const along = direction.x * qx + direction.y * qy;
    const touching = moving.radius + other.radius;
    const discriminant =
      along * along - (qx * qx + qy * qy - touching * touching);
    if (discriminant > 0) {
      const halfWidth = Math.sqrt(discriminant);
      forbidden.push({from: along - halfWidth, to: along + halfWidth});
    }
  }

  let t = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
  for (let moved = true; moved;) {
    moved = false;
    for (const interval of forbidden) {
      if (
        t > interval.from + OVERLAP_TOLERANCE &&
        t < interval.to - OVERLAP_TOLERANCE
      ) {
        t = interval.to;
        moved = true;
      }
    }
  }

  return discs.map((disc, i) =>
    i === index
      ? {...disc, x: ORIGIN.x + direction.x * t, y: ORIGIN.y + direction.y * t}
      : disc,
  );
}

function overlapCounts(discs: readonly Disc[]): number[] {
  const counts = discs.map(() => 0);
  for (let i = 0; i < discs.length; i++) {
    for (let j = i + 1; j < discs.length; j++) {
      if (overlap(discs[i], discs[j]) > OVERLAP_TOLERANCE) {
        counts[i] += 1;
        counts[j] += 1;
      }
    }
  }
  return counts;
}

function deepestOverlapOf(discs: readonly Disc[], index: number): number {
  const disc = discs[index];
  let deepest = 0;
  for (let j = 0; j < discs.length; j++) {
    if (j !== index) {
      deepest = Math.max(deepest, overlap(disc, discs[j]));
    }
  }
  return deepest;
}

/** How far two discs interpenetrate: positive when they overlap. */
function overlap(a: Disc, b: Disc): number {
  return a.radius + b.radius - distance(a.x - b.x, a.y - b.y);
}

function distance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function unitVector(dx: number, dy: number): {x: number; y: number} {
  const length = distance(dx, dy);
  return length === 0 ? FALLBACK_DIRECTION : {x: dx / length, y: dy / length};
}
