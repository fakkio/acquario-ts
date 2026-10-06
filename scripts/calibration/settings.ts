import {AQUARIUM_HEIGHT, BRIGHT_BAND_DEPTH} from "../../src/world";

/**
 * How long the harness runs and what it places, separate from **what the
 * world is**, which lives in `src/world/constants.ts`.
 *
 * The two namespaces are kept apart on purpose. `ACQUARIO_*` names a law of
 * the simulation and changes the run; `CALIBRATE_*` names how long the
 * instrument looks and changes only the measurement. Sharing one prefix
 * would put the sweep's knobs and the world's laws in the same list, and
 * `constants.ts` throws on an `ACQUARIO_` name it does not recognise
 * precisely so a typo in a sweep is loud — a shared prefix would have made
 * every harness setting look like such a typo.
 */

/**
 * The environment, or an empty table where there is none. Read through
 * `globalThis` rather than a bare `process`, the same way
 * `src/world/constants.ts` reads it, so nothing here assumes a runtime.
 */
export function environment(): Readonly<Record<string, string | undefined>> {
  return (
    (globalThis as {process?: {env?: Record<string, string | undefined>}})
      .process?.env ?? {}
  );
}

/** Every `ACQUARIO_`/`CALIBRATE_` name in force, for the report's own header:
 * a number means something different when a constant behind it was
 * overridden, so the run says which were. */
export function overrideNames(): readonly string[] {
  return Object.keys(environment())
    .filter(
      (key) => key.startsWith("ACQUARIO_") || key.startsWith("CALIBRATE_"),
    )
    .sort();
}

function setting(name: string, value: number): number {
  const override = environment()[`CALIBRATE_${name}`];
  if (override === undefined) {
    return value;
  }

  const parsed = Number(override);
  if (!Number.isFinite(parsed)) {
    throw new Error(`CALIBRATE_${name} is not a finite number: ${override}`);
  }

  return parsed;
}

/** The seed every single-run measurement uses, and the first of the seeds
 * the repeated ones walk. Reported at the top of every run, because a
 * number in this report means nothing without it. */
export const SEED = setting("SEED", 7);

/** How many seeds the repeated measurements average over. A single seed
 * reports one brownian history as if it were the world's behaviour; five
 * says whether the histories agreed. */
export const SEED_COUNT = setting("SEED_COUNT", 5);

export function seeds(): readonly number[] {
  return Array.from({length: SEED_COUNT}, (_unused, index) => SEED + index);
}

/**
 * Past the opening transient. Generation 0 starts at diffusive equilibrium,
 * so what still has to settle is the *chemistry*: internal CO₂ turning into
 * food and food into energy until the stores stop climbing. M2 put this at
 * 5,000, several charging time constants (`r / (2·kDiffusion)`) for even the
 * ladder's largest body.
 *
 * #36 cuts it to 100. `AMBIENT_CO2_SHARE`'s move to 0.6 (its own comment in
 * `constants.ts`) starts internal food closer to `ρ` from tick 0, so most of
 * the ladder now reaches `throttledByFullEnergyStore` a few hundred ticks
 * in rather than never — the same finding `K_CAP_ENERGY`'s own comment
 * records at the more aggressive split #36 tried and rejected. At the old
 * 5,000, every rung on the ladder has already capacity-pegged by the time
 * "settled" starts counting, leaving `n`'s gated reading fitted through
 * three noisy points instead of eight; 100 sits inside the window
 * `K_CAP_ENERGY`'s comment measured (172–1,024 ticks before saturation,
 * depending on radius) without eating into it. `WINDOW_TICKS` is left long:
 * the longest-unclamped-stretch tracking below finds its own shorter window
 * inside a long run on its own, rather than needing the run shortened to
 * match it — this is the one number that actually gated too much of it out
 * from under `n`.
 */
export const SETTLE_TICKS = setting("SETTLE_TICKS", 100);

/** How long a measurement window watches, once settled. Long enough that a
 * per-tick income is a rate rather than one tick's noise. */
export const WINDOW_TICKS = setting("WINDOW_TICKS", 10_000);

/**
 * The live run: mortal, fertile, generation 0 as the app places it. Shorter
 * than the done-criteria runs' 100k, because this one is read by a person
 * waiting at a terminal for one world rather than fifteen — raise it with
 * `CALIBRATE_LIVE_TICKS` when the question is what a world does over its
 * whole life rather than whether it starts.
 */
export const LIVE_TICKS = setting("LIVE_TICKS", 50_000);

/** How often the live run records a trajectory point and a depth sample.
 * Every tick would be a hundred thousand rows to say what twenty say. */
export const LIVE_SAMPLE_EVERY = setting("LIVE_SAMPLE_EVERY", 250);

/**
 * The neuron run (#66): the Reference World, long enough for structure to
 * drift. Persistence's own 100k, because a carrier fraction is a quantity of
 * generations and a short run reports the founders instead.
 */
export const NEURON_TICKS = setting("NEURON_TICKS", 100_000);

/** How often the neuron run reads the population. */
export const NEURON_SAMPLE_EVERY = setting("NEURON_SAMPLE_EVERY", 2_500);

/** The income ladder: wide enough in log space to tell `r¹` from `r^1.3`,
 * which generation 0's own spread of `[1/1.4, 1.4]` is nowhere near
 * (ADR-0025). */
export const LADDER_MIN_RADIUS = setting("LADDER_MIN_RADIUS", 0.5);
export const LADDER_MAX_RADIUS = setting("LADDER_MAX_RADIUS", 4);
export const LADDER_RUNGS = setting("LADDER_RUNGS", 10);

/**
 * The shortest stretch of a rung's life the income reconstruction will be
 * read off. A body whose maintenance outruns its income spends its whole
 * steady state pinned to the immortal floor and is only measurable on the
 * way down, so this is the line between "measured over a short window" and
 * "not measured": a few hundred ticks is several charging time constants
 * for a small body and comfortably longer than one tick's noise.
 */
export const LADDER_MIN_SPAN_TICKS = setting("LADDER_MIN_SPAN_TICKS", 200);

/** Where the income ladder sits: inside the bright band, at a depth whose
 * light is still most of the surface's, so the measurement is about radius
 * and not about the gradient. */
export const LADDER_DEPTH = setting("LADDER_DEPTH", BRIGHT_BAND_DEPTH / 2);

/** The dark ladder reaches further up, because ADR-0023 predicts the dark's
 * viable band — where one exists at all — centred on `α_dark/(2β)`, which
 * is a large body, not a small one. */
export const DARK_MIN_RADIUS = setting("DARK_MIN_RADIUS", 0.25);
export const DARK_MAX_RADIUS = setting("DARK_MAX_RADIUS", 8);
export const DARK_RUNGS = setting("DARK_RUNGS", 12);

/** Well below the bright band: light here is a thousandth of the surface's,
 * so "the dark" is dark rather than dim. */
export const DARK_DEPTH = setting("DARK_DEPTH", (3 * AQUARIUM_HEIGHT) / 4);

/**
 * How long a body gets to prove it can live in the dark. A body that starts
 * at half its energy cap and earns nothing at all dies in a few hundred
 * ticks, so this is two orders of magnitude of headroom: what it buys is
 * the ability to distinguish "survives" from "survives for a while", which
 * is the difference between a viable band and a slow death.
 */
export const DARK_TICKS = setting("DARK_TICKS", 30_000);
