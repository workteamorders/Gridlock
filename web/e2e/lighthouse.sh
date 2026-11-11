#!/bin/bash
# Usage: e2e/lighthouse.sh <dir> <url-path>... ; mobile profile, headless Chrome. Writes e2e/lh/*.json
set -e
cd "$(dirname "$0")/.."
DIR=$1; shift
mkdir -p e2e/lh
(cd $DIR && python3 -m http.server 4173 --bind 127.0.0.1 >/dev/null 2>&1 & echo $! > /tmp/lh-site.pid)
sleep 1
for P in "$@"; do
  NAME=$(echo "$DIR$P" | tr -c 'a-zA-Z0-9' '_')
  CHROME_PATH=/usr/bin/google-chrome node /tmp/tools/node_modules/lighthouse/cli/index.js "http://127.0.0.1:4173$P" --quiet --output=json --output-path=e2e/lh/$NAME.json --chrome-flags="--headless=new --no-sandbox" --only-categories=performance,accessibility,best-practices,seo >/dev/null 2>&1 || echo "lighthouse failed for $P"
  node -e "const r=require('./e2e/lh/$NAME.json');const c=r.categories;console.log('$DIR$P',Object.entries(c).map(([k,v])=>k.slice(0,4)+':'+Math.round(v.score*100)).join(' '),'LCP',Math.round(r.audits['largest-contentful-paint'].numericValue),'CLS',r.audits['cumulative-layout-shift'].numericValue.toFixed(3),'TBT',Math.round(r.audits['total-blocking-time'].numericValue))"
done
pkill -f "http.server 4173" || true
