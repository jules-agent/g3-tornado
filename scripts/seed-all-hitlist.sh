#!/bin/bash
# Complete Hit List import script - ALL 54 tasks from Ben's spreadsheet
# Run with: ./scripts/seed-all-hitlist.sh

BASE_URL="https://vrtplpchqeevbbpfopdq.supabase.co/rest/v1"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydHBscGNocWVldmJicGZvcGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNDM4OTgsImV4cCI6MjA4NTgxOTg5OH0.otRCGwWH0TZ47Auqr1xp26eO0ZNuN6kQ7vP2RDYDIaM"

# Project IDs
LVMPD="4a74de19-7ca5-49ac-91e0-cf8c5df7200a"
TRAILER="35caf878-7fda-48a0-ab61-d5bde1aecc41"
MODEL_Y="80b65935-47c0-4182-b157-d775ee17b6d7"
SKYDIO_CT="77790b02-f2a2-424e-8bda-a27b851ebffe"

# Create additional projects first
echo "Creating additional projects..."

# SpaceX project
SPACEX=$(curl -s -X POST "$BASE_URL/projects" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "SpaceX"}' | jq -r '.[0].id // empty')

if [ -z "$SPACEX" ]; then
  SPACEX=$(curl -s "$BASE_URL/projects?name=eq.SpaceX" \
    -H "apikey: $API_KEY" \
    -H "Authorization: Bearer $API_KEY" | jq -r '.[0].id')
fi
echo "SpaceX project: $SPACEX"

# Winch project
WINCH=$(curl -s -X POST "$BASE_URL/projects" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "Winch"}' | jq -r '.[0].id // empty')

if [ -z "$WINCH" ]; then
  WINCH=$(curl -s "$BASE_URL/projects?name=eq.Winch" \
    -H "apikey: $API_KEY" \
    -H "Authorization: Bearer $API_KEY" | jq -r '.[0].id')
fi
echo "Winch project: $WINCH"

# Ballistic Glass project
BALLISTIC=$(curl -s -X POST "$BASE_URL/projects" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "Ballistic Glass"}' | jq -r '.[0].id // empty')

if [ -z "$BALLISTIC" ]; then
  BALLISTIC=$(curl -s "$BASE_URL/projects?name=eq.Ballistic%20Glass" \
    -H "apikey: $API_KEY" \
    -H "Authorization: Bearer $API_KEY" | jq -r '.[0].id')
fi
echo "Ballistic Glass project: $BALLISTIC"

echo ""
echo "Adding missing tasks..."

# Function to add task
add_task() {
  local task_number="$1"
  local description="$2"
  local project_id="$3"
  local status="$4"
  local cadence="$5"
  local is_blocked="$6"
  local blocker_desc="$7"

  # Check if task already exists
  existing=$(curl -s "$BASE_URL/tasks?task_number=eq.$task_number" \
    -H "apikey: $API_KEY" \
    -H "Authorization: Bearer $API_KEY" | jq 'length')

  if [ "$existing" -gt "0" ]; then
    echo "Task $task_number already exists, skipping..."
    return
  fi

  local blocked_json="false"
  local blocker_json="null"
  if [ "$is_blocked" = "true" ]; then
    blocked_json="true"
    blocker_json="\"$blocker_desc\""
  fi

  local closed_at="null"
  if [ "$status" = "closed" ]; then
    closed_at="\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
  fi

  echo "Adding task $task_number: $description"
  curl -s -X POST "$BASE_URL/tasks" \
    -H "apikey: $API_KEY" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"task_number\": \"$task_number\",
      \"description\": \"$description\",
      \"project_id\": \"$project_id\",
      \"status\": \"$status\",
      \"fu_cadence_days\": $cadence,
      \"is_blocked\": $blocked_json,
      \"blocker_description\": $blocker_json,
      \"closed_at\": $closed_at
    }" > /dev/null
}

# ALL TASKS FROM HIT LIST SPREADSHEET
# Format: add_task "ID" "Description" "$PROJECT" "status" cadence_days "blocked" "blocker_desc"

# Row 15: 0008 - CT Light Bar Bracket - SpaceX - 20 days
add_task "0008" "CT Light Bar Bracket" "$SPACEX" "open" 20 "false" ""

# Row 16: 0009 - CT Light Bar Riser - LVMPD - 7 days
add_task "0009" "CT Light Bar Riser" "$LVMPD" "open" 7 "false" ""

# Row 17: 0011 - Rear Door Panel Cover - LVMPD - 2 days (blocked)
add_task "0011" "Rear Door Panel Cover" "$LVMPD" "open" 2 "true" "Need to find vendor, ask Randy's engineer guy or have Garret make new file"

