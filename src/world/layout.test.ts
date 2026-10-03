import {describe, expect, it} from "vitest";

import {enclosingCircle, relax, type Disc} from "./layout";

const EXACT = 12;

describe("enclosingCircle", () => {
  it("is empty, of radius zero, for a body with no organelles", () => {
    expect(enclosingCircle([]).radius).toBe(0);
  });

  it("is the disc itself for a single organelle", () => {
    expect(enclosingCircle([{x: 0.3, y: -0.2, radius: 0.1}])).toEqual({
      x: 0.3,
      y: -0.2,
      radius: 0.1,
    });
  });

  it("spans two apart discs along the line of their centres", () => {
    // Discs at x = 0 (r 1) and x = 4 (r 2): the span runs from −1 to 6.
    const circle = enclosingCircle([
      {x: 0, y: 0, radius: 1},
      {x: 4, y: 0, radius: 2},
    ]);

    expect(circle.x).toBeCloseTo(2.5, EXACT);
    expect(circle.y).toBeCloseTo(0, EXACT);
    expect(circle.radius).toBeCloseTo(3.5, EXACT);
  });

  it("is the larger disc when it contains the other", () => {
    const circle = enclosingCircle([
      {x: 0.2, y: 0, radius: 0.1},
      {x: 0, y: 0, radius: 1},
    ]);

    expect(circle.x).toBeCloseTo(0, EXACT);
    expect(circle.y).toBeCloseTo(0, EXACT);
    expect(circle.radius).toBeCloseTo(1, EXACT);
  });

  it("touches three equal discs at the corners of an equilateral triangle", () => {
    // Centres on the unit circle at 90°, 210° and 330°: the enclosing
    // circle is concentric, of radius 1 + r.
    const r = 0.3;
    const h = Math.sqrt(3) / 2;
    const circle = enclosingCircle([
      {x: 0, y: 1, radius: r},
      {x: -h, y: -0.5, radius: r},
      {x: h, y: -0.5, radius: r},
    ]);

    expect(circle.x).toBeCloseTo(0, EXACT);
    expect(circle.y).toBeCloseTo(0, EXACT);
    expect(circle.radius).toBeCloseTo(1 + r, EXACT);
  });

  it("ignores a disc the pair's circle already contains", () => {
    const circle = enclosingCircle([
      {x: -2, y: 0, radius: 1},
      {x: 0, y: 0.5, radius: 0.5},
      {x: 2, y: 0, radius: 1},
    ]);

    expect(circle.x).toBeCloseTo(0, EXACT);
    expect(circle.y).toBeCloseTo(0, EXACT);
    expect(circle.radius).toBeCloseTo(3, EXACT);
  });

  it("finds a circle touching three unequal discs that no pair's circle contains", () => {
    const discs: Disc[] = [
      {x: 0, y: 0, radius: 1},
      {x: 5, y: 0, radius: 0.5},
      {x: 2, y: 4, radius: 1.5},
    ];
    const circle = enclosingCircle(discs);

    // Internally tangent to all three: each disc's far edge lies on it.
    for (const disc of discs) {
      expect(
        Math.hypot(disc.x - circle.x, disc.y - circle.y) + disc.radius,
      ).toBeCloseTo(circle.radius, 9);
    }
  });

  it("contains every disc and touches at least one, over many random layouts", () => {
    const unit = seededUnit(7);

    for (let trial = 0; trial < 300; trial++) {
      const count = 1 + Math.floor(unit() * 12);
      const discs: Disc[] = Array.from({length: count}, () => ({
        x: unit() * 4 - 2,
        y: unit() * 4 - 2,
        radius: 0.05 + unit() * 0.6,
      }));
      const circle = enclosingCircle(discs);
      const reach = discs.map(
        (disc) =>
          Math.hypot(disc.x - circle.x, disc.y - circle.y) + disc.radius,
      );

      for (const distance of reach) {
        expect(distance).toBeLessThanOrEqual(circle.radius + 1e-9);
      }
      expect(Math.max(...reach)).toBeCloseTo(circle.radius, 9);
    }
  });
});

/** A seeded uniform stream for the property tests, so they are never flaky. */
function seededUnit(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/** The deepest overlap between any two discs, 0 when none touch past
 * tangency — computed here rather than imported, so the tests do not share
 * the relaxation's own notion of what overlapping means. */
function deepestOverlap(discs: readonly Disc[]): number {
  let deepest = 0;
  for (let i = 0; i < discs.length; i++) {
    for (let j = i + 1; j < discs.length; j++) {
      const a = discs[i];
      const b = discs[j];
      deepest = Math.max(
        deepest,
        a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y),
      );
    }
  }
  return deepest;
}

function randomLayout(unit: () => number, count: number): Disc[] {
  return Array.from({length: count}, () => ({
    x: unit() * 0.6 - 0.3,
    y: unit() * 0.6 - 0.3,
    radius: 0.025 + unit() * 0.25,
  }));
}

/** A uniform point inside a circle, by rejection from its bounding square. */
function pointInside(unit: () => number, circle: Disc): {x: number; y: number} {
  for (;;) {
    const x = unit() * 2 - 1;
    const y = unit() * 2 - 1;
    if (x * x + y * y <= 1) {
      return {x: circle.x + x * circle.radius, y: circle.y + y * circle.radius};
    }
  }
}

const TRIALS = 200;
const SLACK = 1e-9;

