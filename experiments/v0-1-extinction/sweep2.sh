#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
G="ACQUARIO_WORST_CASE_BIRTH_GATE=1"
JOBS=()
for v in "gate|$G" "gate+confine|$G ACQUARIO_CONFINE_DEPTH=10"; do
  for seed in 7 8 9 10 11; do JOBS+=("${v%%|*}|${v#*|}|$seed"); done
done
printf '%s\n' "${JOBS[@]}" | xargs -P 4 -I{} bash -c '
  IFS="|" read -r name envs what <<< "{}"
  env $envs EXP_VARIANT="$name" EXP_SEEDS="$what" node --import ./scripts/ts-esm-resolver.mjs scripts/extinction.ts > "experiments/v0-1-extinction/results/$name.$what.json" 2> "experiments/v0-1-extinction/results/$name.$what.err"
  echo "done $name $what"
'