# Row 18: 0013 - Radio Antenna Grounding Bracket - LVMPD - 5 days (blocked)
add_task "0013" "Radio Antenna Grounding Bracket" "$LVMPD" "open" 5 "true" "Ben to buy 3D Printer - currently negotiating dealer account on expensive printer"

# Row 19: 0015 - 3D Printed Vent Set - Rear Partition - LVMPD - 3 days
add_task "0015" "3D Printed Vent Set - Rear Partition" "$LVMPD" "open" 3 "false" ""

# Row 20: 0016 - 3D Printed AC Vent Set - LVMPD - 5 days
add_task "0016" "3D Printed AC Vent Set - Is this different than 531-10, need to update descriptions" "$LVMPD" "open" 5 "true" "Ben to buy 3D printer and we make"

# Row 21: 0017 - Arges Spotlight Housing Shell - LVMPD - 3 days
add_task "0017" "Arges Spotlight Housing Shell" "$LVMPD" "open" 3 "false" ""

# Row 22: 0018 - Phone Charger Dock - LVMPD - 15 days
add_task "0018" "Phone Charger Dock" "$LVMPD" "open" 15 "false" ""

# Row 23: 0019 - Arges Metal Bracket - Mounting - LVMPD - 5 days
add_task "0019" "Arges Metal Bracket - Mounting" "$LVMPD" "open" 5 "false" ""

# Row 24: 0020 - Arges Metal Bracket - Base Bracket - LVMPD - 5 days
add_task "0020" "Arges Metal Bracket - Base Bracket" "$LVMPD" "open" 5 "false" ""

# Row 25: 0021 - LVMPD Center Console Mounting Plate - LVMPD - 5 days
add_task "0021" "LVMPD Center Console Mounting Plate" "$LVMPD" "open" 5 "false" ""

# Row 26: 0022 - LVMPD Center Console Full ASSY - LVMPD - 5 days
add_task "0022" "LVMPD Center Console Full ASSY" "$LVMPD" "open" 5 "false" ""

# Row 27: 0023 - Security Center Console - SpaceX - 80 days (blocked)
add_task "0023" "Security Center Console" "$SPACEX" "open" 80 "true" "Need Vendor Selection"

# Row 28: 0024 - Howler Bracket - LVMPD - Closed
add_task "0024" "Howler Bracket" "$LVMPD" "closed" 7 "false" ""

# Row 29: 0025 - Fender Wheel Howler Bracket - LVMPD - Closed
add_task "0025" "Fender Wheel Howler Bracket" "$LVMPD" "closed" 7 "false" ""

# Row 30: 0026 - Front Bumper Siren Bracket - LVMPD - 5 days
add_task "0026" "Front Bumper Siren Bracket" "$LVMPD" "open" 5 "false" ""

# Row 31: 0027 - Mag Mic Bracket - Maybe Don't Need? Ask Ben - LVMPD - 5 days
add_task "0027" "Mag Mic Bracket - Maybe Don't Need? Ask Ben" "$LVMPD" "open" 5 "false" ""

# Row 32: 0028 - Mounting for Havis Pole - LVMPD - 7 days
add_task "0028" "Mounting for Havis Pole" "$LVMPD" "open" 7 "false" ""

# Row 33: 0029 - Push Bumper Patrol CT - LVMPD - 14 days
add_task "0029" "Push Bumper Patrol CT" "$LVMPD" "open" 14 "false" ""

# Row 34: 0030 - Push Bumper Patrol CT - LVMPD - 14 days
add_task "0030" "Push Bumper Patrol CT - Optional Parts: Fender Guard Set With Reinforcement" "$LVMPD" "open" 14 "false" ""

# Row 35: 0031 - Push Bumper Patrol CT - LVMPD - 14 days
add_task "0031" "Push Bumper Patrol CT - Rubber Set" "$LVMPD" "open" 14 "false" ""

# Row 36: 0032 - Partition LVMPD - Lexan - LVMPD - 5 days
add_task "0032" "Partition LVMPD - Lexan For Partition - Shields" "$LVMPD" "open" 5 "false" ""

# Row 37: 0033 - Partition LVMPD - Hoop - LVMPD - 5 days
add_task "0033" "Partition LVMPD - Hoop, aluminum - Trying Aztek, Area and Target" "$LVMPD" "open" 5 "false" ""

# Row 38: 0034 - Partition LVMPD - Kick Panels - LVMPD - 5 days
add_task "0034" "Partition LVMPD - Kick Panels + Upper Screen + Brackets, Steel - Trying Aztek, Area and Target" "$LVMPD" "open" 5 "false" ""

