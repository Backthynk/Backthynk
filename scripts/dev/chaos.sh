#!/bin/bash

# Chaos Script - Creates nested space structure and bulk generates posts
# This script creates a complex space hierarchy and populates it with random posts

# ============================================================================
# CONFIGURATION - Edit these values to customize the chaos generation
# ============================================================================

# Space structure configuration
DEPTH_1_COUNT=8           # Number of top-level spaces
DEPTH_2_COUNT=8           # Number of subspaces per depth-1 space
DEPTH_3_COUNT=8           # Number of subspaces per depth-2 space
                          # Total unique spaces: DEPTH_1 * DEPTH_2 * DEPTH_3 = 512

# Post generation configuration
MIN_POSTS_PER_SPACE=10  # Minimum posts per final space
MAX_POSTS_PER_SPACE=50  # Maximum posts per final space
POST_TIME_MONTHS_BACK=24   # Time range for posts (in months, e.g., 12-24 months)

# Thread configuration (must be 1, 2, 4, or 8)
NUM_THREADS=4              # Number of parallel threads for post generation

# ============================================================================
# END CONFIGURATION
# ============================================================================

set -e  # Exit on error

# Load common utilities
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../common/common.sh"

# Check dependencies
check_dependencies jq curl

# Load configuration
load_config

# Validate thread count
if [[ ! "$NUM_THREADS" =~ ^(1|2|4|8)$ ]]; then
    log_error "NUM_THREADS must be 1, 2, 4, or 8. Got: $NUM_THREADS"
    exit 1
fi

# Check if retroactive posting is enabled
if [ ! -f "options.json" ]; then
    log_error "options.json not found. Cannot verify retroactivePosting feature."
    exit 1
fi

RETROACTIVE_ENABLED=$(jq -r '.features.retroactivePosting.enabled' options.json)
if [ "$RETROACTIVE_ENABLED" != "true" ]; then
    log_error "Retroactive posting is not enabled in options.json"
    log_error "Please enable it by setting features.retroactivePosting.enabled to true"
    exit 1
fi

# Verify server is running
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:$SERVER_PORT/api/spaces | grep -q "200"; then
    log_error "Server is not running on port $SERVER_PORT"
    log_error "Please start the server first: make run"
    exit 1
fi

log_step "Starting chaos generation..."
echo ""
log_info "Space structure: ${DEPTH_1_COUNT}x${DEPTH_2_COUNT}x${DEPTH_3_COUNT} = $((DEPTH_1_COUNT * DEPTH_2_COUNT * DEPTH_3_COUNT)) total spaces"
log_info "Posts per space: ${MIN_POSTS_PER_SPACE}-${MAX_POSTS_PER_SPACE} posts"
log_info "Time range: Last ${POST_TIME_MONTHS_BACK} months"
log_info "Threads: ${NUM_THREADS}"
echo ""

# Function to create a space
create_space() {
    local name=$1
    local parent_id=$2
    local description=$3

    local payload
    if [ -z "$parent_id" ] || [ "$parent_id" = "null" ]; then
        payload="{\"name\":\"$name\",\"description\":\"$description\"}"
    else
        payload="{\"name\":\"$name\",\"description\":\"$description\",\"parent_id\":$parent_id}"
    fi

    local response=$(curl -s -w "\n%{http_code}" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        http://localhost:$SERVER_PORT/api/spaces)

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ]; then
        local space_id=$(echo "$body" | jq -r '.id')
        echo "$space_id"
        return 0
    else
        log_error "Failed to create space '$name' (HTTP: $http_code)"
        return 1
    fi
}

# Arrays to store space IDs
declare -a depth1_ids=()
declare -a depth2_ids=()
declare -a depth3_ids=()

# Create depth 1 spaces
log_step "Creating depth 1 spaces (${DEPTH_1_COUNT} spaces)..."
for i in $(seq 1 $DEPTH_1_COUNT); do
    name="Space-L1-${i}"
    description="Top-level space ${i}"

    cat_id=$(create_space "$name" "" "$description")
    if [ $? -eq 0 ]; then
        depth1_ids+=("$cat_id")
        log_substep "Created: $name (ID: $cat_id)"
    fi
done

echo ""
log_success "Created ${#depth1_ids[@]} depth 1 spaces"
echo ""

# Create depth 2 spaces
log_step "Creating depth 2 spaces (${DEPTH_1_COUNT}x${DEPTH_2_COUNT} = $((DEPTH_1_COUNT * DEPTH_2_COUNT)) spaces)..."
for parent_id in "${depth1_ids[@]}"; do
    for i in $(seq 1 $DEPTH_2_COUNT); do
        name="Space-L2-${parent_id}-${i}"
        description="Subspace ${i} of space ${parent_id}"

        cat_id=$(create_space "$name" "$parent_id" "$description")
        if [ $? -eq 0 ]; then
            depth2_ids+=("$cat_id")
            log_substep "Created: $name (ID: $cat_id, Parent: $parent_id)"
        fi
    done
