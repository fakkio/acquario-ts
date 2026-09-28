#!/usr/bin/env bash
# EXPERIMENT ONLY (#40): every variant × seed as its own process, results in experiments/v0-1-extinction/results/.
set -u
cd "$(dirname "$0")/../.."
mkdir -p experiments/v0-1-extinction/results
C="ACQUARIO_CONFINE_DEPTH=10"
VARIANTS=(
  "base|"
  "confine|$C"
  "c0-4.68|ACQUARIO_EXISTENCE_COST=4.68"
  "c0-3.12|ACQUARIO_EXISTENCE_COST=3.12"
  "yield-1000|ACQUARIO_RESPIRATION_ENERGY_YIELD=1000"
  "yield-1200|ACQUARIO_RESPIRATION_ENERGY_YIELD=1200"
  "yield-1600|ACQUARIO_RESPIRATION_ENERGY_YIELD=1600"
  "kphoto-0.04|ACQUARIO_K_PHOTO=0.04"
  "kphoto-0.06|ACQUARIO_K_PHOTO=0.06"
  "confine+c0-4.68|$C ACQUARIO_EXISTENCE_COST=4.68"
  "confine+c0-3.12|$C ACQUARIO_EXISTENCE_COST=3.12"
  "confine+yield-1200|$C ACQUARIO_RESPIRATION_ENERGY_YIELD=1200"
  "confine+yield-1600|$C ACQUARIO_RESPIRATION_ENERGY_YIELD=1600"
  "confine+kphoto-0.04|$C ACQUARIO_K_PHOTO=0.04"
  "confine+kphoto-0.06|$C ACQUARIO_K_PHOTO=0.06"
  "yield-1200+kphoto-0.04|ACQUARIO_RESPIRATION_ENERGY_YIELD=1200 ACQUARIO_K_PHOTO=0.04"
  "confine+yield-1200+kphoto-0.04|$C ACQUARIO_RESPIRATION_ENERGY_YIELD=1200 ACQUARIO_K_PHOTO=0.04"
  "frozen-r|ACQUARIO_DELTA_BODY_RADIUS=0"
  "confine+frozen-r|$C ACQUARIO_DELTA_BODY_RADIUS=0"
)
JOBS=()
for v in "${VARIANTS[@]}"; do
  name="${v%%|*}"; envs="${v#*|}"
  JOBS+=("$name|$envs|income")
  for seed in ${SEEDS:-7 8 9 10 11}; do JOBS+=("$name|$envs|$seed"); done
done
printf '%s\n' "${JOBS[@]}" | xargs -P "${PARALLEL:-18}" -I{} bash -c '
  IFS="|" read -r name envs what <<< "{}"
  if [ "$what" = income ]; then
    env $envs EXP_VARIANT="$name" EXP_INCOME=1 EXP_INCOME_ONLY=1 node --import ./scripts/ts-esm-resolver.mjs scripts/extinction.ts > "experiments/v0-1-extinction/results/$name.income.json" 2> "experiments/v0-1-extinction/results/$name.income.err"
  else
    env $envs EXP_VARIANT="$name" EXP_SEEDS="$what" node --import ./scripts/ts-esm-resolver.mjs scripts/extinction.ts > "experiments/v0-1-extinction/results/$name.$what.json" 2> "experiments/v0-1-extinction/results/$name.$what.err"
  fi
  echo "done $name $what"
'
