#!/bin/bash
# ============================================================
# Healthcare AI Platform — Integration Test Runner
# ============================================================
# Tests the full system via API calls
# Run: bash tests/run_tests.sh
# ============================================================

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local expected_status="$5"
  local check_field="$6"
  
  TOTAL=$((TOTAL + 1))
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}${path}")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -H "X-Idempotency-Key: test-$(date +%s)-${TOTAL}" \
      -d "$data" \
      "${BASE_URL}${path}")
  fi
  
  status_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status_code" = "$expected_status" ]; then
    if [ -n "$check_field" ]; then
      if echo "$body" | grep -q "$check_field"; then
        echo -e "${GREEN}✅ PASS${NC} [$status_code] $name"
        PASS=$((PASS + 1))
      else
        echo -e "${RED}❌ FAIL${NC} [$status_code] $name — missing field: $check_field"
        FAIL=$((FAIL + 1))
      fi
    else
      echo -e "${GREEN}✅ PASS${NC} [$status_code] $name"
      PASS=$((PASS + 1))
    fi
  else
    echo -e "${RED}❌ FAIL${NC} [got $status_code, expected $expected_status] $name"
    echo "   Response: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "============================================================"
echo "  Healthcare AI Platform — Integration Tests"
echo "  Target: $BASE_URL"
echo "============================================================"
echo ""

# ---- Health Check ----
echo -e "${YELLOW}--- Health Check ---${NC}"
test_endpoint "API Health Check" "GET" "/api/health" "" "200" "status"

# ---- Test 1: Routine Patient ----
echo -e "\n${YELLOW}--- Test 1: Routine Patient Intake ---${NC}"
test_endpoint "Routine intake submission" "POST" "/api/intake" \
  '{"full_name":"Test Patient Routine","email":"test.routine@demo.local","symptoms":"I have had a mild headache for 2 days","severity":"MILD","symptom_duration":"2 days","age":35,"phone":"+1-555-9001"}' \
  "201" "SCHEDULED"

# ---- Test 2: Urgent Patient ----
echo -e "\n${YELLOW}--- Test 2: Urgent Patient Intake ---${NC}"
test_endpoint "Urgent intake submission" "POST" "/api/intake" \
  '{"full_name":"Test Patient Urgent","email":"test.urgent@demo.local","symptoms":"High fever of 103F for 3 days with severe body aches and chills","severity":"SEVERE","symptom_duration":"3 days","age":45}' \
  "201" ""

# ---- Test 3: Emergency Case ----
echo -e "\n${YELLOW}--- Test 3: Emergency Case ---${NC}"
test_endpoint "Emergency intake (chest pain + breathing)" "POST" "/api/intake" \
  '{"full_name":"Test Patient Emergency","email":"test.emergency@demo.local","symptoms":"Severe chest pain with significant difficulty breathing, started 30 minutes ago","severity":"CRITICAL","age":62}' \
  "200" "ESCALATED"

# ---- Test 4: Missing Required Fields ----
echo -e "\n${YELLOW}--- Test 4: Validation - Missing Fields ---${NC}"
test_endpoint "Missing full_name" "POST" "/api/intake" \
  '{"email":"test@demo.local","symptoms":"headache"}' \
  "400" "VALIDATION_ERROR"

test_endpoint "Missing email" "POST" "/api/intake" \
  '{"full_name":"Test","symptoms":"headache"}' \
  "400" "VALIDATION_ERROR"

test_endpoint "Missing symptoms" "POST" "/api/intake" \
  '{"full_name":"Test","email":"test@demo.local"}' \
  "400" "VALIDATION_ERROR"

# ---- Test 5: Invalid Data ----
echo -e "\n${YELLOW}--- Test 5: Validation - Invalid Data ---${NC}"
test_endpoint "Invalid email format" "POST" "/api/intake" \
  '{"full_name":"Test","email":"not-an-email","symptoms":"headache for 3 days"}' \
  "400" "VALIDATION_ERROR"

test_endpoint "Invalid age (too high)" "POST" "/api/intake" \
  '{"full_name":"Test","email":"t@d.com","symptoms":"headache for days","age":200}' \
  "400" "VALIDATION_ERROR"

# ---- Test 6: Duplicate Intake (Idempotency) ----
echo -e "\n${YELLOW}--- Test 6: Idempotency ---${NC}"
IDEMP_KEY="test-idempotency-$(date +%s)"
test_endpoint "First submission" "POST" "/api/intake" \
  '{"full_name":"Idempotency Test","email":"idemp@demo.local","symptoms":"Testing idempotency key behavior"}' \
  "201" ""

# ---- Data Endpoints ----
echo -e "\n${YELLOW}--- Data Endpoints ---${NC}"
test_endpoint "GET /api/patients" "GET" "/api/patients" "" "200" "patients"
test_endpoint "GET /api/doctors" "GET" "/api/doctors" "" "200" "doctors"
test_endpoint "GET /api/specialties" "GET" "/api/specialties" "" "200" "specialties"
test_endpoint "GET /api/appointments" "GET" "/api/appointments" "" "200" "appointments"
test_endpoint "GET /api/dashboard" "GET" "/api/dashboard" "" "200" "stats"
test_endpoint "GET /api/human-review" "GET" "/api/human-review" "" "200" "reviews"
test_endpoint "GET /api/audit" "GET" "/api/audit" "" "200" "audit_trail"
test_endpoint "GET /api/followups" "GET" "/api/followups" "" "200" "followups"
test_endpoint "GET /api/feedback" "GET" "/api/feedback" "" "200" "feedback"

# ---- Test: 404 ----
echo -e "\n${YELLOW}--- 404 Handling ---${NC}"
test_endpoint "Unknown route returns 404" "GET" "/api/nonexistent" "" "404" "NOT_FOUND"
test_endpoint "Invalid patient ID" "GET" "/api/patients/not-a-uuid" "" "400" "INVALID_ID"

# ---- Results ----
echo ""
echo "============================================================"
echo "  RESULTS: $PASS passed, $FAIL failed, $TOTAL total"
echo "============================================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
