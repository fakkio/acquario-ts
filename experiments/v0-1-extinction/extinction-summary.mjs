// EXPERIMENT ONLY (#40): fold .exp/*.json into markdown tables.
import {readFileSync, readdirSync} from "node:fs";

const dir = "experiments/v0-1-extinction/results";
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const variants = new Map();
for (const file of files) {
  const text = readFileSync(`${dir}/${file}`, "utf8");
  if (!text.trim()) continue;
  const data = JSON.parse(text);
  const v = variants.get(data.variant) ?? {runs: [], income: null};
  if (data.income) v.income = data.income;
  v.runs.push(...data.runs);
  variants.set(data.variant, v);
}
// The worst-case gate never enters the infertile income ladder: gate+X borrows X's n / r_max (and gate borrows base's).
for (const [name, v] of variants) {
  if (v.income || !name.startsWith("gate")) continue;
  v.income =
    variants.get(name.replace(/^gate\+?/, "") || "base")?.income ?? null;
}

const f = (x, d = 2) => (x === null || x === undefined ? "—" : x.toFixed(d));
const order = (process.argv[2] ?? "").split(",").filter(Boolean);
const names = order.length
  ? order.filter((n) => variants.has(n))
  : [...variants.keys()];
const mean = (xs) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

console.log(
  "| variant | n | r_max | extinct at (per seed) | survived | births (mean) | peak size | tenancy (mean) |",
);
console.log("|---|---|---|---|---|---|---|---|");
for (const name of names) {
  const {runs, income} = variants.get(name);
  runs.sort((a, b) => a.seed - b.seed);
  const ext = runs.map((r) =>
    r.extinctAt === null ? "✓" : `${(r.extinctAt / 1000).toFixed(1)}k`,
  );
  const surv = runs.filter((r) => r.extinctAt === null).length;
  const ten = runs.map((r) => r.tenancy).filter((t) => t !== null);
  console.log(
    `| ${name} | ${f(income?.nSettled, 3)} | ${f(income?.rMax)} | ${ext.join(" · ")} | ${surv}/${runs.length} | ${Math.round(mean(runs.map((r) => r.births)))} | ${Math.round(mean(runs.map((r) => r.peakSize)))} | ${ten.length ? f(mean(ten)) : "∞ (no stay ends)"} |`,
  );
}

const checkpoints = [1000, 3000, 5000, 10000, 15000, 20000, 50000, 100000];
console.log(
  "\nMean bodyRadius (seed-averaged over the seeds still alive) / population (seed-averaged, extinct = 0):\n",
);
console.log(
  `| variant | ${checkpoints.map((c) => `${c / 1000}k`).join(" | ")} |`,
);
console.log(`|---|${checkpoints.map(() => "---").join("|")}|`);
for (const name of names) {
  const {runs} = variants.get(name);
  const cells = checkpoints.map((c) => {
    const pts = runs.map((r) => r.trajectory.find((p) => p.tick === c) ?? null);
    const alive = pts.filter((p) => p && p.size > 0);
    const size = mean(pts.map((p) => (p ? p.size : 0)));
    return alive.length
      ? `${f(mean(alive.map((p) => p.meanR)))} / ${Math.round(size)}`
      : "† ";
  });
  console.log(`| ${name} | ${cells.join(" | ")} |`);
}

console.log("\nSurvivors, last 10k ticks:\n");
for (const name of names) {
  const s = variants.get(name).runs.filter((r) => r.extinctAt === null);
  if (s.length)
    console.log(
      `- ${name}: mean r ${s.map((r) => f(r.meanRLast10k)).join(", ")}; size ${s.map((r) => Math.round(r.sizeLast10k)).join(", ")}; wall ${s.map((r) => Math.round(r.wallSeconds)).join(", ")}s`,
    );
}

// #41: generation-rate proxy. Births per 100k organism-ticks = births / time-averaged population,
// organism-ticks integrated from the 1k-tick trajectory samples.
console.log(
  "\nGeneration rate (births per 100k organism-ticks, ≈ births per organism per 100k ticks):\n",
);
console.log(
  "| variant | births (mean) | mean pop (run) | mean pop last 10k (survivors) | births/100k/organism | mean r 1k → 50k → 100k |",
);
console.log("|---|---|---|---|---|---|");
for (const name of names) {
  const {runs} = variants.get(name);
  const orgTicks = runs.map((r) => {
    let sum = 0;
    let prev = 0;
    for (const p of r.trajectory) {
      sum += p.size * (p.tick - prev);
      prev = p.tick;
    }
    return sum;
  });
  const rate =
    runs.reduce((a, r) => a + r.births, 0) /
    (orgTicks.reduce((a, b) => a + b, 0) / 100_000);
  const popRun = mean(
    runs.map((r, i) => orgTicks[i] / (r.extinctAt ?? r.trajectory.at(-1).tick)),
  );
  const surv = runs.filter((r) => r.extinctAt === null);
  const rAt = (c) => {
    const alive = runs
      .map((r) => r.trajectory.find((p) => p.tick === c))
      .filter((p) => p && p.size > 0);
    return alive.length ? f(mean(alive.map((p) => p.meanR))) : "†";
  };
  console.log(
    `| ${name} | ${Math.round(mean(runs.map((r) => r.births)))} | ${Math.round(popRun)} | ${surv.length ? Math.round(mean(surv.map((r) => r.sizeLast10k))) : "—"} | ${f(rate, 1)} | ${rAt(1000)} → ${rAt(50000)} → ${rAt(100000)} |`,
  );
}
