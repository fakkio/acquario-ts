import {
  AQUARIUM_AREA,
  bodyArea,
  capFor,
  createWorld,
  getPoolLevels,
  getPopulation,
  getCumulativeBirths,
  getCumulativeDeaths,
  lightAt,
} from "../../src/world";
import {runTicks} from "../../scripts/calibration/worlds";
import {MITOSIS_ENERGY_COST, RHO} from "../../src/world/constants";
let w = createWorld(Number(process.env.EXP_SEEDS ?? 7));
for (const t of [1000, 3000, 6000, 9000, 12000]) {
  w = runTicks(
    w,
    t -
      (t === 1000
        ? 0
        : [1000, 3000, 6000, 9000, 12000][
            [1000, 3000, 6000, 9000, 12000].indexOf(t) - 1
          ]),
  );
  const pop = getPopulation(w),
    pools = getPoolLevels(w);
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const eFrac = pop.map((o) => o.energy / capFor(o, "energy"));
  const foodC = pop.map((o) => o.food / bodyArea(o));
  const co2C = pop.map((o) => o.carbonDioxide / bodyArea(o));
  const light = pop.map((o) => lightAt(o.y));
  const thr = pop.map((o) => o.mitosisEnergyThreshold);
  const aboveThr = pop.filter(
    (o) => o.energy >= o.mitosisEnergyThreshold * capFor(o, "energy"),
  ).length;
  const canPayMass = pop.filter(
    (o) => o.food >= RHO * bodyArea(o) * 0.99,
  ).length;
  const bodyA = pop.reduce((s, o) => s + bodyArea(o), 0);
  console.log(
    JSON.stringify({
      tick: t,
      n: pop.length,
      births: getCumulativeBirths(w),
      deaths: getCumulativeDeaths(w),
      bodyArea: +bodyA.toFixed(1),
      ambient: {
        food: +(pools.food / AQUARIUM_AREA).toFixed(4),
        co2: +(pools.carbonDioxide / AQUARIUM_AREA).toFixed(4),
        o2: +(pools.oxygen / AQUARIUM_AREA).toFixed(4),
      },
      rawPools: pools,
      medEnergyFrac: +med(eFrac).toFixed(3),
      medFoodConc: +med(foodC).toFixed(3),
      medCO2Conc: +med(co2C).toFixed(3),
      medLight: +med(light).toFixed(3),
      medThreshold: +med(thr).toFixed(3),
      aboveThreshold: aboveThr,
      canPayMass,
    }),
  );
}
