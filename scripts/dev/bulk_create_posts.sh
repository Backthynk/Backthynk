#!/bin/bash

# Minimal working bulk post creator

if [ $# -ne 3 ]; then
    echo "Usage: $0 <category_id> <number_of_posts> <months_back>"
    exit 1
fi

CATEGORY_ID=$1
COUNT=$2
MONTHS=$3

# Work directly with milliseconds for better precision
NOW_MS=$(date +%s%3N)
PAST_MS=$((NOW_MS - (MONTHS * 30 * 24 * 60 * 60 * 1000)))

echo "Creating $COUNT posts for category $CATEGORY_ID..."
echo "Time range: $(date -d @$((PAST_MS/1000)) '+%Y-%m-%d') to $(date -d @$((NOW_MS/1000)) '+%Y-%m-%d')"

SUCCESS=0
for i in $(seq 1 $COUNT); do
    # Random millisecond timestamp between past and now
    TIME_RANGE_MS=$((NOW_MS - PAST_MS))
    # Use /dev/urandom for better random distribution
    RAND_OFFSET=$(od -An -N8 -tu8 < /dev/urandom | tr -d ' ')
    RAND_OFFSET=$((RAND_OFFSET % TIME_RANGE_MS))
    POST_TIME_MS=$((PAST_MS + RAND_OFFSET))

    CONTENT="Bulk generated post #$i - Created $(date -d @$((POST_TIME_MS/1000)) '+%Y-%m-%d %H:%M:%S')"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d "{\"category_id\":$CATEGORY_ID,\"content\":\"$CONTENT\",\"custom_timestamp\":$POST_TIME_MS}" \
        http://localhost:8080/api/posts)

    if [ "$HTTP_CODE" = "201" ]; then
        SUCCESS=$((SUCCESS + 1))
        echo "✓ Created post $i/$COUNT"
    else
        echo "✗ Failed post $i (HTTP: $HTTP_CODE)"
    fi
done

echo "Done: $SUCCESS/$COUNT posts created successfully"