done

echo ""
log_success "Created ${#depth2_ids[@]} depth 2 spaces"
echo ""

# Create depth 3 spaces
log_step "Creating depth 3 spaces (${DEPTH_1_COUNT}x${DEPTH_2_COUNT}x${DEPTH_3_COUNT} = $((DEPTH_1_COUNT * DEPTH_2_COUNT * DEPTH_3_COUNT)) spaces)..."
for parent_id in "${depth2_ids[@]}"; do
    for i in $(seq 1 $DEPTH_3_COUNT); do
        name="Space-L3-${parent_id}-${i}"
        description="Subspace ${i} of space ${parent_id}"

        cat_id=$(create_space "$name" "$parent_id" "$description")
        if [ $? -eq 0 ]; then
            depth3_ids+=("$cat_id")
            log_substep "Created: $name (ID: $cat_id, Parent: $parent_id)"
        fi
    done
done

echo ""
log_success "Created ${#depth3_ids[@]} depth 3 spaces"
echo ""

# Function to generate posts for a space
generate_posts_for_space() {
    local space_id=$1
    local num_posts=$2
    local months_back=$3

    # Use bulk_create_posts.sh
    "$SCRIPT_DIR/bulk_create_posts.sh" "$space_id" "$num_posts" "$months_back" 2>&1
}

# Split spaces into thread buckets
total_spaces=${#depth3_ids[@]}
spaces_per_thread=$((total_spaces / NUM_THREADS))
remainder=$((total_spaces % NUM_THREADS))

log_step "Generating posts in ${NUM_THREADS} parallel threads..."
echo ""
log_info "Total leaf spaces: ${total_spaces}"
log_info "Spaces per thread: ~${spaces_per_thread}"
echo ""

# Create temporary directory for thread management
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to process a batch of spaces
process_space_batch() {
    local thread_id=$1
    shift
    local spaces=("$@")

    local output_file="$TEMP_DIR/thread_${thread_id}.log"
    local success_count=0
    local total_posts=0

    echo "Thread ${thread_id}: Starting..." > "$output_file"

    for space_id in "${spaces[@]}"; do
        # Random number of posts between MIN and MAX
        local num_posts=$((MIN_POSTS_PER_SPACE + RANDOM % (MAX_POSTS_PER_SPACE - MIN_POSTS_PER_SPACE + 1)))

        echo "Thread ${thread_id}: Processing space ${space_id} with ${num_posts} posts..." >> "$output_file"

        if generate_posts_for_space "$space_id" "$num_posts" "$POST_TIME_MONTHS_BACK" >> "$output_file" 2>&1; then
            success_count=$((success_count + 1))
            total_posts=$((total_posts + num_posts))
        fi
    done

    echo "Thread ${thread_id}: Complete. Processed ${success_count} spaces, ${total_posts} posts." >> "$output_file"
}

# Start threads
pids=()
for thread_id in $(seq 1 $NUM_THREADS); do
    # Calculate start and end indices for this thread
    start_idx=$(( (thread_id - 1) * spaces_per_thread ))

    if [ $thread_id -eq $NUM_THREADS ]; then
        # Last thread gets any remainder
        end_idx=$total_spaces
    else
        end_idx=$((start_idx + spaces_per_thread))
    fi

    # Extract space slice for this thread
    thread_spaces=("${depth3_ids[@]:$start_idx:$((end_idx - start_idx))}")

    log_info "Starting thread ${thread_id} (spaces ${start_idx} to $((end_idx - 1)))..."

    # Start thread in background
    process_space_batch "$thread_id" "${thread_spaces[@]}" &
    pids+=($!)
done

# Wait for all threads to complete
log_step "Waiting for all threads to complete..."
echo ""

for i in "${!pids[@]}"; do
    pid=${pids[$i]}
    thread_id=$((i + 1))

    if wait $pid; then
        log_success "Thread ${thread_id} completed successfully"
    else
        log_error "Thread ${thread_id} failed"
    fi
done

echo ""
log_step "Chaos generation complete!"
echo ""

# Display summary from thread logs
log_step "Summary:"
echo ""

total_posts_created=0
for thread_id in $(seq 1 $NUM_THREADS); do
    if [ -f "$TEMP_DIR/thread_${thread_id}.log" ]; then
        posts=$(grep -oP "Done: \K\d+(?=/)" "$TEMP_DIR/thread_${thread_id}.log" | tail -1)
        if [ ! -z "$posts" ]; then
            total_posts_created=$((total_posts_created + posts))
        fi
    fi
done

log_info "Total spaces created: $((${#depth1_ids[@]} + ${#depth2_ids[@]} + ${#depth3_ids[@]}))"
log_info "  - Depth 1: ${#depth1_ids[@]}"
log_info "  - Depth 2: ${#depth2_ids[@]}"
log_info "  - Depth 3: ${#depth3_ids[@]}"
log_info "Total posts created: ${total_posts_created}"

echo ""
log_success "Chaos has been unleashed! 🌪️"
