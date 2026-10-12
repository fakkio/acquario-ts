import type {DiscReading, PhotosynthesisOutcome} from "./metabolism";
import type {Organism, Resource} from "./organism";

/** A signed amount per internal store. */
export type StoreDeltas = Readonly<Record<Resource, number>>;

/**
 * What each step of one tick did to one organism's four stores: the
 * inspector's answer to "where did it go". Every field is a signed change,
 * so the six of them add up to the tick's whole change in the stores.
 */
export interface TickFlows {
  /** Passive exchange with the water, both sub-passes (step 2). */
  readonly exchange: StoreDeltas;
  /** CO₂ + light → food + O₂ (step 3): the body's passive share. */
  readonly photosynthesisBody: StoreDeltas;
  /** Step 3's other share: what the chloroplasts fixed, as granted after the
   * throttle. The two shares sum to the tick's single photosynthesis entry. */
  readonly photosynthesisChloroplasts: StoreDeltas;
  /** What each chloroplast read and fixed (step 3), in genome order. */
  readonly discs: readonly DiscReading[];
  /** food + O₂ → energy + CO₂ (step 4). */
  readonly respiration: StoreDeltas;
  /** Maintenance, an energy charge (step 5). */
  readonly maintenance: StoreDeltas;
  /** What breeding took from the parent this tick (step 7). */
  readonly mitosis: StoreDeltas;
}

export type FlowStep = Exclude<keyof TickFlows, "discs">;

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
  private readonly discs: DiscReading[] = [];

  constructor(watched: Organism | undefined) {
    this.watched = watched;
  }

  /** Call just before a step runs for `organism`. */
  start(organism: Organism): void {
    if (organism === this.watched) {
      this.before = readStores(organism);
    }
  }

  /** The sink photosynthesis fills with each chloroplast's reading, for the
   * watched organism only: any other gets none and allocates nothing. */
  discSink(organism: Organism): DiscReading[] | undefined {
    return organism === this.watched ? this.discs : undefined;
  }

  /** Call just after photosynthesis: records its two shares. The reaction
   * moves CO₂ into food and O₂ at 1:1:1, so each share is one number. */
  endPhotosynthesis(organism: Organism, outcome: PhotosynthesisOutcome): void {
    if (organism !== this.watched) {
      return;
    }
    const share = (fixed: number): StoreDeltas => ({
      energy: 0,
      oxygen: fixed,
      carbonDioxide: -fixed,
      food: fixed,
    });
    this.deltas.photosynthesisBody = share(outcome.body);
    this.deltas.photosynthesisChloroplasts = share(outcome.chloroplasts);
    this.before = null;
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
      photosynthesisBody: at("photosynthesisBody"),
      photosynthesisChloroplasts: at("photosynthesisChloroplasts"),
      discs: this.discs,
      respiration: at("respiration"),
      maintenance: at("maintenance"),
      mitosis: at("mitosis"),
    };
  }
}
