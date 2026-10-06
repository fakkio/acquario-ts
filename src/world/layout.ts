/**
 * The geometry of a body's organelles (ADR-0028, ADR-0034): the **Enclosing
 * Circle** and the relaxation that pushes overlapping organelles apart. Pure
 * functions over discs, with no idea what an organelle is or what a genome
 * holds, so the genome module can build a body from them and compose the
 * structural mutation law's operators from the same pieces.
 *
 * Arithmetic and square roots only, per ADR-0007, and every loop runs in the
 * order it was handed — the genome's — with no shuffle and nothing drawn.
 */

/** A circle in the genome's frame: an organelle, or the circle enclosing
 * them. Anything with these three fields is one. */
export interface Disc {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** How deep two discs may interpenetrate and still count as touching. Far
 * below any organelle's size, and only there so that discs pushed exactly to
 * tangency are not read as overlapping by rounding. */
const OVERLAP_TOLERANCE = 1e-12;

/** The relative slack in every other comparison the exact geometry makes —
 * containment, a root at least as large as a disc, a singular system — so
 * that rounding in the last few bits never flips an answer. */
const ROUNDING_SLACK = 1e-12;

/** The Enclosing Circle of no organelles: empty, of radius zero, at the
 * genome's origin (glossary: Enclosing Circle). */
const EMPTY_CIRCLE: Disc = {x: 0, y: 0, radius: 0};

/** A direction for the degenerate case where two centres coincide and the
 * geometry offers none: fixed, so the result stays a function of the input. */
const FALLBACK_DIRECTION = {x: 1, y: 0};

/**
 * The smallest circle containing every disc (glossary: Enclosing Circle),
 * computed exactly by Welzl's algorithm in its incremental form, over the
 * discs in the order given. Welzl shuffles its input for an expected linear
 * running time; this does not, so the circle stays a function of genome
 * order alone, at a worst case of `O(n³)` that a body's handful of
 * organelles never feels.
 */
export function enclosingCircle(discs: readonly Disc[]): Disc {
  if (discs.length === 0) {
    return EMPTY_CIRCLE;
  }

  let circle: Disc = discs[0];
  for (let i = 1; i < discs.length; i++) {
    const a = discs[i];
    if (contains(circle, a)) {
      continue;
    }
    circle = a;
    for (let j = 0; j < i; j++) {
      const b = discs[j];
      if (contains(circle, b)) {
        continue;
      }
      circle = circleOfTwo(a, b);
      for (let k = 0; k < j; k++) {
        const c = discs[k];
        if (!contains(circle, c)) {
          circle = circleOfThree(a, b, c);
        }
      }
    }
  }

  return {x: circle.x, y: circle.y, radius: circle.radius};
}

/**
 * Pushes overlapping discs apart until none overlap, moving positions and
 * nothing else: every other field of every disc, and their order, comes back
 * as it went in. A layout with no overlaps comes back unchanged.
 *
 * It meets ADR-0028's relaxation contract by construction: after one event
 * on a layout with no overlaps, the Enclosing Circle grows by at most the
 * diameter the event added plus the distance it moved an organelle. Each
 * round names a culprit, a disc with the most overlapping partners, and
 * tries two moves on every such disc, keeping whichever leaves the smaller
 * Enclosing Circle (earliest in genome order, push before slide, on a tie):
 *
 * - **push** every other disc straight away from the culprit by the
 *   culprit's deepest overlap `s`. The map `p ↦ p + s·û` is the gradient of
 *   the convex `|p|²/2 + s·|p|`, so it never brings two discs closer: it
 *   clears the culprit's overlaps, creates none, and moves each disc by
 *   exactly `s`. A disc that grew by `Δd/2` in radius, or moved by `d`,
 *   overlaps by at most that, so the circle grows by at most `Δd` or `d`.
 * - **slide** the culprit alone outward, along the ray from the centre of
 *   the others' Enclosing Circle through it, to the first point where it
 *   overlaps nothing. It stops at most at `R + r`, so the circle grows by at
 *   most `2r`: the bound for an inserted disc, which a push cannot give when
 *   the insertion lands deep inside a large organelle.
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
          "construction rules out (ADR-0028's relaxation contract)",
      );
    }

    let best: T[] | null = null;
    let bestRadius = Number.POSITIVE_INFINITY;
    for (let culprit = 0; culprit < layout.length; culprit++) {
      if (partners[culprit] !== most) {
        continue;
      }
      for (const candidate of [
        pushAway(layout, layout[culprit], deepestOverlapOf(layout, culprit)),
        slideOut(layout, culprit),
      ]) {
        const radius = enclosingCircle(candidate).radius;
        if (radius < bestRadius) {
          best = candidate;
          bestRadius = radius;
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
 * most how far `room` reaches past the disc it replaces, so the Enclosing
 * Circle grows by no more than that. A room that overlaps nothing moves
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
 * free point on the ray from the others' Enclosing Circle's centre. */
function slideOut<T extends Disc>(discs: readonly T[], index: number): T[] {
  const moving = discs[index];
  const others = discs.filter((_, i) => i !== index);
  const origin = enclosingCircle(others);
  const offsetX = moving.x - origin.x;
  const offsetY = moving.y - origin.y;
  const direction = unitVector(offsetX, offsetY);

  // Each other disc forbids an open interval of the ray, `|O + t·u − p| <
  // r + rⱼ`, the roots of a quadratic in `t`.
  const forbidden: {readonly from: number; readonly to: number}[] = [];
  for (const other of others) {
    const qx = other.x - origin.x;
    const qy = other.y - origin.y;
    const along = direction.x * qx + direction.y * qy;
    const reach = moving.radius + other.radius;
    const discriminant = along * along - (qx * qx + qy * qy - reach * reach);
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
      ? {...disc, x: origin.x + direction.x * t, y: origin.y + direction.y * t}
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

function contains(circle: Disc, disc: Disc): boolean {
  const reach =
    distance(disc.x - circle.x, disc.y - circle.y) +
    disc.radius -
    circle.radius;
  return reach <= ROUNDING_SLACK * Math.max(1, circle.radius);
}

/** The smallest circle containing two discs: the larger when it holds the
 * other, else the circle spanning both along the line of their centres. */
function circleOfTwo(a: Disc, b: Disc): Disc {
  if (contains(a, b)) {
    return a;
  }
  if (contains(b, a)) {
    return b;
  }
  const d = distance(b.x - a.x, b.y - a.y);
  const radius = (d + a.radius + b.radius) / 2;
  const t = (radius - a.radius) / d;
  return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, radius};
}

/**
 * The circle internally tangent to three discs, `|c − pᵢ| = R − rᵢ`
 * (Apollonius' problem in its enclosing case). Subtracting the first
 * equation from the other two leaves two equations linear in the centre, so
 * the centre is `M + R·N`; substituting back into the first leaves a
 * quadratic in `R`, whose smallest root at least as large as every disc is
 * the circle. Collinear centres make the linear part singular, and then the
 * smallest pair's circle containing the third stands in.
 */
function circleOfThree(a: Disc, b: Disc, c: Disc): Disc {
  const k = (disc: Disc): number =>
    disc.x * disc.x + disc.y * disc.y - disc.radius * disc.radius;
  const a11 = 2 * (b.x - a.x);
  const a12 = 2 * (b.y - a.y);
  const a21 = 2 * (c.x - a.x);
  const a22 = 2 * (c.y - a.y);
  const b1 = k(b) - k(a);
  const b2 = k(c) - k(a);
  const e1 = 2 * (b.radius - a.radius);
  const e2 = 2 * (c.radius - a.radius);
  const determinant = a11 * a22 - a12 * a21;

  const scale = Math.max(
    Math.abs(a11 * a22),
    Math.abs(a12 * a21),
    Number.MIN_VALUE,
  );
  if (Math.abs(determinant) > ROUNDING_SLACK * scale) {
    const mx = (b1 * a22 - a12 * b2) / determinant;
    const my = (a11 * b2 - b1 * a21) / determinant;
    const nx = (e1 * a22 - a12 * e2) / determinant;
    const ny = (a11 * e2 - e1 * a21) / determinant;
    const dx = mx - a.x;
    const dy = my - a.y;
    const qa = nx * nx + ny * ny - 1;
    const qb = 2 * (dx * nx + dy * ny + a.radius);
    const qc = dx * dx + dy * dy - a.radius * a.radius;
    const floor = Math.max(a.radius, b.radius, c.radius);

    for (const radius of quadraticRoots(qa, qb, qc)) {
      if (radius >= floor - ROUNDING_SLACK) {
        const circle = {x: mx + nx * radius, y: my + ny * radius, radius};
        if (contains(circle, a) && contains(circle, b) && contains(circle, c)) {
          return circle;
        }
      }
    }
  }

  return smallestContaining(
    [circleOfTwo(a, b), circleOfTwo(a, c), circleOfTwo(b, c)],
    [a, b, c],
  );
}

/** The real roots of `a·x² + b·x + c`, smallest first. */
function quadraticRoots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < ROUNDING_SLACK) {
    return Math.abs(b) < ROUNDING_SLACK ? [] : [-c / b];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return [];
  }
  const root = Math.sqrt(discriminant);
  const low = (-b - root) / (2 * a);
  const high = (-b + root) / (2 * a);
  return low <= high ? [low, high] : [high, low];
}

function smallestContaining(
  candidates: readonly Disc[],
  discs: readonly Disc[],
): Disc {
  let best: Disc | null = null;
  for (const candidate of candidates) {
    if (
      discs.every((disc) => contains(candidate, disc)) &&
      (best === null || candidate.radius < best.radius)
    ) {
      best = candidate;
    }
  }
  // Every candidate falling short of the third disc is a numerical corner a
  // genuinely collinear triple never reaches; the widest pair is the safe
  // answer, since Welzl only asks this once the pair's circle has failed.
  return (
    best ??
    candidates.reduce((widest, candidate) =>
      candidate.radius > widest.radius ? candidate : widest,
    )
  );
}

function distance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function unitVector(dx: number, dy: number): {x: number; y: number} {
  const length = distance(dx, dy);
  return length === 0 ? FALLBACK_DIRECTION : {x: dx / length, y: dy / length};
}
