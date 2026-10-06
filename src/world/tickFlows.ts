import type {Organism, Resource} from "./organism";

/** A signed amount per internal store. */
export type StoreDeltas = Readonly<Record<Resource, number>>;

/**
 * What each step of one tick did to one organism's four stores: the
 * inspector's answer to "where did it go". Every field is a signed change,
 * so the five of them add up to the tick's whole change in the stores.
 */
export interface TickFlows {
  /** Passive exchange with the water, both sub-passes (step 2). */
  readonly exchange: StoreDeltas;
  /** CO₂ + light → food + O₂ (step 3). */
  readonly photosynthesis: StoreDeltas;
  /** food + O₂ → energy + CO₂ (step 4). */
  readonly respiration: StoreDeltas;
  /** Maintenance, an energy charge (step 5). */
  readonly maintenance: StoreDeltas;
  /** What breeding took from the parent this tick (step 7). */
  readonly mitosis: StoreDeltas;
}

export type FlowStep = keyof TickFlows;

type Stores = Record<Resource, number>;

const NO_CHANGE: StoreDeltas = {
  energy: 0,
  oxygen: 0,
  carbonDioxide: 0,
  food: 0,
};

const readStores = (organism: Organism): Stores => ({
  energy: organism.energy,
  oxygen: organism.oxygen,
  carbonDioxide: organism.carbonDioxide,
  food: organism.food,
});

/**
 * Watches one organism through a tick, for the App layer's inspector only.
 * It reads the stores around a step and writes nothing to the organism, the
 * world or any stream, so a traced world and an untraced one stay
 * bit-identical. Both calls return at once for any other organism, so the
 * population loops pay one comparison each and allocate nothing.
 */
export class FlowTracer {
  private readonly watched: Organism | undefined;
  private before: Stores | null = null;
  private readonly deltas: Partial<Record<FlowStep, StoreDeltas>> = {};

  constructor(watched: Organism | undefined) {
    this.watched = watched;
  }

  /** Call just before a step runs for `organism`. */
  start(organism: Organism): void {
    if (organism === this.watched) {
      this.before = readStores(organism);
    }
  }

  /** Call just after the step: records what it did to the stores. */
  end(name: FlowStep, organism: Organism): void {
    const before = this.before;
    if (organism !== this.watched || !before) {
      return;
    }

    const after = readStores(organism);
    const delta = {
      energy: after.energy - before.energy,
      oxygen: after.oxygen - before.oxygen,
      carbonDioxide: after.carbonDioxide - before.carbonDioxide,
      food: after.food - before.food,
    };
    const previous = this.deltas[name];
    // Exchange runs as two passes: the second adds to the first.
    this.deltas[name] = previous
      ? {
          energy: previous.energy + delta.energy,
          oxygen: previous.oxygen + delta.oxygen,
          carbonDioxide: previous.carbonDioxide + delta.carbonDioxide,
          food: previous.food + delta.food,
        }
      : delta;
    this.before = null;
  }

  /** This tick's flows, or null when nothing was watched. A step that
   * never ran for the organism (mitosis in an infertile world) is zero. */
  flows(): TickFlows | null {
    if (!this.watched) {
      return null;
    }

    const at = (name: FlowStep): StoreDeltas => this.deltas[name] ?? NO_CHANGE;

    return {
      exchange: at("exchange"),
      photosynthesis: at("photosynthesis"),
      respiration: at("respiration"),
      maintenance: at("maintenance"),
      mitosis: at("mitosis"),
    };
  }
}
