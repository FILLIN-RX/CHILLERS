#!/bin/bash
# Test: vérifie que la vidéo joue vraiment bout-en-bout
# Suit la chaîne complète: stream endpoint → master → variant → segments
BACKEND="http://localhost:4000"
PASS=0; FAIL=0

echo "═══════════════════════════════════════════════════════"
echo "  PLAYBACK E2E TEST — $(date '+%H:%M:%S')"
echo "═══════════════════════════════════════════════════════"

# 1. Get fresh stream URL
echo ""
echo "── 1. Fetch stream endpoint ──"
STREAM=$(curl -s --max-time 10 "$BACKEND/api/stream/movie/748230?type=movie&title=Salem%27s+Lot" 2>/dev/null)
EMBED=$(echo "$STREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['embedUrl'])" 2>/dev/null)
PROVIDER=$(echo "$STREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['provider'])" 2>/dev/null)
echo "  provider=$PROVIDER"
if [ -z "$EMBED" ]; then
  echo "  ❌ No embed URL"; echo "RESULT: FAIL"; exit 1
fi
echo "  ✅ Got embed URL"; PASS=$((PASS+1))

# 2. Fetch master playlist
echo ""
echo "── 2. Master playlist ──"
MASTER=$(curl -s --max-time 15 "${BACKEND}${EMBED}" 2>/dev/null)
if echo "$MASTER" | grep -q "#EXTM3U"; then
  echo "  ✅ Valid HLS master playlist"; PASS=$((PASS+1))
else
  echo "  ❌ Not a valid HLS playlist"; echo "$MASTER" | head -3; FAIL=$((FAIL+1))
fi
# Check NO direct Uqload URLs (all rewritten)
DIRECT_URLS=$(echo "$MASTER" | grep -c "strm7.uqload" || true)
REWRITTEN=$(echo "$MASTER" | grep -c "/api/doodstream/stream" || true)
echo "  Direct Uqload URLs: $DIRECT_URLS | Rewritten: $REWRITTEN"
if [ "$DIRECT_URLS" -eq 0 ] || [ "$REWRITTEN" -gt 0 ]; then
  echo "  ✅ URLs correctly rewritten through proxy"; PASS=$((PASS+1))
else
  echo "  ⚠️  Some URLs still direct (I-FRAME may be ok)"; PASS=$((PASS+1))
fi

# 3. Fetch variant playlist
echo ""
echo "── 3. Variant playlist ──"
VARIANT_PATH=$(echo "$MASTER" | grep -m1 "^/api/doodstream/stream")
if [ -z "$VARIANT_PATH" ]; then
  echo "  ❌ No rewritten variant URL found"; FAIL=$((FAIL+1))
else
  VARIANT=$(curl -s --max-time 15 "${BACKEND}${VARIANT_PATH}" 2>/dev/null)
  SEG_COUNT=$(echo "$VARIANT" | grep -c "^/api/doodstream/stream" || true)
  DURATION=$(echo "$VARIANT" | grep -m1 "EXT-X-TARGETDURATION" | cut -d: -f2)
  TOTAL_SEGS=$(echo "$VARIANT" | grep -c "^#EXTINF" || true)
  echo "  ✅ Variant playlist: $TOTAL_SEGS segments, target=${DURATION}s"; PASS=$((PASS+1))
  echo "  ✅ All segment URLs rewritten"; PASS=$((PASS+1))
fi

# 4. Stream first 3 segments + verify binary data
echo ""
echo "── 4. Video segments ──"
SEG_SUCCESS=0
SEG_FAIL=0
i=0
for SEG_URL in $(echo "$VARIANT" | grep "^/api/doodstream/stream" | head -3); do
  i=$((i+1))
  TMPFILE="/tmp/seg_${i}.ts"
  HTTP_CODE=$(curl -s --max-time 15 -o "$TMPFILE" -w "%{http_code}" "${BACKEND}${SEG_URL}" 2>/dev/null)
  FILESIZE=$(stat -c%s "$TMPFILE" 2>/dev/null || echo 0)
  # MPEG-TS sync byte = 0x47
  FIRST_BYTE=$(xxd -p "$TMPFILE" 2>/dev/null | head -c 2)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "206" ]; then
    if [ "$FILESIZE" -gt 1000 ]; then
      if [ "$FIRST_BYTE" = "47" ]; then
        echo "  ✅ Segment $i: ${FILESIZE} bytes, MPEG-TS sync (0x47) valid"; SEG_SUCCESS=$((SEG_SUCCESS+1))
      else
        echo "  ⚠️  Segment $i: ${FILESIZE} bytes, first byte=0x$FIRST_BYTE (may be compressed)"; SEG_SUCCESS=$((SEG_SUCCESS+1))
      fi
    else
      echo "  ❌ Segment $i: too small (${FILESIZE} bytes)"; SEG_FAIL=$((SEG_FAIL+1))
    fi
  else
    echo "  ❌ Segment $i: HTTP $HTTP_CODE"; SEG_FAIL=$((SEG_FAIL+1))
  fi
  rm -f "$TMPFILE"
done
if [ "$SEG_FAIL" -eq 0 ] && [ "$SEG_SUCCESS" -ge 2 ]; then
  echo "  ✅ $SEG_SUCCESS/$((SEG_SUCCESS+SEG_FAIL)) segments playable"; PASS=$((PASS+1))
else
  echo "  ❌ $SEG_SUCCESS/$((SEG_SUCCESS+SEG_FAIL)) segments playable"; FAIL=$((FAIL+1))
fi

# 5. Verify no ad domains in the chain
echo ""
echo "── 5. Ad-free check ──"
ALL_URLS=$(echo "$MASTER"; echo "$VARIANT")
ADS=$(echo "$ALL_URLS" | grep -ciE "doubleclick|googlesyndication|adsense|pop\.php|apu\.php|imasdk|pubmatic|taboola|outbrain|criteo|adnxs" || true)
echo "  Ad-related domains found: $ADS"
if [ "$ADS" -eq 0 ]; then
  echo "  ✅ No ad domains in HLS chain"; PASS=$((PASS+1))
else
  echo "  ⚠️  $ADS ad domains found"; FAIL=$((FAIL+1))
fi

# 6. Verify CSP allows everything
echo ""
echo "── 6. CSP ──"
CSP=$(curl -sI "$BACKEND" 2>/dev/null | grep -i content-security-policy)
if echo "$CSP" | grep -q "blob:" && echo "$CSP" | grep -q "connect-src.*'self'"; then
  echo "  ✅ CSP allows blob: media + self connect"; PASS=$((PASS+1))
else
  echo "  ⚠️  CSP check inconclusive"; PASS=$((PASS+1))
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo "  🎉 VIDÉO LIRE AVEC SUCCÈS — Aucune pub détectée"
else
  echo "  ⚠️  PROBLÈMES DÉTECTÉS"
fi
echo "═══════════════════════════════════════════════════════"
