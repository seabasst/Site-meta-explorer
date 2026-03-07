#!/bin/bash
# Bulk download pending ad assets to R2
# Runs batches of 50 with a pause between to avoid overwhelming the system

BATCH_SIZE=${1:-50}
MAX_BATCHES=${2:-100}
PAUSE_SECONDS=${3:-5}
BASE_URL="http://localhost:3000"

echo "Starting bulk asset download"
echo "Batch size: $BATCH_SIZE | Max batches: $MAX_BATCHES | Pause: ${PAUSE_SECONDS}s"
echo "---"

total_succeeded=0
total_failed=0
batch=0

while [ $batch -lt $MAX_BATCHES ]; do
  batch=$((batch + 1))

  result=$(curl -s -X POST "$BASE_URL/api/ad-library/assets" \
    -H 'Content-Type: application/json' \
    -d "{\"action\":\"process\",\"limit\":$BATCH_SIZE}" 2>/dev/null)

  processed=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('processed',0))" 2>/dev/null)
  succeeded=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('succeeded',0))" 2>/dev/null)
  failed=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('failed',0))" 2>/dev/null)

  if [ "$processed" = "0" ] || [ -z "$processed" ]; then
    echo "Batch $batch: No more pending assets. Done!"
    break
  fi

  total_succeeded=$((total_succeeded + succeeded))
  total_failed=$((total_failed + failed))

  echo "Batch $batch: processed=$processed succeeded=$succeeded failed=$failed | Total: $total_succeeded succeeded, $total_failed failed"

  sleep $PAUSE_SECONDS
done

echo "---"
echo "Complete! $total_succeeded succeeded, $total_failed failed across $batch batches"
