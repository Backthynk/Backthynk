#!/bin/bash

# Minimal working bulk post creator

if [ $# -ne 3 ]; then
    echo "Usage: $0 <space_id> <number_of_posts> <months_back>"
    exit 1
fi

SPACE_ID=$1
COUNT=$2
MONTHS=$3

# Load common utilities
source "$(dirname "$0")/../common/common.sh"

# Check dependencies and load configuration
check_dependencies jq
load_config

# Work directly with milliseconds for better precision
NOW_MS=$(date +%s%3N)
# Calculate days in seconds first, then convert to milliseconds to avoid overflow
DAYS_BACK=$((MONTHS * 30))
SECONDS_BACK=$((DAYS_BACK * 24 * 60 * 60))
PAST_MS=$((NOW_MS - (SECONDS_BACK * 1000)))

echo "Creating $COUNT posts for space $SPACE_ID..."
echo "Time range: $(date -d @$((PAST_MS/1000)) '+%Y-%m-%d') to $(date -d @$((NOW_MS/1000)) '+%Y-%m-%d')"

SUCCESS=0
# Calculate time range once
TIME_RANGE_MS=$((NOW_MS - PAST_MS))

for i in $(seq 1 $COUNT); do
    # Random millisecond timestamp between past and now
    # Use $RANDOM (0-32767) multiple times to build a random percentage
    RAND_PCT=$(( (RANDOM * 32768 + RANDOM) % 10000 ))  # 0-9999
    RAND_OFFSET=$(( (TIME_RANGE_MS * RAND_PCT) / 10000 ))
    POST_TIME_MS=$((PAST_MS + RAND_OFFSET))

    CONTENT="Bulk generated post #$i - Created $(date -d @$((POST_TIME_MS/1000)) '+%Y-%m-%d %H:%M:%S')"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d "{\"space_id\":$SPACE_ID,\"content\":\"$CONTENT\",\"custom_timestamp\":$POST_TIME_MS}" \
        http://localhost:$SERVER_PORT/api/posts)

    if [ "$HTTP_CODE" = "201" ]; then
        SUCCESS=$((SUCCESS + 1))
        echo "✓ Created post $i/$COUNT"
    else
        echo "✗ Failed post $i (HTTP: $HTTP_CODE)"
    fi
done

echo "Done: $SUCCESS/$COUNT posts created successfully"