#!/usr/bin/env bash
# EXPERIMENT ONLY (#41): worst-case birth gate × carbon budget K and ambient CO₂ share.
# K = CARBON_BUDGET_BASELINE_ORGANISMS, committed 2·1.5²·150 + 2400/π = 1438.94; here ×1.5, ×2, ×3.
# AMBIENT_CO2_SHARE committed 0.6; here 0.4 and 0.2 at the committed K.
# Plain `gate` is rerun so its trajectory carries the same carbon/α readouts (deterministic: same numbers).
set -u
cd "$(dirname "$0")/../.."
G="ACQUARIO_WORST_CASE_BIRTH_GATE=1"
# The straight K rows starve by tick 250: ambient CO₂ = 0.6·s passes K_CAP_CARBON_DIOXIDE = 1 and respiration is
# throttled by CO₂ headroom. The `co2held` rows hold ambient CO₂ at the committed 0.6 × 1.740 = 1.044 and put
# all the extra carbon into food: share = 1.044 / s_K (s_K = 2.635, 3.530, 5.320 for 40 founders of area ≈ 125.7).
# They die too (food over K_CAP_FOOD = 1.5 blocks photosynthesis, so internal CO₂ never drops under its cap):
# under the committed caps s₀ cannot pass ≈ K_CAP_FOOD + K_CAP_CARBON_DIOXIDE = 2.5, i.e. K ≲ 2050 (×1.42).
# Feasible K steps: ×1.25 and ×1.4 with CO₂ held; and ×1.5/×2/×3 with both caps scaled by f = s_K / s_base
# (1.5143, 2.0286, 3.0572), so every store-to-cap ratio is the committed one and only food/ρ and s/ρ rise.
VARIANTS=(
  "gate+K-3x+caps|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=4316.8311 ACQUARIO_K_CAP_FOOD=4.5858 ACQUARIO_K_CAP_CARBON_DIOXIDE=3.0572"
  "gate+K-2x+caps|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=2877.8874 ACQUARIO_K_CAP_FOOD=3.0429 ACQUARIO_K_CAP_CARBON_DIOXIDE=2.0286"
  "gate+K-1.5x+caps|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=2158.4156 ACQUARIO_K_CAP_FOOD=2.2714 ACQUARIO_K_CAP_CARBON_DIOXIDE=1.5143"
  "gate+K-1.4x+co2held|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=2014.5212 ACQUARIO_AMBIENT_CO2_SHARE=0.4251"
  "gate+K-1.25x+co2held|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=1798.6797 ACQUARIO_AMBIENT_CO2_SHARE=0.4771"
  "gate+K-1.25x|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=1798.6797"
  "gate+K-3x+co2held|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=4316.8311 ACQUARIO_AMBIENT_CO2_SHARE=0.1962"
  "gate+K-2x+co2held|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=2877.8874 ACQUARIO_AMBIENT_CO2_SHARE=0.2958"
  "gate+K-1.5x+co2held|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=2158.4156 ACQUARIO_AMBIENT_CO2_SHARE=0.3962"
  "gate+K-3x|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=4316.8311"
  "gate+K-2x|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=2877.8874"
  "gate+K-1.5x|$G ACQUARIO_CARBON_BUDGET_BASELINE_ORGANISMS=2158.4156"
  "gate+co2share-0.2|$G ACQUARIO_AMBIENT_CO2_SHARE=0.2"
  "gate+co2share-0.4|$G ACQUARIO_AMBIENT_CO2_SHARE=0.4"
  "gate|$G"
)
JOBS=()
for v in "${VARIANTS[@]}"; do
  for seed in ${SEEDS:-7 8 9 10 11}; do JOBS+=("${v%%|*}|${v#*|}|$seed"); done
done
printf '%s\n' "${JOBS[@]}" | xargs -P "${PARALLEL:-16}" -I{} bash -c '
  IFS="|" read -r name envs what <<< "{}"
  env $envs EXP_VARIANT="$name" EXP_SEEDS="$what" node --import ./scripts/ts-esm-resolver.mjs scripts/extinction.ts > "experiments/v0-1-extinction/results/$name.$what.json" 2> "experiments/v0-1-extinction/results/$name.$what.err"
  echo "$(date +%T) done $name $what"
'