describe("relax", () => {
  it("leaves no two organelles overlapping, however tangled the layout it is handed", () => {
    const unit = seededUnit(3);

    for (let trial = 0; trial < TRIALS; trial++) {
      const relaxed = relax(randomLayout(unit, 2 + Math.floor(unit() * 14)));
      expect(deepestOverlap(relaxed)).toBeLessThanOrEqual(SLACK);
    }
  });

  it("piles of identical discs on one point still come apart", () => {
    const pile = Array.from({length: 6}, () => ({x: 0, y: 0, radius: 0.1}));
    expect(deepestOverlap(relax(pile))).toBeLessThanOrEqual(SLACK);
  });

  it("moves nothing in a layout that has no overlaps", () => {
    const free = [
      {x: 0, y: 0, radius: 0.2},
      {x: 0.4, y: 0, radius: 0.2},
      {x: 0, y: -0.5, radius: 0.1},
    ];
    expect(relax(free)).toEqual(free);
  });

  it("keeps each organelle's radius, order and other fields, and moves only positions", () => {
    const tangled = [
      {x: 0, y: 0, radius: 0.2, tag: "a"},
      {x: 0.1, y: 0, radius: 0.15, tag: "b"},
      {x: 0, y: 0.1, radius: 0.1, tag: "c"},
    ];
    const relaxed = relax(tangled);

    expect(relaxed.map(({radius, tag}) => ({radius, tag}))).toEqual(
      tangled.map(({radius, tag}) => ({radius, tag})),
    );
  });

  describe("meets ADR-0028's contract after one event on a relaxed layout", () => {
    it("grows the Enclosing Circle by at most Δd when one organelle grows by Δd of diameter", () => {
      const unit = seededUnit(5);

      for (let trial = 0; trial < TRIALS; trial++) {
        const before = relax(randomLayout(unit, 1 + Math.floor(unit() * 12)));
        const target = Math.floor(unit() * before.length);
        const growth = unit() * 0.1;
        const after = before.map((disc, i) =>
          i === target ? {...disc, radius: disc.radius + growth} : disc,
        );
        const relaxed = relax(after);

        expect(deepestOverlap(relaxed)).toBeLessThanOrEqual(SLACK);
        expect(enclosingCircle(relaxed).radius).toBeLessThanOrEqual(
          enclosingCircle(before).radius + 2 * growth + SLACK,
        );
      }
    });

    it("grows the Enclosing Circle by at most d when one organelle moves by d", () => {
      const unit = seededUnit(9);

      for (let trial = 0; trial < TRIALS; trial++) {
        const before = relax(randomLayout(unit, 1 + Math.floor(unit() * 12)));
        const target = Math.floor(unit() * before.length);
        const step = (unit() * 2 - 1) * 0.15;
        const sideways = (unit() * 2 - 1) * 0.15;
        const after = before.map((disc, i) =>
          i === target
            ? {...disc, x: disc.x + step, y: disc.y + sideways}
            : disc,
        );
        const relaxed = relax(after);

        expect(deepestOverlap(relaxed)).toBeLessThanOrEqual(SLACK);
        expect(enclosingCircle(relaxed).radius).toBeLessThanOrEqual(
          enclosingCircle(before).radius + Math.hypot(step, sideways) + SLACK,
        );
      }
    });

    it("grows the Enclosing Circle by at most 2·r when an organelle of radius r is inserted inside it", () => {
      const unit = seededUnit(13);

      for (let trial = 0; trial < TRIALS; trial++) {
        const before = relax(randomLayout(unit, 1 + Math.floor(unit() * 12)));
        const circle = enclosingCircle(before);
        const inserted = {...pointInside(unit, circle), radius: 0.05};
        const relaxed = relax([...before, inserted]);

        expect(deepestOverlap(relaxed)).toBeLessThanOrEqual(SLACK);
        expect(enclosingCircle(relaxed).radius).toBeLessThanOrEqual(
          circle.radius + 2 * inserted.radius + SLACK,
        );
      }
    });

    // Two hand-built cases pinning the two moves where only one meets the
    // contract. A disc inserted deep inside a large organelle cannot be
    // pushed clear for 2·r: the slide does it. A disc that grows cannot be
    // slid clear for Δd: the push does it.
    it("slides an organelle inserted at the centre of a large one out to its edge", () => {
      const before = [
        {x: 0, y: 0, radius: 0.5},
        {x: 0.7, y: 0, radius: 0.2},
      ];
      const relaxed = relax([...before, {x: 0, y: 0, radius: 0.05}]);

      expect(deepestOverlap(relaxed)).toBeLessThanOrEqual(SLACK);
      expect(enclosingCircle(relaxed).radius).toBeLessThanOrEqual(
        enclosingCircle(before).radius + 2 * 0.05 + SLACK,
      );
    });

    it("pushes its neighbours away from an organelle that grows between them", () => {
      // Three tangent discs in a row, the middle one growing by 0.1 in
      // radius: the row lengthens by 0.2, the circle by at most that.
      const before = [
        {x: -0.4, y: 0, radius: 0.2},
        {x: 0, y: 0, radius: 0.2},
        {x: 0.4, y: 0, radius: 0.2},
      ];
      const grown = before.map((disc, i) =>
        i === 1 ? {...disc, radius: 0.3} : disc,
      );
      const relaxed = relax(grown);

      expect(deepestOverlap(relaxed)).toBeLessThanOrEqual(SLACK);
      expect(enclosingCircle(relaxed).radius).toBeLessThanOrEqual(
        enclosingCircle(before).radius + 2 * 0.1 + SLACK,
      );
    });

    it("grows an empty Enclosing Circle by exactly r when the first organelle is inserted", () => {
      const relaxed = relax([{x: 0, y: 0, radius: 0.05}]);
      expect(enclosingCircle(relaxed).radius).toBe(0.05);
    });
  });
});
