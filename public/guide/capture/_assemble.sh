#!/usr/bin/env bash
# shoot-<persona>.js = async (page) => { bank header + prelude + body + return } — self-contained for
# browser_run_code_unsafe. One set per bank: shoot-<persona>.js (Stanbic IBTC → png/, fixtures/) and
# shoot-<persona>.firstbank.js (FirstBank theme → png-firstbank/, fixtures-firstbank/).
cd "$(dirname "$0")"
HERE="$(pwd)"
header() { # slug name out fix theme-json
  echo "  const BANK = '$1', BANK_NAME = '$2';"
  echo "  const OUT = '$HERE/$3';"
  echo "  const FIX = '$4';"
  echo "  const THEME = $5;"
}
for b in _*.body.js; do p=${b#_}; p=${p%.body.js}
  for bank in stanbic firstbank; do
    if [ $bank = stanbic ]; then out="shoot-$p.js"; else out="shoot-$p.$bank.js"; fi
    {
      echo 'async (page) => {'
      echo "  // Screenshots for guide/$p.html ($bank) — generated from _prelude.js + $b by _assemble.sh."
      if [ $bank = stanbic ]; then header stanbic 'Stanbic IBTC' png fixtures null
      else header firstbank FirstBank png-firstbank fixtures-firstbank "$(cat firstbank-theme.json)"; fi
      cat _prelude.js "$b"
      echo "  return log.join('\\n') + \`\\nwrites swallowed: \${(ctx._writes || []).length}\`;"
      echo '}'
    } > "$out"
  done
done