# Row 39: 0035 - Door Extension Strap - LVMPD - 7 days
add_task "0035" "Door Extension Strap - Door Over Extension Bracket (Needs Strap Too) - Trying Aztek, Area and Target" "$LVMPD" "open" 7 "false" ""

# Row 40: 0036 - Seat Upper Shelf Brackets - 3D Print - LVMPD - 5 days
add_task "0036" "Seat Upper Shelf Brackets - 3D Print" "$LVMPD" "open" 5 "false" ""

# Row 41: 0037 - Seat Upper Shelf Brackets - Update CAD - LVMPD - Closed
add_task "0037" "Seat Upper Shelf Brackets - Update CAD" "$LVMPD" "closed" 7 "false" ""

# Row 42: 0038 - CT Hood Adaptors - 3D Print For V1 Hoods - LVMPD - 5 days
add_task "0038" "CT Hood Adaptors - 3D Print For V1 Hoods" "$LVMPD" "open" 5 "false" ""

# Row 43: 0039 - Mean Well - Purchase Units - SpaceX - 3 days
add_task "0039" "Mean Well - Purchase Units - Go Direct, Get Better Price - Buy Enough for SpaceX and LVMPD" "$SPACEX" "open" 3 "false" ""

# Row 44: 0040 - Electronics Cabinet For Trailer - Trailer - 2 days
add_task "0040" "Electronics Cabinet For Trailer - Need To Do Design & Sourcing" "$TRAILER" "open" 2 "false" ""

# Row 45: 0041 - Flooring For Trailer - Trailer - 5 days
add_task "0041" "Flooring For Trailer - Need to Do Design & Sourcing" "$TRAILER" "open" 5 "false" ""

# Row 46: 0042 - Chase down Skydio components - Trailer - 4 days
add_task "0042" "Chase down Skydio components - need trailer 2 docks, pep link, starlink, etc" "$TRAILER" "open" 4 "false" ""

# Row 47: 0043 - Chase down Tian Mast - Trailer - 2 days
add_task "0043" "Chase down Tian Mast - Get the mast" "$TRAILER" "open" 2 "false" ""

# Row 48: 0044 - Get Battery Warmer to Sky - Trailer - 3 days
add_task "0044" "Get Battery Warmer to Sky - Ensure Sky puts it on the battery and drops battery in" "$TRAILER" "open" 3 "false" ""

# Row 49: 0045 - Print Graphics Trailer - Trailer - 4 days
add_task "0045" "Print Graphics Trailer - Get Skydio to sign off on graphics" "$TRAILER" "open" 4 "false" ""

# Row 50: 0046 - 3D Printed + Laser Cut Tube For Actuators - Trailer - 4 days
add_task "0046" "3D Printed + Laser Cut Tube For Actuators - Adman Leku Says Gabby Ordered, do we have this?" "$TRAILER" "open" 4 "false" ""

# Row 51: 0047 - Harness For Security Spec Build - SpaceX - 30 days
add_task "0047" "Harness For Security Spec Build - Get Prototype, Quotes, Production" "$SPACEX" "open" 30 "false" ""

# Row 52: 0048 - SpaceX Missing Deposit Money - SpaceX - 3 days
add_task "0048" "SpaceX Missing Deposit Money - Chase Deposit Money" "$SPACEX" "open" 3 "false" ""

# Row 53: 0049 - Antenna Subject - Skydio CT - 4 days
add_task "0049" "Antenna Subject - Need antenna details from Skydio - Don" "$SKYDIO_CT" "open" 4 "false" ""

# Row 54: 0052 - Get 48V Winch Ordered - Winch - 5 days
add_task "0052" "Get 48V Winch Ordered - Chase Vendor To Make PO" "$WINCH" "open" 5 "false" ""

# Row 55: 0053 - Get Battery Brackets Made - Winch - 10 days
add_task "0053" "Get Battery Brackets Made - Verify Which Battery of 2 Sizes after Testing, then build box" "$WINCH" "open" 10 "false" ""

# Row 56: 0054 - Schedule Windshield Shoot Test - Ballistic Glass - 3 days
add_task "0054" "Schedule Windshield Shoot Test - Schedule test, then revert to stock. First finish side windows" "$BALLISTIC" "open" 3 "false" ""

echo ""
echo "Import complete!"
echo ""
echo "Checking total task count..."
total=$(curl -s "$BASE_URL/tasks" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" | jq 'length')
echo "Total tasks in database: $total"
