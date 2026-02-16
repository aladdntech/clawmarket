#!/bin/bash
# ─── ClawMarket Simple - Preflight Validation ────────────────
# Verifies that all modules load correctly before deployment.
# Run this before starting the server or after any dependency change.
# ─────────────────────────────────────────────────────────────

set -e

cd "$(dirname "$0")/.."

echo "🔍 Preflight check: clawmarket-simple"
echo ""

ERRORS=0

# Check 1: All shared modules load
echo -n "  validators.js ... "
if node -e "require('./src/shared/validators')" 2>/dev/null; then
  echo "✅"
else
  echo "❌ FAILED"
  node -e "require('./src/shared/validators')" 2>&1 | head -5
  ERRORS=$((ERRORS + 1))
fi

# Check 2: Routes load (this caught the z.string().ip() bug)
echo -n "  routes.js ... "
if node -e "require('./src/domains/routes')" 2>/dev/null; then
  echo "✅"
else
  echo "❌ FAILED"
  node -e "require('./src/domains/routes')" 2>&1 | head -5
  ERRORS=$((ERRORS + 1))
fi

# Check 3: Zod version compatibility
echo -n "  zod version ... "
ZOD_V=$(node -e "console.log(require('zod/package.json').version)" 2>/dev/null || echo "missing")
if [ "$ZOD_V" = "missing" ]; then
  echo "❌ NOT INSTALLED"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ v${ZOD_V}"
  # Verify critical Zod methods
  echo -n "  zod methods ... "
  if node -e "
    const {z} = require('zod');
    const checks = ['email', 'url', 'uuid'];
    const missing = checks.filter(m => typeof z.string()[m] !== 'function');
    if (missing.length) { console.error('Missing: ' + missing.join(', ')); process.exit(1); }
  " 2>/dev/null; then
    echo "✅"
  else
    echo "❌ INCOMPATIBLE"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 4: Required env vars
echo -n "  .env file ... "
if [ -f .env ]; then
  echo "✅"
else
  echo "⚠️  missing (may cause runtime errors)"
fi

# Check 5: node_modules present
echo -n "  node_modules ... "
if [ -d node_modules ]; then
  echo "✅"
else
  echo "❌ NOT INSTALLED (run npm install)"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ Preflight FAILED with $ERRORS error(s)"
  exit 1
else
  echo "✅ All checks passed"
  exit 0
fi
