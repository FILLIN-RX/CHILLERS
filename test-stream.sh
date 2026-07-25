#!/bin/bash
# Test: vérifie le pipeline streaming complet
set -e
BACKEND="http://localhost:4000"
FRONTEND="http://localhost:3000"
PASS=0; FAIL=0

check() {
  local label="$1" url="$2" expect="$3"
  status=$(curl -s --max-time 10 -o /tmp/resp.json -w "%{http_code}" "$url" 2>/dev/null)
  body=$(cat /tmp/resp.json 2>/dev/null)
  if echo "$body" | grep -q "$expect"; then
    echo "  ✅ $label (HTTP $status)"; PASS=$((PASS+1))
  else
    echo "  ❌ $label (HTTP $status) got='${body:0:120}'"; FAIL=$((FAIL+1))
  fi
}

echo "═══════════════════════════════════════════════"
echo "  TESTS STREAMING — $(date '+%H:%M:%S')"
echo "═══════════════════════════════════════════════"

echo "── 1. Backend health ──"
check "genres" "$BACKEND/api/genres/movie?language=fr" '"success":true'

echo "── 2. Stream (Salem's Lot) ──"
STREAM=$(curl -s --max-time 10 "$BACKEND/api/stream/movie/748230?type=movie&title=Salem%27s+Lot" 2>/dev/null)
PROVIDER=$(echo "$STREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['provider'])" 2>/dev/null)
EMBED=$(echo "$STREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['embedUrl'])" 2>/dev/null)
echo "  provider=$PROVIDER"
echo "  embedUrl=${EMBED:0:100}"

if echo "$EMBED" | grep -q "/api/doodstream/stream"; then
  echo "── 3. HLS rewrite check ──"
  MASTER=$(curl -s --max-time 15 "${BACKEND}${EMBED}" 2>/dev/null)
  if echo "$MASTER" | grep -q "/api/doodstream/stream"; then
    echo "  ✅ Master playlist rewritten (no direct Uqload URLs)"; PASS=$((PASS+1))
    echo "$MASTER" | grep -v "^#" | head -1 | sed 's/^/  → /'
  else
    echo "  ❌ Master playlist NOT rewritten"; FAIL=$((FAIL+1))
  fi

  VARIANT_URL=$(echo "$MASTER" | grep -m1 "^/api/")
  if [ -n "$VARIANT_URL" ]; then
    VARIANT=$(curl -s --max-time 15 "${BACKEND}${VARIANT_URL}" 2>/dev/null)
    if echo "$VARIANT" | grep -q "/api/doodstream/stream"; then
      echo "  ✅ Variant playlist rewritten"; PASS=$((PASS+1))
    else
      echo "  ❌ Variant playlist NOT rewritten"; FAIL=$((FAIL+1))
    fi

    SEG_URL=$(echo "$VARIANT" | grep -m1 "^/api/")
    if [ -n "$SEG_URL" ]; then
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" -r 0-1000 "${BACKEND}${SEG_URL}" 2>/dev/null)
      if [ "$STATUS" = "206" ]; then
        echo "  ✅ Segment streams (HTTP 206)"; PASS=$((PASS+1))
      else
        echo "  ❌ Segment HTTP $STATUS"; FAIL=$((FAIL+1))
      fi
    fi
  fi
fi

echo "── 4. Frontend proxy ──"
check "genres via Next.js" "$FRONTEND/api/genres/movie?language=fr" '"success":true'

echo "── 5. CSP headers ──"
CSP=$(curl -sI "$FRONTEND" 2>/dev/null | grep -i "content-security-policy")
if echo "$CSP" | grep -q "blob:" && echo "$CSP" | grep -q "connect-src.*'self'"; then
  echo "  ✅ CSP allows blob: media + same-origin connect"; PASS=$((PASS+1))
else
  echo "  ⚠️  CSP may block HLS.js"; FAIL=$((FAIL+1))
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "  🎉 ALL PASSED" || echo "  ⚠️  FAILURES"
echo "═══════════════════════════════════════════════"
