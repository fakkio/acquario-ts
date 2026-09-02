import {describe, expect, it} from "vitest";

import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {applyBrownianMotion, constrainToAquarium} from "./motion";
import type {Organism} from "./organism";
import {createRngStream} from "./rng";
import {organismAt, shuffle} from "./testing";

interface Point {
  readonly x: number;
  readonly y: number;
}

const CENTRE_X = AQUARIUM_WIDTH / 2;
const CENTRE_Y = AQUARIUM_HEIGHT / 2;

/**
 * The step a baseline body takes each tick, pinned rather than recomputed from
 * the constants: a test that restates `force / (drag · radius)` passes just as
 * happily when that formula is wrong. This number is also the calibration the
 * force was tuned to produce, so retuning fails here and has to be re-judged
 * against how the run looks, which is the only place that call can be made.
 */
const BASELINE_STEP = 0.1061032953945969;

const positionOf = (point: Point): Point => ({x: point.x, y: point.y});

const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const moveFor = (organism: Organism, ticks: number): void => {
  for (let i = 0; i < ticks; i++) {
    applyBrownianMotion(organism);
  }
};

/** Everything a tick is allowed to write to an organism. */
const mutableStateOf = (organism: Organism) => ({
  x: organism.x,
  y: organism.y,
  rng: organism.rng,
});

const expectWhollyInsideAquarium = (organism: Organism): void => {
  expect(organism.x - organism.bodyRadius).toBeGreaterThanOrEqual(0);
  expect(organism.y - organism.bodyRadius).toBeGreaterThanOrEqual(0);
  expect(organism.x + organism.bodyRadius).toBeLessThanOrEqual(AQUARIUM_WIDTH);
  expect(organism.y + organism.bodyRadius).toBeLessThanOrEqual(AQUARIUM_HEIGHT);
};

describe("applyBrownianMotion", () => {
  it("moves the organism off the spot it started on", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const start = positionOf(organism);

    applyBrownianMotion(organism);

    expect(distance(organism, start)).toBeGreaterThan(0);
  });

  it("moves a baseline body about a tenth of its radius per tick", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const start = positionOf(organism);

    applyBrownianMotion(organism);

    expect(distance(organism, start)).toBeCloseTo(BASELINE_STEP, 12);
  });

  // The overdamped clause of ADR-0008, in the form that can actually fail:
  // velocity is a function of the current force and the body's radius alone.
  // A momentum term, however small, would make some step longer than another.
  it("moves the same distance every tick, with no memory of the tick before", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);

    for (let i = 0; i < 50; i++) {
      const before = positionOf(organism);
      applyBrownianMotion(organism);

      expect(distance(organism, before)).toBeCloseTo(BASELINE_STEP, 12);
    }
  });

  it("moves a large body less far than a small one, in inverse proportion to radius", () => {
    const small = organismAt(CENTRE_X, CENTRE_Y, 0.6);
    const large = organismAt(CENTRE_X, CENTRE_Y, 1.4);
    const startSmall = positionOf(small);
    const startLarge = positionOf(large);

    applyBrownianMotion(small);
    applyBrownianMotion(large);

    expect(
      distance(large, startLarge) / distance(small, startSmall),
    ).toBeCloseTo(0.6 / 1.4, 12);
  });

  it("advances the organism's own stream, so the next tick draws a new direction", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const before = organism.rng.state;

    applyBrownianMotion(organism);

    expect(organism.rng.state).not.toBe(before);
  });

  // Resolve phase, step 6: an organism's motion touches that organism and
  // nothing else. This is the restriction that makes the whole phase
  // order-independent by construction, so it is worth asserting directly
  // rather than inferring it from the permutation test below.
  it("leaves every other organism in the population untouched", () => {
    const moving = organismAt(CENTRE_X, CENTRE_Y, BASELINE_BODY_RADIUS, 1);
    const bystander = organismAt(10, 10, 0.8, 2);
    const before = mutableStateOf(bystander);

    moveFor(moving, 20);

    expect(mutableStateOf(bystander)).toEqual(before);
  });

  // Not a heading: a body that kept the same direction would end up a full
  // path length from where it started.
  it("leaves net displacement far below the path the body travelled", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const start = positionOf(organism);
    const ticks = 1000;

    moveFor(organism, ticks);

    expect(distance(organism, start)).toBeLessThan(
      (ticks * BASELINE_STEP) / 10,
    );
  });

  // ADR-0007's guarantee, first testable here: an organism draws from its own
  // stream and from nothing else, so where it sits in the population array —
  // and how many draws every other organism made first — cannot reach it.
  it("gives an organism the same trajectory whatever order the population is stepped in", () => {
    const buildPopulation = () =>
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        organismAt(CENTRE_X, CENTRE_Y, 0.6 + seed * 0.1, seed),
      );

    const inOrder = buildPopulation();
    // The same organisms as `twins`, held in a different order — so comparing
    // `twins` against `inOrder` afterwards pairs each body with its own twin
    // regardless of where the shuffle moved it.
    const twins = buildPopulation();
    const shuffled = shuffle([...twins], createRngStream(4242));

    // Both loops mirror the tick: motion in the resolve phase for every
    // organism, then the wall constraint in the commit phase for every one.
    for (let tick = 0; tick < 50; tick++) {
      for (const population of [inOrder, shuffled]) {
        for (const organism of population) {
          applyBrownianMotion(organism);
        }
        for (const organism of population) {
          constrainToAquarium(organism);
        }
      }
    }

    expect(shuffled).not.toEqual(twins);
    expect(inOrder).toEqual(twins);
  });

  // The observable consequence of Stokes drag: the diffusion coefficient goes
  // as 1/r, so a population of large bodies stays nearer where it was placed
  // than a population of small ones. Separate seeds for the two groups, so the
  // comparison is between two independent ensembles rather than between one
  // trajectory and a rescaling of itself.
  it("leaves large bodies nearer their start than small ones, across a population", () => {
    const SAMPLES = 40;
    const TICKS = 800;

    const meanDisplacement = (bodyRadius: number, firstSeed: number) => {
      let total = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const organism = organismAt(
          CENTRE_X,
          CENTRE_Y,
          bodyRadius,
          firstSeed + i,
        );
        const start = positionOf(organism);
        moveFor(organism, TICKS);
        total += distance(organism, start);
      }
      return total / SAMPLES;
    };

    const small = meanDisplacement(0.6, 1000);
    const large = meanDisplacement(1.4, 5000);

    expect(large).toBeLessThan(small);
    // Around the 0.6/1.4 the step lengths differ by; loose enough that the
    // ensemble noise of forty bodies cannot flip it.
    expect(large / small).toBeGreaterThan(0.3);
    expect(large / small).toBeLessThan(0.6);
  });
});

