import type {OrganismView} from "../world";

/**
 * Which organism the inspector follows, App-layer only: a selection is a
 * viewer's business, so no world-side state backs it (ADR-0015's reasoning
 * for `α` smoothing). The organism is held by reference, the same identity
 * `deathEffects` already diffs the population by, so noticing it died is
 * noticing the reference gone.
 */
export type Selection =
  | {readonly kind: "none"}
  | {readonly kind: "alive"; readonly organism: OrganismView}
  | {readonly kind: "dead"; readonly tick: number; readonly sinceMs: number};

export const NO_SELECTION: Selection = {kind: "none"};

/** How long the panel keeps saying when the selected organism died. */
export const DEATH_NOTICE_MS = 3000;

/**
 * The nearest body whose disc contains the world-space point, or null on
 * empty water. Nearest by centre distance, so of two overlapping discs the
 * click lands on the one it is closer to the middle of.
 */
export function pickOrganism(
  population: readonly OrganismView[],
  x: number,
  y: number,
): OrganismView | null {
  let best: OrganismView | null = null;
  let bestDistanceSquared = Infinity;
  for (const organism of population) {
    const dx = x - organism.x;
    const dy = y - organism.y;
    const distanceSquared = dx * dx + dy * dy;
    if (
      distanceSquared <= organism.bodyRadius * organism.bodyRadius &&
      distanceSquared < bestDistanceSquared
    ) {
      best = organism;
      bestDistanceSquared = distanceSquared;
    }
  }

  return best;
}

/**
 * One frame's step of the selection: an alive selection whose organism has
 * left the population becomes a death notice stamped with the tick it was
 * noticed at (the frame after the tick it died on, at most), and a notice
 * clears itself after `DEATH_NOTICE_MS` of wall-clock, so a selection never
 * silently points at nothing.
 */
export function updateSelection(
  selection: Selection,
  population: readonly OrganismView[],
  tick: number,
  nowMs: number,
): Selection {
  switch (selection.kind) {
    case "none":
      return selection;
    case "alive":
      return population.includes(selection.organism)
        ? selection
        : {kind: "dead", tick, sinceMs: nowMs};
    case "dead":
      return nowMs - selection.sinceMs >= DEATH_NOTICE_MS
        ? NO_SELECTION
        : selection;
  }
}
