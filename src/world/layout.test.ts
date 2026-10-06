import {describe, expect, it} from "vitest";

import {makeRoom, reach, relax, type Disc} from "./layout";

const EXACT = 12;

describe("reach", () => {
  it("is zero for a body with no organelles", () => {
    expect(reach([])).toBe(0);
  });

  it("is the farthest edge of any organelle from the genome's origin", () => {
    expect(
      reach([
        {x: 0.5, y: 0, radius: 0.1},
        {x: 0, y: -1, radius: 0.2},
      ]),
    ).toBeCloseTo(1.2, EXACT);
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

  describe("meets ADR-0036's contract on the Reach after one event on a relaxed layout", () => {
    it("grows the Reach by at most Δd when one organelle grows by Δd of diameter", () => {
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
        expect(reach(relaxed)).toBeLessThanOrEqual(
          reach(before) + 2 * growth + SLACK,
        );
      }
    });

    it("grows the Reach by at most d when one organelle moves by d", () => {
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
        expect(reach(relaxed)).toBeLessThanOrEqual(
          reach(before) + Math.hypot(step, sideways) + SLACK,
        );
      }
    });

    it("grows the Reach by at most 2·r, or to the body's edge, when an organelle of radius r is inserted anywhere in the body", () => {
      // The body is a circle on the origin, wider than the Reach by an
      // arbitrary margin, and the organelle lands anywhere that holds it
      // (ADR-0036).
      const unit = seededUnit(13);

      for (let trial = 0; trial < TRIALS; trial++) {
        const before = relax(randomLayout(unit, 1 + Math.floor(unit() * 12)));
        const radius = 0.05;
        const body = reach(before) + unit() * 0.3;
        const inserted = {
          ...pointInside(unit, {x: 0, y: 0, radius: body - radius}),
          radius,
        };
        const relaxed = relax([...before, inserted]);

        expect(deepestOverlap(relaxed)).toBeLessThanOrEqual(SLACK);
        expect(reach(relaxed)).toBeLessThanOrEqual(
          Math.max(reach(before) + 2 * radius, body) + SLACK,
        );
      }
    });

    // A circle round these two discs is centred between them, and its far
    // edge lies past the Reach: a slide along a ray from that centre
    // can overshoot the Reach by more than 2·r. From the origin it cannot.
    it("slides an organelle inserted among off-centre ones no farther than 2·r past the Reach", () => {
      const before = [
        {x: 1, y: 0, radius: 0.1},
        {x: 0, y: 1, radius: 0.1},
      ];
      const inserted = {x: 0.5, y: 0.5, radius: 0.3};
      const relaxed = relax([...before, inserted]);

      expect(deepestOverlap(relaxed)).toBeLessThanOrEqual(SLACK);
      expect(reach(relaxed)).toBeLessThanOrEqual(
        reach(before) + 2 * inserted.radius + SLACK,
      );
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
      expect(reach(relaxed)).toBeLessThanOrEqual(
        reach(before) + 2 * 0.05 + SLACK,
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
      expect(reach(relaxed)).toBeLessThanOrEqual(
        reach(before) + 2 * 0.1 + SLACK,
      );
    });

    it("grows an empty Reach by exactly r when the first organelle is inserted", () => {
      const relaxed = relax([{x: 0, y: 0, radius: 0.05}]);
      expect(reach(relaxed)).toBe(0.05);
    });
  });
});

describe("makeRoom", () => {
  it("clears a disc's worth of room without making any two discs overlap", () => {
    const unit = seededUnit(17);

    for (let trial = 0; trial < TRIALS; trial++) {
      const before = relax(randomLayout(unit, 1 + Math.floor(unit() * 12)));
      const room = {
        ...pointInside(unit, {x: 0, y: 0, radius: reach(before)}),
        radius: unit() * 0.4,
      };
      const cleared = makeRoom(before, room);

      expect(deepestOverlap(cleared)).toBeLessThanOrEqual(SLACK);
      expect(deepestOverlap([room, ...cleared])).toBeLessThanOrEqual(SLACK);
    }
  });

  it("grows the Reach by at most the room's growth past the disc it replaces", () => {
    // A Split's case: one organelle of a relaxed layout swells into the
    // room its two pieces need, and the others make way for it.
    const unit = seededUnit(19);

    for (let trial = 0; trial < TRIALS; trial++) {
      const before = relax(randomLayout(unit, 2 + Math.floor(unit() * 12)));
      const target = Math.floor(unit() * before.length);
      const swelling = unit() * 0.2;
      const room = {
        ...before[target],
        radius: before[target].radius + swelling,
      };
      const cleared = makeRoom(
        before.filter((_, i) => i !== target),
        room,
      );

      expect(reach([room, ...cleared])).toBeLessThanOrEqual(
        reach(before) + swelling + SLACK,
      );
    }
  });

  it("moves nothing when the room overlaps nothing", () => {
    const free = [
      {x: 0, y: 0, radius: 0.2},
      {x: 0.4, y: 0, radius: 0.2},
    ];
    expect(makeRoom(free, {x: 0, y: 0.5, radius: 0.1})).toEqual(free);
  });
});
