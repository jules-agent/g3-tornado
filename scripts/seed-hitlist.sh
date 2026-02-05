#!/bin/bash

# G3-Tornado Hit List Import Script
# Data captured from Ben's spreadsheet 2026-02-04

SUPABASE_URL="https://vrtplpchqeevbbpfopdq.supabase.co/rest/v1"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydHBscGNocWVldmJicGZvcGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNDM4OTgsImV4cCI6MjA4NTgxOTg5OH0.otRCGwWH0TZ47Auqr1xp26eO0ZNuN6kQ7vP2RDYDIaM"

# Headers
AUTH="-H 'apikey: $SUPABASE_KEY' -H 'Authorization: Bearer $SUPABASE_KEY' -H 'Content-Type: application/json' -H 'Prefer: return=representation'"

echo "=== Creating Projects ==="

# Create projects
curl -s -X POST "$SUPABASE_URL/projects" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "Trailer"}' | jq -r '.[] | "Created project: \(.name) (\(.id))"' 2>/dev/null || echo "Trailer project may already exist"

curl -s -X POST "$SUPABASE_URL/projects" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "Model Y"}' | jq -r '.[] | "Created project: \(.name) (\(.id))"' 2>/dev/null || echo "Model Y project may already exist"

curl -s -X POST "$SUPABASE_URL/projects" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "Skydio CT"}' | jq -r '.[] | "Created project: \(.name) (\(.id))"' 2>/dev/null || echo "Skydio CT project may already exist"

echo ""
echo "=== Getting Project IDs ==="

# Get project IDs
LVMPD_ID=$(curl -s "$SUPABASE_URL/projects?name=eq.LVMPD%20Fleet%20Build&select=id" -H "apikey: $SUPABASE_KEY" | jq -r '.[0].id')
TRAILER_ID=$(curl -s "$SUPABASE_URL/projects?name=eq.Trailer&select=id" -H "apikey: $SUPABASE_KEY" | jq -r '.[0].id')
MODELY_ID=$(curl -s "$SUPABASE_URL/projects?name=eq.Model%20Y&select=id" -H "apikey: $SUPABASE_KEY" | jq -r '.[0].id')
SKYDIO_ID=$(curl -s "$SUPABASE_URL/projects?name=eq.Skydio%20CT&select=id" -H "apikey: $SUPABASE_KEY" | jq -r '.[0].id')

echo "LVMPD: $LVMPD_ID"
echo "Trailer: $TRAILER_ID"
echo "Model Y: $MODELY_ID"
echo "Skydio CT: $SKYDIO_ID"

echo ""
echo "=== Creating Owners ==="

# Create owners
for owner in "Sky" "Duo Form" "Aztek" "Rail Co" "Smart Steel Solutions"; do
  curl -s -X POST "$SUPABASE_URL/owners" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"name\": \"$owner\"}" 2>/dev/null | jq -r '.[] | "Created owner: \(.name)"' 2>/dev/null || echo "$owner may already exist"
done

echo ""
echo "=== Creating Tasks ==="

# Function to create a task
create_task() {
  local task_number="$1"
  local description="$2"
  local project_id="$3"
  local fu_cadence="$4"
  local status="$5"
  local is_blocked="$6"
  local blocker_note="$7"
  
  local data="{\"task_number\": \"$task_number\", \"description\": \"$description\", \"project_id\": \"$project_id\", \"fu_cadence_days\": $fu_cadence, \"status\": \"$status\", \"is_blocked\": $is_blocked"
  
  if [ -n "$blocker_note" ]; then
    data="$data, \"blocker_note\": \"$blocker_note\""
  fi
  
  data="$data}"
  
  result=$(curl -s -X POST "$SUPABASE_URL/tasks" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$data")
  
  echo "Task $task_number: $(echo $result | jq -r '.[0].description // "Error or already exists"' 2>/dev/null)"
}

# Tasks from Hit List (data captured from spreadsheet)
# Format: task_number, description, project_id, fu_cadence, status, is_blocked, blocker_note

create_task "0001" "Weld more steel attachment points to bolt sliders to" "$TRAILER_ID" 5 "open" false ""
create_task "0002" "Rear Transport Seat" "$LVMPD_ID" 10 "open" false ""
create_task "0010" "Rear Seat Base Mount Transport Seat" "$LVMPD_ID" 5 "open" true "Waiting on Garret to finalize files"
create_task "0012" "Rear Transport Seat Center Buckle" "$LVMPD_ID" 7 "open" false ""
create_task "0014" "Rear Transport Seat Corner Supports" "$LVMPD_ID" 7 "closed" false ""
create_task "0050" "Rear Transport Seat MY Center Bottom Bracket" "$MODELY_ID" 7 "closed" false ""
create_task "0051" "Rear Transport Seat - MY Center Buckle" "$MODELY_ID" 20 "open" false ""
create_task "0003" "Solar Roof Frame" "$TRAILER_ID" 7 "closed" true "No Vendor/PO"
create_task "0004" "Cybertruck Drone Dock Bed Assembly" "$SKYDIO_ID" 1 "open" false ""
create_task "0005" "2 Drone Dock Bases" "$TRAILER_ID" 7 "open" false ""
create_task "0006" "2 Electric Rails" "$TRAILER_ID" 7 "closed" false ""
create_task "0007" "Solar Awning Assembly" "$TRAILER_ID" 7 "closed" true "No Vendor Yet"

echo ""
echo "=== Done! ==="
echo "Check https://g3-tornado.vercel.app to see the imported tasks"
