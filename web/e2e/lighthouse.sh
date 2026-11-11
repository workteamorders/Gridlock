#!/bin/bash
# Usage: e2e/lighthouse.sh <dir> <url-path>... . Mobile profile and headless Chrome.
set -eu
cd "$(dirname "$0")/.."
DIR=$1
shift
WEB=$PWD
PORT=${GRIDLOCK_E2E_PORT:-4173}
TOOLS=${GRIDLOCK_E2E_TOOLS:-/tmp/tools/node_modules}
if [ "$(uname -s)" = Darwin ]; then
  export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
else
  export CHROME_PATH="${CHROME_PATH:-/usr/bin/google-chrome}"
fi
mkdir -p e2e/lh
(cd "$DIR" && exec python3 "$WEB/e2e/serve.py" "$PORT") > /dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
for attempt in {1..20}; do
  if curl -fsS "http://127.0.0.1:$PORT/api/geo" > /dev/null 2>&1; then break; fi
  sleep 0.25
done
for P in "$@"; do
  NAME=$(printf '%s' "$DIR$P" | tr -c 'a-zA-Z0-9' '_')
  REPORT="e2e/lh/$NAME.json"
  run_audit() {
    node "$TOOLS/lighthouse/cli/index.js" "http://127.0.0.1:$PORT$P" --quiet --output=json --output-path="$REPORT" --chrome-flags="--headless=new --no-sandbox" --only-categories=performance,accessibility,best-practices,seo
  }
  if ! run_audit; then run_audit; fi
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const r = JSON.parse(readFileSync(process.argv[1], "utf8"));
    console.log(r.finalDisplayedUrl, Object.entries(r.categories).map(([k,v]) => k + "=" + Math.round(v.score * 100)).join(" "),
      "LCP", Math.round(r.audits["largest-contentful-paint"].numericValue),
      "CLS", r.audits["cumulative-layout-shift"].numericValue.toFixed(3),
      "TBT", Math.round(r.audits["total-blocking-time"].numericValue));
  ' "$REPORT"
done
