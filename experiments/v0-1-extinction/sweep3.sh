#!/usr/bin/env bash
# EXPERIMENT ONLY (#41): worst-case birth gate × metabolic levers. No income ladder: the gate never enters
# the infertile ladder, so n/r_max are the non-gate lever rows'.
set -u
cd "$(dirname "$0")/../.."
G="ACQUARIO_WORST_CASE_BIRTH_GATE=1"
VARIANTS=(
  "gate+kphoto-0.06|$G ACQUARIO_K_PHOTO=0.06"
  "gate+yield-1600|$G ACQUARIO_RESPIRATION_ENERGY_YIELD=1600"
  "gate+yield-1200+kphoto-0.04|$G ACQUARIO_RESPIRATION_ENERGY_YIELD=1200 ACQUARIO_K_PHOTO=0.04"
  "gate+kphoto-0.04|$G ACQUARIO_K_PHOTO=0.04"
  "gate+yield-1200|$G ACQUARIO_RESPIRATION_ENERGY_YIELD=1200"
  "gate+c0-4.68|$G ACQUARIO_EXISTENCE_COST=4.68"
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