describe("constrainToAquarium", () => {
  it("leaves a body that is already clear of every wall exactly where it is", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const before = positionOf(organism);

    constrainToAquarium(organism);

    expect(positionOf(organism)).toEqual(before);
  });

  it.each([
    ["the left wall", {x: -5, y: CENTRE_Y}],
    ["the top wall", {x: CENTRE_X, y: -5}],
    ["the right wall", {x: AQUARIUM_WIDTH + 5, y: CENTRE_Y}],
    ["the bottom wall", {x: CENTRE_X, y: AQUARIUM_HEIGHT + 5}],
  ])(
    "pulls a body that crossed %s back inside, whole body and all",
    (_wall, position) => {
      const organism = organismAt(position.x, position.y);

      constrainToAquarium(organism);

      expectWhollyInsideAquarium(organism);
    },
  );

  // Hard walls, not bouncy ones: the body ends up touching the wall it was
  // pushed into, rather than being reflected back off it.
  it("rests a body against the wall it was pushed into", () => {
    const organism = organismAt(-5, CENTRE_Y);

    constrainToAquarium(organism);

    expect(organism.x).toBe(organism.bodyRadius);
    expect(organism.y).toBe(CENTRE_Y);
  });

  it("holds a body resting against a wall still, tick after tick", () => {
    const organism = organismAt(-5, CENTRE_Y);
    constrainToAquarium(organism);
    const resting = positionOf(organism);

    constrainToAquarium(organism);

    expect(positionOf(organism)).toEqual(resting);
  });

  it("keeps a body under brownian motion inside the walls, every tick of it", () => {
    const organism = organismAt(BASELINE_BODY_RADIUS, BASELINE_BODY_RADIUS);

    for (let tick = 0; tick < 5000; tick++) {
      applyBrownianMotion(organism);
      constrainToAquarium(organism);

      expectWhollyInsideAquarium(organism);
    }
  });
});
